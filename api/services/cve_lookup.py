"""Detecta CVEs conocidas en las librerias de terceros que trae el APK,
consultando OSV.dev (https://osv.dev, Google, gratis, sin auth) y
cacheando el resultado en Postgres.

A diferencia de owasp_classifier.py, esto SI es dinamico: la combinacion
libreria+version es infinita, no la conocemos de antemano. Por eso el
patron real es "si ya la consultamos, usar el cache; si no, consultar
OSV.dev y guardar el resultado para la proxima vez".
"""
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import LibraryVulnerabilityCache

OSV_QUERY_URL = "https://api.osv.dev/v1/query"
CACHE_TTL = timedelta(days=30)


async def _query_osv(client: httpx.AsyncClient, group_id: str, artifact_id: str, version: str) -> list[dict]:
    package_name = f"{group_id}:{artifact_id}"
    try:
        response = await client.post(
            OSV_QUERY_URL,
            json={"package": {"name": package_name, "ecosystem": "Maven"}, "version": version},
            timeout=10.0,
        )
        response.raise_for_status()
    except httpx.HTTPError:
        # Si OSV.dev no responde, no tiramos abajo el analisis por esto -
        # la libreria simplemente queda sin datos de CVE por esta vez.
        return []

    data = response.json()
    vulns = []
    for v in data.get("vulns", []):
        # Vector CVSS que publica OSV (tipicamente CVSS_V3). El detalle
        # oficial del NVD se enriquece aparte (ver cve_details.py); esto es
        # el fallback para cuando el NVD no esta disponible o no aplica.
        severity = None
        severity_entries = v.get("severity") or []
        if severity_entries:
            severity = {
                "type": severity_entries[0].get("type"),
                "score": severity_entries[0].get("score"),
            }

        # Primera version que arregla la vulnerabilidad, si OSV la conoce -
        # es lo que le da al usuario la accion concreta ("actualizar a X").
        fixed_version = next(
            (
                event["fixed"]
                for affected in v.get("affected") or []
                for rng in affected.get("ranges") or []
                for event in rng.get("events") or []
                if event.get("fixed")
            ),
            None,
        )

        vulns.append({
            "id": v.get("id"),
            "summary": v.get("summary") or v.get("details", "")[:200],
            "aliases": v.get("aliases", []),
            "severity": severity,
            "fixed_version": fixed_version,
            "references": [r.get("url") for r in v.get("references", []) if r.get("url")][:5],
        })
    return vulns


async def check_libraries_for_cves(libraries: list[dict], db: AsyncSession) -> list[dict]:
    """Enriquece cada libreria de `libraries` (dicts con group_id/artifact_id/
    version/package_name) con su lista de `vulnerabilities`, usando cache
    de 30 dias antes de pegarle a la red de nuevo."""
    if not libraries:
        return libraries

    now = datetime.now(timezone.utc)

    async with httpx.AsyncClient() as client:
        for lib in libraries:
            package_name = lib["package_name"]
            version = lib["version"]

            result = await db.execute(
                select(LibraryVulnerabilityCache).where(
                    LibraryVulnerabilityCache.ecosystem == "Maven",
                    LibraryVulnerabilityCache.package_name == package_name,
                    LibraryVulnerabilityCache.version == version,
                )
            )
            cached = result.scalar_one_or_none()

            checked_at = cached.checked_at if cached else None
            is_fresh = (
                cached is not None
                and checked_at is not None
                and (now - checked_at) < CACHE_TTL
            )

            if is_fresh:
                lib["vulnerabilities"] = cached.vulnerabilities
                continue

            vulnerabilities = await _query_osv(client, lib["group_id"], lib["artifact_id"], version)
            lib["vulnerabilities"] = vulnerabilities

            if cached:
                cached.vulnerabilities = vulnerabilities
                cached.checked_at = now
            else:
                db.add(LibraryVulnerabilityCache(
                    ecosystem="Maven",
                    package_name=package_name,
                    version=version,
                    vulnerabilities=vulnerabilities,
                    checked_at=now,
                ))
            await db.flush()

    return libraries
