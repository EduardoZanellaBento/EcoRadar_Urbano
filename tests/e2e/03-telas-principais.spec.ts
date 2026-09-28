/**
 * Navegação pelas telas principais — executada nos DOIS perfis (Pixel 7 e iPhone 14),
 * para demonstrar o layout em aparelhos diferentes. Prints com prefixo N (navegação).
 */
import { expect, test } from '@playwright/test';
import { aguardarMapa, autenticarContexto, el, print, salvarVideo } from './apoio.js';
import { usuario } from '../utils/api.js';

test('N · navegação pelas telas principais', async ({ page, context }, info) => {
  // Login pela interface
  await context.addInitScript(() => {
    if (!localStorage.getItem('ecoradar.preferencias')) {
      localStorage.setItem('ecoradar.preferencias', JSON.stringify({ state: { tema: 'sistema', raioAlertasKm: 10, onboardingVisto: true, ultimaLocalizacao: null }, version: 0 }));
    }
  });
  await page.goto('/login');
  await el(page, 'campo-email').fill('camila@ecoradar.local');
  await el(page, 'campo-senha').fill(usuario('camila@ecoradar.local').senha);
  await print(page, 'N01_login', info);
  await el(page, 'botao-entrar').click();

  await aguardarMapa(page);
  await print(page, 'N02_mapa', info);

  await el(page, 'aba-ocorrencias').click();
  await expect(el(page, 'total-ocorrencias')).toContainText('ocorrências');
  await print(page, 'N03_lista_ocorrencias', info);
  await el(page, 'filtro-perto').click();
  await expect(el(page, 'total-ocorrencias')).toContainText('ocorrência', { timeout: 20_000 });
  await page.waitForTimeout(1500);
  await print(page, 'N04_lista_perto_de_mim', info);

  await el(page, 'aba-ambiental').click();
  await expect(el(page, 'cartao-iqar-cidade')).toBeVisible();
  await print(page, 'N05_qualidade_ambiental', info);

  await el(page, 'aba-alertas').click();
  await expect(el(page, 'tela-alertas')).toBeVisible();
  await page.waitForTimeout(1000);
  await print(page, 'N06_alertas', info);

  await el(page, 'aba-perfil').click();
  await expect(el(page, 'perfil-acesso')).toContainText('Cidadão');
  await print(page, 'N07_perfil', info);

  await el(page, 'link-relatorios').click();
  await expect(el(page, 'grafico-status')).toBeVisible();
  await print(page, 'N08_relatorios', info);

  await page.goto('/status');
  await expect(el(page, 'resumo-status')).toContainText('Todos os serviços online', { timeout: 30_000 });
  await print(page, 'N09_status_sistema', info);

  await page.goto('/envios');
  await expect(el(page, 'tela-envios')).toBeVisible();
  await print(page, 'N10_envios', info);
  await salvarVideo(page, 'N-navegacao-telas-principais', info);
});

test('N · painel do agente em outro aparelho', async ({ page, context }, info) => {
  await autenticarContexto(context, 'agente2@ecoradar.local');
  await page.goto('/painel');
  await expect(el(page, 'tela-painel')).toContainText('Fila de atendimento');
  await print(page, 'N11_painel_agente', info);
  await salvarVideo(page, 'N-painel-agente', info);
});
