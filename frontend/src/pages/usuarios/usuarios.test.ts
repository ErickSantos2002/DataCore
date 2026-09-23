import { describe, expect, it } from "vitest";

import type { Papel, Usuario } from "../../services/api";
import {
  contarUsuarios,
  dataDeCriacao,
  mensagemDeErro,
  nomeDoPapel,
  opcoesDePapel,
  PAPEIS_EMBUTIDOS,
  papelInicial,
  TAMANHO_MINIMO_DA_SENHA,
  tomDoPapel,
  validarCriacao,
  validarEdicao,
  validarSenha,
} from "./usuarios";

/**
 * A regra da tela de Usuários, testada como regra.
 *
 * `Usuarios.test.tsx` já fixa o que a tela mostra e o que ela manda para a
 * API. Aqui ficam as decisões que a tela sozinha exercita mal — o perfil com
 * que cada formulário abre quando a lista de papéis é estranha, e a
 * mensagem de erro que sai de uma resposta malformada.
 */

function papeis(...nomes: string[]): Papel[] {
  return nomes.map((name, indice) => ({ id: indice + 1, name }));
}

describe("cor do selo de perfil", () => {
  it.each([
    ["admin", "info"],
    ["financeiro", "success"],
    ["servicos", "warning"],
    ["serviços", "warning"],
    ["vendas", "secondary"],
    ["comum", "secondary"],
  ])("%s pinta em %s", (papel, tom) => {
    expect(tomDoPapel(papel)).toBe(tom);
  });

  it("papel desconhecido, vazio ou ausente cai no neutro", () => {
    expect(tomDoPapel("suporte")).toBe("secondary");
    expect(tomDoPapel("")).toBe("secondary");
    expect(tomDoPapel(null)).toBe("secondary");
    expect(tomDoPapel(undefined)).toBe("secondary");
  });

  it("não se importa com a caixa das letras", () => {
    expect(tomDoPapel("ADMIN")).toBe("info");
  });
});

describe("nome do perfil na tabela", () => {
  const usuario = (role: Papel | undefined): Usuario =>
    ({ id: 1, username: "x", role, created_at: "" }) as Usuario;

  it("usa o nome que veio no papel", () => {
    expect(nomeDoPapel(usuario({ id: 1, name: "admin" }))).toBe("admin");
  });

  it("usuário sem papel vira travessão, não string vazia", () => {
    expect(nomeDoPapel(usuario(undefined))).toBe("—");
  });
});

describe("data de criação", () => {
  it("é a data de calendário, sem passar por Date", () => {
    expect(dataDeCriacao("2026-01-15T09:30:00")).toBe("15/01/2026");
    expect(dataDeCriacao("2026-01-15")).toBe("15/01/2026");
  });

  it("data que não presta vira travessão, e não 'Invalid Date'", () => {
    expect(dataDeCriacao("")).toBe("—");
    expect(dataDeCriacao(null)).toBe("—");
    expect(dataDeCriacao("ontem")).toBe("—");
  });
});

describe("perfil com que o formulário abre", () => {
  it("prefere 'comum' quando a lista tem 'comum'", () => {
    expect(papelInicial(papeis("admin", "vendas", "comum"))).toBe("comum");
    expect(papelInicial(PAPEIS_EMBUTIDOS)).toBe("comum");
  });

  it("sem 'comum' na lista, abre no primeiro perfil que existe", () => {
    // O defeito que isto fecha: antes o valor inicial era a string "comum",
    // o <select> caía no primeiro perfil da lista por não achar a opção
    // pedida, e o POST mandava "comum" mesmo assim.
    expect(papelInicial(papeis("suporte"))).toBe("suporte");
    expect(papelInicial(papeis("suporte", "auditoria"))).toBe("suporte");
  });

  it("lista vazia devolve string vazia, e não um perfil inventado", () => {
    expect(papelInicial([])).toBe("");
  });

  it("na edição, mantém o papel que o usuário já tem", () => {
    expect(papelInicial(papeis("admin", "vendas", "comum"), "vendas")).toBe(
      "vendas",
    );
  });

  it("na edição, papel fora da lista cai na mesma regra do cadastro", () => {
    expect(papelInicial(papeis("admin", "comum"), "extinto")).toBe("comum");
    expect(papelInicial(papeis("suporte"), "extinto")).toBe("suporte");
  });
});

describe("opções do select de perfil", () => {
  it("saem na ordem da API, com o nome cru nos dois lados", () => {
    expect(opcoesDePapel(papeis("suporte", "comum"))).toEqual([
      { value: "suporte", label: "suporte" },
      { value: "comum", label: "comum" },
    ]);
  });
});

describe("regra da senha", () => {
  it("o mínimo é 6, e é o mesmo número na mensagem", () => {
    expect(TAMANHO_MINIMO_DA_SENHA).toBe(6);
    expect(validarSenha("12345", "12345")).toBe(
      "A senha deve ter pelo menos 6 caracteres.",
    );
  });

  it("senha vazia é recusada — tanto na criação quanto na troca", () => {
    expect(validarSenha("", "")).toBe(
      "A senha deve ter pelo menos 6 caracteres.",
    );
    expect(
      validarCriacao({ username: "novo", senha: "", confirmacao: "" }),
    ).toBe("A senha deve ter pelo menos 6 caracteres.");
  });

  it("tamanho vem antes de conferência", () => {
    expect(validarSenha("123", "999")).toBe(
      "A senha deve ter pelo menos 6 caracteres.",
    );
  });

  it("confirmação diferente é recusada", () => {
    expect(validarSenha("senha123", "senha124")).toBe(
      "As senhas não coincidem.",
    );
  });

  it("senha boa e conferida devolve null", () => {
    expect(validarSenha("senha123", "senha123")).toBeNull();
  });
});

describe("validações do cadastro", () => {
  it("valida na ordem: nome, tamanho da senha, conferência", () => {
    expect(
      validarCriacao({ username: "  ", senha: "1", confirmacao: "9" }),
    ).toBe("Informe um nome de usuário.");
    expect(
      validarCriacao({ username: "novo", senha: "1", confirmacao: "9" }),
    ).toBe("A senha deve ter pelo menos 6 caracteres.");
    expect(
      validarCriacao({
        username: "novo",
        senha: "senha123",
        confirmacao: "senha124",
      }),
    ).toBe("As senhas não coincidem.");
    expect(
      validarCriacao({
        username: "novo",
        senha: "senha123",
        confirmacao: "senha123",
      }),
    ).toBeNull();
  });

  it("a edição só cobra o nome", () => {
    expect(validarEdicao("   ")).toBe("Informe um nome de usuário.");
    expect(validarEdicao("maria")).toBeNull();
  });
});

describe("mensagem de erro da API", () => {
  it("prefere o detail que o backend mandou", () => {
    expect(
      mensagemDeErro(
        { response: { data: { detail: "Usuário já existe" } } },
        "padrão",
      ),
    ).toBe("Usuário já existe");
  });

  it("cai no padrão quando não há detail, ou quando ele não é texto", () => {
    expect(mensagemDeErro(new Error("Network Error"), "padrão")).toBe("padrão");
    expect(mensagemDeErro(null, "padrão")).toBe("padrão");
    expect(mensagemDeErro(undefined, "padrão")).toBe("padrão");
    expect(
      mensagemDeErro(
        { response: { data: { detail: { msg: "x" } } } },
        "padrão",
      ),
    ).toBe("padrão");
    expect(
      mensagemDeErro({ response: { data: { detail: "" } } }, "padrão"),
    ).toBe("padrão");
  });
});

describe("contagem no subtítulo", () => {
  it("concorda em número", () => {
    expect(contarUsuarios(0)).toBe("0 usuários cadastrados");
    expect(contarUsuarios(1)).toBe("1 usuário cadastrado");
    expect(contarUsuarios(2)).toBe("2 usuários cadastrados");
  });
});
