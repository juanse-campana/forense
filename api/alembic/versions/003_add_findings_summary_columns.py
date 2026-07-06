"""Add findings_count and highest_severity to jobs table

Revision ID: 003
Revises: 002
Create Date: 2026-07-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '003'
down_revision: Union[str, None] = '002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('jobs', sa.Column('findings_count', sa.Integer(), nullable=True))
    op.add_column('jobs', sa.Column('highest_severity', sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column('jobs', 'highest_severity')
    op.drop_column('jobs', 'findings_count')
