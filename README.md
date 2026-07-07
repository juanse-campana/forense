# Android APK Forensics Framework

Framework de análisis estático automatizado para investigación forense y CTF.
Optimizado para **Windows + WSL (Ubuntu)**.

> ⚠️ **`apktool`, `aapt` y `jadx` necesitan correr en un entorno POSIX (WSL/Linux/macOS).**
> El framework invoca estas herramientas vía `subprocess`, y en Windows nativo el
> `.bat` con el que se instalan normalmente no se puede ejecutar así (falla en
> silencio). Si corrés `apk_forensics.py` directo en Windows sin WSL, vas a
> tener igual los hashes y la estructura del ZIP, pero el manifest, los
> secretos, la criptografía y la ofuscación van a quedar sin analizar. Usá
> siempre WSL (`setup_wsl.sh`) para un análisis completo, incluso si el
> archivo del APK vive en el filesystem de Windows.

---

## Instalación rápida

```bash
# 1. Clonar / copiar los archivos en WSL
cd ~
mkdir android_forensics && cd android_forensics

# 2. Ejecutar el script de setup (instala Java, apktool, jadx, aapt, adb)
chmod +x setup_wsl.sh
sudo ./setup_wsl.sh

# 3. Verificar que todo funciona
python3 test_framework.py
```

---

## Uso

```bash
# Análisis básico (genera HTML + JSON + Markdown)
python3 apk_forensics.py mi_app.apk

# Especificar directorio de salida
python3 apk_forensics.py mi_app.apk -o ./resultados

# Solo reporte HTML
python3 apk_forensics.py mi_app.apk -f html

# Sin decompilación JADX (más rápido)
python3 apk_forensics.py mi_app.apk --no-jadx

# Conservar archivos temporales (útil para inspección manual)
python3 apk_forensics.py mi_app.apk --keep-tmp

# Sin colores (útil para logs / pipes)
python3 apk_forensics.py mi_app.apk --no-color | tee análisis.log
```

---

## Qué detecta

### Segredos hardcodeados
| Tipo | Severidad |
|------|-----------|
| Contraseñas en código | CRITICAL |
| Claves privadas embebidas | CRITICAL |
| Credenciales AWS | CRITICAL |
| API Keys (Google, etc.) | HIGH |
| Tokens de autenticación | HIGH |
| Cadenas de conexión DB | HIGH |
| Firebase URLs | MEDIUM |
| Posibles Base64 secrets | LOW |

### Configuración insegura
- `debuggable=true` → permite adjuntar depuradores ADB
- `allowBackup=true` → extracción de datos sin root
- Sin `networkSecurityConfig` → acepta CAs del sistema
- Componentes exportados sin permisos

### Criptografía
- Algoritmos débiles: MD5, SHA-1, DES
- Modos inseguros: ECB
- Uso de SQLCipher, EncryptedSharedPreferences
- Certificate Pinning (o ausencia de él)
- Derivación de claves: PBKDF2, scrypt

### Ofuscación
- Ratio de clases con nombres cortos (ProGuard/R8)
- Reflection intensivo
- Carga dinámica de DEX (DexClassLoader)
- Score 0–100

---

## Stack de herramientas

| Herramienta | Función | Requerida |
|-------------|---------|-----------|
| `apktool` | Decodificar manifest + smali | Sí |
| `jadx` | Decompilar a Java legible | Recomendada |
| `aapt` | Metadata rápida del APK | Opcional |
| `adb` | Adquisición del dispositivo | Opcional |
| `androguard` (Python) | Análisis profundo | Opcional |
| `MobSF` (Docker) | Análisis completo web UI | Opcional |

---

## Flujo del framework

```
APK
 │
 ├─► Módulo 1 · Hashes (MD5, SHA-256, tamaño)
 │
 ├─► Módulo 2 · Estructura ZIP (DEX, .so, archivos sensibles)
 │
 ├─► Módulo 3 · AndroidManifest (permisos, componentes, flags)
 │
 ├─► Módulo 4 · Strings y secretos (patrones regex sobre smali/Java)
 │
 ├─► Módulo 5 · Criptografía (algoritmos, modos, librerías)
 │
 ├─► Módulo 6 · Ofuscación (nombres, reflection, DexClassLoader)
 │
 └─► Módulo 7 · JADX (decompilación Java + re-escaneo)
          │
          └─► Reportes: HTML · JSON · Markdown
```

---

## APKs de prueba para CTF

Este repo incluye `novabank-demo-vulnerable.apk` en la raíz: un APK mínimo
(app ficticia "NovaBank", sin librerías reales de terceros) armado a propósito
para disparar todos los módulos del framework de forma limpia — sin el ruido
de falsos positivos que genera analizar una app real grande. Pensado para
demos y presentaciones:

```bash
python3 apk_forensics.py novabank-demo-vulnerable.apk
```

Dispara, a propósito: `debuggable=true`, `allowBackup=true`, 5 componentes
exportados sin permisos, 16 permisos peligrosos, secretos hardcodeados
(password, AWS creds, API keys, clave privada RSA, connection string),
17 usos de criptografía débil (MD5, SHA1, ECB, TrustManager/CertificatePinner
vacíos) y carga dinámica de código (`DexClassLoader`).

Fuentes recomendadas de APKs reales legales para practicar:

- **InjuredAndroid** — https://github.com/B3nac/InjuredAndroid
- **DIVA Android** — https://github.com/payatu/diva-android
- **AndroGoat** — https://github.com/satishpatnayak/AndroGoat
- **InsecureBankv2** — https://github.com/dineshshetty/Android-InsecureBankv2
- **OWASP MSTG samples** — https://github.com/OWASP/owasp-mstg

```bash
# Ejemplo con InjuredAndroid
wget https://github.com/B3nac/InjuredAndroid/releases/download/v1.0.12/InjuredAndroid-1.0.12-release.apk
python3 apk_forensics.py InjuredAndroid-1.0.12-release.apk
```

---

## Extender el framework

### Agregar un nuevo patrón de detección

En `apk_forensics.py`, añadir a `SECRET_PATTERNS`:
```python
(r'(?i)mi_patron_regex', "Nombre del hallazgo", "HIGH"),
```

### Agregar un nuevo módulo de análisis

1. Crear la función `analyze_nuevo(workdir, report)` siguiendo el patrón existente.
2. Llamarla en `main()` después de `analyze_obfuscation`.
3. Los hallazgos se agregan como `report.findings.append(Finding(...))`.

---

## Próximos módulos (roadmap)

- [ ] **Módulo 8 · SQLite/SQLCipher** — intentar descifrado de BBDDs con contraseñas comunes
- [ ] **Módulo 9 · Network** — análisis de tráfico con mitmproxy + bypass de pinning
- [ ] **Módulo 10 · Frida** — scripts de hooking automatizados para extracción de claves en runtime
- [ ] **Módulo 11 · VirusTotal** — lookup de hash y análisis de firmas
- [ ] **Dashboard web** — interfaz React para visualizar múltiples reportes

---

*Framework creado para investigación forense y CTF. Usar únicamente en apps propias o con autorización explícita.*
