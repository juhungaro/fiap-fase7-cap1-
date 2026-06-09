import os
import json
import joblib
import pandas as pd
from pathlib import Path
from typing import Any, Dict, List
from app.schemas import PatientFeatures

# Caminho para carregar o modelo e os protocolos
ROOT_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = ROOT_DIR / "artifacts" / "cardio_pico_risco_artifact.joblib"
PROTOCOLS_PATH = ROOT_DIR / "data" / "protocolos_medicos.json"

_loaded_model_artifact = None
_loaded_protocols = None

def load_ml_model() -> Any:
    global _loaded_model_artifact
    if _loaded_model_artifact is None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(f"Artefato do modelo de ML não encontrado em {MODEL_PATH}")
        _loaded_model_artifact = joblib.load(MODEL_PATH)
    return _loaded_model_artifact

def load_protocols() -> Dict[str, Any]:
    global _loaded_protocols
    if _loaded_protocols is None:
        if not PROTOCOLS_PATH.exists():
            # Fallback em caso de arquivo não encontrado
            return {
                "por_classificacao": {
                    "baixo": ["Monitorização clínica de rotina", "Orientar sinais de alarme e retorno ambulatorial"],
                    "moderado": ["Monitorização contínua não invasiva", "Avaliação laboratorial dirigida"],
                    "alto": ["Monitorização em ambiente semi-intensivo", "Oxigenoterapia se necessário", "Notificar equipe"],
                    "critico": ["Monitorização invasiva", "Suporte ventilatório imediato", "Alocação prioritária de leito UT"]
                },
                "gatilhos_spo2": {"critico": 88, "alerta": 92}
            }
        with open(PROTOCOLS_PATH, "r", encoding="utf-8") as f:
            _loaded_protocols = json.load(f)
    return _loaded_protocols

def classificar_risco(prob: float) -> str:
    if prob < 0.30:
        return "baixo"
    elif prob < 0.55:
        return "moderado"
    elif prob < 0.75:
        return "alto"
    return "critico"

def predict_risk(patient: PatientFeatures) -> Dict[str, Any]:
    """Usa o modelo carregado para classificar o risco de pico do paciente."""
    artifact = load_ml_model()
    model = artifact["model"]
    features: List[str] = artifact["features"]
    
    # Criar DataFrame com as características na ordem esperada pelo modelo
    row = pd.DataFrame([[getattr(patient, f) for f in features]], columns=features)
    
    # Prever probabilidade e classe
    proba = float(model.predict_proba(row)[0][1])
    classe = classificar_risco(proba)
    
    # Buscar protocolos
    protocols_data = load_protocols()
    protocols = protocols_data["por_classificacao"].get(classe, [])
    
    # Adicionar gatilho extra por SpO2 se necessário
    if patient.spo2 <= protocols_data.get("gatilhos_spo2", {}).get("critico", 88):
        protocols.append("Gatilho Extra SpO2 Crítico: Oxigenoterapia imediata de alto fluxo e monitorização de gasometria")
    elif patient.spo2 <= protocols_data.get("gatilhos_spo2", {}).get("alerta", 92):
        protocols.append("Gatilho Extra SpO2 Alerta: Avaliar necessidade de suporte de oxigênio de baixo fluxo")

    return {
        "probabilidade_pico_risco": proba,
        "classificacao_risco": classe,
        "protocolos_sugeridos": list(dict.fromkeys(protocols)) # remover duplicados preservando ordem
    }
