import type { QueryClient } from '@tanstack/react-query';
import { api, paraErroApi } from '@/api/cliente';
import { useFilaOffline, type DadosNovaOcorrencia, type FotoLocal, type ItemFila } from '@/estado/filaOffline';
import type { Ocorrencia } from '@/tipos';
import { gerarId } from '@/utils/id';
import { CABECALHOS_MULTIPART, anexarFoto, guardarFotoParaFila, removerFotoDaFila } from './midia';

/** Envia uma ocorrência (JSON ou multipart com foto) usando a idempotencyKey do item. */
export async function enviarOcorrencia(item: Pick<ItemFila, 'idempotencyKey' | 'dados' | 'foto'>): Promise<Ocorrencia> {
  const cabecalhos = { 'Idempotency-Key': item.idempotencyKey };
  // POST com idempotencyKey é seguro para repetir: o servidor devolve o original se já existir
  const opcoes = { headers: cabecalhos, repetirMesmoSendoPost: true };
  if (!item.foto) {
    const r = await api.post<Ocorrencia>('/api/ocorrencias', { ...item.dados, idempotencyKey: item.idempotencyKey }, opcoes);
    return r.data;
  }
  const form = new FormData();
  const { dados } = item;
  form.append('categoria', dados.categoria);
  form.append('severidade', dados.severidade);
  form.append('descricao', dados.descricao);
  form.append('latitude', String(dados.latitude));
  form.append('longitude', String(dados.longitude));
  form.append('idempotencyKey', item.idempotencyKey);
  if (dados.bairro) form.append('bairro', dados.bairro);
  await anexarFoto(form, item.foto);
  const r = await api.post<Ocorrencia>('/api/ocorrencias', form, {
    ...opcoes,
    headers: { ...cabecalhos, ...CABECALHOS_MULTIPART },
    transformRequest: (d) => d,
    timeout: 30_000,
  });
  return r.data;
}

export type ResultadoRegistro = { tipo: 'enviada'; ocorrencia: Ocorrencia } | { tipo: 'na_fila'; item: ItemFila };

/**
 * Registra uma ocorrência. Sem conexão (ou se a rede falhar no envio), a ocorrência vai para
 * a fila persistente e será sincronizada automaticamente quando a conexão voltar.
 */
export async function registrarOcorrencia(dados: DadosNovaOcorrencia, foto: FotoLocal | null, online: boolean): Promise<ResultadoRegistro> {
  const item: ItemFila = { idempotencyKey: gerarId(), dados, foto, status: 'pendente', criadoEm: new Date().toISOString(), tentativas: 0 };
  const enfileirar = async (erro?: string): Promise<ResultadoRegistro> => {
    const guardado: ItemFila = { ...item, foto: foto ? await guardarFotoParaFila(foto) : null, erro };
    useFilaOffline.getState().adicionar(guardado);
    return { tipo: 'na_fila', item: guardado };
  };
  if (!online) return enfileirar();
  try {
    return { tipo: 'enviada', ocorrencia: await enviarOcorrencia(item) };
  } catch (e) {
    const erro = paraErroApi(e);
    if (erro.ehDeRede || (erro.status !== null && erro.status >= 502)) return enfileirar(erro.message);
    throw erro;
  }
}

let sincronizando = false;

/** Reenvia os itens pendentes da fila (mesma idempotencyKey -> nenhuma duplicata). */
export async function sincronizarFila(queryClient?: QueryClient): Promise<{ enviados: number; falhas: number }> {
  if (sincronizando) return { enviados: 0, falhas: 0 };
  sincronizando = true;
  let enviados = 0;
  let falhas = 0;
  try {
    const { itens, atualizar } = useFilaOffline.getState();
    for (const item of itens.filter((i) => i.status === 'pendente').reverse()) {
      atualizar(item.idempotencyKey, { status: 'enviando', tentativas: item.tentativas + 1 });
      try {
        const oc = await enviarOcorrencia(item);
        atualizar(item.idempotencyKey, { status: 'sincronizado', ocorrenciaId: oc.id, sincronizadoEm: new Date().toISOString(), erro: undefined });
        await removerFotoDaFila(item.foto);
        enviados++;
      } catch (e) {
        const erro = paraErroApi(e);
        falhas++;
        if (erro.ehDeRede || (erro.status !== null && erro.status >= 500)) {
          atualizar(item.idempotencyKey, { status: 'pendente', erro: erro.message });
          break; // sem rede: tenta o restante depois
        }
        atualizar(item.idempotencyKey, { status: 'erro', erro: erro.message });
      }
    }
  } finally {
    sincronizando = false;
    if (enviados && queryClient) {
      void queryClient.invalidateQueries({ queryKey: ['ocorrencias'] });
      void queryClient.invalidateQueries({ queryKey: ['relatorios'] });
    }
  }
  return { enviados, falhas };
}
