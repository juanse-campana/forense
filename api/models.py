import uuid
from datetime import datetime
from sqlalchemy import Column, String, BigInteger, Integer, DateTime, Text, JSON, func
from sqlalchemy.dialects.postgresql import UUID

from database import Base


class Job(Base):
    __tablename__ = "jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    status = Column(String(20), default="pending", nullable=False)
    filename = Column(String(255), nullable=False)
    file_size = Column(BigInteger, nullable=False)
    md5 = Column(String(32), nullable=True)
    sha256 = Column(String(64), nullable=True)
    package_name = Column(String(255), nullable=True)
    version_name = Column(String(100), nullable=True)
    obfuscation_score = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
    report = Column(JSON, nullable=True)
    file_path = Column(Text, nullable=False)
    decompiled_path = Column(Text, nullable=True)
