# Tasks: Platform Web (forense)

## Phase 1: Infrastructure & Backend Scaffold

- [ ] 1.1 Add `api/requirements.txt` with FastAPI, uvicorn, sqlalchemy, alembic, psycopg2-binary, aiofiles, python-multipart
- [ ] 1.2 Add `docker-compose.yml` with PostgreSQL 16 service (db:5432, volume `postgres_data`)
- [ ] 1.3 Create `api/database.py` with SQLAlchemy async engine, sessionmaker, and declarative base
- [ ] 1.4 Create `api/models.py` with `Job` table (id, filename, status, created_at, updated_at, report_json, error_msg)
- [ ] 1.5 Create `api/alembic.ini` and `api/alembic/` migration scaffold; generate initial migration
- [ ] 1.6 Refactor `apk_forensics.py`: extract `run_analysis(apk_path, workdir, no_jadx=False) -> ForensicsReport` callable; keep `main()` for CLI
- [ ] 1.7 Create `api/services/analyzer.py` wrapping `run_analysis` with tempdir cleanup and exception handling
- [ ] 1.8 Create `api/main.py` with FastAPI app factory, CORS, and lifespan context (DB init)
- [ ] 1.9 Create `api/routers/jobs.py` with `POST /jobs` accepting multipart upload, persisting `Job` row with status `pending`
- [ ] 1.10 Create `api/routers/jobs.py` with `GET /jobs/{id}` returning job status and report JSON
- [ ] 1.11 Create `api/routers/jobs.py` with `GET /jobs` listing jobs ordered by `created_at DESC`
- [ ] 1.12 Create `api/routers/sse.py` with `GET /jobs/{id}/progress` streaming status updates via SSE
- [ ] 1.13 Wire background task in `POST /jobs`: run analyzer, update DB status (`running` -> `completed`/`failed`), push SSE event
- [ ] 1.14 Add `api/routers/health.py` with `GET /health` and `GET /health/db` checks

## Phase 2: Next.js Scaffold & Design System

- [ ] 2.1 Run `npx create-next-app@15 web --typescript --tailwind --eslint --app --src-dir --no-turbopack`
- [ ] 2.2 Install deps: `next-intl`, `@radix-ui/react-slot`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`
- [ ] 2.3 Create `web/lib/utils.ts` with `cn()` helper using `clsx` + `tailwind-merge`
- [ ] 2.4 Create `web/app/globals.css` mapping `design.md` tokens to CSS variables (surface, primary, secondary, etc.)
- [ ] 2.5 Update `web/tailwind.config.ts` extending theme with custom colors, fontFamily (Inter, JetBrains Mono), spacing
- [ ] 2.6 Setup `web/messages/es.json` and `web/messages/en.json` with shared UI strings
- [ ] 2.7 Configure `web/next.config.ts` with `next-intl` plugin and `output: 'standalone'`
- [ ] 2.8 Create `web/app/layout.tsx` with root layout, `next-intl` provider, dark class on `<html>`
- [ ] 2.9 Create `web/components/ui/button.tsx` with CVA variants (primary, secondary, ghost, danger) matching design.md
- [ ] 2.10 Create `web/components/ui/badge.tsx` with severity variants (critical, high, medium, low, info) and pill shape
- [ ] 2.11 Create `web/components/ui/card.tsx` with surface container styles and hover states
- [ ] 2.12 Create `web/components/ui/input.tsx` and `web/components/ui/textarea.tsx` with dark technical input styles
- [ ] 2.13 Create `web/components/ui/table.tsx` (Table, TableRow, TableCell, TableHead) with striped rows and left-border hover
- [ ] 2.14 Create `web/components/ui/progress.tsx` with 4px height and dual-tone pulse animation for "in progress"
- [ ] 2.15 Create `web/components/sidebar.tsx` with 240px fixed width, nav items, active state with Matrix Green 2px indicator
- [ ] 2.16 Create `web/components/header.tsx` with app title, locale switcher (es/en), and user avatar placeholder
- [ ] 2.17 Compose `web/app/layout.tsx` sidebar + header shell with responsive collapse for tablet

## Phase 3: Core Pages

- [ ] 3.1 Create `web/app/page.tsx` (Upload): drag-drop zone using `react-dropzone`, file validation (`.apk`), upload to `POST /jobs`
- [ ] 3.2 Create `web/app/page.tsx` upload progress UI connecting to SSE `/jobs/{id}/progress`
- [ ] 3.3 Create `web/app/history/page.tsx` fetching `GET /jobs` and rendering table with columns: filename, status, date, actions
- [ ] 3.4 Add `web/app/history/page.tsx` status filter buttons (All / Pending / Running / Completed / Failed)
- [ ] 3.5 Add `web/app/history/page.tsx` pagination or infinite scroll for job list
- [ ] 3.6 Create `web/app/jobs/[id]/page.tsx` fetching `GET /jobs/{id}` and rendering full report sections
- [ ] 3.7 Create `web/components/report-summary.tsx` showing APK metadata (package, version, hashes, size) in a Card grid
- [ ] 3.8 Create `web/components/findings-table.tsx` sorting findings by severity with color-coded badges and evidence tooltips
- [ ] 3.9 Create `web/components/permissions-list.tsx` displaying dangerous permissions as pill badges with risk colors
- [ ] 3.10 Create `web/components/crypto-panel.tsx` listing detected crypto primitives and highlighting weak ones (MD5/SHA1/ECB)
- [ ] 3.11 Create `web/components/obfuscation-score.tsx` circular/linear score gauge with score interpretation text
- [ ] 3.12 Create `web/app/dashboard/page.tsx` aggregating stats: total jobs, findings by severity, latest uploads
- [ ] 3.13 Create `web/components/stats-cards.tsx` for dashboard KPIs with icon + number + delta
- [ ] 3.14 Create `web/components/severity-chart.tsx` simple bar chart (recharts or CSS) for findings distribution

## Phase 4: Advanced Features

- [ ] 4.1 Create `web/app/compare/page.tsx` allowing selection of 2 jobs from history; render side-by-side report comparison
- [ ] 4.2 Create `web/components/compare-table.tsx` highlighting divergent fields (permissions, findings count, obfuscation score)
- [ ] 4.3 Create `web/app/explorer/[id]/page.tsx` showing APK file tree from `interesting_files` and `dex_files` arrays
- [ ] 4.4 Add `web/app/explorer/[id]/page.tsx` file preview modal for `.json`, `.xml`, `.properties` text files
- [ ] 4.5 Create `web/app/code/[id]/page.tsx` rendering decompiled Java code from JADX output stored on disk or fetched via API
- [ ] 4.6 Create `web/components/code-viewer.tsx` with JetBrains Mono font, line numbers, collapsible sections, syntax highlighting (Prism/shiki)
- [ ] 4.7 Add `web/app/jobs/[id]/page.tsx` "Export Report" button generating downloadable JSON / HTML / Markdown via API
- [ ] 4.8 Create `api/routers/reports.py` with `GET /jobs/{id}/report?format=json|html|md` returning generated file
- [ ] 4.9 Add `web/app/history/page.tsx` bulk actions: delete selected jobs (with confirmation dialog)
- [ ] 4.10 Create `api/routers/jobs.py` `DELETE /jobs/{id}` removing DB row and associated temp files

## Phase 5: Polish & Integration

- [ ] 5.1 Create root `docker-compose.yml` adding `api` service (Python 3.12-slim, mount apk_forensics.py, depends_on db)
- [ ] 5.2 Create `api/Dockerfile` multi-stage build installing apktool, jadx, aapt dependencies
- [ ] 5.3 Create `web/Dockerfile` multi-stage build with `output: 'standalone'` and minimal Node 20 image
- [ ] 5.4 Add `docker-compose.yml` `web` service with `API_URL` env var and nginx proxy if needed
- [ ] 5.5 Write `api/tests/test_upload.py` pytest validating `POST /jobs` creates row and returns 201 with job ID
- [ ] 5.6 Write `api/tests/test_analyzer.py` pytest calling `run_analysis` on synthetic APK and asserting report fields
- [ ] 5.7 Write `web/tests/history.spec.ts` Playwright test verifying history table renders after upload
- [ ] 5.8 Add `api/services/analyzer.py` timeout handling (120s default) and graceful cleanup on cancellation
- [ ] 5.9 Add `api/main.py` request logging middleware and structured JSON logs
- [ ] 5.10 Audit all `web/app/**/*.tsx` against `design.md`: verify colors, typography, spacing, elevation, and shapes
- [ ] 5.11 Verify `web` bilingual labels load correctly in `es` and `en`; fix untranslated strings
- [ ] 5.12 Run `docker compose up --build` end-to-end and verify upload -> analysis -> report view flow
- [ ] 5.13 Update `README.md` with new web platform usage, Docker instructions, and environment variables
