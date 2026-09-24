/**
 * O que dizer quando a volta da Microsoft chega em `/login?erro_sso=<codigo>`.
 * Os codigos vem do backend (`auth.py`, login com Microsoft). Codigo
 * desconhecido cai na mensagem generica: a tela nunca fica calada.
 */
const MENSAGENS: Record<string, string> = {
  usuario_nao_encontrado:
    "Sua conta Microsoft não tem acesso ao DataCore. Fale com o administrador.",
  cancelado: "Login com Microsoft cancelado.",
};

const GENERICA =
  "Não foi possível entrar com a Microsoft. Tente de novo ou use usuário e senha.";

export function mensagemDeErroSso(codigo: string | null): string | null {
  if (!codigo) return null;
  return MENSAGENS[codigo] ?? GENERICA;
}
