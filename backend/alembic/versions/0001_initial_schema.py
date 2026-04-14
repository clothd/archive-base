"""Initial schema

Revision ID: 0001
Revises:
Create Date: 2026-04-13

"""
from typing import Sequence, Union

import sqlalchemy as sa
import geoalchemy2
from alembic import op


revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable PostGIS extension
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column(
            "role",
            sa.Enum("admin", "editor", "viewer", name="userrole"),
            nullable=False,
            server_default="viewer",
        ),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)

    op.create_table(
        "pipelines",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column(
            "geometry",
            geoalchemy2.types.Geometry(geometry_type="LINESTRING", srid=4326),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_pipelines_id"), "pipelines", ["id"], unique=False)

    op.create_table(
        "chainage_pins",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("pipeline_id", sa.Integer(), nullable=False),
        sa.Column("chainage_km", sa.Float(), nullable=False),
        sa.Column(
            "geometry",
            geoalchemy2.types.Geometry(geometry_type="POINT", srid=4326),
            nullable=False,
        ),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["pipeline_id"], ["pipelines.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_chainage_pins_id"), "chainage_pins", ["id"], unique=False)
    op.create_index(op.f("ix_chainage_pins_pipeline_id"), "chainage_pins", ["pipeline_id"], unique=False)

    op.create_table(
        "documents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("pin_id", sa.Integer(), nullable=False),
        sa.Column("filename", sa.String(), nullable=False),
        sa.Column("s3_key", sa.String(), nullable=False),
        sa.Column("content_type", sa.String(), nullable=False),
        sa.Column("uploaded_by", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["pin_id"], ["chainage_pins.id"]),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_documents_id"), "documents", ["id"], unique=False)
    op.create_index(op.f("ix_documents_pin_id"), "documents", ["pin_id"], unique=False)

    op.create_table(
        "pipeline_access",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("pipeline_id", sa.Integer(), nullable=False),
        sa.Column(
            "access_level",
            sa.Enum("viewer", "editor", "admin", name="accesslevel"),
            nullable=False,
            server_default="viewer",
        ),
        sa.ForeignKeyConstraint(["pipeline_id"], ["pipelines.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("user_id", "pipeline_id"),
    )


def downgrade() -> None:
    op.drop_table("pipeline_access")
    op.drop_index(op.f("ix_documents_pin_id"), table_name="documents")
    op.drop_index(op.f("ix_documents_id"), table_name="documents")
    op.drop_table("documents")
    op.drop_index(op.f("ix_chainage_pins_pipeline_id"), table_name="chainage_pins")
    op.drop_index(op.f("ix_chainage_pins_id"), table_name="chainage_pins")
    op.drop_table("chainage_pins")
    op.drop_index(op.f("ix_pipelines_id"), table_name="pipelines")
    op.drop_table("pipelines")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_index(op.f("ix_users_id"), table_name="users")
    op.drop_table("users")
    op.execute("DROP TYPE IF EXISTS userrole")
    op.execute("DROP TYPE IF EXISTS accesslevel")
