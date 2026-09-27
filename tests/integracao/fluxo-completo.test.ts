/**
 * Testes de integração (stack real, via gateway): fluxo completo de ponta a ponta e
 * respostas de erro. Os arquivos exportados (PDF/CSV) são salvos em registros/testes/integracao.
 */
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { io } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { API, REGISTROS, aguardar, login, novaOcorrencia, req } from '../utils/api.js';
import { pdfParaPng } from '../utils/pdf.js';

const SAIDA = resolve(REGISTROS, 'testes', 'integracao');
const FOTO = readFileSync(resolve(REGISTROS, '..', 'tests', 'fixtures', 'foto-ocorrencia.jpg'));
mkdirSync(SAIDA, { recursive: true });

function formulario(dados: Record<string, unknown>, foto?: { conteudo: Buffer; tipo: string; nome: string }) {
  const f = new FormData();
  for (const [k, v] of Object.entries(dados)) f.append(k, String(v));
  if (foto) f.append('foto', new Blob([new Uint8Array(foto.conteudo)], { type: foto.tipo }), foto.nome);
  return f;
}

const contexto: {
  email: string;
  senha: string;
  tokenNovo: string;
  tokenAna: string;
  tokenAgente: string;
  tokenAdmin: string;
  ocorrenciaId: string;
  idempotencyKey: string;
  totalInicial: number;
  emAnaliseInicial: number;
} = {} as never;

beforeAll(async () => {
  contexto.email = `integracao.${Date.now()}@teste.ecoradar.local`;
  contexto.senha = 'Integracao2026';
  contexto.tokenAna = await login('ana@ecoradar.local');
  contexto.tokenAgente = await login('agente1@ecoradar.local');
  contexto.tokenAdmin = await login('admin@ecoradar.local');
  const est = await req('GET', '/api/relatorios/estatisticas', { token: contexto.tokenAdmin });
  contexto.totalInicial = est.corpo.total;
  contexto.emAnaliseInicial = est.corpo.porStatus.find((s: { chave: string }) => s.chave === 'EM_ANALISE').total;
});

describe('Fluxo completo via gateway', () => {
  it('1. cadastro de novo cidadão devolve token e perfil CIDADAO', async () => {
    const r = await req('POST', '/api/auth/registrar', { corpo: { nome: 'Cidadã de Integração', email: contexto.email, senha: contexto.senha, bairro: 'Ipiranga' } });
    expect(r.status).toBe(201);
    expect(r.corpo.usuario.perfil).toBe('CIDADAO');
    expect(r.corpo.token).toMatch(/^eyJ/);
    expect(r.cabecalhos.get('x-request-id')).toBeTruthy();
    expect(r.cabecalhos.get('x-instance-id')).toBe('auth-1');
  });

  it('2. login com as credenciais cadastradas', async () => {
    const r = await req('POST', '/api/auth/login', { corpo: { email: contexto.email, senha: contexto.senha } });
    expect(r.status).toBe(200);
    contexto.tokenNovo = r.corpo.token;
    const eu = await req('GET', '/api/auth/me', { token: contexto.tokenNovo });
    expect(eu.corpo.email).toBe(contexto.email);
  });

  it('3. cria ocorrência com foto (multipart) e a foto fica disponível em /uploads', async () => {
    contexto.idempotencyKey = randomUUID();
    const dados = { ...novaOcorrencia({ idempotencyKey: contexto.idempotencyKey, descricao: 'Integração: córrego transbordando na rua', severidade: 'ALTA' }) };
    const r = await req('POST', '/api/ocorrencias', { token: contexto.tokenNovo, form: formulario(dados, { conteudo: FOTO, tipo: 'image/jpeg', nome: 'foto.jpg' }) });
    expect(r.status).toBe(201);
    expect(r.corpo.fotoUrl).toMatch(/^\/uploads\/.+\.jpg$/);
    expect(r.corpo.bairro).toBe('Ipiranga');
    contexto.ocorrenciaId = r.corpo.id;
    const foto = await req('GET', r.corpo.fotoUrl);
    expect(foto.status).toBe(200);
    expect(foto.cabecalhos.get('content-type')).toBe('image/jpeg');
  });

  it('4. reenvio com a mesma idempotencyKey NÃO duplica (200 + mesmo id)', async () => {
    const dados = novaOcorrencia({ idempotencyKey: contexto.idempotencyKey, descricao: 'Integração: córrego transbordando na rua', severidade: 'ALTA' });
    const r = await req('POST', '/api/ocorrencias', { token: contexto.tokenNovo, corpo: dados });
    expect(r.status).toBe(200);
    expect(r.corpo.id).toBe(contexto.ocorrenciaId);
    expect(r.cabecalhos.get('x-idempotent-replay')).toBe('true');
    const busca = await req('GET', `/api/ocorrencias?busca=${encodeURIComponent('córrego transbordando')}&minhas=true`, { token: contexto.tokenNovo });
    expect(busca.corpo.total).toBe(1);
  });

  it('5. lista por raio (PostGIS ST_DWithin) com distância calculada', async () => {
    const r = await req('GET', '/api/ocorrencias?lat=-23.5866&lon=-46.6103&raioKm=1&ordenacao=distancia', { token: contexto.tokenAna });
    expect(r.status).toBe(200);
    const item = r.corpo.itens.find((o: { id: string }) => o.id === contexto.ocorrenciaId);
    expect(item).toBeDefined();
    expect(item.distanciaKm).toBeLessThan(0.05);
    expect(r.corpo.itens.every((o: { distanciaKm: number }) => o.distanciaKm <= 1)).toBe(true);
    const longe = await req('GET', '/api/ocorrencias?lat=-23.4550&lon=-46.7400&raioKm=1', { token: contexto.tokenAna });
    expect(longe.corpo.itens.some((o: { id: string }) => o.id === contexto.ocorrenciaId)).toBe(false);
  });

  it('6. confirmação colaborativa: outro cidadão confirma uma única vez; o autor não pode confirmar', async () => {
    const r = await req('POST', `/api/ocorrencias/${contexto.ocorrenciaId}/confirmar`, { token: contexto.tokenAna });
    expect(r.status).toBe(200);
    expect(r.corpo.confirmacoes).toBe(1);
    const repetida = await req('POST', `/api/ocorrencias/${contexto.ocorrenciaId}/confirmar`, { token: contexto.tokenAna });
    expect(repetida.status).toBe(409);
    expect(repetida.corpo.erro.codigo).toBe('JA_CONFIRMADA');
    const propria = await req('POST', `/api/ocorrencias/${contexto.ocorrenciaId}/confirmar`, { token: contexto.tokenNovo });
    expect(propria.status).toBe(409);
    expect(propria.corpo.erro.codigo).toBe('NAO_PODE_CONFIRMAR_PROPRIA');
  });

  it('7. agente altera o status (com comentário) e o histórico é gravado', async () => {
    const r = await req('PATCH', `/api/ocorrencias/${contexto.ocorrenciaId}/status`, {
      token: contexto.tokenAgente,
      corpo: { status: 'EM_ANALISE', comentario: 'Equipe de drenagem a caminho.' },
    });
    expect(r.status).toBe(200);
    expect(r.corpo.status).toBe('EM_ANALISE');
    const d = await req('GET', `/api/ocorrencias/${contexto.ocorrenciaId}`, { token: contexto.tokenAna });
    expect(d.corpo.historico.map((h: { statusNovo: string }) => h.statusNovo)).toEqual(['ABERTA', 'EM_ANALISE']);
    expect(d.corpo.historico[1].comentario).toBe('Equipe de drenagem a caminho.');
    expect(d.corpo.confirmadoPorMim).toBe(true);
  });

  it('8. estatísticas (CQRS, alimentadas por eventos) refletem a nova ocorrência e o status', async () => {
    const est = await aguardar(
      'visão de leitura atualizar',
      async () => {
        const r = await req('GET', '/api/relatorios/estatisticas', { token: contexto.tokenAdmin });
        const emAnalise = r.corpo.porStatus.find((s: { chave: string }) => s.chave === 'EM_ANALISE').total;
        return r.corpo.total >= contexto.totalInicial + 1 && emAnalise >= contexto.emAnaliseInicial + 1 ? r.corpo : false;
      },
      30_000,
    );
    expect(est.total).toBeGreaterThanOrEqual(contexto.totalInicial + 1);
    expect(est.serieDiaria).toHaveLength(30);
    expect(est.areasCriticas.length).toBeGreaterThan(0);
  });

  it('9. exporta PDF e CSV (arquivos salvos como evidência)', async () => {
    const pdf = await req('GET', '/api/relatorios/exportar.pdf', { token: contexto.tokenAdmin });
    expect(pdf.status).toBe(200);
    expect(pdf.cabecalhos.get('content-type')).toBe('application/pdf');
    const bufPdf = pdf.corpo as Buffer;
    expect(bufPdf.subarray(0, 5).toString()).toBe('%PDF-');
    const arquivoPdf = resolve(SAIDA, 'relatorio-exportado.pdf');
    writeFileSync(arquivoPdf, bufPdf);
    const paginas = await pdfParaPng(arquivoPdf, resolve(REGISTROS, 'screenshots', 'relatorios', 'relatorio-pdf'));
    expect(paginas.length).toBeGreaterThan(0);

    // Bytes crus: Response.text() removeria o BOM ao decodificar
    const csv = await fetch(`${API}/api/relatorios/exportar.csv`, { headers: { authorization: `Bearer ${contexto.tokenAdmin}` } });
    expect(csv.status).toBe(200);
    expect(String(csv.headers.get('content-disposition'))).toMatch(/attachment; filename="ecoradar-ocorrencias-.+\.csv"/);
    const bytes = Buffer.from(await csv.arrayBuffer());
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // BOM UTF-8 (acentos corretos no Excel)
    const texto = bytes.toString('utf-8');
    expect(texto).toContain('córrego transbordando');
    expect(texto.split('\r\n')[0]).toContain('registrada_em;categoria;severidade;status');
    writeFileSync(resolve(SAIDA, 'ocorrencias-exportadas.csv'), bytes);
  });

  it('10. dados ambientais: IQAr das estações e integração Open-Meteo', async () => {
    const r = await req('GET', '/api/ambiental/resumo');
    expect(r.status).toBe(200);
    expect(r.corpo.estacoes).toHaveLength(6);
    expect(r.corpo.indicadores.estacoesOnline).toBeGreaterThanOrEqual(5);
    expect(['BOA', 'MODERADA', 'RUIM', 'MUITO_RUIM', 'PESSIMA']).toContain(r.corpo.indicadores.iqarMedioClasse);
    expect(['ao_vivo', 'cache']).toContain(r.corpo.openMeteo.fonte);
    const serie = await req('GET', '/api/ambiental/estacoes/est-se/leituras?periodo=24h');
    expect(serie.corpo.pontos.length).toBeGreaterThan(20);
  });

  it('11. cenário do simulador gera alerta recebido por um cliente Socket.IO', async () => {
    const recebidos: Array<{ tipo: string; severidade: string; titulo: string }> = [];
    const socket = io(API, { path: '/socket.io', transports: ['websocket'], auth: { token: contexto.tokenAna } });
    await new Promise<void>((ok, falha) => {
      socket.on('connect', () => ok());
      socket.on('connect_error', falha);
    });
    socket.on('alerta:novo', (a) => recebidos.push(a));
    // Estação escolhida sem alerta do mesmo tipo nos últimos 30 min (regra de deduplicação)
    const recentes = await req('GET', '/api/alertas?status=TODOS&tipo=INVERSAO_TERMICA', { token: contexto.tokenAdmin });
    const usadas = new Set(
      recentes.corpo.itens.filter((a: { criadoEm: string }) => Date.now() - new Date(a.criadoEm).getTime() < 31 * 60_000).map((a: { referenciaId: string }) => a.referenciaId),
    );
    const estacao = ['est-santana', 'est-se', 'est-santo-amaro'].find((e) => !usadas.has(e)) ?? 'est-santana';
    const c = await req('POST', '/api/simulador/cenario', { token: contexto.tokenAdmin, corpo: { tipo: 'INVERSAO_TERMICA', estacaoId: estacao, duracaoSegundos: 60 } });
    expect(c.status).toBe(202);
    const alerta = await aguardar('alerta:novo via Socket.IO', async () => recebidos.find((a) => a.tipo === 'INVERSAO_TERMICA'), 45_000, 500);
    expect(alerta.titulo).toMatch(/Inversão térmica/);
    socket.close();
    await req('POST', '/api/simulador/cenario', { token: contexto.tokenAdmin, corpo: { tipo: 'NORMAL' } });
  });
});

describe('Respostas de erro padronizadas', () => {
  it('401 sem token e com token inválido', async () => {
    const a = await req('GET', '/api/ocorrencias');
    expect(a.status).toBe(401);
    expect(a.corpo.erro.codigo).toBe('NAO_AUTENTICADO');
    const b = await req('GET', '/api/auth/me', { token: 'eyJ.invalido.x' });
    expect(b.status).toBe(401);
  });

  it('401 para senha incorreta', async () => {
    const r = await req('POST', '/api/auth/login', { corpo: { email: contexto.email, senha: 'SenhaErrada123' } });
    expect(r.status).toBe(401);
    expect(r.corpo.erro.codigo).toBe('CREDENCIAIS_INVALIDAS');
  });

  it('403 quando um cidadão tenta alterar status ou trocar perfis', async () => {
    const r = await req('PATCH', `/api/ocorrencias/${contexto.ocorrenciaId}/status`, { token: contexto.tokenAna, corpo: { status: 'RESOLVIDA', comentario: 'x' } });
    expect(r.status).toBe(403);
    expect(r.corpo.erro.codigo).toBe('ACESSO_NEGADO');
    const p = await req('PATCH', `/api/auth/usuarios/${randomUUID()}/perfil`, { token: contexto.tokenAna, corpo: { perfil: 'ADMIN' } });
    expect(p.status).toBe(403);
  });

  it('404 para ocorrência inexistente e rota inexistente', async () => {
    const r = await req('GET', `/api/ocorrencias/${randomUUID()}`, { token: contexto.tokenAna });
    expect(r.status).toBe(404);
    expect(r.corpo.erro.codigo).toBe('NAO_ENCONTRADO');
    const rota = await req('GET', '/api/auth/nao-existe');
    expect(rota.status).toBe(404);
  });

  it('422 com detalhes por campo para dados inválidos', async () => {
    const r = await req('POST', '/api/ocorrencias', { token: contexto.tokenAna, corpo: { categoria: 'TERREMOTO', severidade: 'MEDIA', descricao: 'x', latitude: 200, longitude: 0, idempotencyKey: 'abc' } });
    expect(r.status).toBe(422);
    const campos = r.corpo.erro.detalhes.map((d: { campo: string }) => d.campo);
    expect(campos).toEqual(expect.arrayContaining(['categoria', 'descricao', 'latitude', 'idempotencyKey']));
    const cad = await req('POST', '/api/auth/registrar', { corpo: { nome: 'A', email: 'invalido', senha: '123' } });
    expect(cad.status).toBe(422);
  });

  it('413 para foto acima de 5 MB e 415 para arquivo que não é imagem', async () => {
    const grande = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(Math.round(5.5 * 1024 * 1024))]);
    const r = await req('POST', '/api/ocorrencias', { token: contexto.tokenAna, form: formulario(novaOcorrencia(), { conteudo: grande, tipo: 'image/jpeg', nome: 'grande.jpg' }) });
    expect(r.status).toBe(413);
    expect(r.corpo.erro.codigo).toBe('ARQUIVO_MUITO_GRANDE');
    const falsa = await req('POST', '/api/ocorrencias', { token: contexto.tokenAna, form: formulario(novaOcorrencia(), { conteudo: Buffer.from('%PDF-1.7 falso'), tipo: 'image/jpeg', nome: 'x.jpg' }) });
    expect(falsa.status).toBe(415);
  });

  it('409 para e-mail já cadastrado e chave de idempotência de outro usuário', async () => {
    const r = await req('POST', '/api/auth/registrar', { corpo: { nome: 'Repetida', email: contexto.email, senha: 'Outra12345' } });
    expect(r.status).toBe(409);
    expect(r.corpo.erro.codigo).toBe('EMAIL_JA_CADASTRADO');
    const outra = await req('POST', '/api/ocorrencias', { token: contexto.tokenAna, corpo: novaOcorrencia({ idempotencyKey: contexto.idempotencyKey }) });
    expect(outra.status).toBe(409);
    expect(outra.corpo.erro.codigo).toBe('IDEMPOTENCY_KEY_EM_USO');
  });

  it('todas as respostas trazem X-Request-Id e o formato { erro: { codigo, mensagem, requestId } }', async () => {
    const r = await req('GET', '/api/ocorrencias', { cabecalhos: { 'X-Request-Id': 'integracao-rastreio-123' } });
    expect(r.cabecalhos.get('x-request-id')).toBe('integracao-rastreio-123');
    expect(r.corpo.erro.requestId).toBe('integracao-rastreio-123');
  });
});

afterAll(async () => {
  await req('POST', '/api/simulador/cenario', { token: contexto.tokenAdmin, corpo: { tipo: 'NORMAL' } }).catch(() => undefined);
});
