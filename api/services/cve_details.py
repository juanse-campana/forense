"""Enriquece las CVEs detectadas en librerias de terceros con el detalle
oficial del NVD (National Vulnerability Database, https://nvd.nist.gov).

Mismo patron cache-aside que cve_lookup.py, pero a nivel CVE individual:
- Si el CVE esta en la tabla `cve_details` y es fresco (TTL 90 dias, los
  puntajes CVSS de un CVE publicado casi nunca cambian), se usa tal cual.
- Si no esta (o esta viejo), se consulta la API 2.0 del NVD, se guarda y
  se usa. La proxima app que tenga esa misma CVE ya no pega a la red.

Rate limits del NVD: 5 req/30s sin API key, 50 req/30s con key (gratis,
https://nvd.nist.gov/developers/request-an-api-key). Se configura con
FORENSE_NVD_API_KEY. Ademas hay un tope de CVEs nuevos por analisis
(FORENSE_NVD_MAX_PER_ANALYSIS) para que un APK con cientos de CVEs sin
cache no demore todo el pipeline: lo que falta queda sin detalle NVD por
esta vez y se completa en analisis posteriores.
"""
import asyncio
import re
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from models import CveDetail

NVD_API_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0"
CACHE_TTL = timedelta(days=90)
REQUEST_TIMEOUT = 10.0

# Rate limit del NVD expresado como espera minima entre requests.
_THROTTLE_WITH_KEY = 0.6    # 50 req / 30s
_THROTTLE_WITHOUT_KEY = 6.0  # 5 req / 30s

CVE_ID_PATTERN = re.compile(r"^CVE-\d{4}-\d{4,}$")


def _resolve_cve_id(vulnerability: dict) -> str | None:
    """El id primario de una vulnerabilidad OSV suele ser un GHSA; el CVE
    oficial (el que entiende el NVD) viene en `aliases`. Si no hay ninguno,
    no hay nada que enriquecer para esta vulnerabilidad."""
    vuln_id = vulnerability.get("id") or ""
    if CVE_ID_PATTERN.match(vuln_id):
        return vuln_id
    for alias in vulnerability.get("aliases") or []:
        if CVE_ID_PATTERN.match(alias):
            return alias
    return None


def _parse_nvd_response(data: dict) -> dict | None:
    vulnerabilities = data.get("vulnerabilities") or []
    if not vulnerabilities:
        return None
    cve = vulnerabilities[0].get("cve") or {}

    # CVSS v3.1 es el estandar actual; v3.0 queda como fallback para CVEs
    # viejos que el NVD no recalculo. v2 se ignora a proposito (escala
    # distinta, confundiria mas de lo que ayuda).
    cvss_score = None
    cvss_severity = None
    metrics = cve.get("metrics") or {}
    for key in ("cvssMetricV31", "cvssMetricV30"):
        entries = metrics.get(key) or []
        if entries:
            cvss_data = entries[0].get("cvssData") or {}
            cvss_score = cvss_data.get("baseScore")
            cvss_severity = cvss_data.get("baseSeverity")
            break

    description = next(
        (d.get("value") for d in cve.get("descriptions") or [] if d.get("lang") == "en"),
        None,
    )

    published_at = None
    published_raw = cve.get("published")
    if published_raw:
        try:
            published_at = datetime.fromisoformat(published_raw)
            if published_at.tzinfo is None:
                published_at = published_at.replace(tzinfo=timezone.utc)
        except ValueError:
            published_at = None

    references = [r.get("url") for r in cve.get("references") or [] if r.get("url")][:5]

    return {
        "cve_id": cve.get("id"),
        "cvss_score": cvss_score,
        "cvss_severity": cvss_severity,
        "description": description,
        "published_at": published_at,
        "references": references,
    }


async def _fetch_nvd_cve(client: httpx.AsyncClient, cve_id: str) -> dict | None:
    headers = {"apiKey": settings.nvd_api_key} if settings.nvd_api_key else {}
    try:
        response = await client.get(
            NVD_API_URL,
            params={"cveId": cve_id},
            headers=headers,
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
    except httpx.HTTPError:
        # Un CVE que falla no se cachea: se reintenta en el proximo
        # analisis. Jamas se tira abajo el pipeline por esto.
        return None
    return _parse_nvd_response(response.json())


async def enrich_libraries_with_nvd(libraries: list[dict], db: AsyncSession) -> list[dict]:
    """Adjunta a cada vulnerabilidad de cada libreria el detalle oficial
    del NVD bajo la clave "nvd" (o None si no hay CVE id / no se pudo
    obtener). Muta los dicts in-place, igual que check_libraries_for_cves."""
    cve_ids: dict[str, None] = {}  # set ordenado por aparicion
    for lib in libraries:
        for vuln in lib.get("vulnerabilities") or []:
            cve_id = _resolve_cve_id(vuln)
            if cve_id:
                cve_ids[cve_id] = None

    if not cve_ids:
        return libraries

    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(CveDetail).where(CveDetail.cve_id.in_(list(cve_ids)))
    )
    cached_rows = {row.cve_id: row for row in result.scalars().all()}

    def _is_fresh(row: CveDetail) -> bool:
        fetched_at = row.fetched_at
        if fetched_at is None:
            return False
        if fetched_at.tzinfo is None:
            fetched_at = fetched_at.replace(tzinfo=timezone.utc)
        return (now - fetched_at) < CACHE_TTL

    details: dict[str, dict] = {
        cve_id: {
            "cve_id": row.cve_id,
            "cvss_score": row.cvss_score,
            "cvss_severity": row.cvss_severity,
            "description": row.description,
            "published_at": row.published_at.isoformat() if row.published_at else None,
            "references": row.references,
        }
        for cve_id, row in cached_rows.items()
        if _is_fresh(row)
    }

    stale_or_missing = [cve_id for cve_id in cve_ids if cve_id not in details]
    to_fetch = stale_or_missing[: settings.nvd_max_per_analysis]
    throttle = _THROTTLE_WITH_KEY if settings.nvd_api_key else _THROTTLE_WITHOUT_KEY

    async with httpx.AsyncClient() as client:
        for index, cve_id in enumerate(to_fetch):
            if index > 0:
                await asyncio.sleep(throttle)
            detail = await _fetch_nvd_cve(client, cve_id)
            if detail is None:
                continue

            details[cve_id] = {
                **detail,
                "published_at": detail["published_at"].isoformat() if detail["published_at"] else None,
            }

            row = cached_rows.get(cve_id)
            if row:
                row.cvss_score = detail["cvss_score"]
                row.cvss_severity = detail["cvss_severity"]
                row.description = detail["description"]
                row.published_at = detail["published_at"]
                row.references = detail["references"]
                row.fetched_at = now
            else:
                db.add(CveDetail(
                    cve_id=cve_id,
                    cvss_score=detail["cvss_score"],
                    cvss_severity=detail["cvss_severity"],
                    description=detail["description"],
                    published_at=detail["published_at"],
                    references=detail["references"],
                    fetched_at=now,
                ))
            await db.flush()

    for lib in libraries:
        for vuln in lib.get("vulnerabilities") or []:
            cve_id = _resolve_cve_id(vuln)
            vuln["nvd"] = details.get(cve_id) if cve_id else None

    return libraries
