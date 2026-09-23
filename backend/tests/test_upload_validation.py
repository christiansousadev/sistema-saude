"""
testes de borda para upload de arquivos (backend/app/services/storage.py):
extensão não permitida, mime real divergente da extensão e arquivo acima do limite.
"""
import io
from datetime import datetime, timezone


def _recorded_at_form() -> dict:
    return {"recorded_at": datetime.now(timezone.utc).isoformat()}


def test_physical_upload_rejects_disallowed_extension(client, auth_headers):
    files = {"photo": ("malware.exe", io.BytesIO(b"conteudo qualquer"), "application/octet-stream")}
    response = client.post(
        "/api/v1/physical/",
        data=_recorded_at_form(),
        files=files,
        headers=auth_headers,
    )
    assert response.status_code == 415


def test_physical_upload_rejects_mime_mismatch(client, auth_headers):
    # extensão .jpg mas conteúdo não é uma imagem real — magic bytes não batem com o declarado
    files = {"photo": ("foto.jpg", io.BytesIO(b"isto nao e uma imagem jpeg de verdade"), "image/jpeg")}
    response = client.post(
        "/api/v1/physical/",
        data=_recorded_at_form(),
        files=files,
        headers=auth_headers,
    )
    assert response.status_code == 415


def test_physical_upload_rejects_file_over_size_limit(client, auth_headers):
    oversized = b"0" * (10 * 1024 * 1024 + 1)  # 1 byte acima do limite de 10 MB
    files = {"photo": ("foto.jpg", io.BytesIO(oversized), "image/jpeg")}
    response = client.post(
        "/api/v1/physical/",
        data=_recorded_at_form(),
        files=files,
        headers=auth_headers,
    )
    assert response.status_code == 413
