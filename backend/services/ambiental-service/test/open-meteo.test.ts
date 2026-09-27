import { describe, expect, it, vi } from 'vitest';
import { pino } from 'pino';
import { IntegracaoOpenMeteo, type DadosExternos } from '../src/integracoes/open-meteo.js';

const logger = pino({ level: 'silent' });

const RESPOSTA_AR = { current: { time: '2026-09-27T16:00', pm10: 17.3, pm2_5: 16.6, carbon_monoxide: 236, nitrogen_dioxide: 10.8, sulphur_dioxide: 10.7, ozone: 157, us_aqi: 184, european_aqi: 79 } };
const RESPOSTA_CLIMA = {
  current: { time: '2026-09-27T16:45', temperature_2m: 22.7, relative_humidity_2m: 72, apparent_temperature: 23.4, precipitation: 0, weather_code: 2, wind_speed_10m: 12.4, cloud_cover: 72, surface_pressure: 931.9 },
  daily: { temperature_2m_max: [30], temperature_2m_min: [17.3], precipitation_probability_max: [0] },
};

function fetchFalso(modo: { falhar: boolean }) {
  return vi.fn(async (url: string | URL | Request) => {
    if (modo.falhar || String(url).includes('.invalid')) throw new TypeError('fetch failed: getaddrinfo ENOTFOUND');
    const corpo = String(url).includes('air-quality') ? RESPOSTA_AR : RESPOSTA_CLIMA;
    return new Response(JSON.stringify(corpo), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
}

function criar(modo: { falhar: boolean }, salvos: DadosExternos[] = []) {
  return new IntegracaoOpenMeteo({
    urlAr: 'https://air-quality-api.open-meteo.com/v1/air-quality',
    urlClima: 'https://api.open-meteo.com/v1/forecast',
    latitude: -23.55,
    longitude: -46.63,
    timeoutMs: 1000,
    ttlMs: 600_000,
    logger,
    fetchFn: fetchFalso(modo),
    resetTimeoutMs: 60_000,
    volumeThreshold: 3,
    persistencia: { salvar: async (d) => void salvos.push(d), carregar: async () => salvos.at(-1) ?? null },
  });
}

describe('Open-Meteo › conversão da resposta', () => {
  it('converte unidades, calcula o IQAr (CETESB) e descreve o tempo', () => {
    const d = IntegracaoOpenMeteo.converter(RESPOSTA_AR, RESPOSTA_CLIMA);
    expect(d.ar.pm25).toBe(16.6);
    expect(d.ar.coPpm).toBeCloseTo(0.21, 2);
    expect(d.ar.iqar).toMatchObject({ indice: 116, classe: 'RUIM', poluenteDominante: 'O3' });
    expect(d.clima.descricao).toBe('Parcialmente nublado');
    expect(d.clima.maximaDia).toBe(30);
  });

  it('tolera campos ausentes', () => {
    const d = IntegracaoOpenMeteo.converter({}, {});
    expect(d.ar.iqar).toBeNull();
    expect(d.clima.temperatura).toBeNull();
    expect(d.clima.descricao).toBe('Indisponível');
  });
});

describe('Open-Meteo › cache, circuit breaker e degradação graciosa', () => {
  it('primeira consulta com a API no ar: fonte "ao_vivo" e valor persistido', async () => {
    const salvos: DadosExternos[] = [];
    const om = criar({ falhar: false }, salvos);
    const r = await om.obter();
    expect(r.fonte).toBe('ao_vivo');
    expect(r.estadoCircuito).toBe('FECHADO');
    expect(r.dados?.ar.pm10).toBe(17.3);
    expect(salvos).toHaveLength(1);
    // dentro do TTL não chama a API de novo
    const r2 = await om.obter();
    expect(r2.fonte).toBe('ao_vivo');
    expect(om.status().estatisticas.chamadas).toBe(1);
    om.encerrar();
  });

  it('API fora do ar sem nenhum dado anterior: fonte "indisponivel"', async () => {
    const om = criar({ falhar: true });
    const r = await om.obter();
    expect(r.fonte).toBe('indisponivel');
    expect(r.dados).toBeNull();
    expect(r.motivo).toMatch(/Falha ao consultar/);
    om.encerrar();
  });

  it('falhas consecutivas abrem o circuito e o serviço passa a servir o cache', async () => {
    const modo = { falhar: false };
    const om = criar(modo);
    expect((await om.obter()).fonte).toBe('ao_vivo');

    modo.falhar = true;
    for (let i = 0; i < 3; i++) await om.obter(true);
    expect(om.estadoCircuito).toBe('ABERTO');

    const r = await om.obter(true);
    expect(r.fonte).toBe('cache');
    expect(r.estadoCircuito).toBe('ABERTO');
    expect(r.motivo).toMatch(/Circuito aberto/);
    expect(r.dados?.ar.pm25).toBe(16.6);
    expect(r.atualizadoEm).not.toBeNull();
    expect(om.status().estatisticas.rejeitadasCircuitoAberto).toBeGreaterThan(0);
    om.encerrar();
  });

  it('falha simulada redireciona para host inexistente e expira o cache', async () => {
    const om = criar({ falhar: false });
    await om.obter();
    om.simularFalha(true);
    expect(om.status().simulandoFalha).toBe(true);
    const r = await om.obter();
    expect(r.fonte).toBe('cache');
    om.simularFalha(false);
    om.encerrar();
  });

  it('recupera o último valor persistido após reinício', async () => {
    const salvos: DadosExternos[] = [IntegracaoOpenMeteo.converter(RESPOSTA_AR, RESPOSTA_CLIMA)];
    const om = criar({ falhar: true }, salvos);
    await om.carregarCachePersistido();
    const r = await om.obter(true);
    expect(r.fonte).toBe('cache');
    expect(r.dados?.clima.temperatura).toBe(22.7);
    om.encerrar();
  });
});
