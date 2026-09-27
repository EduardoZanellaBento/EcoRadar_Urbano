import CircuitBreaker from 'opossum';
import type { Logger } from 'pino';
import { CacheTTL, type ClasseIqar } from '@ecoradar/shared';
import { calcularIqar, coMicrogramasParaPpm } from '../dominio/iqar.js';
import { descricaoTempo } from '../dominio/indicadores.js';

export interface DadosExternos {
  ar: {
    horario: string | null;
    pm10: number | null;
    pm25: number | null;
    coPpm: number | null;
    no2: number | null;
    so2: number | null;
    o3: number | null;
    usAqi: number | null;
    europeanAqi: number | null;
    iqar: { indice: number; classe: ClasseIqar; poluenteDominante: string } | null;
  };
  clima: {
    horario: string | null;
    temperatura: number | null;
    sensacaoTermica: number | null;
    umidade: number | null;
    precipitacaoMm: number | null;
    codigoTempo: number | null;
    descricao: string;
    ventoKmh: number | null;
    nebulosidade: number | null;
    pressaoHpa: number | null;
    maximaDia: number | null;
    minimaDia: number | null;
    probabilidadeChuva: number | null;
  };
  obtidoEm: string;
}

export type FonteDados = 'ao_vivo' | 'cache' | 'indisponivel';

export interface RespostaExterna {
  fonte: FonteDados;
  atualizadoEm: string | null;
  idadeSegundos: number | null;
  motivo: string | null;
  estadoCircuito: EstadoCircuito;
  dados: DadosExternos | null;
}

export type EstadoCircuito = 'FECHADO' | 'ABERTO' | 'MEIO_ABERTO';

export interface PersistenciaCache {
  salvar(dados: DadosExternos): Promise<void>;
  carregar(): Promise<DadosExternos | null>;
}

export interface OpcoesOpenMeteo {
  urlAr: string;
  urlClima: string;
  latitude: number;
  longitude: number;
  timeoutMs: number;
  ttlMs: number;
  logger: Logger;
  persistencia?: PersistenciaCache;
  fetchFn?: typeof fetch;
  /** Configuração do circuit breaker (padrões de produção). */
  resetTimeoutMs?: number;
  volumeThreshold?: number;
}

const CHAVE = 'open-meteo';
/** Host inexistente (TLD reservado .invalid, RFC 2606) usado na falha simulada: gera erro de rede real. */
const URL_FALHA_SIMULADA = 'https://falha-simulada.open-meteo.invalid/v1';

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * Cliente da API Open-Meteo (qualidade do ar + clima) com:
 *  - timeout por requisição (AbortSignal);
 *  - circuit breaker (opossum): após falhas seguidas o circuito ABRE e as chamadas
 *    seguintes falham imediatamente, sem sobrecarregar a API; depois de resetTimeout ele
 *    fica MEIO_ABERTO e testa uma chamada;
 *  - cache de 10 min; se a API falhar, serve o último valor (fonte "cache") com o horário
 *    da última atualização — degradação graciosa.
 */
export class IntegracaoOpenMeteo {
  private readonly breaker: CircuitBreaker<[], DadosExternos>;
  private readonly cache: CacheTTL<DadosExternos>;
  private simulandoFalha = false;
  private ultimoSucessoEm: string | null = null;
  private ultimoErro: { mensagem: string; em: string } | null = null;
  private readonly log: Logger;
  private readonly fetchFn: typeof fetch;

  constructor(private readonly opcoes: OpcoesOpenMeteo) {
    this.log = opcoes.logger.child({ componente: 'open-meteo' });
    this.fetchFn = opcoes.fetchFn ?? fetch;
    this.cache = new CacheTTL<DadosExternos>(opcoes.ttlMs);
    this.breaker = new CircuitBreaker(() => this.buscar(), {
      name: 'open-meteo',
      timeout: opcoes.timeoutMs,
      errorThresholdPercentage: 50,
      resetTimeout: opcoes.resetTimeoutMs ?? 30_000,
      volumeThreshold: opcoes.volumeThreshold ?? 3,
      rollingCountTimeout: 60_000,
    });
    this.breaker.on('open', () => this.log.warn('Circuit breaker da Open-Meteo ABERTO: usando dados em cache'));
    this.breaker.on('halfOpen', () => this.log.info('Circuit breaker da Open-Meteo MEIO-ABERTO: testando a API'));
    this.breaker.on('close', () => this.log.info('Circuit breaker da Open-Meteo FECHADO: API normalizada'));
  }

  get estadoCircuito(): EstadoCircuito {
    if (this.breaker.opened) return 'ABERTO';
    if (this.breaker.halfOpen) return 'MEIO_ABERTO';
    return 'FECHADO';
  }

  /** Recupera o último valor persistido (útil após reinício do serviço). */
  async carregarCachePersistido(): Promise<void> {
    try {
      const dados = await this.opcoes.persistencia?.carregar();
      if (dados) {
        this.cache.definir(CHAVE, dados, new Date(dados.obtidoEm).getTime());
        this.ultimoSucessoEm = dados.obtidoEm;
        this.log.info({ obtidoEm: dados.obtidoEm }, 'Último valor da Open-Meteo recuperado do banco');
      }
    } catch (erro) {
      this.log.warn({ err: erro }, 'Não foi possível carregar o cache persistido da Open-Meteo');
    }
  }

  private async getJson(url: string): Promise<Record<string, unknown>> {
    const resposta = await this.fetchFn(url, {
      signal: AbortSignal.timeout(this.opcoes.timeoutMs),
      headers: { 'User-Agent': 'EcoRadarUrbano/1.0 (APS UNIP)' },
    });
    if (!resposta.ok) throw new Error(`Open-Meteo respondeu HTTP ${resposta.status}`);
    return (await resposta.json()) as Record<string, unknown>;
  }

  private async buscar(): Promise<DadosExternos> {
    const { latitude, longitude } = this.opcoes;
    const baseAr = this.simulandoFalha ? `${URL_FALHA_SIMULADA}/air-quality` : this.opcoes.urlAr;
    const baseClima = this.simulandoFalha ? `${URL_FALHA_SIMULADA}/forecast` : this.opcoes.urlClima;
    const comum = `latitude=${latitude}&longitude=${longitude}&timezone=America%2FSao_Paulo`;
    const [ar, clima] = await Promise.all([
      this.getJson(`${baseAr}?${comum}&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,us_aqi,european_aqi`),
      this.getJson(
        `${baseClima}?${comum}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,cloud_cover,surface_pressure&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=1`,
      ),
    ]);
    return IntegracaoOpenMeteo.converter(ar, clima);
  }

  /** Converte as respostas da API no formato do EcoRadar e calcula o IQAr (metodologia CETESB). */
  static converter(ar: Record<string, unknown>, clima: Record<string, unknown>): DadosExternos {
    const a = (ar.current ?? {}) as Record<string, unknown>;
    const c = (clima.current ?? {}) as Record<string, unknown>;
    const d = (clima.daily ?? {}) as Record<string, unknown[]>;
    const coUg = num(a.carbon_monoxide);
    const coPpm = coUg === null ? null : Math.round(coMicrogramasParaPpm(coUg) * 100) / 100;
    const iqar = calcularIqar({
      MP10: num(a.pm10),
      MP25: num(a.pm2_5),
      O3: num(a.ozone),
      NO2: num(a.nitrogen_dioxide),
      SO2: num(a.sulphur_dioxide),
      CO: coPpm,
    });
    const codigo = num(c.weather_code);
    return {
      ar: {
        horario: typeof a.time === 'string' ? a.time : null,
        pm10: num(a.pm10),
        pm25: num(a.pm2_5),
        coPpm,
        no2: num(a.nitrogen_dioxide),
        so2: num(a.sulphur_dioxide),
        o3: num(a.ozone),
        usAqi: num(a.us_aqi),
        europeanAqi: num(a.european_aqi),
        iqar: iqar ? { indice: iqar.indice, classe: iqar.classe, poluenteDominante: iqar.poluenteDominante } : null,
      },
      clima: {
        horario: typeof c.time === 'string' ? c.time : null,
        temperatura: num(c.temperature_2m),
        sensacaoTermica: num(c.apparent_temperature),
        umidade: num(c.relative_humidity_2m),
        precipitacaoMm: num(c.precipitation),
        codigoTempo: codigo,
        descricao: descricaoTempo(codigo),
        ventoKmh: num(c.wind_speed_10m),
        nebulosidade: num(c.cloud_cover),
        pressaoHpa: num(c.surface_pressure),
        maximaDia: num(d.temperature_2m_max?.[0]),
        minimaDia: num(d.temperature_2m_min?.[0]),
        probabilidadeChuva: num(d.precipitation_probability_max?.[0]),
      },
      obtidoEm: new Date().toISOString(),
    };
  }

  private resposta(fonte: FonteDados, motivo: string | null): RespostaExterna {
    const ultimo = this.cache.obterUltimo(CHAVE);
    const idade = this.cache.idadeMs(CHAVE);
    return {
      fonte,
      atualizadoEm: ultimo?.valor.obtidoEm ?? null,
      idadeSegundos: idade === undefined || !Number.isFinite(idade) ? null : Math.round(idade / 1000),
      motivo,
      estadoCircuito: this.estadoCircuito,
      dados: fonte === 'indisponivel' ? null : (ultimo?.valor ?? null),
    };
  }

  /**
   * Retorna os dados externos. Dentro do TTL usa o valor recente (fonte "ao_vivo");
   * fora dele consulta a API pelo circuit breaker; em caso de falha devolve o último
   * valor conhecido (fonte "cache") ou "indisponivel".
   */
  async obter(forcarAtualizacao = false): Promise<RespostaExterna> {
    if (!forcarAtualizacao && this.cache.obterValido(CHAVE)) return this.resposta('ao_vivo', null);
    try {
      const dados = await this.breaker.fire();
      this.cache.definir(CHAVE, dados);
      this.ultimoSucessoEm = dados.obtidoEm;
      this.ultimoErro = null;
      await this.opcoes.persistencia?.salvar(dados).catch((erro) => this.log.warn({ err: erro }, 'Falha ao persistir cache'));
      return this.resposta('ao_vivo', null);
    } catch (erro) {
      const aberto = this.breaker.opened;
      const mensagem = aberto
        ? 'Circuito aberto após falhas consecutivas na Open-Meteo; exibindo o último dado válido.'
        : `Falha ao consultar a Open-Meteo: ${erro instanceof Error ? erro.message : String(erro)}`;
      this.ultimoErro = { mensagem, em: new Date().toISOString() };
      this.log.warn({ err: erro, circuito: this.estadoCircuito }, 'Open-Meteo indisponível; aplicando degradação graciosa');
      return this.cache.obterUltimo(CHAVE) ? this.resposta('cache', mensagem) : this.resposta('indisponivel', mensagem);
    }
  }

  /** Injeção de falha para testes/demonstração (redireciona para um host inexistente). */
  simularFalha(ativo: boolean): void {
    this.simulandoFalha = ativo;
    if (ativo) this.cache.expirar(CHAVE);
    this.log.warn({ ativo }, 'Simulação de falha da Open-Meteo alterada');
  }

  status() {
    const s = this.breaker.stats;
    const idade = this.cache.idadeMs(CHAVE);
    return {
      nome: 'Open-Meteo (qualidade do ar + clima)',
      estadoCircuito: this.estadoCircuito,
      simulandoFalha: this.simulandoFalha,
      ultimoSucessoEm: this.ultimoSucessoEm,
      ultimoErro: this.ultimoErro,
      cacheIdadeSegundos: idade === undefined || !Number.isFinite(idade) ? null : Math.round(idade / 1000),
      estatisticas: {
        chamadas: s.fires,
        sucessos: s.successes,
        falhas: s.failures,
        timeouts: s.timeouts,
        rejeitadasCircuitoAberto: s.rejects,
      },
      configuracao: {
        timeoutMs: this.opcoes.timeoutMs,
        cacheTtlSegundos: Math.round(this.opcoes.ttlMs / 1000),
        limiarErroPercentual: 50,
        resetTimeoutMs: this.opcoes.resetTimeoutMs ?? 30_000,
        volumeMinimo: this.opcoes.volumeThreshold ?? 3,
      },
    };
  }

  encerrar(): void {
    this.breaker.shutdown();
  }
}
