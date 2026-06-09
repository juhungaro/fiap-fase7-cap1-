import time
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException, BackgroundTasks
from app.schemas import (
    LoginRequest, LoginResponse, 
    MessageRequest, MessageResponse, SessionResponse,
    IoTTelemetry, PatientFeatures, CardiacDecision
)
from app.chat_service import ChatbotManager
from app.ml_service import predict_risk
from app.agent_orchestrator import execute_multiagent_pipeline

router = APIRouter()
chatbot_manager = ChatbotManager()

# Banco de dados fictício em memória para simulação
# Dados padrão do paciente de teste
patient_profile = {
    "paciente_id": "default_patient",
    "nome": "João da Silva",
    "idade": 72.0,
    "carga_sistema": 60.0,
    "disponibilidade_recursos": 40.0
}

# Histórico de leituras IoT (BPM, SpO2, temperatura, timestamp)
telemetry_history: List[Dict[str, Any]] = [
    # Valores iniciais de histórico para popular os gráficos no primeiro carregamento
    {"freq_cardiaca": 75.0, "spo2": 98.0, "temperatura": 36.5, "timestamp": time.time() - 300},
    {"freq_cardiaca": 78.0, "spo2": 97.0, "temperatura": 36.6, "timestamp": time.time() - 240},
    {"freq_cardiaca": 82.0, "spo2": 96.0, "temperatura": 36.7, "timestamp": time.time() - 180},
    {"freq_cardiaca": 85.0, "spo2": 95.0, "temperatura": 36.8, "timestamp": time.time() - 120},
    {"freq_cardiaca": 80.0, "spo2": 96.0, "temperatura": 36.6, "timestamp": time.time() - 60},
]

# Risco calculado na última telemetria
last_risk_assessment = {
    "probabilidade_pico_risco": 0.15,
    "classificacao_risco": "baixo",
    "protocolos_sugeridos": ["Monitorização clínica de rotina", "Orientar sinais de alarme e retorno ambulatorial"],
    "timestamp": time.time()
}

@router.post("/auth/login", response_model=LoginResponse)
async def login(body: LoginRequest) -> LoginResponse:
    """Validação de fluxo de login para interfaces Web/Mobile."""
    # Aceita qualquer login para fins de simulação/MVP, com token mockado
    username = body.username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="Usuário não pode ser vazio")
    
    role = "medico" if "medico" in username.lower() or "doc" in username.lower() else "paciente"
    return LoginResponse(
        token=f"mock_token_{role}_{int(time.time())}",
        role=role,
        username=username
    )

@router.post("/chat/session", response_model=SessionResponse)
async def create_chat_session() -> SessionResponse:
    """Cria uma nova sessão de conversa para o Chatbot."""
    sid = chatbot_manager.create_session()
    return SessionResponse(
        session_id=sid,
        message="Olá! Sou o assistente CardioIA. Iniciamos uma nova sessão de atendimento conversacional inteligente."
    )

@router.post("/chat/message", response_model=MessageResponse)
async def send_chat_message(body: MessageRequest) -> MessageResponse:
    """Envia mensagem ao Chatbot e retorna a resposta."""
    output = chatbot_manager.send_message(body.session_id, body.text)
    return MessageResponse(
        session_id=body.session_id,
        output=output
    )

@router.post("/iot/data")
async def receive_iot_data(telemetry: IoTTelemetry):
    """Recebe dados em tempo real enviados pelo ESP32 (MicroPython)."""
    global last_risk_assessment
    
    # Adiciona leitura ao histórico em memória
    reading = {
        "freq_cardiaca": telemetry.freq_cardiaca,
        "spo2": telemetry.spo2,
        "temperatura": telemetry.temperatura,
        "timestamp": time.time()
    }
    telemetry_history.append(reading)
    
    # Limita o histórico em memória para as últimas 50 leituras
    if len(telemetry_history) > 50:
        telemetry_history.pop(0)
        
    # Combina telemetria dinâmica com dados estáticos do perfil do paciente
    features = PatientFeatures(
        idade=patient_profile["idade"],
        freq_cardiaca=telemetry.freq_cardiaca,
        spo2=telemetry.spo2,
        carga_sistema=patient_profile["carga_sistema"],
        disponibilidade_recursos=patient_profile["disponibilidade_recursos"]
    )
    
    # Executa o modelo de ML local instantâneo
    risk = predict_risk(features)
    
    # Atualiza o último cálculo de risco
    last_risk_assessment = {
        "probabilidade_pico_risco": risk["probabilidade_pico_risco"],
        "classificacao_risco": risk["classificacao_risco"],
        "protocolos_sugeridos": risk["protocolos_sugeridos"],
        "timestamp": time.time()
    }
    
    return {
        "status": "success",
        "message": "Telemetria recebida e processada com sucesso",
        "risk_assessment": last_risk_assessment
    }

@router.get("/patients/dashboard")
async def get_patient_dashboard():
    """Retorna dados agregados para preenchimento dos painéis na UI."""
    last_telemetry = telemetry_history[-1] if telemetry_history else {
        "freq_cardiaca": 0, "spo2": 0, "temperatura": 0, "timestamp": 0
    }
    
    return {
        "profile": patient_profile,
        "last_telemetry": last_telemetry,
        "risk_assessment": last_risk_assessment,
        "telemetry_history": telemetry_history[-20:] # Retorna últimas 20 leituras para os gráficos
    }

@router.post("/patients/setup")
async def setup_patient_profile(data: Dict[str, Any]):
    """Permite configurar perfil do paciente a partir da interface para fins de teste."""
    global patient_profile, last_risk_assessment
    
    if "idade" in data:
        patient_profile["idade"] = float(data["idade"])
    if "carga_sistema" in data:
        patient_profile["carga_sistema"] = float(data["carga_sistema"])
    if "disponibilidade_recursos" in data:
        patient_profile["disponibilidade_recursos"] = float(data["disponibilidade_recursos"])
    if "nome" in data:
        patient_profile["nome"] = str(data["nome"])
        
    # Recalcula risco com a última telemetria
    if telemetry_history:
        last = telemetry_history[-1]
        features = PatientFeatures(
            idade=patient_profile["idade"],
            freq_cardiaca=last["freq_cardiaca"],
            spo2=last["spo2"],
            carga_sistema=patient_profile["carga_sistema"],
            disponibilidade_recursos=patient_profile["disponibilidade_recursos"]
        )
        risk = predict_risk(features)
        last_risk_assessment = {
            "probabilidade_pico_risco": risk["probabilidade_pico_risco"],
            "classificacao_risco": risk["classificacao_risco"],
            "protocolos_sugeridos": risk["protocolos_sugeridos"],
            "timestamp": time.time()
        }
        
    return {"status": "success", "profile": patient_profile, "risk_assessment": last_risk_assessment}

@router.post("/patients/analyze", response_model=CardiacDecision)
async def analyze_patient_triagem():
    """Aciona a orquestração multiagente da Fase 6 para triagem médica oficial."""
    # Pega os dados mais recentes do paciente
    last_telemetry = telemetry_history[-1] if telemetry_history else {
        "freq_cardiaca": 80.0, "spo2": 95.0
    }
    
    patient = PatientFeatures(
        idade=patient_profile["idade"],
        freq_cardiaca=last_telemetry["freq_cardiaca"],
        spo2=last_telemetry["spo2"],
        carga_sistema=patient_profile["carga_sistema"],
        disponibilidade_recursos=patient_profile["disponibilidade_recursos"]
    )
    
    # Roda a orquestração multiagente em segundo plano/síncrono
    decision = await execute_multiagent_pipeline(patient, enable_governance=True)
    return decision
