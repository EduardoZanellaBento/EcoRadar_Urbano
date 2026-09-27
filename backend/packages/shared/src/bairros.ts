import { distanciaKm } from './geo.js';

/**
 * Centroides APROXIMADOS de bairros/distritos reais de São Paulo/SP (fins didáticos).
 * Usados para identificar o bairro de uma ocorrência quando o app não o informa e para
 * distribuir os dados de demonstração.
 */
export const BAIRROS_SP: Array<{ nome: string; latitude: number; longitude: number }> = [
  { nome: 'Sé', latitude: -23.5503, longitude: -46.6339 },
  { nome: 'República', latitude: -23.5446, longitude: -46.6425 },
  { nome: 'Bela Vista', latitude: -23.5617, longitude: -46.6443 },
  { nome: 'Consolação', latitude: -23.553, longitude: -46.66 },
  { nome: 'Liberdade', latitude: -23.5587, longitude: -46.6353 },
  { nome: 'Cambuci', latitude: -23.57, longitude: -46.62 },
  { nome: 'Mooca', latitude: -23.558, longitude: -46.599 },
  { nome: 'Brás', latitude: -23.543, longitude: -46.617 },
  { nome: 'Bom Retiro', latitude: -23.527, longitude: -46.638 },
  { nome: 'Santa Cecília', latitude: -23.538, longitude: -46.651 },
  { nome: 'Pinheiros', latitude: -23.567, longitude: -46.693 },
  { nome: 'Vila Madalena', latitude: -23.554, longitude: -46.69 },
  { nome: 'Lapa', latitude: -23.522, longitude: -46.703 },
  { nome: 'Perdizes', latitude: -23.536, longitude: -46.677 },
  { nome: 'Butantã', latitude: -23.572, longitude: -46.731 },
  { nome: 'Morumbi', latitude: -23.599, longitude: -46.721 },
  { nome: 'Itaim Bibi', latitude: -23.584, longitude: -46.679 },
  { nome: 'Moema', latitude: -23.601, longitude: -46.666 },
  { nome: 'Vila Mariana', latitude: -23.589, longitude: -46.634 },
  { nome: 'Ipiranga', latitude: -23.5866, longitude: -46.6103 },
  { nome: 'Saúde', latitude: -23.618, longitude: -46.64 },
  { nome: 'Jabaquara', latitude: -23.644, longitude: -46.642 },
  { nome: 'Santo Amaro', latitude: -23.6536, longitude: -46.7101 },
  { nome: 'Campo Limpo', latitude: -23.64, longitude: -46.764 },
  { nome: 'Capão Redondo', latitude: -23.672, longitude: -46.779 },
  { nome: 'Jardim São Luís', latitude: -23.68, longitude: -46.738 },
  { nome: 'Jardim Ângela', latitude: -23.712, longitude: -46.768 },
  { nome: 'Cidade Dutra', latitude: -23.715, longitude: -46.699 },
  { nome: 'Socorro', latitude: -23.69, longitude: -46.705 },
  { nome: 'Grajaú', latitude: -23.76, longitude: -46.68 },
  { nome: 'Parelheiros', latitude: -23.827, longitude: -46.728 },
  { nome: 'Cidade Ademar', latitude: -23.669, longitude: -46.656 },
  { nome: 'Pedreira', latitude: -23.697, longitude: -46.656 },
  { nome: 'Santana', latitude: -23.5025, longitude: -46.6253 },
  { nome: 'Tucuruvi', latitude: -23.48, longitude: -46.603 },
  { nome: 'Vila Maria', latitude: -23.513, longitude: -46.587 },
  { nome: 'Casa Verde', latitude: -23.508, longitude: -46.657 },
  { nome: 'Freguesia do Ó', latitude: -23.499, longitude: -46.696 },
  { nome: 'Pirituba', latitude: -23.487, longitude: -46.728 },
  { nome: 'Brasilândia', latitude: -23.47, longitude: -46.687 },
  { nome: 'Jaraguá', latitude: -23.455, longitude: -46.74 },
  { nome: 'Tatuapé', latitude: -23.54, longitude: -46.576 },
  { nome: 'Penha', latitude: -23.526, longitude: -46.546 },
  { nome: 'Vila Prudente', latitude: -23.583, longitude: -46.58 },
  { nome: 'Sapopemba', latitude: -23.604, longitude: -46.514 },
  { nome: 'Itaquera', latitude: -23.5392, longitude: -46.4553 },
  { nome: 'São Mateus', latitude: -23.604, longitude: -46.476 },
  { nome: 'Guaianases', latitude: -23.543, longitude: -46.415 },
  { nome: 'Cidade Tiradentes', latitude: -23.582, longitude: -46.409 },
  { nome: 'São Miguel Paulista', latitude: -23.496, longitude: -46.443 },
  { nome: 'Ermelino Matarazzo', latitude: -23.498, longitude: -46.48 },
  { nome: 'Itaim Paulista', latitude: -23.499, longitude: -46.396 },
];

/** Bairro mais próximo do ponto (até `raioMaximoKm`), ou null se nenhum estiver perto. */
export function bairroMaisProximo(latitude: number, longitude: number, raioMaximoKm = 4): string | null {
  let melhor: { nome: string; d: number } | null = null;
  for (const b of BAIRROS_SP) {
    const d = distanciaKm({ latitude, longitude }, b);
    if (!melhor || d < melhor.d) melhor = { nome: b.nome, d };
  }
  return melhor && melhor.d <= raioMaximoKm ? melhor.nome : null;
}
