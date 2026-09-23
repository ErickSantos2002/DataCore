import { useState } from "react";

import {
  Button,
  Input,
  Modal,
  ModalFooter,
  Select,
} from "../../design-system/ui";
import type { Papel, Usuario } from "../../services/api";
import {
  emailDoFormulario,
  mensagemDeErro,
  opcoesDePapel,
  papelInicial,
  validarEdicao,
} from "./usuarios";

export interface DadosDaEdicao {
  username: string;
  role_name: string;
  /** Sempre vai: `null` é o jeito de apagar um e-mail que existia. */
  email: string | null;
}

export interface ModalEditarUsuarioProps {
  usuario: Usuario;
  papeis: Papel[];
  onFechar: () => void;
  /** Grava. Se rejeitar, o diálogo mostra o motivo e continua aberto. */
  onSalvar: (dados: DadosDaEdicao) => Promise<void>;
}

/**
 * Edição de nome e perfil de um acesso que já existe. Senha não se edita
 * aqui — é o outro diálogo, com outra confirmação.
 *
 * Abre com o papel que o usuário já tem, desde que ele ainda exista na lista
 * de perfis; se o papel foi extinto no backend, cai na mesma regra do
 * cadastro em vez de mostrar um perfil e gravar outro.
 */
export function ModalEditarUsuario({
  usuario,
  papeis,
  onFechar,
  onSalvar,
}: ModalEditarUsuarioProps) {
  const [username, setUsername] = useState(usuario.username);
  const [email, setEmail] = useState(usuario.email ?? "");
  const [papel, setPapel] = useState(() =>
    papelInicial(papeis, usuario.role?.name),
  );
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function confirmar() {
    const problema = validarEdicao(username, email);
    if (problema) {
      setErro(problema);
      return;
    }
    setErro(null);
    setSalvando(true);
    try {
      await onSalvar({
        username: username.trim(),
        role_name: papel,
        email: emailDoFormulario(email),
      });
    } catch (e) {
      setErro(mensagemDeErro(e, "Erro ao atualizar usuário."));
      setSalvando(false);
    }
  }

  return (
    <Modal
      open
      onClose={onFechar}
      title={`Editar — ${usuario.username}`}
      erro={erro}
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Usuário"
          value={username}
          onChange={(evento) => setUsername(evento.target.value)}
        />
        <Input
          label="E-mail"
          type="email"
          hint="Opcional. Apagar deixa o usuário sem e-mail."
          value={email}
          onChange={(evento) => setEmail(evento.target.value)}
        />
        <Select
          label="Perfil"
          options={opcoesDePapel(papeis)}
          value={papel}
          onChange={(evento) => setPapel(evento.target.value)}
        />
      </div>

      <ModalFooter>
        <Button variant="secondary" onClick={onFechar}>
          Cancelar
        </Button>
        <Button onClick={confirmar} loading={salvando}>
          Salvar
        </Button>
      </ModalFooter>
    </Modal>
  );
}
