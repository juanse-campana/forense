"""Clasifica los findings del motor contra el OWASP Mobile Top 10.

Es un mapeo estatico: el set de rule_ids que puede generar apk_forensics.py
es finito y lo conocemos por completo (ver migracion 004), asi que esto es
un SELECT simple, sin llamada externa. Si un rule_id no tiene fila de
mapeo (por ejemplo, alguien agrego un patron nuevo sin actualizar la
migracion), se clasifica como None en vez de romper el analisis.
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import FindingOwaspMapping, OwaspMobileCategory

_cache: dict[str, dict | None] | None = None


async def _load_mapping(db: AsyncSession) -> dict[str, dict | None]:
    global _cache
    if _cache is not None:
        return _cache

    result = await db.execute(
        select(FindingOwaspMapping.rule_id, OwaspMobileCategory.id, OwaspMobileCategory.name)
        .outerjoin(OwaspMobileCategory, FindingOwaspMapping.owasp_category_id == OwaspMobileCategory.id)
    )
    mapping: dict[str, dict | None] = {}
    for rule_id, category_id, category_name in result.all():
        mapping[rule_id] = (
            {"id": category_id, "name": category_name} if category_id else None
        )
    _cache = mapping
    return mapping


async def classify_findings(findings: list[dict], db: AsyncSession) -> list[dict]:
    """Le agrega `owasp_category` a cada finding segun su rule_id.

    findings: lista de dicts con al menos la clave "rule_id" (puede venir
    vacia/ausente para hallazgos viejos generados antes de este feature).
    """
    mapping = await _load_mapping(db)
    for finding in findings:
        rule_id = finding.get("rule_id") or ""
        finding["owasp_category"] = mapping.get(rule_id)
    return findings
