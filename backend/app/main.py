import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Carregar variáveis de ambiente no startup
load_dotenv()

from app.routes import router
from app.ml_service import load_ml_model, load_protocols

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Ciclo de vida do FastAPI: pré-carrega os artefatos de IA e protocolos."""
    print("Iniciando CardioIA Backend...")
    try:
        load_ml_model()
        print("Modelo de Machine Learning carregado com sucesso.")
    except Exception as e:
        print(f"Alerta: Erro ao pré-carregar modelo de ML (carregamento sob demanda ativo): {e}")
        
    try:
        load_protocols()
        print("Protocolos médicos carregados com sucesso.")
    except Exception as e:
        print(f"Alerta: Erro ao carregar protocolos médicos: {e}")
        
    yield
    print("Encerrando CardioIA Backend...")

app = FastAPI(
    title="CardioIA - API Integrada",
    description="API do ecossistema final da CardioIA (Fase 7), integrando IoT, ML e Chatbot.",
    version="2.0.0",
    lifespan=lifespan
)

# Configuração de CORS para permitir conexões do Frontend Web e do Mobile Expo
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclui as rotas
app.include_router(router, prefix="/api")

@app.get("/")
def read_root():
    return {
        "status": "online",
        "api": "CardioIA API",
        "version": "2.0.0",
        "documentation": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    # Permite rodar diretamente via python -m app.main
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
