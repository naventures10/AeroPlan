"""Add username to users table

Revision ID: f30d55c30570
Revises: c5cf38211176
Create Date: 2026-05-24 17:40:15.123456

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f30d55c30570"
down_revision: str | None = "c5cf38211176"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("username", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "username")
