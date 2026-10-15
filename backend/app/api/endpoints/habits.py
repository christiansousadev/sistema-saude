import logging
from datetime import date, datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser
from app.db.models import DailyHabit
from app.db.session import get_db
from app.schemas.habits import (
    DailyHabitResponse,
    DailyHabitUpdate,
    WaterHistoryResponse,
    WaterIncrement,
    WaterUpdate,
)

logger = logging.getLogger("audit.habits")

router = APIRouter(prefix="/habits", tags=["habits"])


def _calculate_pct(water_ml: int, goal_ml: int) -> int:
    if goal_ml <= 0:
        return 0
    return min(100, int((water_ml / goal_ml) * 100))


def _to_response(habit: DailyHabit) -> DailyHabitResponse:
    return DailyHabitResponse(
        id=habit.id,
        user_id=habit.user_id,
        date=habit.date,
        water_ml=habit.water_ml,
        water_goal_ml=habit.water_goal_ml,
        pct=_calculate_pct(habit.water_ml, habit.water_goal_ml),
        sleep_hours=habit.sleep_hours,
        sleep_quality=habit.sleep_quality,
        energy_level=habit.energy_level,
        workout_done=habit.workout_done,
        notes=habit.notes,
        created_at=habit.created_at,
        updated_at=habit.updated_at,
    )


def _get_or_create_habit(db: Session, user_id: int, target_date: date) -> DailyHabit:
    habit = (
        db.query(DailyHabit)
        .filter(DailyHabit.user_id == user_id, DailyHabit.date == target_date)
        .first()
    )
    if not habit:
        habit = DailyHabit(
            user_id=user_id,
            date=target_date,
            water_ml=0,
            water_goal_ml=2500,
        )
        db.add(habit)
        db.commit()
        db.refresh(habit)
    return habit


# OBTEM REGISTRO DE HABITOS DO DIA ATUAL
@router.get("/daily/today", response_model=DailyHabitResponse)
def get_today_habit(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        today = date.today()
        habit = _get_or_create_habit(db, current_user.id, today)
        return _to_response(habit)
    except Exception as exc:
        logger.error({"event": "get_today_habit_error", "user_id": current_user.id, "error": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="erro ao carregar habitos de hoje",
        )


# INCREMENTA CONSUMO DE AGUA
@router.post("/water/increment", response_model=DailyHabitResponse)
def increment_water(
    payload: WaterIncrement,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        target_date = payload.date or date.today()
        habit = _get_or_create_habit(db, current_user.id, target_date)
        habit.water_ml = min(10000, habit.water_ml + payload.increment_ml)
        db.commit()
        db.refresh(habit)

        logger.info({
            "event": "water_incremented",
            "user_id": current_user.id,
            "date": str(target_date),
            "amount_ml": habit.water_ml,
        })
        return _to_response(habit)
    except Exception as exc:
        db.rollback()
        logger.error({"event": "water_increment_error", "user_id": current_user.id, "error": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="erro ao atualizar consumo de agua",
        )


# DEFINE QUANTIDADE EXATA DE AGUA
@router.post("/water/set", response_model=DailyHabitResponse)
def set_water(
    payload: WaterUpdate,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        target_date = payload.date or date.today()
        habit = _get_or_create_habit(db, current_user.id, target_date)
        habit.water_ml = payload.amount_ml
        if payload.goal_ml:
            habit.water_goal_ml = payload.goal_ml
        db.commit()
        db.refresh(habit)

        logger.info({
            "event": "water_set",
            "user_id": current_user.id,
            "date": str(target_date),
            "amount_ml": habit.water_ml,
        })
        return _to_response(habit)
    except Exception as exc:
        db.rollback()
        logger.error({"event": "water_set_error", "user_id": current_user.id, "error": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="erro ao salvar consumo de agua",
        )


# ZERA CONSUMO DE AGUA DO DIA
@router.post("/water/reset", response_model=DailyHabitResponse)
def reset_water(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    target_date: date | None = None,
):
    try:
        dt = target_date or date.today()
        habit = _get_or_create_habit(db, current_user.id, dt)
        habit.water_ml = 0
        db.commit()
        db.refresh(habit)

        logger.info({"event": "water_reset", "user_id": current_user.id, "date": str(dt)})
        return _to_response(habit)
    except Exception as exc:
        db.rollback()
        logger.error({"event": "water_reset_error", "user_id": current_user.id, "error": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="erro ao zerar consumo de agua",
        )


# RETORNA HISTORICO DE AGUA E CONSISTENCIA
@router.get("/water/history", response_model=WaterHistoryResponse)
def get_water_history(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    days: int = Query(default=7, ge=1, le=60),
):
    try:
        start_date = date.today() - timedelta(days=days - 1)
        records = (
            db.query(DailyHabit)
            .filter(DailyHabit.user_id == current_user.id, DailyHabit.date >= start_date)
            .order_by(DailyHabit.date.asc())
            .all()
        )

        record_map = {r.date: r for r in records}
        items: list[DailyHabitResponse] = []
        total_ml = 0
        logged_count = 0
        goal_reached_count = 0

        # preenche dias sem registro com zeros para consistencia no grafico
        for i in range(days):
            current_day = start_date + timedelta(days=i)
            rec = record_map.get(current_day)
            if rec:
                resp = _to_response(rec)
                items.append(resp)
                if rec.water_ml > 0:
                    total_ml += rec.water_ml
                    logged_count += 1
                if rec.water_ml >= rec.water_goal_ml:
                    goal_reached_count += 1
            else:
                items.append(
                    DailyHabitResponse(
                        id=0,
                        user_id=current_user.id,
                        date=current_day,
                        water_ml=0,
                        water_goal_ml=2500,
                        pct=0,
                        workout_done=False,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    )
                )

        average_ml = round(total_ml / max(1, logged_count), 1) if logged_count > 0 else 0.0

        return WaterHistoryResponse(
            items=items,
            average_ml=average_ml,
            days_logged=logged_count,
            goal_reached_days=goal_reached_count,
        )
    except Exception as exc:
        logger.error({"event": "water_history_error", "user_id": current_user.id, "error": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="erro ao carregar historico de hidratacao",
        )


# ATUALIZA HABITOS DIARIOS (SONO, ENERGIA, TREINO, NOTAS)
@router.put("/daily", response_model=DailyHabitResponse)
def update_daily_habit(
    payload: DailyHabitUpdate,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        target_date = payload.date or date.today()
        habit = _get_or_create_habit(db, current_user.id, target_date)

        if payload.water_ml is not None:
            habit.water_ml = payload.water_ml
        if payload.water_goal_ml is not None:
            habit.water_goal_ml = payload.water_goal_ml
        if payload.sleep_hours is not None:
            habit.sleep_hours = payload.sleep_hours
        if payload.sleep_quality is not None:
            habit.sleep_quality = payload.sleep_quality
        if payload.energy_level is not None:
            habit.energy_level = payload.energy_level
        if payload.workout_done is not None:
            habit.workout_done = payload.workout_done
        if payload.notes is not None:
            habit.notes = payload.notes

        db.commit()
        db.refresh(habit)

        logger.info({"event": "daily_habit_updated", "user_id": current_user.id, "date": str(target_date)})
        return _to_response(habit)
    except Exception as exc:
        db.rollback()
        logger.error({"event": "daily_habit_update_error", "user_id": current_user.id, "error": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="erro ao atualizar habitos diarios",
        )
