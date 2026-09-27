import {
  ClienteAmqp,
  ROTULOS_CATEGORIA,
  ROTULOS_SEVERIDADE,
  ROTULOS_STATUS,
  aguardarBanco,
  autenticar,
  cidadePadrao,
  configurarEncerramento,
  criarDb,
  criarLogger,
  criarPool,
  criarServidor,
  env,
  executarMigracoes,
  iniciarServidor,
  registrarJwt,
  resolverPastaMigracoes,
  seguranca,
  verificarBanco,
} from '@ecoradar/shared';
import * as schema from './db/schema.js';
import { filtrosRelatorioSchema, gerarCsv, montarEstatisticas } from './dominio/relatorio.js';
import { gerarPdf } from './pdf.js';
import { aplicarEvento, buscarOcorrencias, descreverFiltros, resumoAlertas } from './projecao.js';

const SERVICO = 'relatorios-service';
const logger = criarLogger(SERVICO);

function carimbo(d = new Date()) {
  const p = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(d);
  return p.replace(/[-:]/g, '').replace(' ', '-');
}

async function main() {
  const pool = criarPool(env('DATABASE_URL'), SERVICO, logger);
  const db = criarDb(pool, schema);
  await aguardarBanco(pool, logger);
  await executarMigracoes(pool, db, { pasta: resolverPastaMigracoes(import.meta.url), schema: env('DB_SCHEMA', 'relatorios'), logger });

  const amqp = new ClienteAmqp({ url: env('AMQP_URL'), nomeServico: SERVICO, logger });
  await amqp.assinar('relatorios.eventos', ['ocorrencia.*', 'alerta.*'], (evento) => aplicarEvento(db, evento, logger), 20);
  amqp.iniciar();

  const app = await criarServidor({
    nome: SERVICO,
    prefixo: '/api/relatorios',
    titulo: 'EcoRadar Urbano — relatorios-service',
    descricao:
      'Visão de leitura (CQRS) alimentada pelos eventos de ocorrências e alertas; estatísticas consolidadas e ' +
      'exportação em CSV e PDF (gráficos desenhados com pdfkit).',
    logger,
    prontidao: { banco: () => verificarBanco(pool), broker: () => amqp.conectado },
    tags: [{ name: 'Relatórios', description: 'Estatísticas e exportações' }],
  });
  await registrarJwt(app);

  app.get('/api/relatorios/estatisticas', {
    preHandler: autenticar,
    schema: {
      tags: ['Relatórios'],
      summary: 'Totais por categoria/status/severidade, série de 30 dias, tempo médio de resolução, áreas críticas e confirmação',
      security: seguranca,
      querystring: filtrosRelatorioSchema,
    },
    handler: async (req) => {
      const [ocorrencias, alertas] = await Promise.all([buscarOcorrencias(db, req.query), resumoAlertas(db, req.query)]);
      return {
        geradoEm: new Date().toISOString(),
        filtros: descreverFiltros(req.query),
        ...montarEstatisticas(ocorrencias, new Date()),
        alertas,
      };
    },
  });

  app.get('/api/relatorios/exportar.csv', {
    preHandler: autenticar,
    schema: { tags: ['Relatórios'], summary: 'Exporta as ocorrências filtradas em CSV (separador ";", UTF-8)', security: seguranca, querystring: filtrosRelatorioSchema },
    handler: async (req, reply) => {
      const linhas = await buscarOcorrencias(db, req.query);
      const csv = gerarCsv(
        ['id', 'registrada_em', 'categoria', 'severidade', 'status', 'bairro', 'latitude', 'longitude', 'confirmacoes', 'area_de_manancial', 'resolvida_em', 'descricao'],
        linhas.map((o) => [
          o.id,
          o.criadoEm,
          ROTULOS_CATEGORIA[o.categoria],
          ROTULOS_SEVERIDADE[o.severidade],
          ROTULOS_STATUS[o.status],
          o.bairro,
          o.latitude.toFixed(6),
          o.longitude.toFixed(6),
          o.confirmacoes,
          o.emAreaDeManancial ? o.manancialNome ?? 'sim' : 'não',
          o.resolvidoEm,
          o.descricao,
        ]),
      );
      req.log.info({ linhas: linhas.length }, 'CSV exportado');
      return reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="ecoradar-ocorrencias-${carimbo()}.csv"`)
        .send(csv);
    },
  });

  app.get('/api/relatorios/exportar.pdf', {
    preHandler: autenticar,
    schema: { tags: ['Relatórios'], summary: 'Exporta o relatório em PDF (cabeçalho, indicadores, gráficos e tabelas)', security: seguranca, querystring: filtrosRelatorioSchema },
    handler: async (req, reply) => {
      const [ocorrencias, alertas] = await Promise.all([buscarOcorrencias(db, req.query), resumoAlertas(db, req.query)]);
      const pdf = await gerarPdf({
        cidade: cidadePadrao().nome,
        geradoEm: new Date(),
        filtros: descreverFiltros(req.query),
        estatisticas: montarEstatisticas(ocorrencias, new Date()),
        alertas: { total: alertas.total, ativos: alertas.ativos, porTipo: alertas.porTipo.filter((t) => t.total > 0) },
        ultimas: ocorrencias.slice(0, 40),
      });
      req.log.info({ bytes: pdf.length, ocorrencias: ocorrencias.length }, 'PDF gerado');
      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="ecoradar-relatorio-${carimbo()}.pdf"`)
        .send(pdf);
    },
  });

  configurarEncerramento(logger, [
    { nome: 'servidor HTTP', executar: () => app.close() },
    { nome: 'conexão AMQP', executar: () => amqp.fechar() },
    { nome: 'pool do PostgreSQL', executar: () => pool.end() },
  ]);
  await iniciarServidor(app);
}

main().catch((erro) => {
  logger.fatal({ err: erro }, 'Falha ao iniciar o serviço');
  process.exit(1);
});
