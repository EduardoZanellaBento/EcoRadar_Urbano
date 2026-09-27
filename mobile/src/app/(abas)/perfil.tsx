import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Button, Card, Chip, Divider, List, SegmentedButtons, Snackbar, Text, useTheme } from 'react-native-paper';
import { Icone } from '@/componentes/Icone';
import { API_URL } from '@/config';
import { contarPendentes, useFilaOffline } from '@/estado/filaOffline';
import { usePreferencias, type PreferenciaTema } from '@/estado/preferencias';
import { temPerfil, useSessao } from '@/estado/sessao';
import { configurarNotificacoes, notificacaoDeTeste, notificacoesDisponiveis } from '@/servicos/notificacoes';
import type { TemaEcoRadar } from '@/tema/tema';
import { iniciais } from '@/utils/formatacao';

const ROTULO_PERFIL = { CIDADAO: 'Cidadão', AGENTE: 'Agente ambiental', ADMIN: 'Administrador' } as const;

export default function TelaPerfil() {
  const tema = useTheme<TemaEcoRadar>();
  const qc = useQueryClient();
  const usuario = useSessao((s) => s.usuario);
  const sair = useSessao((s) => s.sair);
  const { tema: preferenciaTema, definirTema, raioAlertasKm, definirRaio } = usePreferencias();
  const pendentes = useFilaOffline((s) => contarPendentes(s.itens));
  const [aviso, setAviso] = useState<string | null>(null);
  if (!usuario) return null;
  const ehAgente = temPerfil(usuario, 'AGENTE', 'ADMIN');

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }} testID="tela-perfil">
      <Card>
        <Card.Content style={estilos.cabecalho}>
          <Avatar.Text size={64} label={iniciais(usuario.nome)} style={{ backgroundColor: tema.colors.primary }} color={tema.colors.onPrimary} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="titleLarge" style={{ fontWeight: '700' }}>
              {usuario.nome}
            </Text>
            <Text variant="bodyMedium" style={{ color: tema.extra.tintaSecundaria }}>
              {usuario.email}
            </Text>
            <View style={estilos.linha}>
              <Chip icon={usuario.perfil === 'CIDADAO' ? 'account' : usuario.perfil === 'AGENTE' ? 'account-hard-hat' : 'shield-account'} compact testID="perfil-acesso">
                {ROTULO_PERFIL[usuario.perfil]}
              </Chip>
              {usuario.bairro && (
                <Chip icon="map-marker" compact>
                  {usuario.bairro}
                </Chip>
              )}
            </View>
          </View>
        </Card.Content>
      </Card>

      <Card>
        <Card.Title title="Preferências" left={(p) => <Icone nome="tune" tamanho={p.size} cor={tema.colors.primary} />} />
        <Card.Content style={{ gap: 14 }}>
          <View style={{ gap: 6 }}>
            <Text variant="labelLarge">Tema</Text>
            <SegmentedButtons
              value={preferenciaTema}
              onValueChange={(v) => definirTema(v as PreferenciaTema)}
              buttons={[
                { value: 'sistema', label: 'Sistema', icon: 'theme-light-dark', testID: 'tema-sistema' },
                { value: 'claro', label: 'Claro', icon: 'white-balance-sunny', testID: 'tema-claro' },
                { value: 'escuro', label: 'Escuro', icon: 'weather-night', testID: 'tema-escuro' },
              ]}
            />
          </View>
          <View style={{ gap: 6 }}>
            <Text variant="labelLarge">Raio para receber alertas</Text>
            <SegmentedButtons
              value={String(raioAlertasKm)}
              onValueChange={(v) => definirRaio(Number(v))}
              density="small"
              buttons={['2', '5', '10', '20'].map((r) => ({ value: r, label: `${r} km`, accessibilityLabel: `${r} quilômetros` }))}
            />
            <Text variant="labelSmall" style={{ color: tema.extra.tintaFraca }}>
              Você recebe banner e notificação de alertas a até {raioAlertasKm} km da sua última localização.
            </Text>
          </View>
          {notificacoesDisponiveis && (
            <Button
              mode="outlined"
              icon="bell-check"
              onPress={async () => {
                const ok = await configurarNotificacoes();
                if (ok) await notificacaoDeTeste();
                setAviso(ok ? 'Notificação de teste enviada.' : 'Permissão de notificação negada nas configurações do aparelho.');
              }}
            >
              Testar notificação
            </Button>
          )}
        </Card.Content>
      </Card>

      <Card>
        <List.Item title="Relatórios e estatísticas" left={(p) => <List.Icon {...p} icon="chart-bar" />} right={(p) => <List.Icon {...p} icon="chevron-right" />} onPress={() => router.push('/relatorios')} testID="link-relatorios" />
        <Divider />
        <List.Item title="Status do sistema" description="Microsserviços, réplicas e integrações" left={(p) => <List.Icon {...p} icon="server-network" />} right={(p) => <List.Icon {...p} icon="chevron-right" />} onPress={() => router.push('/status')} testID="link-status" />
        <Divider />
        <List.Item
          title="Envios pendentes"
          description={pendentes > 0 ? `${pendentes} aguardando conexão` : 'Nenhum pendente'}
          left={(p) => <List.Icon {...p} icon="cloud-sync" />}
          right={(p) => <List.Icon {...p} icon="chevron-right" />}
          onPress={() => router.push('/envios')}
          testID="link-envios"
        />
        {ehAgente && (
          <>
            <Divider />
            <List.Item
              title="Painel do agente"
              description={usuario.perfil === 'ADMIN' ? 'Fila de ocorrências e cenários do simulador' : 'Fila de ocorrências abertas'}
              left={(p) => <List.Icon {...p} icon="account-hard-hat" />}
              right={(p) => <List.Icon {...p} icon="chevron-right" />}
              onPress={() => router.push('/painel')}
              testID="link-painel"
            />
          </>
        )}
      </Card>

      <Card>
        <Card.Content style={{ gap: 4 }}>
          <Text variant="labelLarge">Sobre</Text>
          <Text variant="bodySmall" style={{ color: tema.extra.tintaSecundaria }}>
            EcoRadar Urbano {Constants.expoConfig?.version ?? '1.0.0'} · APS Ciência da Computação (UNIP 2026)
          </Text>
          <Text variant="bodySmall" style={{ color: tema.extra.tintaSecundaria }}>
            Servidor: {API_URL}
          </Text>
          <Text variant="bodySmall" style={{ color: tema.extra.tintaSecundaria }}>
            Dados de demonstração. Mananciais com polígonos aproximados, para fins didáticos.
          </Text>
        </Card.Content>
      </Card>

      <Button
        mode="contained-tonal"
        icon="logout"
        textColor={tema.colors.error}
        onPress={() => {
          qc.clear();
          sair();
          router.replace('/login');
        }}
        testID="botao-sair"
      >
        Sair
      </Button>
      <Snackbar visible={Boolean(aviso)} onDismiss={() => setAviso(null)} duration={3000}>
        {aviso}
      </Snackbar>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  cabecalho: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  linha: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 },
});
