from __future__ import annotations
from typing import Literal, List, Optional
from pydantic import BaseModel, Field, field_validator

class PatientFeatures(BaseModel):
    """Características clínicas de entrada para o modelo de ML."""
    idade: float = Field(ge=0, le=120)
    freq_cardiaca: float = Field(ge=30, le=220)
    spo2: float = Field(ge=70, le=100)
    carga_sistema: float = Field(ge=0, le=100)
    disponibilidade_recursos: float = Field(ge=0, le=100)

class IoTTelemetry(BaseModel):
    """Telemetria recebida do dispositivo ESP32 via MicroPython."""
    paciente_id: str = "default_patient"
    freq_cardiaca: float = Field(ge=30, le=220)
    spo2: float = Field(ge=70, le=100)
    temperatura: float = Field(ge=10, le=50)

class CardiacDecision(BaseModel):
    """Saída final contendo a predição da IA e protocolos sugeridos."""
    probabilidade_pico_risco: float = Field(ge=0.0, le=1.0)
    classificacao_risco: Literal["baixo", "moderado", "alto", "critico"]
    protocolos_sugeridos: List[str] = Field(default=[])
    notas: Optional[str] = None

    @field_validator("probabilidade_pico_risco")
    @classmethod
    def round_prob(cls, v: float) -> float:
        return float(round(v, 4))

class LoginRequest(BaseModel):
    """Dados de autenticação."""
    username: str
    password: str

class LoginResponse(BaseModel):
    """Resposta de autenticação bem-sucedida."""
    token: str
    role: str
    username: str

class MessageRequest(BaseModel):
    """Requisição para envio de mensagem no chat."""
    session_id: str
    text: str

class MessageResponse(BaseModel):
    """Resposta para mensagem de chat."""
    session_id: str
    output: List[str]
    context: Optional[dict] = None

class SessionResponse(BaseModel):
    """Resposta para criação de sessão de chat."""
    session_id: str
    message: str
