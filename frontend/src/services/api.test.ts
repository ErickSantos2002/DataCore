import axios from "axios";
import type { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import authApi, {
  URL_LOGIN_MICROSOFT,
  URL_PADRAO_DA_AUTENTICACAO,
  consumirNonceSso,
  prepararLoginMicrosoft,
  ssoAtivo,
  trocarTicket,
  updateUserPassword,
} from "./api";

/**
 * Espião de transporte instalado nos DOIS caminhos possíveis: a instância
 * `authApi` e o `axios` cru. Assim a requisição é capturada mesmo que a função
 * saia pela porta errada — é justamente isso que este teste precisa enxergar,
 * em vez de estourar num erro de rede.
 */
function espiarRequisicoes(...alvos: AxiosInstance[]) {
  const capturadas: InternalAxiosRequestConfig[] = [];
  const adaptador = async (config: InternalAxiosRequestConfig) => {
    capturadas.push(config);
    return {
      data: { ok: true },
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    };
  };
  for (const alvo of alvos) {
    alvo.defaults.adapter = adaptador;
  }
  return capturadas;
}

describe("updateUserPassword", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("manda o cabecalho Authorization ao trocar a senha", async () => {
    localStorage.setItem("access_token", "tok-abc");
    const capturadas = espiarRequisicoes(authApi, axios);

    await updateUserPassword(7, "senha-nova");

    expect(capturadas).toHaveLength(1);
    expect(capturadas[0].headers.Authorization).toBe("Bearer tok-abc");
  });

  it("chama PUT /users/:id com a senha nova no corpo", async () => {
    localStorage.setItem("access_token", "tok-abc");
    const capturadas = espiarRequisicoes(authApi, axios);

    await updateUserPassword(7, "senha-nova");

    expect(capturadas[0].method).toBe("put");
    expect(capturadas[0].url).toContain("/users/7");
    expect(JSON.parse(String(capturadas[0].data))).toEqual({
      password: "senha-nova",
    });
  });
});

describe("endereco da API de autenticacao", () => {
  it("sem VITE_API_URL, a autenticacao mora no tinyapi, em /auth", () => {
    // O authapi (banco proprio) foi aposentado no DataCoreHS: os usuarios
    // passaram para o schema auth do datacore, servidos pelo tinyapi. Os
    // caminhos (/login, /me, /users...) sao os mesmos, so muda a base.
    expect(URL_PADRAO_DA_AUTENTICACAO).toBe(
      "https://tinyapi.healthsafetytech.com/auth",
    );
  });
});

describe("login com Microsoft", () => {
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("prepararLoginMicrosoft grava um nonce e devolve a URL do botao", () => {
    expect(prepararLoginMicrosoft()).toBe(URL_LOGIN_MICROSOFT);
    expect(sessionStorage.getItem("sso_nonce")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("consumirNonceSso vale uma vez so", () => {
    prepararLoginMicrosoft();
    expect(consumirNonceSso()).toBe(true);
    expect(sessionStorage.getItem("sso_nonce")).toBeNull();
    expect(consumirNonceSso()).toBe(false);
  });

  it("consumirNonceSso sem nonce responde false", () => {
    expect(consumirNonceSso()).toBe(false);
  });

  it("com o storage bloqueado, prepara sem nonce e a volta nao passa", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    expect(prepararLoginMicrosoft()).toBe(URL_LOGIN_MICROSOFT);
    expect(consumirNonceSso()).toBe(false);
  });

  it("a URL do botao e a /microsoft da base da autenticacao", () => {
    expect(URL_LOGIN_MICROSOFT).toBe(`${authApi.defaults.baseURL}/microsoft`);
  });

  it("ssoAtivo le GET /sso/status", async () => {
    const capturadas: string[] = [];
    authApi.defaults.adapter = async (config) => {
      capturadas.push(`${config.method} ${config.url}`);
      return {
        data: { ativo: true },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };
    await expect(ssoAtivo()).resolves.toBe(true);
    expect(capturadas).toEqual(["get /sso/status"]);
  });

  it("ssoAtivo responde false quando o backend falha, sem rejeitar", async () => {
    authApi.defaults.adapter = async () => {
      throw new Error("rede caiu");
    };
    await expect(ssoAtivo()).resolves.toBe(false);
  });

  it("ssoAtivo so aceita true de verdade", async () => {
    authApi.defaults.adapter = async (config) => ({
      data: { ativo: "sim" },
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    });
    await expect(ssoAtivo()).resolves.toBe(false);
  });

  it("trocarTicket manda POST /sso/exchange e devolve o access_token", async () => {
    const capturadas: InternalAxiosRequestConfig[] = [];
    authApi.defaults.adapter = async (config) => {
      capturadas.push(config);
      return {
        data: { access_token: "tok-sso" },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };
    await expect(trocarTicket("tic-1")).resolves.toBe("tok-sso");
    expect(capturadas[0].method).toBe("post");
    expect(capturadas[0].url).toBe("/sso/exchange");
    expect(JSON.parse(String(capturadas[0].data))).toEqual({ ticket: "tic-1" });
  });
});
