#!/usr/bin/env python3
"""
Android APK Forensics Framework
================================
Análisis estático automatizado para investigación forense y CTF.

Módulos:
  - Extracción de metadatos del APK
  - Análisis del AndroidManifest.xml
  - Detección de strings sospechosas y secretos
  - Detección de algoritmos criptográficos
  - Inventario de permisos y componentes
  - Detección de ofuscación
  - Reporte en JSON / HTML / Markdown

Uso:
  python3 apk_forensics.py <archivo.apk> [opciones]
  python3 apk_forensics.py --help
"""

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional

# ──────────────────────────────────────────────
#  Colores ANSI (desactivables con --no-color)
# ──────────────────────────────────────────────
class C:
    RESET  = "\033[0m"
    BOLD   = "\033[1m"
    RED    = "\033[91m"
    YELLOW = "\033[93m"
    GREEN  = "\033[92m"
    CYAN   = "\033[96m"
    GRAY   = "\033[90m"
    BLUE   = "\033[94m"

def colorize(enabled: bool):
    if not enabled:
        for attr in vars(C):
            if not attr.startswith("_"):
                setattr(C, attr, "")

# ──────────────────────────────────────────────
#  Estructuras de datos
# ──────────────────────────────────────────────
@dataclass
class Finding:
    severity: str          # CRITICAL / HIGH / MEDIUM / LOW / INFO
    category: str
    title: str
    detail: str
    file: str = ""
    line: int = 0
    evidence: str = ""

@dataclass
class ForensicsReport:
    apk_path: str
    apk_name: str
    timestamp: str
    md5: str
    sha256: str
    file_size: int
    package_name: str = ""
    version_name: str = ""
    version_code: str = ""
    min_sdk: str = ""
    target_sdk: str = ""
    compile_sdk: str = ""
    permissions: list = field(default_factory=list)
    dangerous_permissions: list = field(default_factory=list)
    components: dict = field(default_factory=dict)
    exported_components: list = field(default_factory=list)
    native_libs: list = field(default_factory=list)
    dex_files: list = field(default_factory=list)
    findings: list = field(default_factory=list)
    crypto_usage: list = field(default_factory=list)
    obfuscation_score: int = 0
    obfuscation_indicators: list = field(default_factory=list)
    interesting_urls: list = field(default_factory=list)
    interesting_files: list = field(default_factory=list)
    tool_versions: dict = field(default_factory=dict)

# ──────────────────────────────────────────────
#  Patrones de detección
# ──────────────────────────────────────────────
SECRET_PATTERNS = [
    (r'(?i)(api[_\-]?key|apikey)\s*[:=]\s*["\']?([A-Za-z0-9_\-]{16,})',     "API Key",      "HIGH"),
    (r'(?i)(secret[_\-]?key|secret)\s*[:=]\s*["\']?([A-Za-z0-9+/=_\-]{16,})','Secret Key',   "HIGH"),
    (r'(?i)(password|passwd|pwd)\s*[:=]\s*["\']?([^"\';\s]{6,})["\']?',       "Hardcoded Password","CRITICAL"),
    (r'(?i)(password|passwd)\b[^=\n]{0,20}=\s*"([^"]{6,})"',                  "Hardcoded Password","CRITICAL"),
    (r'(?i)(token)\s*[:=]\s*["\']([A-Za-z0-9\._\-]{20,})["\']',               "Auth Token",   "HIGH"),
    (r'(?i)(private[_\-]?key)',                                                 "Private Key",  "CRITICAL"),
    (r'AIza[0-9A-Za-z\-_]{35}',                                                "Google API Key","HIGH"),
    (r'(?i)BEGIN\s+(RSA|EC|DSA|OPENSSH)\s+PRIVATE',                           "Embedded Private Key","CRITICAL"),
    (r'[A-Za-z0-9+/]{40,}={0,2}',                                             "Possible Base64 Secret","LOW"),
    (r'(?i)(aws_access_key_id|aws_secret)',                                     "AWS Credentials","CRITICAL"),
    (r'(?i)(firebase[_\-]?url|firebaseio\.com)',                               "Firebase URL", "MEDIUM"),
    (r'(?i)(jdbc:|mongodb://|mysql://|postgres://)',                           "DB Connection String","HIGH"),
]

CRYPTO_PATTERNS = [
    (r'(?i)\b(AES|DES|3DES|TripleDES)\b',           "Symmetric cipher"),
    (r'(?i)\b(RSA|DSA|ECDSA|ECDH|DH)\b',            "Asymmetric cipher"),
    (r'(?i)\b(MD5|SHA1|SHA256|SHA512|SHA-1|SHA-256)', "Hash algorithm"),
    (r'(?i)\b(ECB|CBC|GCM|CTR|CFB|OFB)\b',          "Cipher mode"),
    (r'(?i)(PBKDF2|scrypt|bcrypt|argon2)',            "Key derivation"),
    (r'(?i)(KeyStore|KeyGenerator|Cipher\.getInstance)',  "Android Keystore"),
    (r'(?i)(SQLCipher|net\.sqlcipher)',               "SQLCipher (encrypted DB)"),
    (r'(?i)(EncryptedSharedPreferences|MasterKey)',   "Jetpack EncryptedPrefs"),
    (r'(?i)(TrustManager|X509TrustManager)',          "TLS Trust Manager"),
    (r'(?i)(CertificatePinner|okhttp.*pin)',           "Certificate Pinning"),
]

DANGEROUS_PERMISSIONS = {
    "android.permission.READ_SMS",
    "android.permission.SEND_SMS",
    "android.permission.RECEIVE_SMS",
    "android.permission.READ_CONTACTS",
    "android.permission.READ_CALL_LOG",
    "android.permission.RECORD_AUDIO",
    "android.permission.CAMERA",
    "android.permission.ACCESS_FINE_LOCATION",
    "android.permission.ACCESS_COARSE_LOCATION",
    "android.permission.READ_EXTERNAL_STORAGE",
    "android.permission.WRITE_EXTERNAL_STORAGE",
    "android.permission.PROCESS_OUTGOING_CALLS",
    "android.permission.GET_ACCOUNTS",
    "android.permission.USE_BIOMETRIC",
    "android.permission.USE_FINGERPRINT",
    "android.permission.REQUEST_INSTALL_PACKAGES",
    "android.permission.BIND_ACCESSIBILITY_SERVICE",
    "android.permission.SYSTEM_ALERT_WINDOW",
    "android.permission.WRITE_SETTINGS",
}

URL_PATTERN = re.compile(
    r'https?://[a-zA-Z0-9\-._~:/?#\[\]@!$&\'()*+,;=%]{8,}'
)

# ──────────────────────────────────────────────
#  Utilidades
# ──────────────────────────────────────────────
def log(msg, level="INFO"):
    icons = {"INFO": f"{C.CYAN}[*]{C.RESET}", "OK": f"{C.GREEN}[+]{C.RESET}",
             "WARN": f"{C.YELLOW}[!]{C.RESET}", "ERR": f"{C.RED}[-]{C.RESET}",
             "STEP": f"{C.BOLD}{C.BLUE}[>]{C.RESET}"}
    print(f"  {icons.get(level, '[?]')} {msg}")

def check_tool(name: str) -> Optional[str]:
    path = shutil.which(name)
    return path

def run(cmd: list, cwd=None, timeout=120) -> tuple[int, str, str]:
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, cwd=cwd, timeout=timeout)
        return r.returncode, r.stdout, r.stderr
    except subprocess.TimeoutExpired:
        return -1, "", "timeout"
    except FileNotFoundError:
        return -1, "", f"command not found: {cmd[0]}"

def hash_file(path: str) -> tuple[str, str]:
    md5 = hashlib.md5()
    sha256 = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            md5.update(chunk)
            sha256.update(chunk)
    return md5.hexdigest(), sha256.hexdigest()

def severity_color(s: str) -> str:
    return {
        "CRITICAL": C.RED + C.BOLD,
        "HIGH":     C.RED,
        "MEDIUM":   C.YELLOW,
        "LOW":      C.CYAN,
        "INFO":     C.GRAY,
    }.get(s, C.RESET)

# ──────────────────────────────────────────────
#  Módulo 1 · Hashes e integridad
# ──────────────────────────────────────────────
def analyze_integrity(apk_path: str, report: ForensicsReport):
    log("Calculando hashes (MD5 / SHA-256)...", "STEP")
    md5, sha256 = hash_file(apk_path)
    report.md5    = md5
    report.sha256 = sha256
    report.file_size = os.path.getsize(apk_path)
    log(f"MD5    : {C.BOLD}{md5}{C.RESET}", "OK")
    log(f"SHA256 : {C.BOLD}{sha256}{C.RESET}", "OK")
    log(f"Tamaño : {report.file_size / 1024:.1f} KB", "OK")

# ──────────────────────────────────────────────
#  Módulo 2 · Inventario ZIP / estructura APK
# ──────────────────────────────────────────────
def analyze_structure(apk_path: str, report: ForensicsReport, workdir: str):
    log("Inspeccionando estructura del APK...", "STEP")
    interesting_extensions = {".dex", ".so", ".db", ".sqlite", ".sqlite3",
                               ".key", ".pem", ".cer", ".p12", ".pfx",
                               ".json", ".xml", ".properties", ".yaml", ".yml"}
    try:
        with zipfile.ZipFile(apk_path, "r") as z:
            entries = z.namelist()
            report.dex_files    = [e for e in entries if e.endswith(".dex")]
            report.native_libs  = [e for e in entries if e.endswith(".so")]
            report.interesting_files = [
                e for e in entries
                if Path(e).suffix.lower() in interesting_extensions
                and not e.endswith(".dex")
            ]
            log(f"Archivos totales : {len(entries)}", "OK")
            log(f"DEX files        : {len(report.dex_files)} → {report.dex_files}", "OK")
            log(f"Librerías .so    : {len(report.native_libs)}", "OK")
            log(f"Archivos de interés forense: {len(report.interesting_files)}", "OK")

            # Extraer todo al workdir
            z.extractall(workdir)
    except zipfile.BadZipFile:
        log("El archivo no es un ZIP válido / APK corrupto.", "ERR")
        sys.exit(1)

# ──────────────────────────────────────────────
#  Módulo 3 · AndroidManifest.xml (con aapt o apktool)
# ──────────────────────────────────────────────
def analyze_manifest(apk_path: str, report: ForensicsReport, workdir: str):
    log("Analizando AndroidManifest.xml...", "STEP")
    manifest_text = ""

    # Intentar con aapt (más rápido, no requiere Java)
    if check_tool("aapt"):
        rc, out, _ = run(["aapt", "dump", "badging", apk_path])
        if rc == 0:
            _parse_aapt_output(out, report)
            manifest_text = out

    # Intentar con apktool para el XML decodificado
    apktool = check_tool("apktool")
    if apktool:
        decoded_dir = Path(workdir) / "apktool_out"
        rc, _, err = run(["apktool", "d", "-f", "-o", str(decoded_dir), apk_path])
        if rc == 0:
            manifest_path = decoded_dir / "AndroidManifest.xml"
            if manifest_path.exists():
                manifest_text = manifest_path.read_text(errors="replace")
                _parse_manifest_xml(manifest_text, report)
                log("Manifest decodificado con apktool.", "OK")
        else:
            log(f"apktool falló: {err[:80]}", "WARN")
    elif not manifest_text:
        log("aapt/apktool no disponibles. Manifest no analizado en detalle.", "WARN")
        report.findings.append(Finding(
            "INFO", "Setup", "apktool/aapt no encontrados",
            "Instala apktool y aapt para análisis completo del manifest.",
        ))

def _parse_aapt_output(text: str, report: ForensicsReport):
    for line in text.splitlines():
        if line.startswith("package:"):
            m = re.search(r"name='([^']+)'", line)
            if m: report.package_name = m.group(1)
            m = re.search(r"versionName='([^']+)'", line)
            if m: report.version_name = m.group(1)
            m = re.search(r"versionCode='([^']+)'", line)
            if m: report.version_code = m.group(1)
        elif line.startswith("sdkVersion:"):
            report.min_sdk = line.split("'")[1]
        elif line.startswith("targetSdkVersion:"):
            report.target_sdk = line.split("'")[1]
        elif line.startswith("uses-permission:"):
            m = re.search(r"name='([^']+)'", line)
            if m:
                perm = m.group(1)
                report.permissions.append(perm)
                if perm in DANGEROUS_PERMISSIONS:
                    report.dangerous_permissions.append(perm)

def _parse_manifest_xml(xml: str, report: ForensicsReport):
    # Package
    m = re.search(r'package="([^"]+)"', xml)
    if m and not report.package_name: report.package_name = m.group(1)

    # Versiones
    m = re.search(r'android:versionName="([^"]+)"', xml)
    if m: report.version_name = m.group(1)

    # Componentes exportados (superficie de ataque)
    for comp in ["activity", "service", "receiver", "provider"]:
        matches = re.findall(
            rf'<{comp}[^>]+android:name="([^"]+)"[^>]*android:exported="true"',
            xml, re.IGNORECASE
        )
        report.exported_components.extend(
            [f"{comp}: {n}" for n in matches]
        )

    # Flags de depuración
    if 'android:debuggable="true"' in xml:
        report.findings.append(Finding(
            "HIGH", "Configuration", "App compilada con debuggable=true",
            "Permite adjuntar depuradores (adb) y leer memoria en producción.",
        ))
    if 'android:allowBackup="true"' in xml or 'android:allowBackup' not in xml:
        report.findings.append(Finding(
            "MEDIUM", "Configuration", "allowBackup habilitado (o no declarado)",
            "Los datos de la app pueden extraerse con `adb backup` sin root.",
        ))
    if 'android:networkSecurityConfig' not in xml:
        report.findings.append(Finding(
            "MEDIUM", "Network", "Sin Network Security Config declarado",
            "La app puede aceptar CAs del sistema y CAs de usuario por defecto.",
        ))

    if report.exported_components:
        for ec in report.exported_components:
            report.findings.append(Finding(
                "MEDIUM", "Attack Surface", f"Componente exportado: {ec}",
                "Componentes exportados son accesibles desde otras apps sin permisos.",
                evidence=ec,
            ))

    log(f"Package     : {C.BOLD}{report.package_name}{C.RESET}", "OK")
    log(f"Versión     : {report.version_name} (code {report.version_code})", "OK")
    log(f"SDK mín/obj : {report.min_sdk} / {report.target_sdk}", "OK")
    log(f"Permisos peligrosos: {len(report.dangerous_permissions)}", "WARN" if report.dangerous_permissions else "OK")
    log(f"Componentes exportados: {len(report.exported_components)}", "WARN" if report.exported_components else "OK")

# ──────────────────────────────────────────────
#  Módulo 4 · Búsqueda de strings y secretos
# ──────────────────────────────────────────────
def analyze_strings(workdir: str, report: ForensicsReport):
    log("Buscando strings sospechosas y secretos hardcodeados...", "STEP")
    scan_dirs = [
        Path(workdir) / "apktool_out" / "smali",
        Path(workdir) / "apktool_out" / "res",
        Path(workdir) / "apktool_out" / "assets",
        Path(workdir) / "apktool_out",  # fallback
    ]

    found_secrets = 0
    found_urls = set()
    scanned_files = 0

    for scan_dir in scan_dirs:
        if not scan_dir.exists():
            continue
        for fpath in scan_dir.rglob("*"):
            if not fpath.is_file():
                continue
            if fpath.suffix.lower() in {".png", ".jpg", ".gif", ".webp", ".ttf", ".otf"}:
                continue
            try:
                content = fpath.read_text(errors="replace")
            except Exception:
                continue
            scanned_files += 1
            rel = str(fpath.relative_to(workdir))

            # Detectar URLs
            for url in URL_PATTERN.findall(content):
                if not any(skip in url for skip in ["schemas.android.com", "www.w3.org", "example.com"]):
                    found_urls.add(url)

            # Detectar secretos
            for pattern, label, severity in SECRET_PATTERNS:
                for match in re.finditer(pattern, content):
                    found_secrets += 1
                    # No mostrar el secreto completo en el reporte, truncar
                    evidence = match.group(0)[:80].replace("\n", " ")
                    report.findings.append(Finding(
                        severity=severity,
                        category="Secret",
                        title=f"{label} detectado",
                        detail=f"Posible {label} encontrado en {rel}",
                        file=rel,
                        line=content[:match.start()].count("\n") + 1,
                        evidence=evidence,
                    ))

    report.interesting_urls = list(found_urls)[:50]  # limitar a 50
    log(f"Archivos escaneados : {scanned_files}", "OK")
    log(f"Secretos detectados : {found_secrets}", "WARN" if found_secrets else "OK")
    log(f"URLs únicas         : {len(found_urls)}", "OK")

# ──────────────────────────────────────────────
#  Módulo 5 · Detección de criptografía
# ──────────────────────────────────────────────
def analyze_crypto(workdir: str, report: ForensicsReport):
    log("Detectando uso de criptografía...", "STEP")
    smali_dir = Path(workdir) / "apktool_out" / "smali"
    if not smali_dir.exists():
        log("Directorio smali no disponible, saltando análisis crypto.", "WARN")
        return

    crypto_found = {}
    for fpath in smali_dir.rglob("*.smali"):
        try:
            content = fpath.read_text(errors="replace")
        except Exception:
            continue
        for pattern, label in CRYPTO_PATTERNS:
            if re.search(pattern, content):
                crypto_found[label] = crypto_found.get(label, 0) + 1

    report.crypto_usage = [f"{label} ({count} archivos)" for label, count in crypto_found.items()]

    # Detectar ECB (inseguro)
    if "Cipher mode" in str(crypto_found):
        # buscar ECB específicamente
        for fpath in smali_dir.rglob("*.smali"):
            try:
                content = fpath.read_text(errors="replace")
            except Exception:
                continue
            if re.search(r'(?i)/ECB/', content):
                report.findings.append(Finding(
                    "HIGH", "Crypto", "Uso de modo ECB detectado",
                    "El modo ECB es inseguro — no oculta patrones en los datos.",
                    file=str(fpath.name),
                ))
                break

    # SHA1 / MD5 para integridad → débil
    if any("MD5" in c or "SHA1" in c for c in report.crypto_usage):
        report.findings.append(Finding(
            "MEDIUM", "Crypto", "Uso de MD5/SHA-1 detectado",
            "MD5 y SHA-1 son considerados inseguros para firmas e integridad.",
        ))

    log(f"Primitivas criptográficas: {len(crypto_found)}", "OK")
    for item in report.crypto_usage:
        log(f"  • {item}", "INFO")

# ──────────────────────────────────────────────
#  Módulo 6 · Detección de ofuscación
# ──────────────────────────────────────────────
def analyze_obfuscation(workdir: str, report: ForensicsReport):
    log("Evaluando nivel de ofuscación...", "STEP")
    smali_dir = Path(workdir) / "apktool_out" / "smali"
    if not smali_dir.exists():
        return

    total_classes = 0
    short_name_classes = 0
    indicators = []

    for fpath in smali_dir.rglob("*.smali"):
        total_classes += 1
        stem = fpath.stem
        if len(stem) <= 2 and stem.isalpha():
            short_name_classes += 1

    if total_classes > 0:
        ratio = short_name_classes / total_classes
        if ratio > 0.6:
            indicators.append(f"Clases con nombres cortos (≤2 chars): {short_name_classes}/{total_classes} ({ratio:.0%})")
            report.obfuscation_score += 40
        elif ratio > 0.3:
            indicators.append(f"Posible ofuscación parcial: {ratio:.0%} nombres cortos")
            report.obfuscation_score += 20

    # Detectar reflection
    reflection_count = 0
    for fpath in smali_dir.rglob("*.smali"):
        try:
            content = fpath.read_text(errors="replace")
            if "invoke-virtual {" in content and "getDeclaredMethod" in content:
                reflection_count += 1
        except Exception:
            continue

    if reflection_count > 5:
        indicators.append(f"Reflection intensivo: {reflection_count} clases")
        report.obfuscation_score += 20
        report.findings.append(Finding(
            "MEDIUM", "Obfuscation", "Uso intensivo de reflection",
            "El uso de reflection puede indicar carga dinámica de código o evasión de análisis.",
        ))

    # Detectar DexClassLoader (carga dinámica)
    for fpath in smali_dir.rglob("*.smali"):
        try:
            content = fpath.read_text(errors="replace")
            if "DexClassLoader" in content or "PathClassLoader" in content:
                indicators.append("Carga dinámica de DEX (DexClassLoader)")
                report.obfuscation_score += 30
                report.findings.append(Finding(
                    "HIGH", "Obfuscation", "Carga dinámica de código (DexClassLoader)",
                    "La app puede cargar código en tiempo de ejecución, complicando el análisis estático.",
                ))
                break
        except Exception:
            continue

    report.obfuscation_indicators = indicators
    level = "Alto" if report.obfuscation_score >= 60 else "Medio" if report.obfuscation_score >= 30 else "Bajo"
    color = C.RED if report.obfuscation_score >= 60 else C.YELLOW if report.obfuscation_score >= 30 else C.GREEN
    log(f"Score de ofuscación : {color}{report.obfuscation_score}/100 ({level}){C.RESET}", "OK")

# ──────────────────────────────────────────────
#  Módulo 7 · Análisis con JADX (si disponible)
# ──────────────────────────────────────────────
def analyze_with_jadx(apk_path: str, workdir: str, report: ForensicsReport):
    jadx = check_tool("jadx")
    if not jadx:
        log("jadx no encontrado, saltando decompilación Java.", "WARN")
        report.findings.append(Finding(
            "INFO", "Setup", "jadx no disponible",
            "Instala jadx para decompilación Java legible. Ver: https://github.com/skylot/jadx",
        ))
        return

    log("Decompilando con JADX...", "STEP")
    jadx_out = Path(workdir) / "jadx_out"
    rc, _, err = run(["jadx", "-d", str(jadx_out), "--no-res", apk_path], timeout=180)
    if rc != 0:
        log(f"jadx completó con advertencias (puede ser normal): {err[:100]}", "WARN")

    if jadx_out.exists():
        java_files = list(jadx_out.rglob("*.java"))
        log(f"Archivos Java decompilados: {len(java_files)}", "OK")
        report.tool_versions["jadx"] = "disponible"

        # Re-escanear los archivos Java (más legibles que smali)
        for fpath in java_files[:500]:  # limitar para performance
            try:
                content = fpath.read_text(errors="replace")
                rel = str(fpath.relative_to(workdir))
                for pattern, label, severity in SECRET_PATTERNS:
                    for match in re.finditer(pattern, content):
                        evidence = match.group(0)[:80].replace("\n", " ")
                        # Evitar duplicados obvios
                        already = any(
                            f.evidence == evidence for f in report.findings
                            if isinstance(f, Finding)
                        )
                        if not already:
                            report.findings.append(Finding(
                                severity=severity,
                                category="Secret (Java)",
                                title=f"{label} en código Java",
                                detail=f"Encontrado en {rel}",
                                file=rel,
                                line=content[:match.start()].count("\n") + 1,
                                evidence=evidence,
                            ))
            except Exception:
                continue

# ──────────────────────────────────────────────
#  Módulo 8 · Generación de reportes
# ──────────────────────────────────────────────
SEVERITY_ORDER = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "INFO": 4}

def generate_report(report: ForensicsReport, output_dir: str, formats: list):
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    base = Path(output_dir) / f"forensics_{report.apk_name}_{report.timestamp}"

    # Ordenar findings por severidad
    report.findings.sort(key=lambda f: SEVERITY_ORDER.get(
        f.severity if isinstance(f, Finding) else f.get("severity", "INFO"), 99
    ))

    if "json" in formats:
        _write_json(report, str(base) + ".json")
    if "html" in formats:
        _write_html(report, str(base) + ".html")
    if "md" in formats:
        _write_markdown(report, str(base) + ".md")

    return base

def _write_json(report: ForensicsReport, path: str):
    data = asdict(report)
    data["findings"] = [asdict(f) if isinstance(f, Finding) else f for f in report.findings]
    with open(path, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    log(f"JSON : {path}", "OK")

def _write_markdown(report: ForensicsReport, path: str):
    lines = [
        f"# Reporte Forense Android\n",
        f"**Archivo:** `{report.apk_name}`  ",
        f"**Fecha:** {report.timestamp}  ",
        f"**Package:** `{report.package_name}`  ",
        f"**Versión:** {report.version_name} ({report.version_code})  \n",
        "## Hashes",
        f"| Hash | Valor |",
        f"|------|-------|",
        f"| MD5 | `{report.md5}` |",
        f"| SHA-256 | `{report.sha256}` |",
        f"| Tamaño | {report.file_size} bytes |\n",
        "## Permisos peligrosos",
    ]
    if report.dangerous_permissions:
        for p in report.dangerous_permissions:
            lines.append(f"- `{p}`")
    else:
        lines.append("_Ninguno detectado._")

    lines += ["\n## Componentes exportados"]
    if report.exported_components:
        for ec in report.exported_components:
            lines.append(f"- `{ec}`")
    else:
        lines.append("_Ninguno._")

    lines += ["\n## Criptografía detectada"]
    for c in report.crypto_usage:
        lines.append(f"- {c}")

    lines += [f"\n## Ofuscación", f"Score: **{report.obfuscation_score}/100**"]
    for i in report.obfuscation_indicators:
        lines.append(f"- {i}")

    lines += ["\n## Hallazgos de seguridad\n"]
    counts = {}
    for f in report.findings:
        sev = f.severity if isinstance(f, Finding) else f.get("severity")
        counts[sev] = counts.get(sev, 0) + 1
    for sev in ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]:
        if sev in counts:
            lines.append(f"- **{sev}**: {counts[sev]}")
    lines.append("")

    for finding in report.findings:
        if isinstance(finding, Finding):
            f = finding
        else:
            continue
        lines += [
            f"### [{f.severity}] {f.title}",
            f"**Categoría:** {f.category}  ",
            f"**Detalle:** {f.detail}  ",
        ]
        if f.file:
            lines.append(f"**Archivo:** `{f.file}` línea {f.line}  ")
        if f.evidence:
            lines.append(f"**Evidencia:** `{f.evidence}`  ")
        lines.append("")

    if report.interesting_urls:
        lines += ["\n## URLs encontradas"]
        for url in report.interesting_urls[:20]:
            lines.append(f"- `{url}`")

    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))
    log(f"Markdown : {path}", "OK")

def _write_html(report: ForensicsReport, path: str):
    sev_colors = {
        "CRITICAL": "#dc2626", "HIGH": "#ea580c",
        "MEDIUM":   "#d97706", "LOW":  "#0284c7", "INFO": "#6b7280"
    }
    counts = {}
    for f in report.findings:
        sev = f.severity if isinstance(f, Finding) else f.get("severity", "INFO")
        counts[sev] = counts.get(sev, 0) + 1

    findings_html = ""
    for finding in report.findings:
        if not isinstance(finding, Finding):
            continue
        color = sev_colors.get(finding.severity, "#6b7280")
        ev = f'<code style="font-size:11px;word-break:break-all">{finding.evidence}</code>' if finding.evidence else ""
        findings_html += f"""
        <div style="border-left:3px solid {color};padding:10px 14px;margin:8px 0;background:#fafafa;border-radius:0 6px 6px 0">
          <span style="background:{color};color:#fff;font-size:11px;font-weight:600;padding:2px 7px;border-radius:3px;margin-right:8px">{finding.severity}</span>
          <span style="font-size:13px;font-weight:600;color:#111">{finding.title}</span>
          <span style="font-size:11px;color:#888;margin-left:8px">[{finding.category}]</span>
          <p style="margin:6px 0 2px;font-size:12px;color:#444">{finding.detail}</p>
          {f'<p style="margin:2px 0;font-size:11px;color:#888">📄 {finding.file} : {finding.line}</p>' if finding.file else ''}
          {ev}
        </div>"""

    summary_html = "".join([
        f'<span style="background:{sev_colors.get(s,"#888")};color:#fff;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;margin:2px">{s}: {n}</span>'
        for s, n in sorted(counts.items(), key=lambda x: SEVERITY_ORDER.get(x[0], 9))
    ])

    perms_html = "".join([
        f'<span style="background:#fee2e2;color:#b91c1c;padding:2px 8px;border-radius:4px;font-size:11px;margin:2px;display:inline-block">{p}</span>'
        for p in report.dangerous_permissions
    ]) or '<span style="color:#16a34a">Ninguno detectado</span>'

    crypto_html = "".join([f"<li style='font-size:12px'>{c}</li>" for c in report.crypto_usage])
    urls_html   = "".join([f"<li style='font-size:11px'><code>{u}</code></li>" for u in report.interesting_urls[:20]])

    html = f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Reporte Forense – {report.apk_name}</title>
<style>
  body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:20px;background:#f1f5f9;color:#1e293b}}
  .card{{background:#fff;border-radius:8px;padding:20px;margin:16px 0;box-shadow:0 1px 3px rgba(0,0,0,.08)}}
  h1{{font-size:20px;margin:0 0 4px}} h2{{font-size:15px;margin:12px 0 8px;color:#334155}}
  code{{background:#f1f5f9;padding:1px 5px;border-radius:3px;font-family:monospace}}
  table{{width:100%;border-collapse:collapse;font-size:13px}}
  td,th{{padding:7px 10px;border-bottom:1px solid #e2e8f0;text-align:left}}
  th{{background:#f8fafc;font-weight:600}}
</style></head>
<body>
<div class="card">
  <h1>🔍 Reporte Forense Android</h1>
  <p style="color:#64748b;font-size:13px;margin:4px 0">{report.apk_name} · {report.timestamp}</p>
  <div style="margin-top:10px">{summary_html}</div>
</div>

<div class="card">
  <h2>Información del APK</h2>
  <table>
    <tr><th>Campo</th><th>Valor</th></tr>
    <tr><td>Package</td><td><code>{report.package_name}</code></td></tr>
    <tr><td>Versión</td><td>{report.version_name} (code {report.version_code})</td></tr>
    <tr><td>SDK mín / objetivo</td><td>{report.min_sdk} / {report.target_sdk}</td></tr>
    <tr><td>MD5</td><td><code>{report.md5}</code></td></tr>
    <tr><td>SHA-256</td><td><code style="font-size:11px">{report.sha256}</code></td></tr>
    <tr><td>Tamaño</td><td>{report.file_size:,} bytes</td></tr>
    <tr><td>DEX files</td><td>{', '.join(report.dex_files)}</td></tr>
    <tr><td>Librerías .so</td><td>{len(report.native_libs)}</td></tr>
    <tr><td>Ofuscación score</td><td>{report.obfuscation_score}/100</td></tr>
  </table>
</div>

<div class="card">
  <h2>Permisos peligrosos</h2>
  {perms_html}
</div>

<div class="card">
  <h2>Criptografía detectada</h2>
  <ul style="margin:0;padding-left:20px">{crypto_html}</ul>
</div>

<div class="card">
  <h2>Hallazgos de seguridad</h2>
  {findings_html or '<p style="color:#16a34a">No se encontraron hallazgos.</p>'}
</div>

{"<div class='card'><h2>URLs encontradas</h2><ul style='padding-left:20px'>" + urls_html + "</ul></div>" if urls_html else ""}

<p style="text-align:center;font-size:11px;color:#94a3b8;margin-top:20px">
  Generado por Android APK Forensics Framework · {report.timestamp}
</p>
</body></html>"""

    with open(path, "w", encoding="utf-8") as fh:
        fh.write(html)
    log(f"HTML  : {path}", "OK")

# ──────────────────────────────────────────────
#  Consola: resumen final
# ──────────────────────────────────────────────
def print_summary(report: ForensicsReport):
    counts = {}
    for f in report.findings:
        sev = f.severity if isinstance(f, Finding) else f.get("severity", "INFO")
        counts[sev] = counts.get(sev, 0) + 1

    print(f"\n{C.BOLD}{'─'*60}{C.RESET}")
    print(f"{C.BOLD}  RESUMEN FORENSE{C.RESET}")
    print(f"{'─'*60}")
    print(f"  Package  : {C.BOLD}{report.package_name}{C.RESET}")
    print(f"  Versión  : {report.version_name}")
    print(f"  SHA-256  : {report.sha256[:32]}...")
    print()
    for sev in ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]:
        n = counts.get(sev, 0)
        if n:
            color = severity_color(sev)
            print(f"  {color}{sev:<10}{C.RESET} {n} hallazgo{'s' if n!=1 else ''}")
    print(f"{'─'*60}\n")

# ──────────────────────────────────────────────
#  Entry point
# ──────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="Android APK Forensics Framework — Análisis estático automatizado",
        formatter_class=argparse.RawTextHelpFormatter,
    )
    parser.add_argument("apk", help="Ruta al archivo APK a analizar")
    parser.add_argument("-o", "--output", default="./reports", help="Directorio de salida (default: ./reports)")
    parser.add_argument("-f", "--format", default="html,json,md",
                        help="Formatos de reporte separados por coma: html,json,md (default: los tres)")
    parser.add_argument("--no-jadx", action="store_true", help="Omitir decompilación con JADX")
    parser.add_argument("--no-color", action="store_true", help="Desactivar colores ANSI")
    parser.add_argument("--keep-tmp", action="store_true", help="No borrar directorio temporal de trabajo")
    args = parser.parse_args()

    colorize(not args.no_color)

    apk_path = os.path.abspath(args.apk)
    if not os.path.isfile(apk_path):
        print(f"{C.RED}Error: no se encuentra el archivo '{apk_path}'{C.RESET}")
        sys.exit(1)

    apk_name = Path(apk_path).stem
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    formats = [f.strip().lower() for f in args.format.split(",")]

    print(f"\n{C.BOLD}{C.BLUE}╔══════════════════════════════════════════╗{C.RESET}")
    print(f"{C.BOLD}{C.BLUE}║  Android APK Forensics Framework         ║{C.RESET}")
    print(f"{C.BOLD}{C.BLUE}║  Investigación forense / CTF              ║{C.RESET}")
    print(f"{C.BOLD}{C.BLUE}╚══════════════════════════════════════════╝{C.RESET}\n")
    log(f"Analizando: {C.BOLD}{apk_path}{C.RESET}")

    report = ForensicsReport(
        apk_path=apk_path,
        apk_name=apk_name,
        timestamp=timestamp,
        md5="", sha256="", file_size=0,
    )

    workdir = tempfile.mkdtemp(prefix="apk_forensics_")
    log(f"Directorio de trabajo: {workdir}", "INFO")

    try:
        analyze_integrity(apk_path, report)
        analyze_structure(apk_path, report, workdir)
        analyze_manifest(apk_path, report, workdir)
        analyze_strings(workdir, report)
        analyze_crypto(workdir, report)
        analyze_obfuscation(workdir, report)
        if not args.no_jadx:
            analyze_with_jadx(apk_path, workdir, report)
    finally:
        if not args.keep_tmp:
            shutil.rmtree(workdir, ignore_errors=True)
        else:
            log(f"Archivos temporales en: {workdir}", "INFO")

    print_summary(report)
    generate_report(report, args.output, formats)
    print(f"\n{C.GREEN}{C.BOLD}  ✓ Análisis completado.{C.RESET} Reportes en: {args.output}\n")

if __name__ == "__main__":
    main()
