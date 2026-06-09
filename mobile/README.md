# CardioIA — Interface React Native (Expo)

App mobile para interação com o Assistente Cardiológico. Consome a API do backend (FastAPI).

## Pré-requisitos

- Node.js 18+
- Backend rodando (ver `/backend`)
- Expo Go no celular (opcional) ou emulador iOS/Android

## Configurar URL da API

- **iOS simulador**: usa `http://localhost:8000` por padrão.
- **Android emulador**: usa `http://10.0.2.2:8000` por padrão.
- **iPhone físico (sem Xcode/simulador):** instale o **Expo Go** no iPhone (App Store), deixe o celular e o Mac na mesma Wi‑Fi, rode `npx expo start` e escaneie o QR Code com a câmera. Defina no `.env` a URL com o IP do Mac (veja abaixo).
- **Dispositivo físico (geral):** o app precisa acessar o IP da sua máquina. Crie um arquivo `.env` na pasta `mobile/`:

```bash
EXPO_PUBLIC_API_URL=http://SEU_IP:8000
```

Exemplo: se seu PC está em `192.168.1.10`, use `http://192.168.1.10:8000`. Garanta que o backend está em `--host 0.0.0.0`.

## Rodar (start do app)

```bash
cd mobile
npm install
npx expo start
```

Ou, a partir da raiz do projeto: `cd mobile && npm install && npx expo start`. No terminal do Expo, pressione **i** (iOS) ou **a** (Android).

Depois escolha:

- **i** — abrir no simulador iOS
- **a** — abrir no emulador Android
- Escanear o QR Code com o app **Expo Go** no celular (mesma rede e `EXPO_PUBLIC_API_URL` com o IP do PC)

## Troubleshooting

- **iOS: "Unable to boot device" / "cannot determine the runtime bundle"**  
  Todos os runtimes podem estar indisponíveis. Você **não precisa** instalar Xcode/simulador: use o **Expo Go** no iPhone (App Store), mesma rede Wi‑Fi, e escaneie o QR Code ao rodar `npx expo start`. Se quiser simulador: Xcode → **Settings** → **Platforms** → baixar um runtime de iOS.
- **Android: "No Android connected device found, no emulators could be started"**  
É preciso ter um emulador ou um celular conectado. **Emulador:** instale o **Android Studio**, em **Tools → Device Manager** crie um AVD (Android Virtual Device) e inicie-o; então rode `npx expo start` e pressione **a**. **Celular:** ative **Opções do desenvolvedor** e **Depuração USB**, conecte o cabo e use o **Expo Go** escaneando o QR Code (defina `EXPO_PUBLIC_API_URL` com o IP do PC).

## Ícones e UI do chat

- **Ícones:** o app usa `@expo/vector-icons` (Ionicons), já incluído no Expo — ícone de coração no header e no avatar do assistente, ícone de pessoa no avatar do usuário, ícone de enviar no botão e ícone de chat na tela de boas-vindas.
- **Template do chat:** layout tipo mensageiro com avatares (assistente à esquerda, usuário à direita), bolhas com bordas arredondadas e “cauda” (cantos menores no lado do avatar), cores distintas para usuário (azul) e assistente (cinza escuro).

## Estrutura

- `App.tsx` — tela única do chat (sessão, mensagens, envio). **TypeScript**
- `config.ts` — URL base da API conforme plataforma e variável de ambiente
- `types.ts` — tipos (Message, SessionResponse, MessageResponse)
- `tsconfig.json` — configuração TypeScript (estende `expo/tsconfig.base`)

