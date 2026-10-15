from fastapi import APIRouter

from app.api.endpoints.admin import router as admin_router
from app.api.endpoints.assistant import router as assistant_router
from app.api.endpoints.auth import router as auth_router
from app.api.endpoints.clinical import router as clinical_router
from app.api.endpoints.config import router as config_router
from app.api.endpoints.doctor_share import router as doctor_share_router
from app.api.endpoints.export import router as export_router
from app.api.endpoints.habits import router as habits_router
from app.api.endpoints.medications import router as medications_router
from app.api.endpoints.physical import router as physical_router
from app.api.endpoints.reports import router as reports_router

router = APIRouter()

router.include_router(auth_router)
router.include_router(physical_router)
router.include_router(clinical_router)
router.include_router(habits_router)
router.include_router(medications_router)
router.include_router(doctor_share_router)
router.include_router(export_router)
router.include_router(config_router)
router.include_router(reports_router)
router.include_router(assistant_router)
router.include_router(admin_router, prefix="/admin")
