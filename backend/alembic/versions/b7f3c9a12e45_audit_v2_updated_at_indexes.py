"""audit v2 - updated_at, recorded_at index, model_name nullable

Revision ID: b7f3c9a12e45
Revises: 65da138a46ec
Create Date: 2026-06-16 18:00:00.000000

Correções da auditoria v2.0.0:
- M-5: Adiciona updated_at em physical_evolutions e clinical_tests
- M-6: Adiciona índice em recorded_at nas duas tabelas
- B-8: Torna model_name nullable em api_configurations
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b7f3c9a12e45'
down_revision: Union[str, None] = '65da138a46ec'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # M-5: adiciona updated_at em physical_evolutions
    op.add_column(
        'physical_evolutions',
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        )
    )

    # M-5: adiciona updated_at em clinical_tests
    op.add_column(
        'clinical_tests',
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        )
    )

    # M-6: índice em recorded_at para physical_evolutions
    op.create_index(
        'ix_physical_evolutions_recorded_at',
        'physical_evolutions',
        ['recorded_at'],
    )

    # M-6: índice em recorded_at para clinical_tests
    op.create_index(
        'ix_clinical_tests_recorded_at',
        'clinical_tests',
        ['recorded_at'],
    )

    # B-8: torna model_name nullable em api_configurations
    op.alter_column(
        'api_configurations',
        'model_name',
        existing_type=sa.String(120),
        nullable=True,
    )


def downgrade() -> None:
    # reverter model_name para not null (preencher com valor padrão antes)
    op.execute("UPDATE api_configurations SET model_name = 'unknown' WHERE model_name IS NULL")
    op.alter_column(
        'api_configurations',
        'model_name',
        existing_type=sa.String(120),
        nullable=False,
    )

    op.drop_index('ix_clinical_tests_recorded_at', table_name='clinical_tests')
    op.drop_index('ix_physical_evolutions_recorded_at', table_name='physical_evolutions')

    op.drop_column('clinical_tests', 'updated_at')
    op.drop_column('physical_evolutions', 'updated_at')
