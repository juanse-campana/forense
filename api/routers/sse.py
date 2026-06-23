import asyncio
from uuid import UUID

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from services.analyzer import job_queues

router = APIRouter()


async def event_stream(job_id: UUID):
    # Wait briefly for the queue to be created by the background task
    queue = None
    for _ in range(30):  # up to 3 seconds
        queue = job_queues.get(job_id)
        if queue:
            break
        await asyncio.sleep(0.1)

    if not queue:
        yield f"event: error\ndata: Job not running or already finished\n\n"
        return

    while True:
        try:
            event = await asyncio.wait_for(queue.get(), timeout=10.0)
            typ, data = event
            if typ == "close":
                yield f"event: close\ndata: done\n\n"
                break
            elif typ == "progress":
                yield f"event: progress\ndata: {data}\n\n"
            elif typ == "completed":
                yield f"event: completed\ndata: {data}\n\n"
                break
            elif typ == "failed":
                yield f"event: failed\ndata: {data}\n\n"
                break
        except asyncio.TimeoutError:
            yield f"event: heartbeat\ndata: ping\n\n"


@router.get("/api/v1/jobs/{job_id}/progress")
async def job_progress(job_id: UUID):
    return StreamingResponse(
        event_stream(job_id),
        media_type="text/event-stream",
    )
