import { describe, expect, it } from 'vitest';
import { ESTACOES_PADRAO } from '@ecoradar/shared';
import { estadoInicial, fatorTrafego, gerarLeitura, temperaturaBase, validarCenario, type CenarioAtivo } from '../src/dominio/modelo.js';

const ipiranga = ESTACOES_PADRAO.find((e) => e.id === 'est-ipiranga')!;
const se = ESTACOES_PADRAO.find((e) => e.id === 'est-se')!;
const pinheiros = ESTACOES_PADRAO.find((e) => e.id === 'est-pinheiros')!;
const meio = () => 0.5; // "aleatório" determinístico (ruído zero)

function instante(hora: number) {
  const d = new Date(2026, 8, 27, hora, 0, 0);
  return d;
}

describe('simulador › ciclo diário', () => {
  it('tráfego tem picos de manhã e à tarde e vale mais que de madrugada', () => {
    expect(fatorTrafego(8)).toBeGreaterThan(fatorTrafego(12));
    expect(fatorTrafego(18.5)).toBeGreaterThan(fatorTrafego(12));
    expect(fatorTrafego(3)).toBeLessThan(1);
  });

  it('temperatura máxima à tarde e mínima de madrugada', () => {
    expect(temperaturaBase(15)).toBeCloseTo(26, 0);
    expect(temperaturaBase(3)).toBeCloseTo(14, 0);
  });

  it('leitura normal fica em faixas plausíveis e respeita os sensores da estação', () => {
    const l = gerarLeitura(ipiranga, instante(12), estadoInicial(ipiranga), null, meio);
    expect(l.pm25).toBeGreaterThan(2);
    expect(l.pm25).toBeLessThan(40);
    expect(l.nivel_corrego_cm).not.toBeNull();
    expect(l.nivel_corrego_cm!).toBeLessThan(ipiranga.cotaAlertaCm!);
    expect(l.temp_superficie).toBeNull(); // Ipiranga não tem perfil térmico
    const lSe = gerarLeitura(se, instante(12), estadoInicial(se), null, meio);
    expect(lSe.temp_300m!).toBeLessThan(lSe.temp_superficie!);
    expect(lSe.nivel_corrego_cm).toBeNull();
  });
});

describe('simulador › cenários de demonstração', () => {
  const agora = instante(10);
  const cenario = (tipo: CenarioAtivo['tipo'], estacaoId: string | null = null): CenarioAtivo => ({
    tipo,
    estacaoId,
    inicio: agora.getTime() - 60_000,
    fim: agora.getTime() + 60_000,
  });

  it('ALAGAMENTO leva o nível do córrego acima da cota de alerta', () => {
    const l = gerarLeitura(ipiranga, agora, estadoInicial(ipiranga), cenario('ALAGAMENTO'), meio);
    expect(l.nivel_corrego_cm!).toBeGreaterThan(ipiranga.cotaAlertaCm!);
    expect(l.cenario).toBe('ALAGAMENTO');
  });

  it('POLUICAO_CRITICA eleva material particulado a níveis péssimos', () => {
    const l = gerarLeitura(pinheiros, agora, estadoInicial(pinheiros), cenario('POLUICAO_CRITICA'), meio);
    expect(l.pm25).toBeGreaterThan(125);
    expect(l.cenario).toBe('POLUICAO_CRITICA');
  });

  it('INVERSAO_TERMICA deixa o ar a 300 m mais quente que a superfície', () => {
    const l = gerarLeitura(se, agora, estadoInicial(se), cenario('INVERSAO_TERMICA'), meio);
    expect(l.temp_300m!).toBeGreaterThan(l.temp_superficie!);
  });

  it('cenário restrito a uma estação não afeta as demais, e cenário expirado não vale', () => {
    const l = gerarLeitura(pinheiros, agora, estadoInicial(pinheiros), cenario('POLUICAO_CRITICA', 'est-se'), meio);
    expect(l.cenario).toBeNull();
    const expirado: CenarioAtivo = { tipo: 'POLUICAO_CRITICA', estacaoId: null, inicio: 0, fim: 1 };
    expect(gerarLeitura(pinheiros, agora, estadoInicial(pinheiros), expirado, meio).cenario).toBeNull();
  });

  it('valida a compatibilidade entre cenário e estação', () => {
    expect(validarCenario('ALAGAMENTO', pinheiros, 'est-pinheiros')).toMatch(/não monitora córrego/);
    expect(validarCenario('INVERSAO_TERMICA', ipiranga, 'est-ipiranga')).toMatch(/perfil térmico/);
    expect(validarCenario('ALAGAMENTO', undefined, 'est-inexistente')).toMatch(/não existe/);
    expect(validarCenario('POLUICAO_CRITICA', undefined, null)).toBeNull();
    expect(validarCenario('ALAGAMENTO', ipiranga, 'est-ipiranga')).toBeNull();
  });
});
