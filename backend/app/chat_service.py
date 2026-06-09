import os
import logging
import uuid
import unicodedata
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

# Tenta importar as bibliotecas se disponíveis
try:
    from ibm_watson import AssistantV2, AssistantV1
    from ibm_cloud_sdk_core.authenticators import IAMAuthenticator
    HAS_WATSON = True
except ImportError:
    HAS_WATSON = False

try:
    from openai import OpenAI
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False

def _normalize(t: str) -> str:
    """Remove acentos e coloca em minúsculo."""
    t = (t or "").lower().strip()
    return "".join(c for c in unicodedata.normalize("NFD", t) if unicodedata.category(c) != "Mn")

def _get_local_fallback_response(text: str) -> List[str]:
    """Respostas simuladas locais baseadas em regras de sintomas e orientação."""
    lower = text.lower()
    normal = _normalize(text)
    
    if any(s in normal for s in ("oi", "ola", "bom dia", "boa tarde", "boa noite", "e ai", "oie", "comecar")):
        return ["Olá! Sou o assistente inteligente CardioIA. Como posso ajudar no seu monitoramento cardíaco hoje?"]
    
    dor_peito = "dor no peito" in lower or "angina" in lower
    suor_frio = "suor frio" in lower or "suor" in lower
    falta_ar = "falta de ar" in lower or "cansaco" in lower
    palpitacao = "palpitacao" in lower or "palpitação" in lower or "batedeira" in lower
    
    if dor_peito and (suor_frio or falta_ar):
        return [
            "Atenção: Dor no peito acompanhada de suor frio ou falta de ar pode ser um sintoma de infarto. "
            "Recomendamos que você ligue imediatamente para o SAMU (192) ou vá ao pronto-socorro mais próximo. "
            "Evite realizar esforços físicos. Este assistente não substitui uma avaliação médica de emergência."
        ]
    
    if dor_peito or suor_frio or falta_ar or palpitacao:
        return [
            "Registramos que você está sentindo sintomas potencialmente relacionados ao sistema cardiovascular. "
            "É de suma importância que você consulte um médico. Se houver piora súbita, ligue para 192 (SAMU). "
            "Posso ajudá-lo a entender mais sobre fatores de risco, medicamentos habituais ou orientar sobre medições de pressão."
        ]
        
    if "pressao" in lower or "pressão" in lower:
        return [
            "Para uma medição de pressão arterial precisa: sente-se, descanse por 5 minutos e mantenha o braço apoiado na altura do coração. "
            "Valores normais de referência estão em torno de 120/80 mmHg. Você tem monitorado sua pressão arterial?"
        ]
        
    if any(s in lower for s in ("medicamento", "remedio", "remédio", "prescricao")):
        return [
            "Sobre os medicamentos: nunca interrompa ou altere a dose de suas medicações cardiológicas sem orientação médica explícita. "
            "Gostaria de saber mais sobre algum grupo específico, como anti-hipertensivos ou antiarrítmicos?"
        ]
        
    if any(s in lower for s in ("tchau", "adeus", "obrigado", "obrigada", "valeu")):
        return ["Até logo! Continue acompanhando seus sinais vitais no painel e cuide da saúde do seu coração. Em caso de emergência, ligue 192."]
        
    return [
        "Compreendi a sua mensagem. Para fornecer uma melhor orientação, você poderia me detalhar se sente algum sintoma como cansaço, palpitações, dor precordial ou se tem dúvidas sobre o uso de seus medicamentos?",
        "Lembre-se sempre de que o CardioIA é um canal de triagem e orientação inicial e não substitui a consulta médica presencial."
    ]

class ChatbotManager:
    def __init__(self):
        self.session_store: Dict[str, Dict[str, Any]] = {}
        
        # 1. Tentar configurar o Watson Assistant
        self.watson_client = None
        self.watson_assistant_id = os.environ.get("WATSON_ASSISTANT_ID")
        self.watson_apikey = os.environ.get("WATSON_APIKEY")
        self.watson_url = os.environ.get("WATSON_URL")
        
        if HAS_WATSON and self.watson_apikey and self.watson_url and self.watson_assistant_id:
            try:
                authenticator = IAMAuthenticator(self.watson_apikey)
                self.watson_client = AssistantV2(
                    version='2021-06-14',
                    authenticator=authenticator
                )
                self.watson_client.set_service_url(self.watson_url)
                logger.info("ChatbotManager: Watson Assistant conectado com sucesso.")
            except Exception as e:
                logger.error(f"Erro ao inicializar Watson: {e}")
                self.watson_client = None

        # 2. Tentar configurar a OpenAI se Watson não estiver disponível
        self.openai_client = None
        openai_key = os.environ.get("OPENAI_API_KEY")
        if HAS_OPENAI and openai_key and not self.watson_client:
            try:
                self.openai_client = OpenAI(api_key=openai_key)
                logger.info("ChatbotManager: OpenAI GPT-4o-mini configurado para chatbot.")
            except Exception as e:
                logger.error(f"Erro ao inicializar OpenAI: {e}")
                self.openai_client = None
                
    def create_session(self) -> str:
        session_id = str(uuid.uuid4())
        
        watson_session_id = None
        if self.watson_client and self.watson_assistant_id:
            try:
                res = self.watson_client.create_session(
                    assistant_id=self.watson_assistant_id
                ).get_result()
                watson_session_id = res.get("session_id")
            except Exception as e:
                logger.error(f"Erro ao criar sessão no Watson: {e}")
                
        # Armazena estado da sessão
        self.session_store[session_id] = {
            "watson_session_id": watson_session_id,
            "history": []
        }
        return session_id
        
    def send_message(self, session_id: str, text: str) -> List[str]:
        if session_id not in self.session_store:
            # Cria uma sessão dinamicamente se não existir
            session_id = self.create_session()
            
        session = self.session_store[session_id]
        session["history"].append({"role": "user", "text": text})
        
        # 1. Fluxo Watson Assistant
        if self.watson_client and session.get("watson_session_id") and self.watson_assistant_id:
            try:
                response = self.watson_client.message(
                    assistant_id=self.watson_assistant_id,
                    session_id=session["watson_session_id"],
                    input={'message_type': 'text', 'text': text}
                ).get_result()
                
                output_texts = []
                generic = response.get("output", {}).get("generic", [])
                for item in generic:
                    if item.get("response_type") == "text":
                        output_texts.append(item.get("text"))
                
                if output_texts:
                    for t in output_texts:
                        session["history"].append({"role": "assistant", "text": t})
                    return output_texts
            except Exception as e:
                logger.error(f"Erro no envio de mensagem para Watson: {e}. Usando fallback.")
                
        # 2. Fluxo OpenAI (se Watson falhar ou não configurado)
        if self.openai_client:
            try:
                # Converter histórico local para formato da OpenAI
                messages = [
                    {"role": "system", "content": "Você é o assistente CardioIA. Auxilie médicos e pacientes com dúvidas gerais sobre cardiologia. Seja acolhedor, objetivo e sempre lembre de consultar profissionais médicos para diagnósticos oficiais. Não dê diagnósticos conclusivos."}
                ]
                # Adicionar últimas 6 mensagens do histórico
                for msg in session["history"][-6:]:
                    role = "user" if msg["role"] == "user" else "assistant"
                    messages.append({"role": role, "content": msg["text"]})
                    
                completion = self.openai_client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=messages,
                    max_tokens=250,
                    temperature=0.7
                )
                
                ai_text = completion.choices[0].message.content
                session["history"].append({"role": "assistant", "text": ai_text})
                return [ai_text]
            except Exception as e:
                logger.error(f"Erro no envio de mensagem para OpenAI: {e}. Usando fallback local.")
                
        # 3. Fallback Local Baseado em Regras
        local_output = _get_local_fallback_response(text)
        for t in local_output:
            session["history"].append({"role": "assistant", "text": t})
        return local_output
