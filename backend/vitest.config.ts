import { defineConfig } from 'vitest/config';

/**
 * Testes unitários do backend. A cobertura é medida sobre os módulos de regras de
 * negócio (pastas "dominio" de cada serviço + utilitários puros do pacote shared),
 * que são o foco da meta de ≥ 70%.
 */
export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts', 'services/*/test/**/*.test.ts'],
    environment: 'node',
    testTimeout: 15_000,
    coverage: {
      provider: 'v8',
      include: [
        'services/*/src/dominio/**/*.ts',
        'services/ambiental-service/src/integracoes/open-meteo.ts',
        'packages/shared/src/backoff.ts',
        'packages/shared/src/cache.ts',
        'packages/shared/src/geo.ts',
        'packages/shared/src/erros.ts',
        'packages/shared/src/eventos.ts',
      ],
      reporter: ['text', 'text-summary', 'html', 'json-summary'],
      reportsDirectory: '../registros/testes/unitarios/cobertura',
      thresholds: { lines: 70, statements: 70, functions: 70, branches: 60 },
    },
  },
});
