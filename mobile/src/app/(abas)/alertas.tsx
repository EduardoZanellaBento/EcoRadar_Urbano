import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Button, Card, Dialog, Portal, SegmentedButtons, Text, TextInput, useTheme } from 'react-native-paper';
import { mensagemDeErro } from '@/api/cliente';
import { useAlertas, useEncerrarAlerta } from '@/api/consultas';
import { EsqueletoLista } from '@/componentes/Esqueleto';
import { EstadoVazio } from '@/componentes/EstadoVazio';
import { EtiquetaSeveridade } from '@/componentes/Etiquetas';
import { Icone } from '@/componentes/Icone';
import { useAlertasTempoReal } from '@/estado/conexao';
import { usePreferencias } from '@/estado/preferencias';
import { temPerfil, useSessao } from '@/estado/sessao';
import { SEVERIDADE, TIPO_ALERTA } from '@/tema/cores';
import type { TemaEcoRadar } from '@/tema/tema';
import type { Alerta } from '@/tipos';
import { dataHora, distancia, tempoRelativo } from '@/utils/formatacao';
import { distanciaKm } from '@/utils/geo';

function CartaoAlerta({ a, podeEncerrar, aoEncerrar }: { a: Alerta; podeEncerrar: boolean; aoEncerrar: () => void }) {
  const tema = useTheme<TemaEcoRadar>();
  const loc = usePreferencias((s) => s.ultimaLocalizacao);
  const sev = SEVERIDADE[a.severidade];
  const km = loc && a.latitude !== null && a.longitude !== null ? distanciaKm(loc, { latitude: a.latitude, longitude: a.longitude }) : null;
  return (
    <Card style={[estilos.cartao, { borderLeftColor: sev.cor }]} testID={`alerta-${a.id}`}>
      <Card.Content style={{ gap: 6 }}>
        <View style={estilos.linha}>
          <View style={[estilos.icone, { backgroundColor: sev.cor }]}>
            <Icone nome={TIPO_ALERTA[a.tipo].icone} cor={sev.corTexto} tamanho={20} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="labelSmall" style={{ color: tema.extra.tintaFraca }}>
              {TIPO_ALERTA[a.tipo].rotulo.toUpperCase()} · {tempoRelativo(a.criadoEm)}
              {km !== null ? ` · a ${distancia(km)}` : ''}
            </Text>
            <Text variant="titleMedium">{a.titulo}</Text>
          </View>
        </View>
        <Text variant="bodyMedium" style={{ color: tema.extra.tintaSecundaria }}>
          {a.mensagem}
        </Text>
        <View style={estilos.linha}>
          <EtiquetaSeveridade severidade={a.severidade} compacta />
          <Text variant="labelMedium" style={{ color: a.status === 'ATIVO' ? '#b3261e' : tema.extra.tintaFraca, fontWeight: '700' }}>
            {a.status === 'ATIVO' ? '● Ativo' : `Encerrado ${a.encerradoEm ? dataHora(a.encerradoEm) : ''}`}
          </Text>
        </View>
        {a.comentarioEncerramento && (
          <Text variant="bodySmall" style={{ color: tema.extra.tintaFraca }}>
            {a.encerradoPor}: {a.comentarioEncerramento}
          </Text>
        )}
        {podeEncerrar && a.status === 'ATIVO' && (
          <Button mode="outlined" icon="check" onPress={aoEncerrar} compact style={{ alignSelf: 'flex-start' }}>
            Encerrar alerta
          </Button>
        )}
      </Card.Content>
    </Card>
  );
}

export default function TelaAlertas() {
  const [aba, setAba] = useState<'ATIVO' | 'ENCERRADO'>('ATIVO');
  const consulta = useAlertas(aba);
  const usuario = useSessao((s) => s.usuario);
  const marcarLidos = useAlertasTempoReal((s) => s.marcarLidos);
  const encerrar = useEncerrarAlerta();
  const [alvo, setAlvo] = useState<Alerta | null>(null);
  const [comentario, setComentario] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const podeEncerrar = temPerfil(usuario, 'AGENTE', 'ADMIN');

  useFocusEffect(
    useCallback(() => {
      marcarLidos();
    }, [marcarLidos]),
  );

  return (
    <View style={{ flex: 1 }} testID="tela-alertas">
      <FlatList
        data={consulta.data?.itens ?? []}
        keyExtractor={(a) => a.id}
        ListHeaderComponent={
          <View style={{ padding: 16, paddingBottom: 8 }}>
            <SegmentedButtons
              value={aba}
              onValueChange={(v) => setAba(v as typeof aba)}
              buttons={[
                { value: 'ATIVO', label: 'Ativos', icon: 'bell-ring' },
                { value: 'ENCERRADO', label: 'Histórico', icon: 'history' },
              ]}
            />
          </View>
        }
        renderItem={({ item }) => (
          <CartaoAlerta
            a={item}
            podeEncerrar={podeEncerrar}
            aoEncerrar={() => {
              setAlvo(item);
              setComentario('Situação verificada e controlada.');
              setErro(null);
            }}
          />
        )}
        ListEmptyComponent={
          consulta.isLoading ? (
            <EsqueletoLista quantidade={3} />
          ) : consulta.isError ? (
            <EstadoVazio ilustracao="erro" titulo="Não foi possível carregar os alertas" descricao={mensagemDeErro(consulta.error)} acao={{ rotulo: 'Tentar novamente', aoPressionar: () => void consulta.refetch() }} />
          ) : (
            <EstadoVazio ilustracao="alertas" titulo={aba === 'ATIVO' ? 'Nenhum alerta ativo' : 'Sem histórico'} descricao={aba === 'ATIVO' ? 'Tudo tranquilo por enquanto. Você será avisado quando algo acontecer.' : undefined} />
          )
        }
        refreshControl={<RefreshControl refreshing={consulta.isRefetching} onRefresh={() => void consulta.refetch()} />}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
      <Portal>
        <Dialog visible={Boolean(alvo)} onDismiss={() => setAlvo(null)}>
          <Dialog.Title>Encerrar alerta</Dialog.Title>
          <Dialog.Content style={{ gap: 8 }}>
            <Text>{alvo?.titulo}</Text>
            <TextInput mode="outlined" label="Comentário" value={comentario} onChangeText={setComentario} multiline />
            {erro && <Text style={{ color: '#b3261e' }}>{erro}</Text>}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setAlvo(null)}>Cancelar</Button>
            <Button
              mode="contained"
              loading={encerrar.isPending}
              onPress={async () => {
                try {
                  await encerrar.mutateAsync({ id: alvo!.id, comentario });
                  setAlvo(null);
                } catch (e) {
                  setErro(mensagemDeErro(e));
                }
              }}
            >
              Encerrar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: { marginHorizontal: 16, marginVertical: 6, borderLeftWidth: 5 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  icone: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
