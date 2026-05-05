"""Add status to pins, size_bytes to documents, name to users

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-05

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "chainage_pins",
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
    )
    op.add_column(
        "documents",
        sa.Column("size_bytes", sa.BigInteger(), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("name", sa.String(255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "name")
    op.drop_column("documents", "size_bytes")
    op.drop_column("chainage_pins", "status")
