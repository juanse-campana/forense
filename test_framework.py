#!/usr/bin/env python3
"""
test_framework.py — Test unitario del framework forense
Crea un APK mínimo sintético con hallazgos conocidos y verifica que
el framework los detecte correctamente.
"""

import json
import os
import shutil
import sys
import tempfile
import zipfile
from pathlib import Path

# Asegurarse de que el módulo principal es importable
sys.path.insert(0, str(Path(__file__).parent))

from apk_forensics import (
    ForensicsReport, analyze_integrity, analyze_strings,
    generate_report, SECRET_PATTERNS, CRYPTO_PATTERNS
)

# ─────────────────────────────────────────────
#  Crear un APK mínimo sintético
# ─────────────────────────────────────────────
FAKE_MANIFEST = b"""<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.test.forensics"
    android:versionCode="1"
    android:versionName="1.0">
    <uses-permission android:name="android.permission.READ_SMS"/>
    <uses-permission android:name="android.permission.CAMERA"/>
    <application android:debuggable="true" android:allowBackup="true">
        <activity android:name=".MainActivity" android:exported="true"/>
        <service android:name=".DataService" android:exported="true"/>
    </application>
</manifest>"""

FAKE_SMALI_SECRETS = b"""
.class public Lcom/test/Config;
.super Ljava/lang/Object;

.field public static final API_KEY:Ljava/lang/String; = "AIzaSyD_FakeGoogleAPIKey_1234567890abcd"

.field public static final DB_URL:Ljava/lang/String; = "jdbc:mysql://prod-db.example.com:3306/users"

# password hardcodeado
const-string v0, "password"
const-string v1, "hardcoded_password_123"

.field public static final password:Ljava/lang/String; = "supersecret99"

.method public static getCipher()Ljavax/crypto/Cipher;
    .registers 2
    const-string v0, "AES/ECB/PKCS5Padding"
    invoke-static {v0}, Ljavax/crypto/Cipher;->getInstance(Ljava/lang/String;)Ljavax/crypto/Cipher;
    move-result-object v0
    return-object v0
.end method
"""

FAKE_SMALI_CRYPTO = b"""
.class public Lcom/test/CryptoHelper;
.super Ljava/lang/Object;

# Uses SHA1 for password hashing (insecure)
.method public hashPassword(Ljava/lang/String;)Ljava/lang/String;
    .registers 3
    const-string v0, "SHA1"
    invoke-static {v0}, Ljava/security/MessageDigest;->getInstance(Ljava/lang/String;)
    return-void
.end method

# SQLCipher usage
.method public openDatabase()V
    .registers 2
    const-string v0, "net.sqlcipher.database.SQLiteDatabase"
    return-void
.end method

# DexClassLoader (dynamic loading)
.method public loadPlugin(Ljava/lang/String;)V
    .registers 3
    new-instance v0, Ldalvik/system/DexClassLoader;
    return-void
.end method
"""

def create_fake_apk(path: str):
    """Construye un APK ZIP mínimo con hallazgos conocidos."""
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("AndroidManifest.xml", FAKE_MANIFEST)
        z.writestr("classes.dex", b"dex\n035\x00" + b"\x00" * 100)
        z.writestr("classes2.dex", b"dex\n035\x00" + b"\x00" * 50)
        z.writestr("lib/arm64-v8a/libnative.so", b"\x7fELF" + b"\x00" * 100)
        z.writestr("assets/config.json", b'{"env":"production","debug":false}')
        z.writestr("res/values/strings.xml", b"<resources><string name='app_name'>TestApp</string></resources>")

def create_fake_apktool_output(workdir: str):
    """Simula la salida de apktool para que los módulos de análisis funcionen."""
    smali_dir = Path(workdir) / "apktool_out" / "smali" / "com" / "test"
    smali_dir.mkdir(parents=True, exist_ok=True)
    (smali_dir / "Config.smali").write_bytes(FAKE_SMALI_SECRETS)
    (smali_dir / "CryptoHelper.smali").write_bytes(FAKE_SMALI_CRYPTO)

    manifest = Path(workdir) / "apktool_out" / "AndroidManifest.xml"
    manifest.write_bytes(FAKE_MANIFEST)

# ─────────────────────────────────────────────
#  Tests
# ─────────────────────────────────────────────
def run_test(name: str, condition: bool, detail: str = ""):
    status = "\033[92m✓ PASS\033[0m" if condition else "\033[91m✗ FAIL\033[0m"
    print(f"  {status}  {name}")
    if not condition and detail:
        print(f"        → {detail}")
    return condition

def main():
    print("\n\033[1m\033[94m[>] Ejecutando tests del framework...\033[0m\n")

    passed = 0
    total = 0

    workdir = tempfile.mkdtemp(prefix="apk_test_")
    apk_path = os.path.join(workdir, "test_app.apk")
    report_dir = os.path.join(workdir, "reports")

    try:
        # 1. Crear APK sintético
        create_fake_apk(apk_path)
        create_fake_apktool_output(workdir)

        report = ForensicsReport(
            apk_path=apk_path, apk_name="test_app",
            timestamp="20240101_120000", md5="", sha256="", file_size=0,
        )

        # ── Test 1: Hash ──────────────────────────────
        analyze_integrity(apk_path, report)
        total += 1
        ok = run_test("Hash MD5 calculado", len(report.md5) == 32, f"md5='{report.md5}'")
        passed += ok
        total += 1
        ok = run_test("Hash SHA-256 calculado", len(report.sha256) == 64)
        passed += ok
        total += 1
        ok = run_test("Tamaño de archivo > 0", report.file_size > 0)
        passed += ok

        # ── Test 2: Strings y secretos ────────────────
        analyze_strings(workdir, report)
        secret_findings = [f for f in report.findings if f.category in ("Secret", "Secret (Java)")]
        total += 1
        ok = run_test("Detecta Google API Key (AIzaSy...)", any("Google API Key" in f.title for f in secret_findings))
        passed += ok
        total += 1
        ok = run_test("Detecta DB connection string (jdbc:)", any("DB Connection" in f.title for f in secret_findings))
        passed += ok
        total += 1
        ok = run_test("Detecta hardcoded password", any("Password" in f.title for f in secret_findings))
        passed += ok

        # ── Test 3: Severidades ───────────────────────
        critical = [f for f in report.findings if f.severity == "CRITICAL"]
        high     = [f for f in report.findings if f.severity == "HIGH"]
        total += 1
        ok = run_test("Hay hallazgos CRITICAL", len(critical) > 0, "Esperaba al menos un CRITICAL")
        passed += ok
        total += 1
        ok = run_test("Hay hallazgos HIGH", len(high) > 0)
        passed += ok

        # ── Test 4: URLs ──────────────────────────────
        # (el APK sintético no tiene URLs legibles fuera del smali fake,
        #  verificamos que el campo se inicialice correctamente)
        total += 1
        ok = run_test("Campo interesting_urls es lista", isinstance(report.interesting_urls, list))
        passed += ok

        # ── Test 5: Reporte JSON ──────────────────────
        generate_report(report, report_dir, ["json"])
        json_files = list(Path(report_dir).glob("*.json"))
        total += 1
        ok = run_test("Archivo JSON generado", len(json_files) > 0)
        passed += ok

        if json_files:
            with open(json_files[0]) as f:
                data = json.load(f)
            total += 1
            ok = run_test("JSON contiene 'findings'", "findings" in data)
            passed += ok
            total += 1
            ok = run_test("JSON contiene 'sha256'", "sha256" in data and len(data["sha256"]) == 64)
            passed += ok

        # ── Test 6: Reporte HTML ──────────────────────
        generate_report(report, report_dir, ["html"])
        html_files = list(Path(report_dir).glob("*.html"))
        total += 1
        ok = run_test("Archivo HTML generado", len(html_files) > 0)
        passed += ok

        # ── Test 7: Patrones de detección ─────────────
        import re
        test_strings = {
            "API Key":     "api_key = 'MySecretKey12345678'",
            "Google Key":  "AIzaSyD_FakeGoogleAPIKey_1234567890abcd",
            "JDBC":        "jdbc:mysql://prod.db.com:3306/users",
        }
        for label, sample in test_strings.items():
            matched = any(re.search(p, sample) for p, _, _ in SECRET_PATTERNS)
            total += 1
            ok = run_test(f"Patrón detecta '{label}'", matched, f"sample: {sample}")
            passed += ok

    finally:
        shutil.rmtree(workdir, ignore_errors=True)

    # ── Resultado final ───────────────────────────
    print(f"\n  {'─'*40}")
    color = "\033[92m" if passed == total else "\033[93m" if passed >= total * 0.8 else "\033[91m"
    print(f"  {color}Resultado: {passed}/{total} tests pasados\033[0m")

    if passed == total:
        print("  \033[92m✓ Framework funcionando correctamente.\033[0m\n")
        sys.exit(0)
    else:
        print(f"  \033[93m⚠  {total - passed} test(s) fallaron.\033[0m\n")
        sys.exit(1)

if __name__ == "__main__":
    main()
