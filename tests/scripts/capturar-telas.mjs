// Utilitário de desenvolvimento: abre o app web (servido pelo gateway) em viewport de celular,
// autentica via API e fotografa as rotas informadas. Não faz parte das evidências oficiais
// (essas são geradas pelos testes E2E em tests/e2e).
// Uso: node scripts/com-navegadores.mjs node scripts/capturar-telas.mjs <saida> <email> [tema] [rota...]
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, devices } from '@playwright/test';

const [saida = '../registros/.previa', email = 'ana@ecoradar.local', tema = 'light', ...rotas] = process.argv.slice(2);
const BASE = process.env.ECORADAR_URL || 'http://localhost:8080';
const usuarios = JSON.parse(readFileSync(resolve('..', 'backend', 'seed', 'usuarios-demo.json'), 'utf-8')).usuarios;
const u = usuarios.find((x) => x.email === email);
mkdirSync(saida, { recursive: true });

const sessao = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: u.email, senha: u.senha }) })).json();
const navegador = await chromium.launch();
const contexto = await navegador.newContext({
  ...devices['Pixel 7'],
  colorScheme: tema === 'dark' ? 'dark' : 'light',
  geolocation: { latitude: -23.5505, longitude: -46.6333 },
  permissions: ['geolocation'],
  locale: 'pt-BR',
  timezoneId: 'America/Sao_Paulo',
});
await contexto.addInitScript(([s]) => {
  localStorage.setItem('ecoradar.sessao', JSON.stringify({ state: { token: s.token, expiraEm: s.expiraEm, usuario: s.usuario }, version: 0 }));
  if (!localStorage.getItem('ecoradar.preferencias')) {
    localStorage.setItem('ecoradar.preferencias', JSON.stringify({ state: { tema: 'sistema', raioAlertasKm: 10, onboardingVisto: true, ultimaLocalizacao: null }, version: 0 }));
  }
}, [sessao]);
const pagina = await contexto.newPage();
const erros = [];
pagina.on('pageerror', (e) => erros.push(`pageerror: ${e.message}`));
pagina.on('console', (m) => m.type() === 'error' && erros.push(`console: ${m.text()}`));
for (const rota of rotas.length ? rotas : ['/']) {
  await pagina.goto(`${BASE}${rota}`, { waitUntil: 'networkidle' }).catch(() => undefined);
  await pagina.waitForTimeout(2500);
  const nome = rota.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'raiz';
  await pagina.screenshot({ path: resolve(saida, `${nome}.png`) });
  console.log('capturada', rota);
}
if (erros.length) console.log('ERROS NO NAVEGADOR:\n' + [...new Set(erros)].join('\n'));
await navegador.close();
