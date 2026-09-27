# PROGRESSO — EcoRadar Urbano

> Arquivo de acompanhamento. Se a sessão for interrompida, basta dizer **"continue"**:
> o trabalho é retomado a partir da seção "Próximo passo".

## Situação atual

| Fase | Entrega | Situação |
|---|---|---|
| 1 | Ambiente, estrutura, Git, README inicial | ✅ concluída |
| 2 | Infra (compose, PostGIS, RabbitMQ+MQTT, Nginx) | 🟡 arquivos prontos — validação pendente (Docker exige reinício do PC) |
| 3 | `packages/shared` + auth-service | 🟡 código + testes unitários ok — login via gateway pendente (Docker) |
| 4 | ocorrencias-service | ⏳ |
| 5 | sensor-simulator + ambiental-service | ⏳ |
| 6 | alertas-service + relatorios-service | ⏳ |
| 7 | App móvel | ⏳ (projeto Expo SDK 57 criado e dependências instaladas) |
| 8 | Seed + scripts + Swagger | ⏳ |
| 9 | Testes e evidências | ⏳ |
| 10 | COMO_TESTAR.md + README final | ⏳ |

## Decisões e observações

- **Caminho do projeto**: `C:\dev\APS` (o prompt trazia um placeholder; confirmado com o aluno).
- **Docker**: não estava instalado. Com autorização do aluno, foram instalados via
  `wsl --install --no-distribution` (WSL 2.7.14) e `winget install Docker.DockerDesktop` (4.91.0).
  **É necessário reiniciar o PC** para ativar a Plataforma de Máquina Virtual e abrir o Docker Desktop uma vez.
- **TypeScript 6.0.3** (e não 7.x): o `typescript-eslint` atual exige TS < 6.1, e o template do Expo SDK 57 também usa 6.0.3.
- **Expo SDK 57** (React Native 0.86.3, React 19.2.3) — é o SDK marcado como `latest` no npm e suportado pelo Expo Go das lojas.
- **npm 12** bloqueia scripts de instalação por padrão: o do `esbuild` foi aprovado explicitamente (`allowScripts` no `backend/package.json`).
- **Build dos serviços**: cada serviço é empacotado com esbuild em um único `dist/index.js` (o pacote `@ecoradar/shared` é incorporado ao bundle); imagem Docker única parametrizada por `PACOTE`.
- **Database per service**: tabelas sem schema explícito no Drizzle; cada usuário de banco (`svc_*`) tem `search_path` = o próprio schema. Migrações por serviço com advisory lock (2 réplicas não migram ao mesmo tempo).
- **IQAr**: faixas conferidas na página oficial da CETESB em 27/09/2026
  (https://www.cetesb.sp.gov.br/cetesb/qualidade_ambiental/ar/informacoes_basicas/padroes_de_qualidade_do_ar).
- Rede do PC: Ethernet, IP 192.168.68.104, perfil de rede **Público** (relevante para a regra de firewall).

## Próximo passo

Implementar o ocorrencias-service (Fase 4) e seguir com os demais serviços e o app,
deixando para depois do reinício do PC a validação com Docker (Fases 2 a 6).

## Como retomar

1. Ler este arquivo.
2. `git log --oneline` para ver o que já foi entregue.
3. Continuar pela seção "Próximo passo".
