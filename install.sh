#!/usr/bin/env bash
# =====================================================
#  install.sh — Instalador de Forense (stack Docker)
#  Clona el repo (si hace falta) y levanta Postgres +
#  API + Web con Docker Compose.
#
#  Uso:
#    curl -fsSL https://raw.githubusercontent.com/juanse-campana/forense/main/install.sh | bash
#
#  O, si preferis revisar el script antes de correrlo:
#    curl -fsSL https://raw.githubusercontent.com/juanse-campana/forense/main/install.sh -o install.sh
#    cat install.sh   # revisalo
#    bash install.sh
# =====================================================
set -euo pipefail

REPO_URL="https://github.com/juanse-campana/forense.git"
REPO_DIR="forense"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BOLD='\033[1m'; RESET='\033[0m'
log()  { echo -e "  ${GREEN}[+]${RESET} $1"; }
warn() { echo -e "  ${YELLOW}[!]${RESET} $1"; }
err()  { echo -e "  ${RED}[-]${RESET} $1"; }
step() { echo -e "\n${BOLD}${GREEN}[>] $1${RESET}"; }

echo -e "\n${BOLD}${GREEN}╔══════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${GREEN}║  Forense — instalador (Docker)           ║${RESET}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════╝${RESET}"

# ── 1. Prerrequisitos ──────────────────────────────
step "Verificando Docker"

if ! command -v docker &> /dev/null; then
    err "No se encontro Docker."
    case "$(uname -s)" in
        Darwin) echo "  Instalalo con: brew install --cask docker" ;;
        Linux)  echo "  Guia oficial: https://docs.docker.com/engine/install/" ;;
        *)      echo "  Descargalo de: https://docs.docker.com/get-docker/" ;;
    esac
    echo "  Volve a correr este script despues de instalarlo."
    exit 1
fi

if docker compose version &> /dev/null; then
    COMPOSE="docker compose"
elif command -v docker-compose &> /dev/null; then
    COMPOSE="docker-compose"
else
    err "Docker esta instalado pero no encuentro Docker Compose (ni 'docker compose' ni 'docker-compose')."
    echo "  Docker Desktop lo trae incluido. Sin Desktop (Linux): https://docs.docker.com/compose/install/linux/"
    exit 1
fi
log "Docker y Compose disponibles (${COMPOSE})"

if ! docker info &> /dev/null; then
    err "Docker esta instalado pero no esta corriendo."
    echo "  Abri Docker Desktop (o inicia el daemon) y volve a intentar."
    exit 1
fi
log "Docker esta corriendo"

if ! command -v git &> /dev/null; then
    err "No se encontro git. Instalalo y volve a correr este script."
    exit 1
fi

# ── 2. Obtener el codigo ───────────────────────────
step "Obteniendo el codigo"

if [ -f "./docker-compose.yml" ] && [ -f "./apk_forensics.py" ]; then
    log "Ya estamos parados dentro del repo, no hace falta clonar."
elif [ -d "$REPO_DIR" ]; then
    if [ -d "$REPO_DIR/.git" ]; then
        log "La carpeta '${REPO_DIR}' ya existe, actualizando (git pull)..."
        (cd "$REPO_DIR" && git pull --ff-only)
    else
        err "Ya existe una carpeta '${REPO_DIR}' que no es un checkout de este repo."
        echo "  Movela, borrala, o corre este script desde otro directorio."
        exit 1
    fi
    cd "$REPO_DIR"
else
    log "Clonando ${REPO_URL} en ./${REPO_DIR}"
    git clone "$REPO_URL" "$REPO_DIR"
    cd "$REPO_DIR"
fi

# ── 3. Levantar el stack ───────────────────────────
step "Levantando Postgres + API + Web (esto puede tardar unos minutos la primera vez)"
$COMPOSE up --build -d

# ── 4. Esperar a que el backend responda ───────────
step "Esperando a que el backend responda"
TRIES=0
until curl -sf http://localhost:8000/health > /dev/null 2>&1; do
    TRIES=$((TRIES + 1))
    if [ "$TRIES" -ge 60 ]; then
        warn "El backend todavia no responde despues de un rato largo."
        warn "Revisa los logs con: ${COMPOSE} logs -f backend"
        break
    fi
    sleep 2
done

echo -e "\n${BOLD}${GREEN}✓ Listo.${RESET}"
echo -e "  Web:  ${BOLD}http://localhost:3000${RESET}"
echo -e "  API:  ${BOLD}http://localhost:8000/docs${RESET}"
echo -e "\n  Ver logs:      ${COMPOSE} logs -f"
echo -e "  Apagar todo:   ${COMPOSE} down\n"
