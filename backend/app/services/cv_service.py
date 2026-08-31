"""
motor local de análise: usa Pillow para imagens e pdfplumber para documentos.
plug-in point: substituir os stubs abaixo por modelos locais (YOLO, SAM, etc.)
"""
import logging
import re
from pathlib import Path

logger = logging.getLogger("audit.cv_service")

# configurações de marcadores com nome de exibição e regex
_MARKERS_CONFIG = [
    {"name": "Glicemia em Jejum", "pattern": re.compile(r'(glicemia|glicose).*?(\d+[.,]?\d*)', re.IGNORECASE)},
    {"name": "Colesterol Total", "pattern": re.compile(r'(colesterol\s*total).*?(\d+[.,]?\d*)', re.IGNORECASE)},
    {"name": "Colesterol HDL", "pattern": re.compile(r'(hdl).*?(\d+[.,]?\d*)', re.IGNORECASE)},
    {"name": "Colesterol LDL", "pattern": re.compile(r'(ldl).*?(\d+[.,]?\d*)', re.IGNORECASE)},
    {"name": "Triglicerídeos", "pattern": re.compile(r'(triglicer[íi]deos|triglic[éèe]rides).*?(\d+[.,]?\d*)', re.IGNORECASE)},
    {"name": "TSH", "pattern": re.compile(r'(tsh|horm[oô]nio tireoestimulante).*?(\d+[.,]?\d*)', re.IGNORECASE)},
    {"name": "T4 Livre", "pattern": re.compile(r'(t4\s*livre|tiroxina\s*livre).*?(\d+[.,]?\d*)', re.IGNORECASE)},
    {"name": "Creatinina", "pattern": re.compile(r'(creatinina).*?(\d+[.,]?\d*)', re.IGNORECASE)},
    {"name": "Ureia", "pattern": re.compile(r'(ureia).*?(\d+[.,]?\d*)', re.IGNORECASE)},
    {"name": "Hemoglobina Glicada", "pattern": re.compile(r'(hba1c|hemoglobina\s*glicada).*?(\d+[.,]?\d*)', re.IGNORECASE)},
]

def _read_pdf_text(path: Path) -> str:
    try:
        import pdfplumber  # importação tardia para não quebrar se não instalado

        with pdfplumber.open(str(path)) as pdf:
            return "\n".join(p.extract_text() or "" for p in pdf.pages)
    except ImportError:
        logger.warning({"event": "cv_pdfplumber_missing"})
        return ""
    except Exception as exc:
        logger.error({"event": "cv_pdf_read_error", "error": str(exc)})
        return ""


def _image_metadata(path: Path) -> dict:
    try:
        from PIL import Image

        with Image.open(str(path)) as img:
            return {"width": img.width, "height": img.height, "format": img.format}
    except ImportError:
        logger.warning({"event": "cv_pillow_missing"})
        return {}
    except Exception as exc:
        logger.error({"event": "cv_image_read_error", "error": str(exc)})
        return {}


# ANALISA FOTO DE EVOLUCAO FISICA COM MOTOR LOCAL
def analyze_physical_photo(absolute_path: str) -> dict:
    path = Path(absolute_path)
    if not path.exists():
        logger.error({"event": "cv_file_not_found", "path": absolute_path})
        return {"engine": "local_cv", "status": "file_not_found"}

    metadata = _image_metadata(path)
    logger.info({"event": "cv_physical_analyzed", "path": absolute_path})

    # ponto de integração para modelo local de visão (ex: YOLO-pose, SAM)
    return {
        "engine": "local_cv",
        "status": "manual_review_required",
        "image_metadata": metadata,
        "note": "análise automática de composição corporal requer modelo local configurado",
    }


# EXTRAI DADOS DE DOCUMENTO CLINICO COM MOTOR LOCAL
def extract_clinical_document(absolute_path: str) -> dict:
    path = Path(absolute_path)
    if not path.exists():
        logger.error({"event": "cv_file_not_found", "path": absolute_path})
        return {"engine": "local_cv", "status": "file_not_found"}

    suffix = path.suffix.lower()

    if suffix == ".pdf":
        text = _read_pdf_text(path)
    else:
        # imagem: tenta OCR via Pillow + pytesseract se disponível
        try:
            import pytesseract
            from PIL import Image

            with Image.open(str(path)) as img:
                text = pytesseract.image_to_string(img, lang="por")
        except ImportError:
            logger.warning({"event": "cv_ocr_unavailable"})
            text = ""
        except Exception as exc:
            logger.error({"event": "cv_ocr_error", "error": str(exc)})
            text = ""

    markers: list[dict] = []
    for marker_cfg in _MARKERS_CONFIG:
        match = marker_cfg["pattern"].search(text)
        if match:
            value = match.group(2).replace(',', '.')
            markers.append({
                "name": marker_cfg["name"],
                "value": value,
                "unit": "",
                "reference_range": None,
                "status": None
            })

    logger.info({"event": "cv_clinical_extracted", "markers_found": len(markers)})
    return {
        "engine": "local_cv",
        "status": "extracted",
        "raw_text_length": len(text),
        "markers": markers,
    }
