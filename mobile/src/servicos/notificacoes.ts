import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { SEVERIDADE } from '@/tema/cores';
import type { Alerta } from '@/tipos';

let configurado = false;

/** Notificações LOCAIS (funcionam no Expo Go; push remoto exige development build). */
export async function configurarNotificacoes(): Promise<boolean> {
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
  await Notifications.scheduleNotificationAsync({
    content: { title: 'EcoRadar Urbano', body: 'As notificações de alerta estão funcionando.', ...(Platform.OS === 'android' ? { channelId: 'alertas' } : {}) },
    trigger: null,
  });
}

export const notificacoesDisponiveis = true;
