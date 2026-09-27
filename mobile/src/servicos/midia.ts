import { Directory, File, Paths } from 'expo-file-system';
import type { FotoLocal } from '@/estado/filaOffline';
import { gerarId } from '@/utils/id';

/**
 * Copia a foto para a pasta de documentos do app: a foto da câmera fica no cache, que o
 * sistema pode apagar — e a ocorrência pode ficar dias na fila offline.
 */
export async function guardarFotoParaFila(foto: FotoLocal): Promise<FotoLocal> {
  try {
    const pasta = new Directory(Paths.document, 'fila-fotos');
    if (!pasta.exists) pasta.create({ intermediates: true });
    const destino = new File(pasta, `${gerarId()}.jpg`);
    new File(foto.uri).copy(destino);
    return { ...foto, uri: destino.uri };
  } catch {
    return foto;
  }
}

export async function removerFotoDaFila(foto: FotoLocal | null): Promise<void> {
  if (!foto || !foto.uri.includes('fila-fotos')) return;
  try {
    const f = new File(foto.uri);
    if (f.exists) f.delete();
  } catch {
    /* ignorado */
  }
}

/** No React Native o FormData aceita { uri, name, type } para arquivos locais. */
export async function anexarFoto(form: FormData, foto: FotoLocal): Promise<void> {
  form.append('foto', { uri: foto.uri, name: foto.nome, type: foto.mime } as unknown as Blob);
}

export const CABECALHOS_MULTIPART: Record<string, string> = { 'Content-Type': 'multipart/form-data' };
