from fastapi import APIRouter

from app.api.v1.router import router as v1_router

# AGREGA VERSOES DA API SOB UM UNICO ROUTER
api_router = APIRouter()

# todos os endpoints v1 ficam sob /api/v1
api_router.include_router(v1_router, prefix="/api/v1")
