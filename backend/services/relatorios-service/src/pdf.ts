import PDFDocument from 'pdfkit';
import { ROTULOS_CATEGORIA, ROTULOS_SEVERIDADE, ROTULOS_STATUS, type Categoria, type Severidade, type StatusOcorrencia } from '@ecoradar/shared';
import type { Estatisticas } from './dominio/relatorio.js';

/** Paleta dos gráficos (paleta de referência validada para daltonismo) e tinta do texto. */
const COR = {
  serie1: '#2a78d6',
  serie2: '#eb6834',
  tinta: '#0b0b0b',
  tintaSecundaria: '#52514e',
  tintaFraca: '#898781',
  grade: '#e1e0d9',
  base: '#c3c2b7',
  cartao: '#f6f7f5',
  marcaVerde: '#0f766e',
  marcaAzul: '#1d4ed8',
};

const A4 = { largura: 595.28, altura: 841.89 };
const MARGEM = 40;
const LARGURA_UTIL = A4.largura - 2 * MARGEM;
const LIMITE_Y = A4.altura - 60;

export interface DadosPdf {
  cidade: string;
  geradoEm: Date;
  filtros: string;
  estatisticas: Estatisticas;
  alertas: { total: number; ativos: number; porTipo: Array<{ rotulo: string; total: number }> };
  ultimas: Array<{ criadoEm: Date; categoria: Categoria; severidade: Severidade; status: StatusOcorrencia; bairro: string | null; confirmacoes: number }>;
}

const fmtDataHora = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
const fmtNumero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

type Doc = PDFKit.PDFDocument;

/** Logotipo vetorial do EcoRadar: círculo, arcos de radar e folha. */
export function desenharLogo(doc: Doc, x: number, y: number, tamanho: number) {
  const r = tamanho / 2;
  const cx = x + r;
  const cy = y + r;
  doc.save();
  doc.circle(cx, cy, r).fill('#ffffff');
  doc.lineWidth(Math.max(1.2, tamanho / 22)).strokeColor(COR.marcaAzul).lineCap('round');
  for (const f of [0.42, 0.62, 0.82]) {
    doc.path(`M ${cx - r * f * 0.2} ${cy - r * f} A ${r * f} ${r * f} 0 0 1 ${cx + r * f} ${cy + r * f * 0.2}`).stroke();
  }
  doc
    .path(
      `M ${cx - r * 0.5} ${cy + r * 0.5} C ${cx - r * 0.55} ${cy - r * 0.1} ${cx - r * 0.1} ${cy - r * 0.35} ${cx + r * 0.3} ${cy - r * 0.3} ` +
        `C ${cx + r * 0.3} ${cy + r * 0.15} ${cx} ${cy + r * 0.55} ${cx - r * 0.5} ${cy + r * 0.5} Z`,
    )
    .fill('#16a34a');
  doc.restore();
}

function titulo(doc: Doc, texto: string, y: number): number {
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COR.tinta).text(texto, MARGEM, y);
  return y + 20;
}

function garantirEspaco(doc: Doc, y: number, necessario: number): number {
  if (y + necessario <= LIMITE_Y) return y;
  doc.addPage();
  return MARGEM;
}

function cabecalho(doc: Doc, d: DadosPdf) {
  const gradiente = doc.linearGradient(0, 0, A4.largura, 0);
  gradiente.stop(0, COR.marcaVerde).stop(1, COR.marcaAzul);
  doc.rect(0, 0, A4.largura, 92).fill(gradiente);
  desenharLogo(doc, MARGEM, 22, 48);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20).text('EcoRadar Urbano', MARGEM + 62, 26);
  doc.font('Helvetica').fontSize(10.5).text(`Relatório de ocorrências ambientais — ${d.cidade}`, MARGEM + 62, 52);
  doc.fontSize(9).text(`Gerado em ${fmtDataHora.format(d.geradoEm)}`, MARGEM, 30, { width: LARGURA_UTIL, align: 'right' });
  doc.text('APS · Ciência da Computação · UNIP 2026', MARGEM, 46, { width: LARGURA_UTIL, align: 'right' });
  doc.fillColor(COR.tintaSecundaria).fontSize(9).text(`Filtros: ${d.filtros}`, MARGEM, 104, { width: LARGURA_UTIL });
}

function cartoes(doc: Doc, y: number, itens: Array<{ rotulo: string; valor: string; detalhe?: string }>): number {
  const colunas = 3;
  const gap = 10;
  const w = (LARGURA_UTIL - gap * (colunas - 1)) / colunas;
  const h = 58;
  itens.forEach((item, i) => {
    const x = MARGEM + (i % colunas) * (w + gap);
    const yy = y + Math.floor(i / colunas) * (h + gap);
    doc.roundedRect(x, yy, w, h, 6).fillAndStroke(COR.cartao, COR.grade);
    doc.fillColor(COR.tintaSecundaria).font('Helvetica').fontSize(8.5).text(item.rotulo, x + 10, yy + 9, { width: w - 20 });
    doc.fillColor(COR.tinta).font('Helvetica-Bold').fontSize(18).text(item.valor, x + 10, yy + 22, { width: w - 20 });
    if (item.detalhe) doc.fillColor(COR.tintaFraca).font('Helvetica').fontSize(7.5).text(item.detalhe, x + 10, yy + 44, { width: w - 20 });
  });
  return y + Math.ceil(itens.length / colunas) * (h + gap) + 4;
}

/** Barras horizontais (uma série, uma cor), ordenadas, com o valor ao final de cada barra. */
function barrasHorizontais(doc: Doc, y: number, dados: Array<{ rotulo: string; total: number }>): number {
  const larguraRotulo = 150;
  const larguraBarras = LARGURA_UTIL - larguraRotulo - 40;
  const alturaLinha = 17;
  const maximo = Math.max(1, ...dados.map((d) => d.total));
  const ordenados = [...dados].sort((a, b) => b.total - a.total);
  ordenados.forEach((d, i) => {
    const yy = y + i * alturaLinha;
    doc.fillColor(COR.tintaSecundaria).font('Helvetica').fontSize(9).text(d.rotulo, MARGEM, yy + 3, { width: larguraRotulo - 8, align: 'right' });
    const w = (d.total / maximo) * larguraBarras;
    if (w > 0) doc.roundedRect(MARGEM + larguraRotulo, yy + 3, Math.max(w, 3), alturaLinha - 6, 2).fill(COR.serie1);
    doc.fillColor(COR.tinta).fontSize(9).text(String(d.total), MARGEM + larguraRotulo + w + 5, yy + 3);
  });
  doc.moveTo(MARGEM + larguraRotulo, y).lineTo(MARGEM + larguraRotulo, y + ordenados.length * alturaLinha).lineWidth(0.6).strokeColor(COR.base).stroke();
  return y + ordenados.length * alturaLinha + 12;
}

/** Colunas da série diária (uma série), com grade horizontal discreta e rótulos a cada 5 dias. */
function colunasDiarias(doc: Doc, y: number, serie: Array<{ dia: string; total: number }>): number {
  const alturaGrafico = 110;
  const eixoY = 26;
  const x0 = MARGEM + eixoY;
  const largura = LARGURA_UTIL - eixoY;
  const maximoBruto = Math.max(1, ...serie.map((s) => s.total));
  const passo = Math.max(1, Math.ceil(maximoBruto / 4));
  const maximo = passo * 4;
  for (let i = 0; i <= 4; i++) {
    const yy = y + alturaGrafico - (i / 4) * alturaGrafico;
    doc.moveTo(x0, yy).lineTo(x0 + largura, yy).lineWidth(0.5).strokeColor(i === 0 ? COR.base : COR.grade).stroke();
    doc.fillColor(COR.tintaFraca).font('Helvetica').fontSize(7).text(String(i * passo), MARGEM, yy - 3.5, { width: eixoY - 6, align: 'right' });
  }
  const slot = largura / serie.length;
  const w = Math.max(2, slot - 2);
  serie.forEach((s, i) => {
    const h = (s.total / maximo) * alturaGrafico;
    const x = x0 + i * slot + 1;
    if (h > 0) doc.roundedRect(x, y + alturaGrafico - h, w, h, Math.min(2, w / 2)).fill(COR.serie1);
    if (i % 5 === 0 || i === serie.length - 1) {
      const [, mes, dia] = s.dia.split('-');
      doc.fillColor(COR.tintaFraca).fontSize(7).text(`${dia}/${mes}`, x - 6, y + alturaGrafico + 4, { width: w + 12, align: 'center' });
    }
  });
  return y + alturaGrafico + 22;
}

interface Coluna {
  titulo: string;
  largura: number;
  alinhar?: 'left' | 'right' | 'center';
}

function tabela(doc: Doc, y: number, colunas: Coluna[], linhas: string[][]): number {
  const alturaLinha = 16;
  const desenharCabecalho = (yy: number) => {
    let x = MARGEM;
    doc.rect(MARGEM, yy, LARGURA_UTIL, alturaLinha).fill('#eef3f1');
    for (const c of colunas) {
      doc.fillColor(COR.tinta).font('Helvetica-Bold').fontSize(8.5).text(c.titulo, x + 4, yy + 4, { width: c.largura - 8, align: c.alinhar ?? 'left' });
      x += c.largura;
    }
    return yy + alturaLinha;
  };
  y = desenharCabecalho(garantirEspaco(doc, y, alturaLinha * 2));
  linhas.forEach((linha, i) => {
    if (y + alturaLinha > LIMITE_Y) {
      doc.addPage();
      y = desenharCabecalho(MARGEM);
    }
    if (i % 2 === 1) doc.rect(MARGEM, y, LARGURA_UTIL, alturaLinha).fill('#fafaf8');
    let x = MARGEM;
    linha.forEach((celula, j) => {
      doc.fillColor(COR.tintaSecundaria).font('Helvetica').fontSize(8.5).text(celula, x + 4, y + 4, {
        width: colunas[j].largura - 8,
        align: colunas[j].alinhar ?? 'left',
        lineBreak: false,
        ellipsis: true,
      });
      x += colunas[j].largura;
    });
    y += alturaLinha;
  });
  doc.moveTo(MARGEM, y).lineTo(MARGEM + LARGURA_UTIL, y).lineWidth(0.5).strokeColor(COR.grade).stroke();
  return y + 14;
}

function rodapes(doc: Doc) {
  const paginas = doc.bufferedPageRange();
  for (let i = paginas.start; i < paginas.start + paginas.count; i++) {
    doc.switchToPage(i);
    const margemOriginal = doc.page.margins.bottom;
    doc.page.margins.bottom = 0; // evita que o texto do rodapé crie uma nova página
    doc
      .fillColor(COR.tintaFraca)
      .font('Helvetica')
      .fontSize(8)
      .text(`EcoRadar Urbano · dados de demonstração · Página ${i + 1} de ${paginas.count}`, MARGEM, A4.altura - 32, {
        width: LARGURA_UTIL,
        align: 'center',
      });
    doc.page.margins.bottom = margemOriginal;
  }
}

/** Gera o PDF completo em memória. */
export function gerarPdf(d: DadosPdf): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: MARGEM, bottom: MARGEM, left: MARGEM, right: MARGEM },
      bufferPages: true,
      info: {
        Title: 'EcoRadar Urbano — Relatório de ocorrências ambientais',
        Author: 'EcoRadar Urbano (relatorios-service)',
        Subject: `Relatório gerado em ${fmtDataHora.format(d.geradoEm)}`,
      },
    });
    const partes: Buffer[] = [];
    doc.on('data', (p: Buffer) => partes.push(p));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);

    const e = d.estatisticas;
    const porStatus = Object.fromEntries(e.porStatus.map((s) => [s.chave, s.total])) as Record<StatusOcorrencia, number>;
    cabecalho(doc, d);

    let y = cartoes(doc, 124, [
      { rotulo: 'Ocorrências no período', valor: String(e.total) },
      { rotulo: 'Em aberto (aberta + em análise)', valor: String((porStatus.ABERTA ?? 0) + (porStatus.EM_ANALISE ?? 0)) },
      { rotulo: 'Resolvidas', valor: String(porStatus.RESOLVIDA ?? 0) },
      {
        rotulo: 'Tempo médio de resolução',
        valor: e.tempoMedioResolucaoHoras === null ? '—' : `${fmtNumero.format(e.tempoMedioResolucaoHoras)} h`,
        detalhe: 'do registro até o status Resolvida',
      },
      {
        rotulo: 'Validação colaborativa',
        valor: `${fmtNumero.format(e.confirmacao.percentual)}%`,
        detalhe: `${e.confirmacao.ocorrenciasConfirmadas} com ao menos 1 confirmação`,
      },
      { rotulo: 'Alertas emitidos', valor: String(d.alertas.total), detalhe: `${d.alertas.ativos} ativos · ${e.emAreaDeManancial} ocorrências em manancial` },
    ]);

    y = titulo(doc, 'Ocorrências por categoria', y + 4);
    y = barrasHorizontais(
      doc,
      y,
      e.porCategoria.map((c) => ({ rotulo: c.rotulo, total: c.total })),
    );

    y = garantirEspaco(doc, y, 160);
    y = titulo(doc, 'Ocorrências registradas por dia (últimos 30 dias)', y + 4);
    y = colunasDiarias(doc, y, e.serieDiaria);

    y = garantirEspaco(doc, y, 110);
    y = titulo(doc, 'Distribuição por status e severidade', y);
    const totalOuUm = Math.max(1, e.total);
    const pct = (n: number) => `${fmtNumero.format((n / totalOuUm) * 100)}%`;
    const colunasMetade: Coluna[] = [
      { titulo: 'Status', largura: 130 },
      { titulo: 'Qtd.', largura: 60, alinhar: 'right' },
      { titulo: '%', largura: 60, alinhar: 'right' },
    ];
    const yInicio = y;
    const linhasStatus = e.porStatus.map((s) => [ROTULOS_STATUS[s.chave], String(s.total), pct(s.total)]);
    tabela(doc, y, colunasMetade, linhasStatus);
    // Tabela de severidade ao lado (desenhada manualmente na metade direita)
    const xDir = MARGEM + 265;
    let yy = yInicio;
    doc.rect(xDir, yy, 250, 16).fill('#eef3f1');
    doc.fillColor(COR.tinta).font('Helvetica-Bold').fontSize(8.5).text('Severidade', xDir + 4, yy + 4).text('Qtd.', xDir + 130, yy + 4, { width: 56, align: 'right' }).text('%', xDir + 190, yy + 4, { width: 56, align: 'right' });
    yy += 16;
    for (const s of e.porSeveridade) {
      doc.fillColor(COR.tintaSecundaria).font('Helvetica').fontSize(8.5).text(ROTULOS_SEVERIDADE[s.chave], xDir + 4, yy + 4);
      doc.text(String(s.total), xDir + 130, yy + 4, { width: 56, align: 'right' }).text(pct(s.total), xDir + 190, yy + 4, { width: 56, align: 'right' });
      yy += 16;
    }
    y = Math.max(yInicio + 16 * (e.porStatus.length + 1), yy) + 18;

    y = garantirEspaco(doc, y, 140);
    y = titulo(doc, 'Áreas mais críticas (top 5)', y);
    doc.fillColor(COR.tintaFraca).font('Helvetica').fontSize(8).text(
      'Pontuação: soma dos pesos de severidade das ocorrências em aberto (Baixa 1, Média 2, Alta 3, Crítica 5) + 0,5 por ocorrência encerrada.',
      MARGEM,
      y - 4,
      { width: LARGURA_UTIL },
    );
    y = tabela(
      doc,
      y + 12,
      [
        { titulo: '#', largura: 25, alinhar: 'center' },
        { titulo: 'Bairro', largura: 140 },
        { titulo: 'Ocorrências', largura: 70, alinhar: 'right' },
        { titulo: 'Em aberto', largura: 65, alinhar: 'right' },
        { titulo: 'Pontuação', largura: 65, alinhar: 'right' },
        { titulo: 'Categoria predominante', largura: 150 },
      ],
      e.areasCriticas.map((a, i) => [String(i + 1), a.bairro, String(a.total), String(a.emAberto), fmtNumero.format(a.pontuacao), a.categoriaPredominante]),
    );

    if (d.alertas.porTipo.length) {
      y = garantirEspaco(doc, y, 110);
      y = titulo(doc, 'Alertas por tipo', y);
      y = tabela(
        doc,
        y,
        [
          { titulo: 'Tipo de alerta', largura: 380 },
          { titulo: 'Quantidade', largura: 135, alinhar: 'right' },
        ],
        d.alertas.porTipo.map((a) => [a.rotulo, String(a.total)]),
      );
    }

    y = garantirEspaco(doc, y, 80);
    y = titulo(doc, `Últimas ocorrências (${d.ultimas.length})`, y);
    tabela(
      doc,
      y,
      [
        { titulo: 'Data', largura: 85 },
        { titulo: 'Categoria', largura: 135 },
        { titulo: 'Severidade', largura: 65 },
        { titulo: 'Status', largura: 70 },
        { titulo: 'Bairro', largura: 115 },
        { titulo: 'Conf.', largura: 45, alinhar: 'right' },
      ],
      d.ultimas.map((o) => [
        fmtDataHora.format(o.criadoEm),
        ROTULOS_CATEGORIA[o.categoria],
        ROTULOS_SEVERIDADE[o.severidade],
        ROTULOS_STATUS[o.status],
        o.bairro ?? '—',
        String(o.confirmacoes),
      ]),
    );

    rodapes(doc);
    doc.end();
  });
}
