import type { Logger } from 'pino';

export interface TarefaEncerramento {
  nome: string;
  executar: () => Promise<unknown> | unknown;
}

/**
 * Encerramento gracioso: ao receber SIGTERM/SIGINT (ex.: `docker compose stop`),
 * para de aceitar requisições, termina as que estão em andamento e fecha as conexões
 * (HTTP, broker, banco) na ordem informada. Se passar do tempo limite, força a saída.
 */
export function configurarEncerramento(logger: Logger, tarefas: TarefaEncerramento[], timeoutMs = 12_000): void {
  let emAndamento = false;

  const encerrar = async (sinal: string) => {
    if (emAndamento) return;
    emAndamento = true;
    logger.info({ sinal }, 'Sinal recebido: iniciando encerramento gracioso');
    const forcar = setTimeout(() => {
      logger.error('Tempo de encerramento esgotado; forçando a saída');
      process.exit(1);
    }, timeoutMs);
    forcar.unref();
    for (const tarefa of tarefas) {
      try {
        await tarefa.executar();
        logger.info({ tarefa: tarefa.nome }, 'Recurso encerrado');
      } catch (erro) {
        logger.warn({ err: erro, tarefa: tarefa.nome }, 'Falha ao encerrar recurso');
      }
    }
    logger.info('Encerramento gracioso concluído');
    process.exit(0);
  };

  process.once('SIGTERM', () => void encerrar('SIGTERM'));
  process.once('SIGINT', () => void encerrar('SIGINT'));
  process.on('unhandledRejection', (motivo) => logger.error({ err: motivo }, 'Promise rejeitada sem tratamento'));
  process.on('uncaughtException', (erro) => {
    logger.fatal({ err: erro }, 'Exceção não capturada; encerrando');
    void encerrar('uncaughtException');
  });
}
