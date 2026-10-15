from typing import Any


# ANALISA INTERACOES E CORRELACOES CLINICAS ENTRE MEDICAMENTOS E BIOMARCADORES
def analyze_medication_biomarker_interactions(
    markers: list[dict[str, Any]],
    medications: list[Any],
) -> list[dict[str, str]]:
    alerts: list[dict[str, str]] = []

    if not markers or not medications:
        return alerts

    # normaliza nomes de medicamentos e suplementos ativos
    active_meds = [m for m in medications if getattr(m, "is_active", True)]
    med_names = [getattr(m, "name", "").lower() for m in active_meds]

    def has_med(pattern: str) -> bool:
        return any(pattern in name for name in med_names)

    # mapeamento de marcadores por nome normalizado
    marker_map: dict[str, dict[str, Any]] = {}
    for m in markers:
        name = m.get("name", "").lower()
        marker_map[name] = m

    def find_marker(*aliases: str) -> dict[str, Any] | None:
        for alias in aliases:
            for k, val in marker_map.items():
                if alias in k:
                    return val
        return None

    # 1. creatina e creatinina
    if has_med("creatina"):
        creatinina = find_marker("creatinina")
        if creatinina and creatinina.get("status") in ("alto", "normal"):
            alerts.append({
                "marker": creatinina.get("name", "Creatinina"),
                "medication": "Creatina",
                "severity": "info",
                "message": (
                    "O uso ativo de suplementacao com Creatina pode elevar fisiologicamente a creatinina "
                    "serica sem implicar perda de funcao renal. Notifique o medico para avaliacao por cistatina C caso necessario."
                ),
            })

    # 2. estatinas e enzimas hepaticas ou musculares
    statin_found = any(s in name for name in med_names for s in ("estatina", "atorvastatina", "sinvastatina", "rosuvastatina"))
    if statin_found:
        cpk = find_marker("cpk", "creatina quinase")
        tgo = find_marker("tgo", "ast")
        tgp = find_marker("tgp", "alt")

        if (cpk and cpk.get("status") == "alto") or (tgo and tgo.get("status") == "alto") or (tgp and tgp.get("status") == "alto"):
            alerts.append({
                "marker": "CPK / Transaminases",
                "medication": "Estatina",
                "severity": "alerta",
                "message": (
                    "Enzimas hepaticas ou musculares elevadas em paciente utilizando estatina. "
                    "Recomenda-se acompanhamento clinico para afastar miopatia ou sobrecarga hepatica."
                ),
            })

    # 3. vitamina d suplementada e niveis sericos
    if has_med("vitamina d") or has_med("colecalciferol"):
        vit_d = find_marker("vitamina d", "25-hidroxi", "calcidiol")
        if vit_d:
            val = vit_d.get("value")
            try:
                num = float(str(val).replace(",", "."))
                if num >= 70 or vit_d.get("status") == "alto":
                    alerts.append({
                        "marker": vit_d.get("name", "Vitamina D"),
                        "medication": "Suplemento de Vitamina D",
                        "severity": "atencao",
                        "message": (
                            f"Vitamina D serica em patamar elevado ({num} ng/mL) com suplementacao ativa. "
                            "Verifique com o medico a necessidade de reduzir a dose de manutencao para evitar hipercalcemia."
                        ),
                    })
            except (ValueError, TypeError):
                pass

    # 4. suplemento de ferro e ferritina
    if has_med("ferro") or has_med("sulfato ferroso"):
        ferritina = find_marker("ferritina")
        if ferritina and ferritina.get("status") == "alto":
            alerts.append({
                "marker": ferritina.get("name", "Ferritina"),
                "medication": "Suplemento de Ferro",
                "severity": "atencao",
                "message": (
                    "Ferritina elevada concomitantemente ao uso continuo de suplemento de ferro. "
                    "Monitorar niveis para prevenir acumulo ou sobrecarga tecidual de ferro."
                ),
            })

    # 5. levotiroxina e tsh
    if has_med("levotiroxina") or has_med("puran") or has_med("euthyrox"):
        tsh = find_marker("tsh")
        if tsh and tsh.get("status") in ("alto", "baixo"):
            alerts.append({
                "marker": tsh.get("name", "TSH"),
                "medication": "Levotiroxina",
                "severity": "alerta",
                "message": (
                    f"TSH fora da faixa ideal ({tsh.get('status')}) sob reposicao de hormonio tireoidiano. "
                    "Indica provavel necessidade de ajuste na dosagem pelo medico endocrinologista."
                ),
            })

    return alerts
