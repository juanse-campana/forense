"""Add OWASP Mobile Top 10 classification tables and library CVE cache

Revision ID: 004
Revises: 003
Create Date: 2026-07-07 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '004'
down_revision: Union[str, None] = '003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Las 10 categorias del OWASP Mobile Top 10 (2024) - lista estatica publicada,
# no cambia salvo que OWASP publique una revision nueva del documento.
OWASP_CATEGORIES = [
    {"id": "M1", "name": "Improper Credential Usage", "description": "Credenciales (passwords, API keys, tokens, claves privadas) hardcodeadas o mal manejadas en el codigo o la configuracion de la app."},
    {"id": "M2", "name": "Inadequate Supply Chain Security", "description": "Librerias/SDKs de terceros con vulnerabilidades conocidas (CVEs), o proceso de build/distribucion sin verificacion de integridad."},
    {"id": "M3", "name": "Insecure Authentication/Authorization", "description": "Fallas en como la app verifica identidad o permisos, tanto localmente como contra el backend."},
    {"id": "M4", "name": "Insufficient Input/Output Validation", "description": "Falta de validacion de datos de entrada/salida (inyeccion, deserializacion insegura, etc.)."},
    {"id": "M5", "name": "Insecure Communication", "description": "Trafico de red sin cifrar, sin certificate pinning, o aceptando configuraciones de red inseguras por defecto."},
    {"id": "M6", "name": "Inadequate Privacy Controls", "description": "Manejo de datos personales/PII sin los controles de privacidad adecuados."},
    {"id": "M7", "name": "Insufficient Binary Protections", "description": "Falta de proteccion contra ingenieria inversa: poca ofuscacion, uso de reflection o carga dinamica de codigo que facilita el analisis por un atacante."},
    {"id": "M8", "name": "Security Misconfiguration", "description": "Configuraciones inseguras del build o del manifest: debuggable=true, allowBackup, componentes exportados sin proteccion, servicios cloud mal configurados."},
    {"id": "M9", "name": "Insecure Data Storage", "description": "Datos sensibles guardados sin cifrar o en ubicaciones accesibles por otras apps."},
    {"id": "M10", "name": "Insufficient Cryptography", "description": "Uso de algoritmos criptograficos debiles o rotos (MD5, SHA-1, modo ECB) para proteger datos."},
]

# Mapeo de cada rule_id (definido en apk_forensics.py, ver Finding.rule_id)
# a su categoria OWASP. owasp_category_id=None para hallazgos que son
# meta-informacion de la herramienta (SETUP_*), no vulnerabilidades reales.
FINDING_MAPPINGS = [
    {"rule_id": "SECRET_API_KEY", "owasp_category_id": "M1"},
    {"rule_id": "SECRET_SECRET_KEY", "owasp_category_id": "M1"},
    {"rule_id": "SECRET_HARDCODED_PASSWORD", "owasp_category_id": "M1"},
    {"rule_id": "SECRET_AUTH_TOKEN", "owasp_category_id": "M1"},
    {"rule_id": "SECRET_PRIVATE_KEY", "owasp_category_id": "M1"},
    {"rule_id": "SECRET_GOOGLE_API_KEY", "owasp_category_id": "M1"},
    {"rule_id": "SECRET_EMBEDDED_PRIVATE_KEY", "owasp_category_id": "M1"},
    {"rule_id": "SECRET_BASE64_POSSIBLE", "owasp_category_id": "M1"},
    {"rule_id": "SECRET_AWS_CREDENTIALS", "owasp_category_id": "M1"},
    {"rule_id": "SECRET_FIREBASE_URL", "owasp_category_id": "M8"},
    {"rule_id": "SECRET_DB_CONNECTION_STRING", "owasp_category_id": "M1"},
    {"rule_id": "CONFIG_DEBUGGABLE_TRUE", "owasp_category_id": "M8"},
    {"rule_id": "CONFIG_ALLOW_BACKUP", "owasp_category_id": "M8"},
    {"rule_id": "NETWORK_NO_SECURITY_CONFIG", "owasp_category_id": "M5"},
    {"rule_id": "ATTACK_SURFACE_EXPORTED_COMPONENT", "owasp_category_id": "M8"},
    {"rule_id": "CRYPTO_ECB_MODE", "owasp_category_id": "M10"},
    {"rule_id": "CRYPTO_WEAK_HASH", "owasp_category_id": "M10"},
    {"rule_id": "OBFUSCATION_REFLECTION", "owasp_category_id": "M7"},
    {"rule_id": "OBFUSCATION_DYNAMIC_CODE_LOADING", "owasp_category_id": "M7"},
    {"rule_id": "SETUP_APKTOOL_MISSING", "owasp_category_id": None},
    {"rule_id": "SETUP_JADX_MISSING", "owasp_category_id": None},
]


def upgrade() -> None:
    owasp_categories = op.create_table(
        'owasp_mobile_categories',
        sa.Column('id', sa.String(length=3), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    finding_mapping = op.create_table(
        'finding_owasp_mapping',
        sa.Column('rule_id', sa.String(length=60), nullable=False),
        sa.Column('owasp_category_id', sa.String(length=3), nullable=True),
        sa.PrimaryKeyConstraint('rule_id'),
        sa.ForeignKeyConstraint(['owasp_category_id'], ['owasp_mobile_categories.id']),
    )

    op.create_table(
        'library_vulnerability_cache',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('ecosystem', sa.String(length=50), nullable=False),
        sa.Column('package_name', sa.String(length=255), nullable=False),
        sa.Column('version', sa.String(length=100), nullable=False),
        sa.Column('vulnerabilities', sa.JSON(), nullable=False),
        sa.Column('checked_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('ecosystem', 'package_name', 'version', name='uq_library_version'),
    )

    op.bulk_insert(owasp_categories, OWASP_CATEGORIES)
    op.bulk_insert(finding_mapping, FINDING_MAPPINGS)


def downgrade() -> None:
    op.drop_table('library_vulnerability_cache')
    op.drop_table('finding_owasp_mapping')
    op.drop_table('owasp_mobile_categories')
