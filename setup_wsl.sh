#!/bin/bash
# =====================================================
#  setup_wsl.sh — Instalación del entorno forense
#  Android APK Forensics Framework (WSL / Ubuntu)
# =====================================================
set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BOLD='\033[1m'; RESET='\033[0m'
log()  { echo -e "  ${GREEN}[+]${RESET} $1"; }
warn() { echo -e "  ${YELLOW}[!]${RESET} $1"; }
err()  { echo -e "  ${RED}[-]${RESET} $1"; }
step() { echo -e "\n${BOLD}${GREEN}[>] $1${RESET}"; }

echo -e "\n${BOLD}${GREEN}╔══════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${GREEN}║  Android Forensics — Setup WSL           ║${RESET}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════╝${RESET}\n"

# ── 1. Actualizar APT ──────────────────────────────
step "Actualizando paquetes del sistema"
sudo apt-get update -qq
sudo apt-get install -y -qq \
    python3 python3-pip python3-venv \
    openjdk-17-jre-headless \
    adb \
    aapt \
    curl wget unzip git \
    file binutils \
    sqlite3
log "Paquetes base instalados"

# ── 2. Python packages ────────────────────────────
step "Instalando dependencias Python"
python3 -m pip install --quiet --upgrade pip
python3 -m pip install --quiet \
    androguard \
    frida-tools \
    colorama \
    rich
log "Dependencias Python instaladas"

# ── 3. apktool ────────────────────────────────────
step "Instalando apktool"
APKTOOL_VER="2.9.3"
APKTOOL_BIN="/usr/local/bin/apktool"
APKTOOL_JAR="/usr/local/lib/apktool.jar"

if command -v apktool &> /dev/null; then
    warn "apktool ya instalado: $(apktool --version 2>/dev/null | head -1)"
else
    wget -q "https://raw.githubusercontent.com/iBotPeaches/Apktool/master/scripts/linux/apktool" -O "$APKTOOL_BIN"
    wget -q "https://bitbucket.org/iBotPeaches/apktool/downloads/apktool_${APKTOOL_VER}.jar" -O "$APKTOOL_JAR"
    chmod +x "$APKTOOL_BIN"
    # Parchear el script para que use el JAR correcto
    sed -i "s|jar_file=.*|jar_file=$APKTOOL_JAR|" "$APKTOOL_BIN" 2>/dev/null || true
    log "apktool ${APKTOOL_VER} instalado en ${APKTOOL_BIN}"
fi

# ── 4. JADX ───────────────────────────────────────
step "Instalando JADX"
JADX_VER="1.4.7"
JADX_DIR="/opt/jadx"

if command -v jadx &> /dev/null; then
    warn "jadx ya instalado"
else
    mkdir -p "$JADX_DIR"
    wget -q "https://github.com/skylot/jadx/releases/download/v${JADX_VER}/jadx-${JADX_VER}.zip" \
        -O /tmp/jadx.zip
    unzip -q /tmp/jadx.zip -d "$JADX_DIR"
    chmod +x "$JADX_DIR/bin/jadx" "$JADX_DIR/bin/jadx-gui"
    ln -sf "$JADX_DIR/bin/jadx" /usr/local/bin/jadx
    ln -sf "$JADX_DIR/bin/jadx-gui" /usr/local/bin/jadx-gui
    rm /tmp/jadx.zip
    log "jadx ${JADX_VER} instalado en ${JADX_DIR}"
fi

# ── 5. MobSF (opcional, Docker) ───────────────────
step "MobSF (análisis más avanzado)"
if command -v docker &> /dev/null; then
    log "Docker disponible. Para iniciar MobSF:"
    echo -e "  ${BOLD}docker run -it --rm -p 8000:8000 opensecurity/mobile-security-framework-mobsf${RESET}"
else
    warn "Docker no encontrado. MobSF requiere Docker para ejecutarse."
    warn "Instala Docker Desktop en Windows y habilita la integración WSL."
fi

# ── 6. Verificación final ─────────────────────────
step "Verificación del entorno"
check() {
    if command -v "$1" &> /dev/null; then
        log "$1 → $(command -v $1)"
    else
        err "$1 → NO ENCONTRADO"
    fi
}
check python3
check java
check adb
check aapt
check apktool
check jadx

echo -e "\n${BOLD}${GREEN}  ✓ Entorno listo.${RESET}"
echo -e "\n  Uso:\n  ${BOLD}python3 apk_forensics.py <archivo.apk>${RESET}\n"
