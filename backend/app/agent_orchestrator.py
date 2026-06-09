import os
import json
import uuid
import logging
import asyncio
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, Any, List, Tuple
from app.schemas import PatientFeatures, CardiacDecision
from app.ml_service import predict_risk

logger = logging.getLogger(__name__)

# Tentar importar dependências do OpenAI Agents SDK
try:
    from agents import Agent, Runner
    from agents.extensions.handoff_prompt import RECOMMENDED_PROMPT_PREFIX
    HAS_AGENTS_SDK = True
except ImportError:
    HAS_AGENTS_SDK = False

LOGS_DIR = Path(__file__).resolve().parent.parent / "logs"

def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()

def validate_coherence(patient: PatientFeatures, decision: CardiacDecision) -> Tuple[bool, List[str]]:
    """Valida se o resultado de IA e protocolos sugeridos são coerentes."""
    detalhes: List[str] = []
    ok = True
    texto = " ".join(decision.protocolos_sugeridos).lower()

    if patient.spo2 <= 88:
        if "oxigen" not in texto and "spo2" not in texto:
            ok = False
            detalhes.append("SpO2 crítico (<=88): esperava menção a oxigenoterapia/monitorização de SpO2 nos protocolos.")

    if decision.probabilidade_pico_risco >= 0.75 and decision.classificacao_risco in ("baixo", "moderado"):
        ok = False
        detalhes.append("Alta probabilidade (>=0.75) incompatível com classificação baixa/moderada.")

    if decision.probabilidade_pico_risco < 0.35 and decision.classificacao_risco == "critico":
        ok = False
        detalhes.append("Probabilidade baixa (<0.35) incompatível com classificação crítica.")

    if not detalhes:
        detalhes.append("Nenhuma inconsistência simples detectada pelas regras configuradas.")

    return ok, detalhes

def record_governance(patient: PatientFeatures, decision: CardiacDecision) -> Dict[str, Any]:
    """Registra a decisão e validação de governança em um arquivo JSONL."""
    run_id = str(uuid.uuid4())
    coerencia_ok, coerencia_detalhes = validate_coherence(patient, decision)
    
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    log_file = LOGS_DIR / "decisoes_cardio_ia.jsonl"
    
    payload = {
        "run_id": run_id,
        "timestamp": _utc_now(),
        "paciente": patient.model_dump(),
        "decisao": decision.model_dump(),
        "coerencia": {"ok": coerencia_ok, "detalhes": coerencia_detalhes},
    }
    
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(json.dumps(payload, ensure_ascii=False) + "\n")
        
    return payload

def run_local_agent_fallback(patient: PatientFeatures) -> CardiacDecision:
    """Fallback local: Simula o processamento do analista e do especialista em protocolos."""
    # Executa o modelo local
    pred = predict_risk(patient)
    
    # Gera notas baseadas na governança e nos resultados
    prob = pred["probabilidade_pico_risco"]
    classe = pred["classificacao_risco"]
    
    notas = f"Triagem local executada. Risco {classe.upper()} com probabilidade de pico de {prob:.2%}. "
    if classe in ("alto", "critico") or patient.spo2 < 92:
        notas += "Alerta clínico emitido: Paciente necessita de priorização imediata e acompanhamento contínuo."
    else:
        notas += "Sinais vitais estáveis. Recomenda-se acompanhamento ambulatorial de rotina."

    return CardiacDecision(
        probabilidade_pico_risco=prob,
        classificacao_risco=classe,
        protocolos_sugeridos=pred["protocolos_sugeridos"],
        notas=notas
    )

async def execute_multiagent_pipeline(patient: PatientFeatures, enable_governance: bool = True) -> CardiacDecision:
    """Executa a triagem multiagente pela OpenAI se disponível; senão usa processamento local."""
    openai_key = os.environ.get("OPENAI_API_KEY")
    
    if HAS_AGENTS_SDK and openai_key:
        try:
            # Definição dinâmica do Especialista em Protocolos
            def consultar_protocolos_local(parametros_json: str) -> str:
                # Função de auxílio interna para a tool do agente
                from app.ml_service import load_protocols
                obj = json.loads(parametros_json)
                cls = obj["classificacao_risco"]
                spo2 = obj.get("spo2")
                protocols_data = load_protocols()
                base = list(protocols_data["por_classificacao"].get(cls, []))
                extras = []
                g = protocols_data.get("gatilhos_spo2", {})
                if spo2 is not None:
                    if spo2 <= g.get("critico", 88):
                        extras.append("Reforço de oxigenoterapia / reavaliação respiratória urgente (gatilho SpO2)")
                    elif spo2 < g.get("alerta", 92):
                        extras.append("Monitorar SpO2 de perto e considerar oxigenoterapia conforme evolução")
                return json.dumps({
                    "classificacao_risco": cls,
                    "todos_protocolos": base + extras
                }, ensure_ascii=False)

            def prever_risco_local(paciente_json: str) -> str:
                # Função de auxílio interna para a tool do agente
                data = json.loads(paciente_json)
                pat = PatientFeatures.model_validate(data)
                res = predict_risk(pat)
                return json.dumps(res, ensure_ascii=False)

            model = os.environ.get("CARDIO_AGENT_MODEL", "gpt-4o-mini")
            
            # Construir agentes
            from agents import function_tool
            tool_predict = function_tool(prever_risco_local)
            tool_protocols = function_tool(consultar_protocolos_local)

            protocol_specialist = Agent(
                name="Especialista em Protocolos",
                model=model,
                handoff_description="Cruza a classificação de risco com protocolos institucionais.",
                instructions=f"""{RECOMMENDED_PROMPT_PREFIX}
Você é o Especialista em Protocolos do CardioIA.
1) Extraia os resultados de risco retornados por `prever_risco_local`.
2) Chame a ferramenta `consultar_protocolos_local` passando a classificação de risco e SpO2 do paciente.
3) Preencha e retorne o formato estruturado CardiacDecision:
- probabilidade_pico_risco: a probabilidade numérica de pico do modelo (entre 0.0 e 1.0)
- classificacao_risco: a classe (baixo, moderado, alto, critico)
- protocolos_sugeridos: lista de strings dos protocolos retornados
- notas: notas objetivas da avaliação clínica integrando risco e protocolos
""",
                tools=[tool_protocols],
                output_type=CardiacDecision
            )

            risk_analyst = Agent(
                name="Analista de Risco",
                model=model,
                handoff_description="Calcula a probabilidade de pico de risco usando o modelo ML.",
                instructions=f"""{RECOMMENDED_PROMPT_PREFIX}
Você é o Analista de Risco do CardioIA.
1) Extraia os dados clínicos do usuário.
2) Chame `prever_risco_local` passando o JSON do paciente (idade, freq_cardiaca, spo2, carga_sistema, disponibilidade_recursos).
3) Realize o handoff para o Especialista em Protocolos, passando o resultado do modelo para que ele conclua.
""",
                tools=[tool_predict],
                handoffs=[protocol_specialist]
            )

            orchestrator = Agent(
                name="Orquestrador CardioIA",
                model=model,
                handoff_description="Coordena a triagem e transfere para o analista.",
                instructions=f"""{RECOMMENDED_PROMPT_PREFIX}
Você é o Orquestrador CardioIA. O usuário fornece dados em JSON. Delegue a tarefa ao Analista de Risco usando handoff.
""",
                handoffs=[risk_analyst]
            )

            # Executa com o Runner
            user_msg = f"Triagem completa para o paciente:\n{patient.model_dump_json()}"
            result = await Runner.run(orchestrator, user_msg)
            
            final_output = result.final_output
            if isinstance(final_output, CardiacDecision):
                if enable_governance:
                    record_governance(patient, final_output)
                return final_output
            
        except Exception as e:
            logger.error(f"Erro no pipeline multiagente OpenAI: {e}. Usando processamento local de fallback.")
            
    # Execução local como fallback
    decision = run_local_agent_fallback(patient)
    if enable_governance:
        record_governance(patient, decision)
    return decision
