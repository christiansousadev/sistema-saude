"""
integração com openai / gemini via sdk openai-compatible.
gemini: base_url = https://generativelanguage.googleapis.com/v1beta/openai/
openai: base_url = None (padrão)
"""
import base64
import json
import logging
from pathlib import Path

from app.db.models import ApiConfiguration

logger = logging.getLogger("audit.llm_service")

_PHYSICAL_PROMPT = """
Analise esta foto de evolução física e retorne um JSON com os campos:
{
  "body_composition_estimate": {"body_fat_pct": float|null, "muscle_mass_estimate": "low|medium|high"},
  "posture_notes": string,
  "visible_progress_indicators": [string],
  "confidence": "low|medium|high"
}
Retorne somente o JSON, sem markdown.
""".strip()

_CLINICAL_PROMPT = """
Você é um assistente especializado em extração de dados médicos.
Sua tarefa é extrair todos os marcadores de exame de sangue do texto (ou imagem) abaixo.
IMPORTANTE: Ignore completamente qualquer ruído do laboratório, como cabeçalhos, rodapés, propagandas, endereços, CRMs ou textos irrelevantes.
Você DEVE retornar ESTRITAMENTE um JSON válido, sem nenhum texto adicional ou formatação markdown, obedecendo EXATAMENTE o seguinte esquema estrutural:

{
  "engine": "llm",
  "status": "extracted",
  "exam_date": "YYYY-MM-DD" | null,
  "lab_name": string | null,
  "markers": [
    {
      "name": "chaves mapeadas (ex: glicemia_jejum, colesterol_total, hdl, ldl, triglicerideos, tsh, t4_livre, creatinina, ureia, hba1c)",
      "value": number (formato numérico flutuante ou string limpa),
      "unit": string,
      "reference_range": string | null,
      "status": "normal" | "alto" | "baixo" | null
    }
  ]
}

Se a data do exame não for encontrada, retorne null.
Se o nome do laboratório não for encontrado, retorne null.
Se um campo do marcador não for encontrado, retorne null.
Retorne SOMENTE o JSON.

Texto:
{text}
""".strip()


def _build_client(config: ApiConfiguration):
    try:
        from openai import OpenAI
    except ImportError as exc:
        raise RuntimeError("pacote openai não instalado") from exc

    from app.core.security import decrypt_api_key
    decrypted_key = decrypt_api_key(config.api_key)

    kwargs: dict = {"api_key": decrypted_key or "local"}
    if config.base_url:
        kwargs["base_url"] = config.base_url
    return OpenAI(**kwargs)


def _encode_image(path: str) -> tuple[str, str]:
    """retorna (base64_data, mime_type)"""
    suffix = Path(path).suffix.lower().lstrip(".")
    mime = "image/jpeg" if suffix in ("jpg", "jpeg") else f"image/{suffix}"
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode(), mime


def _extract_pdf_text(path: str) -> str:
    try:
        import pdfplumber

        with pdfplumber.open(path) as pdf:
            return "\n".join(p.extract_text() or "" for p in pdf.pages)
    except ImportError:
        return ""
    except Exception as exc:
        logger.error({"event": "llm_pdf_read_error", "error": str(exc)})
        return ""


# ANALISA FOTO FISICA VIA LLM COM VISAO
def analyze_physical_photo(absolute_path: str, config: ApiConfiguration) -> dict:
    try:
        client = _build_client(config)
        b64, mime = _encode_image(absolute_path)

        prompt = config.physical_system_prompt if config.physical_system_prompt and config.physical_system_prompt.strip() else _PHYSICAL_PROMPT
        response = client.chat.completions.create(
            model=config.model_name,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
            response_format={"type": "json_object"},
            max_tokens=512,
        )

        raw = response.choices[0].message.content or "{}"
        result = json.loads(raw)
        result["engine"] = "llm"
        result["model"] = config.model_name
        logger.info({"event": "llm_physical_analyzed", "model": config.model_name})
        return result

    except json.JSONDecodeError as exc:
        logger.error({"event": "llm_parse_error", "error": str(exc)})
        return {"engine": "llm", "status": "parse_error", "raw": raw}
    except Exception as exc:
        logger.error({"event": "llm_physical_error", "error": str(exc)})
        raise


# EXTRAI DADOS DE EXAME CLINICO VIA LLM
def extract_clinical_document(absolute_path: str, config: ApiConfiguration) -> dict:
    path = Path(absolute_path)
    suffix = path.suffix.lower()

    try:
        client = _build_client(config)

        clinical_prompt = config.clinical_system_prompt if config.clinical_system_prompt and config.clinical_system_prompt.strip() else _CLINICAL_PROMPT
        
        if suffix == ".pdf":
            import pdfplumber
            with pdfplumber.open(absolute_path) as pdf:
                text = " ".join(p.extract_text() or "" for p in pdf.pages)
                
            if not text.strip():
                raise ValueError("PDF vazio ou texto não extraível")

            response = client.chat.completions.create(
                model=config.model_name,
                messages=[{"role": "user", "content": clinical_prompt.format(text=text)}],
                response_format={"type": "json_object"},
                max_tokens=2048,
            )
        else:
            b64, mime = _encode_image(absolute_path)
            prompt = clinical_prompt.format(text="[extraia direto da imagem acima]")
            response = client.chat.completions.create(
                model=config.model_name,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
                            {"type": "text", "text": prompt},
                        ],
                    }
                ],
                response_format={"type": "json_object"},
                max_tokens=2048,
            )

        raw = response.choices[0].message.content or "{}"
        
        if raw.startswith("```"):
            raw = raw.strip("` \n").removeprefix("json").strip()
            
        result = json.loads(raw)
        result["engine"] = "llm"
        result["status"] = "extracted"
        result["model"] = config.model_name
        
        logger.info({"event": "llm_clinical_extracted", "model": config.model_name})
        return result

    except Exception as exc:
        logger.error({"event": "llm_clinical_error", "error": str(exc)})
        raise ValueError("Falha na extração LLM ou JSON inválido. Requer mapeamento manual.") from exc
