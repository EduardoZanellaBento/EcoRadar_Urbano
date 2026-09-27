import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, Menu, Searchbar, SegmentedButtons, Text, useTheme } from 'react-native-paper';
import { mensagemDeErro } from '@/api/cliente';
import { useListaOcorrencias } from '@/api/consultas';
import type { FiltrosOcorrencias } from '@/api/servicos';
import { CartaoOcorrencia } from '@/componentes/CartaoOcorrencia';
import { EsqueletoLista } from '@/componentes/Esqueleto';
import { EstadoVazio } from '@/componentes/EstadoVazio';
import { Icone } from '@/componentes/Icone';
import { contarPendentes, useFilaOffline } from '@/estado/filaOffline';
import { obterLocalizacao, type Posicao } from '@/servicos/localizacao';
import { CATEGORIA, STATUS as ROTULO_STATUS } from '@/tema/cores';
import type { TemaEcoRadar } from '@/tema/tema';
import { CATEGORIAS, STATUS, type Categoria, type StatusOcorrencia } from '@/tipos';

type Ordenacao = NonNullable<FiltrosOcorrencias['ordenacao']>;
const ROTULOS_ORDEM: Record<Ordenacao, string> = {
  recentes: 'Mais recentes',
  antigas: 'Mais antigas',
  severidade: 'Maior severidade',
  confirmacoes: 'Mais confirmadas',
  distancia: 'Mais próximas',
};

export default function ListaOcorrencias() {
  const tema = useTheme<TemaEcoRadar>();
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [status, setStatus] = useState<StatusOcorrencia[]>([]);
  const [pertoDeMim, setPertoDeMim] = useState(false);
  const [raio, setRaio] = useState('3');
  const [posicao, setPosicao] = useState<Posicao | null>(null);
  const [ordem, setOrdem] = useState<Ordenacao>('recentes');
  const [menuOrdem, setMenuOrdem] = useState(false);
  const pendentes = useFilaOffline((s) => contarPendentes(s.itens));

  useEffect(() => {
    const t = setTimeout(() => setBuscaAplicada(busca), 400);
    return () => clearTimeout(t);
  }, [busca]);

  useEffect(() => {
    if (pertoDeMim && !posicao) void obterLocalizacao().then(setPosicao);
  }, [pertoDeMim, posicao]);

  const filtros = useMemo<FiltrosOcorrencias>(() => {
    const perto = pertoDeMim && posicao;
    return {
      busca: buscaAplicada || undefined,
      categoria: categorias,
      status,
      ordenacao: ordem === 'distancia' && !perto ? 'recentes' : ordem,
      ...(perto ? { lat: posicao.latitude, lon: posicao.longitude, raioKm: Number(raio) } : {}),
    };
  }, [buscaAplicada, categorias, status, ordem, pertoDeMim, posicao, raio]);

  const consulta = useListaOcorrencias(filtros);
  const itens = consulta.data?.pages.flatMap((p) => p.itens) ?? [];
  const total = consulta.data?.pages[0]?.total ?? 0;

  const alternar = <T,>(lista: T[], valor: T) => (lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor]);

  const cabecalho = (
    <View style={{ gap: 8, paddingTop: 8 }}>
      <Searchbar
        placeholder="Buscar por descrição, bairro ou autor"
        value={busca}
        onChangeText={setBusca}
        style={estilos.busca}
        testID="campo-busca"
        accessibilityLabel="Buscar ocorrências"
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.chips}>
        <Chip icon="crosshairs-gps" selected={pertoDeMim} onPress={() => setPertoDeMim((v) => !v)} compact testID="filtro-perto">
          Perto de mim
        </Chip>
        {STATUS.map((s) => (
          <Chip key={s} icon={ROTULO_STATUS[s].icone} selected={status.includes(s)} onPress={() => setStatus((l) => alternar(l, s))} compact>
            {ROTULO_STATUS[s].rotulo}
          </Chip>
        ))}
      </ScrollView>
      {pertoDeMim && (
        <View style={{ paddingHorizontal: 16, gap: 4 }}>
          <Text variant="labelMedium">{posicao ? 'Raio de busca' : 'Obtendo sua localização…'}</Text>
          <SegmentedButtons
            value={raio}
            onValueChange={setRaio}
            density="small"
            buttons={['1', '3', '5', '10'].map((r) => ({ value: r, label: `${r} km` }))}
          />
        </View>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.chips}>
        {CATEGORIAS.map((c) => (
          <Chip key={c} icon={CATEGORIA[c].icone} selected={categorias.includes(c)} onPress={() => setCategorias((l) => alternar(l, c))} compact>
            {CATEGORIA[c].rotulo}
          </Chip>
        ))}
      </ScrollView>
      <View style={estilos.linhaResumo}>
        <Text variant="labelLarge" style={{ color: tema.extra.tintaSecundaria }} testID="total-ocorrencias">
          {consulta.isLoading ? 'Carregando…' : `${total} ${total === 1 ? 'ocorrência' : 'ocorrências'}`}
        </Text>
        <Menu
          visible={menuOrdem}
          onDismiss={() => setMenuOrdem(false)}
          anchor={
            <Button icon="sort" compact onPress={() => setMenuOrdem(true)} testID="botao-ordenar">
              {ROTULOS_ORDEM[ordem]}
            </Button>
          }
        >
          {(Object.keys(ROTULOS_ORDEM) as Ordenacao[]).map((o) => (
            <Menu.Item
              key={o}
              title={ROTULOS_ORDEM[o]}
              leadingIcon={ordem === o ? 'check' : undefined}
              disabled={o === 'distancia' && !(pertoDeMim && posicao)}
              onPress={() => {
                setOrdem(o);
                setMenuOrdem(false);
              }}
            />
          ))}
        </Menu>
      </View>
      {pendentes > 0 && (
        <Button icon="cloud-upload" mode="contained-tonal" style={{ marginHorizontal: 16 }} onPress={() => router.push('/envios')} testID="aviso-pendentes">
          {pendentes} {pendentes === 1 ? 'ocorrência aguardando envio' : 'ocorrências aguardando envio'}
        </Button>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1 }} testID="tela-lista">
      <FlatList
        data={itens}
        keyExtractor={(o) => o.id}
        renderItem={({ item }) => <CartaoOcorrencia ocorrencia={item} aoPressionar={() => router.push(`/ocorrencia/${item.id}`)} />}
        ListHeaderComponent={cabecalho}
        ListEmptyComponent={
          consulta.isLoading ? (
            <EsqueletoLista />
          ) : consulta.isError ? (
            <EstadoVazio ilustracao="erro" titulo="Não foi possível carregar" descricao={mensagemDeErro(consulta.error)} acao={{ rotulo: 'Tentar novamente', aoPressionar: () => void consulta.refetch() }} />
          ) : (
            <EstadoVazio titulo="Nenhuma ocorrência encontrada" descricao="Ajuste os filtros ou registre uma nova ocorrência." acao={{ rotulo: 'Registrar ocorrência', aoPressionar: () => router.push('/ocorrencia/nova') }} />
          )
        }
        ListFooterComponent={
          consulta.isFetchingNextPage ? (
            <Text style={estilos.rodape}>Carregando mais…</Text>
          ) : itens.length > 0 && !consulta.hasNextPage ? (
            <View style={[estilos.rodape, { flexDirection: 'row', justifyContent: 'center', gap: 6 }]}>
              <Icone nome="check-all" tamanho={16} cor={tema.extra.tintaFraca} />
              <Text style={{ color: tema.extra.tintaFraca }}>Fim da lista</Text>
            </View>
          ) : null
        }
        onEndReached={() => consulta.hasNextPage && !consulta.isFetchingNextPage && void consulta.fetchNextPage()}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={consulta.isRefetching && !consulta.isFetchingNextPage} onRefresh={() => void consulta.refetch()} colors={[tema.colors.primary]} />}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  busca: { marginHorizontal: 16 },
  chips: { gap: 6, paddingHorizontal: 16 },
  linhaResumo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16 },
  rodape: { textAlign: 'center', padding: 16 },
});
