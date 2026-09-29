import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { ActivityIndicator, Button, Card, Chip, ProgressBar, SegmentedButtons, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { mensagemDeErro } from '@/api/cliente';
import { chaves, useAlertas, useLeiturasEstacao, useMananciais, useResumoAmbiental } from '@/api/consultas';
import { Bloco } from '@/componentes/Esqueleto';
import { EstadoVazio } from '@/componentes/EstadoVazio';
import { EtiquetaIqar } from '@/componentes/Etiquetas';
import { Icone } from '@/componentes/Icone';
import { usePreferencias } from '@/estado/preferencias';
import { obterLocalizacao } from '@/servicos/localizacao';
import { IQAR, SERIES } from '@/tema/cores';
import type { TemaEcoRadar } from '@/tema/tema';
import type { Estacao, PontoSerie } from '@/tipos';
import { distancia, hora, numero, tempoRelativo } from '@/utils/formatacao';
import { alertaAlcanca, manancialLocal, ordenarPorDistancia, type Ponto } from '@/utils/geo';

/** Até esta distância a estação representa o local do usuário; além dela, só os dados da cidade. */
const RAIO_ESTACAO_KM = 15;
/** Córrego só entra no status do local quando está realmente perto (o risco de alagamento é localizado). */
const RAIO_CORREGO_KM = 5;

type EstacaoComDistancia = { item: Estacao; km: number };

type SituacaoCorrego = NonNullable<Estacao['corrego']>['situacao'];
const situacaoCorrego = (s: SituacaoCorrego) =>
  s === 'EXTRAVASAMENTO' ? 'Transbordando' : s === 'ALERTA' ? 'Acima da cota' : s === 'ATENCAO' ? 'Atenção' : 'Normal';

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

function LinhaStatus({ icone, cor, titulo, texto, aoPressionar, testID }: { icone: string; cor: string; titulo: string; texto: string; aoPressionar?: () => void; testID?: string }) {
  const tema = useTheme<TemaEcoRadar>();
  const conteudo = (
    <View style={estilos.linha}>
      <View style={[estilos.bolha, { backgroundColor: tema.colors.surfaceVariant }]}>
        <Icone nome={icone} cor={cor} tamanho={18} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="labelLarge">{titulo}</Text>
        <Text variant="bodySmall" style={{ color: tema.extra.tintaSecundaria }}>
          {texto}
        </Text>
      </View>
      {aoPressionar && <Icone nome="chevron-right" cor={tema.extra.tintaFraca} />}
    </View>
  );
  if (!aoPressionar) return <View testID={testID}>{conteudo}</View>;
  return (
    <TouchableRipple onPress={aoPressionar} borderless style={{ borderRadius: 10 }} accessibilityRole="button" testID={testID}>
      {conteudo}
    </TouchableRipple>
  );
}

/** Status completo do ambiente onde o usuário está, a partir das estações mais próximas. */
function CartaoLocal({ local, proximas, cidade }: { local: Ponto; proximas: EstacaoComDistancia[]; cidade: string }) {
  const tema = useTheme<TemaEcoRadar>();
  const raioAlertasKm = usePreferencias((s) => s.raioAlertasKm);
  const alertas = useAlertas('ATIVO');
  const mananciais = useMananciais();

  // Ar, inversão e córrego dependem de uma estação por perto; alertas e manancial valem em qualquer ponto.
  const cobertas = proximas.filter((p) => p.km <= RAIO_ESTACAO_KM);
  const principal = cobertas.find((p) => p.item.online && p.item.iqar) ?? cobertas[0];
  const e = principal?.item;
  const l = e?.leitura;
  /** Complemento quando o dado vem de outra estação que não a principal. */
  const origem = (p: EstacaoComDistancia) => (p.item.id === e?.id ? '' : ` · ${p.item.bairro}, a ${distancia(p.km)}`);
  const termica = cobertas.find((p) => p.item.leitura?.tempSuperficie != null);
  const corrego = proximas.find((p) => p.item.corrego && p.km <= RAIO_CORREGO_KM);
  const alertasPerto = alertas.data ? alertas.data.itens.filter((a) => alertaAlcanca(a, local, raioAlertasKm)) : null;
  const manancial = manancialLocal(local, mananciais.data);

  return (
    <Card style={[estilos.cartao, estilos.destaque, { borderLeftColor: e?.iqar ? IQAR[e.iqar.classe].cor : tema.colors.outline }]} testID="cartao-local">
      <Card.Title
        title="Onde você está"
        subtitle={principal ? `Estação ${principal.item.bairro} · a ${distancia(principal.km)} de você` : 'Nenhuma estação por perto'}
        left={(p) => <Icone nome="crosshairs-gps" tamanho={p.size} cor={tema.colors.primary} />}
      />
      <Card.Content style={{ gap: 12 }}>
        {e ? (
          <>
            <View style={estilos.linha}>
              {e.iqar ? <EtiquetaIqar classe={e.iqar.classe} indice={e.iqar.indice} grande /> : <Text>Sem IQAr</Text>}
              <Text variant="bodySmall" style={{ flex: 1, color: tema.extra.tintaSecundaria }}>
                {e.iqar ? IQAR[e.iqar.classe].recomendacao : 'A estação não enviou leituras recentes.'}
                {e.iqar?.poluenteDominante ? ` Poluente dominante: ${e.iqar.poluenteDominante}.` : ''}
              </Text>
            </View>
            <View style={estilos.grade}>
              <Valor rotulo="MP2,5" valor={l?.pm25} unidade=" µg/m³" />
              <Valor rotulo="Temperatura" valor={l?.temperatura} unidade=" °C" />
              <Valor rotulo="Umidade" valor={l?.umidade} unidade="%" />
            </View>
          </>
        ) : (
          <Text variant="bodySmall" style={{ color: tema.extra.tintaSecundaria }} testID="local-sem-estacao">
            {proximas.length > 0
              ? `A estação mais próxima (${proximas[0].item.bairro}) fica a ${distancia(proximas[0].km)}, longe demais para representar o ar daqui. Abaixo, a média de ${cidade}.`
              : `Abaixo, a média de ${cidade}.`}
          </Text>
        )}
        <View style={{ gap: 10 }}>
          {termica &&
            (termica.item.inversao.ativa ? (
              <LinhaStatus
                testID="local-inversao"
                icone="thermometer-alert"
                cor="#c98500"
                titulo={`Inversão térmica ${termica.item.inversao.intensidade?.toLowerCase() ?? ''}`.trim()}
                texto={`A dispersão dos poluentes está prejudicada${origem(termica)}.`}
              />
            ) : (
              <LinhaStatus testID="local-inversao" icone="thermometer-lines" cor="#16a34a" titulo="Sem inversão térmica" texto={`Perfil térmico normal${origem(termica)}.`} />
            ))}
          {corrego?.item.corrego && (
            <LinhaStatus
              testID="local-corrego"
              icone="waves-arrow-up"
              cor={
                corrego.item.corrego.situacao === 'ALERTA' || corrego.item.corrego.situacao === 'EXTRAVASAMENTO'
                  ? '#d03b3b'
                  : corrego.item.corrego.situacao === 'ATENCAO'
                    ? '#c98500'
                    : '#16a34a'
              }
              titulo={`${corrego.item.corrego.nome}: ${situacaoCorrego(corrego.item.corrego.situacao)}`}
              texto={`Nível ${numero(corrego.item.corrego.nivelCm, ' cm')} (cota de alerta ${numero(corrego.item.corrego.cotaAlertaCm, ' cm')}) · a ${distancia(corrego.km)}`}
            />
          )}
          {alertasPerto &&
            (alertasPerto.length > 0 ? (
              <LinhaStatus
                testID="local-alertas"
                icone="bell-ring"
                cor="#d03b3b"
                titulo={alertasPerto.length === 1 ? '1 alerta ativo perto de você' : `${alertasPerto.length} alertas ativos perto de você`}
                texto={alertasPerto.length === 1 ? alertasPerto[0].titulo : `${alertasPerto[0].titulo} e mais ${alertasPerto.length - 1}`}
                aoPressionar={() => router.push('/(abas)/alertas')}
              />
            ) : (
              <LinhaStatus testID="local-alertas" icone="bell-check-outline" cor="#16a34a" titulo="Nenhum alerta ativo perto de você" texto={`Raio de ${raioAlertasKm} km (ajustável no Perfil).`} />
            ))}
          {manancial && (
            <LinhaStatus
              testID="local-manancial"
              icone="water"
              cor={tema.colors.primary}
              titulo="Área de proteção de manancial"
              texto={`${manancial} · invasões e desmatamento registrados aqui têm prioridade de fiscalização.`}
            />
          )}
        </View>
        {e && (
          <Text variant="labelSmall" style={{ color: tema.extra.tintaFraca }}>
            {e.nome} · {e.online ? 'transmitindo' : 'sem sinal'}
            {e.ultimaLeituraEm ? ` · leitura ${tempoRelativo(e.ultimaLeituraEm)}` : ''}
          </Text>
        )}
      </Card.Content>
    </Card>
  );
}

function CartaoSemLocal({ localizando, aoLocalizar }: { localizando: boolean; aoLocalizar: () => void }) {
  const tema = useTheme<TemaEcoRadar>();
  return (
    <Card style={estilos.cartao} testID="cartao-local-indisponivel">
      <Card.Content style={estilos.linha}>
        {localizando ? <ActivityIndicator size="small" /> : <Icone nome="crosshairs-question" cor={tema.colors.primary} />}
        <Text variant="bodyMedium" style={{ flex: 1 }}>
          {localizando ? 'Buscando sua localização…' : 'Ative a localização para ver primeiro o status do ambiente onde você está.'}
        </Text>
        {!localizando && (
          <Button mode="contained-tonal" compact onPress={aoLocalizar}>
            Localizar
          </Button>
        )}
      </Card.Content>
    </Card>
  );
}

function CartaoEstacao({ e, km }: { e: Estacao; km?: number | null }) {
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
                {km != null ? ` · a ${distancia(km)} de você` : ''}
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
                {situacaoCorrego(e.corrego.situacao)}
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

  const local = usePreferencias((s) => s.ultimaLocalizacao);
  // obterLocalizacao grava a posição em ultimaLocalizacao (preferências), que alimenta o cartão do local
  const [localizando, setLocalizando] = useState(true);
  useEffect(() => {
    void obterLocalizacao().then(() => setLocalizando(false));
  }, []);
  const localizar = useCallback(async () => {
    setLocalizando(true);
    await obterLocalizacao();
    setLocalizando(false);
  }, []);
  const proximas = useMemo(() => (local && r ? ordenarPorDistancia(local, r.estacoes) : null), [local, r]);

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
  // Dentro da área monitorada, as estações seguem a ordem de distância; fora dela, a ordem original.
  const ordem: { item: Estacao; km: number | null }[] =
    proximas?.[0] && proximas[0].km <= RAIO_ESTACAO_KM ? proximas : r.estacoes.map((item) => ({ item, km: null }));
  const naArea = ordem[0]?.km != null;

  return (
    <ScrollView
      contentContainerStyle={{ paddingVertical: 8, paddingBottom: 32 }}
      refreshControl={
        <RefreshControl
          refreshing={resumo.isRefetching}
          onRefresh={() => {
            void localizar();
            void qc.invalidateQueries({ queryKey: chaves.resumo });
          }}
        />
      }
      testID="tela-ambiental"
    >
      {local && proximas ? <CartaoLocal local={local} proximas={proximas} cidade={r.cidade.nome} /> : <CartaoSemLocal localizando={localizando} aoLocalizar={() => void localizar()} />}

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
          subtitle={`Qualidade do ar e clima em ${r.cidade.nome} (API pública)`}
          subtitleNumberOfLines={2}
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

      {/* key: ao descobrir a posição, o gráfico reabre na estação mais próxima */}
      <GraficoEstacao key={ordem[0]?.item.id} estacoes={ordem.map((o) => o.item)} />

      <Text variant="titleMedium" style={estilos.secao}>
        {naArea ? 'Estações (mais próximas primeiro)' : 'Estações de monitoramento'}
      </Text>
      {ordem.map(({ item, km }) => (
        <CartaoEstacao key={item.id} e={item} km={km} />
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
  destaque: { borderLeftWidth: 5 },
  bolha: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  secao: { marginHorizontal: 20, marginTop: 12, marginBottom: 4 },
  dica: { padding: 6, borderRadius: 6 },
});
