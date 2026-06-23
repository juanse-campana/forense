import os
import shutil
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, UploadFile, BackgroundTasks, HTTPException, Query
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Job
from services import analyzer
from config import settings

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
    return {
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
        "report": job.report,
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
