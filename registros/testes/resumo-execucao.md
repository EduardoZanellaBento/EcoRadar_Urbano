# Resumo da execução dos testes

Executado em 27/09/2026, 23:55:33 (win32).

| Passo | Resultado | Duração | Log |
|---|---|---|---|
| Backend: checagem de tipos (tsc --noEmit) | ✅ passou | 6.3 s | `testes/qualidade/backend-tsc.txt` |
| Backend: lint (ESLint) | ✅ passou | 15.8 s | `testes/qualidade/backend-eslint.txt` |
| Backend: testes unitários + cobertura (Vitest) | ✅ passou | 11.6 s | `testes/unitarios/execucao.txt` |
| App: checagem de tipos (tsc --noEmit) | ✅ passou | 4.7 s | `testes/qualidade/mobile-tsc.txt` |
| App: lint (expo lint) | ✅ passou | 22.3 s | `testes/qualidade/mobile-lint.txt` |
| Testes: checagem de tipos | ✅ passou | 2.9 s | `testes/qualidade/testes-tsc.txt` |
| Integração via gateway (Vitest) | ✅ passou | 7.2 s | `testes/integracao/saida.txt` |
| E2E com Playwright (Pixel 7 e iPhone 14) | ✅ passou | 116.9 s | `testes/e2e/saida.txt` |
| Sistema distribuído (falhas, broker, circuit breaker, rastreamento) | ✅ passou | 108.0 s | `testes/distribuido/saida-console.txt` |
| Carga leve (autocannon, 1 x 2 réplicas) | ✅ passou | 89.1 s | `testes/carga/saida-console.txt` |
