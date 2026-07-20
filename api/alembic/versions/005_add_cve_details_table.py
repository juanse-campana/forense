"""Add cve_details table (NVD per-CVE enrichment cache)

Revision ID: 005
Revises: 004
Create Date: 2026-07-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '005'
down_revision: Union[str, None] = '004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Cache-aside del detalle oficial de cada CVE individual contra el NVD
    # (ver api/services/cve_details.py). Sin seed: se llena dinamicamente
    # a medida que aparecen CVEs en los analisis.
    op.create_table(
        'cve_details',
        sa.Column('cve_id', sa.String(length=20), nullable=False),
        sa.Column('cvss_score', sa.Float(), nullable=True),
        sa.Column('cvss_severity', sa.String(length=10), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('references', sa.JSON(), nullable=False),
        sa.Column('fetched_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('cve_id'),
    )


def downgrade() -> None:
    op.drop_table('cve_details')
