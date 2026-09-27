import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, FAB, IconButton, Surface, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEstacoes, useMananciais, useOcorrenciasMapa } from '@/api/consultas';
import { EtiquetaIqar, EtiquetaSeveridade, EtiquetaStatus } from '@/componentes/Etiquetas';
import { Icone } from '@/componentes/Icone';
import Mapa from '@/componentes/mapa/Mapa';
import { CIDADE_PADRAO } from '@/config';
import { useConexao } from '@/estado/conexao';
import { obterLocalizacao, type Posicao } from '@/servicos/localizacao';
import { CATEGORIA, IQAR, SEVERIDADE } from '@/tema/cores';
import type { TemaEcoRadar } from '@/tema/tema';
import { CATEGORIAS, SEVERIDADES, type Categoria } from '@/tipos';
import { tempoRelativo } from '@/utils/formatacao';

type Selecao = { tipo: 'ocorrencia'; id: string } | { tipo: 'estacao'; id: string } | null;

export default function TelaMapa() {
  const tema = useTheme<TemaEcoRadar>();
  const insets = useSafeAreaInsets();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [mostrarEstacoes, setMostrarEstacoes] = useState(true);
  const [mostrarMananciais, setMostrarMananciais] = useState(true);
  const [legenda, setLegenda] = useState(false);
  const [selecao, setSelecao] = useState<Selecao>(null);
  const [posicao, setPosicao] = useState<Posicao | null>(null);
  const [centralizar, setCentralizar] = useState<{ latitude: number; longitude: number; chave: number } | null>(null);
  const socketConectado = useConexao((s) => s.socket.conectado);

  const ocorrencias = useOcorrenciasMapa({ status: ['ABERTA', 'EM_ANALISE'] });
  const estacoes = useEstacoes();
  const mananciais = useMananciais();

  useEffect(() => {
    void obterLocalizacao().then(setPosicao);
  }, []);

  const visiveis = useMemo(
    () => (ocorrencias.data?.itens ?? []).filter((o) => categorias.length === 0 || categorias.includes(o.categoria)),
    [ocorrencias.data, categorias],
  );
  const ocorrenciaSel = selecao?.tipo === 'ocorrencia' ? ocorrencias.data?.itens.find((o) => o.id === selecao.id) : undefined;
  const estacaoSel = selecao?.tipo === 'estacao' ? estacoes.data?.find((e) => e.id === selecao.id) : undefined;

  const alternar = (c: Categoria) => setCategorias((atual) => (atual.includes(c) ? atual.filter((x) => x !== c) : [...atual, c]));

  const irParaMinhaLocalizacao = async () => {
    const p = posicao ?? (await obterLocalizacao());
    if (p) {
      setPosicao(p);
      setCentralizar({ latitude: p.latitude, longitude: p.longitude, chave: Date.now() });
    }
  };

  return (
    <View style={{ flex: 1 }} testID="tela-mapa">
      <Mapa
        testID="mapa"
        regiaoInicial={{ latitude: CIDADE_PADRAO.latitude, longitude: CIDADE_PADRAO.longitude, delta: 0.18 }}
        ocorrencias={visiveis.map((o) => ({ id: o.id, latitude: o.latitude, longitude: o.longitude, categoria: o.categoria, severidade: o.severidade, titulo: CATEGORIA[o.categoria].rotulo }))}
        estacoes={
          mostrarEstacoes
            ? (estacoes.data ?? []).map((e) => ({ id: e.id, nome: e.nome, latitude: e.latitude, longitude: e.longitude, iqar: e.iqar, inversao: e.inversao.ativa }))
            : []
        }
        mananciais={mostrarMananciais ? mananciais.data : undefined}
        minhaLocalizacao={posicao}
        centralizarEm={centralizar}
        modoEscuro={tema.extra.escuro}
        aoTocarOcorrencia={(id) => setSelecao({ tipo: 'ocorrencia', id })}
        aoTocarEstacao={(id) => setSelecao({ tipo: 'estacao', id })}
        aoTocarMapa={() => setSelecao(null)}
      />

      {/* Barra superior: título, estado em tempo real e filtros */}
      <View style={[estilos.topo, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <Surface style={[estilos.barra, { backgroundColor: tema.colors.surface }]} elevation={2}>
          <Icone nome="map-marker-radius" cor={tema.colors.primary} />
          <View style={{ flex: 1 }}>
            <Text variant="titleMedium" style={{ fontWeight: '800' }}>
              Mapa ambiental
            </Text>
            <Text variant="labelSmall" style={{ color: tema.extra.tintaFraca }} testID="contador-mapa">
              {ocorrencias.isLoading ? 'Carregando…' : `${visiveis.length} ocorrências em aberto · ${estacoes.data?.length ?? 0} estações`}
            </Text>
          </View>
          <View style={[estilos.aoVivo, { backgroundColor: socketConectado ? '#dcfce7' : tema.colors.surfaceVariant }]} accessibilityLabel={socketConectado ? 'Tempo real conectado' : 'Tempo real desconectado'} testID="indicador-tempo-real">
            <View style={[estilos.pontoVivo, { backgroundColor: socketConectado ? '#16a34a' : '#9ca3af' }]} />
            <Text variant="labelSmall" style={{ color: socketConectado ? '#14532d' : tema.colors.onSurfaceVariant, fontWeight: '700' }}>
              {socketConectado ? 'AO VIVO' : 'OFFLINE'}
            </Text>
          </View>
          <IconButton icon="information-outline" onPress={() => setLegenda((v) => !v)} accessibilityLabel="Mostrar legenda" testID="botao-legenda" />
        </Surface>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.chips} testID="filtros-categoria">
          <Chip selected={categorias.length === 0} onPress={() => setCategorias([])} style={estilos.chip} compact showSelectedCheck={false}>
            Todas
          </Chip>
          {CATEGORIAS.map((c) => (
            <Chip
              key={c}
              icon={CATEGORIA[c].icone}
              selected={categorias.includes(c)}
              onPress={() => alternar(c)}
              style={estilos.chip}
              compact
              testID={`filtro-${c}`}
              accessibilityLabel={`Filtrar ${CATEGORIA[c].rotulo}`}
            >
              {CATEGORIA[c].rotulo}
            </Chip>
          ))}
          <Chip icon="radar" selected={mostrarEstacoes} onPress={() => setMostrarEstacoes((v) => !v)} style={estilos.chip} compact>
            Estações
          </Chip>
          <Chip icon="water" selected={mostrarMananciais} onPress={() => setMostrarMananciais((v) => !v)} style={estilos.chip} compact>
            Mananciais
          </Chip>
        </ScrollView>

        {legenda && (
          <Card style={estilos.legenda} testID="legenda-mapa">
            <Card.Content style={{ gap: 6 }}>
              <Text variant="labelLarge">Cor do marcador = severidade · ícone = categoria</Text>
              <View style={estilos.linhaLegenda}>
                {SEVERIDADES.map((s) => (
                  <EtiquetaSeveridade key={s} severidade={s} compacta />
                ))}
              </View>
              <Text variant="labelLarge">Estações (número = IQAr, faixas CETESB)</Text>
              <View style={estilos.linhaLegenda}>
                {(Object.keys(IQAR) as (keyof typeof IQAR)[]).map((c) => (
                  <EtiquetaIqar key={c} classe={c} />
                ))}
              </View>
              <Text variant="labelSmall" style={{ color: tema.extra.tintaFraca }}>
                Áreas em azul: mananciais Guarapiranga e Billings (polígonos aproximados, para fins didáticos).
              </Text>
            </Card.Content>
          </Card>
        )}
      </View>

      {/* Cartão do item selecionado */}
      {(ocorrenciaSel || estacaoSel) && (
        <Card style={[estilos.selecao, { bottom: 92 }]} testID="cartao-selecao">
          <Card.Content style={{ gap: 6 }}>
            {ocorrenciaSel && (
              <>
                <View style={estilos.linhaLegenda}>
                  <Icone nome={CATEGORIA[ocorrenciaSel.categoria].icone} cor={SEVERIDADE[ocorrenciaSel.severidade].cor} />
                  <Text variant="titleMedium" style={{ flex: 1 }}>
                    {CATEGORIA[ocorrenciaSel.categoria].rotulo}
                  </Text>
                  <Text variant="labelSmall">{tempoRelativo(ocorrenciaSel.criadoEm)}</Text>
                </View>
                <Text variant="bodyMedium" numberOfLines={2}>
                  {ocorrenciaSel.descricao}
                </Text>
                <View style={estilos.linhaLegenda}>
                  <EtiquetaSeveridade severidade={ocorrenciaSel.severidade} compacta />
                  <EtiquetaStatus status={ocorrenciaSel.status} />
                  <Text variant="labelMedium">{ocorrenciaSel.bairro}</Text>
                </View>
                <Button mode="contained-tonal" onPress={() => router.push(`/ocorrencia/${ocorrenciaSel.id}`)} testID="botao-ver-detalhes">
                  Ver detalhes
                </Button>
              </>
            )}
            {estacaoSel && (
              <>
                <Text variant="titleMedium">{estacaoSel.nome}</Text>
                {estacaoSel.iqar && <EtiquetaIqar classe={estacaoSel.iqar.classe} indice={estacaoSel.iqar.indice} />}
                <Text variant="bodyMedium">
                  {estacaoSel.leitura?.temperatura != null ? `${estacaoSel.leitura.temperatura} °C · ` : ''}
                  {estacaoSel.inversao.ativa ? 'Inversão térmica ativa · ' : ''}
                  {estacaoSel.corrego ? `${estacaoSel.corrego.nome}: ${estacaoSel.corrego.nivelCm ?? '—'} cm` : ''}
                </Text>
                <Button mode="contained-tonal" onPress={() => router.push('/(abas)/ambiental')}>
                  Qualidade ambiental
                </Button>
              </>
            )}
          </Card.Content>
        </Card>
      )}

      <FAB icon="crosshairs-gps" size="small" style={[estilos.fabLocal, { backgroundColor: tema.colors.surface }]} onPress={irParaMinhaLocalizacao} accessibilityLabel="Ir para minha localização" testID="botao-minha-localizacao" />
      <FAB
        icon="plus"
        label="Registrar ocorrência"
        style={estilos.fab}
        onPress={() => router.push('/ocorrencia/nova')}
        accessibilityLabel="Registrar nova ocorrência"
        testID="botao-registrar"
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  topo: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 12, gap: 8 },
  barra: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, paddingLeft: 12, paddingVertical: 4 },
  aoVivo: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  pontoVivo: { width: 8, height: 8, borderRadius: 4 },
  chips: { gap: 6, paddingRight: 12 },
  chip: { borderRadius: 999 },
  legenda: { marginTop: 2 },
  linhaLegenda: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  selecao: { position: 'absolute', left: 12, right: 12 },
  fab: { position: 'absolute', right: 16, bottom: 20 },
  fabLocal: { position: 'absolute', right: 16, bottom: 90 },
});
