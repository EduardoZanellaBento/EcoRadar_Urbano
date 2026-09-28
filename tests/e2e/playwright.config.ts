import { defineConfig, devices } from '@playwright/test';

/**
 * Testes E2E do app web (build exportado do Expo, servido pelo gateway em :8080),
 * com emulação de celular, vídeo e prints em cada passo.
 *  - pixel-7: roteiro completo (item 9.3 da APS)
 *  - iphone-14: navegação pelas telas principais (o motor é Chromium com emulação do iPhone)
 */
export default defineConfig({
  testDir: '.',
  outputDir: '../test-results',
  timeout: 240_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: '../../registros/testes/e2e/relatorio-html', open: 'never' }],
    ['json', { outputFile: '../../registros/testes/e2e/resultado.json' }],
  ],
  use: {
    baseURL: process.env.ECORADAR_URL || 'http://localhost:8080',
    video: 'on',
    screenshot: 'on',
    trace: 'retain-on-failure',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    geolocation: { latitude: -23.5505, longitude: -46.6333 },
    permissions: ['geolocation'],
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
  },
  projects: [
    { name: 'pixel-7', use: { ...devices['Pixel 7'] } },
    { name: 'iphone-14', use: { ...devices['iPhone 14'], browserName: 'chromium' } },
  ],
});
