import { useState } from 'react';
import { Button, Dialog, HelperText, Portal, SegmentedButtons, TextInput } from 'react-native-paper';
import { mensagemDeErro } from '@/api/cliente';
import { useAlterarStatus } from '@/api/consultas';
import { STATUS as ROTULOS } from '@/tema/cores';
import type { StatusOcorrencia } from '@/tipos';

const SUGESTOES: Record<StatusOcorrencia, string> = {
  ABERTA: 'Ocorrência reaberta para nova avaliação.',
  EM_ANALISE: 'Equipe de campo acionada para vistoria.',
  RESOLVIDA: 'Problema resolvido pela equipe responsável.',
  DESCARTADA: 'Não foi encontrada irregularidade no local.',
};

/** Diálogo do agente/admin para alterar o status (comentário obrigatório, gravado no histórico). */
export function DialogoStatus({
  visivel,
  ocorrenciaId,
  statusAtual,
  statusInicial,
  aoFechar,
  aoConcluir,
}: {
  visivel: boolean;
  ocorrenciaId: string;
  statusAtual: StatusOcorrencia;
  statusInicial?: StatusOcorrencia;
  aoFechar: () => void;
  aoConcluir?: (novo: StatusOcorrencia) => void;
}) {
  const alterar = useAlterarStatus();
  // O diálogo é montado a cada abertura: o estado inicial já nasce com a sugestão correta
  const inicial = statusInicial ?? (statusAtual === 'ABERTA' ? 'EM_ANALISE' : 'RESOLVIDA');
  const [status, setStatus] = useState<StatusOcorrencia>(inicial);
  const [comentario, setComentario] = useState(SUGESTOES[inicial]);
  const [erro, setErro] = useState<string | null>(null);

  const salvar = async () => {
    if (comentario.trim().length < 3) {
      setErro('O comentário é obrigatório (mínimo de 3 caracteres).');
      return;
    }
    try {
      await alterar.mutateAsync({ id: ocorrenciaId, status, comentario: comentario.trim() });
      aoConcluir?.(status);
      aoFechar();
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  };

  return (
    <Portal>
      <Dialog visible={visivel} onDismiss={aoFechar} testID="dialogo-status">
        <Dialog.Title>Alterar status</Dialog.Title>
        <Dialog.Content style={{ gap: 12 }}>
          <SegmentedButtons
            value={status}
            onValueChange={(v) => {
              setStatus(v as StatusOcorrencia);
              setComentario(SUGESTOES[v as StatusOcorrencia]);
            }}
            buttons={(['EM_ANALISE', 'RESOLVIDA', 'DESCARTADA', 'ABERTA'] as StatusOcorrencia[])
              .filter((s) => s !== statusAtual)
              .map((s) => ({ value: s, label: ROTULOS[s].rotulo, testID: `status-${s}` }))}
            density="small"
          />
          <TextInput
            mode="outlined"
            label="Comentário (obrigatório)"
            value={comentario}
            onChangeText={setComentario}
            multiline
            numberOfLines={3}
            testID="campo-comentario-status"
          />
          {erro && <HelperText type="error">{erro}</HelperText>}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={aoFechar}>Cancelar</Button>
          <Button mode="contained" onPress={salvar} loading={alterar.isPending} disabled={alterar.isPending} testID="botao-salvar-status">
            Salvar
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
