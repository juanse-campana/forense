# Forense — Android APK Forensics Framework

Framework de análisis estático automatizado para investigación forense, auditoría de seguridad y CTF. Le hace "autopsia" a un APK — permisos peligrosos, secretos hardcodeados, criptografía débil, configuraciones inseguras, librerías de terceros con CVEs conocidos — sin instalarlo ni ejecutarlo nunca.

> **Uso ético.** Analizá únicamente aplicaciones propias o con autorización explícita del dueño. Este proyecto es para investigación forense, auditoría defensiva y CTF — no para atacar apps de terceros sin permiso.

---

## Qué es esto

Es **análisis estático**: se lee el archivo `.apk` como una radiografía, sin correr la app ni necesitar un celular o emulador. El proyecto tiene tres capas independientes, cada una usable por separado:

```
┌───────────────────────┐      ┌──────────────────────────┐      ┌───────────────────────┐
│   apk_forensics.py     │      │       api/ (FastAPI)      │      │      web/ (Next.js)    │
│                         │      │                            │      │                         │
│  El motor. Script       │◄─────│  Envuelve el motor en una  │◄─────│  Interfaz web. Subís    │
│  Python (stdlib) que     │      │  API REST: recibe el APK,  │      │  un APK, ves el         │
│  hace todo el análisis.  │      │  lo analiza en segundo     │      │  progreso en vivo,      │
│  Corre solo por consola, │      │  plano, guarda el reporte  │      │  navegás el reporte     │
│  sin API ni web.         │      │  en Postgres, y lo         │      │  por pestañas.          │
│                         │      │  enriquece con OWASP+CVEs. │      │                         │
└───────────────────────┘      └──────────────────────────┘      └───────────────────────┘
```

- **`apk_forensics.py`** — cero dependencias de terceros (Python stdlib puro), corre en cualquier lado donde haya Python 3.9+. Es el único componente estrictamente necesario si solo querés analizar un APK desde la terminal.
- **`api/`** — FastAPI + PostgreSQL. Recibe uploads, ejecuta el motor en background, guarda historial, y agrega dos cosas que el motor solo no hace: clasificación contra el **OWASP Mobile Top 10** y detección de **CVEs en librerías de terceros** (vía OSV.dev/NVD).
- **`web/`** — Next.js + React. Interfaz para subir APKs por drag-and-drop, ver progreso en vivo, y navegar resultados sin tocar una terminal — incluye explorador de código con extracto de la línea exacta de cada hallazgo.

---

## Instalación

### Instalación rápida (con Docker)

La forma más simple de levantar todo (Postgres + API + Web) en tu localhost — solo necesitás Docker instalado, nada de Python, Node, apktool ni jadx en tu máquina:

```bash
curl -fsSL https://raw.githubusercontent.com/juanse-campana/forense/main/install.sh | bash
```

Clona el repo (si no estás ya parado adentro) y corre `docker compose up --build` por vos.

¿Preferís revisar el script antes de correrlo? Totalmente razonable, no confíes ciegamente en un `curl | bash` de un repo que no conocés:

```bash
curl -fsSL https://raw.githubusercontent.com/juanse-campana/forense/main/install.sh -o install.sh
cat install.sh   # revisalo
bash install.sh
```

Al terminar: Web en `http://localhost:3000`, API en `http://localhost:8000/docs`.

### Instalación manual

Si preferís no usar el instalador automático, elegí la ruta según lo que necesites: **A)** solo el motor por consola, **B)** el stack completo en modo desarrollo (código corriendo local, con hot-reload), o **C)** el stack completo con Docker paso a paso (lo mismo que hace `install.sh`, pero a mano).

#### Prerrequisitos comunes

| Herramienta | Para qué | Obligatoria |
| --- | --- | --- |
| Python 3.9+ | Motor de análisis y API | Sí |
| `apktool`, `aapt`, `jadx` (vía `setup_wsl.sh`) | Decodificar manifest y decompilar código | Recomendada — sin ellas solo se obtienen hashes y estructura del ZIP |
| **WSL (Ubuntu) en Windows**, o Linux/macOS nativo | `apktool`/`aapt`/`jadx` necesitan un entorno POSIX — en Windows nativo fallan en silencio al invocarse vía `subprocess` | Sí, si estás en Windows |
| Docker + Docker Compose | Postgres para el stack completo (ruta B) | Solo para ruta B |
| Node.js 20+ | Interfaz web (ruta B) | Solo para ruta B |

#### A) Solo el motor (CLI, sin base de datos ni web)

```bash
git clone <url-del-repo> forense
cd forense

# Instala Java, apktool, jadx, aapt (requiere WSL/Linux/macOS)
chmod +x setup_wsl.sh
sudo ./setup_wsl.sh

# Verificar que todo funciona (16 tests)
python3 test_framework.py

# Analizar un APK
python3 apk_forensics.py mi_app.apk
```

Sin ningún paso más — no hace falta `pip install` nada, el motor usa solo la librería estándar de Python. Ver [Uso del motor CLI](#uso-del-motor-cli) más abajo para todas las opciones.

#### B) Stack completo (API + Web + Postgres)

```bash
git clone <url-del-repo> forense
cd forense

# 1. Instalar apktool/jadx/aapt (mismo paso que la ruta A, dentro de WSL/Linux)
chmod +x setup_wsl.sh
sudo ./setup_wsl.sh

# 2. Levantar Postgres con Docker
docker compose up -d

# 3. Backend (FastAPI) — en una terminal
cd api
python3 -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn main:app --reload
# API disponible en http://localhost:8000 (docs interactivas en /docs)

# 4. Frontend (Next.js) — en otra terminal
cd web
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev
# Web disponible en http://localhost:3000
```

Los defaults de arriba (Postgres en `localhost:5432` con usuario/clave `forense`) funcionan sin tocar nada más — no hace falta crear un `.env` para el backend salvo que quieras cambiar algo (por ejemplo, agregar una API key del NVD). Guías completas y todas las variables de entorno disponibles: [`api/README.md`](api/README.md) y [`web/README.md`](web/README.md).

#### C) Stack completo con Docker, paso a paso

Requiere únicamente Docker y Docker Compose — no hace falta Python, Node, apktool, jadx ni nada de eso en tu máquina, todo vive dentro de las imágenes.

```bash
git clone <url-del-repo> forense
cd forense
docker compose up --build
```

- API en `http://localhost:8000` (docs en `/docs`)
- Web en `http://localhost:3000`
- Postgres en `localhost:5432`

La primera vez tarda unos minutos porque compila las imágenes (la del backend instala Java, apktool y jadx). Las siguientes veces arranca en segundos. Las migraciones de Alembic corren solas al levantar el backend, y los uploads quedan en un volumen (`backend_uploads`) que sobrevive a los reinicios del contenedor.

---

## Uso del motor CLI

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

> El motor por sí solo (sin pasar por la API) no clasifica contra OWASP ni consulta CVEs — esos dos enriquecimientos viven en `api/services/` y solo se aplican cuando el análisis corre a través del backend. La salida del CLI trae severidad, evidencia, archivo y línea de cada hallazgo igual.

---

## Qué detecta

### Secretos hardcodeados
| Tipo | Severidad |
|------|-----------|
| Contraseñas en código | CRITICAL |
| Claves privadas embebidas (header PEM) | CRITICAL |
| Credenciales AWS | CRITICAL |
| API Keys (Google, genéricas) | HIGH |
| Tokens de autenticación | HIGH |
| Cadenas de conexión DB | HIGH |
| Firebase URLs | MEDIUM |
| Posibles secretos en Base64 | LOW |

Cada hallazgo de este tipo también trae un campo **`confidence`** (`HIGH`/`MEDIUM`/`LOW`), independiente de la severidad — mide qué tan probable es que sea un secreto real y no una coincidencia (por ejemplo, texto de un patrón débil encontrado dentro de una librería nativa compilada `.so` baja a `LOW`, mientras que un formato autovalidante como una API key de Google se mantiene en `HIGH` esté donde esté). Se calcula con entropía de Shannon + especificidad del patrón, el mismo enfoque que usan Gitleaks/TruffleHog/detect-secrets. Detalle de la técnica: ver el docstring de `_estimate_confidence` en `apk_forensics.py`.

### Configuración insegura

- `debuggable=true` → permite adjuntar depuradores ADB en producción
- `allowBackup=true` → extracción de datos con `adb backup` sin root
- Sin `networkSecurityConfig` → acepta CAs del sistema y del usuario por defecto
- Componentes exportados sin permisos

### Criptografía

- Algoritmos débiles: MD5, SHA-1
- Modos inseguros: ECB
- Uso de SQLCipher, EncryptedSharedPreferences
- Certificate Pinning (o ausencia de él)

### Ofuscación

- Ratio de clases con nombres cortos (ProGuard/R8)
- Reflection intensivo
- Carga dinámica de DEX (`DexClassLoader`)
- Score 0–100

### Librerías de terceros y CVEs (solo vía API)

El motor identifica librerías bundleadas (Play Services, Firebase, ML Kit) a partir de sus `.properties` embebidos. Cuando el análisis corre a través de la API, cada librería se chequea contra **OSV.dev** (CVEs por coordenada Maven + versión) y se enriquece con **NVD** (CVSS oficial) — ambas consultas cacheadas en Postgres, solo se re-consultan si el dato está vencido. Detalle completo: [`api/README.md`](api/README.md#enriquecimiento-de-vulnerabilidades).

### Clasificación OWASP Mobile Top 10 (solo vía API)

Cada hallazgo se mapea a una categoría del OWASP Mobile Top 10 (2024) mediante un lookup estático — OWASP publica una lista, no una API, así que es una tabla local (`finding_owasp_mapping`), no una llamada externa.

---

## Fuentes y criterios de clasificación

Cada afirmación de la sección anterior sale de una fuente concreta, no de un criterio inventado:

- **OWASP MASTG (Mobile Application Security Testing Guide)** — <https://mas.owasp.org/MASTG/>, la guía técnica que implementa el estándar OWASP MASVS. Los checks que hace el motor (`debuggable=true`, `allowBackup=true`, componentes exportados sin permisos, ausencia de `networkSecurityConfig`, modo de cifrado ECB, secretos hardcodeados) son, literalmente, casos de test documentados ahí — no son heurísticas inventadas para este proyecto.
- **OWASP Mobile Top 10 (2024)** — lista oficial publicada por OWASP: <https://owasp.org/www-project-mobile-top-10/>. El mapeo hallazgo → categoría (`finding_owasp_mapping`, migración `api/alembic/versions/004_add_owasp_and_cve_tables.py`) se armó a mano contra esa lista.
- **OSV.dev** — base de datos de vulnerabilidades open source de Google, sin autenticación: <https://osv.dev/>, esquema documentado en <https://ossf.github.io/osv-schema/>. Se consulta por coordenada Maven (`groupId:artifactId`) + versión exacta de la librería.
- **NVD (National Vulnerability Database)** — base de datos oficial del NIST, usada para el puntaje CVSS de cada CVE: <https://nvd.nist.gov/developers>.
- **Severidad de cada hallazgo (CRITICAL/HIGH/MEDIUM/LOW)** — esto sí es criterio propio, no de OWASP: MASTG documenta *qué* verificar, pero no impone una escala de 4 niveles por check. La severidad acá es un juicio directo de impacto si el hallazgo es real (una clave privada real es CRITICAL, una URL de Firebase es MEDIUM), codificada explícitamente en `SECRET_PATTERNS` y en cada `Finding(...)` de `apk_forensics.py` — auditable ahí, no en una tabla externa.
- **Confianza de hallazgos (entropía de Shannon)** — medir la aleatoriedad de un string para distinguir un secreto real de una palabra de código es una técnica estándar de secret-scanning; el mismo enfoque (entropía + especificidad del patrón) lo usan [Gitleaks](https://github.com/gitleaks/gitleaks), [TruffleHog](https://github.com/trufflesecurity/trufflehog) y [detect-secrets](https://github.com/Yelp/detect-secrets) de Yelp. La implementación acá es propia y auditable (`_estimate_confidence` en `apk_forensics.py`), sin librerías externas ni servicios de terceros de por medio.

Nada de esto pasa por un modelo de IA en tiempo de ejecución — cada hallazgo del reporte sale de regex propios, de las dos bases de datos externas listadas arriba, o de tablas estáticas. Es determinístico: el mismo APK produce siempre el mismo reporte.

---

## Flujo del motor

```
APK
 │
 ├─► Módulo 1 · Integridad     — hashes MD5/SHA-256, tamaño
 │
 ├─► Módulo 2 · Estructura     — inventario del ZIP (DEX, .so, archivos de interés forense)
 │
 ├─► Módulo 3 · Dependencias   — identifica librerías de terceros bundleadas (.properties)
 │
 ├─► Módulo 4 · Manifest       — permisos, componentes, flags de debug/backup
 │
 ├─► Módulo 5 · Strings        — secretos hardcodeados (regex + confianza por entropía)
 │
 ├─► Módulo 6 · Criptografía   — algoritmos, modos, librerías criptográficas
 │
 ├─► Módulo 7 · Ofuscación     — nombres, reflection, DexClassLoader
 │
 └─► Módulo 8 · JADX           — decompilación a Java legible + re-escaneo de secretos
          │
          └─► Reportes: HTML · JSON · Markdown
                   │
                   └─► (solo vía API) Clasificación OWASP + CVEs de librerías
```

---

## La interfaz web

Al correr el stack completo, la web permite:

- Subir un APK por drag-and-drop y ver el progreso en vivo (SSE, paso a paso).
- Navegar el reporte por pestañas: Resumen, Hallazgos, Librerías, Permisos, Criptografía, Estructura, Manifest, Ofuscación.
- Filtrar hallazgos por severidad y por categoría OWASP.
- **Explorador de código**: click en un hallazgo abre un modal con el extracto de código alrededor de la línea exacta. Si el archivo es binario compilado (ej. una librería nativa `.so`), en vez de mostrar texto ilegible se muestra un volcado hexadecimal de la zona exacta donde matcheó el patrón.
- Historial de análisis y exportación de reportes (JSON/HTML/MD).

---

## Stack de herramientas

| Herramienta | Función | Requerida |
|-------------|---------|-----------|
| `apktool` | Decodificar manifest + smali | Sí, para análisis completo |
| `jadx` | Decompilar a Java legible | Recomendada |
| `aapt` | Metadata rápida del APK | Opcional |
| `adb` | Adquisición del dispositivo | Opcional |

| Capa | Stack | Por qué |
| --- | --- | --- |
| Motor | Python puro (stdlib) | Cero dependencias, corre en cualquier lado |
| Backend | FastAPI + PostgreSQL + SQLAlchemy async + Alembic | Async de punta a punta, jobs en background, progreso en vivo vía SSE |
| Frontend | Next.js 16 + React 19 + Tailwind 4 + next-intl | Interfaz moderna, bilingüe (es/en) |
| Fuentes externas | OSV.dev, NVD | CVEs de librerías de terceros, cacheados en Postgres |

---

## APKs de prueba para CTF

Este repo incluye `novabank-demo-vulnerable.apk` en la raíz: un APK mínimo (app ficticia "NovaBank", sin librerías reales de terceros) armado a propósito para disparar todos los módulos del framework de forma limpia:

```bash
python3 apk_forensics.py novabank-demo-vulnerable.apk
```

Dispara, a propósito: `debuggable=true`, `allowBackup=true`, 5 componentes exportados sin permisos, 16 permisos peligrosos, secretos hardcodeados (password, AWS creds, API keys, clave privada RSA, connection string), criptografía débil (MD5, SHA1, ECB) y carga dinámica de código (`DexClassLoader`).

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

### Agregar un nuevo patrón de detección de secretos

En `apk_forensics.py`, añadir a `SECRET_PATTERNS` una tupla `(regex, título, severidad, rule_id)`:

```python
(r'(?i)mi_patron_regex', "Nombre del hallazgo", "HIGH", "MI_RULE_ID"),
```

`rule_id` es el identificador estable que usa el clasificador OWASP (`api/services/owasp_classifier.py`) — si agregás un patrón nuevo, agregá también su fila en la migración de `finding_owasp_mapping` (`api/alembic/versions/004_add_owasp_and_cve_tables.py`) para que quede clasificado, o va a quedar sin categoría (comportamiento seguro, no rompe nada).

### Agregar un nuevo módulo de análisis

1. Crear la función `analyze_nuevo(workdir, report)` siguiendo el patrón existente.
2. Llamarla en `run_analysis()` después del último módulo, con su propio paso de `progress_callback`.
3. Los hallazgos se agregan como `report.findings.append(Finding(...))`.

---

## Estructura del repo

```text
forense/
├── apk_forensics.py         # Motor CLI (stdlib puro)
├── test_framework.py        # Suite de tests del motor (16 tests, sin dependencias)
├── install.sh                # Instalador: clona el repo y levanta el stack con Docker
├── setup_wsl.sh             # Instala Java/apktool/jadx/aapt en WSL/Linux
├── docker-compose.yml        # Postgres para el stack completo
├── novabank-demo-vulnerable.apk  # APK de prueba para demos/CTF
├── api/                      # Backend FastAPI (ver api/README.md)
│   ├── main.py
│   ├── routers/
│   ├── services/              # owasp_classifier, cve_lookup, cve_details, code_snippet
│   └── alembic/                # Migraciones de base de datos
└── web/                      # Frontend Next.js (ver web/README.md)
    └── src/
        ├── app/[locale]/       # Rutas localizadas (es, en)
        └── components/
```

---

## Roadmap

- [ ] **Verificación activa de secretos** — confirmar contra la API real (AWS STS, Google) si una credencial encontrada sigue siendo válida, estilo TruffleHog (implica manejar rate limits y el riesgo de alertar al dueño de la clave — evaluado, no implementado)
- [ ] **SQLite/SQLCipher** — intentar descifrado de BBDDs con contraseñas comunes
- [ ] **Network** — análisis de tráfico con mitmproxy + bypass de pinning
- [ ] **Frida** — scripts de hooking automatizados para extracción de claves en runtime
- [ ] **VirusTotal** — lookup de hash y análisis de firmas

---

## Licencia

Todavía no se definió una licencia formal para este repositorio — si estás por hacerlo público, elegí una (MIT y Apache-2.0 son las más comunes para este tipo de herramienta) y agregá el archivo `LICENSE` antes de publicar.

## Contribuciones

Los issues y PRs son bienvenidos. Antes de proponer un patrón de detección nuevo, revisá la sección [Extender el framework](#extender-el-framework) — en particular, recordá clasificar cualquier `rule_id` nuevo contra OWASP para que no quede huérfano en el reporte.

---

*Framework creado para investigación forense, auditoría de seguridad y CTF. Usar únicamente en apps propias o con autorización explícita.*
