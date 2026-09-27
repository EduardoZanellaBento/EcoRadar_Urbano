import type { Categoria } from '@ecoradar/shared';

/** Descrições realistas por categoria (textos escritos para a demonstração). */
export const DESCRICOES: Record<Categoria, string[]> = {
  ALAGAMENTO: [
    'Rua completamente alagada após a chuva; carros não conseguem passar.',
    'Bueiro entupido causando acúmulo de água na esquina.',
    'Água invadindo calçadas e comércios próximos ao córrego.',
    'Ponto de alagamento recorrente na avenida, água na altura do joelho.',
  ],
  POLUICAO_AR: [
    'Fumaça preta saindo da chaminé de uma fábrica há horas.',
    'Cheiro forte de queimado e ar pesado na região.',
    'Ônibus soltando muita fumaça escura no ponto final.',
    'Poeira intensa de obra sem aspersão de água.',
  ],
  TRANSITO: [
    'Semáforo apagado causando congestionamento no cruzamento.',
    'Acidente bloqueando duas faixas da avenida.',
    'Trânsito parado por causa de um buraco grande na pista.',
    'Caminhão quebrado ocupando a faixa da direita.',
  ],
  TRANSPORTE_PUBLICO: [
    'Ônibus da linha não passa há mais de 40 minutos.',
    'Estação superlotada, plataforma sem espaço para embarque.',
    'Ponto de ônibus sem cobertura e com banco quebrado.',
    'Linha de trem operando com velocidade reduzida desde cedo.',
  ],
  INVASAO_MANANCIAL: [
    'Construções irregulares avançando sobre a margem da represa.',
    'Loteamento clandestino com esgoto lançado direto na represa.',
    'Novas casas sendo erguidas em área de proteção ambiental.',
    'Aterro irregular sendo feito na beira da represa.',
  ],
  DESMATAMENTO: [
    'Corte de árvores nativas em área de mata.',
    'Máquinas derrubando vegetação próxima à represa.',
    'Retirada de mata para abrir terreno, com troncos amontoados.',
    'Árvores cortadas sem autorização em praça do bairro.',
  ],
  INVERSAO_TERMICA: [
    'Manhã fria com névoa acinzentada e ar muito parado.',
    'Camada de poluição visível no horizonte logo cedo.',
    'Ar pesado e dificuldade para respirar pela manhã.',
  ],
  QUEIMADA: [
    'Fogo em terreno baldio com muita fumaça.',
    'Queima de lixo no quintal de um imóvel.',
    'Incêndio em vegetação às margens da avenida.',
  ],
  DESCARTE_IRREGULAR_LIXO: [
    'Entulho e móveis velhos jogados na calçada.',
    'Lixo acumulado em terreno baldio atraindo ratos.',
    'Descarte de pneus às margens do córrego.',
    'Sacos de lixo jogados na beira da represa.',
  ],
  OUTROS: [
    'Vazamento de água limpa na rua há dois dias.',
    'Poste com fiação exposta após o temporal.',
    'Barulho excessivo de obra durante a madrugada.',
  ],
};

/** Onde cada categoria costuma acontecer (bairros reais — centroides aproximados). */
export const BAIRROS_POR_CATEGORIA: Record<Categoria, string[]> = {
  ALAGAMENTO: ['Ipiranga', 'Itaquera', 'Santo Amaro', 'Pinheiros', 'Lapa', 'Vila Prudente', 'Casa Verde'],
  POLUICAO_AR: ['Sé', 'Brás', 'Mooca', 'República', 'Santa Cecília', 'Lapa'],
  TRANSITO: ['Pinheiros', 'Itaim Bibi', 'Consolação', 'Moema', 'Tatuapé', 'Santana', 'Butantã'],
  TRANSPORTE_PUBLICO: ['Sé', 'Jabaquara', 'Itaquera', 'Capão Redondo', 'Pirituba', 'Penha'],
  INVASAO_MANANCIAL: [],
  DESMATAMENTO: ['Jaraguá', 'Brasilândia'],
  INVERSAO_TERMICA: ['Sé', 'Santana', 'Bela Vista', 'Liberdade'],
  QUEIMADA: ['Jardim Ângela', 'Grajaú', 'Cidade Tiradentes', 'Guaianases', 'Jaraguá'],
  DESCARTE_IRREGULAR_LIXO: ['Sapopemba', 'São Mateus', 'Campo Limpo', 'Brasilândia', 'Cambuci'],
  OUTROS: ['Vila Mariana', 'Perdizes', 'Tucuruvi', 'Saúde'],
};

/** Pontos DENTRO dos polígonos didáticos dos mananciais (lat, lon). */
export const PONTOS_MANANCIAL: Array<{ latitude: number; longitude: number; bairro: string }> = [
  { latitude: -23.765, longitude: -46.77, bairro: 'Jardim Ângela' },
  { latitude: -23.8, longitude: -46.8, bairro: 'Parelheiros' },
  { latitude: -23.73, longitude: -46.745, bairro: 'Jardim Ângela' },
  { latitude: -23.84, longitude: -46.82, bairro: 'Parelheiros' },
  { latitude: -23.76, longitude: -46.6, bairro: 'Grajaú' },
  { latitude: -23.8, longitude: -46.55, bairro: 'Região Represa Billings' },
  { latitude: -23.74, longitude: -46.64, bairro: 'Pedreira' },
];

export const COMENTARIOS = {
  EM_ANALISE: ['Equipe de campo acionada para vistoria.', 'Ocorrência encaminhada à subprefeitura.', 'Em análise pela equipe técnica.'],
  RESOLVIDA: [
    'Problema resolvido pela equipe de manutenção.',
    'Área limpa e liberada.',
    'Fiscalização realizada e infração autuada.',
    'Serviço concluído; situação normalizada.',
  ],
  DESCARTADA: ['Não foi encontrada irregularidade no local.', 'Registro duplicado de outra ocorrência.', 'Informação insuficiente para localizar o problema.'],
};
