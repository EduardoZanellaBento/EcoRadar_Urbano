import NetInfo from '@react-native-community/netinfo';
import { onlineManager, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { io, type Socket } from 'socket.io-client';
import { chaves } from '@/api/consultas';
import { API_URL } from '@/config';
import { useAlertasTempoReal, useConexao } from '@/estado/conexao';
import { contarPendentes, useFilaOffline } from '@/estado/filaOffline';
import { usePreferencias } from '@/estado/preferencias';
import { useSessao } from '@/estado/sessao';
import type { Alerta, Ocorrencia } from '@/tipos';
import { distanciaKm } from '@/utils/geo';
import { notificarAlerta } from './notificacoes';
import { sincronizarFila } from './sincronizacao';

let socketAtual: Socket | null = null;
export const obterSocket = () => socketAtual;

/**
 * Monitora a conectividade (NetInfo). A "internet alcançável" é testada contra o próprio
 * gateway (/health). Ao voltar a conexão, a fila offline é sincronizada automaticamente.
 */
export function useMonitorConexao() {
  const qc = useQueryClient();
  useEffect(() => {
    NetInfo.configure({
      reachabilityUrl: `${API_URL}/health`,
      reachabilityTest: async (r) => r.status === 200,
      reachabilityShortTimeout: 5_000,
      reachabilityLongTimeout: 30_000,
      reachabilityRequestTimeout: 5_000,
    });
    let anterior: boolean | null = null;
    const cancelar = NetInfo.addEventListener((estado) => {
      const online = estado.isConnected !== false && estado.isInternetReachable !== false;
      useConexao.getState().definirOnline(online);
      onlineManager.setOnline(online);
      if (online && anterior === false) void sincronizarFila(qc);
      anterior = online;
    });
    // Tentativa periódica (caso a volta da conexão não gere evento) e ao reabrir o app
    const intervalo = setInterval(() => {
      if (useConexao.getState().online && contarPendentes(useFilaOffline.getState().itens) > 0) void sincronizarFila(qc);
    }, 20_000);
    const app = AppState.addEventListener('change', (s) => {
      if (s === 'active' && useConexao.getState().online) void sincronizarFila(qc);
    });
    void sincronizarFila(qc);
    return () => {
      cancelar();
      clearInterval(intervalo);
      app.remove();
    };
  }, [qc]);
}

function dentroDoRaio(alerta: Alerta): boolean {
  const { ultimaLocalizacao, raioAlertasKm } = usePreferencias.getState();
  if (!ultimaLocalizacao || alerta.latitude === null || alerta.longitude === null) return true;
  return distanciaKm(ultimaLocalizacao, { latitude: alerta.latitude, longitude: alerta.longitude }) <= raioAlertasKm + (alerta.raioKm ?? 0);
}

/**
 * Conexão Socket.IO com o alertas-service (via gateway), autenticada com o JWT.
 * Novas ocorrências atualizam mapa/lista na hora; novos alertas geram banner, badge e
 * notificação local (se estiverem dentro do raio configurado no perfil).
 */
export function useTempoReal() {
  const token = useSessao((s) => s.token);
  const qc = useQueryClient();
  useEffect(() => {
    if (!token) return;
    const socket = io(API_URL, {
      path: '/socket.io',
      transports: ['websocket'],
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
      randomizationFactor: 0.3,
      timeout: 10_000,
    });
    socketAtual = socket;
    const conexao = useConexao.getState();
    socket.on('connect', () => conexao.definirSocket({ conectado: true, transporte: socket.io.engine?.transport?.name ?? 'websocket' }));
    socket.on('disconnect', () => conexao.definirSocket({ conectado: false }));
    socket.on('boas-vindas', (d: { instancia: string }) => conexao.definirSocket({ instancia: d.instancia }));
    socket.on('connect_error', (e: Error) => {
      conexao.definirSocket({ conectado: false });
      if (e.message.startsWith('NAO_AUTENTICADO')) useSessao.getState().sair('Sua sessão expirou. Entre novamente.');
    });
    socket.on('ocorrencia:nova', (o: Ocorrencia) => {
      // Insere direto no cache do mapa (aparece sem esperar a nova consulta) e revalida
      qc.setQueriesData<{ itens: Ocorrencia[]; total: number } | undefined>({ queryKey: ['ocorrencias', 'mapa'] }, (atual) =>
        atual && !atual.itens.some((i) => i.id === o.id) ? { ...atual, itens: [o, ...atual.itens], total: atual.total + 1 } : atual,
      );
      void qc.invalidateQueries({ queryKey: chaves.ocorrencias });
    });
    socket.on('ocorrencia:atualizada', () => void qc.invalidateQueries({ queryKey: chaves.ocorrencias }));
    socket.on('alerta:novo', (a: Alerta) => {
      void qc.invalidateQueries({ queryKey: ['alertas'] });
      if (dentroDoRaio(a)) {
        useAlertasTempoReal.getState().receber(a);
        void notificarAlerta(a);
      }
    });
    socket.on('alerta:encerrado', () => void qc.invalidateQueries({ queryKey: ['alertas'] }));
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketAtual = null;
      conexao.definirSocket({ conectado: false, instancia: null });
    };
  }, [token, qc]);
}
