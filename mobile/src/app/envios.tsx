import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Banner, Button, Card, IconButton, Text, useTheme } from 'react-native-paper';
import { EstadoVazio } from '@/componentes/EstadoVazio';
import { Icone } from '@/componentes/Icone';
import { useConexao } from '@/estado/conexao';
import { contarPendentes, useFilaOffline, type StatusEnvio } from '@/estado/filaOffline';
import { sincronizarFila } from '@/servicos/sincronizacao';
import { CATEGORIA } from '@/tema/cores';
import type { TemaEcoRadar } from '@/tema/tema';
import { dataHora, tempoRelativo } from '@/utils/formatacao';

const SITUACAO: Record<StatusEnvio, { rotulo: string; icone: string; cor: string }> = {
  pendente: { rotulo: 'Pendente', icone: 'clock-outline', cor: '#c98500' },
  enviando: { rotulo: 'Enviando…', icone: 'cloud-upload', cor: '#2a78d6' },
  sincronizado: { rotulo: 'Sincronizado', icone: 'check-circle', cor: '#0ca30c' },
  erro: { rotulo: 'Erro', icone: 'alert-circle', cor: '#d03b3b' },
};

export default function Envios() {
  const tema = useTheme<TemaEcoRadar>();
  const qc = useQueryClient();
  const { nova } = useLocalSearchParams<{ nova?: string }>();
  const itens = useFilaOffline((s) => s.itens);
  const remover = useFilaOffline((s) => s.remover);
  const limpar = useFilaOffline((s) => s.limparSincronizados);
  const online = useConexao((s) => s.online) !== false;
  const [sincronizando, setSincronizando] = useState(false);
  const pendentes = contarPendentes(itens);

  return (
    <View style={{ flex: 1 }} testID="tela-envios">
      {nova && (
        <Banner visible icon="content-save-check" style={{ margin: 12, borderRadius: 12 }}>
          Ocorrência salva no aparelho. Ela será enviada automaticamente quando a conexão voltar — sem duplicar (chave de idempotência).
        </Banner>
      )}
      <FlatList
        data={itens}
        keyExtractor={(i) => i.idempotencyKey}
        ListHeaderComponent={
          <View style={estilos.cabecalho}>
            <Text variant="bodyMedium" style={{ color: tema.extra.tintaSecundaria }} testID="resumo-envios">
              {pendentes > 0 ? `${pendentes} ${pendentes === 1 ? 'envio pendente' : 'envios pendentes'}` : 'Nenhum envio pendente'} · {online ? 'online' : 'offline'}
            </Text>
            <View style={estilos.linha}>
              <Button
                mode="contained"
                icon="sync"
                disabled={!online || pendentes === 0 || sincronizando}
                loading={sincronizando}
                onPress={async () => {
                  setSincronizando(true);
                  await sincronizarFila(qc);
                  setSincronizando(false);
                }}
                testID="botao-sincronizar"
              >
                Sincronizar agora
              </Button>
              <Button mode="text" onPress={limpar} disabled={!itens.some((i) => i.status === 'sincronizado')}>
                Limpar sincronizados
              </Button>
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const s = SITUACAO[item.status];
          return (
            <Card style={estilos.cartao} testID={`envio-${item.status}`}>
              <Card.Content style={{ gap: 6 }}>
                <View style={estilos.linha}>
                  <Icone nome={CATEGORIA[item.dados.categoria].icone} />
                  <Text variant="titleMedium" style={{ flex: 1 }}>
                    {CATEGORIA[item.dados.categoria].rotulo}
                  </Text>
                  <View style={[estilos.situacao, { borderColor: s.cor }]} accessibilityLabel={`Situação: ${s.rotulo}`}>
                    <Icone nome={s.icone} tamanho={14} cor={s.cor} />
                    <Text style={{ color: s.cor, fontWeight: '700', fontSize: 12 }}>{s.rotulo}</Text>
                  </View>
                </View>
                <Text variant="bodyMedium" numberOfLines={2}>
                  {item.dados.descricao}
                </Text>
                <Text variant="labelSmall" style={{ color: tema.extra.tintaFraca }}>
                  Criada {tempoRelativo(item.criadoEm)} · {item.foto ? 'com foto' : 'sem foto'} · tentativas: {item.tentativas}
                  {item.sincronizadoEm ? ` · enviada em ${dataHora(item.sincronizadoEm)}` : ''}
                </Text>
                <Text variant="labelSmall" style={{ color: tema.extra.tintaFraca }} selectable>
                  Chave de idempotência: {item.idempotencyKey}
                </Text>
                {item.erro && item.status !== 'sincronizado' && (
                  <Text variant="bodySmall" style={{ color: tema.colors.error }}>
                    {item.erro}
                  </Text>
                )}
                <View style={estilos.linha}>
                  {item.ocorrenciaId && (
                    <Button compact icon="open-in-new" onPress={() => router.push(`/ocorrencia/${item.ocorrenciaId}`)}>
                      Ver ocorrência
                    </Button>
                  )}
                  {item.status === 'erro' && (
                    <IconButton icon="delete" onPress={() => remover(item.idempotencyKey)} accessibilityLabel="Descartar envio com erro" />
                  )}
                </View>
              </Card.Content>
            </Card>
          );
        }}
        ListEmptyComponent={<EstadoVazio ilustracao="offline" titulo="Nada na fila" descricao="Ocorrências registradas sem internet aparecem aqui até serem enviadas." />}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  cabecalho: { padding: 16, gap: 8 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cartao: { marginHorizontal: 16, marginVertical: 6 },
  situacao: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
});
