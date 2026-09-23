import { useState } from "react";

import {
  Button,
  Input,
  Modal,
  ModalFooter,
  Select,
} from "../../design-system/ui";
import type { Papel } from "../../services/api";
import {
  emailDoFormulario,
  mensagemDeErro,
  opcoesDePapel,
  papelInicial,
  validarCriacao,
} from "./usuarios";

export interface DadosDoNovoUsuario {
  username: string;
  password: string;
  role_name: string;
  /** Só vai quando preenchido: o backend grava `null` na ausência. */
  email?: string;
}

export interface ModalCriarUsuarioProps {
  papeis: Papel[];
  onFechar: () => void;
  /** Grava. Se rejeitar, o diálogo mostra o motivo e continua aberto. */
  onCriar: (dados: DadosDoNovoUsuario) => Promise<void>;
}

/**
 * Cadastro de acesso novo.
 *
 * O diálogo é dono do formulário inteiro — os quatro campos, a validação, o
 * aviso de erro e o "gravando". A tela só diz quando ele existe e o que
 * fazer com os dados; por isso o componente é MONTADO só quando abre (ver o
 * doc do `Modal`), e o rascunho morre no fechamento sem precisar de limpeza.
 *
 * O perfil abre no que `papelInicial` decidir a partir da lista real de
 * perfis, e é esse mesmo valor que vai no payload: o que se lê no campo é o
 * que se grava.
 */
export function ModalCriarUsuario({
  papeis,
  onFechar,
  onCriar,
}: ModalCriarUsuarioProps) {
  const [username, setUsername] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState(() => papelInicial(papeis));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function confirmar() {
    const problema = validarCriacao({ username, senha, confirmacao, email });
    if (problema) {
      setErro(problema);
      return;
    }
    setErro(null);
    setSalvando(true);
    try {
      const emailLimpo = emailDoFormulario(email);
      await onCriar({
        username: username.trim(),
        password: senha,
        role_name: papel,
        ...(emailLimpo ? { email: emailLimpo } : {}),
      });
      // Sucesso: a tela fecha o diálogo, o que desmonta este componente.
      // Nada de `setSalvando(false)` aqui — seria estado em componente morto.
    } catch (e) {
      setErro(mensagemDeErro(e, "Erro ao criar usuário."));
      setSalvando(false);
    }
  }

  return (
    <Modal open onClose={onFechar} title="Novo Usuário" erro={erro}>
      <div className="flex flex-col gap-4">
        <Input
          label="Usuário"
          placeholder="nome de usuário"
          value={username}
          onChange={(evento) => setUsername(evento.target.value)}
        />
        <Input
          label="E-mail"
          type="email"
          placeholder="nome@healthsafetytech.com"
          hint="Opcional."
          value={email}
          onChange={(evento) => setEmail(evento.target.value)}
        />
        <Input
          label="Senha"
          type="password"
          hint="Mínimo de 6 caracteres."
          value={senha}
          onChange={(evento) => setSenha(evento.target.value)}
        />
        <Input
          label="Confirmar senha"
          type="password"
          value={confirmacao}
          onChange={(evento) => setConfirmacao(evento.target.value)}
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
          Criar Usuário
        </Button>
      </ModalFooter>
    </Modal>
  );
}
