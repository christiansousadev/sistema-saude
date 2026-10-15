"""v3.3 - health features, anthropometrics, habits, medications, doctor share and 2fa

Revision ID: d4f8e1a7b9c2
Revises: c9e4d1f2a837
Create Date: 2026-10-15 16:45:00.000000

Novas tabelas e colunas da versao 3.3.0:
- daily_habits: persistencia de hidratacao e habitos diarios
- medications: acompanhamento de medicamentos e suplementos
- doctor_share_tokens: tokens de acesso temporario com pin para medicos
- physical_evolutions: circunferencias corporais e multiplos angulos de fotos
- users: suporte a autenticacao de dois fatores (totp_secret, is_totp_enabled)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd4f8e1a7b9c2'
down_revision: Union[str, None] = 'c9e4d1f2a837'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. users: suporte a 2fa
    op.add_column('users', sa.Column('totp_secret', sa.String(length=64), nullable=True))
    op.add_column('users', sa.Column('is_totp_enabled', sa.Boolean(), server_default='false', nullable=False))

    # 2. physical_evolutions: circunferencias e fotos adicionais
    op.add_column('physical_evolutions', sa.Column('waist_cm', sa.Float(), nullable=True))
    op.add_column('physical_evolutions', sa.Column('hip_cm', sa.Float(), nullable=True))
    op.add_column('physical_evolutions', sa.Column('chest_cm', sa.Float(), nullable=True))
    op.add_column('physical_evolutions', sa.Column('arm_cm', sa.Float(), nullable=True))
    op.add_column('physical_evolutions', sa.Column('thigh_cm', sa.Float(), nullable=True))
    op.add_column('physical_evolutions', sa.Column('neck_cm', sa.Float(), nullable=True))
    op.add_column('physical_evolutions', sa.Column('photo_back_path', sa.String(length=512), nullable=True))
    op.add_column('physical_evolutions', sa.Column('photo_side_path', sa.String(length=512), nullable=True))

    # 3. daily_habits
    op.create_table(
        'daily_habits',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('water_ml', sa.Integer(), server_default='0', nullable=False),
        sa.Column('water_goal_ml', sa.Integer(), server_default='2500', nullable=False),
        sa.Column('sleep_hours', sa.Float(), nullable=True),
        sa.Column('sleep_quality', sa.Integer(), nullable=True),
        sa.Column('energy_level', sa.Integer(), nullable=True),
        sa.Column('workout_done', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'date', name='uq_daily_habits_user_date'),
    )
    op.create_index('ix_daily_habits_id', 'daily_habits', ['id'])
    op.create_index('ix_daily_habits_user_id', 'daily_habits', ['user_id'])
    op.create_index('ix_daily_habits_date', 'daily_habits', ['date'])

    # 4. medications
    op.create_table(
        'medications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('dosage', sa.String(length=100), nullable=False),
        sa.Column('frequency', sa.String(length=100), nullable=False),
        sa.Column('category', sa.String(length=50), server_default='medicamento', nullable=False),
        sa.Column('instructions', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_medications_id', 'medications', ['id'])
    op.create_index('ix_medications_user_id', 'medications', ['user_id'])

    # 5. doctor_share_tokens
    op.create_table(
        'doctor_share_tokens',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('token', sa.String(length=64), nullable=False),
        sa.Column('recipient_name', sa.String(length=120), nullable=True),
        sa.Column('pin_hash', sa.String(length=255), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('access_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_doctor_share_tokens_id', 'doctor_share_tokens', ['id'])
    op.create_index('ix_doctor_share_tokens_user_id', 'doctor_share_tokens', ['user_id'])
    op.create_index('ix_doctor_share_tokens_token', 'doctor_share_tokens', ['token'], unique=True)
    op.create_index('ix_doctor_share_tokens_expires_at', 'doctor_share_tokens', ['expires_at'])


def downgrade() -> None:
    # reverte tabelas
    op.drop_table('doctor_share_tokens')
    op.drop_table('medications')
    op.drop_table('daily_habits')

    # reverte colunas physical_evolutions
    op.drop_column('physical_evolutions', 'photo_side_path')
    op.drop_column('physical_evolutions', 'photo_back_path')
    op.drop_column('physical_evolutions', 'neck_cm')
    op.drop_column('physical_evolutions', 'thigh_cm')
    op.drop_column('physical_evolutions', 'arm_cm')
    op.drop_column('physical_evolutions', 'chest_cm')
    op.drop_column('physical_evolutions', 'hip_cm')
    op.drop_column('physical_evolutions', 'waist_cm')

    # reverte colunas users
    op.drop_column('users', 'is_totp_enabled')
    op.drop_column('users', 'totp_secret')
