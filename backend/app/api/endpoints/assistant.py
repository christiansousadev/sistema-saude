import json
import logging
from datetime import datetime, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser
from app.core.limiter import limiter
from app.core.security import decrypt_api_key
from app.db.models import ApiConfiguration, ClinicalTest, EngineMode, PhysicalEvolution
from app.db.session import get_db
from app.schemas.assistant import AssistantChatRequest, AssistantChatResponse
from app.services.biomarker_trends import calculate_biomarker_trends

logger = logging.getLogger("audit.llm_service")

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

    latest_p = physicals[0] if physicals else None
    latest_imc = None
    if latest_p and latest_p.weight_kg and height_cm:
        height_m = height_cm / 100.0
        latest_imc = round(latest_p.weight_kg / (height_m * height_m), 1)

    latest_c = clinicals[0] if clinicals else None
    prev_c = clinicals[1] if len(clinicals) > 1 else None

    latest_markers = latest_c.extracted_data.get("markers", []) if latest_c and latest_c.extracted_data else []
    prev_markers = prev_c.extracted_data.get("markers", []) if prev_c and prev_c.extracted_data else []

    trends = calculate_biomarker_trends(latest_markers, prev_markers)

    return {
        "user_name": user_name,
        "height_cm": height_cm,
        "latest_physical": {
            "date": latest_p.recorded_at.isoformat() if latest_p else None,
            "weight_kg": latest_p.weight_kg if latest_p else None,
            "body_fat_pct": latest_p.body_fat_pct if latest_p else None,
            "muscle_mass_kg": latest_p.muscle_mass_kg if latest_p else None,
            "imc": latest_imc,
            "ai_analysis": latest_p.ai_analysis if latest_p else None,
        },
        "latest_clinical": {
            "date": latest_c.recorded_at.isoformat() if latest_c else None,
            "is_validated": latest_c.is_validated if latest_c else None,
            "markers": trends,
        },
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
