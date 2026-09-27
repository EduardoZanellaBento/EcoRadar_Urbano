import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { Card, Chip, ProgressBar, SegmentedButtons, Text, useTheme } from 'react-native-paper';
import { mensagemDeErro } from '@/api/cliente';
import { chaves, useLeiturasEstacao, useResumoAmbiental } from '@/api/consultas';
import { Bloco } from '@/componentes/Esqueleto';
import { EstadoVazio } from '@/componentes/EstadoVazio';
import { EtiquetaIqar } from '@/componentes/Etiquetas';
import { Icone } from '@/componentes/Icone';
import { IQAR, SERIES } from '@/tema/cores';
import type { TemaEcoRadar } from '@/tema/tema';
import type { Estacao, PontoSerie } from '@/tipos';
import { hora, numero, tempoRelativo } from '@/utils/formatacao';

type Metrica = 'iqar' | 'pm25' | 'temperatura' | 'nivelCorregoCm';
const METRICAS: Record<Metrica, { rotulo: string; unidade: string }> = {
  iqar: { rotulo: 'IQAr', unidade: '' },
  pm25: { rotulo: 'MP2,5', unidade: ' µg/m³' },
  temperatura: { rotulo: 'Temp.', unidade: ' °C' },
  nivelCorregoCm: { rotulo: 'Córrego', unidade: ' cm' },
};

function Valor({ rotulo, valor, unidade = '' }: { rotulo: string; valor: number | null | undefined; unidade?: string }) {
  const tema = useTheme<TemaEcoRadar>();
  return (
    <View style={estilos.valor}>
      <Text variant="labelSmall" style={{ color: tema.extra.tintaFraca }}>
        {rotulo}
      </Text>
      <Text variant="titleSmall">{numero(valor, unidade)}</Text>
    </View>
  );
}

function GraficoEstacao({ estacoes }: { estacoes: Estacao[] }) {
  const tema = useTheme<TemaEcoRadar>();
  const [estacaoId, setEstacaoId] = useState<string>(estacoes[0]?.id ?? '');
  const [metrica, setMetrica] = useState<Metrica>('iqar');
  const [largura, setLargura] = useState(300);
  const leituras = useLeiturasEstacao(estacaoId || null, '24h');
  const cor = tema.extra.escuro ? SERIES.escuro[0] : SERIES.claro[0];
  const estacao = estacoes.find((e) => e.id === estacaoId);
  const disponiveis = (Object.keys(METRICAS) as Metrica[]).filter((m) => m !== 'nivelCorregoCm' || estacao?.corrego);

  const dados = useMemo(() => {
    const pontos = (leituras.data?.pontos ?? []).filter((p: PontoSerie) => p[metrica] !== null);
    return pontos.map((p, i) => ({
      value: Number(p[metrica]),
      label: i % 8 === 0 ? hora(p.instante) : '',
      rotulo: hora(p.instante),
    }));
  }, [leituras.data, metrica]);

  const larguraGrafico = Math.max(200, largura - 56);
  return (
    <Card style={estilos.cartao} testID="cartao-grafico">
      <Card.Title title="Últimas 24 horas" subtitle={estacao ? `${estacao.nome} · ${METRICAS[metrica].rotulo}` : ''} left={(p) => <Icone nome="chart-line" tamanho={p.size} cor={tema.colors.primary} />} />
      <Card.Content style={{ gap: 10 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {estacoes.map((e) => (
            <Chip key={e.id} selected={e.id === estacaoId} onPress={() => setEstacaoId(e.id)} compact showSelectedCheck={false}>
              {e.bairro}
            </Chip>
          ))}
        </ScrollView>
        <SegmentedButtons
          value={disponiveis.includes(metrica) ? metrica : 'iqar'}
          onValueChange={(v) => setMetrica(v as Metrica)}
          density="small"
          buttons={disponiveis.map((m) => ({ value: m, label: METRICAS[m].rotulo }))}
        />
        <View onLayout={(e) => setLargura(e.nativeEvent.layout.width)} accessibilityLabel={`Gráfico de ${METRICAS[metrica].rotulo} nas últimas 24 horas`}>
          {leituras.isLoading ? (
            <Bloco altura={180} />
          ) : dados.length < 2 ? (
            <Text style={{ color: tema.extra.tintaFraca }}>Ainda não há leituras suficientes para esta estação.</Text>
          ) : (
            <LineChart
              data={dados}
              width={larguraGrafico}
              height={170}
              spacing={Math.max(2, larguraGrafico / Math.max(1, dados.length - 1))}
              initialSpacing={4}
              endSpacing={4}
              adjustToWidth
              areaChart
              curved
              color={cor}
              thickness={2}
              startFillColor={cor}
              endFillColor={cor}
              startOpacity={0.25}
              endOpacity={0.02}
              hideDataPoints
              noOfSections={4}
              yAxisColor="transparent"
              xAxisColor={tema.extra.grade}
              rulesColor={tema.extra.grade}
              rulesType="solid"
              yAxisTextStyle={{ color: tema.extra.tintaFraca, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: tema.extra.tintaFraca, fontSize: 10, width: 40 }}
              yAxisLabelWidth={34}
              disableScroll
              pointerConfig={{
                pointerStripColor: tema.extra.tintaFraca,
                pointerStripWidth: 1,
                pointerColor: cor,
                radius: 5,
                pointerLabelWidth: 110,
                pointerLabelHeight: 44,
                activatePointersOnLongPress: false,
                autoAdjustPointerLabelPosition: true,
                pointerLabelComponent: (itens: { value: number; rotulo?: string }[]) => (
                  <View style={[estilos.dica, { backgroundColor: tema.colors.inverseSurface }]}>
                    <Text style={{ color: tema.colors.inverseOnSurface, fontSize: 11 }}>{itens[0]?.rotulo}</Text>
                    <Text style={{ color: tema.colors.inverseOnSurface, fontWeight: '700' }}>{numero(itens[0]?.value, METRICAS[metrica].unidade)}</Text>
                  </View>
                ),
              }}
            />
          )}
        </View>
        {metrica === 'iqar' && (
          <Text variant="labelSmall" style={{ color: tema.extra.tintaFraca }}>
            Faixas CETESB: Boa até 40 · Moderada até 80 · Ruim até 120 · Muito Ruim até 200 · Péssima acima de 200.
          </Text>
        )}
      </Card.Content>
    </Card>
  );
}

function CartaoEstacao({ e }: { e: Estacao }) {
  const tema = useTheme<TemaEcoRadar>();
  const l = e.leitura;
  const cota = e.corrego?.cotaAlertaCm ?? null;
  const proporcao = cota && e.corrego?.nivelCm != null ? Math.min(1, e.corrego.nivelCm / (cota * 1.3)) : 0;
  const alertaCorrego = e.corrego?.situacao === 'ALERTA' || e.corrego?.situacao === 'EXTRAVASAMENTO';
  return (
    <Card style={estilos.cartao} testID={`estacao-${e.id}`}>
      <Card.Content style={{ gap: 10 }}>
        <View style={estilos.linha}>
          <View style={{ flex: 1 }}>
            <Text variant="titleMedium">{e.nome}</Text>
            <View style={estilos.linha}>
              <View style={[estilos.ponto, { backgroundColor: e.online ? '#16a34a' : '#9ca3af' }]} />
              <Text variant="labelSmall" style={{ color: tema.extra.tintaFraca }}>
                {e.online ? 'Transmitindo' : 'Sem sinal'} {e.ultimaLeituraEm ? `· ${tempoRelativo(e.ultimaLeituraEm)}` : ''}
                {e.cenario ? ` · cenário ${e.cenario}` : ''}
              </Text>
            </View>
          </View>
          {e.iqar ? <EtiquetaIqar classe={e.iqar.classe} indice={e.iqar.indice} /> : <Text>Sem IQAr</Text>}
        </View>
        {e.iqar && (
          <Text variant="bodySmall" style={{ color: tema.extra.tintaSecundaria }}>
            {IQAR[e.iqar.classe].recomendacao} {e.iqar.poluenteDominante ? `Poluente dominante: ${e.iqar.poluenteDominante}.` : ''}
          </Text>
        )}
        <View style={estilos.grade}>
          <Valor rotulo="MP2,5" valor={l?.pm25} unidade=" µg/m³" />
          <Valor rotulo="MP10" valor={l?.pm10} unidade=" µg/m³" />
          <Valor rotulo="O₃" valor={l?.o3} unidade=" µg/m³" />
          <Valor rotulo="NO₂" valor={l?.no2} unidade=" µg/m³" />
          <Valor rotulo="CO" valor={l?.co} unidade=" ppm" />
          <Valor rotulo="Temperatura" valor={l?.temperatura} unidade=" °C" />
          <Valor rotulo="Umidade" valor={l?.umidade} unidade="%" />
        </View>
        {l?.tempSuperficie != null && (
          <View style={[estilos.faixa, { backgroundColor: e.inversao.ativa ? '#fff3d6' : tema.colors.surfaceVariant }]} testID={`inversao-${e.id}`}>
            <Icone nome="thermometer-lines" cor={e.inversao.ativa ? '#8a5a00' : tema.colors.onSurfaceVariant} />
            <Text variant="bodySmall" style={{ flex: 1, color: e.inversao.ativa ? '#5f3d00' : tema.colors.onSurfaceVariant }}>
              {e.inversao.ativa
                ? `Inversão térmica ${e.inversao.intensidade?.toLowerCase() ?? ''}: ar a 300 m está ${numero(e.inversao.diferenca)} °C mais quente que na superfície.`
                : `Perfil térmico normal (superfície ${numero(l.tempSuperficie)} °C · 300 m ${numero(l.temp300m)} °C).`}
            </Text>
          </View>
        )}
        {e.corrego && (
          <View style={{ gap: 4 }}>
            <View style={estilos.linha}>
              <Icone nome="waves-arrow-up" tamanho={18} cor={alertaCorrego ? '#d03b3b' : tema.colors.primary} />
              <Text variant="labelLarge" style={{ flex: 1 }}>
                {e.corrego.nome}: {numero(e.corrego.nivelCm, ' cm')}
              </Text>
              <Text variant="labelMedium" style={{ color: alertaCorrego ? '#d03b3b' : tema.extra.tintaFraca, fontWeight: '700' }}>
                {e.corrego.situacao === 'EXTRAVASAMENTO' ? 'Transbordando' : e.corrego.situacao === 'ALERTA' ? 'Acima da cota' : e.corrego.situacao === 'ATENCAO' ? 'Atenção' : 'Normal'}
              </Text>
            </View>
            <ProgressBar progress={proporcao} color={alertaCorrego ? '#d03b3b' : tema.colors.primary} style={{ height: 8, borderRadius: 4 }} />
            <Text variant="labelSmall" style={{ color: tema.extra.tintaFraca }}>
              Cota de alerta: {numero(cota, ' cm')}
            </Text>
          </View>
        )}
      </Card.Content>
    </Card>
  );
}

export default function TelaAmbiental() {
  const tema = useTheme<TemaEcoRadar>();
  const qc = useQueryClient();
  const resumo = useResumoAmbiental();
  const r = resumo.data;
  const om = r?.openMeteo;

  if (resumo.isLoading) {
    return (
      <View style={{ padding: 16, gap: 12 }}>
        <Bloco altura={120} raio={16} />
        <Bloco altura={160} raio={16} />
        <Bloco altura={220} raio={16} />
      </View>
    );
  }
  if (!r) {
    return <EstadoVazio ilustracao="erro" titulo="Dados ambientais indisponíveis" descricao={mensagemDeErro(resumo.error)} acao={{ rotulo: 'Tentar novamente', aoPressionar: () => void resumo.refetch() }} />;
  }

  const fonte = om?.fonte ?? 'indisponivel';
  const corFonte = fonte === 'ao_vivo' ? '#16a34a' : fonte === 'cache' ? '#c98500' : '#d03b3b';
  const clima = om?.dados?.clima;
  const ar = om?.dados?.ar;

  return (
    <ScrollView
      contentContainerStyle={{ paddingVertical: 8, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={resumo.isRefetching} onRefresh={() => void qc.invalidateQueries({ queryKey: chaves.resumo })} />}
      testID="tela-ambiental"
    >
      <Card style={estilos.cartao} testID="cartao-iqar-cidade">
        <Card.Content style={{ gap: 10 }}>
          <Text variant="labelLarge" style={{ color: tema.extra.tintaFraca }}>
            Qualidade do ar em {r.cidade.nome}
          </Text>
          <View style={estilos.linha}>
            {r.indicadores.iqarMedioClasse ? (
              <EtiquetaIqar classe={r.indicadores.iqarMedioClasse} indice={r.indicadores.iqarMedio} grande />
            ) : (
              <Text>Sem dados</Text>
            )}
            <Text variant="bodySmall" style={{ flex: 1, color: tema.extra.tintaSecundaria }}>
              Média das estações · {r.indicadores.iqarMedioClasse ? IQAR[r.indicadores.iqarMedioClasse].recomendacao : ''}
            </Text>
          </View>
          <View style={estilos.grade}>
            <Valor rotulo="Estações online" valor={r.indicadores.estacoesOnline} unidade={` de ${r.indicadores.estacoesTotal}`} />
            <Valor rotulo="Temperatura média" valor={r.indicadores.temperaturaMedia} unidade=" °C" />
            <Valor rotulo="Córregos em alerta" valor={r.indicadores.corregosEmAlerta} />
          </View>
          {r.indicadores.inversaoTermicaAtiva && (
            <View style={[estilos.faixa, { backgroundColor: '#fff3d6' }]}>
              <Icone nome="alert" cor="#8a5a00" />
              <Text variant="bodySmall" style={{ color: '#5f3d00', flex: 1 }}>
                Inversão térmica detectada em ao menos uma estação: a dispersão dos poluentes está prejudicada.
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>

      <Card style={estilos.cartao} testID="cartao-open-meteo">
        <Card.Title
          title="Dados Open-Meteo"
          subtitle="Qualidade do ar e clima (API pública)"
          left={(p) => <Icone nome="weather-partly-cloudy" tamanho={p.size} cor={tema.colors.primary} />}
        />
        <Card.Content style={{ gap: 10 }}>
          <View style={[estilos.faixa, { backgroundColor: tema.colors.surfaceVariant }]} testID="fonte-open-meteo">
            <Icone nome={fonte === 'ao_vivo' ? 'access-point-network' : fonte === 'cache' ? 'database-clock' : 'cloud-off-outline'} cor={corFonte} />
            <View style={{ flex: 1 }}>
              <Text variant="labelLarge" style={{ color: corFonte, fontWeight: '800' }}>
                {fonte === 'ao_vivo' ? 'AO VIVO' : fonte === 'cache' ? 'DADOS EM CACHE' : 'INDISPONÍVEL'}
              </Text>
              <Text variant="labelSmall" style={{ color: tema.colors.onSurfaceVariant }}>
                {om?.atualizadoEm ? `Atualizado às ${hora(om.atualizadoEm)} (${tempoRelativo(om.atualizadoEm)})` : 'Nunca atualizado'} · circuito {om?.estadoCircuito.toLowerCase().replace('_', '-')}
              </Text>
              {om?.motivo && (
                <Text variant="labelSmall" style={{ color: tema.colors.onSurfaceVariant }}>
                  {om.motivo}
                </Text>
              )}
            </View>
          </View>
          {om?.dados && (
            <>
              <View style={estilos.linha}>
                {ar?.iqar && <EtiquetaIqar classe={ar.iqar.classe} indice={ar.iqar.indice} />}
                <Text variant="bodySmall" style={{ flex: 1, color: tema.extra.tintaSecundaria }}>
                  IQAr calculado pelo EcoRadar (faixas CETESB) a partir dos dados da Open-Meteo.
                </Text>
              </View>
              <View style={estilos.grade}>
                <Valor rotulo="MP2,5" valor={ar?.pm25} unidade=" µg/m³" />
                <Valor rotulo="MP10" valor={ar?.pm10} unidade=" µg/m³" />
                <Valor rotulo="O₃" valor={ar?.o3} unidade=" µg/m³" />
                <Valor rotulo="NO₂" valor={ar?.no2} unidade=" µg/m³" />
                <Valor rotulo="Temperatura" valor={clima?.temperatura} unidade=" °C" />
                <Valor rotulo="Sensação" valor={clima?.sensacaoTermica} unidade=" °C" />
                <Valor rotulo="Umidade" valor={clima?.umidade} unidade="%" />
                <Valor rotulo="Vento" valor={clima?.ventoKmh} unidade=" km/h" />
                <Valor rotulo="Chance de chuva" valor={clima?.probabilidadeChuva} unidade="%" />
              </View>
              <Text variant="bodyMedium">
                {clima?.descricao} · máx. {numero(clima?.maximaDia, ' °C')} · mín. {numero(clima?.minimaDia, ' °C')}
              </Text>
            </>
          )}
        </Card.Content>
      </Card>

      <GraficoEstacao estacoes={r.estacoes} />

      <Text variant="titleMedium" style={estilos.secao}>
        Estações de monitoramento
      </Text>
      {r.estacoes.map((e) => (
        <CartaoEstacao key={e.id} e={e} />
      ))}
      <Text variant="labelSmall" style={[estilos.secao, { color: tema.extra.tintaFraca }]}>
        Estações virtuais (simulador MQTT). IQAr conforme CETESB / Resolução CONAMA nº 491/2018.
      </Text>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  cartao: { marginHorizontal: 16, marginVertical: 6 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ponto: { width: 8, height: 8, borderRadius: 4 },
  grade: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 },
  valor: { width: '33.3%', paddingRight: 6 },
  faixa: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10 },
  secao: { marginHorizontal: 20, marginTop: 12, marginBottom: 4 },
  dica: { padding: 6, borderRadius: 6 },
});
