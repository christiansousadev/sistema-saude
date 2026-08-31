import logging
from typing import Any

logger = logging.getLogger("audit.clinical")

# Indicador se aumento no marcador é geralmente considerado positivo ou de atenção
_HIGHER_IS_BETTER = {"HDL", "Vitamina D", "Vitamina B12", "Hemoglobina", "Hematócrito", "Plaquetas"}


def _parse_float(val: Any) -> float | None:
    if val is None:
        return None
    try:
        if isinstance(val, (int, float)):
            return float(val)
        cleaned = str(val).replace(",", ".").strip()
        import re
        match = re.search(r"[-+]?\d*\.?\d+", cleaned)
        if match:
            return float(match.group(0))
        return None
    except Exception:
        return None


def calculate_biomarker_trends(
    current_markers: list[dict[str, Any]],
    previous_markers: list[dict[str, Any]] | None,
) -> list[dict[str, Any]]:
    """
    Compara marcadores do exame atual com o exame anterior e gera deltas e tendências.

    Retorna uma lista de marcadores enriquecidos com:
    - delta_value: diferença absoluta (atual - anterior)
    - delta_pct: variação percentual
    - trend: 'melhora' | 'piora' | 'estavel' | 'novo'
    - alert: mensagem textual de alerta se variação for relevante (> 15%)
    """
    if not current_markers:
        return []

    prev_map: dict[str, float] = {}
    if previous_markers:
        for m in previous_markers:
            name = m.get("name")
            val = _parse_float(m.get("value"))
            if name and val is not None:
                prev_map[name] = val

    enriched: list[dict[str, Any]] = []

    for marker in current_markers:
        name = marker.get("name", "")
        curr_val = _parse_float(marker.get("value"))
        unit = marker.get("unit", "")
        status = marker.get("status")

        item = {
            "name": name,
            "value": marker.get("value"),
            "unit": unit,
            "reference_range": marker.get("reference_range"),
            "status": status,
            "delta_value": None,
            "delta_pct": None,
            "trend": "novo",
            "alert": None,
        }

        if curr_val is not None and name in prev_map:
            prev_val = prev_map[name]
            delta = round(curr_val - prev_val, 2)
            item["delta_value"] = delta

            if prev_val != 0:
                pct = round((delta / prev_val) * 100, 1)
                item["delta_pct"] = pct

                higher_better = name in _HIGHER_IS_BETTER

                if abs(pct) < 3.0:
                    item["trend"] = "estavel"
                elif (pct > 0 and higher_better) or (pct < 0 and not higher_better):
                    item["trend"] = "melhora"
                else:
                    item["trend"] = "piora"

                if abs(pct) >= 15.0 and item["trend"] == "piora":
                    item["alert"] = f"Aumento de {pct}% em relação ao exame anterior." if pct > 0 else f"Queda de {abs(pct)}% em relação ao exame anterior."
                elif abs(pct) >= 20.0 and item["trend"] == "melhora":
                    item["alert"] = f"Evolução positiva: {abs(pct)}% de melhora em relação ao exame anterior."
            else:
                item["trend"] = "estavel"

        enriched.append(item)

    return enriched
