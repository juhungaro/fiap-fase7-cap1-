# CardioIA — Plataforma de Inteligência Cardíaca Total (Fase 7)

## FIAP - Faculdade de Informática e Administração Paulista
<p align="center">
  <img src="https://raw.githubusercontent.com/agodoi/template/main/docs/logo-fiap.png" alt="FIAP Logo" width="50%" />
</p>

Este repositório consolida a entrega da **Fase 7** da CardioIA. A solução representa um ecossistema completo de saúde digital cardiológica, unificando a captura de sinais vitais via IoT, modelagem preditiva baseada em Machine Learning para risco de picos, triagem clínica avançada orquestrada por múltiplos agentes inteligentes e interfaces ricas Web e Mobile voltadas a médicos e pacientes.

---

## 👨‍🎓 Integrantes da Equipe (Grupo de Alta Performance)
- Bryan Fagundes
- Brenner Fagundes
- Hyanka Coelho
- Juliana Hungaro Fidelis

## 👩‍🏫 Corpo Docente e Orientação
- **Tutor:** Leonardo Ruiz Orabona
- **Coordenador:** André Godoi

---

## 🏗️ Arquitetura Final da Solução (Diagrama de Fluxo)

A CardioIA integra cinco camadas tecnológicas em um fluxo contínuo e responsivo em tempo real:

```mermaid
graph TD
    subgraph IoT ["Camada de Captura (Hardware)"]
        A[Sensores: BPM, SpO2, Temp] -->|Simulação procedural| B[ESP32 / Raspberry Pi Pico]
        B -->|MicroPython| C[Display OLED SSD1306]
        B -->|LED Vermelho/Verde| D[Sinalizadores Físicos]
    end

    subgraph Backend ["Camada Integradora (Python)"]
        B -->|HTTP POST JSON| E[FastAPI API Gateway]
        E -->|Leitura dinâmica| F[Estado em Memória/Histórico]
        E -->|Input clínico| G[Serviço de ML: Predict Risk]
        G -->|Joblib Model| H[cardio_pico_risco_artifact.joblib]
        E -->|Triagem Avançada| I[Orquestrador Multiagente OpenAI SDK]
        I -->|Protocolos Médicos| J[protocolos_medicos.json]
    end

    subgraph Frontends ["Camada de Visualização (UIs)"]
        E -->|REST API HTTP| K[Frontend Web React + Vite]
        E -->|REST API HTTP| L[Mobile App Expo React Native]
        M[Chatbot Conversacional] <-->| Watson Assistant / GPT-4o-mini | E
    end

    classDef iot fill:#0f172a,stroke:#3b82f6,stroke-width:2px,color:#fff;
    classDef backend fill:#1e1b4b,stroke:#ef4444,stroke-width:2px,color:#fff;
    classDef ui fill:#022c22,stroke:#10b981,stroke-width:2px,color:#fff;
    
    class A,B,C,D iot;
    class E,F,G,H,I,J backend;
    class K,L,M ui;
```

---

## 🔗 Links Públicos e Entregáveis

* **Deploy Web (Vercel):** [https://cardioia-plataforma.vercel.app](https://fiap-fase7-cap1.vercel.app/)
  *(Configurado com vercel.json para suporte nativo a rotas SPA e CI/CD ativo ligado ao repositório GitHub)*
* **Build Mobile (Expo Dashboard - APK):** [https://expo.dev/artifacts/cardioia-mobile-preview-apk](https://expo.dev/artifacts/cardioia-mobile-preview-apk)
  *(Geração automática do arquivo .apk por meio da nuvem EAS Build configurado pelo eas.json)*
* **Simulação IoT (Wokwi):** [https://wokwi.com/projects/cardioia-micropython-esp32](https://wokwi.com/projects/466372883994714113)
  *(Hardware completo rodando o script MicroPython com OLED e LEDs sinalizadores)*

---

## 🛠️ Instruções de Instalação e Execução

### 1. Servidor Backend (FastAPI)
Navegue até a pasta `backend`, crie o ambiente virtual e execute o servidor:

```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate  # No macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # Insira sua OPENAI_API_KEY no arquivo .env
python run.py
```
*A API estará ativa em `http://localhost:8000`. Acesse `http://localhost:8000/docs` para a documentação interativa Swagger.*

### 2. Interface Web (React + Vite)
Navegue até a pasta `frontend`, instale as dependências e inicie o servidor local:

```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```
*Acesse `http://localhost:5173` no seu navegador.*

### 3. Aplicativo Móvel (Expo React Native)
Navegue até a pasta `mobile`, configure a URL da sua API local ou na nuvem e inicie:

```bash
cd mobile
npm install --legacy-peer-deps
npx expo start
```
*Escaneie o QR Code com o aplicativo Expo Go no celular (Android/iOS).*

### 4. Simulador IoT (MicroPython)
1. Acesse o projeto no [Wokwi](https://wokwi.com/projects/cardioia-micropython-esp32).
2. Cole o código de [iot/main.py](iot/main.py) na aba do código e o [iot/diagram.json](iot/diagram.json) na aba de diagramação.
3. Se estiver rodando o backend localmente, utilize uma ferramenta de tunelamento como o **ngrok** (`ngrok http 8000`) para obter uma URL pública e insira essa URL na variável `BACKEND_URL` do script MicroPython do Wokwi.
4. Clique em **Iniciar Simulação**.

---

## 📷 Prints Comprobatórios de Operação

### Tela de Login Glassmorphic e Acesso Rápido
<p align="left">
  <img src="docs/print_login.png" alt="Login CardioIA" width="70%" />
</p>

### Dashboard Médico com Telemetria IoT e Análise de Risco IA
<p align="left">
  <img src="docs/print_dashboard.png" alt="Dashboard CardioIA" width="75%" />
</p>

### Chatbot Inteligente Integrado para Triagem e Orientação
<p align="left">
  <img src="docs/print_chatbot.png" alt="Chatbot CardioIA" width="70%" />
</p>
