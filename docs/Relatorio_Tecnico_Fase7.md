# Relatório Técnico — CardioIA (Fase 7)
## Plataforma de Inteligência Cardíaca Total

---

## 1. Introdução

A evolução do CardioIA culmina, na Fase 7, com a entrega de um MVP (Minimum Viable Product) funcional e integrado. O projeto deixa de ser um conjunto de módulos analíticos isolados para se tornar um ecossistema unificado, com o "Cérebro" (motores de IA e modelos preditivos desenvolvidos na Fase 6) se conectando ao "Corpo" (interfaces responsivas para web e mobile desenvolvidas com React e React Native).

A plataforma agora suporta o recebimento contínuo de telemetria de sensores de hardware simulados em MicroPython, calcula dinamicamente o risco de picos de eventos cardiovasculares adversos usando Machine Learning, oferece suporte a uma triagem de IA baseada em múltiplos agentes colaborativos e fornece um chatbot conversacional para orientação clínica rápida de médicos e pacientes.

---

## 2. Diagrama de Arquitetura Final e Fluxo de Dados

A arquitetura final do CardioIA segue uma topologia cliente-servidor distribuída e orientada a serviços:

```
[ Sensor de BPM / SpO2 / Temp ]
               │
               ▼ (Captura analógica/digital)
  [ ESP32 com MicroPython ] ──(Exibição Local)──► [ Display OLED / LEDs ]
               │
               ▼ (HTTP POST JSON - Rede WiFi)
[ Backend FastAPI / Uvicorn ]
   ├── (Histórico e Estado) ──────► [ Memória Cache Local ]
   ├── (Predição Instantânea) ────► [ Modelo ML Joblib ]
   └── (Triagem Avançada) ────────► [ OpenAI Agents SDK (Multiagentes) ]
               │                                   │
               │ (REST API HTTP)                   ├── (Validação Regras)
               ▼                                   ▼
[ Frontend React + Mobile Expo ]          [ logs/decisoes_cardio_ia.jsonl ]
```

### Detalhamento das Camadas:
1. **Camada IoT (Hardware & Firmware):** O firmware em MicroPython rodando no ESP32 gerencia a leitura e a filtragem local de batimentos cardíacos, temperatura e saturação. O display OLED local mostra os valores e o status da conexão, enquanto LEDs físicos (verde/vermelho) piscam para alertar irregularidades graves no local.
2. **Camada Backend (API Gateway & Orquestração):** Escrito em Python utilizando FastAPI, atua como ponto central de unificação. Ele expõe endpoints para receber telemetria, gerenciar sessões do chatbot e acionar a predição.
3. **Camada de Inteligência Artificial:**
   - **Machine Learning (Predictive Engine):** Um classificador RandomForest treinado e persistido via `joblib` faz predições de probabilidade de risco em tempo real.
   - **Multiagentes (Cognitive Engine):** Utilizando o OpenAI Agents SDK, os agentes realizam triagem clínica cooperativa (Orquestrador -> Analista -> Especialista em Protocolos), gerando uma resposta final estruturada validada por Pydantic.
   - **Governança de IA:** A função de governança valida se a decisão estruturada da IA condiz com os limiares críticos do paciente e arquiva o log em JSONL para auditoria.
4. **Camada de Apresentação (Frontend & Mobile):** Aplicações Web (React+Vite) e Mobile (React Native+Expo) que consomem a API em tempo real para exibir widgets interativos, gráficos de linha dinâmicos e chat conversacional.

---

## 3. Transição para MicroPython no Hardware

A lógica de IoT foi convertida de C/C++ (Arduino) para MicroPython, trazendo flexibilidade e facilidade de depuração. O script MicroPython utiliza:
- A biblioteca `network` para estabelecimento de conexão socket WiFi virtual.
- O driver `ssd1306` via barramento I2C para desenhar texto de telemetria em tempo real no display.
- O módulo `urequests` para empacotar dados clínicos em um objeto JSON e despachá-los ao backend em intervalos de 5 segundos.
- Lógica de alarme local que aciona o GPIO14 (LED vermelho) e GPIO12 (LED verde).

---

## 4. Governança e Validação de Coerência

Para mitigar riscos de "alucinação" do modelo de linguagem, a governança audita a triagem:
- **Regra de Hipóxia:** Se o SpO2 for menor ou igual a 88%, valida se o protocolo sugerido contém termos como "oxigênio" ou "oxigenoterapia".
- **Regra de Inconsistência de Risco:** Impede que um paciente com risco de pico de ML acima de 75% seja classificado pelos agentes como risco "baixo" ou "moderado".
- Se houver descumprimento, o indicador de coerência é marcado como `False` no log de governança `logs/decisoes_cardio_ia.jsonl` para revisão por engenheiros de IA e médicos auditores.

---

## 5. Deploys Profissionais e CI/CD

- **Web (Vercel):** O arquivo [vercel.json](file:///c:/Users/danie/OneDrive/Documentos/Juliana/FIAP/fiap-fase7-cap1-main/frontend/vercel.json) reescreve todas as rotas para o `index.html`. Isso garante que o roteamento baseado no React não quebre na Vercel (erro 404). Cada push na branch principal do GitHub engatilha automaticamente o build e deploy via Vercel GitHub Integration.
- **Mobile (EAS Build):** O [app.json](file:///c:/Users/danie/OneDrive/Documentos/Juliana/FIAP/fiap-fase7-cap1-main/mobile/app.json) possui a propriedade `android.package` configurada como `com.cardioia.app`. O arquivo [eas.json](file:///c:/Users/danie/OneDrive/Documentos/Juliana/FIAP/fiap-fase7-cap1-main/mobile/eas.json) define o perfil `preview` com o parâmetro `buildType: "apk"`, instruindo a nuvem do Expo a compilar o executável Android diretamente.

---
