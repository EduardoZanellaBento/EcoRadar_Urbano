import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { Platform, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaInsetsContext, SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BannerAlerta } from '@/componentes/BannerAlerta';
import { FaixaOffline } from '@/componentes/FaixaOffline';
import { LimiteErro } from '@/componentes/LimiteErro';
import { useConexao } from '@/estado/conexao';
import { contarPendentes, useFilaOffline } from '@/estado/filaOffline';
import { usePreferencias, usePreferenciasHidratadas } from '@/estado/preferencias';
import { useSessao, useSessaoHidratada } from '@/estado/sessao';
import { configurarNotificacoes } from '@/servicos/notificacoes';
import { useMonitorConexao, useTempoReal } from '@/servicos/tempoReal';
import { temaClaro, temaDeNavegacao, temaEscuro } from '@/tema/tema';

void SplashScreen.preventAutoHideAsync();

const DIA_MS = 24 * 60 * 60 * 1000;

const clienteConsultas = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: DIA_MS, // mantém os dados para uso offline (persistidos no AsyncStorage)
      staleTime: 15_000,
      retry: 1, // o Axios já faz até 3 tentativas com backoff em falhas de rede
      networkMode: 'offlineFirst',
      refetchOnWindowFocus: false,
    },
    mutations: { networkMode: 'always' },
  },
});

const persistidor = createAsyncStoragePersister({ storage: AsyncStorage, key: 'ecoradar.cache-consultas', throttleTime: 2000 });

/** Serviços globais que dependem dos provedores (conectividade, tempo real, notificações). */
function ServicosGlobais() {
  const token = useSessao((s) => s.token);
  useMonitorConexao();
  useTempoReal();
  useEffect(() => {
    if (token && Platform.OS !== 'web') void configurarNotificacoes();
  }, [token]);
  return null;
}

/** Quando a faixa offline está visível no topo, as telas não repetem o recuo da área segura. */
function AreaDasTelas({ children, fundo }: { children: ReactNode; fundo: string }) {
  const insets = useSafeAreaInsets();
  const online = useConexao((s) => s.online);
  const pendentes = useFilaOffline((s) => contarPendentes(s.itens));
  const faixaVisivel = online === false || pendentes > 0;
  return (
    <View style={{ flex: 1, backgroundColor: fundo }}>
      <FaixaOffline />
      <SafeAreaInsetsContext.Provider value={faixaVisivel ? { ...insets, top: 0 } : insets}>{children}</SafeAreaInsetsContext.Provider>
    </View>
  );
}

export default function LayoutRaiz() {
  const [fontesCarregadas] = useFonts(MaterialCommunityIcons.font);
  const sessaoPronta = useSessaoHidratada();
  const preferenciasProntas = usePreferenciasHidratadas();
  const preferenciaTema = usePreferencias((s) => s.tema);
  const esquemaSistema = useColorScheme();
  const escuro = preferenciaTema === 'escuro' || (preferenciaTema === 'sistema' && esquemaSistema === 'dark');
  const tema = escuro ? temaEscuro : temaClaro;
  const pronto = fontesCarregadas && sessaoPronta && preferenciasProntas;

  useEffect(() => {
    if (pronto) void SplashScreen.hideAsync();
  }, [pronto]);

  if (!pronto) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={clienteConsultas}
          persistOptions={{
            persister: persistidor,
            maxAge: DIA_MS,
            buster: 'ecoradar-v1',
            dehydrateOptions: { shouldDehydrateQuery: (q) => q.state.status === 'success' && q.queryKey[0] !== 'sistema' },
          }}
        >
          <PaperProvider theme={tema} settings={{ icon: (props) => <MaterialCommunityIcons {...props} name={props.name as never} /> }}>
            <ThemeProvider value={temaDeNavegacao(tema)}>
              <LimiteErro>
                <ServicosGlobais />
                <AreaDasTelas fundo={tema.extra.fundoPagina}>
                  <Stack
                    screenOptions={{
                      headerStyle: { backgroundColor: tema.colors.surface },
                      headerTintColor: tema.colors.onSurface,
                      headerTitleStyle: { fontWeight: '700' },
                      contentStyle: { backgroundColor: tema.extra.fundoPagina },
                      headerBackButtonDisplayMode: 'minimal',
                    }}
                  >
                    <Stack.Screen name="index" options={{ headerShown: false }} />
                    <Stack.Screen name="onboarding" options={{ headerShown: false }} />
                    <Stack.Screen name="login" options={{ headerShown: false }} />
                    <Stack.Screen name="cadastro" options={{ title: 'Criar conta' }} />
                    <Stack.Screen name="(abas)" options={{ headerShown: false }} />
                    <Stack.Screen name="ocorrencia/nova" options={{ title: 'Registrar ocorrência', presentation: 'modal' }} />
                    <Stack.Screen name="ocorrencia/[id]" options={{ title: 'Detalhe da ocorrência' }} />
                    <Stack.Screen name="relatorios" options={{ title: 'Relatórios' }} />
                    <Stack.Screen name="status" options={{ title: 'Status do sistema' }} />
                    <Stack.Screen name="painel" options={{ title: 'Painel do agente' }} />
                    <Stack.Screen name="envios" options={{ title: 'Envios pendentes' }} />
                  </Stack>
                </AreaDasTelas>
                <BannerAlerta />
                <StatusBar style={escuro ? 'light' : 'dark'} />
              </LimiteErro>
            </ThemeProvider>
          </PaperProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
