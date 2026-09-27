import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { API_URL } from '@/config';
import { useSessao } from '@/estado/sessao';

/** Baixa o relatório (PDF/CSV) no celular e abre a folha de compartilhamento. */
export async function exportarRelatorio(tipo: 'pdf' | 'csv'): Promise<string> {
  const token = useSessao.getState().token;
  const destino = new File(Paths.cache, `ecoradar-relatorio-${Date.now()}.${tipo}`);
  const arquivo = await File.downloadFileAsync(`${API_URL}/api/relatorios/exportar.${tipo}`, destino, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    idempotent: true,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(arquivo.uri, {
      mimeType: tipo === 'pdf' ? 'application/pdf' : 'text/csv',
      dialogTitle: tipo === 'pdf' ? 'Compartilhar relatório PDF' : 'Compartilhar planilha CSV',
      UTI: tipo === 'pdf' ? 'com.adobe.pdf' : 'public.comma-separated-values-text',
    });
  }
  return arquivo.uri;
}
