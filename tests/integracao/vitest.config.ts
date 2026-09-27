import { defineConfig } from 'vitest/config';

// Testes de integração contra a stack real, sempre pelo gateway http://localhost:8080
export default defineConfig({
  test: {
    root: '.',
    include: ['integracao/**/*.test.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    sequence: { concurrent: false },
    reporters: ['verbose', ['json', { outputFile: '../registros/testes/integracao/resultado.json' }], ['junit', { outputFile: '../registros/testes/integracao/junit.xml' }]],
  },
});
