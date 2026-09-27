import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Card, SegmentedButtons, Snackbar, Switch, Text, useTheme } from 'react-native-paper';
import { mensagemDeErro } from '@/api/cliente';
import { useListaOcorrencias } from '@/api/consultas';
import { ambiental, simulador, type TipoCenario } from '@/api/servicos';
import { DialogoStatus } from '@/componentes/DialogoStatus';
import { EsqueletoLista } from '@/componentes/Esqueleto';
import { EstadoVazio } from '@/componentes/EstadoVazio';
import { EtiquetaSeveridade, EtiquetaStatus } from '@/componentes/Etiquetas';
import { Icone } from '@/componentes/Icone';
import { temPerfil, useSessao } from '@/estado/sessao';
import { CATEGORIA, SEVERIDADE } from '@/tema/cores';
import type { TemaEcoRadar } from '@/tema/tema';
import type { Ocorrencia, StatusOcorrencia } from '@/tipos';
import { hora, tempoRelativo } from '@/utils/formatacao';

const CENARIOS: { tipo: TipoCenario; rotulo: string; icone: string; estacaoId?: string }[] = [
  { tipo: 'ALAGAMENTO', rotulo: 'Alagamento (Ipiranga)', icone: 'home-flood', estacaoId: 'est-ipiranga' },
  { tipo: 'POLUICAO_CRITICA', rotulo: 'Poluição crítica (Pinheiros)', icone: 'smog', estacaoId: 'est-pinheiros' },
  { tipo: 'INVERSAO_TERMICA', rotulo: 'Inversão térmica (Sé)', icone: 'thermometer-lines', estacaoId: 'est-se' },
  { tipo: 'NORMAL', rotulo: 'Normalizar leituras', icone: 'restore' },
];

function PainelAdmin({ avisar }: { avisar: (m: string) => void }) {
  const tema = useTheme<TemaEcoRadar>();
  const qc = useQueryClient();
  const [duracao, setDuracao] = useState('120');
  const [executando, setExecutando] = useState<TipoCenario | null>(null);
  const estado = useQuery({ queryKey: ['sistema', 'simulador'], queryFn: simulador.estado, refetchInterval: 5000 });
  const integracoes = useQuery({ queryKey: ['sistema', 'integracoes'], queryFn: ambiental.statusIntegracoes, refetchInterval: 10_000 });
  const falhaAtiva = integracoes.data?.openMeteo.simulandoFalha ?? false;

  return (
    <Card style={estilos.cartao} testID="painel-admin">
      <Card.Title title="Administração · Simulador de cenários" subtitle="Força leituras que disparam alertas (demonstração)" left={(p) => <Icone nome="shield-account" tamanho={p.size} cor={tema.colors.primary} />} />
      <Card.Content style={{ gap: 10 }}>
        <Text variant="bodySmall" style={{ color: tema.extra.tintaSecundaria }} testID="estado-simulador">
          {estado.data?.cenarioAtivo ? `Cenário ativo: ${estado.data.cenarioAtivo.tipo} até ${hora(estado.data.cenarioAtivo.fim)}` : 'Nenhum cenário ativo — leituras normais.'}
        </Text>
        <SegmentedButtons value={duracao} onValueChange={setDuracao} density="small" buttons={['60', '120', '300'].map((d) => ({ value: d, label: `${d} s` }))} />
        {CENARIOS.map((c) => (
          <Button
            key={c.tipo}
            mode={c.tipo === 'NORMAL' ? 'outlined' : 'contained-tonal'}
            icon={c.icone}
            loading={executando === c.tipo}
            disabled={Boolean(executando)}
            onPress={async () => {
              setExecutando(c.tipo);
              try {
                const r = await simulador.cenario(c.tipo, c.estacaoId, Number(duracao));
                avisar(r.mensagem);
                void estado.refetch();
                void qc.invalidateQueries({ queryKey: ['ambiental'] });
              } catch (e) {
                avisar(mensagemDeErro(e));
              } finally {
                setExecutando(null);
              }
            }}
            testID={`cenario-${c.tipo}`}
          >
            {c.rotulo}
          </Button>
        ))}
        <View style={estilos.linha}>
          <Icone nome="lan-disconnect" cor={falhaAtiva ? '#d03b3b' : tema.extra.tintaFraca} />
          <Text variant="bodyMedium" style={{ flex: 1 }}>
            Simular falha da Open-Meteo (circuit breaker)
          </Text>
          <Switch
            value={falhaAtiva}
            onValueChange={async (v) => {
              try {
                await ambiental.simularFalha(v);
                if (v) for (let i = 0; i < 4; i++) await ambiental.resumo(true).catch(() => undefined);
                void integracoes.refetch();
                void qc.invalidateQueries({ queryKey: ['ambiental'] });
                avisar(v ? 'Falha simulada ativada: o circuito abre e o app passa a mostrar dados em cache.' : 'Falha simulada desativada.');
              } catch (e) {
                avisar(mensagemDeErro(e));
              }
            }}
            testID="alternar-falha-open-meteo"
          />
        </View>
      </Card.Content>
    </Card>
  );
}

export default function PainelAgente() {
  const tema = useTheme<TemaEcoRadar>();
  const usuario = useSessao((s) => s.usuario);
  const fila = useListaOcorrencias({ status: ['ABERTA', 'EM_ANALISE'], ordenacao: 'severidade' });
  const [acao, setAcao] = useState<{ o: Ocorrencia; status: StatusOcorrencia } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const itens = fila.data?.pages.flatMap((p) => p.itens) ?? [];

  if (!temPerfil(usuario, 'AGENTE', 'ADMIN')) {
    return <EstadoVazio ilustracao="erro" titulo="Acesso restrito" descricao="O painel é exclusivo para agentes ambientais e administradores." />;
  }

  return (
    <View style={{ flex: 1 }} testID="tela-painel">
      <FlatList
        data={itens}
        keyExtractor={(o) => o.id}
        ListHeaderComponent={
          <View style={{ gap: 4 }}>
            {usuario?.perfil === 'ADMIN' && <PainelAdmin avisar={setAviso} />}
            <Text variant="titleMedium" style={{ marginHorizontal: 16, marginTop: 8 }}>
              Fila de atendimento ({fila.data?.pages[0]?.total ?? 0})
            </Text>
            <Text variant="labelSmall" style={{ marginHorizontal: 16, color: tema.extra.tintaFraca }}>
              Ocorrências abertas e em análise, da maior para a menor severidade.
            </Text>
          </View>
        }
        renderItem={({ item: o }) => (
          <Card style={estilos.cartao} testID={`fila-${o.id}`}>
            <Card.Content style={{ gap: 6 }}>
              <View style={estilos.linha}>
                <Icone nome={CATEGORIA[o.categoria].icone} cor={SEVERIDADE[o.severidade].cor} />
                <Text variant="titleMedium" style={{ flex: 1 }} onPress={() => router.push(`/ocorrencia/${o.id}`)}>
                  {CATEGORIA[o.categoria].rotulo}
                </Text>
                <Text variant="labelSmall">{tempoRelativo(o.criadoEm)}</Text>
              </View>
              <Text variant="bodyMedium" numberOfLines={2}>
                {o.descricao}
              </Text>
              <View style={estilos.linha}>
                <EtiquetaSeveridade severidade={o.severidade} compacta />
                <EtiquetaStatus status={o.status} />
                <Text variant="labelMedium">{o.bairro}</Text>
                {o.confirmacoes > 0 && <Text variant="labelMedium">· {o.confirmacoes} confirmações</Text>}
              </View>
              <View style={estilos.acoes}>
                {o.status === 'ABERTA' && (
                  <Button compact mode="contained-tonal" icon="magnify" onPress={() => setAcao({ o, status: 'EM_ANALISE' })} testID={`analisar-${o.id}`}>
                    Analisar
                  </Button>
                )}
                <Button compact mode="contained" icon="check" onPress={() => setAcao({ o, status: 'RESOLVIDA' })} testID={`resolver-${o.id}`}>
                  Resolver
                </Button>
                <Button compact mode="outlined" icon="close" onPress={() => setAcao({ o, status: 'DESCARTADA' })}>
                  Descartar
                </Button>
              </View>
            </Card.Content>
          </Card>
        )}
        ListEmptyComponent={fila.isLoading ? <EsqueletoLista quantidade={3} /> : <EstadoVazio ilustracao="alertas" titulo="Fila vazia" descricao="Nenhuma ocorrência aguardando atendimento." />}
        onEndReached={() => fila.hasNextPage && void fila.fetchNextPage()}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
      {acao && (
        <DialogoStatus
          visivel
          ocorrenciaId={acao.o.id}
          statusAtual={acao.o.status}
          statusInicial={acao.status}
          aoFechar={() => setAcao(null)}
          aoConcluir={() => setAviso('Status atualizado. O histórico e os relatórios foram atualizados.')}
        />
      )}
      <Snackbar visible={Boolean(aviso)} onDismiss={() => setAviso(null)} duration={4000} testID="aviso-painel">
        {aviso}
      </Snackbar>
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: { marginHorizontal: 16, marginVertical: 6 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  acoes: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
});
