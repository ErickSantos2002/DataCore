import type { DetalheDaEmpresa } from "../../services/inadimplencia";

/** Provisório: a Task 9 desenha o formulário de registrar contato. */
export function FormularioDeContato(_props: {
  detalhe: DetalheDaEmpresa;
  onGravou: (novo: DetalheDaEmpresa) => void;
  onErro: (mensagem: string) => void;
  onCancelar: () => void;
}) {
  return null;
}
