# Evidências — EcoRadar Urbano

Índice gerado em 28/09/2026, 00:00:28. Abra **[index.html](index.html)** no navegador para a galeria com legendas (funciona offline).
O resumo dos testes com números reais está em **[RELATORIO_DE_TESTES.md](RELATORIO_DE_TESTES.md)**.

| Pasta / arquivo | Conteúdo |
|---|---|
| `ambiente/` | `sistema.txt` (SO, CPU, RAM, IP, ferramentas) e `versoes.txt` (versões exatas em uso) |
| `build/` | Logs de criação do app, instalação de dependências, build das imagens Docker e `expo export` |
| `testes/unitarios/` | Saída do Vitest, resumo e relatório HTML de cobertura (`cobertura/index.html`) |
| `testes/integracao/` | Saída, JSON/JUnit, PDF e CSV exportados durante o teste |
| `testes/e2e/` | Relatório HTML do Playwright (`relatorio-html/index.html`), JSON e arquivos baixados |
| `testes/distribuido/` | Logs, imagens e prints de cada teste de falha; `rastreamento_request_id.txt`; `resumo.md` |
| `testes/carga/` | Resultado (Markdown/JSON), gráfico e dados brutos do autocannon |
| `testes/qualidade/` | Saída do `tsc --noEmit` e dos linters (backend, app e testes) |
| `screenshots/web-mobile/` | 59 prints no Pixel 7 e 11 no iPhone 14 |
| `screenshots/swagger/` | 7 prints da documentação OpenAPI |
| `screenshots/infraestrutura/` | Painel do RabbitMQ e `docker compose ps` |
| `screenshots/relatorios/` | Páginas do PDF exportado convertidas em imagem |
| `screenshots/nativo-android/` | Vazio: não há emulador/adb neste computador (ver README da pasta) |
| `videos/` | 18 vídeos (.webm) das execuções E2E |
| `logs/servicos/` | `docker compose logs` de cada serviço |
| `manual/` | Para o aluno salvar os prints tirados no próprio celular (ver README da pasta) |
| `metricas_codigo.txt` | Linhas de código por módulo e por linguagem |

Para regenerar tudo: `scripts/coletar-evidencias.ps1` (Windows) ou `scripts/coletar-evidencias.sh`.
