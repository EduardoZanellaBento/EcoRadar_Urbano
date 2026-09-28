# Como testar o EcoRadar Urbano no seu celular

Guia gerado **para este computador**:

| Item | Valor detectado |
|---|---|
| Sistema | Windows 11 Home 10.0.26200 (PowerShell 5.1) |
| Rede | "Ethernet 2" (cabo), IP **192.168.68.104**, perfil do Windows **Público** |
| Gateway da API | `http://192.168.68.104:8080` (já gravado em `mobile/.env`) |
| Docker | Docker Desktop 4.91.0 (WSL 2) |
| App | Expo SDK 57 — abre no **Expo Go** das lojas |

> O PC está no **cabo**. O celular precisa estar no **Wi‑Fi do mesmo roteador** (rede `192.168.68.x`).
> Se o IP mudar (DHCP), rode de novo o passo 3.

Todos os comandos abaixo são para o **PowerShell**, na pasta `C:\dev\APS`.

---

## 1. Pré-requisitos no celular

1. Instale o **Expo Go** — [Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent) (Android) ou [App Store](https://apps.apple.com/app/expo-go/id982107779) (iOS). Mantenha-o **atualizado** (o projeto usa o SDK 57).
2. Conecte o celular ao **mesmo Wi‑Fi** do roteador ao qual o PC está ligado.

## 2. Subir o backend (tudo com um comando)

```powershell
powershell -ExecutionPolicy Bypass -File scripts\iniciar.ps1
```

O script abre o Docker Desktop se precisar, constrói as imagens, sobe os 10 containers, espera todos ficarem
*healthy*, gera o build web do app e carrega os dados de demonstração. Na primeira vez leva alguns minutos.

## 3. Configurar o IP do app

```powershell
powershell -ExecutionPolicy Bypass -File scripts\configurar-ip.ps1
```

Saída esperada neste PC:

```
IP detectado: 192.168.68.104 (Ethernet 2)
Gravado em mobile/.env -> EXPO_PUBLIC_API_URL=http://192.168.68.104:8080
```

## 4. Liberar o firewall do Windows (uma vez, PowerShell **como administrador**)

A rede deste PC está como **Pública**, e o Windows bloqueia conexões de entrada nesse perfil. Marque a rede
de casa como **Privada** e libere as portas 8080 (API) e 8081 (Metro/Expo) só na rede privada:

```powershell
Set-NetConnectionProfile -InterfaceAlias "Ethernet 2" -NetworkCategory Private
New-NetFirewallRule -DisplayName "EcoRadar 8080 (API)" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow -Profile Private
New-NetFirewallRule -DisplayName "EcoRadar 8081 (Expo Metro)" -Direction Inbound -Protocol TCP -LocalPort 8081 -Action Allow -Profile Private
```

Se o Windows perguntar sobre o "Docker Desktop Backend" ou o "Node.js", permita em **redes privadas**.

Para **remover** as regras depois (e, se quiser, voltar a rede para Pública):

```powershell
Remove-NetFirewallRule -DisplayName "EcoRadar 8080 (API)", "EcoRadar 8081 (Expo Metro)"
Set-NetConnectionProfile -InterfaceAlias "Ethernet 2" -NetworkCategory Public
```

## 5. Testar a rede pelo navegador do celular

Abra no navegador do celular: **http://192.168.68.104:8080/api/ambiental/health**

Se aparecer um JSON como `{"status":"ok","servico":"ambiental-service",...}`, a rede está funcionando.
Bônus: **http://192.168.68.104:8080/** abre a versão web do app no próprio navegador do celular.

## 6. Iniciar o app no Expo Go

```powershell
cd mobile
npx expo start --clear
```

- **Android:** abra o Expo Go e toque em *Scan QR code*.
- **iOS:** aponte a **câmera** para o QR code e toque no aviso para abrir no Expo Go.

O `--clear` garante que o endereço do `mobile/.env` seja usado (variáveis `EXPO_PUBLIC_*` entram no bundle).

## 7. Credenciais de demonstração

| Perfil | E-mail | Senha |
|---|---|---|
| Administrador | `admin@ecoradar.local` | `Admin@2026` |
| Agente | `agente1@ecoradar.local` | `Agente@2026` |
| Agente | `agente2@ecoradar.local` | `Agente@2026` |
| Cidadão | `ana@ecoradar.local` | `Cidadao@2026` |
| Cidadão | `bruno@ecoradar.local` | `Cidadao@2026` |
| Cidadão | `camila@ecoradar.local` | `Cidadao@2026` |
| Cidadão | `diego@ecoradar.local` | `Cidadao@2026` |
| Cidadão | `elisa@ecoradar.local` | `Cidadao@2026` |

(Senhas apenas para demonstração local; a fonte é `backend/seed/usuarios-demo.json`.)

## 8. Checklist de testes manuais

Salve cada print em `registros/manual/` com o nome indicado (depois rode `node tests/scripts/gerar-relatorios.mjs`
para eles aparecerem na galeria `registros/index.html`).

| # | Teste | Como fazer | Print |
|---|---|---|---|
| 1 | Abrir o app | Ler o QR code no Expo Go | `M01_expo_go_abrindo.png` |
| 2 | Onboarding | Primeiro acesso: veja os 3 slides | `M02_onboarding_celular.png` |
| 3 | Login | Entre como `ana@ecoradar.local` | `M03_login_celular.png` |
| 4 | Mapa | Veja ocorrências, estações (número = IQAr) e mananciais; toque em "minha localização" | `M04_mapa_celular.png` |
| 5 | Registro com câmera e GPS real | Botão **Registrar ocorrência** → categoria → **Câmera** → tire uma foto → confira o pino do GPS → **Registrar** | `M05_registro_camera_gps.png` |
| 6 | Detalhe com a foto | Tela aberta após registrar | `M06_detalhe_foto_real.png` |
| 7 | Notificação local de alerta | Deixe o app aberto no celular (aba Mapa). No **PC**, abra `http://localhost:8080/painel`, entre como **admin**, escolha **Alagamento** + **Ipiranga** e toque em **Disparar**. No celular chega a notificação e o banner. *(O alerta chega se você estiver a até 10 km da estação — ajuste o raio no Perfil se precisar.)* | `M07_notificacao_alerta.png` |
| 8 | Banner e badge | Veja o banner e o número na aba **Alertas** | `M08_banner_alerta_celular.png` |
| 9 | Modo avião | Ligue o **modo avião** → registre uma ocorrência → ela vai para **Envios pendentes** | `M09_modo_aviao_pendente.png` |
| 10 | Sincronização | Desligue o modo avião → em segundos o envio fica **Sincronizado** (sem duplicar) | `M10_sincronizado.png` |
| 11 | Tempo real celular ↔ PC | Deixe o mapa aberto no celular. No PC, abra `http://localhost:8080/`, entre como `bruno@ecoradar.local` e registre uma ocorrência: ela aparece no celular sem recarregar | `M11_tempo_real_pc_celular.png` |
| 12 | Qualidade ambiental | Aba **Ambiente** | `M12_qualidade_ambiental_celular.png` |
| 13 | Relatório PDF | Perfil → Relatórios → **Exportar PDF** → compartilhar | `M13_relatorio_compartilhado.png` |
| 14 | Status do sistema | Perfil → Status do sistema → **Testar com 10 requisições** | `M14_status_sistema_celular.png` |
| 15 | Tema escuro | Perfil → Tema → **Escuro** | `M15_tema_escuro_celular.png` |

Dica para o item 7: para voltar ao normal, use **Normalizar leituras** no painel do admin.

## 9. Solução de problemas

| Sintoma | O que fazer |
|---|---|
| O navegador do celular não abre `http://192.168.68.104:8080/...` | Confira se o celular está no Wi‑Fi do mesmo roteador e refaça o passo 4 (rede Privada + regras). Teste no PC: `http://localhost:8080/health`. |
| Rede da faculdade/empresa (isolamento de clientes: um aparelho não enxerga o outro) | Use o **roteador do celular**: ative o *hotspot* do celular, conecte o **PC** a ele (Wi‑Fi), rode `scripts\configurar-ip.ps1` de novo e reinicie o Expo com `npx expo start --clear`. |
| Expo Go: *"Project is incompatible with this version of Expo Go"* | Atualize o Expo Go na loja (o projeto usa o **SDK 57**). |
| App abre mas mostra *"Não foi possível conectar ao servidor"* | Confira `mobile/.env` (`EXPO_PUBLIC_API_URL=http://192.168.68.104:8080`) e reinicie com `npx expo start --clear`. |
| Porta 8080 em uso | Veja quem usa: `Get-NetTCPConnection -LocalPort 8080 \| Select-Object OwningProcess`. Ou troque `GATEWAY_PORTA` no `.env`, rode `scripts\iniciar.ps1` e `scripts\configurar-ip.ps1` de novo. |
| Porta 8081 (Metro) em uso | `npx expo start --clear --port 8082` (libere a 8082 no firewall, como no passo 4). |
| Docker parado / *"O Docker não está respondendo"* | Abra o **Docker Desktop**, espere *Engine running* e rode `scripts\iniciar.ps1` de novo. |
| Nada funciona na rede local | Alternativa por túnel: instale o cloudflared (`winget install Cloudflare.cloudflared`), rode `cloudflared tunnel --url http://localhost:8080`, copie a URL `https://...trycloudflare.com` para `EXPO_PUBLIC_API_URL` em `mobile/.env` e inicie o Expo com `npx expo start --tunnel --clear`. |
| Mapa em branco no Android | O Expo Go já traz a chave do Google Maps; verifique a internet do celular (os mapas vêm da internet). |
| Localização não aparece | Permita a localização para o Expo Go nas configurações do celular. |

## 10. Parar tudo e regenerar as evidências

```powershell
powershell -ExecutionPolicy Bypass -File scripts\parar.ps1            # para os containers (mantém os dados)
powershell -ExecutionPolicy Bypass -File scripts\parar.ps1 -Limpar    # para e APAGA os dados (volumes)
```

Regenerar os testes e as evidências (com a stack parada ou no ar; leva ~15 min):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\coletar-evidencias.ps1
powershell -ExecutionPolicy Bypass -File scripts\rodar-todos-testes.ps1    # só os testes (stack no ar)
```

O resultado fica em `registros/` — abra `registros\index.html` no navegador.
