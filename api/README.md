# Forense API

Backend para el análisis forense de archivos APK. Expone una API REST construida con FastAPI que permite subir aplicaciones Android, ejecutar análisis en segundo plano y consultar resultados en tiempo real mediante Server-Sent Events (SSE).

## Tech Stack

| Tecnología | Uso |
|------------|-----|
| **FastAPI** | Framework web async para Python |
| **SQLAlchemy (async)** | ORM para consultas asíncronas a la base de datos |
| **PostgreSQL** | Base de datos relacional para persistir jobs y reportes |
| **Alembic** | Migraciones de esquema de base de datos |
| **asyncpg** | Driver async para PostgreSQL |
| **Pydantic Settings** | Gestión de variables de entorno tipadas |
| **Uvicorn** | Servidor ASGI para desarrollo y producción |

## Prerrequisitos

- **Python 3.9+**
- **Docker** y **Docker Compose** (para levantar PostgreSQL)
- **PostgreSQL** (solo si no usas Docker)

## Setup paso a paso

1. **Crear entorno virtual**

   ```bash
   python3 -m venv venv
   ```

2. **Activar el entorno virtual**

   ```bash
   # Linux / macOS
   source venv/bin/activate

   # Windows
   venv\Scripts\activate
   ```

3. **Instalar dependencias**

   ```bash
   pip install -r requirements.txt
   ```

4. **Levantar PostgreSQL con Docker**

   Desde la raíz del proyecto:

   ```bash
   docker compose up -d
   ```

   Esto crea un contenedor `forense-postgres` con la base de datos `forense`.

5. **Ejecutar migraciones de base de datos**

   ```bash
   alembic upgrade head
   ```

6. **Iniciar el servidor de desarrollo**

   ```bash
   uvicorn main:app --reload
   ```

   La API estará disponible en `http://localhost:8000`.

## Variables de entorno

Todas las variables usan el prefijo `FORENSE_`.

| Variable | Valor por defecto | Descripción |
|----------|-------------------|-------------|
| `FORENSE_DATABASE_URL` | `postgresql+asyncpg://forense:forense@localhost:5432/forense` | URL de conexión a PostgreSQL (usa `asyncpg` para modo async) |
| `FORENSE_UPLOAD_DIR` | `uploads` | Directorio donde se almacenan los APK subidos |
| `FORENSE_MAX_FILE_SIZE` | `524288000` (500 MB) | Tamaño máximo de archivo en bytes |
| `FORENSE_NVD_API_KEY` | _(vacío)_ | API key del NVD para enriquecer CVEs (gratis: https://nvd.nist.gov/developers/request-an-api-key). Sin key: 5 req/30s; con key: 50 req/30s |
| `FORENSE_NVD_MAX_PER_ANALYSIS` | `40` | Tope de CVEs nuevos a consultar al NVD por análisis (el resto se completa en análisis posteriores) |

Ejemplo de archivo `.env`:

```env
FORENSE_DATABASE_URL=postgresql+asyncpg://forense:forense@localhost:5432/forense
FORENSE_UPLOAD_DIR=uploads
FORENSE_MAX_FILE_SIZE=524288000
FORENSE_NVD_API_KEY=
FORENSE_NVD_MAX_PER_ANALYSIS=40
```

## Enriquecimiento de vulnerabilidades

Cada análisis se enriquece con dos fuentes externas, ambas con patrón
**cache-aside** en PostgreSQL (si el dato ya está guardado y es reciente,
no se vuelve a consultar la red):

| Fuente | Qué aporta | Tabla cache | TTL |
|--------|------------|-------------|-----|
| **OSV.dev** (Google, sin auth) | CVEs por librería de terceros (coordenadas Maven + versión) | `library_vulnerability_cache` | 30 días |
| **NVD** (NIST, API key opcional) | Detalle oficial por CVE: puntaje CVSS v3.1, severidad, descripción, fechas | `cve_details` | 90 días |

Además, cada hallazgo del análisis se clasifica contra el **OWASP Mobile
Top 10 (2024)** mediante un mapeo estático (`finding_owasp_mapping`,
seedeado en la migración 004) — OWASP publica una lista, no una API, por
eso es un lookup local sin llamadas externas.


## Endpoints de la API

### Jobs

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/api/v1/jobs` | Subir un archivo APK y crear un job de análisis |
| `GET` | `/api/v1/jobs` | Listar jobs con paginación (`page`, `limit`) |
| `GET` | `/api/v1/jobs/{job_id}` | Obtener detalle de un job específico (incluye `third_party_libraries` con CVEs y `vulnerable_libraries_count`) |
| `GET` | `/api/v1/jobs/{job_id}/findings` | Hallazgos paginados; filtros opcionales `severity` y `owasp` (`M1`..`M10`) |
| `DELETE` | `/api/v1/jobs/{job_id}` | Eliminar un job y sus archivos asociados |
| `GET` | `/api/v1/jobs/{job_id}/progress` | Stream SSE con el progreso del análisis en tiempo real |

### Health

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/health` | Verificar que el servicio está activo |
| `GET` | `/health/db` | Verificar conectividad con PostgreSQL |

## Documentación interactiva

FastAPI genera automáticamente documentación interactiva:

- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

## Tests

Actualmente no hay tests automatizados configurados. Para agregarlos, se recomienda instalar `pytest` y `httpx`:

```bash
pip install pytest pytest-asyncio httpx
pytest
```

## Troubleshooting

### Error de conexión a PostgreSQL

- Verifica que el contenedor esté corriendo: `docker compose ps`
- Revisa los logs: `docker compose logs postgres`
- Asegúrate de que el puerto `5432` no esté ocupado por otra instancia de PostgreSQL

### `alembic upgrade head` falla

- Confirma que `alembic.ini` apunta a la base de datos correcta.
- Si la base de datos está vacía, verifica que el contenedor haya terminado de inicializarse.

### El análisis no inicia

- Revisa que el directorio `uploads/` tenga permisos de escritura.
- Verifica que el módulo `apk_forensics` esté disponible en el `PYTHONPATH`.

### CORS en desarrollo

El middleware CORS está configurado para permitir todos los orígenes (`allow_origins=["*"]`). En producción, restringe esto al dominio del frontend.
