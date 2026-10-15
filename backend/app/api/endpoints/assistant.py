import json
import logging
from datetime import datetime, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser
from app.core.limiter import limiter
from app.core.security import decrypt_api_key
from app.db.models import (
    ApiConfiguration,
    ClinicalTest,
    DailyHabit,
    EngineMode,
    Medication,
    PhysicalEvolution,
)
from app.db.session import get_db
from app.schemas.assistant import (
    AssistantChatRequest,
    AssistantChatResponse,
    DoctorQuestionsResponse,
    ExecutiveSummaryResponse,
)
from app.services.biomarker_trends import calculate_biomarker_trends
from app.services.medication_interactions import analyze_medication_biomarker_interactions

logger = logging.getLogger("audit.assistant")

router = APIRouter(prefix="/assistant", tags=["assistant"])


def _build_health_context(user_id: int, user_name: str, height_cm: float | None, db: Session) -> dict[str, Any]:
    """Coleta o contexto recente de saúde para alimentar a IA."""
    physicals = (
        db.query(PhysicalEvolution)
        .filter(PhysicalEvolution.user_id == user_id)
        .order_by(PhysicalEvolution.recorded_at.desc())
        .limit(3)
        .all()
    )

    clinicals = (
        db.query(ClinicalTest)
        .filter(ClinicalTest.user_id == user_id)
        .order_by(ClinicalTest.recorded_at.desc())
        .limit(2)
        .all()
    )

    habits = (
        db.query(DailyHabit)
        .filter(DailyHabit.user_id == user_id)
        .order_by(DailyHabit.date.desc())
        .limit(7)
        .all()
    )

    latest_p = physicals[0] if physicals else None
    prev_p = physicals[1] if len(physicals) > 1 else None
    latest_imc = None
    if latest_p and latest_p.weight_kg and height_cm:
        height_m = height_cm / 100.0
        latest_imc = round(latest_p.weight_kg / (height_m * height_m), 1)

    latest_c = clinicals[0] if clinicals else None
    prev_c = clinicals[1] if len(clinicals) > 1 else None

    latest_markers = latest_c.extracted_data.get("markers", []) if latest_c and latest_c.extracted_data else []
    prev_markers = prev_c.extracted_data.get("markers", []) if prev_c and prev_c.extracted_data else []

    trends = calculate_biomarker_trends(latest_markers, prev_markers)

    delta_weight = (
        round(latest_p.weight_kg - prev_p.weight_kg, 1)
        if latest_p and prev_p and latest_p.weight_kg and prev_p.weight_kg
        else None
    )

    avg_water = (
        round(sum(h.water_ml for h in habits) / max(1, len(habits)), 1)
        if habits
        else 0.0
    )
    goal_days = sum(1 for h in habits if h.water_ml >= h.water_goal_ml)

    # medicamentos e suplementos ativos do usuario
    medications = (
        db.query(Medication)
        .filter(Medication.user_id == user_id, Medication.is_active.is_(True))
        .all()
    )
    med_list = [
        {"name": m.name, "dosage": m.dosage, "frequency": m.frequency, "category": m.category}
        for m in medications
    ]
    interactions = analyze_medication_biomarker_interactions(trends, medications)

    return {
        "user_name": user_name,
        "height_cm": height_cm,
        "latest_physical": {
            "date": latest_p.recorded_at.isoformat() if latest_p else None,
            "weight_kg": latest_p.weight_kg if latest_p else None,
            "delta_weight_kg": delta_weight,
            "body_fat_pct": latest_p.body_fat_pct if latest_p else None,
            "muscle_mass_kg": latest_p.muscle_mass_kg if latest_p else None,
            "waist_cm": latest_p.waist_cm if latest_p else None,
            "imc": latest_imc,
            "ai_analysis": latest_p.ai_analysis if latest_p else None,
        },
        "latest_clinical": {
            "date": latest_c.recorded_at.isoformat() if latest_c else None,
            "is_validated": latest_c.is_validated if latest_c else None,
            "markers": trends,
        },
        "habits": {
            "average_water_ml": avg_water,
            "goal_reached_days": goal_days,
            "days_logged": len(habits),
        },
        "active_medications": med_list,
        "pharmacological_alerts": interactions,
    }


def _local_rule_based_response(message: str, context: dict[str, Any]) -> str:
    """Gera uma resposta inteligente local com base nas regras do histórico."""
    msg_lower = message.lower()
    p = context.get("latest_physical", {})
    c = context.get("latest_clinical", {})
    markers: list[dict[str, Any]] = c.get("markers", [])

    if any(k in msg_lower for k in ["colesterol", "ldl", "hdl", "triglicer"]):
        lipid_markers = [m for m in markers if any(x in m["name"].lower() for x in ["colesterol", "hdl", "ldl", "triglicer"])]
        if lipid_markers:
            lines = [f"• **{m['name']}**: {m['value']} {m['unit']} (Ref: {m.get('reference_range') or '—'}) — Status: {m.get('status') or 'normal'}" for m in lipid_markers]
            return (
                "Aqui está o resumo do seu **Perfil Lipídico** com base no seu último exame:\n\n"
                + "\n".join(lines)
                + "\n\n💡 *Dica*: Manter atividade aeróbica regular e uma dieta equilibrada em gorduras insaturadas ajuda a elevar o HDL e controlar o LDL e triglicerídeos."
            )
        return "Não encontrei exames com dados de colesterol ou perfil lipídico cadastrados recentemente no seu histórico."

    if any(k in msg_lower for k in ["peso", "imc", "gordura", "físico", "músculo", "evolução"]):
        if p.get("weight_kg"):
            return (
                f"Aqui estão suas medições físicas mais recentes:\n\n"
                f"• **Peso atual**: {p.get('weight_kg')} kg\n"
                f"• **IMC**: {p.get('imc') or '—'}\n"
                f"• **% de Gordura**: {p.get('body_fat_pct') or '—'}%\n"
                f"• **Massa Muscular**: {p.get('muscle_mass_kg') or '—'} kg\n\n"
                "Acompanhe suas pesagens semanalmente no mesmo horário para melhor precisão nas tendências!"
            )
        return "Ainda não há medições físicas cadastradas no seu perfil."

    if any(k in msg_lower for k in ["resumo", "geral", "saúde", "como estou", "exames"]):
        res = ["Aqui está o panorama geral da sua saúde:\n"]
        if p.get("weight_kg"):
            res.append(f"🏋️ **Físico**: Peso {p.get('weight_kg')} kg | IMC {p.get('imc') or '—'}")
        if markers:
            anormais = [m for m in markers if m.get("status") in ["alto", "baixo"]]
            if anormais:
                res.append(f"🧪 **Exames laboratoriais**: {len(markers)} marcadores analisados ({len(anormais)} com atenção: {', '.join(m['name'] for m in anormais)}).")
            else:
                res.append(f"🧪 **Exames laboratoriais**: {len(markers)} marcadores cadastrados, todos dentro dos limites normais.")
        else:
            res.append("🧪 **Exames laboratoriais**: Nenhum exame recente cadastrado.")
        res.append("\nPosso detalhar qualquer um dos seus biomarcadores ou medições se desejar!")
        return "\n".join(res)

    return (
        "Olá! Sou sua assistente de saúde pessoal. Tenho acesso ao seu histórico de evolução física e aos seus exames laboratoriais cadastrados.\n\n"
        "Você pode me perguntar sobre:\n"
        "• Como estão seus níveis de colesterol e glicemia\n"
        "• Resumo do seu IMC e composição corporal\n"
        "• Variações em relação aos exames anteriores"
    )


@router.post("/chat", response_model=AssistantChatResponse)
@limiter.limit("15/minute")
def chat_with_assistant(
    request: Request,
    payload: AssistantChatRequest,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    """
    Interage com o assistente de IA contextualizado com o histórico de saúde do usuário.
    Usa OpenAI/Gemini se configurado ou o motor inteligente local.
    """
    context = _build_health_context(current_user.id, current_user.name, current_user.height_cm, db)

    # Busca configuração de IA ativa
    config = (
        db.query(ApiConfiguration)
        .filter(ApiConfiguration.user_id == current_user.id, ApiConfiguration.is_active.is_(True))
        .order_by(ApiConfiguration.updated_at.desc())
        .first()
    )

    # Se engine for LLM com API key descriptografada
    if config and config.engine_mode == EngineMode.LLM and config.api_key:
        api_key = decrypt_api_key(config.api_key)
        if api_key:
            try:
                from openai import OpenAI

                # timeout e retries evitam travar o request se o provedor externo demorar
                client_kwargs: dict[str, Any] = {"api_key": api_key, "timeout": 30.0, "max_retries": 2}
                if config.base_url:
                    client_kwargs["base_url"] = config.base_url

                client = OpenAI(**client_kwargs)

                system_prompt = (
                    "Você é a Assistente de Saúde do aplicativo 'Sistema Saúde'. "
                    "Seu papel é responder dúvidas de forma acolhedora, científica, clara e educativa.\n\n"
                    f"DADOS DO PACIENTE ({current_user.name}):\n"
                    f"{json.dumps(context, ensure_ascii=False, indent=2)}\n\n"
                    "DIRETRIZES FUNDAMENTAIS:\n"
                    "1. Use os dados acima para responder especificamente sobre o progresso e exames do usuário.\n"
                    "2. Explique termos laboratoriais em linguagem clara.\n"
                    "3. Destaque melhorias e alerte com empatia sobre valores fora do padrão de referência.\n"
                    "4. NUNCA faça prescrições de medicamentos ou diagnósticos definitivos.\n"
                    "5. Sempre oriente a validação com um médico ou profissional de saúde qualificado."
                )

                messages = [{"role": "system", "content": system_prompt}]
                for msg in payload.conversation_history[-6:]:
                    messages.append({"role": msg.role, "content": msg.content})
                messages.append({"role": "user", "content": payload.message})

                model = config.model_name or "gpt-4o-mini"
                completion = client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=0.7,
                    max_tokens=800,
                )

                reply_text = completion.choices[0].message.content or "Não foi possível gerar a resposta."

                logger.info({"event": "assistant_chat_llm_success", "user_id": current_user.id, "model": model})
                return AssistantChatResponse(
                    reply=reply_text,
                    context_used=context,
                    timestamp=datetime.now(timezone.utc),
                )

            except Exception as exc:
                logger.warning({"event": "assistant_llm_failed_fallback_local", "user_id": current_user.id, "error": str(exc)})
                # Degradação graciosa para regras locais

    # Fallback local inteligente
    reply = _local_rule_based_response(payload.message, context)
    return AssistantChatResponse(
        reply=reply,
        context_used=context,
        timestamp=datetime.now(timezone.utc),
    )


# GERA RESUMO EXECUTIVO DE SAUDE
@router.get("/executive-summary", response_model=ExecutiveSummaryResponse)
@limiter.limit("15/minute")
def get_executive_summary(
    request: Request,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        context = _build_health_context(current_user.id, current_user.name, current_user.height_cm, db)
        p = context.get("latest_physical", {})
        c = context.get("latest_clinical", {})
        h = context.get("habits", {})
        markers: list[dict[str, Any]] = c.get("markers", [])

        # verifica configuracao llm ativa
        config = (
            db.query(ApiConfiguration)
            .filter(ApiConfiguration.user_id == current_user.id, ApiConfiguration.is_active.is_(True))
            .order_by(ApiConfiguration.updated_at.desc())
            .first()
        )

        if config and config.engine_mode == EngineMode.LLM and config.api_key:
            api_key = decrypt_api_key(config.api_key)
            if api_key:
                try:
                    from openai import OpenAI
                    client_kwargs: dict[str, Any] = {"api_key": api_key, "timeout": 30.0, "max_retries": 2}
                    if config.base_url:
                        client_kwargs["base_url"] = config.base_url
                    client = OpenAI(**client_kwargs)

                    prompt = (
                        "Você é uma médica especialista em medicina preventiva e estilo de vida. "
                        "Analise os dados do paciente abaixo e retorne um JSON estrito contendo:\n"
                        "- summary_headline (string curta de manchete, máx 10 palavras)\n"
                        "- overall_status (string: 'otimo', 'estavel' ou 'atencao')\n"
                        "- physical_insights (string com análise do peso, gordura, massa e cintura)\n"
                        "- clinical_insights (string com análise dos exames de sangue e marcadores)\n"
                        "- habits_insights (string sobre a consistência de hidratação e rotina)\n"
                        "- action_plan (lista com 3 ações práticas recomendadas para a semana)\n\n"
                        f"DADOS DO PACIENTE:\n{json.dumps(context, ensure_ascii=False)}"
                    )

                    completion = client.chat.completions.create(
                        model=config.model_name or "gpt-4o-mini",
                        messages=[{"role": "user", "content": prompt}],
                        response_format={"type": "json_object"},
                        temperature=0.4,
                    )
                    content = completion.choices[0].message.content
                    if content:
                        parsed = json.loads(content)
                        return ExecutiveSummaryResponse(
                            summary_headline=parsed.get("summary_headline", "Resumo de saúde atualizado"),
                            overall_status=parsed.get("overall_status", "estavel"),
                            physical_insights=parsed.get("physical_insights", "Dados físicos em acompanhamento."),
                            clinical_insights=parsed.get("clinical_insights", "Exames laboratoriais registrados."),
                            habits_insights=parsed.get("habits_insights", "Rotina de hábitos monitorada."),
                            action_plan=parsed.get("action_plan", ["Manter pesagens regulares.", "Beber água com frequência."]),
                        )
                except Exception as exc:
                    logger.warning({"event": "executive_summary_llm_fallback", "user_id": current_user.id, "error": str(exc)})

        # motor de sintese local inteligente
        abnormal = [m for m in markers if m.get("status") in ["alto", "baixo"]]

        if abnormal:
            headline = f"Atenção a {len(abnormal)} biomarcador(es) laboratoriais com monitoramento ativo"
            status_str = "atencao"
            clinical_text = f"Identificamos alterações que requerem acompanhamento: {', '.join(m['name'] for m in abnormal)}. Os demais exames encontram-se dentro das faixas normais."
        elif markers:
            headline = "Excelente perfil laboratorial com biomarcadores dentro da meta"
            status_str = "otimo"
            clinical_text = f"Todos os {len(markers)} biomarcadores analisados no seu laudo mais recente estão normais e saudáveis."
        else:
            headline = "Acompanhamento geral de saúde em andamento"
            status_str = "estavel"
            clinical_text = "Nenhum laudo laboratorial recente registrado. Considere anexar seus exames de sangue periódicos."

        if p.get("weight_kg"):
            delta_w = p.get("delta_weight_kg")
            delta_str = f" ({'+' if delta_w and delta_w > 0 else ''}{delta_w} kg na última semana)" if delta_w is not None else ""
            physical_text = f"Peso atual registrado em {p.get('weight_kg')} kg{delta_str}. IMC calculado em {p.get('imc') or '—'}. Gordura corporal em {p.get('body_fat_pct') or '—'}%."
        else:
            physical_text = "Sem registros antropométricos recentes. Registre sua pesagem semanal para ativar projeções."

        avg_w = h.get("average_water_ml", 0)
        goal_d = h.get("goal_reached_days", 0)
        habits_text = f"Consumo médio de água nos últimos 7 dias: {int(avg_w)} ml/dia. Meta atingida em {goal_d} dia(s)."

        actions = [
            "Manter hidratação adequada de ao menos 2.500 ml diários.",
            "Realizar nova pesagem semanal e registro de fotos no mesmo horário em jejum.",
        ]
        if abnormal:
            actions.append(f"Apresentar ao seu médico os resultados alterados ({', '.join(m['name'] for m in abnormal[:3])}).")
        else:
            actions.append("Manter consistência nos treinos aeróbicos e de força para longevidade muscular.")

        return ExecutiveSummaryResponse(
            summary_headline=headline,
            overall_status=status_str,
            physical_insights=physical_text,
            clinical_insights=clinical_text,
            habits_insights=habits_text,
            action_plan=actions,
        )

    except Exception as exc:
        logger.error({"event": "executive_summary_error", "user_id": current_user.id, "error": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="erro ao gerar resumo executivo",
        )


# GERA PERGUNTAS PARA CONSULTA MEDICA COM BASE NOS EXAMES
@router.get("/doctor-questions", response_model=DoctorQuestionsResponse)
@limiter.limit("15/minute")
def get_doctor_questions(
    request: Request,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        context = _build_health_context(current_user.id, current_user.name, current_user.height_cm, db)
        c = context.get("latest_clinical", {})
        p = context.get("latest_physical", {})
        markers: list[dict[str, Any]] = c.get("markers", [])

        abnormal = [m for m in markers if m.get("status") in ["alto", "baixo"]]
        abnormal_names = [m["name"] for m in abnormal]

        # verifica configuracao llm ativa
        config = (
            db.query(ApiConfiguration)
            .filter(ApiConfiguration.user_id == current_user.id, ApiConfiguration.is_active.is_(True))
            .order_by(ApiConfiguration.updated_at.desc())
            .first()
        )

        if config and config.engine_mode == EngineMode.LLM and config.api_key:
            api_key = decrypt_api_key(config.api_key)
            if api_key:
                try:
                    from openai import OpenAI
                    client_kwargs: dict[str, Any] = {"api_key": api_key, "timeout": 30.0, "max_retries": 2}
                    if config.base_url:
                        client_kwargs["base_url"] = config.base_url
                    client = OpenAI(**client_kwargs)

                    prompt = (
                        "Você é uma consultora de saúde orientando um paciente a aproveitar sua consulta médica. "
                        "Com base nas alterações laboratoriais e histórico físico abaixo, formule de 3 a 5 perguntas objetivas, "
                        "médicas e empáticas para o paciente fazer ao médico durante a consulta.\n"
                        "Retorne em formato JSON estrito: {\"questions\": [\"pergunta 1\", \"pergunta 2\", ...]}\n\n"
                        f"DADOS DO PACIENTE:\n{json.dumps(context, ensure_ascii=False)}"
                    )

                    completion = client.chat.completions.create(
                        model=config.model_name or "gpt-4o-mini",
                        messages=[{"role": "user", "content": prompt}],
                        response_format={"type": "json_object"},
                        temperature=0.5,
                    )
                    content = completion.choices[0].message.content
                    if content:
                        parsed = json.loads(content)
                        return DoctorQuestionsResponse(
                            questions=parsed.get("questions", []),
                            abnormal_markers_found=abnormal_names,
                        )
                except Exception as exc:
                    logger.warning({"event": "doctor_questions_llm_fallback", "user_id": current_user.id, "error": str(exc)})

        # gerador inteligente local de perguntas com base nas regras clínicas
        questions: list[str] = []
        for m in abnormal:
            name_lower = m["name"].lower()
            if "glicem" in name_lower or "hba1c" in name_lower:
                questions.append(
                    f"Meu exame apontou {m['name']} em {m['value']} {m['unit']}. Seria recomendável dosar Hemoglobina Glicada ou curva glicêmica para avaliar resistência à insulina?"
                )
            elif "ldl" in name_lower or "colesterol" in name_lower or "triglic" in name_lower:
                questions.append(
                    f"Considerando meu {m['name']} ({m['value']} {m['unit']}), qual é a minha meta de risco cardiovascular e seriam necessárias intervenções nutricionais ou medicamentosas?"
                )
            elif "vitamina d" in name_lower:
                questions.append(
                    f"Minha Vitamina D está em {m['value']} {m['unit']}. Qual a posologia recomendada de suplementação de colecalciferol para atingir a faixa ideal?"
                )
            elif "tsh" in name_lower or "t4" in name_lower:
                questions.append(
                    f"Houve alteração no {m['name']} ({m['value']}). Vale a pena investigar anticorpos antitireoidianos para descartar alterações subclínicas?"
                )
            elif "creatin" in name_lower or "ureia" in name_lower:
                questions.append(
                    f"Como está minha taxa de filtração renal estimada (eGFR) com base na creatinina de {m['value']} {m['unit']} e há necessidade de ajuste de hidratação ou dieta?"
                )
            else:
                questions.append(
                    f"O que significa a alteração no marcador {m['name']} ({m['value']} {m['unit']}) e que fatores podem estar influenciando esse resultado?"
                )

        if p.get("waist_cm") and current_user.height_cm:
            rcest = round(p["waist_cm"] / current_user.height_cm, 2)
            if rcest >= 0.50:
                questions.append(
                    f"Minha relação cintura-estatura atual ({rcest}) sinaliza adiposidade central. Quais cuidados preventivos cardiovasculares devemos priorizar?"
                )

        # questoes prioritarias de interacao com medicamentos e suplementos
        for alert in context.get("pharmacological_alerts", []):
            questions.insert(
                0,
                f"Estou tomando {alert['medication']}: isso pode ter influenciado o resultado de {alert['marker']}? Devo manter ou ajustar a dose?",
            )

        if not questions:
            questions = [
                "Considerando que meus exames gerais estão normais, qual a periodicidade recomendada para meu próximo check-up?",
                "Há algum exame complementar preventivo que seria oportuno dosar com base na minha idade e estilo de vida?",
                "Minha evolução de peso e composição corporal atual estão alinhadas com minhas metas metabólicas de longo prazo?",
            ]

        return DoctorQuestionsResponse(
            questions=questions[:5],
            abnormal_markers_found=abnormal_names,
        )

    except Exception as exc:
        logger.error({"event": "doctor_questions_error", "user_id": current_user.id, "error": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="erro ao gerar perguntas para consulta médica",
        )

