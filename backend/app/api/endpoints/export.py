import csv
import io
import json
import logging
import zipfile
from datetime import date, datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser
from app.db.models import ClinicalTest, DailyHabit, Medication, PhysicalEvolution
from app.db.session import get_db

logger = logging.getLogger("audit.export")

router = APIRouter(prefix="/export", tags=["export"])


# EXPORTA TODOS OS DADOS DO PACIENTE EM FORMATO ZIP COMPATIVEL COM LGPD
@router.get("/patient-data")
def export_patient_data_lgpd(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        zip_buffer = io.BytesIO()
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
            # 1. perfil do usuario em json
            profile_data = {
                "id": current_user.id,
                "name": current_user.name,
                "email": current_user.email,
                "height_cm": current_user.height_cm,
                "birth_date": current_user.birth_date.isoformat() if current_user.birth_date else None,
                "is_superadmin": current_user.is_superadmin,
                "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
                "exported_at": now_str,
                "lgpd_compliance": "Lei Geral de Protecao de Dados Pessoais (Lei 13.709/2018, Art. 18, V)",
            }
            zip_file.writestr("perfil_paciente.json", json.dumps(profile_data, indent=2, ensure_ascii=False))

            # 2. historico fisico em csv
            physicals = (
                db.query(PhysicalEvolution)
                .filter(PhysicalEvolution.user_id == current_user.id)
                .order_by(PhysicalEvolution.recorded_at.asc())
                .all()
            )
            phys_buf = io.StringIO()
            phys_writer = csv.writer(phys_buf)
            phys_writer.writerow([
                "id",
                "recorded_at",
                "weight_kg",
                "body_fat_pct",
                "muscle_mass_kg",
                "visceral_fat",
                "waist_cm",
                "hip_cm",
                "chest_cm",
                "arm_cm",
                "thigh_cm",
                "neck_cm",
                "notes",
            ])
            for p in physicals:
                phys_writer.writerow([
                    p.id,
                    p.recorded_at.isoformat() if p.recorded_at else "",
                    p.weight_kg if p.weight_kg is not None else "",
                    p.body_fat_pct if p.body_fat_pct is not None else "",
                    p.muscle_mass_kg if p.muscle_mass_kg is not None else "",
                    p.visceral_fat if p.visceral_fat is not None else "",
                    p.waist_cm if p.waist_cm is not None else "",
                    p.hip_cm if p.hip_cm is not None else "",
                    p.chest_cm if p.chest_cm is not None else "",
                    p.arm_cm if p.arm_cm is not None else "",
                    p.thigh_cm if p.thigh_cm is not None else "",
                    p.neck_cm if p.neck_cm is not None else "",
                    (p.notes or "").replace("\n", " "),
                ])
            zip_file.writestr("historico_fisico.csv", phys_buf.getvalue())

            # 3. historico clinico e biomarcadores em csv
            clinicals = (
                db.query(ClinicalTest)
                .filter(ClinicalTest.user_id == current_user.id)
                .order_by(ClinicalTest.recorded_at.asc())
                .all()
            )
            clin_buf = io.StringIO()
            clin_writer = csv.writer(clin_buf)
            clin_writer.writerow([
                "test_id",
                "recorded_at",
                "test_name",
                "is_validated",
                "marker_name",
                "marker_value",
                "marker_unit",
                "reference_range",
                "status",
            ])
            for c in clinicals:
                data = c.extracted_data or {}
                markers = data.get("markers", [])
                if not markers:
                    clin_writer.writerow([
                        c.id,
                        c.recorded_at.isoformat() if c.recorded_at else "",
                        c.title or "Exame Laboratorial",
                        c.is_validated,
                        "",
                        "",
                        "",
                        "",
                        "",
                    ])
                else:
                    for m in markers:
                        clin_writer.writerow([
                            c.id,
                            c.recorded_at.isoformat() if c.recorded_at else "",
                            c.title or "Exame Laboratorial",
                            c.is_validated,
                            m.get("name", ""),
                            m.get("value", ""),
                            m.get("unit", ""),
                            m.get("reference_range", ""),
                            m.get("status", ""),
                        ])
            zip_file.writestr("historico_clinico_biomarcadores.csv", clin_buf.getvalue())

            # 4. habitos diarios em csv
            habits = (
                db.query(DailyHabit)
                .filter(DailyHabit.user_id == current_user.id)
                .order_by(DailyHabit.date.asc())
                .all()
            )
            hab_buf = io.StringIO()
            hab_writer = csv.writer(hab_buf)
            hab_writer.writerow([
                "date",
                "water_ml",
                "water_goal_ml",
                "sleep_hours",
                "sleep_quality",
                "energy_level",
                "workout_done",
                "notes",
            ])
            for h in habits:
                hab_writer.writerow([
                    h.date.isoformat() if h.date else "",
                    h.water_ml,
                    h.water_goal_ml,
                    h.sleep_hours if h.sleep_hours is not None else "",
                    h.sleep_quality if h.sleep_quality is not None else "",
                    h.energy_level if h.energy_level is not None else "",
                    h.workout_done,
                    (h.notes or "").replace("\n", " "),
                ])
            zip_file.writestr("habitos_diarios.csv", hab_buf.getvalue())

            # 5. medicamentos e suplementos em csv
            meds = (
                db.query(Medication)
                .filter(Medication.user_id == current_user.id)
                .order_by(Medication.created_at.asc())
                .all()
            )
            med_buf = io.StringIO()
            med_writer = csv.writer(med_buf)
            med_writer.writerow([
                "id",
                "name",
                "dosage",
                "frequency",
                "category",
                "is_active",
                "start_date",
                "end_date",
                "instructions",
            ])
            for m in meds:
                med_writer.writerow([
                    m.id,
                    m.name,
                    m.dosage,
                    m.frequency,
                    m.category,
                    m.is_active,
                    m.start_date.isoformat() if m.start_date else "",
                    m.end_date.isoformat() if m.end_date else "",
                    (m.instructions or "").replace("\n", " "),
                ])
            zip_file.writestr("medicamentos_suplementos.csv", med_buf.getvalue())

            # 6. termo de portabilidade lgpd
            termo = (
                f"SISTEMA SAUDE - PORTABILIDADE DE DADOS PESSOAIS (LGPD)\n"
                f"Gerado em: {now_str}\n"
                f"Titular dos dados: {current_user.name} ({current_user.email})\n\n"
                f"Este pacote contem a totalidade dos dados cadastrais, historicos fisicos,\n"
                f"exames laboratoriais, biomarcadores extraidos, habitos diarios e medicamentos\n"
                f"registrados na plataforma pelo usuario.\n\n"
                f"Conforme estabelecido pela Lei Geral de Protecao de Dados Pessoais do Brasil\n"
                f"(Lei Federal nº 13.709/2018), Art. 18, inciso V, o titular tem direito a\n"
                f"portabilidade dos dados a outro fornecedor de servico mediante requisicao expressa.\n"
            )
            zip_file.writestr("TERMO_PORTABILIDADE_LGPD.txt", termo)

        zip_bytes = zip_buffer.getvalue()
        filename = f"dados_saude_lgpd_{date.today().isoformat()}.zip"

        logger.info(json.dumps({
            "event": "patient_data_exported_lgpd",
            "user_id": current_user.id,
            "archive_size_bytes": len(zip_bytes),
        }))

        return Response(
            content=zip_bytes,
            media_type="application/zip",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Type": "application/zip",
            },
        )
    except Exception as exc:
        logger.error(json.dumps({
            "event": "patient_data_export_error",
            "user_id": current_user.id,
            "error": str(exc),
        }))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="erro ao exportar dados do paciente",
        )
