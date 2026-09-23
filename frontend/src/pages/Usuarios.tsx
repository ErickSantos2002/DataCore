import React, { useCallback, useEffect, useState } from "react";

import { Spinner } from "../design-system/ui";
import { useAuth } from "../hooks/useAuth";
import {
  createUser,
  deleteUser,
  getRoles,
  getUsers,
  updateUser,
  updateUserPassword,
  type Papel,
  type Usuario,
} from "../services/api";
import { CabecalhoUsuarios } from "./usuarios/CabecalhoUsuarios";
import {
  ModalCriarUsuario,
  type DadosDoNovoUsuario,
} from "./usuarios/ModalCriarUsuario";
import {
  ModalEditarUsuario,
  type DadosDaEdicao,
} from "./usuarios/ModalEditarUsuario";
import { ModalExcluirUsuario } from "./usuarios/ModalExcluirUsuario";
import { ModalTrocarSenha } from "./usuarios/ModalTrocarSenha";
import { TabelaDeUsuarios } from "./usuarios/TabelaDeUsuarios";
import { PAPEIS_EMBUTIDOS } from "./usuarios/usuarios";

/**
 * Qual diálogo está aberto — no singular, de propósito.
 *
 * Antes eram quatro estados independentes (`modalCriar`, `modalEditar`,
 * `modalSenha`, `modalExcluir`) e nada impedia dois de estarem abertos ao
 * mesmo tempo. Como o aviso de erro também era um estado só da página, a
 * mesma frase acabava desenhada dentro do diálogo que não tinha nada com
 * ela. Um estado só, com o tipo dizendo qual é, torna isso impossível de
 * escrever — e cada diálogo passou a guardar o próprio erro.
 */
type DialogoAberto =
  | { tipo: "criar" }
  | { tipo: "editar"; usuario: Usuario }
  | { tipo: "senha"; usuario: Usuario }
  | { tipo: "excluir"; usuario: Usuario }
  | null;

/**
 * Usuários — o cadastro de acessos ao DataCoreHS.
 *
 * A tela é o esqueleto: busca usuários e perfis, guarda qual diálogo está
 * aberto e faz as quatro chamadas de escrita. O desenho está nos
 * componentes ao lado; as regras (validação, perfil inicial, cor do selo,
 * data) em `usuarios/usuarios.ts`.
 *
 * Cada diálogo é montado só enquanto está aberto. É isso que faz o rascunho
 * do cadastro e a senha digitada morrerem no Cancelar, sem uma linha de
 * limpeza — e o que impede a senha de um usuário reaparecer no formulário
 * de outro.
 *
 * As quatro escritas seguem a mesma forma: chamar a API, e só no sucesso
 * fechar o diálogo e recarregar. Quando a API recusa, a promessa rejeita, o
 * diálogo mostra o motivo e continua aberto com o que a pessoa digitou.
 */
const Usuarios: React.FC = () => {
  const { user } = useAuth();

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [papeis, setPapeis] = useState<Papel[]>(PAPEIS_EMBUTIDOS);
  const [carregando, setCarregando] = useState(true);
  const [dialogo, setDialogo] = useState<DialogoAberto>(null);

  // A busca da montagem não liga `carregando` — ele já começa ligado, e
  // ligar de novo dentro do efeito é o que a regra `set-state-in-effect`
  // acusa —, e os setters moram no `.then`: depois de um `await` a regra os
  // lê como síncronos. Quem recarrega à mão passa pela função de baixo.
  const buscar = useCallback(
    () =>
      Promise.all([getUsers(), getRoles()]).then(
        ([lista, perfis]) => {
          setUsuarios(lista);
          setPapeis(perfis);
          setCarregando(false);
        },
        () => {
          // silencioso — tabela ficará vazia
          setCarregando(false);
        },
      ),
    [],
  );

  const carregar = useCallback(async () => {
    setCarregando(true);
    await buscar();
  }, [buscar]);

  useEffect(() => {
    buscar();
  }, [buscar]);

  const fechar = useCallback(() => setDialogo(null), []);

  async function criar(dados: DadosDoNovoUsuario) {
    await createUser(dados);
    setDialogo(null);
    await carregar();
  }

  async function salvarEdicao(id: number, dados: DadosDaEdicao) {
    await updateUser(id, dados);
    setDialogo(null);
    await carregar();
  }

  async function excluir(id: number) {
    await deleteUser(id);
    setDialogo(null);
    await carregar();
  }

  async function trocarSenha(id: number, senha: string) {
    await updateUserPassword(id, senha);
    setDialogo(null);
    // Sem recarregar: a senha não aparece em lugar nenhum da tabela.
  }

  if (carregando) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-base px-6 py-16 text-conteudo-muted md:h-full md:min-h-0">
        <Spinner size="lg" />
        <p>Carregando usuários...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-base p-6 transition-colors md:h-full md:min-h-0">
      <div className="flex flex-col gap-4">
        <CabecalhoUsuarios
          quantidade={usuarios.length}
          onNovoUsuario={() => setDialogo({ tipo: "criar" })}
        />

        <TabelaDeUsuarios
          usuarios={usuarios}
          idDoLogado={user?.id}
          onEditar={(usuario) => setDialogo({ tipo: "editar", usuario })}
          onTrocarSenha={(usuario) => setDialogo({ tipo: "senha", usuario })}
          onExcluir={(usuario) => setDialogo({ tipo: "excluir", usuario })}
          onNovoUsuario={() => setDialogo({ tipo: "criar" })}
        />
      </div>

      {dialogo?.tipo === "criar" ? (
        <ModalCriarUsuario papeis={papeis} onFechar={fechar} onCriar={criar} />
      ) : null}

      {dialogo?.tipo === "editar" ? (
        <ModalEditarUsuario
          usuario={dialogo.usuario}
          papeis={papeis}
          onFechar={fechar}
          onSalvar={(dados) => salvarEdicao(dialogo.usuario.id, dados)}
        />
      ) : null}

      {dialogo?.tipo === "senha" ? (
        <ModalTrocarSenha
          usuario={dialogo.usuario}
          onFechar={fechar}
          onConfirmar={(senha) => trocarSenha(dialogo.usuario.id, senha)}
        />
      ) : null}

      {dialogo?.tipo === "excluir" ? (
        <ModalExcluirUsuario
          usuario={dialogo.usuario}
          onFechar={fechar}
          onExcluir={() => excluir(dialogo.usuario.id)}
        />
      ) : null}
    </div>
  );
};

export default Usuarios;
