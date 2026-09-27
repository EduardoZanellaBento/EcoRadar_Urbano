import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { StatusOcorrencia } from '@/tipos';
import { alertas, ambiental, ocorrencias, relatorios, type FiltrosOcorrencias } from './servicos';

/** Chaves das consultas em cache (usadas também para invalidar via Socket.IO). */
export const chaves = {
  ocorrencias: ['ocorrencias'] as const,
  mapa: (f: FiltrosOcorrencias) => ['ocorrencias', 'mapa', f] as const,
  lista: (f: FiltrosOcorrencias) => ['ocorrencias', 'lista', f] as const,
  detalhe: (id: string) => ['ocorrencias', 'detalhe', id] as const,
  mananciais: ['mananciais'] as const,
  estacoes: ['ambiental', 'estacoes'] as const,
  resumo: ['ambiental', 'resumo'] as const,
  leituras: (id: string, periodo: string) => ['ambiental', 'leituras', id, periodo] as const,
  alertas: (status: string) => ['alertas', status] as const,
  estatisticas: ['relatorios', 'estatisticas'] as const,
};

export function useOcorrenciasMapa(f: FiltrosOcorrencias) {
  return useQuery({
    queryKey: chaves.mapa(f),
    queryFn: () => ocorrencias.listar({ ...f, tamanhoPagina: 500 }),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
}

export function useListaOcorrencias(f: FiltrosOcorrencias) {
  return useInfiniteQuery({
    queryKey: chaves.lista(f),
    queryFn: ({ pageParam }) => ocorrencias.listar({ ...f, pagina: pageParam, tamanhoPagina: 20 }),
    initialPageParam: 1,
    getNextPageParam: (ultima) => (ultima.pagina * ultima.tamanhoPagina < ultima.total ? ultima.pagina + 1 : undefined),
    placeholderData: keepPreviousData,
  });
}

export function useDetalheOcorrencia(id: string) {
  return useQuery({ queryKey: chaves.detalhe(id), queryFn: () => ocorrencias.detalhe(id), enabled: Boolean(id) });
}

export function useMananciais() {
  return useQuery({ queryKey: chaves.mananciais, queryFn: ocorrencias.mananciais, staleTime: 60 * 60_000 });
}

export function useEstacoes() {
  return useQuery({ queryKey: chaves.estacoes, queryFn: ambiental.estacoes, refetchInterval: 15_000 });
}

export function useResumoAmbiental() {
  return useQuery({ queryKey: chaves.resumo, queryFn: () => ambiental.resumo(), refetchInterval: 20_000 });
}

export function useLeiturasEstacao(id: string | null, periodo = '24h') {
  return useQuery({
    queryKey: chaves.leituras(id ?? '', periodo),
    queryFn: () => ambiental.leituras(id!, periodo),
    enabled: Boolean(id),
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useAlertas(status: 'ATIVO' | 'ENCERRADO' | 'TODOS') {
  return useQuery({ queryKey: chaves.alertas(status), queryFn: () => alertas.listar(status), refetchInterval: 30_000 });
}

export function useEstatisticas() {
  return useQuery({ queryKey: chaves.estatisticas, queryFn: relatorios.estatisticas, refetchInterval: 60_000 });
}

export function useConfirmarOcorrencia(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => ocorrencias.confirmar(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.ocorrencias }),
  });
}

export function useAlterarStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; status: StatusOcorrencia; comentario: string }) => ocorrencias.alterarStatus(v.id, v.status, v.comentario),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chaves.ocorrencias });
      void qc.invalidateQueries({ queryKey: chaves.estatisticas });
    },
  });
}

export function useEncerrarAlerta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; comentario?: string }) => alertas.encerrar(v.id, v.comentario),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alertas'] }),
  });
}
