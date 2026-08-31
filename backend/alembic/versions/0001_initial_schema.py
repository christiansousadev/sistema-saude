"""schema inicial: users, api_configurations, physical_evolutions, clinical_tests

Revision ID: a3f1e2d4c890
Revises:
Create Date: 2026-06-13 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "a3f1e2d4c890"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ─── tipo enum compartilhado ──────────────────────────────────────────────
    # cria enum compartilhado explicitamente
    enginemode = postgresql.ENUM('LOCAL', 'LLM', 'MANUAL', name='enginemode')
    enginemode.create(op.get_bind())

    # ─── users ────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("height_cm", sa.Float(), nullable=True),
        sa.Column("birth_date", sa.Date(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_id", "users", ["id"])
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # ─── api_configurations ───────────────────────────────────────────────────
    op.create_table(
        "api_configurations",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "engine_mode",
            postgresql.ENUM('LOCAL', 'LLM', 'MANUAL', name='enginemode', create_type=False),
            nullable=False,
        ),
        sa.Column("api_key", sa.String(512), nullable=True),
        sa.Column("model_name", sa.String(120), nullable=False),
        sa.Column("base_url", sa.String(512), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_api_configurations_id", "api_configurations", ["id"])
    op.create_index("ix_api_configurations_user_id", "api_configurations", ["user_id"])

    # ─── physical_evolutions ──────────────────────────────────────────────────
    op.create_table(
        "physical_evolutions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("weight_kg", sa.Float(), nullable=True),
        sa.Column("body_fat_pct", sa.Float(), nullable=True),
        sa.Column("muscle_mass_kg", sa.Float(), nullable=True),
        sa.Column("photo_path", sa.String(512), nullable=True),
        sa.Column("ai_analysis", JSONB(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_physical_evolutions_id", "physical_evolutions", ["id"])
    op.create_index("ix_physical_evolutions_user_id", "physical_evolutions", ["user_id"])

    # ─── clinical_tests ───────────────────────────────────────────────────────
    op.create_table(
        "clinical_tests",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("file_path", sa.String(512), nullable=True),
        sa.Column("extracted_data", JSONB(), nullable=True),
        sa.Column(
            "extraction_engine",
            postgresql.ENUM('LOCAL', 'LLM', 'MANUAL', name='enginemode', create_type=False),
            nullable=True,
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "is_validated",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_clinical_tests_id", "clinical_tests", ["id"])
    op.create_index("ix_clinical_tests_user_id", "clinical_tests", ["user_id"])


def downgrade() -> None:
    # remove na ordem inversa para respeitar as foreign keys
    op.drop_index("ix_clinical_tests_user_id", table_name="clinical_tests")
    op.drop_index("ix_clinical_tests_id", table_name="clinical_tests")
    op.drop_table("clinical_tests")

    op.drop_index("ix_physical_evolutions_user_id", table_name="physical_evolutions")
    op.drop_index("ix_physical_evolutions_id", table_name="physical_evolutions")
    op.drop_table("physical_evolutions")

    op.drop_index("ix_api_configurations_user_id", table_name="api_configurations")
    op.drop_index("ix_api_configurations_id", table_name="api_configurations")
    op.drop_table("api_configurations")

    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_id", table_name="users")
    op.drop_table("users")

    # remove o tipo enum após todas as tabelas que o usam
    sa.Enum(name="enginemode").drop(op.get_bind(), checkfirst=True)
