import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Usuarios from "./Usuarios";
import { AuthContext } from "../context/AuthContext";
import type { Papel, Usuario } from "../services/api";

/**
 * Teste de caracterização da tela de Usuários.
 *
 * Fixa o comportamento que existia ANTES da migração para o design system.
 * A tela é a única guardiã de coisas que ninguém mais repete: a ordem das
 * três validações do formulário de criação, o payload exato de cada uma das
 * quatro chamadas de escrita, quem pode ser excluído e como a data de
 * criação vira texto. Um refactor que "arrume" qualquer um desses muda o que
 * chega no backend de autenticação — em silêncio, se ninguém tiver fixado.
 *
 * Tudo é observado pela tela renderizada, nunca por função exportada de
 * propósito para o teste: assim o teste sobrevive a quebrar a página em
 * componentes, que é exatamente o passo seguinte.
 *
 * Onde o comportamento de hoje parece errado, o teste fixa o que a tela FAZ,
 * com um comentário marcando a suspeita. Quem decide se é defeito é o Erick.
 */

const api = vi.hoisted(() => ({
  getUsers: vi.fn(),
  getRoles: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
  updateUserPassword: vi.fn(),
}));
vi.mock("../services/api", () => ({ ...api, default: {} }));

/** Quem está logado — trocado por teste antes de montar a tela. */
let usuarioLogado: { id: number; username: string; role: string } | null = {
  id: 1,
  username: "erick",
  role: "admin",
};

function Molde({ children }: { children: ReactNode }) {
  return (
    <AuthContext.Provider
      value={{
        user: usuarioLogado,
        token: "t",
        loading: false,
        login: vi.fn(),
        logout: vi.fn(),
        error: null,
      }}
    >
      {/* Sem ToastProvider de propósito: depois da migração, o aviso de erro
          da troca de senha é do próprio diálogo, e não um toast solto. Se
          alguém reintroduzir `useToast` aqui dentro, este molde quebra. */}
      {children}
    </AuthContext.Provider>
  );
}

function usuario(campos: Partial<Usuario> & { id: number }): Usuario {
  return {
    username: `user${campos.id}`,
    role: { id: 5, name: "comum" },
    created_at: "2026-01-15T09:30:00",
    ...campos,
  };
}

const USUARIOS: Usuario[] = [
  usuario({
    id: 1,
    username: "erick",
    role: { id: 1, name: "admin" },
    created_at: "2026-01-15T09:30:00",
  }),
  usuario({
    id: 7,
    username: "maria",
    role: { id: 2, name: "vendas" },
    created_at: "2026-02-28T23:45:00",
  }),
  usuario({
    id: 9,
    username: "joao",
    role: { id: 5, name: "comum" },
    created_at: "2026-03-01T10:00:00",
  }),
];

const PAPEIS: Papel[] = [
  { id: 1, name: "admin" },
  { id: 2, name: "vendas" },
  { id: 3, name: "financeiro" },
  { id: 4, name: "servicos" },
  { id: 5, name: "comum" },
];

/** Os cinco perfis embutidos na tela, usados quando `getRoles` não responde. */
const PAPEIS_EMBUTIDOS = ["admin", "vendas", "financeiro", "servicos", "comum"];

async function montar(
  opcoes: {
    usuarios?: Usuario[];
    papeis?: Papel[];
    logado?: typeof usuarioLogado;
  } = {},
) {
  if (opcoes.logado !== undefined) usuarioLogado = opcoes.logado;
  api.getUsers.mockResolvedValue(opcoes.usuarios ?? USUARIOS);
  api.getRoles.mockResolvedValue(opcoes.papeis ?? PAPEIS);
  const resultado = render(<Usuarios />, { wrapper: Molde });
  await screen.findByRole("table");
  return resultado;
}

/**
 * Linhas de DADO da tabela — sem o cabeçalho e sem a linha do estado vazio.
 *
 * O estado vazio é um `<tr>` de verdade, com uma célula só abrangendo as
 * cinco colunas; contá-lo como linha faria "nenhum usuário" virar "um
 * usuário". A linha de dado é a que tem uma célula por coluna.
 */
function linhasDaTabela(): HTMLElement[] {
  return within(screen.getByRole("table"))
    .getAllByRole("row")
    .slice(1)
    .filter((linha) => within(linha).queryAllByRole("cell").length > 1);
}

/** O conteúdo das células de cada linha, na ordem em que a tela desenhou. */
function celulasDaLinha(linha: HTMLElement): string[] {
  return within(linha)
    .getAllByRole("cell")
    .map((celula) => (celula.textContent ?? "").trim());
}

function linhaDe(username: string): HTMLElement {
  const linha = linhasDaTabela().find((l) =>
    within(l).queryByText(new RegExp(`^${username}`)),
  );
  if (!linha) throw new Error(`usuário "${username}" não está na tabela`);
  return linha;
}

/** Botão de ação da linha, achado pelo `title` (é o nome acessível dele). */
function acao(username: string, titulo: string | RegExp): HTMLElement {
  return within(linhaDe(username)).getByRole("button", { name: titulo });
}

/**
 * Os campos de senha do diálogo aberto, achados PELO RÓTULO.
 *
 * Antes a busca era `document.querySelectorAll('input[type=password]')`,
 * porque nenhum `<label>` da tela tinha `htmlFor` e `getByLabelText` não
 * achava campo nenhum. Agora todos passam pelo `Input`/`Select` do design
 * system, que amarra rótulo e campo por `useId` — então o teste pergunta
 * pelo nome que a pessoa lê, e não pelo tipo do `<input>`. Se o rótulo se
 * soltar do campo outra vez, isto quebra.
 */
function camposDeSenha(): HTMLInputElement[] {
  const rotulos = screen.queryByLabelText("Nova senha")
    ? ["Nova senha", "Repita nova senha"]
    : ["Senha", "Confirmar senha"];
  return rotulos.map(
    (rotulo) => screen.getByLabelText(rotulo) as HTMLInputElement,
  );
}

/** O campo "Usuário" do diálogo aberto — o único campo de texto da tela. */
function campoDeUsuario(): HTMLInputElement {
  return screen.getByLabelText("Usuário") as HTMLInputElement;
}

/**
 * O bloco de um modal aberto, achado pelo título e subindo até o ancestral
 * que também tem o botão Cancelar — assim o teste não depende da estrutura
 * de `<div>`s e continua valendo quando o modal virar primitivo do design
 * system. Necessário porque a tela deixa dois modais abertos ao mesmo tempo
 * e porque "Excluir" é ao mesmo tempo o título de um botão da linha.
 */
function modal(titulo: string | RegExp): HTMLElement {
  const cabecalho = screen.getByRole("heading", { name: titulo });
  let no: HTMLElement | null = cabecalho.parentElement;
  while (
    no &&
    within(no).queryAllByRole("button", { name: "Cancelar" }).length === 0
  ) {
    no = no.parentElement;
  }
  if (!no) throw new Error(`modal "${titulo}" não está aberto`);
  return no;
}

/** O `<select>` de perfil do único diálogo aberto, achado pelo rótulo. */
function selectDePerfil(): HTMLSelectElement {
  return screen.getByLabelText("Perfil") as HTMLSelectElement;
}

function opcoesDoSelect(): string[] {
  return within(selectDePerfil())
    .getAllByRole("option")
    .map((o) => (o.textContent ?? "").trim());
}

/** Preenche o formulário de criação (usuário, senha, confirmação). */
async function preencherCriacao(
  usuarioTeclado: string,
  senha: string,
  confirmacao = senha,
) {
  const digitar = userEvent.setup();
  if (usuarioTeclado) await digitar.type(campoDeUsuario(), usuarioTeclado);
  const [campoSenha, campoConfirma] = camposDeSenha();
  if (senha) await digitar.type(campoSenha, senha);
  if (confirmacao) await digitar.type(campoConfirma, confirmacao);
}

async function abrirCriar() {
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Novo Usuário" }));
}

/** Erro devolvido pelo axios, no formato que a tela lê. */
function erroApi(detail: string) {
  return { response: { data: { detail } } };
}

beforeEach(() => {
  usuarioLogado = { id: 1, username: "erick", role: "admin" };
  api.getUsers.mockReset();
  api.getRoles.mockReset();
  api.createUser.mockReset().mockResolvedValue({});
  api.updateUser.mockReset().mockResolvedValue({});
  api.deleteUser.mockReset().mockResolvedValue({});
  api.updateUserPassword.mockReset().mockResolvedValue({});
});

describe("Usuários — carregamento", () => {
  it("mostra o aviso de carregando enquanto as duas chamadas não voltam", () => {
    api.getUsers.mockReturnValue(new Promise(() => {}));
    api.getRoles.mockResolvedValue(PAPEIS);
    render(<Usuarios />, { wrapper: Molde });

    expect(screen.getByText("Carregando usuários...")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("busca usuários e perfis uma vez só ao abrir a tela", async () => {
    await montar();

    expect(api.getUsers).toHaveBeenCalledTimes(1);
    expect(api.getRoles).toHaveBeenCalledTimes(1);
  });

  it("falha ao buscar usuários é silenciosa: tabela vazia e nenhuma mensagem de erro", async () => {
    // O `catch` da tela não guarda nada; o usuário vê uma tabela vazia e não
    // fica sabendo que a chamada falhou. É o comportamento de hoje.
    api.getUsers.mockRejectedValue(new Error("500"));
    api.getRoles.mockResolvedValue(PAPEIS);
    render(<Usuarios />, { wrapper: Molde });

    await screen.findByRole("table");
    expect(linhasDaTabela()).toHaveLength(0);
    expect(
      screen.getByText("Nenhum usuário cadastrado ainda."),
    ).toBeInTheDocument();
    expect(screen.getByText(/0 usuários cadastrados/)).toBeInTheDocument();
    expect(screen.queryByText(/erro/i)).not.toBeInTheDocument();
  });

  it("falha ao buscar perfis derruba junto a lista de usuários que já tinha voltado", async () => {
    // Suspeita: as duas chamadas estão no mesmo `Promise.all`, então o
    // /roles fora do ar esvazia a tabela de usuários — mesmo com o /users OK.
    api.getUsers.mockResolvedValue(USUARIOS);
    api.getRoles.mockRejectedValue(new Error("500"));
    render(<Usuarios />, { wrapper: Molde });

    await screen.findByRole("table");
    expect(linhasDaTabela()).toHaveLength(0);
  });
});

describe("Usuários — tabela", () => {
  it("desenha uma linha por usuário, com id, nome, e-mail, perfil e data de criação", async () => {
    await montar();

    const linhas = linhasDaTabela();
    expect(linhas).toHaveLength(3);
    expect(celulasDaLinha(linhas[0]).slice(0, 5)).toEqual([
      "1",
      "erick(você)",
      "—",
      "admin",
      "15/01/2026",
    ]);
    expect(celulasDaLinha(linhas[1]).slice(0, 5)).toEqual([
      "7",
      "maria",
      "—",
      "vendas",
      "28/02/2026",
    ]);
    expect(celulasDaLinha(linhas[2]).slice(0, 5)).toEqual([
      "9",
      "joao",
      "—",
      "comum",
      "01/03/2026",
    ]);
  });

  it("a contagem do subtítulo bate com o número de linhas", async () => {
    await montar({ usuarios: USUARIOS.slice(0, 2) });

    expect(screen.getByText(/2 usuários cadastrados/)).toBeInTheDocument();
    expect(linhasDaTabela()).toHaveLength(2);
  });

  it("sem nenhum usuário, a tabela diz que está vazia e oferece a saída", async () => {
    // ANTES: o corpo da tabela ficava em branco, sem uma palavra — a
    // asserção era `queryByText(/nenhum/i)` NÃO estar no documento.
    // AGORA: frase completa e o botão que resolve, dentro da própria tabela.
    // O rótulo é outro ("Criar o primeiro usuário") de propósito: o
    // "Novo Usuário" do cabeçalho continua sendo o primário da tela, e dois
    // botões com o mesmo nome na mesma tela confundem quem lê.
    await montar({ usuarios: [] });

    expect(linhasDaTabela()).toHaveLength(0);
    expect(
      screen.getAllByRole("columnheader").map((c) => c.textContent),
    ).toEqual(["ID", "Usuário", "E-mail", "Perfil", "Criado em", "Ações"]);
    expect(screen.getByText(/0 usuários cadastrados/)).toBeInTheDocument();
    expect(
      screen.getByText("Nenhum usuário cadastrado ainda."),
    ).toBeInTheDocument();

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Criar o primeiro usuário" }));
    expect(
      screen.getByRole("heading", { name: "Novo Usuário" }),
    ).toBeInTheDocument();
  });

  it("usuário sem perfil aparece com travessão na coluna Perfil", async () => {
    await montar({
      usuarios: [
        usuario({
          id: 3,
          username: "orfao",
          role: undefined as unknown as Papel,
        }),
      ],
    });

    expect(celulasDaLinha(linhasDaTabela()[0])[3]).toBe("—");
  });

  it("data que não presta vira travessão, o mesmo do perfil ausente", async () => {
    // ANTES: `new Date("")` virava "Invalid Date" e a célula mostrava isso —
    // em inglês, no meio de uma tabela em português. A asserção era
    // literalmente `toBe("Invalid Date")`.
    // AGORA: o mesmo travessão que a coluna Perfil já usa para "não tem".
    await montar({
      usuarios: [
        usuario({ id: 3, created_at: "" }),
        usuario({ id: 4, created_at: "ontem" }),
      ],
    });

    expect(celulasDaLinha(linhasDaTabela()[0])[4]).toBe("—");
    expect(celulasDaLinha(linhasDaTabela()[1])[4]).toBe("—");
  });
});

describe("Usuários — data de criação e fuso", () => {
  it("data-hora sem fuso rende o mesmo dia que a API mandou, em qualquer fuso", async () => {
    // "2026-02-28T23:45:00" (sem Z) é lido como hora LOCAL, então o dia não
    // se move: 28/02 em TZ=UTC e em TZ=America/Sao_Paulo.
    await montar({
      usuarios: [usuario({ id: 3, created_at: "2026-02-28T23:45:00" })],
    });

    expect(celulasDaLinha(linhasDaTabela()[0])[4]).toBe("28/02/2026");
  });

  it("data pura, sem hora, rende o dia escrito em QUALQUER fuso", async () => {
    // ANTES: a asserção era condicional — `atrasado ? "14/01/2026" :
    // "15/01/2026"`, porque `new Date("2026-01-15")` é meia-noite em UTC e
    // em UTC-3 isso ainda é dia 14 às 21h. O teste dizia o que cada fuso
    // mostrava, e o que ele mostrava em Brasília estava errado.
    // AGORA: incondicional. A data é lida da string, sem `Date` nenhum, e a
    // suíte roda em TZ=UTC e em TZ=America/Sao_Paulo com o mesmo resultado.
    await montar({ usuarios: [usuario({ id: 3, created_at: "2026-01-15" })] });

    expect(celulasDaLinha(linhasDaTabela()[0])[4]).toBe("15/01/2026");
  });

  it("data-hora em UTC (com Z) de madrugada também não anda para trás", async () => {
    // ANTES: condicional pelo mesmo motivo — 02:00Z do dia 15 é 23:00 do
    // dia 14 em Brasília, e era o 14 que aparecia.
    // AGORA: o `created_at` é dia de calendário. O dia é o que o backend
    // escreveu, e a hora não move a célula.
    await montar({
      usuarios: [usuario({ id: 3, created_at: "2026-01-15T02:00:00Z" })],
    });

    expect(celulasDaLinha(linhasDaTabela()[0])[4]).toBe("15/01/2026");
  });
});

describe("Usuários — o próprio usuário logado", () => {
  it("marca com (você) só a linha de quem está logado", async () => {
    await montar();

    expect(within(linhaDe("erick")).getByText("(você)")).toBeInTheDocument();
    expect(screen.getAllByText("(você)")).toHaveLength(1);
  });

  it("sem ninguém logado, nenhuma linha ganha o (você)", async () => {
    await montar({ logado: null });

    expect(screen.queryByText("(você)")).not.toBeInTheDocument();
  });

  it("o (você) segue o id, não o nome — outro id com o mesmo nome não é marcado", async () => {
    await montar({ logado: { id: 7, username: "erick", role: "admin" } });

    expect(within(linhaDe("maria")).getByText("(você)")).toBeInTheDocument();
    expect(
      within(linhaDe("erick")).queryByText("(você)"),
    ).not.toBeInTheDocument();
  });

  it("o botão de excluir do próprio usuário fica desabilitado, com o motivo no title", async () => {
    await montar();

    const botao = acao("erick", "Não é possível excluir seu próprio usuário");
    expect(botao).toBeDisabled();
  });

  it("o botão de excluir dos outros fica habilitado e se chama Excluir", async () => {
    await montar();

    expect(acao("maria", "Excluir")).toBeEnabled();
  });

  it("editar e trocar senha continuam liberados na própria linha", async () => {
    await montar();

    expect(acao("erick", "Editar")).toBeEnabled();
    expect(acao("erick", "Trocar senha")).toBeEnabled();
  });
});

describe("Usuários — modal de criação", () => {
  it("abre pelo botão Novo Usuário, com os campos em branco e o perfil comum", async () => {
    await montar();
    await abrirCriar();

    expect(
      screen.getByRole("heading", { name: "Novo Usuário" }),
    ).toBeInTheDocument();
    expect(campoDeUsuario()).toHaveValue("");
    expect(camposDeSenha().map((c) => c.value)).toEqual(["", ""]);
    expect(selectDePerfil()).toHaveValue("comum");
  });

  it("recusa nome de usuário vazio", async () => {
    await montar();
    await abrirCriar();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Criar Usuário" }));

    expect(screen.getByText("Informe um nome de usuário.")).toBeInTheDocument();
    expect(api.createUser).not.toHaveBeenCalled();
  });

  it("recusa nome de usuário só com espaços", async () => {
    await montar();
    await abrirCriar();
    await preencherCriacao("   ", "senha123");
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Criar Usuário" }));

    expect(screen.getByText("Informe um nome de usuário.")).toBeInTheDocument();
    expect(api.createUser).not.toHaveBeenCalled();
  });

  it("recusa senha com menos de 6 caracteres", async () => {
    await montar();
    await abrirCriar();
    await preencherCriacao("novo", "12345");
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Criar Usuário" }));

    expect(
      screen.getByText("A senha deve ter pelo menos 6 caracteres."),
    ).toBeInTheDocument();
    expect(api.createUser).not.toHaveBeenCalled();
  });

  it("recusa confirmação diferente da senha", async () => {
    await montar();
    await abrirCriar();
    await preencherCriacao("novo", "senha123", "senha124");
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Criar Usuário" }));

    expect(screen.getByText("As senhas não coincidem.")).toBeInTheDocument();
    expect(api.createUser).not.toHaveBeenCalled();
  });

  it("valida na ordem: nome antes de senha curta, senha curta antes de divergência", async () => {
    await montar();
    await abrirCriar();
    // Tudo errado de uma vez: só a primeira mensagem aparece.
    await preencherCriacao("", "123", "999");
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Criar Usuário" }));
    expect(screen.getByText("Informe um nome de usuário.")).toBeInTheDocument();

    await preencherCriacao("novo", "", "");
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Criar Usuário" }));
    expect(
      screen.getByText("A senha deve ter pelo menos 6 caracteres."),
    ).toBeInTheDocument();
  });

  it("cria o usuário com o payload exato, fecha o modal e recarrega a lista", async () => {
    const digitar = userEvent.setup();
    await montar();
    await abrirCriar();
    await preencherCriacao("  novato  ", "senha123");
    await digitar.selectOptions(selectDePerfil(), "financeiro");
    await digitar.click(screen.getByRole("button", { name: "Criar Usuário" }));

    expect(api.createUser).toHaveBeenCalledTimes(1);
    expect(api.createUser).toHaveBeenCalledWith({
      username: "novato",
      password: "senha123",
      role_name: "financeiro",
    });
    await screen.findByRole("table");
    expect(
      screen.queryByRole("heading", { name: "Novo Usuário" }),
    ).not.toBeInTheDocument();
    // Recarregou: segunda ida ao /users e ao /roles.
    expect(api.getUsers).toHaveBeenCalledTimes(2);
    expect(api.getRoles).toHaveBeenCalledTimes(2);
  });

  it("depois de criar com sucesso, o formulário reabre limpo", async () => {
    const digitar = userEvent.setup();
    await montar();
    await abrirCriar();
    await preencherCriacao("novato", "senha123");
    await digitar.click(screen.getByRole("button", { name: "Criar Usuário" }));
    await screen.findByRole("table");

    await abrirCriar();
    expect(campoDeUsuario()).toHaveValue("");
    expect(camposDeSenha().map((c) => c.value)).toEqual(["", ""]);
    expect(selectDePerfil()).toHaveValue("comum");
  });

  it("o que foi digitado morre no Cancelar — reabre em branco", async () => {
    // ANTES: os quatro campos viviam no estado da PÁGINA, então o Cancelar
    // só escondia o modal. A asserção era que o rascunho voltava inteiro:
    // "rascunho", ["senha123", "senha123"] e o perfil "vendas".
    // AGORA: o diálogo é montado só enquanto está aberto, e o estado dele
    // morre junto — inclusive a senha, que era o pior de sobreviver.
    const digitar = userEvent.setup();
    await montar();
    await abrirCriar();
    await preencherCriacao("rascunho", "senha123");
    await digitar.selectOptions(selectDePerfil(), "vendas");
    await digitar.click(screen.getByRole("button", { name: "Cancelar" }));

    await abrirCriar();
    expect(campoDeUsuario()).toHaveValue("");
    expect(camposDeSenha().map((c) => c.value)).toEqual(["", ""]);
    expect(selectDePerfil()).toHaveValue("comum");
  });

  it("o Escape também fecha o cadastro, e também sem guardar o rascunho", async () => {
    const digitar = userEvent.setup();
    await montar();
    await abrirCriar();
    await preencherCriacao("rascunho", "senha123");
    await digitar.keyboard("{Escape}");
    expect(
      screen.queryByRole("heading", { name: "Novo Usuário" }),
    ).not.toBeInTheDocument();

    await abrirCriar();
    expect(campoDeUsuario()).toHaveValue("");
    expect(camposDeSenha().map((c) => c.value)).toEqual(["", ""]);
  });

  it("mostra o detail que a API devolveu quando a criação falha", async () => {
    api.createUser.mockRejectedValue(erroApi("Usuário já existe"));
    await montar();
    await abrirCriar();
    await preencherCriacao("novato", "senha123");
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Criar Usuário" }));

    expect(await screen.findByText("Usuário já existe")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Novo Usuário" }),
    ).toBeInTheDocument();
    expect(api.getUsers).toHaveBeenCalledTimes(1);
  });

  it("sem detail na resposta, cai na mensagem genérica de criação", async () => {
    api.createUser.mockRejectedValue(new Error("Network Error"));
    await montar();
    await abrirCriar();
    await preencherCriacao("novato", "senha123");
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Criar Usuário" }));

    expect(
      await screen.findByText("Erro ao criar usuário."),
    ).toBeInTheDocument();
  });
});

describe("Usuários — perfis do select", () => {
  it("lista os perfis que vieram do getRoles", async () => {
    await montar({
      papeis: [
        { id: 9, name: "suporte" },
        { id: 10, name: "comum" },
      ],
    });
    await abrirCriar();

    expect(opcoesDoSelect()).toEqual(["suporte", "comum"]);
  });

  it("com o getRoles fora do ar, o select cai nos cinco perfis embutidos na tela", async () => {
    api.getUsers.mockResolvedValue(USUARIOS);
    api.getRoles.mockRejectedValue(new Error("500"));
    render(<Usuarios />, { wrapper: Molde });
    await screen.findByRole("table");
    await abrirCriar();

    expect(opcoesDoSelect()).toEqual(PAPEIS_EMBUTIDOS);
  });

  it("sem 'comum' na API, o payload manda o perfil que o select mostra", async () => {
    // ANTES: o valor inicial era a string "comum", chutada pela tela. Sem
    // "comum" na lista, o campo MOSTRAVA "suporte" e o POST MANDAVA "comum"
    // — a asserção fixava `role_name: "comum"`, que é ler uma coisa e
    // gravar outra.
    // AGORA: o inicial sai da lista real, e é o mesmo valor nos dois lados.
    await montar({ papeis: [{ id: 9, name: "suporte" }] });
    await abrirCriar();
    expect(selectDePerfil().value).toBe("suporte");

    await preencherCriacao("novato", "senha123");
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Criar Usuário" }));

    expect(api.createUser).toHaveBeenCalledWith({
      username: "novato",
      password: "senha123",
      role_name: "suporte",
    });
  });

  it("com vários perfis e nenhum 'comum', abre no primeiro e grava o primeiro", async () => {
    await montar({
      papeis: [
        { id: 9, name: "suporte" },
        { id: 10, name: "auditoria" },
      ],
    });
    await abrirCriar();
    expect(selectDePerfil().value).toBe("suporte");

    await preencherCriacao("novato", "senha123");
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Criar Usuário" }));

    expect(api.createUser).toHaveBeenCalledWith({
      username: "novato",
      password: "senha123",
      role_name: "suporte",
    });
  });

  it("o perfil escolhido à mão continua sendo o que vai no payload", async () => {
    const digitar = userEvent.setup();
    await montar({
      papeis: [
        { id: 9, name: "suporte" },
        { id: 10, name: "auditoria" },
      ],
    });
    await abrirCriar();
    await preencherCriacao("novato", "senha123");
    await digitar.selectOptions(selectDePerfil(), "auditoria");
    await digitar.click(screen.getByRole("button", { name: "Criar Usuário" }));

    expect(api.createUser).toHaveBeenCalledWith({
      username: "novato",
      password: "senha123",
      role_name: "auditoria",
    });
  });
});

describe("Usuários — modal de edição", () => {
  it("abre pré-preenchido com o nome e o perfil do usuário clicado", async () => {
    await montar();
    await userEvent.setup().click(acao("maria", "Editar"));

    expect(
      screen.getByRole("heading", { name: "Editar — maria" }),
    ).toBeInTheDocument();
    expect(campoDeUsuario()).toHaveValue("maria");
    expect(selectDePerfil()).toHaveValue("vendas");
  });

  it("usuário sem perfil abre a edição em comum", async () => {
    await montar({
      usuarios: [
        usuario({
          id: 3,
          username: "orfao",
          role: undefined as unknown as Papel,
        }),
      ],
    });
    await userEvent.setup().click(acao("orfao", "Editar"));

    expect(selectDePerfil()).toHaveValue("comum");
  });

  it("salva chamando updateUser com o id e o payload exatos, e recarrega", async () => {
    const digitar = userEvent.setup();
    await montar();
    await digitar.click(acao("maria", "Editar"));
    await digitar.clear(campoDeUsuario());
    await digitar.type(campoDeUsuario(), "  maria.silva  ");
    await digitar.selectOptions(selectDePerfil(), "financeiro");
    await digitar.click(screen.getByRole("button", { name: "Salvar" }));

    expect(api.updateUser).toHaveBeenCalledTimes(1);
    expect(api.updateUser).toHaveBeenCalledWith(7, {
      username: "maria.silva",
      role_name: "financeiro",
      email: null,
    });
    await screen.findByRole("table");
    expect(
      screen.queryByRole("heading", { name: /^Editar/ }),
    ).not.toBeInTheDocument();
    expect(api.getUsers).toHaveBeenCalledTimes(2);
  });

  it("recusa salvar com o nome de usuário vazio", async () => {
    const digitar = userEvent.setup();
    await montar();
    await digitar.click(acao("maria", "Editar"));
    await digitar.clear(campoDeUsuario());
    await digitar.click(screen.getByRole("button", { name: "Salvar" }));

    expect(screen.getByText("Informe um nome de usuário.")).toBeInTheDocument();
    expect(api.updateUser).not.toHaveBeenCalled();
  });

  it("mostra o detail da API, e a mensagem genérica quando ele não vem", async () => {
    const digitar = userEvent.setup();
    api.updateUser.mockRejectedValue(erroApi("Nome já em uso"));
    await montar();
    await digitar.click(acao("maria", "Editar"));
    await digitar.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Nome já em uso")).toBeInTheDocument();

    api.updateUser.mockRejectedValue(new Error("Network Error"));
    await digitar.click(screen.getByRole("button", { name: "Salvar" }));
    expect(
      await screen.findByText("Erro ao atualizar usuário."),
    ).toBeInTheDocument();
  });

  it("Cancelar fecha a edição sem chamar a API", async () => {
    const digitar = userEvent.setup();
    await montar();
    await digitar.click(acao("maria", "Editar"));
    await digitar.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(
      screen.queryByRole("heading", { name: /^Editar/ }),
    ).not.toBeInTheDocument();
    expect(api.updateUser).not.toHaveBeenCalled();
  });
});

describe("Usuários — modal de exclusão", () => {
  it("pergunta antes, nomeando o usuário", async () => {
    await montar();
    await userEvent.setup().click(acao("joao", "Excluir"));

    const caixa = modal("Confirmar Exclusão");
    expect(
      within(caixa).getByText(/Tem certeza que deseja excluir o usuário/),
    ).toBeInTheDocument();
    expect(within(caixa).getByText("joao")).toBeInTheDocument();
  });

  it("confirmando, chama deleteUser com o id certo e recarrega a lista", async () => {
    const digitar = userEvent.setup();
    await montar();
    await digitar.click(acao("joao", "Excluir"));
    await digitar.click(
      within(modal("Confirmar Exclusão")).getByRole("button", {
        name: "Excluir",
      }),
    );

    expect(api.deleteUser).toHaveBeenCalledTimes(1);
    expect(api.deleteUser).toHaveBeenCalledWith(9);
    await screen.findByRole("table");
    expect(
      screen.queryByRole("heading", { name: "Confirmar Exclusão" }),
    ).not.toBeInTheDocument();
    expect(api.getUsers).toHaveBeenCalledTimes(2);
  });

  it("Cancelar fecha sem excluir", async () => {
    const digitar = userEvent.setup();
    await montar();
    await digitar.click(acao("joao", "Excluir"));
    await digitar.click(
      within(modal("Confirmar Exclusão")).getByRole("button", {
        name: "Cancelar",
      }),
    );

    expect(
      screen.queryByRole("heading", { name: "Confirmar Exclusão" }),
    ).not.toBeInTheDocument();
    expect(api.deleteUser).not.toHaveBeenCalled();
  });

  it("mostra o detail da API, e a mensagem genérica quando ele não vem", async () => {
    const digitar = userEvent.setup();
    api.deleteUser.mockRejectedValue(erroApi("Usuário tem notas vinculadas"));
    await montar();
    await digitar.click(acao("joao", "Excluir"));
    const confirmar = within(modal("Confirmar Exclusão")).getByRole("button", {
      name: "Excluir",
    });
    await digitar.click(confirmar);
    expect(
      await screen.findByText("Usuário tem notas vinculadas"),
    ).toBeInTheDocument();

    api.deleteUser.mockRejectedValue(new Error("Network Error"));
    await digitar.click(confirmar);
    expect(
      await screen.findByText("Erro ao excluir usuário."),
    ).toBeInTheDocument();
  });
});

describe("Usuários — modal de troca de senha", () => {
  it("troca a senha chamando updateUserPassword com o id e a senha, e fecha", async () => {
    const digitar = userEvent.setup();
    await montar();
    await digitar.click(acao("maria", "Trocar senha"));

    const [nova, repita] = camposDeSenha();
    await digitar.type(nova, "outrasenha");
    await digitar.type(repita, "outrasenha");
    await digitar.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(api.updateUserPassword).toHaveBeenCalledTimes(1);
    expect(api.updateUserPassword).toHaveBeenCalledWith(7, "outrasenha");
    // Fecha só DEPOIS de a API responder — por isso o await.
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Trocar Senha" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("senhas diferentes viram aviso e não chamam a API", async () => {
    const digitar = userEvent.setup();
    await montar();
    await digitar.click(acao("maria", "Trocar senha"));

    const [nova, repita] = camposDeSenha();
    await digitar.type(nova, "outrasenha");
    await digitar.type(repita, "outrasenh4");
    await digitar.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(
      await screen.findByText("As senhas não coincidem."),
    ).toBeInTheDocument();
    expect(api.updateUserPassword).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "Trocar Senha" }),
    ).toBeInTheDocument();
  });

  it("recusa senha vazia — o mesmo mínimo de 6 da criação", async () => {
    // ANTES: a troca não exigia nada, e a asserção era que a API era chamada
    // com a senha em branco — `toHaveBeenCalledWith(7, "")`. Dava para
    // gravar senha vazia num usuário que já existia.
    // AGORA: os dois formulários chamam a mesma `validarSenha`, então o
    // mínimo é um só e não há como um subir e o outro ficar para trás.
    const digitar = userEvent.setup();
    await montar();
    await digitar.click(acao("maria", "Trocar senha"));
    await digitar.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(
      await screen.findByText("A senha deve ter pelo menos 6 caracteres."),
    ).toBeInTheDocument();
    expect(api.updateUserPassword).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "Trocar Senha" }),
    ).toBeInTheDocument();
  });

  it("recusa senha curta, e a mensagem é a mesma da criação", async () => {
    const digitar = userEvent.setup();
    await montar();
    await digitar.click(acao("maria", "Trocar senha"));
    const [nova, repita] = camposDeSenha();
    await digitar.type(nova, "12345");
    await digitar.type(repita, "12345");
    await digitar.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(
      await screen.findByText("A senha deve ter pelo menos 6 caracteres."),
    ).toBeInTheDocument();
    expect(api.updateUserPassword).not.toHaveBeenCalled();
  });

  it("a senha de um usuário não sobrevive para o formulário de outro", async () => {
    // ANTES: o diálogo era `if (!isOpen) return null`, nunca desmontava, e o
    // estado dele atravessava o fechamento. A asserção era que os campos
    // voltavam com ["senha-da-maria", "senha-da-maria"] ao abrir para o
    // joao, e que um Confirmar distraído mandava a senha da maria para o id
    // 9 — `toHaveBeenCalledWith(9, "senha-da-maria")`.
    // AGORA: a tela monta o diálogo só enquanto ele está aberto, então
    // fechar destrói o estado. Os campos voltam vazios e o Confirmar seco
    // esbarra na validação em vez de gravar a senha do outro.
    const digitar = userEvent.setup();
    await montar();
    await digitar.click(acao("maria", "Trocar senha"));
    const [nova, repita] = camposDeSenha();
    await digitar.type(nova, "senha-da-maria");
    await digitar.type(repita, "senha-da-maria");
    await digitar.click(screen.getByRole("button", { name: "Cancelar" }));

    await digitar.click(acao("joao", "Trocar senha"));
    expect(camposDeSenha().map((c) => c.value)).toEqual(["", ""]);

    await digitar.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(api.updateUserPassword).not.toHaveBeenCalled();
  });

  it("o diálogo diz de quem é a senha que está sendo trocada", async () => {
    // O nome no corpo é a segunda trava do mesmo defeito: mesmo que os
    // campos voltassem sujos, dá para ver de quem é o formulário.
    await montar();
    await userEvent.setup().click(acao("joao", "Trocar senha"));

    const caixa = modal("Trocar Senha");
    expect(within(caixa).getByText("joao")).toBeInTheDocument();
  });

  it("com a requisição em voo, o diálogo continua aberto", async () => {
    // ANTES: o diálogo chamava `onClose()` na mesma linha do `onConfirm()`,
    // então sumia assim que se clicava em Confirmar, com a requisição ainda
    // em voo — a asserção era justamente que o título NÃO estava mais no
    // documento.
    // AGORA: ele espera. Enquanto a promessa não resolve, o diálogo fica na
    // tela, para a pessoa não ir embora achando que gravou.
    const digitar = userEvent.setup();
    api.updateUserPassword.mockReturnValue(new Promise(() => {}));
    await montar();
    await digitar.click(acao("maria", "Trocar senha"));
    const [nova, repita] = camposDeSenha();
    await digitar.type(nova, "outrasenha");
    await digitar.type(repita, "outrasenha");
    await digitar.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(api.updateUserPassword).toHaveBeenCalledWith(7, "outrasenha");
    expect(
      screen.getByRole("heading", { name: "Trocar Senha" }),
    ).toBeInTheDocument();
  });

  it("a API recusando, o motivo aparece no diálogo e ele não fecha", async () => {
    // Este teste NÃO existia: sem `try/catch` no `handleTrocarSenha`, a
    // promessa rejeitada virava "unhandled rejection" e derrubava a suíte
    // inteira — não dava para escrever o caminho de falha.
    const digitar = userEvent.setup();
    api.updateUserPassword.mockRejectedValue(erroApi("Senha igual à anterior"));
    await montar();
    await digitar.click(acao("maria", "Trocar senha"));
    const [nova, repita] = camposDeSenha();
    await digitar.type(nova, "outrasenha");
    await digitar.type(repita, "outrasenha");
    await digitar.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(
      await screen.findByText("Senha igual à anterior"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Trocar Senha" }),
    ).toBeInTheDocument();
    // O que foi digitado continua ali — a pessoa corrige, não redigita tudo.
    expect(camposDeSenha().map((c) => c.value)).toEqual([
      "outrasenha",
      "outrasenha",
    ]);
  });

  it("sem detail na resposta, cai na mensagem genérica da troca de senha", async () => {
    const digitar = userEvent.setup();
    api.updateUserPassword.mockRejectedValue(new Error("Network Error"));
    await montar();
    await digitar.click(acao("maria", "Trocar senha"));
    const [nova, repita] = camposDeSenha();
    await digitar.type(nova, "outrasenha");
    await digitar.type(repita, "outrasenha");
    await digitar.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(
      await screen.findByText("Erro ao trocar a senha."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Trocar Senha" }),
    ).toBeInTheDocument();
  });

  it("depois de uma falha, o Confirmar volta a funcionar", async () => {
    const digitar = userEvent.setup();
    api.updateUserPassword.mockRejectedValueOnce(new Error("Network Error"));
    await montar();
    await digitar.click(acao("maria", "Trocar senha"));
    const [nova, repita] = camposDeSenha();
    await digitar.type(nova, "outrasenha");
    await digitar.type(repita, "outrasenha");
    await digitar.click(screen.getByRole("button", { name: "Confirmar" }));
    await screen.findByText("Erro ao trocar a senha.");

    await digitar.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(api.updateUserPassword).toHaveBeenCalledTimes(2);
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Trocar Senha" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("trocar senha não recarrega a lista", async () => {
    const digitar = userEvent.setup();
    await montar();
    await digitar.click(acao("maria", "Trocar senha"));
    const [nova, repita] = camposDeSenha();
    await digitar.type(nova, "outrasenha");
    await digitar.type(repita, "outrasenha");
    await digitar.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(api.updateUserPassword).toHaveBeenCalled());
    expect(api.getUsers).toHaveBeenCalledTimes(1);
  });
});

describe("Usuários — um diálogo de cada vez, e o erro é de quem o produziu", () => {
  it("abrir outro diálogo fecha o anterior — nunca dois na tela", async () => {
    // ANTES: eram quatro estados independentes e nada impedia dois modais
    // abertos ao mesmo tempo. A asserção fixava justamente isso: os dois
    // títulos no documento e a MESMA frase de erro desenhada duas vezes
    // (`getAllByText(...).toHaveLength(2)`), uma delas no modal que não
    // tinha nada com ela.
    // AGORA: a tela guarda um estado só, com o tipo dizendo qual diálogo
    // está aberto. Dois ao mesmo tempo não é mais escrevível.
    const digitar = userEvent.setup();
    await montar();
    await abrirCriar();
    await digitar.click(acao("joao", "Excluir"));

    expect(
      screen.queryByRole("heading", { name: "Novo Usuário" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Confirmar Exclusão" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("o erro de um diálogo é desenhado uma vez só, dentro dele", async () => {
    const digitar = userEvent.setup();
    await montar();
    await abrirCriar();
    await digitar.click(screen.getByRole("button", { name: "Criar Usuário" }));

    const avisos = screen.getAllByText("Informe um nome de usuário.");
    expect(avisos).toHaveLength(1);
    expect(modal("Novo Usuário").contains(avisos[0])).toBe(true);
  });

  it("o erro não atravessa para o diálogo seguinte", async () => {
    const digitar = userEvent.setup();
    await montar();
    await abrirCriar();
    await digitar.click(screen.getByRole("button", { name: "Criar Usuário" }));
    expect(screen.getByText("Informe um nome de usuário.")).toBeInTheDocument();

    await digitar.click(screen.getByRole("button", { name: "Cancelar" }));
    await digitar.click(acao("maria", "Editar"));
    expect(
      screen.queryByText("Informe um nome de usuário."),
    ).not.toBeInTheDocument();
  });

  it("erro de exclusão fica no diálogo de exclusão, e some ao abrir o de edição", async () => {
    const digitar = userEvent.setup();
    api.deleteUser.mockRejectedValue(erroApi("Usuário tem notas vinculadas"));
    await montar();
    await digitar.click(acao("joao", "Excluir"));
    await digitar.click(
      within(modal("Confirmar Exclusão")).getByRole("button", {
        name: "Excluir",
      }),
    );
    const aviso = await screen.findByText("Usuário tem notas vinculadas");
    expect(modal("Confirmar Exclusão").contains(aviso)).toBe(true);

    await digitar.click(
      within(modal("Confirmar Exclusão")).getByRole("button", {
        name: "Cancelar",
      }),
    );
    await digitar.click(acao("maria", "Editar"));
    expect(
      screen.queryByText("Usuário tem notas vinculadas"),
    ).not.toBeInTheDocument();
  });
});

/**
 * E-mail — entra agora para o futuro login via Microsoft, que vai casar a conta
 * pelo e-mail. É opcional e só o admin define (esta tela já é só de admin).
 * Vazio vira `null`: dois vazios colidiriam no índice único do backend.
 */
describe("Usuários — e-mail", () => {
  function campoDeEmail(): HTMLInputElement {
    return screen.getByLabelText("E-mail") as HTMLInputElement;
  }

  it("a coluna E-mail mostra o endereço, ou travessão quando não há", async () => {
    await montar({
      usuarios: [
        usuario({ id: 2, username: "ana", email: "ana@hs.com" }),
        usuario({ id: 3, username: "bia", email: null }),
      ],
    });

    const linhas = linhasDaTabela();
    expect(celulasDaLinha(linhas[0])[2]).toBe("ana@hs.com");
    expect(celulasDaLinha(linhas[1])[2]).toBe("—");
  });

  it("o cadastro abre com o e-mail em branco e, vazio, não manda a chave", async () => {
    const digitar = userEvent.setup();
    await montar();
    await abrirCriar();
    expect(campoDeEmail()).toHaveValue("");

    await preencherCriacao("novato", "senha123");
    await digitar.click(screen.getByRole("button", { name: "Criar Usuário" }));

    expect(api.createUser).toHaveBeenCalledWith({
      username: "novato",
      password: "senha123",
      role_name: "comum",
    });
  });

  it("o cadastro manda o e-mail sem os espaços das pontas", async () => {
    const digitar = userEvent.setup();
    await montar();
    await abrirCriar();
    await preencherCriacao("novato", "senha123");
    await digitar.type(campoDeEmail(), "  novato@hs.com  ");
    await digitar.click(screen.getByRole("button", { name: "Criar Usuário" }));

    expect(api.createUser).toHaveBeenCalledWith({
      username: "novato",
      password: "senha123",
      role_name: "comum",
      email: "novato@hs.com",
    });
  });

  it("recusa e-mail sem arroba, no cadastro e na edição", async () => {
    const digitar = userEvent.setup();
    await montar();
    await abrirCriar();
    await preencherCriacao("novato", "senha123");
    await digitar.type(campoDeEmail(), "novato");
    await digitar.click(screen.getByRole("button", { name: "Criar Usuário" }));
    expect(screen.getByText("Informe um e-mail válido.")).toBeInTheDocument();
    expect(api.createUser).not.toHaveBeenCalled();

    await digitar.click(screen.getByRole("button", { name: "Cancelar" }));
    await digitar.click(acao("maria", "Editar"));
    await digitar.type(campoDeEmail(), "maria@");
    await digitar.click(screen.getByRole("button", { name: "Salvar" }));
    expect(screen.getByText("Informe um e-mail válido.")).toBeInTheDocument();
    expect(api.updateUser).not.toHaveBeenCalled();
  });

  it("a edição abre com o e-mail atual e grava o novo", async () => {
    const digitar = userEvent.setup();
    await montar({
      usuarios: [usuario({ id: 2, username: "ana", email: "souza@hs.com" })],
    });
    await digitar.click(acao("ana", "Editar"));
    expect(campoDeEmail()).toHaveValue("souza@hs.com");

    await digitar.clear(campoDeEmail());
    await digitar.type(campoDeEmail(), "ana.souza@hs.com");
    await digitar.click(screen.getByRole("button", { name: "Salvar" }));

    expect(api.updateUser).toHaveBeenCalledWith(2, {
      username: "ana",
      role_name: "comum",
      email: "ana.souza@hs.com",
    });
  });

  it("apagar o e-mail na edição manda null, que limpa no backend", async () => {
    const digitar = userEvent.setup();
    await montar({
      usuarios: [usuario({ id: 2, username: "ana", email: "souza@hs.com" })],
    });
    await digitar.click(acao("ana", "Editar"));
    await digitar.clear(campoDeEmail());
    await digitar.click(screen.getByRole("button", { name: "Salvar" }));

    expect(api.updateUser).toHaveBeenCalledWith(2, {
      username: "ana",
      role_name: "comum",
      email: null,
    });
  });
});
