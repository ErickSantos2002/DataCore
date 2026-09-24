import { describe, expect, it } from "vitest";
import { mensagemDeErroSso } from "./erroSso";

describe("mensagemDeErroSso", () => {
  it("sem codigo, sem mensagem", () => {
    expect(mensagemDeErroSso(null)).toBeNull();
    expect(mensagemDeErroSso("")).toBeNull();
  });

  it("conta sem acesso", () => {
    expect(mensagemDeErroSso("usuario_nao_encontrado")).toBe(
      "Sua conta Microsoft não tem acesso ao DataCore. Fale com o administrador.",
    );
  });

  it("cancelado", () => {
    expect(mensagemDeErroSso("cancelado")).toBe(
      "Login com Microsoft cancelado.",
    );
  });

  it.each([
    "state_invalido",
    "falha_microsoft",
    "sso_desligado",
    "codigo-que-nao-existe",
  ])("%s cai na mensagem generica", (codigo) => {
    expect(mensagemDeErroSso(codigo)).toBe(
      "Não foi possível entrar com a Microsoft. Tente de novo ou use usuário e senha.",
    );
  });
});
