import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { LineChart, PieChart } from 'react-native-gifted-charts';
import { Button, Card, DataTable, Snackbar, Text, useTheme } from 'react-native-paper';
import { mensagemDeErro } from '@/api/cliente';
import { useEstatisticas } from '@/api/consultas';
import { Bloco } from '@/componentes/Esqueleto';
import { EstadoVazio } from '@/componentes/EstadoVazio';
import { GraficoBarras } from '@/componentes/GraficoBarras';
import { Icone } from '@/componentes/Icone';
import { exportarRelatorio } from '@/servicos/exportar';
import { SERIES } from '@/tema/cores';
import type { TemaEcoRadar } from '@/tema/tema';
import { dataHora, diaMes, numero } from '@/utils/formatacao';

function Indicador({ rotulo, valor, detalhe, icone }: { rotulo: string; valor: string; detalhe?: string; icone: string }) {
  const tema = useTheme<TemaEcoRadar>();
  return (
    <Card style={estilos.indicador} mode="contained">
      <Card.Content style={{ gap: 2 }}>
        <View style={estilos.linha}>
          <Icone nome={icone} tamanho={16} cor={tema.colors.primary} />
          <Text variant="labelMedium" style={{ color: tema.extra.tintaSecundaria, flex: 1 }} numberOfLines={1}>
            {rotulo}
          </Text>
        </View>
        <Text variant="headlineSmall" style={{ fontWeight: '800' }}>
          {valor}
        </Text>
        {detalhe && (
          <Text variant="labelSmall" style={{ color: tema.extra.tintaFraca }} numberOfLines={1}>
            {detalhe}
          </Text>
        )}
      </Card.Content>
    </Card>
  );
}

export default function Relatorios() {
  const tema = useTheme<TemaEcoRadar>();
  const consulta = useEstatisticas();
  const [largura, setLargura] = useState(320);
  const [exportando, setExportando] = useState<'pdf' | 'csv' | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const paleta = tema.extra.escuro ? SERIES.escuro : SERIES.claro;
  const e = consulta.data;

  const exportar = async (tipo: 'pdf' | 'csv') => {
    setExportando(tipo);
    try {
      const r = await exportarRelatorio(tipo);
      setAviso(tipo === 'pdf' ? `Relatório PDF gerado (${r.split('/').pop()}).` : `Planilha CSV gerada (${r.split('/').pop()}).`);
    } catch (err) {
      setAviso(mensagemDeErro(err));
    } finally {
      setExportando(null);
    }
  };

  if (consulta.isLoading) {
    return (
      <View style={{ padding: 16, gap: 12 }}>
        <Bloco altura={90} raio={14} />
        <Bloco altura={220} raio={14} />
        <Bloco altura={220} raio={14} />
      </View>
    );
  }
  if (!e) {
    return <EstadoVazio ilustracao="erro" titulo="Relatórios indisponíveis" descricao={mensagemDeErro(consulta.error)} acao={{ rotulo: 'Tentar novamente', aoPressionar: () => void consulta.refetch() }} />;
  }

  const status = Object.fromEntries(e.porStatus.map((s) => [s.chave, s.total])) as Record<string, number>;
  const totalStatus = Math.max(1, e.total);
  const fatias = e.porStatus.map((s, i) => ({ value: s.total, color: paleta[i], rotulo: s.rotulo }));
  const serie = e.serieDiaria.map((d, i) => ({ value: d.total, label: i % 6 === 0 ? diaMes(`${d.dia}T12:00:00`) : '', rotulo: diaMes(`${d.dia}T12:00:00`) }));
  const larguraGrafico = Math.max(200, largura - 64);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={estilos.pagina}
        refreshControl={<RefreshControl refreshing={consulta.isRefetching} onRefresh={() => void consulta.refetch()} />}
        onLayout={(ev) => setLargura(ev.nativeEvent.layout.width)}
        testID="tela-relatorios"
      >
        <Text variant="labelSmall" style={{ color: tema.extra.tintaFraca }}>
          Atualizado em {dataHora(e.geradoEm)} · visão de leitura alimentada por eventos (CQRS)
        </Text>
        <View style={estilos.grade}>
          <Indicador icone="map-marker-multiple" rotulo="Ocorrências" valor={String(e.total)} detalhe="últimos registros" />
          <Indicador icone="progress-clock" rotulo="Em aberto" valor={String((status.ABERTA ?? 0) + (status.EM_ANALISE ?? 0))} detalhe="aberta + em análise" />
          <Indicador icone="check-circle" rotulo="Resolvidas" valor={String(status.RESOLVIDA ?? 0)} />
          <Indicador icone="timer-sand" rotulo="Tempo médio" valor={e.tempoMedioResolucaoHoras === null ? '—' : `${numero(e.tempoMedioResolucaoHoras)} h`} detalhe="até resolver" />
          <Indicador icone="account-check" rotulo="Validação colaborativa" valor={`${numero(e.confirmacao.percentual)}%`} detalhe={`${e.confirmacao.ocorrenciasConfirmadas} confirmadas`} />
          <Indicador icone="bell-alert" rotulo="Alertas" valor={String(e.alertas.total)} detalhe={`${e.alertas.ativos} ativos`} />
        </View>

        <Card testID="grafico-status">
          <Card.Title title="Ocorrências por status" left={(p) => <Icone nome="chart-donut" tamanho={p.size} cor={tema.colors.primary} />} />
          <Card.Content style={estilos.linhaGrafico}>
            <PieChart
              data={fatias.map(({ value, color }) => ({ value: value || 0.0001, color }))}
              donut
              radius={72}
              innerRadius={46}
              innerCircleColor={tema.colors.surface}
              strokeWidth={2}
              strokeColor={tema.colors.surface}
              centerLabelComponent={() => (
                <View style={{ alignItems: 'center' }}>
                  <Text variant="titleLarge" style={{ fontWeight: '800' }}>
                    {e.total}
                  </Text>
                  <Text variant="labelSmall">total</Text>
                </View>
              )}
            />
            <View style={{ flex: 1, gap: 8, minWidth: 150 }} accessibilityLabel={fatias.map((f) => `${f.rotulo}: ${f.value}`).join(', ')}>
              {fatias.map((f) => (
                <View key={f.rotulo} style={estilos.linha}>
                  <View style={[estilos.amostra, { backgroundColor: f.color }]} />
                  <Text variant="bodyMedium" style={{ flex: 1 }}>
                    {f.rotulo}
                  </Text>
                  <Text variant="labelLarge">
                    {f.value} · {numero((f.value / totalStatus) * 100)}%
                  </Text>
                </View>
              ))}
            </View>
          </Card.Content>
        </Card>

        <Card testID="grafico-categorias">
          <Card.Title title="Ocorrências por categoria" left={(p) => <Icone nome="chart-bar" tamanho={p.size} cor={tema.colors.primary} />} />
          <Card.Content>
            <GraficoBarras titulo="Ocorrências por categoria" dados={e.porCategoria.map((c) => ({ rotulo: c.rotulo, valor: c.total }))} />
          </Card.Content>
        </Card>

        <Card testID="grafico-diario">
          <Card.Title title="Registros por dia" subtitle="Últimos 30 dias" left={(p) => <Icone nome="chart-line" tamanho={p.size} cor={tema.colors.primary} />} />
          <Card.Content>
            <LineChart
              data={serie}
              width={larguraGrafico}
              height={160}
              spacing={larguraGrafico / Math.max(1, serie.length - 1)}
              initialSpacing={4}
              endSpacing={4}
              adjustToWidth
              color={paleta[0]}
              thickness={2}
              areaChart
              startFillColor={paleta[0]}
              endFillColor={paleta[0]}
              startOpacity={0.22}
              endOpacity={0.02}
              hideDataPoints
              noOfSections={4}
              yAxisColor="transparent"
              xAxisColor={tema.extra.grade}
              rulesColor={tema.extra.grade}
              rulesType="solid"
              yAxisTextStyle={{ color: tema.extra.tintaFraca, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: tema.extra.tintaFraca, fontSize: 10, width: 40 }}
              yAxisLabelWidth={28}
              disableScroll
              pointerConfig={{
                pointerStripColor: tema.extra.tintaFraca,
                pointerStripWidth: 1,
                pointerColor: paleta[0],
                radius: 5,
                pointerLabelWidth: 90,
                pointerLabelHeight: 40,
                autoAdjustPointerLabelPosition: true,
                pointerLabelComponent: (itens: { value: number; rotulo?: string }[]) => (
                  <View style={[estilos.dica, { backgroundColor: tema.colors.inverseSurface }]}>
                    <Text style={{ color: tema.colors.inverseOnSurface, fontSize: 11 }}>{itens[0]?.rotulo}</Text>
                    <Text style={{ color: tema.colors.inverseOnSurface, fontWeight: '700' }}>{itens[0]?.value} registros</Text>
                  </View>
                ),
              }}
            />
          </Card.Content>
        </Card>

        <Card testID="areas-criticas">
          <Card.Title title="Áreas mais críticas" subtitle="Peso da severidade das ocorrências em aberto" left={(p) => <Icone nome="map-marker-alert" tamanho={p.size} cor={tema.colors.primary} />} />
          <DataTable>
            <DataTable.Header>
              <DataTable.Title>Bairro</DataTable.Title>
              <DataTable.Title numeric>Total</DataTable.Title>
              <DataTable.Title numeric>Abertas</DataTable.Title>
              <DataTable.Title numeric>Pontos</DataTable.Title>
            </DataTable.Header>
            {e.areasCriticas.map((a) => (
              <DataTable.Row key={a.bairro}>
                <DataTable.Cell>{a.bairro}</DataTable.Cell>
                <DataTable.Cell numeric>{a.total}</DataTable.Cell>
                <DataTable.Cell numeric>{a.emAberto}</DataTable.Cell>
                <DataTable.Cell numeric>{numero(a.pontuacao)}</DataTable.Cell>
              </DataTable.Row>
            ))}
          </DataTable>
        </Card>

        <Card>
          <Card.Title title="Exportar" subtitle="PDF com gráficos e tabelas, ou planilha CSV" left={(p) => <Icone nome="file-export" tamanho={p.size} cor={tema.colors.primary} />} />
          <Card.Content style={estilos.linhaBotoes}>
            <Button mode="contained" icon="file-pdf-box" loading={exportando === 'pdf'} disabled={Boolean(exportando)} onPress={() => exportar('pdf')} style={{ flex: 1 }} testID="botao-exportar-pdf">
              Exportar PDF
            </Button>
            <Button mode="outlined" icon="file-delimited" loading={exportando === 'csv'} disabled={Boolean(exportando)} onPress={() => exportar('csv')} style={{ flex: 1 }} testID="botao-exportar-csv">
              Exportar CSV
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>
      <Snackbar visible={Boolean(aviso)} onDismiss={() => setAviso(null)} duration={3500} testID="aviso-relatorio">
        {aviso}
      </Snackbar>
    </View>
  );
}

const estilos = StyleSheet.create({
  pagina: { padding: 16, gap: 12, paddingBottom: 40, maxWidth: 820, width: '100%', alignSelf: 'center' },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  indicador: { flexGrow: 1, flexBasis: '46%' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  linhaGrafico: { flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
  amostra: { width: 12, height: 12, borderRadius: 3 },
  linhaBotoes: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  dica: { padding: 6, borderRadius: 6 },
});
