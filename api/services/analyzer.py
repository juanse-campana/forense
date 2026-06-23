import asyncio
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

from apk_forensics import run_analysis
from database import AsyncSessionLocal
from models import Job

# In-memory event queues for SSE progress streaming
job_queues: dict[UUID, asyncio.Queue] = {}


def _analyzer_worker(apk_path: str, workdir: str, no_jadx: bool, q: thread_queue.Queue):
    """Runs the synchronous forensics analysis in a background thread."""

    def cb(step: str, status: str):
        q.put(("progress", f"{step}:{status}"))

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
                await q.put(("progress", "analysis_complete"))
            elif typ == "error":
                error = data
                await q.put(("progress", f"error:{data}"))
        except thread_queue.Empty:
            await asyncio.sleep(0.1)

    thread.join()

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
