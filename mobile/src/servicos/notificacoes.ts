import { isRunningInExpoGo } from 'expo';
import type * as ModuloNotificacoes from 'expo-notifications';
import { Platform } from 'react-native';
import { SEVERIDADE } from '@/tema/cores';
import type { Alerta } from '@/tipos';

/**
 * No Expo Go para Android (SDK 53+) o simples import de expo-notifications lança erro, porque o pacote
 * registra um listener de push token ao carregar. Nesse caso o módulo nem é carregado e os alertas
 * ficam só no banner in-app; em development build e no Expo Go do iOS tudo funciona normalmente.
 */
const Notifications: typeof ModuloNotificacoes | null =
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- import condicional é o objetivo aqui
  Platform.OS === 'android' && isRunningInExpoGo() ? null : require('expo-notifications');

let configurado = false;

/** Notificações LOCAIS (push remoto exige development build). */
export async function configurarNotificacoes(): Promise<boolean> {
  if (!Notifications) return false;
  if (!configurado) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('alertas', {
        name: 'Alertas ambientais',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0f766e',
      });
    }
    configurado = true;
  }
  const atual = await Notifications.getPermissionsAsync();
  if (atual.granted) return true;
  const pedido = await Notifications.requestPermissionsAsync();
  return pedido.granted;
}

export async function notificarAlerta(alerta: Alerta): Promise<void> {
  if (!Notifications) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `⚠️ ${alerta.titulo}`,
        body: `${SEVERIDADE[alerta.severidade].rotulo} · ${alerta.mensagem}`,
        data: { alertaId: alerta.id },
        ...(Platform.OS === 'android' ? { channelId: 'alertas' } : {}),
      },
      trigger: null,
    });
  } catch {
    /* permissão negada: o banner in-app continua funcionando */
  }
}

export async function notificacaoDeTeste(): Promise<void> {
  if (!Notifications) return;
  await Notifications.scheduleNotificationAsync({
    content: { title: 'EcoRadar Urbano', body: 'As notificações de alerta estão funcionando.', ...(Platform.OS === 'android' ? { channelId: 'alertas' } : {}) },
    trigger: null,
  });
}

export const notificacoesDisponiveis = Notifications !== null;
