import asyncio
import json
import queue as thread_queue
import shutil
import tempfile
import threading
from datetime import datetime
from pathlib import Path
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from apk_forensics import run_analysis, SEVERITY_ORDER
from database import AsyncSessionLocal
from models import Job

# In-memory event queues for SSE progress streaming
job_queues: dict[UUID, asyncio.Queue] = {}

# Orden real de los pasos que dispara run_analysis() en apk_forensics.py.
# El front necesita un numero (no solo "paso X"), asi que le asignamos un
# porcentaje aproximado por paso completado.
_STEPS = ["integrity", "structure", "manifest", "strings", "crypto", "obfuscation", "jadx"]
_STEP_LABELS = {
    "integrity": "Calculando hashes",
    "structure": "Inspeccionando estructura del APK",
    "manifest": "Analizando AndroidManifest.xml",
    "strings": "Buscando secretos",
    "crypto": "Detectando criptografía",
    "obfuscation": "Evaluando ofuscación",
    "jadx": "Decompilando con JADX",
}


def _analyzer_worker(apk_path: str, workdir: str, no_jadx: bool, q: thread_queue.Queue):
    """Runs the synchronous forensics analysis in a background thread."""

    def cb(step: str, status: str):
        pct = round((_STEPS.index(step) + 1) / len(_STEPS) * 100) if step in _STEPS else 0
        payload = json.dumps({
            "type": "progress",
            "progress": pct,
            "message": _STEP_LABELS.get(step, step),
            "module": step,
        })
        q.put(("progress", payload))

    try:
        report = run_analysis(apk_path, workdir, no_jadx, progress_callback=cb)
        q.put(("success", report))
    except Exception as e:
        q.put(("error", str(e)))


async def run(job_id: UUID, apk_path: str):
    """Async wrapper that runs analysis in a thread and updates the DB."""
    q = asyncio.Queue()
    job_queues[job_id] = q

    workdir = tempfile.mkdtemp(prefix=f"apk_{job_id}_")
    tq = thread_queue.Queue()

    thread = threading.Thread(
        target=_analyzer_worker,
        args=(apk_path, workdir, False, tq),
    )
    thread.start()

    report = None
    error = None

    # Drain thread queue into async queue
    while thread.is_alive() or not tq.empty():
        try:
            msg = tq.get(timeout=0.5)
            typ, data = msg
            if typ == "progress":
                await q.put(("progress", data))
            elif typ == "success":
                report = data
            elif typ == "error":
                error = data
        except thread_queue.Empty:
            await asyncio.sleep(0.1)

    thread.join()

    # Persist JADX output if available
    jadx_source = Path(workdir) / "jadx_out"
    upload_dir = Path(apk_path).parent
    jadx_dest = upload_dir / "jadx_out"
    decompiled_path = None
    if jadx_source.exists():
        if jadx_dest.exists():
            shutil.rmtree(jadx_dest, ignore_errors=True)
        shutil.copytree(jadx_source, jadx_dest)
        decompiled_path = str(jadx_dest)

    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(select(Job).where(Job.id == job_id))
            job = result.scalar_one()

            if error:
                job.status = "failed"
                job.error_message = error
                await q.put(("failed", error))
            else:
                job.status = "completed"
                job.md5 = report.md5
                job.sha256 = report.sha256
                job.package_name = report.package_name
                job.version_name = report.version_name
                job.obfuscation_score = report.obfuscation_score
                job.findings_count = len(report.findings)
                if report.findings:
                    worst = min(report.findings, key=lambda f: SEVERITY_ORDER.get(f.severity, 99))
                    job.highest_severity = worst.severity.lower()
                if decompiled_path:
                    job.decompiled_path = decompiled_path
                job.report = {
                    "apk_path": report.apk_path,
                    "apk_name": report.apk_name,
                    "timestamp": report.timestamp,
                    "md5": report.md5,
                    "sha256": report.sha256,
                    "file_size": report.file_size,
                    "package_name": report.package_name,
                    "version_name": report.version_name,
                    "version_code": report.version_code,
                    "min_sdk": report.min_sdk,
                    "target_sdk": report.target_sdk,
                    "compile_sdk": report.compile_sdk,
                    "permissions": report.permissions,
                    "dangerous_permissions": report.dangerous_permissions,
                    "components": report.components,
                    "exported_components": report.exported_components,
                    "native_libs": report.native_libs,
                    "dex_files": report.dex_files,
                    "findings": [
                        {
                            "severity": f.severity,
                            "category": f.category,
                            "title": f.title,
                            "detail": f.detail,
                            "file": f.file,
                            "line": f.line,
                            "evidence": f.evidence,
                        }
                        for f in report.findings
                    ],
                    "crypto_usage": report.crypto_usage,
                    "obfuscation_score": report.obfuscation_score,
                    "obfuscation_indicators": report.obfuscation_indicators,
                    "interesting_urls": report.interesting_urls,
                    "interesting_files": report.interesting_files,
                    "tool_versions": report.tool_versions,
                    "debuggable": report.debuggable,
                    "allow_backup": report.allow_backup,
                    "manifest": report.manifest,
                }
                job.completed_at = datetime.utcnow()
                await q.put(("completed", "done"))

            await db.commit()
        except Exception as db_err:
            await db.rollback()
            await q.put(("failed", str(db_err)))
        finally:
            shutil.rmtree(workdir, ignore_errors=True)
            await q.put(("close", ""))
            await asyncio.sleep(2)
            job_queues.pop(job_id, None)
