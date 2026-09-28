# EcoRadar Urbano — app móvel

App **Expo SDK 57** (React Native 0.86, TypeScript, Expo Router) que roda no **Expo Go** (Android/iOS) e na web.

```bash
npm install
npx expo start --clear          # QR code para o Expo Go
npx expo export --platform web  # build web (servido pelo gateway em http://localhost:8080/)
npx tsc --noEmit                # checagem de tipos
npx expo lint                   # lint
```

O endereço da API vem de `EXPO_PUBLIC_API_URL` em `mobile/.env`, gerado por `scripts/configurar-ip`.
Passo a passo completo (firewall, credenciais, checklist): [../COMO_TESTAR.md](../COMO_TESTAR.md).

## Organização (`src/`)

| Pasta | Conteúdo |
|---|---|
| `app/` | Telas (rotas do Expo Router): onboarding, login, cadastro, abas (mapa, ocorrências, ambiente, alertas, perfil), registro, detalhe, relatórios, status, painel do agente, envios pendentes |
| `componentes/` | Componentes visuais; `mapa/Mapa.native.tsx` (react-native-maps) e `mapa/Mapa.web.tsx` (react-leaflet + OpenStreetMap) |
| `api/` | Cliente Axios (timeout 10 s, retry com backoff, logout em 401, mensagens amigáveis) e consultas TanStack Query |
| `estado/` | Zustand: sessão (SecureStore / localStorage na web), preferências, fila offline, conexão e alertas |
| `servicos/` | Tempo real (Socket.IO), conectividade (NetInfo) e sincronização da fila, notificações locais, mídia, exportação, localização |
| `tema/` | Tema Material 3 claro/escuro, cores por severidade/status/IQAr e paleta dos gráficos |

O projeto foi criado com `npx create-expo-app@latest` e usa apenas bibliotecas incluídas no Expo Go
(`npx expo-doctor`: 21/21 verificações sem problemas).
