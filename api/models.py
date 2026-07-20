import uuid
from datetime import datetime
from sqlalchemy import Column, String, BigInteger, Integer, DateTime, Text, JSON, Float, func, ForeignKey, UniqueConstraint
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
    findings_count = Column(Integer, nullable=True, default=0)
    highest_severity = Column(String(20), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
    report = Column(JSON, nullable=True)
    file_path = Column(Text, nullable=False)
    decompiled_path = Column(Text, nullable=True)


class OwaspMobileCategory(Base):
    """Las 10 categorias fijas del OWASP Mobile Top 10 (2024). Se seedean
    una sola vez en la migracion 004 - no hay logica de consulta/registro
    acá porque es una lista estatica publicada por OWASP, no un servicio."""
    __tablename__ = "owasp_mobile_categories"

    id = Column(String(3), primary_key=True)  # "M1".."M10"
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)


class FindingOwaspMapping(Base):
    """Mapea el rule_id estable de cada Finding (definido en apk_forensics.py)
    a su categoria OWASP. Tambien fijo, seedeado en la migracion 004 junto
    con las categorias - el set de rule_ids es finito y lo controlamos
    nosotros mismos en el codigo del motor."""
    __tablename__ = "finding_owasp_mapping"

    rule_id = Column(String(60), primary_key=True)
    owasp_category_id = Column(String(3), ForeignKey("owasp_mobile_categories.id"), nullable=True)


class LibraryVulnerabilityCache(Base):
    """Cache de CVEs por libreria+version, consultadas contra OSV.dev
    (https://osv.dev). A diferencia de las dos tablas de arriba, esto SI
    es dinamico: la combinacion libreria+version es infinita, por eso
    tiene sentido el patron 'si no esta en cache, consultar y guardar'."""
    __tablename__ = "library_vulnerability_cache"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ecosystem = Column(String(50), nullable=False)  # "Maven"
    package_name = Column(String(255), nullable=False)  # "com.google.android.gms:play-services-location"
    version = Column(String(100), nullable=False)
    vulnerabilities = Column(JSON, nullable=False, default=list)
    checked_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("ecosystem", "package_name", "version", name="uq_library_version"),
    )


class CveDetail(Base):
    """Cache del detalle oficial de cada CVE individual, consultado contra
    el NVD (National Vulnerability Database, https://nvd.nist.gov). El set
    de CVEs posibles es infinito y va creciendo con el tiempo, asi que
    aplica el mismo patron cache-aside que LibraryVulnerabilityCache:
    si el CVE esta y esta fresco se usa, si no se consulta y se guarda.
    TTL largo (90 dias, ver cve_details.py) porque el puntaje CVSS de un
    CVE publicado casi nunca cambia."""
    __tablename__ = "cve_details"

    cve_id = Column(String(20), primary_key=True)  # "CVE-2024-12345"
    cvss_score = Column(Float, nullable=True)  # 0.0 - 10.0 (CVSS v3.1)
    cvss_severity = Column(String(10), nullable=True)  # "CRITICAL" | "HIGH" | ...
    description = Column(Text, nullable=True)
    published_at = Column(DateTime(timezone=True), nullable=True)
    references = Column(JSON, nullable=False, default=list)
    fetched_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
