import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Divider, Text, useTheme } from 'react-native-paper';
import { alertas, ambiental, ocorrencias, verificarSaude, type ResultadoSaude } from '@/api/servicos';
import { Icone } from '@/componentes/Icone';
import { API_URL } from '@/config';
import { useConexao } from '@/estado/conexao';
import { SERIES } from '@/tema/cores';
import type { TemaEcoRadar } from '@/tema/tema';
import { hora, tempoRelativo } from '@/utils/formatacao';

const SERVICOS = [
  { nome: 'API Gateway (Nginx)', caminho: '/health', icone: 'router-network' },
  { nome: 'auth-service', caminho: '/api/auth/ready', icone: 'shield-account' },
  { nome: 'ocorrencias-service', caminho: '/api/ocorrencias/ready', icone: 'map-marker-multiple' },
  { nome: 'ambiental-service', caminho: '/api/ambiental/ready', icone: 'leaf' },
  { nome: 'alertas-service', caminho: '/api/alertas/ready', icone: 'bell-ring' },
  { nome: 'relatorios-service', caminho: '/api/relatorios/ready', icone: 'chart-bar' },
  { nome: 'sensor-simulator', caminho: '/api/simulador/ready', icone: 'access-point' },
];

function LinhaServico({ nome, icone, r }: { nome: string; icone: string; r: ResultadoSaude | undefined }) {
  const tema = useTheme<TemaEcoRadar>();
  const ok = r?.ok;
  const cor = r === undefined ? tema.extra.tintaFraca : ok ? '#0ca30c' : '#d03b3b';
  return (
    <View style={estilos.servico} testID={`servico-${nome}`}>
      <Icone nome={icone} cor={tema.colors.primary} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="titleSmall">{nome}</Text>
        <Text variant="labelSmall" style={{ color: tema.extra.tintaFraca }}>
          {r ? `${r.latenciaMs} ms · instância ${r.instancia ?? '—'}` : 'verificando…'}
        </Text>
        {r?.verificacoes && (
          <View style={estilos.linhaChips}>
            {Object.entries(r.verificacoes).map(([k, v]) => (
              <Text key={k} variant="labelSmall" style={{ color: v === 'ok' ? '#0a7a0a' : '#b3261e', fontWeight: '700' }}>
                {v === 'ok' ? '✓' : '✗'} {k}
              </Text>
            ))}
          </View>
        )}
      </View>
      <View style={[estilos.selo, { borderColor: cor }]} accessibilityLabel={`${nome}: ${ok ? 'online' : 'com problema'}`}>
        <Icone nome={ok ? 'check-circle' : r === undefined ? 'timer-sand' : 'alert-circle'} tamanho={14} cor={cor} />
        <Text style={{ color: cor, fontWeight: '800', fontSize: 12 }}>{r === undefined ? '…' : ok ? 'ONLINE' : 'FALHA'}</Text>
      </View>
    </View>
  );
}

export default function StatusSistema() {
  const tema = useTheme<TemaEcoRadar>();
  const socket = useConexao((s) => s.socket);
  const online = useConexao((s) => s.online);
  const [distribuicao, setDistribuicao] = useState<Record<string, number> | null>(null);
  const [testando, setTestando] = useState(false);
  const cor = tema.extra.escuro ? SERIES.escuro[0] : SERIES.claro[0];

  const saude = useQuery({
    queryKey: ['sistema', 'saude'],
    queryFn: async () => Object.fromEntries(await Promise.all(SERVICOS.map(async (s) => [s.nome, await verificarSaude(s.caminho)] as const))),
    refetchInterval: 10_000,
  });
  const integracoes = useQuery({ queryKey: ['sistema', 'integracoes'], queryFn: ambiental.statusIntegracoes, refetchInterval: 10_000 });
  const outbox = useQuery({ queryKey: ['sistema', 'outbox'], queryFn: ocorrencias.outbox, refetchInterval: 10_000 });
  const conexoes = useQuery({ queryKey: ['sistema', 'conexoes'], queryFn: alertas.conexoes, refetchInterval: 10_000 });

  const testarBalanceamento = async () => {
    setTestando(true);
    const contagem: Record<string, number> = {};
    for (let i = 0; i < 10; i++) {
      const r = await verificarSaude('/api/ocorrencias/health');
      const chave = r.instancia ?? 'sem resposta';
      contagem[chave] = (contagem[chave] ?? 0) + 1;
    }
    setDistribuicao(contagem);
    setTestando(false);
  };

  const todosOk = saude.data && Object.values(saude.data).every((r) => r.ok);
  const om = integracoes.data?.openMeteo;
  const corCircuito = om?.estadoCircuito === 'FECHADO' ? '#0ca30c' : om?.estadoCircuito === 'MEIO_ABERTO' ? '#c98500' : '#d03b3b';

  return (
    <ScrollView
      contentContainerStyle={estilos.pagina}
      refreshControl={<RefreshControl refreshing={saude.isRefetching} onRefresh={() => void Promise.all([saude.refetch(), integracoes.refetch(), outbox.refetch(), conexoes.refetch()])} />}
      testID="tela-status"
    >
      <Card>
        <Card.Content style={estilos.resumo}>
          <Icone nome={todosOk ? 'check-decagram' : 'alert-decagram'} tamanho={36} cor={todosOk ? '#0ca30c' : '#c98500'} />
          <View style={{ flex: 1 }}>
            <Text variant="titleMedium" testID="resumo-status">
              {saude.isLoading ? 'Verificando serviços…' : todosOk ? 'Todos os serviços online' : 'Há serviços com problema'}
            </Text>
            <Text variant="labelSmall" style={{ color: tema.extra.tintaFraca }}>
              Gateway: {API_URL} · atualizado {saude.dataUpdatedAt ? hora(new Date(saude.dataUpdatedAt)) : '—'} · rede {online === false ? 'offline' : 'online'}
            </Text>
          </View>
        </Card.Content>
      </Card>

      <Card>
        <Card.Title title="Microsserviços" subtitle="Saúde (/ready), latência e réplica que respondeu (X-Instance-Id)" />
        <Card.Content>
          {SERVICOS.map((s, i) => (
            <View key={s.nome}>
              {i > 0 && <Divider />}
              <LinhaServico nome={s.nome} icone={s.icone} r={saude.data?.[s.nome]} />
            </View>
          ))}
        </Card.Content>
      </Card>

      <Card testID="cartao-balanceamento">
        <Card.Title title="Balanceamento de carga" subtitle="ocorrencias-service: 2 réplicas atrás do Nginx (round-robin)" />
        <Card.Content style={{ gap: 10 }}>
          <Button mode="contained-tonal" icon="scale-balance" onPress={testarBalanceamento} loading={testando} disabled={testando} testID="botao-testar-balanceamento">
            Testar com 10 requisições
          </Button>
          {distribuicao &&
            Object.entries(distribuicao).map(([instancia, n]) => (
              <View key={instancia} style={estilos.linha}>
                <Text variant="labelLarge" style={{ width: 110 }}>
                  {instancia}
                </Text>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ height: 14, width: `${n * 10}%`, backgroundColor: cor, borderTopRightRadius: 4, borderBottomRightRadius: 4 }} />
                  <Text variant="labelLarge">{n}</Text>
                </View>
              </View>
            ))}
        </Card.Content>
      </Card>

      <Card testID="cartao-integracoes">
        <Card.Title title="Integração Open-Meteo" subtitle="Circuit breaker (opossum) + cache de 10 min" />
        <Card.Content style={{ gap: 8 }}>
          <View style={estilos.linha}>
            <Text variant="bodyMedium" style={{ flex: 1 }}>
              Estado do circuito
            </Text>
            <Chip style={{ backgroundColor: 'transparent', borderColor: corCircuito, borderWidth: 1.5 }} textStyle={{ color: corCircuito, fontWeight: '800' }} testID="estado-circuito">
              {om?.estadoCircuito ?? '—'}
            </Chip>
          </View>
          {om && (
            <>
              <Text variant="bodySmall" style={{ color: tema.extra.tintaSecundaria }}>
                Chamadas {om.estatisticas.chamadas} · sucesso {om.estatisticas.sucessos} · falhas {om.estatisticas.falhas} · rejeitadas (circuito aberto) {om.estatisticas.rejeitadasCircuitoAberto}
              </Text>
              <Text variant="bodySmall" style={{ color: tema.extra.tintaSecundaria }}>
                Último sucesso: {om.ultimoSucessoEm ? tempoRelativo(om.ultimoSucessoEm) : 'nunca'}
                {om.simulandoFalha ? ' · FALHA SIMULADA ATIVA' : ''}
              </Text>
              {om.ultimoErro && (
                <Text variant="bodySmall" style={{ color: tema.colors.error }}>
                  {om.ultimoErro.mensagem}
                </Text>
              )}
            </>
          )}
        </Card.Content>
      </Card>

      <Card>
        <Card.Title title="Mensageria e tempo real" subtitle="RabbitMQ (AMQP/MQTT), outbox e Socket.IO" />
        <Card.Content style={{ gap: 6 }}>
          <LinhaInfo rotulo="WebSocket (Socket.IO)" valor={socket.conectado ? `conectado · ${socket.transporte ?? 'websocket'} · ${socket.instancia ?? ''}` : 'desconectado'} ok={socket.conectado} testID="estado-websocket" />
          <LinhaInfo rotulo="Clientes conectados" valor={String(conexoes.data?.clientesConectados ?? '—')} ok />
          <LinhaInfo rotulo="MQTT (sensores → ambiental)" valor={integracoes.data ? `${integracoes.data.mqtt.conectado ? 'conectado' : 'desconectado'} · ${integracoes.data.mqtt.mensagensRecebidas} leituras` : '—'} ok={integracoes.data?.mqtt.conectado} />
          <LinhaInfo rotulo="AMQP (eventos)" valor={integracoes.data ? (integracoes.data.amqp.conectado ? 'conectado' : 'desconectado') : '—'} ok={integracoes.data?.amqp.conectado} />
          <LinhaInfo rotulo="Outbox (ocorrências)" valor={outbox.data ? `${outbox.data.pendentes} pendentes · ${outbox.data.publicados} publicados` : '—'} ok={outbox.data ? outbox.data.pendentes === 0 : undefined} testID="estado-outbox" />
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

function LinhaInfo({ rotulo, valor, ok, testID }: { rotulo: string; valor: string; ok?: boolean; testID?: string }) {
  const tema = useTheme<TemaEcoRadar>();
  return (
    <View style={estilos.linha} testID={testID}>
      <Icone nome={ok === undefined ? 'help-circle-outline' : ok ? 'check-circle' : 'alert-circle'} tamanho={18} cor={ok === undefined ? tema.extra.tintaFraca : ok ? '#0ca30c' : '#d03b3b'} />
      <Text variant="bodyMedium" style={{ flex: 1 }}>
        {rotulo}
      </Text>
      <Text variant="labelMedium" style={{ color: tema.extra.tintaSecundaria, maxWidth: '55%', textAlign: 'right' }}>
        {valor}
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  pagina: { padding: 16, gap: 12, paddingBottom: 40, maxWidth: 820, width: '100%', alignSelf: 'center' },
  resumo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  servico: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  selo: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  linhaChips: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
});
