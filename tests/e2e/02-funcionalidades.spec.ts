/**
 * Roteiro E2E — parte 2 (Pixel 7): detalhe e confirmação, qualidade ambiental, tempo real
 * entre dois dispositivos, alerta disparado pelo admin, modo offline, relatórios, status,
 * painel do agente e tema escuro.
 */
import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { REGISTROS } from '../utils/api.js';
import { ladoALado } from '../utils/imagem.js';
import { FOTO_TESTE, PASTA_PRINTS, aguardarMapa, autenticarContexto, contadorMapa, el, novoAparelho, print, req, salvarVideo, sessaoApi } from './apoio.js';

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({}, info) => {
  test.skip(info.project.name !== 'pixel-7', 'O roteiro completo roda no Pixel 7; o iPhone 14 executa a navegação pelas telas principais.');
});

test('04 · detalhe da ocorrência e confirmação colaborativa', async ({ page, context }, info) => {
  const bruno = await autenticarContexto(context, 'bruno@ecoradar.local');
  // Uma ocorrência aberta de OUTRO cidadão, ainda não confirmada pelo Bruno
  const lista = await req('GET', '/api/ocorrencias?status=ABERTA&tamanhoPagina=50', { token: bruno.token });
  let alvo: { id: string; confirmacoes: number } | undefined;
  for (const o of lista.corpo.itens.filter((x: { usuarioId: string }) => x.usuarioId !== bruno.usuario.id)) {
    const d = await req('GET', `/api/ocorrencias/${o.id}`, { token: bruno.token });
    if (!d.corpo.confirmadoPorMim) {
      alvo = d.corpo;
      break;
    }
  }
  expect(alvo, 'ocorrência aberta de outro cidadão').toBeDefined();
  await page.goto(`/ocorrencia/${alvo!.id}`);
  await expect(el(page, 'tela-detalhe')).toBeVisible();
  await expect(el(page, 'historico')).toBeVisible();
  await print(page, '17_detalhe_ocorrencia', info);
  await el(page, 'botao-confirmar').click();
  await expect(el(page, 'botao-confirmar')).toContainText('Você confirmou');
  await expect(el(page, 'contador-confirmacoes')).toContainText(String(alvo!.confirmacoes + 1));
  await print(page, '18_detalhe_confirmacao_colaborativa', info);
  const depois = await req('GET', `/api/ocorrencias/${alvo!.id}`, { token: bruno.token });
  expect(depois.corpo.confirmacoes).toBe(alvo!.confirmacoes + 1);
  await salvarVideo(page, '04-detalhe-confirmacao', info);
});

test('05 · qualidade ambiental: IQAr, Open-Meteo e gráfico de 24 h', async ({ page, context }, info) => {
  await autenticarContexto(context, 'ana@ecoradar.local');
  await page.goto('/ambiental');
  await expect(el(page, 'cartao-iqar-cidade')).toBeVisible();
  await expect(el(page, 'fonte-open-meteo')).toContainText(/AO VIVO|DADOS EM CACHE/);
  await print(page, '19_ambiental_iqar_open_meteo', info);
  await el(page, 'cartao-grafico').scrollIntoViewIfNeeded();
  await expect(el(page, 'cartao-grafico').locator('svg').first()).toBeVisible();
  await print(page, '20_ambiental_grafico_24h', info);
  await el(page, 'estacao-est-ipiranga').scrollIntoViewIfNeeded();
  await print(page, '21_ambiental_estacoes', info);
  await salvarVideo(page, '05-qualidade-ambiental', info);
});

test('06 · tempo real entre dois dispositivos (Socket.IO)', async ({ browser }, info) => {
  const ctxA = await novoAparelho(browser, info);
  const ctxB = await novoAparelho(browser, info);
  await autenticarContexto(ctxA, 'camila@ecoradar.local');
  await autenticarContexto(ctxB, 'diego@ecoradar.local');
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  await b.goto('/');
  await aguardarMapa(b);
  await expect(el(b, 'indicador-tempo-real')).toContainText('AO VIVO');
  const antes = await contadorMapa(b);
  const pasta = PASTA_PRINTS(info.project.name);
  mkdirSync(pasta, { recursive: true });
  await b.screenshot({ path: resolve(pasta, '22a_dispositivo_B_antes.png') });

  await a.goto('/ocorrencia/nova');
  await expect(el(a, 'tela-nova-ocorrencia')).toBeVisible();
  await el(a, 'categoria-QUEIMADA').click();
  await el(a, 'severidade-CRITICA').click();
  await el(a, 'campo-descricao').fill(`E2E tempo real: fogo em terreno baldio ${randomUUID().slice(0, 6)}`);
  await expect(el(a, 'coordenadas')).toContainText('-23.55');
  await el(a, 'botao-enviar-ocorrencia').click();
  await expect(el(a, 'tela-detalhe')).toBeVisible();

  // B vê a nova ocorrência aparecer no mapa SEM recarregar a página
  await expect.poll(() => contadorMapa(b), { timeout: 20_000 }).toBe(antes + 1);
  await b.waitForTimeout(800);
  await a.screenshot({ path: resolve(pasta, '22b_dispositivo_A_registrou.png') });
  await b.screenshot({ path: resolve(pasta, '22c_dispositivo_B_recebeu.png') });
  const composicao = resolve(pasta, '22_tempo_real_dois_dispositivos.png');
  await ladoALado(
    [
      { caminho: resolve(pasta, '22a_dispositivo_B_antes.png'), rotulo: `B antes: ${antes} em aberto` },
      { caminho: resolve(pasta, '22b_dispositivo_A_registrou.png'), rotulo: 'A registra uma queimada' },
      { caminho: resolve(pasta, '22c_dispositivo_B_recebeu.png'), rotulo: `B sem recarregar: ${antes + 1}` },
    ],
    composicao,
  );
  await info.attach('22_tempo_real_dois_dispositivos', { path: composicao, contentType: 'image/png' });
  await salvarVideo(a, '06-tempo-real-dispositivo-A', info);
  await salvarVideo(b, '06-tempo-real-dispositivo-B', info);
  await ctxA.close();
  await ctxB.close();
});

test('07 · alerta disparado pelo ADMIN chega ao cidadão (banner + badge)', async ({ browser }, info) => {
  const admin = await sessaoApi('admin@ecoradar.local');
  // Estação pluviométrica sem alerta de alagamento nos últimos 30 min (regra de deduplicação)
  const recentes = await req('GET', '/api/alertas?status=TODOS&tipo=RISCO_ALAGAMENTO', { token: admin.token });
  const usadas = new Set(
    recentes.corpo.itens
      .filter((x: { criadoEm: string }) => Date.now() - new Date(x.criadoEm).getTime() < 31 * 60_000)
      .map((x: { referenciaId: string }) => x.referenciaId),
  );
  const estacoes: Record<string, { latitude: number; longitude: number }> = {
    'est-ipiranga': { latitude: -23.5866, longitude: -46.6103 },
    'est-itaquera': { latitude: -23.5392, longitude: -46.4553 },
    'est-santo-amaro': { latitude: -23.6536, longitude: -46.7101 },
  };
  const estacao = Object.keys(estacoes).find((e) => !usadas.has(e));
  test.skip(!estacao, 'Todas as estações pluviométricas tiveram alerta nos últimos 30 min (deduplicação). Rode novamente mais tarde.');

  const ctxAdmin = await novoAparelho(browser, info);
  const ctxCidadao = await novoAparelho(browser, info, { geolocation: estacoes[estacao!] });
  await autenticarContexto(ctxAdmin, 'admin@ecoradar.local');
  await autenticarContexto(ctxCidadao, 'ana@ecoradar.local');
  const painel = await ctxAdmin.newPage();
  const cidadao = await ctxCidadao.newPage();
  await cidadao.goto('/');
  await aguardarMapa(cidadao);
  await expect(el(cidadao, 'indicador-tempo-real')).toContainText('AO VIVO');

  await painel.goto('/painel');
  await expect(el(painel, 'painel-admin')).toBeVisible();
  await el(painel, 'cenario-ALAGAMENTO').click();
  await el(painel, `estacao-cenario-${estacao}`).click();
  await el(painel, 'botao-disparar-cenario').click();
  await expect(el(painel, 'aviso-painel')).toContainText('Cenário ALAGAMENTO ativado');
  const pasta = PASTA_PRINTS(info.project.name);
  mkdirSync(pasta, { recursive: true });
  await painel.screenshot({ path: resolve(pasta, '23a_admin_dispara_cenario.png') });

  await expect(el(cidadao, 'banner-alerta')).toBeVisible({ timeout: 60_000 });
  await expect(el(cidadao, 'banner-alerta')).toContainText(/alagamento|Transbordamento/i);
  await cidadao.screenshot({ path: resolve(pasta, '23b_cidadao_recebe_alerta.png') });
  const composicao = resolve(pasta, '23_alerta_admin_e_cidadao.png');
  await ladoALado(
    [
      { caminho: resolve(pasta, '23a_admin_dispara_cenario.png'), rotulo: 'ADMIN aciona o cenário' },
      { caminho: resolve(pasta, '23b_cidadao_recebe_alerta.png'), rotulo: 'Cidadão recebe o alerta' },
    ],
    composicao,
  );
  await info.attach('23_alerta_admin_e_cidadao', { path: composicao, contentType: 'image/png' });

  // Lista de alertas (a aba mostrava o contador de não lidos)
  await el(cidadao, 'aba-alertas').click();
  await expect(el(cidadao, 'tela-alertas')).toContainText(/Risco de alagamento|Transbordamento/);
  await cidadao.screenshot({ path: resolve(pasta, '24_alertas_ativos.png') });
  await req('POST', '/api/simulador/cenario', { token: admin.token, corpo: { tipo: 'NORMAL' } });
  await salvarVideo(painel, '07-alerta-admin', info);
  await salvarVideo(cidadao, '07-alerta-cidadao', info);
  await ctxAdmin.close();
  await ctxCidadao.close();
});

test('08 · modo offline: fila pendente, sincronização e idempotência', async ({ page, context }, info) => {
  const sessao = await autenticarContexto(context, 'diego@ecoradar.local');
  await page.goto('/');
  await aguardarMapa(page); // dados (inclusive mananciais) ficam em cache
  await el(page, 'botao-registrar').click();
  await expect(el(page, 'tela-nova-ocorrencia')).toBeVisible();

  await context.setOffline(true);
  await expect(el(page, 'faixa-offline')).toContainText('Você está offline');
  const descricao = `E2E offline: entulho na calçada ${randomUUID().slice(0, 8)}`;
  await el(page, 'categoria-DESCARTE_IRREGULAR_LIXO').click();
  await el(page, 'campo-descricao').fill(descricao);
  const [seletor] = await Promise.all([page.waitForEvent('filechooser'), el(page, 'botao-galeria').click()]);
  await seletor.setFiles(FOTO_TESTE);
  await expect(el(page, 'previa-foto')).toBeVisible();
  await expect(el(page, 'botao-enviar-ocorrencia')).toContainText('Salvar para enviar depois');
  await print(page, '25_offline_registro', info);
  await el(page, 'botao-enviar-ocorrencia').click();
  await expect(el(page, 'tela-envios')).toBeVisible();
  await expect(el(page, 'envio-pendente')).toBeVisible();
  await print(page, '26_offline_fila_pendente', info);

  // Reconecta: a fila é sincronizada automaticamente
  await context.setOffline(false);
  await expect(el(page, 'envio-sincronizado')).toBeVisible({ timeout: 45_000 });
  await print(page, '27_offline_sincronizado', info);

  // Idempotência: existe UMA única ocorrência com essa descrição
  const r = await req('GET', `/api/ocorrencias?busca=${encodeURIComponent(descricao)}`, { token: sessao.token });
  expect(r.corpo.total).toBe(1);
  expect(r.corpo.itens[0].fotoUrl).toMatch(/^\/uploads\//);
  // Reenvio da mesma chave (simula uma retransmissão) também não duplica
  const chave = await page.evaluate(() => JSON.parse(localStorage.getItem('ecoradar.fila-offline') ?? '{}').state?.itens?.[0]?.idempotencyKey);
  expect(chave).toBeTruthy();
  const reenvio = await req('POST', '/api/ocorrencias', {
    token: sessao.token,
    corpo: { categoria: 'DESCARTE_IRREGULAR_LIXO', severidade: 'MEDIA', descricao, latitude: -23.5505, longitude: -46.6333, idempotencyKey: chave },
  });
  expect(reenvio.status).toBe(200);
  expect(reenvio.corpo.id).toBe(r.corpo.itens[0].id);
  const r2 = await req('GET', `/api/ocorrencias?busca=${encodeURIComponent(descricao)}`, { token: sessao.token });
  expect(r2.corpo.total).toBe(1);
  await salvarVideo(page, '08-modo-offline-idempotencia', info);
});

test('09 · relatórios com gráficos e exportação PDF/CSV', async ({ page, context }, info) => {
  await autenticarContexto(context, 'admin@ecoradar.local');
  await page.goto('/relatorios');
  await expect(el(page, 'tela-relatorios')).toBeVisible();
  await expect(el(page, 'grafico-status')).toBeVisible();
  await print(page, '28_relatorios_indicadores', info);
  await el(page, 'grafico-categorias').scrollIntoViewIfNeeded();
  await print(page, '29_relatorios_graficos', info);
  await el(page, 'grafico-diario').scrollIntoViewIfNeeded();
  await print(page, '30_relatorios_serie_diaria', info);
  const pastaDownloads = resolve(REGISTROS, 'testes', 'e2e', 'downloads');
  mkdirSync(pastaDownloads, { recursive: true });
  await el(page, 'botao-exportar-pdf').scrollIntoViewIfNeeded();
  const [pdf] = await Promise.all([page.waitForEvent('download'), el(page, 'botao-exportar-pdf').click()]);
  await pdf.saveAs(resolve(pastaDownloads, pdf.suggestedFilename()));
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
  await expect(el(page, 'aviso-relatorio')).toBeVisible();
  await print(page, '31_relatorios_exportacao', info);
  const [csv] = await Promise.all([page.waitForEvent('download'), el(page, 'botao-exportar-csv').click()]);
  await csv.saveAs(resolve(pastaDownloads, csv.suggestedFilename()));
  expect(csv.suggestedFilename()).toMatch(/\.csv$/);
  await salvarVideo(page, '09-relatorios-exportacao', info);
});

test('10 · status do sistema: microsserviços online, balanceamento e integrações', async ({ page, context }, info) => {
  await autenticarContexto(context, 'admin@ecoradar.local');
  await page.goto('/status');
  await expect(el(page, 'resumo-status')).toContainText('Todos os serviços online', { timeout: 30_000 });
  await print(page, '32_status_microsservicos', info);
  await el(page, 'botao-testar-balanceamento').scrollIntoViewIfNeeded();
  await el(page, 'botao-testar-balanceamento').click();
  await expect(el(page, 'cartao-balanceamento')).toContainText('ocorrencias-1');
  await expect(el(page, 'cartao-balanceamento')).toContainText('ocorrencias-2');
  await print(page, '33_status_balanceamento', info);
  await el(page, 'cartao-integracoes').scrollIntoViewIfNeeded();
  await expect(el(page, 'estado-circuito')).toContainText('FECHADO');
  await expect(el(page, 'estado-websocket')).toContainText('conectado');
  await print(page, '34_status_integracoes_tempo_real', info);
  await salvarVideo(page, '10-status-do-sistema', info);
});

test('11 · painel do agente alterando status', async ({ page, context }, info) => {
  const agente = await autenticarContexto(context, 'agente1@ecoradar.local');
  await page.goto('/painel');
  await expect(el(page, 'tela-painel')).toContainText('Fila de atendimento');
  await print(page, '35_painel_agente_fila', info);
  const primeiro = el(page, 'tela-painel').locator('[data-testid^="resolver-"]').first();
  // O Button do Paper também gera "<testID>-container"/"-text": extrai só o UUID
  const id = /resolver-([0-9a-f-]{36})/.exec((await primeiro.getAttribute('data-testid')) ?? '')![1];
  await primeiro.click();
  await expect(el(page, 'dialogo-status')).toBeVisible();
  await el(page, 'campo-comentario-status').fill('Equipe esteve no local e resolveu o problema (teste E2E).');
  await print(page, '36_painel_dialogo_status', info);
  await el(page, 'botao-salvar-status').click();
  await expect(el(page, 'aviso-painel')).toContainText('Status atualizado');
  await print(page, '37_painel_status_alterado', info);
  const d = await req('GET', `/api/ocorrencias/${id}`, { token: agente.token });
  expect(d.corpo.status).toBe('RESOLVIDA');
  expect(d.corpo.historico.at(-1).comentario).toContain('teste E2E');
  await salvarVideo(page, '11-painel-do-agente', info);
});

test('12 · tema escuro em várias telas', async ({ page, context }, info) => {
  await autenticarContexto(context, 'ana@ecoradar.local');
  await page.goto('/perfil');
  await el(page, 'tema-escuro').click();
  await page.waitForTimeout(500);
  await print(page, '38_escuro_perfil', info);
  await el(page, 'aba-mapa').click();
  await aguardarMapa(page);
  await print(page, '39_escuro_mapa', info);
  await el(page, 'aba-ocorrencias').click();
  await expect(el(page, 'tela-lista')).toBeVisible();
  await page.waitForTimeout(1000);
  await print(page, '40_escuro_lista', info);
  await el(page, 'aba-ambiental').click();
  await expect(el(page, 'cartao-iqar-cidade')).toBeVisible();
  await print(page, '41_escuro_ambiental', info);
  await page.goto('/relatorios');
  await expect(el(page, 'grafico-status')).toBeVisible();
  await print(page, '42_escuro_relatorios', info);
  await el(page, 'grafico-categorias').scrollIntoViewIfNeeded();
  await print(page, '43_escuro_relatorios_graficos', info);
  await salvarVideo(page, '12-tema-escuro', info);
});
