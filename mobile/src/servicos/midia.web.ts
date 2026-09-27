import type { FotoLocal } from '@/estado/filaOffline';

async function paraDataUrl(uri: string): Promise<string> {
  const blob = await (await fetch(uri)).blob();
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result));
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsDataURL(blob);
  });
}

/** Na web, a foto é guardada como data URL (sobrevive a recarregar a página, via localStorage). */
export async function guardarFotoParaFila(foto: FotoLocal): Promise<FotoLocal> {
  if (foto.uri.startsWith('data:')) return foto;
  try {
    return { ...foto, uri: await paraDataUrl(foto.uri) };
  } catch {
    return foto;
  }
}

export async function removerFotoDaFila(): Promise<void> {
  /* nada a remover na web */
}

export async function anexarFoto(form: FormData, foto: FotoLocal): Promise<void> {
  const blob = await (await fetch(foto.uri)).blob();
  form.append('foto', new Blob([blob], { type: foto.mime || blob.type || 'image/jpeg' }), foto.nome);
}

/** Na web o navegador define o Content-Type com o boundary do multipart. */
export const CABECALHOS_MULTIPART: Record<string, string> = {};
