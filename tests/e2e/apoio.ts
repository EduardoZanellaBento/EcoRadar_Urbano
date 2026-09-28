import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { devices, expect, type Browser, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import { API, REGISTROS, req, usuario } from '../utils/api.js';

export const PASTA_PRINTS = (projeto: string) => resolve(REGISTROS, 'screenshots', 'web-mobile', projeto);
export const PASTA_VIDEOS = resolve(REGISTROS, 'videos');
export const FOTO_TESTE = resolve(REGISTROS, '..', 'tests', 'fixtures', 'foto-ocorrencia.jpg');

export interface SessaoApi {
  token: string;
  expiraEm: string;
  usuario: { id: string; nome: string; email: string; perfil: string };
}

const sessoes = new Map<string, SessaoApi>();
/** Login pela API (com cache: o login tem limite de tentativas por minuto). */
export async function sessaoApi(email: string): Promise<SessaoApi> {
  const salva = sessoes.get(email);
  if (salva) return salva;
  const r = await req('POST', '/api/auth/login', { corpo: { email, senha: usuario(email).senha } });
  if (r.status !== 200) throw new Error(`login ${email}: ${r.status}`);
  sessoes.set(email, r.corpo);
  return r.corpo;
}

/** Deixa o app já autenticado (e com o onboarding visto) antes de carregar a página. */
export async function autenticarContexto(contexto: BrowserContext, email: string, preferencias: Record<string, unknown> = {}) {
  const s = await sessaoApi(email);
  await contexto.addInitScript(
    ([sessao, prefs]) => {
      if (!localStorage.getItem('ecoradar.sessao')) {
        localStorage.setItem('ecoradar.sessao', JSON.stringify({ state: { token: sessao.token, expiraEm: sessao.expiraEm, usuario: sessao.usuario }, version: 0 }));
      }
      if (!localStorage.getItem('ecoradar.preferencias')) {
        localStorage.setItem(
          'ecoradar.preferencias',
          JSON.stringify({ state: { tema: 'sistema', raioAlertasKm: 10, onboardingVisto: true, ultimaLocalizacao: null, ...prefs }, version: 0 }),
        );
      }
    },
    [s, preferencias] as const,
  );
  return s;
}

/** Print numerado da etapa, também anexado ao relatório HTML do Playwright. */
export async function print(pagina: Page, nome: string, info: TestInfo, opcoes: { pagina?: boolean } = {}) {
  const pasta = PASTA_PRINTS(info.project.name);
  mkdirSync(pasta, { recursive: true });
  const caminho = resolve(pasta, `${nome}.png`);
  await pagina.waitForTimeout(400); // animações do Paper
  await pagina.screenshot({ path: caminho, fullPage: opcoes.pagina ?? false });
  await info.attach(nome, { path: caminho, contentType: 'image/png' });
  return caminho;
}

/** Fecha a página e salva o vídeo com nome descritivo em registros/videos. */
export async function salvarVideo(pagina: Page, nome: string, info: TestInfo) {
  const video = pagina.video();
  if (!pagina.isClosed()) await pagina.close();
  if (video) {
    mkdirSync(PASTA_VIDEOS, { recursive: true });
    const destino = resolve(PASTA_VIDEOS, `${info.project.name}-${nome}.webm`);
    await video.saveAs(destino);
    await info.attach(`video-${nome}`, { path: destino, contentType: 'video/webm' });
  }
}

/** Novo "aparelho" independente (contexto com vídeo), para testes com dois dispositivos. */
export async function novoAparelho(navegador: Browser, info: TestInfo, extra: Parameters<Browser['newContext']>[0] = {}) {
  const dispositivo = info.project.name === 'iphone-14' ? { ...devices['iPhone 14'] } : { ...devices['Pixel 7'] };
  const { defaultBrowserType: _ignorar, ...semTipo } = dispositivo as typeof dispositivo & { defaultBrowserType?: string };
  return navegador.newContext({
    ...semTipo,
    baseURL: API,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    geolocation: { latitude: -23.5505, longitude: -46.6333 },
    permissions: ['geolocation'],
    recordVideo: { dir: resolve(REGISTROS, '..', 'tests', 'test-results', 'videos-extras'), size: { width: 412, height: 915 } },
    ...extra,
  });
}

/** Elemento visível por testID (telas anteriores da pilha continuam no DOM, ocultas). */
export const el = (pagina: Page, testId: string) => pagina.getByTestId(testId).filter({ visible: true });

/** Aguarda o mapa carregar (contador preenchido e ao menos um marcador desenhado). */
export async function aguardarMapa(pagina: Page) {
  await expect(el(pagina, 'contador-mapa')).toContainText('ocorrências', { timeout: 45_000 });
  await expect(pagina.locator('.eco-marcador').first()).toBeVisible({ timeout: 45_000 });
  await pagina.waitForLoadState('networkidle').catch(() => undefined);
  await pagina.waitForTimeout(1200); // tiles do OpenStreetMap
}

export async function contadorMapa(pagina: Page): Promise<number> {
  const texto = (await el(pagina, 'contador-mapa').textContent()) ?? '';
  return Number(/(\d+) ocorrências/.exec(texto)?.[1] ?? NaN);
}

export { API, req };
