import { z } from 'zod';
import { type AppFastify, type ClienteAmqp, Erros, ROTULOS_CLASSE_IQAR, cidadePadrao, exigirPerfil, seguranca } from '@ecoradar/shared';
import { classeDoIndice } from './dominio/iqar.js';
import { interpretarPeriodo } from './dominio/leitura.js';
import type { IntegracaoOpenMeteo } from './integracoes/open-meteo.js';
import type { AssinanteMqtt } from './integracoes/mqtt.js';
import type { ProcessadorLeituras } from './processador.js';
import * as repo from './repositorio.js';

export interface DependenciasRotas {
  db: repo.Db;
  openMeteo: IntegracaoOpenMeteo;
  mqtt: AssinanteMqtt;
  amqp: ClienteAmqp;
  processador: ProcessadorLeituras;
}

export async function registrarRotas(app: AppFastify, deps: DependenciasRotas) {
  const { db, openMeteo, mqtt, amqp, processador } = deps;

  app.get('/api/ambiental/estacoes', {
    schema: {
      tags: ['Estações'],
      summary: 'Estações ambientais com a leitura mais recente, IQAr, inversão térmica e nível do córrego',
    },
    handler: async () => repo.estacoesComUltimaLeitura(db),
  });

  app.get('/api/ambiental/estacoes/:id/leituras', {
    schema: {
      tags: ['Estações'],
      summary: 'Série temporal agregada da estação (ex.: periodo=24h, 6h, 7d)',
      params: z.object({ id: z.string().min(1).max(60) }),
      querystring: z.object({ periodo: z.string().regex(/^\d{1,3}[hd]$/, { message: 'Use, por exemplo, 6h, 24h ou 7d.' }).default('24h') }),
    },
    handler: async (req) => {
      if (!(await repo.estacaoExiste(db, req.params.id))) throw Erros.naoEncontrado('Estação');
      let periodo: { horas: number; baldeMinutos: number };
      try {
        periodo = interpretarPeriodo(req.query.periodo);
      } catch (erro) {
        throw Erros.validacao((erro as Error).message);
      }
      return {
        estacaoId: req.params.id,
        periodo: req.query.periodo,
        intervaloMinutos: periodo.baldeMinutos,
        pontos: await repo.serieTemporal(db, req.params.id, periodo.horas, periodo.baldeMinutos),
      };
    },
  });

  app.get('/api/ambiental/resumo', {
    schema: {
      tags: ['Resumo'],
      summary: 'Resumo ambiental da cidade: IQAr por estação, clima e dados da Open-Meteo (com fonte e horário)',
      querystring: z.object({
        atualizar: z
          .enum(['true', 'false'])
          .optional()
          .transform((v) => v === 'true'),
      }),
    },
    handler: async (req) => {
      const [estacoes, externo] = await Promise.all([repo.estacoesComUltimaLeitura(db), openMeteo.obter(req.query.atualizar)]);
      const comIqar = estacoes.filter((e) => e.iqar);
      const pior = comIqar.reduce<(typeof comIqar)[number] | null>((a, e) => (!a || e.iqar!.indice > a.iqar!.indice ? e : a), null);
      const media = comIqar.length ? Math.round(comIqar.reduce((s, e) => s + e.iqar!.indice, 0) / comIqar.length) : null;
      const temperaturas = estacoes.map((e) => e.leitura?.temperatura).filter((t): t is number => typeof t === 'number');
      return {
        cidade: cidadePadrao(),
        geradoEm: new Date().toISOString(),
        indicadores: {
          iqarMedio: media,
          iqarMedioClasse: media === null ? null : classeDoIndice(media),
          iqarMedioRotulo: media === null ? null : ROTULOS_CLASSE_IQAR[classeDoIndice(media)],
          piorEstacao: pior ? { id: pior.id, nome: pior.nome, iqar: pior.iqar } : null,
          temperaturaMedia: temperaturas.length ? Math.round((temperaturas.reduce((a, b) => a + b, 0) / temperaturas.length) * 10) / 10 : null,
          estacoesOnline: estacoes.filter((e) => e.online).length,
          estacoesTotal: estacoes.length,
          inversaoTermicaAtiva: estacoes.some((e) => e.inversao.ativa),
          corregosEmAlerta: estacoes.filter((e) => e.corrego?.situacao === 'ALERTA' || e.corrego?.situacao === 'EXTRAVASAMENTO').length,
        },
        estacoes,
        openMeteo: externo,
        fonteMetodologia: 'IQAr conforme faixas da CETESB (Resolução CONAMA nº 491/2018).',
      };
    },
  });

  app.get('/api/ambiental/status-integracoes', {
    schema: { tags: ['Sistema'], summary: 'Estado do circuit breaker da Open-Meteo e das conexões MQTT/AMQP' },
    handler: async () => ({
      openMeteo: openMeteo.status(),
      mqtt: { conectado: mqtt.conectado, ...mqtt.estatisticas },
      amqp: { conectado: amqp.conectado },
      processamento: processador.estatisticas,
    }),
  });

  app.post('/api/ambiental/integracoes/simular-falha', {
    preHandler: exigirPerfil('ADMIN'),
    schema: {
      tags: ['Sistema'],
      summary: 'Liga/desliga a falha simulada da Open-Meteo (somente ADMIN) — demonstra o circuit breaker',
      security: seguranca,
      body: z.object({ ativo: z.boolean() }),
    },
    handler: async (req) => {
      openMeteo.simularFalha(req.body.ativo);
      req.log.warn({ ativo: req.body.ativo, por: req.user.sub }, 'Falha simulada da Open-Meteo alterada');
      return openMeteo.status();
    },
  });
}
