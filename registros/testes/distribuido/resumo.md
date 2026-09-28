# Testes de sistema distribuído

Executado em 27/09/2026, 23:54:03 · duração 106 s

| Teste | Resultado | Resumo |
|---|---|---|
| Balanceamento de carga | ✅ passou | 20 requisições: ocorrencias-2=10, ocorrencias-1=10 |
| Tolerância a falha de réplica | ✅ passou | réplica 2 parada: 20/20 sucesso (todas em ocorrencias-1); religada: {"ocorrencias-1":10,"ocorrencias-2":10} |
| Queda do broker + outbox | ✅ passou | 5 eventos pendentes com o broker fora ~20 s; outbox zerado e relatórios 65→70 após religar; alerta de manancial gerado |
| Falha da Open-Meteo + circuit breaker | ✅ passou | circuito ABERTO e fonte "cache" durante a falha; FECHADO e "ao_vivo" após o resetTimeout |
| Rastreamento por X-Request-Id | ✅ passou | ID encontrado em: relatorios-service-1, ocorrencias-service-2-1, alertas-service-1, gateway-1 |
