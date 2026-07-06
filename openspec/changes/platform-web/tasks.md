# Tasks: Platform Web (forense)

> Auditado contra el código real el 2026-07-06. Este checklist estaba 100% sin marcar aunque la mayor parte de las Fases 1-4 ya estaba implementada — quedó desincronizado del código. Los ítems marcados con nota fueron implementados con una forma distinta a la descripta literalmente (p. ej. lógica inline en vez de un archivo separado); se marcan como hechos porque la funcionalidad existe, no el archivo exacto.

## Phase 1: Infrastructure & Backend Scaffold

- [x] 1.1 Add `api/requirements.txt` with FastAPI, uvicorn, sqlalchemy, alembic, psycopg2-binary, aiofiles, python-multipart
- [x] 1.2 Add `docker-compose.yml` with PostgreSQL 16 service (db:5432, volume `postgres_data`)
- [x] 1.3 Create `api/database.py` with SQLAlchemy async engine, sessionmaker, and declarative base
- [x] 1.4 Create `api/models.py` with `Job` table (id, filename, status, created_at, updated_at, report_json, error_msg) — schema es más rico que lo pedido (md5, sha256, package_name, version_name, obfuscation_score, decompiled_path, completed_at)
- [x] 1.5 Create `api/alembic.ini` and `api/alembic/` migration scaffold; generate initial migration — 2 migraciones reales (001_initial_jobs_table, 002_add_decompiled_path)
- [x] 1.6 Refactor `apk_forensics.py`: extract `run_analysis(apk_path, workdir, no_jadx=False) -> ForensicsReport` callable; keep `main()` for CLI — confirmado en `apk_forensics.py:786` y `:842`
- [x] 1.7 Create `api/services/analyzer.py` wrapping `run_analysis` with tempdir cleanup and exception handling
- [x] 1.8 Create `api/main.py` with FastAPI app factory, CORS, and lifespan context (DB init)
- [x] 1.9 Create `api/routers/jobs.py` with `POST /jobs` accepting multipart upload, persisting `Job` row with status `pending`
- [x] 1.10 Create `api/routers/jobs.py` with `GET /jobs/{id}` returning job status and report JSON
- [x] 1.11 Create `api/routers/jobs.py` with `GET /jobs` listing jobs ordered by `created_at DESC`
- [x] 1.12 Create `api/routers/sse.py` with `GET /jobs/{id}/progress` streaming status updates via SSE
- [ ] 1.13 Wire background task in `POST /jobs`: run analyzer, update DB status (`running` -> `completed`/`failed`), push SSE event — **gap real**: `analyzer.py` nunca setea `status="running"`; el job queda en `pending` (default) hasta pasar directo a `completed`/`failed`. Los eventos SSE de progreso sí funcionan.
- [x] 1.14 Add `api/routers/health.py` with `GET /health` and `GET /health/db` checks

## Phase 2: Next.js Scaffold & Design System

- [x] 2.1 Run `npx create-next-app@15 web --typescript --tailwind --eslint --app --src-dir --no-turbopack` — terminó en Next 16.2.9 / React 19, no v15
- [x] 2.2 Install deps: `next-intl`, `@radix-ui/react-slot`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`
- [x] 2.3 Create `web/lib/utils.ts` with `cn()` helper using `clsx` + `tailwind-merge`
- [x] 2.4 Create `web/app/globals.css` mapping `design.md` tokens to CSS variables (surface, primary, secondary, etc.) — vía `@theme inline` (Tailwind 4)
- [x] 2.5 Update `web/tailwind.config.ts` extending theme with custom colors, fontFamily (Inter, JetBrains Mono), spacing
- [x] 2.6 Setup `web/messages/es.json` and `web/messages/en.json` with shared UI strings
- [x] 2.7 Configure `web/next.config.ts` with `next-intl` plugin and `output: 'standalone'`
- [x] 2.8 Create `web/app/layout.tsx` with root layout, `next-intl` provider, dark class on `<html>` — routing real vía `[locale]/layout.tsx`
- [x] 2.9 Create `web/components/ui/button.tsx` with CVA variants (primary, secondary, ghost, danger) matching design.md
- [x] 2.10 Create `web/components/ui/badge.tsx` with severity variants (critical, high, medium, low, info) and pill shape
- [x] 2.11 Create `web/components/ui/card.tsx` with surface container styles and hover states
- [x] 2.12 Create `web/components/ui/input.tsx` and `web/components/ui/textarea.tsx` with dark technical input styles
- [x] 2.13 Create `web/components/ui/table.tsx` (Table, TableRow, TableCell, TableHead) with striped rows and left-border hover
- [x] 2.14 Create `web/components/ui/progress.tsx` with 4px height and dual-tone pulse animation for "in progress"
- [x] 2.15 Create `web/components/sidebar.tsx` with 240px fixed width, nav items, active state with Matrix Green 2px indicator
- [x] 2.16 Create `web/components/header.tsx` with app title, locale switcher (es/en), and user avatar placeholder
- [x] 2.17 Compose `web/app/layout.tsx` sidebar + header shell with responsive collapse for tablet

## Phase 3: Core Pages

- [x] 3.1 Create `web/app/page.tsx` (Upload): drag-drop zone using `react-dropzone`, file validation (`.apk`), upload to `POST /jobs` — vía `[locale]/page.tsx` (342 líneas)
- [x] 3.2 Create `web/app/page.tsx` upload progress UI connecting to SSE `/jobs/{id}/progress`
- [x] 3.3 Create `web/app/history/page.tsx` fetching `GET /jobs` and rendering table with columns: filename, status, date, actions
- [x] 3.4 Add `web/app/history/page.tsx` status filter buttons (All / Pending / Running / Completed / Failed)
- [x] 3.5 Add `web/app/history/page.tsx` pagination or infinite scroll for job list
- [x] 3.6 Create `web/app/jobs/[id]/page.tsx` fetching `GET /jobs/{id}` and rendering full report sections — vía `[locale]/jobs/[id]/page.tsx` (746 líneas)
- [x] 3.7 Create `web/components/report-summary.tsx` showing APK metadata (package, version, hashes, size) in a Card grid — **nota**: implementado inline dentro de `jobs/[id]/page.tsx`, no como componente separado
- [x] 3.8 Create `web/components/findings-table.tsx` sorting findings by severity with color-coded badges and evidence tooltips — **nota**: inline en `jobs/[id]/page.tsx`
- [x] 3.9 Create `web/components/permissions-list.tsx` displaying dangerous permissions as pill badges with risk colors — **nota**: inline en `jobs/[id]/page.tsx`
- [x] 3.10 Create `web/components/crypto-panel.tsx` listing detected crypto primitives and highlighting weak ones (MD5/SHA1/ECB) — **nota**: inline en `jobs/[id]/page.tsx`
- [x] 3.11 Create `web/components/obfuscation-score.tsx` circular/linear score gauge with score interpretation text — **nota**: inline en `jobs/[id]/page.tsx`
- [x] 3.12 Create `web/app/dashboard/page.tsx` aggregating stats: total jobs, findings by severity, latest uploads — vía `[locale]/dashboard/page.tsx` (201 líneas)
- [x] 3.13 Create `web/components/stats-cards.tsx` for dashboard KPIs with icon + number + delta — **nota**: inline en `dashboard/page.tsx`
- [x] 3.14 Create `web/components/severity-chart.tsx` simple bar chart (recharts or CSS) for findings distribution — **nota**: inline en `dashboard/page.tsx`, usa `recharts`

## Phase 4: Advanced Features

- [x] 4.1 Create `web/app/compare/page.tsx` allowing selection of 2 jobs from history; render side-by-side report comparison — vía `[locale]/compare/page.tsx` (458 líneas)
- [x] 4.2 Create `web/components/compare-table.tsx` highlighting divergent fields (permissions, findings count, obfuscation score) — **nota**: inline en `compare/page.tsx`
- [x] 4.3 Create `web/app/explorer/[id]/page.tsx` showing APK file tree from `interesting_files` and `dex_files` arrays — vía `[locale]/explorer/[id]/page.tsx`, respaldado por `GET /api/v1/jobs/{id}/files` con protección anti path-traversal
- [x] 4.4 Add `web/app/explorer/[id]/page.tsx` file preview modal for `.json`, `.xml`, `.properties` text files
- [x] 4.5 Create `web/app/code/[id]/page.tsx` rendering decompiled Java code from JADX output stored on disk or fetched via API — vía `[locale]/code/[id]/page.tsx`, respaldado por `GET /api/v1/jobs/{id}/files/content`
- [x] 4.6 Create `web/components/code-viewer.tsx` with JetBrains Mono font, line numbers, collapsible sections, syntax highlighting (Prism/shiki) — **nota**: inline en `code/[id]/page.tsx`
- [x] 4.7 Add `web/app/jobs/[id]/page.tsx` "Export Report" button generating downloadable JSON / HTML / Markdown via API
- [x] 4.8 Create `api/routers/reports.py` with `GET /jobs/{id}/report?format=json|html|md` returning generated file — **nota**: no existe `reports.py` separado; el endpoint vive como `GET /api/v1/jobs/{id}/export?format=` en `jobs.py`
- [x] 4.9 Add `web/app/history/page.tsx` bulk actions: delete selected jobs (with confirmation dialog)
- [x] 4.10 Create `api/routers/jobs.py` `DELETE /jobs/{id}` removing DB row and associated temp files

## Phase 5: Polish & Integration

- [ ] 5.1 Create root `docker-compose.yml` adding `api` service (Python 3.12-slim, mount apk_forensics.py, depends_on db) — solo existe el servicio `postgres`
- [ ] 5.2 Create `api/Dockerfile` multi-stage build installing apktool, jadx, aapt dependencies
- [ ] 5.3 Create `web/Dockerfile` multi-stage build with `output: 'standalone'` and minimal Node 20 image
- [ ] 5.4 Add `docker-compose.yml` `web` service with `API_URL` env var and nginx proxy if needed
- [ ] 5.5 Write `api/tests/test_upload.py` pytest validating `POST /jobs` creates row and returns 201 with job ID — no existe `api/tests/`
- [ ] 5.6 Write `api/tests/test_analyzer.py` pytest calling `run_analysis` on synthetic APK and asserting report fields
- [ ] 5.7 Write `web/tests/history.spec.ts` Playwright test verifying history table renders after upload — no existe `web/tests/`
- [ ] 5.8 Add `api/services/analyzer.py` timeout handling (120s default) and graceful cleanup on cancellation — no hay timeout, solo cleanup de tempdir
- [ ] 5.9 Add `api/main.py` request logging middleware and structured JSON logs — `main.py` solo tiene CORS middleware
- [ ] 5.10 Audit all `web/app/**/*.tsx` against `design.md`: verify colors, typography, spacing, elevation, and shapes
- [ ] 5.11 Verify `web` bilingual labels load correctly in `es` and `en`; fix untranslated strings
- [ ] 5.12 Run `docker compose up --build` end-to-end and verify upload -> analysis -> report view flow
- [ ] 5.13 Update `README.md` with new web platform usage, Docker instructions, and environment variables

## Deuda técnica detectada (no estaba en el checklist original)

- `api/main.py` tiene `allow_origins=["*"]` con `allow_credentials=True` — revisar antes de cualquier despliegue compartido.
- Estado de SSE (`job_queues` dict en memoria) no sobrevive a múltiples workers/procesos — bloqueante para escalar la API horizontalmente.
- `api/venv/` y `api/uploads/` (APKs reales de usuarios) están trackeados en git a pesar de que `.gitignore` los excluye — el `.gitignore` nunca se commiteó, así que no tuvo efecto retroactivo. Pendiente: `git rm -r --cached` + commit del `.gitignore`.
