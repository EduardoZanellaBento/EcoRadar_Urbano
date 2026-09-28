/**
 * Roteiro E2E completo (item 9.3 da APS) — executado no perfil Pixel 7.
 * Cada etapa gera um print numerado em registros/screenshots/web-mobile/pixel-7 e um vídeo.
 */
import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { FOTO_TESTE, aguardarMapa, autenticarContexto, el, print, req, salvarVideo, sessaoApi } from './apoio.js';

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({}, info) => {
  test.skip(info.project.name !== 'pixel-7', 'O roteiro completo roda no Pixel 7; o iPhone 14 executa a navegação pelas telas principais.');
});

test('01 · onboarding, cadastro e login (com erro de senha)', async ({ page, context }, info) => {
  await page.goto('/');
  await expect(el(page, 'slide-1')).toBeVisible();
  await print(page, '01_onboarding_1', info);
  await el(page, 'botao-proximo').click();
  await expect(el(page, 'slide-2')).toBeVisible();
  await print(page, '02_onboarding_2', info);
  await el(page, 'botao-proximo').click();
  await expect(el(page, 'slide-3')).toBeVisible();
  await print(page, '03_onboarding_3', info);
  await el(page, 'botao-proximo').click();
  await expect(el(page, 'botao-entrar')).toBeVisible();
  await print(page, '04_login', info);

  // Cadastro: primeiro com dados inválidos (validação do formulário), depois válidos
  await el(page, 'link-cadastro').click();
  await el(page, 'botao-cadastrar').click();
  await expect(page.getByText('Informe um e-mail válido.')).toBeVisible();
  await print(page, '05_cadastro_validacao', info);
  const email = `e2e.${Date.now()}@teste.ecoradar.local`;
  await el(page, 'campo-nome').fill('Cidadão do Teste E2E');
  await el(page, 'campo-email-cadastro').fill(email);
  await el(page, 'campo-senha-cadastro').fill('TesteE2E2026');
  await el(page, 'campo-confirmacao').fill('TesteE2E2026');
  await el(page, 'campo-bairro').fill('Mooca');
  await print(page, '06_cadastro_preenchido', info);
  await el(page, 'botao-cadastrar').click();
  await expect(el(page, 'tela-mapa')).toBeVisible();
  await aguardarMapa(page);
  await print(page, '07_cadastro_concluido_mapa', info);

  // Sai e tenta entrar com a senha errada
  await el(page, 'aba-perfil').click();
  await el(page, 'botao-sair').click();
  await expect(el(page, 'botao-entrar')).toBeVisible();
  await el(page, 'campo-email').fill(email);
  await el(page, 'campo-senha').fill('senhaErrada1');
  await el(page, 'botao-entrar').click();
  await expect(el(page, 'erro-login')).toContainText('E-mail ou senha incorretos');
  await print(page, '08_login_senha_invalida', info);
  await el(page, 'campo-senha').fill('TesteE2E2026');
  await el(page, 'botao-entrar').click();
  await expect(el(page, 'tela-mapa')).toBeVisible();
  await aguardarMapa(page);
  await print(page, '09_login_sucesso', info);
  expect(await context.cookies()).toBeDefined();
  await salvarVideo(page, '01-onboarding-cadastro-login', info);
});

test('02 · mapa com ocorrências, mananciais e estações; filtro por categoria', async ({ page, context }, info) => {
  await autenticarContexto(context, 'ana@ecoradar.local');
  await page.goto('/');
  await aguardarMapa(page);
  await expect(el(page, 'indicador-tempo-real')).toContainText('AO VIVO');
  await expect(page.locator('.eco-estacao').first()).toBeVisible();
  await expect(page.locator('path.leaflet-interactive').first()).toBeVisible(); // polígonos dos mananciais
  await print(page, '10_mapa_ocorrencias_mananciais_estacoes', info);
  await el(page, 'botao-legenda').click();
  await expect(el(page, 'legenda-mapa')).toBeVisible();
  await print(page, '11_mapa_legenda', info);
  await el(page, 'botao-legenda').click();
  const totalAntes = await page.locator('.eco-marcador').count();
  await el(page, 'filtro-ALAGAMENTO').click();
  await page.waitForTimeout(800);
  const totalDepois = await page.locator('.eco-marcador').count();
  expect(totalDepois).toBeLessThan(totalAntes);
  await print(page, '12_mapa_filtro_alagamento', info);
  await page.locator('.eco-marcador').first().click({ force: true });
  await expect(el(page, 'cartao-selecao')).toBeVisible();
  await print(page, '13_mapa_ocorrencia_selecionada', info);
  await salvarVideo(page, '02-mapa-filtros', info);
});

test('03 · registro completo com foto e aviso de área de manancial', async ({ page, context }, info) => {
  // GPS dentro da área (aproximada) da represa Guarapiranga
  await context.setGeolocation({ latitude: -23.765, longitude: -46.77 });
  await autenticarContexto(context, 'elisa@ecoradar.local');
  await page.goto('/');
  await aguardarMapa(page);
  await el(page, 'botao-registrar').click();
  await expect(el(page, 'tela-nova-ocorrencia')).toBeVisible();
  await el(page, 'categoria-INVASAO_MANANCIAL').click();
  await el(page, 'severidade-ALTA').click();
  const descricao = `E2E: construção irregular na margem da represa ${randomUUID().slice(0, 8)}`;
  await el(page, 'campo-descricao').fill(descricao);
  const [seletor] = await Promise.all([page.waitForEvent('filechooser'), el(page, 'botao-galeria').click()]);
  await seletor.setFiles(FOTO_TESTE);
  await expect(el(page, 'previa-foto')).toBeVisible();
  await print(page, '14_registro_formulario_foto', info);
  await expect(el(page, 'aviso-manancial')).toContainText('Represa Guarapiranga', { timeout: 30_000 });
  await el(page, 'aviso-manancial').scrollIntoViewIfNeeded();
  await print(page, '15_registro_localizacao_aviso_manancial', info);
  await el(page, 'botao-enviar-ocorrencia').click();
  await expect(el(page, 'tela-detalhe')).toBeVisible();
  await expect(el(page, 'foto-detalhe')).toBeVisible();
  await expect(page.getByText('Ocorrência registrada com sucesso')).toBeVisible();
  await print(page, '16_registro_concluido_detalhe', info);
  // Confere no backend (PostGIS marcou a área de manancial)
  const s = await sessaoApi('elisa@ecoradar.local');
  const r = await req('GET', `/api/ocorrencias?busca=${encodeURIComponent(descricao)}&minhas=true`, { token: s.token });
  expect(r.corpo.total).toBe(1);
  expect(r.corpo.itens[0].emAreaDeManancial).toBe(true);
  expect(r.corpo.itens[0].fotoUrl).toMatch(/^\/uploads\//);
  await salvarVideo(page, '03-registro-com-foto-manancial', info);
});
