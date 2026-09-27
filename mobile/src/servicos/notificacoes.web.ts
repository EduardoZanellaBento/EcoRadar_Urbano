import type { Alerta } from '@/tipos';

/** Na web os alertas aparecem como banner in-app (notificação local é recurso do celular). */
export async function configurarNotificacoes(): Promise<boolean> {
  return false;
}

export async function notificarAlerta(_alerta: Alerta): Promise<void> {
  /* sem notificação do sistema na web */
}

export async function notificacaoDeTeste(): Promise<void> {
  /* indisponível na web */
}

export const notificacoesDisponiveis = false;
