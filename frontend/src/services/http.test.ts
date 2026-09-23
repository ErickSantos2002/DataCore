import { AxiosError } from "axios";
import type { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarHttp, registrarAoExpirarSessao } from "./http";

/**
 * Troca o transporte da instância por um espião: nenhuma requisição sai da
 * máquina, e o que sobra é exatamente a config que o interceptor montou.
 */
function espiarRequisicoes(http: AxiosInstance) {
  const capturadas: InternalAxiosRequestConfig[] = [];
  http.defaults.adapter = async (config) => {
    capturadas.push(config);
    return {
      data: null,
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    };
  };
  return capturadas;
}

describe("criarHttp", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("usa a baseURL que recebeu", () => {
    const http = criarHttp("https://exemplo.test");
    expect(http.defaults.baseURL).toBe("https://exemplo.test");
  });

  it("manda Authorization: Bearer <token> quando ha token guardado", async () => {
    localStorage.setItem("access_token", "tok-123");
    const http = criarHttp("https://exemplo.test");
    const capturadas = espiarRequisicoes(http);

    await http.get("/qualquer");

    expect(capturadas).toHaveLength(1);
    expect(capturadas[0].headers.Authorization).toBe("Bearer tok-123");
  });

  it("nao manda cabecalho de autenticacao quando nao ha token", async () => {
    const http = criarHttp("https://exemplo.test");
    const capturadas = espiarRequisicoes(http);

    await http.get("/qualquer");

    expect(capturadas).toHaveLength(1);
    expect(capturadas[0].headers.Authorization).toBeUndefined();
  });

  it("cria instancias independentes, uma por backend", () => {
    // O spec pedia "uma instância única"; sao dois backends distintos, e uma
    // instância só apontaria as chamadas de notas para a API de auth.
    const auth = criarHttp("https://authapi.test");
    const notas = criarHttp("https://tinyapi.test");

    expect(auth).not.toBe(notas);
    expect(auth.defaults.baseURL).toBe("https://authapi.test");
    expect(notas.defaults.baseURL).toBe("https://tinyapi.test");
  });
});

/**
 * Transporte que responde sempre com o `status` dado. Acima de 2xx a promessa
 * rejeita com um `AxiosError` de verdade, como o adaptador do navegador faria.
 */
function responderCom(http: AxiosInstance, status: number) {
  http.defaults.adapter = async (config) => {
    const resposta = {
      data: { detail: "x" },
      status,
      statusText: String(status),
      headers: {},
      config,
    };
    if (status >= 300) {
      throw new AxiosError(
        `status ${status}`,
        "ERR_BAD_RESPONSE",
        config,
        null,
        resposta,
      );
    }
    return resposta;
  };
}

/**
 * Sessão expirada.
 *
 * O token do tinyapi vence em 8 h. Enquanto o tinyapi ignorava o token, token
 * vencido não fazia diferença nenhuma; com AUTH_OBRIGATORIA ligada, toda
 * chamada volta 401 e, sem isto, a pessoa ficaria "logada" diante de telas de
 * erro até achar o botão Sair.
 */
describe("aviso de sessao expirada", () => {
  let cancelar: () => void = () => {};

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cancelar();
    localStorage.clear();
  });

  it("401 numa chamada com token avisa quem registrou", async () => {
    const aviso = vi.fn();
    cancelar = registrarAoExpirarSessao(aviso);
    localStorage.setItem("access_token", "tok-velho");
    const http = criarHttp("https://exemplo.test");
    responderCom(http, 401);

    await expect(http.get("/notas_fiscais/")).rejects.toBeInstanceOf(
      AxiosError,
    );
    expect(aviso).toHaveBeenCalledTimes(1);
  });

  it("401 do proprio POST /login e senha errada, nao sessao expirada", async () => {
    const aviso = vi.fn();
    cancelar = registrarAoExpirarSessao(aviso);
    localStorage.setItem("access_token", "tok-velho");
    const http = criarHttp("https://exemplo.test");
    responderCom(http, 401);

    await expect(http.post("/login", {})).rejects.toBeInstanceOf(AxiosError);
    expect(aviso).not.toHaveBeenCalled();
  });

  it("401 de chamada sem token nao avisa: nao havia sessao para expirar", async () => {
    const aviso = vi.fn();
    cancelar = registrarAoExpirarSessao(aviso);
    const http = criarHttp("https://exemplo.test");
    responderCom(http, 401);

    await expect(http.get("/qualquer")).rejects.toBeInstanceOf(AxiosError);
    expect(aviso).not.toHaveBeenCalled();
  });

  it.each([403, 404, 500])(
    "status %i nao e sessao expirada",
    async (status) => {
      const aviso = vi.fn();
      cancelar = registrarAoExpirarSessao(aviso);
      localStorage.setItem("access_token", "tok-valido");
      const http = criarHttp("https://exemplo.test");
      responderCom(http, status);

      await expect(http.get("/qualquer")).rejects.toBeInstanceOf(AxiosError);
      expect(aviso).not.toHaveBeenCalled();
    },
  );

  it("depois de cancelar o registro, o aviso para de chegar", async () => {
    const aviso = vi.fn();
    registrarAoExpirarSessao(aviso)();
    localStorage.setItem("access_token", "tok-velho");
    const http = criarHttp("https://exemplo.test");
    responderCom(http, 401);

    await expect(http.get("/qualquer")).rejects.toBeInstanceOf(AxiosError);
    expect(aviso).not.toHaveBeenCalled();
  });
});
