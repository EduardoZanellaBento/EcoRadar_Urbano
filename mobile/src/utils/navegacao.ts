import { router, type Href } from 'expo-router';

/**
 * Troca de "área" do app (login ↔ abas): descarta a pilha de telas anterior para que o
 * botão voltar não retorne a uma tela de login/cadastro antiga.
 */
export function reiniciarNavegacao(destino: Href) {
  if (router.canDismiss()) router.dismissAll();
  router.replace(destino);
}
