import json
import os
import shutil
import sys
import tempfile
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, UploadFile, BackgroundTasks, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Job
from services import analyzer
from config import settings

# Import report generation logic from apk_forensics
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from apk_forensics import ForensicsReport, Finding, _write_json, _write_markdown, _write_html

router = APIRouter()


@router.post("/api/v1/jobs")
async def create_job(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    job_id = uuid4()
    upload_dir = Path(settings.upload_dir) / str(job_id)
    upload_dir.mkdir(parents=True, exist_ok=True)

    file_path = upload_dir / file.filename

    content = await file.read()
    if len(content) > settings.max_file_size:
        raise HTTPException(status_code=413, detail="File too large (max 500MB)")

    with open(file_path, "wb") as f:
        f.write(content)

    job = Job(
        id=job_id,
        filename=file.filename,
        file_size=len(content),
        file_path=str(file_path),
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    background_tasks.add_task(analyzer.run, job_id, str(file_path))

    return {
        "id": str(job.id),
        "status": job.status,
        "filename": job.filename,
        "file_size": job.file_size,
        "created_at": job.created_at.isoformat() if job.created_at else None,
    }


@router.get("/api/v1/jobs/{job_id}")
async def get_job(job_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    response = {
        "id": str(job.id),
        "status": job.status,
        "filename": job.filename,
        "file_size": job.file_size,
        "md5": job.md5,
        "sha256": job.sha256,
        "package_name": job.package_name,
        "version_name": job.version_name,
        "obfuscation_score": job.obfuscation_score,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "updated_at": job.updated_at.isoformat() if job.updated_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        "error_message": job.error_message,
    }

    if job.report:
        response.update(job.report)

    return response


_SEVERITY_ORDER = {
    "critical": 0,
    "high": 1,
    "medium": 2,
    "low": 3,
    "info": 4,
}


@router.get("/api/v1/jobs/{job_id}/findings")
async def get_job_findings(
    job_id: UUID,
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=100),
    severity: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    findings = []
    if job.report:
        findings = job.report.get("findings", []) or []

    if severity:
        findings = [f for f in findings if f.get("severity") == severity]

    findings.sort(key=lambda f: _SEVERITY_ORDER.get(f.get("severity", ""), 99))

    total = len(findings)
    offset = (page - 1) * limit
    items = findings[offset : offset + limit]
    has_more = offset + limit < total

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "has_more": has_more,
    }


@router.get("/api/v1/jobs")
async def list_jobs(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    offset = (page - 1) * limit
    result = await db.execute(
        select(Job).order_by(desc(Job.created_at)).offset(offset).limit(limit)
    )
    jobs = result.scalars().all()

    count_result = await db.execute(select(func.count()).select_from(Job))
    total = count_result.scalar()

    return {
        "items": [
            {
                "id": str(j.id),
                "status": j.status,
                "filename": j.filename,
                "file_size": j.file_size,
                "package_name": j.package_name,
                "created_at": j.created_at.isoformat() if j.created_at else None,
            }
            for j in jobs
        ],
        "page": page,
        "limit": limit,
        "total": total,
    }




def _dict_to_finding(d: dict) -> Finding:
    return Finding(
        severity=d.get("severity", "INFO"),
        category=d.get("category", ""),
        title=d.get("title", ""),
        detail=d.get("detail", ""),
        file=d.get("file", ""),
        line=d.get("line", 0),
        evidence=d.get("evidence", ""),
    )


def _report_from_json(data: dict) -> ForensicsReport:
    findings = [_dict_to_finding(f) for f in data.get("findings", [])]
    return ForensicsReport(
        apk_path=data.get("apk_path", ""),
        apk_name=data.get("apk_name", ""),
        timestamp=data.get("timestamp", ""),
        md5=data.get("md5", ""),
        sha256=data.get("sha256", ""),
        file_size=data.get("file_size", 0),
        package_name=data.get("package_name", ""),
        version_name=data.get("version_name", ""),
        version_code=data.get("version_code", ""),
        min_sdk=data.get("min_sdk", ""),
        target_sdk=data.get("target_sdk", ""),
        compile_sdk=data.get("compile_sdk", ""),
        permissions=data.get("permissions", []),
        dangerous_permissions=data.get("dangerous_permissions", []),
        components=data.get("components", {}),
        exported_components=data.get("exported_components", []),
        native_libs=data.get("native_libs", []),
        dex_files=data.get("dex_files", []),
        findings=findings,
        crypto_usage=data.get("crypto_usage", []),
        obfuscation_score=data.get("obfuscation_score", 0),
        obfuscation_indicators=data.get("obfuscation_indicators", []),
        interesting_urls=data.get("interesting_urls", []),
        interesting_files=data.get("interesting_files", []),
        tool_versions=data.get("tool_versions", {}),
    )


_SEVERITY_ORDER_EXPORT = {
    "CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "INFO": 4,
    "critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4,
}


@router.get("/api/v1/jobs/{job_id}/export")
async def export_job_report(
    job_id: UUID,
    format: str = Query("json", regex="^(json|html|md)$"),
    db: AsyncSession = Depends(get_db),
    background_tasks: BackgroundTasks = ...,
):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    upload_dir = Path(settings.upload_dir) / str(job_id)
    report_path = upload_dir / f"report.{format}"

    if report_path.exists():
        media_types = {
            "json": "application/json",
            "html": "text/html; charset=utf-8",
            "md": "text/markdown; charset=utf-8",
        }
        return FileResponse(
            path=str(report_path),
            media_type=media_types[format],
            filename=f"report_{job_id}.{format}",
        )

    if not job.report:
        raise HTTPException(status_code=404, detail="Report not available")

    # Generate on-the-fly from job.report JSON
    report = _report_from_json(job.report)
    report.findings.sort(key=lambda f: _SEVERITY_ORDER_EXPORT.get(f.severity, 99))

    fd, tmp_path = tempfile.mkstemp(suffix=f".{format}")
    os.close(fd)

    try:
        if format == "json":
            _write_json(report, tmp_path)
        elif format == "html":
            _write_html(report, tmp_path)
        elif format == "md":
            _write_markdown(report, tmp_path)

        media_types = {
            "json": "application/json",
            "html": "text/html; charset=utf-8",
            "md": "text/markdown; charset=utf-8",
        }

        background_tasks.add_task(os.unlink, tmp_path)

        return FileResponse(
            path=tmp_path,
            media_type=media_types[format],
            filename=f"report_{job_id}.{format}",
        )
    except Exception as e:
        os.unlink(tmp_path)
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")

@router.delete("/api/v1/jobs/{job_id}")
async def delete_job(job_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    upload_dir = Path(settings.upload_dir) / str(job_id)
    if upload_dir.exists():
        shutil.rmtree(upload_dir, ignore_errors=True)

    await db.delete(job)
    await db.commit()
    return {"deleted": True}


@router.get("/api/v1/jobs/{job_id}/files")
async def get_job_files(
    job_id: UUID,
    path: str = Query(""),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if not job.decompiled_path:
        return []

    base_path = Path(job.decompiled_path).resolve()
    target_path = (base_path / path).resolve() if path else base_path

    # Security: prevent path traversal
    if not str(target_path).startswith(str(base_path)):
        raise HTTPException(status_code=400, detail="Invalid path")

    if not target_path.exists():
        return []

    if target_path.is_file():
        return []

    items = []
    for entry in sorted(target_path.iterdir(), key=lambda e: (e.is_file(), e.name.lower())):
        relative = str(entry.relative_to(base_path)).replace("\\", "/")
        items.append({
            "name": entry.name,
            "type": "directory" if entry.is_dir() else "file",
            "size": entry.stat().st_size if entry.is_file() else None,
            "path": relative,
        })

    return items


@router.get("/api/v1/jobs/{job_id}/files/content")
async def get_job_file_content(
    job_id: UUID,
    path: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if not job.decompiled_path:
        raise HTTPException(status_code=404, detail="No decompiled files available")

    base_path = Path(job.decompiled_path).resolve()
    target_path = (base_path / path).resolve()

    # Security: prevent path traversal
    if not str(target_path).startswith(str(base_path)):
        raise HTTPException(status_code=400, detail="Invalid path")

    if not target_path.exists() or not target_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    # Limit file size to 5MB for safety
    if target_path.stat().st_size > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large")

    try:
        content = target_path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        raise HTTPException(status_code=400, detail="Unable to read file")

    return {"content": content, "path": path, "name": target_path.name}
