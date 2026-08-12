FROM python:3.12-slim

# apktool y jadx necesitan un JRE; aapt sale del paquete "aapt" de apt.
# Misma logica que setup_wsl.sh, adaptada a Debian slim.
RUN apt-get update && apt-get install -y --no-install-recommends \
    openjdk-17-jre-headless \
    aapt \
    wget \
    unzip \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ARG APKTOOL_VERSION=2.9.3
RUN wget -q "https://raw.githubusercontent.com/iBotPeaches/Apktool/master/scripts/linux/apktool" -O /usr/local/bin/apktool \
    && wget -q "https://bitbucket.org/iBotPeaches/apktool/downloads/apktool_${APKTOOL_VERSION}.jar" -O /usr/local/lib/apktool.jar \
    && sed -i "s|jar_file=.*|jar_file=/usr/local/lib/apktool.jar|" /usr/local/bin/apktool \
    && chmod +x /usr/local/bin/apktool

ARG JADX_VERSION=1.4.7
RUN mkdir -p /opt/jadx \
    && wget -q "https://github.com/skylot/jadx/releases/download/v${JADX_VERSION}/jadx-${JADX_VERSION}.zip" -O /tmp/jadx.zip \
    && unzip -q /tmp/jadx.zip -d /opt/jadx \
    && chmod +x /opt/jadx/bin/jadx \
    && ln -s /opt/jadx/bin/jadx /usr/local/bin/jadx \
    && rm /tmp/jadx.zip

WORKDIR /app

# requirements.txt se copia solo antes del resto para cachear la capa de pip
# install y no reinstalar dependencias en cada cambio de codigo.
COPY api/requirements.txt api/requirements.txt
RUN pip install --no-cache-dir -r api/requirements.txt

# apk_forensics.py vive un nivel arriba de api/ en el repo real; se replica
# la misma estructura relativa porque analyzer.py y code_snippet.py lo
# importan via sys.path.insert(0, parent.parent.parent).
COPY apk_forensics.py apk_forensics.py
COPY api api

WORKDIR /app/api

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port 8000"]
