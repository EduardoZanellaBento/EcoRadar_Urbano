import { chromium, devices, type Browser, type Page } from '@playwright/test';
import { API, req, usuario } from './api.js';

let navegador: Browser | null = null;

/** Abre o app web (Pixel 7) já autenticado e navega até a rota — usado para prints nos testes distribuídos. */
export async function abrirApp(email: string, rota: string): Promise<Page> {
  navegador ??= await chromium.launch();
  const sessao = await req('POST', '/api/auth/login', { corpo: { email, senha: usuario(email).senha } });
  const contexto = await navegador.newContext({
    ...devices['Pixel 7'],
    baseURL: API,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    geolocation: { latitude: -23.5505, longitude: -46.6333 },
    permissions: ['geolocation'],
  });
  await contexto.addInitScript((s) => {
    localStorage.setItem('ecoradar.sessao', JSON.stringify({ state: { token: s.token, expiraEm: s.expiraEm, usuario: s.usuario }, version: 0 }));
    localStorage.setItem('ecoradar.preferencias', JSON.stringify({ state: { tema: 'sistema', raioAlertasKm: 10, onboardingVisto: true, ultimaLocalizacao: null }, version: 0 }));
  }, sessao.corpo);
  const pagina = await contexto.newPage();
  await pagina.goto(rota);
  return pagina;
}

export const visivel = (pagina: Page, testId: string) => pagina.getByTestId(testId).filter({ visible: true });

export async function fecharNavegador() {
  await navegador?.close();
  navegador = null;
}
