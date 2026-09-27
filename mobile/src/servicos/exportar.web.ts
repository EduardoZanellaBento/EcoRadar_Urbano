import { api } from '@/api/cliente';

/** Na web o relatório é baixado como arquivo pelo navegador. */
export async function exportarRelatorio(tipo: 'pdf' | 'csv'): Promise<string> {
  const r = await api.get<Blob>(`/api/relatorios/exportar.${tipo}`, { responseType: 'blob', timeout: 30_000 });
  const disposicao = String(r.headers['content-disposition'] ?? '');
  const nome = /filename="([^"]+)"/.exec(disposicao)?.[1] ?? `ecoradar-relatorio.${tipo}`;
  const url = URL.createObjectURL(r.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return nome;
}
