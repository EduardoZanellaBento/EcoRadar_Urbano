/**
 * Estações ambientais virtuais da cidade padrão (São Paulo/SP).
 * Compartilhadas entre o simulador (que publica as leituras), o ambiental-service
 * (que as cadastra) e o seed (que gera o histórico das últimas 24 h).
 * As coordenadas são aproximadas, em bairros reais, para fins didáticos.
 */
export type TipoSensor = 'QUALIDADE_AR' | 'PLUVIOMETRICA' | 'PERFIL_TERMICO';

export interface DefinicaoEstacao {
  id: string;
  nome: string;
  bairro: string;
  latitude: number;
  longitude: number;
  tipos: TipoSensor[];
  /** Nome do córrego monitorado (estações pluviométricas). */
  corrego?: string;
  /** Cota de alerta do nível do córrego, em cm. */
  cotaAlertaCm?: number;
  /** Nível normal médio do córrego, em cm (usado pelo simulador). */
  nivelBaseCm?: number;
  /** Fator de poluição local (1 = média da cidade). */
  fatorPoluicao: number;
}

export const ESTACOES_PADRAO: DefinicaoEstacao[] = [
  {
    id: 'est-se',
    nome: 'Estação Sé (Centro)',
    bairro: 'Sé',
    latitude: -23.5503,
    longitude: -46.6339,
    tipos: ['QUALIDADE_AR', 'PERFIL_TERMICO'],
    fatorPoluicao: 1.25,
  },
  {
    id: 'est-pinheiros',
    nome: 'Estação Pinheiros',
    bairro: 'Pinheiros',
    latitude: -23.5675,
    longitude: -46.7019,
    tipos: ['QUALIDADE_AR'],
    fatorPoluicao: 1.15,
  },
  {
    id: 'est-ipiranga',
    nome: 'Estação Ipiranga',
    bairro: 'Ipiranga',
    latitude: -23.5866,
    longitude: -46.6103,
    tipos: ['QUALIDADE_AR', 'PLUVIOMETRICA'],
    corrego: 'Córrego do Ipiranga',
    cotaAlertaCm: 180,
    nivelBaseCm: 70,
    fatorPoluicao: 1.0,
  },
  {
    id: 'est-itaquera',
    nome: 'Estação Itaquera',
    bairro: 'Itaquera',
    latitude: -23.5392,
    longitude: -46.4553,
    tipos: ['QUALIDADE_AR', 'PLUVIOMETRICA'],
    corrego: 'Rio Aricanduva',
    cotaAlertaCm: 220,
    nivelBaseCm: 90,
    fatorPoluicao: 0.9,
  },
  {
    id: 'est-santana',
    nome: 'Estação Santana',
    bairro: 'Santana',
    latitude: -23.5025,
    longitude: -46.6253,
    tipos: ['QUALIDADE_AR', 'PERFIL_TERMICO'],
    fatorPoluicao: 0.95,
  },
  {
    id: 'est-santo-amaro',
    nome: 'Estação Santo Amaro (Guarapiranga)',
    bairro: 'Santo Amaro',
    latitude: -23.6536,
    longitude: -46.7101,
    tipos: ['QUALIDADE_AR', 'PLUVIOMETRICA', 'PERFIL_TERMICO'],
    corrego: 'Córrego Zavuvus',
    cotaAlertaCm: 160,
    nivelBaseCm: 60,
    fatorPoluicao: 0.85,
  },
];
