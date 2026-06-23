"""Add decompiled_path to jobs table

Revision ID: 002
Revises: 001
Create Date: 2024-06-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '002'
down_revision: Union[str, None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('jobs', sa.Column('decompiled_path', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('jobs', 'decompiled_path')
