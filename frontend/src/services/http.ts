import axios, { isAxiosError, type AxiosInstance } from "axios";

/**
 * Quem quer saber que a sessão expirou — na prática, o `AuthContext`.
 *
 * Um callback registrado, e não um `navigate` daqui: `services/` é a porta de
 * rede e não conhece o router. Quem conhece a sessão é o contexto, e é ele que
 * decide o que expirar significa (limpar o `localStorage`, deixar o aviso para
 * a tela de login).
 */
let aoExpirarSessao: (() => void) | null = null;

/** Registra quem será avisado; devolve a função que desfaz o registro. */
export function registrarAoExpirarSessao(aviso: () => void): () => void {
  aoExpirarSessao = aviso;
  return () => {
    if (aoExpirarSessao === aviso) aoExpirarSessao = null;
  };
}

/**
 * Fábrica das instâncias de rede do app.
 *
 * O que se compartilha aqui é o **interceptor**, não a instância: o DataCoreHS
 * fala com dois backends distintos — a API de autenticação (`VITE_API_URL`) e
 * a API de notas (`VITE_NOTAS_URL`). Uma instância `axios` única, como o spec
 * original pedia, apontaria as chamadas de um dos dois para o endereço do
 * outro. Cada backend ganha a sua instância; a regra do token é uma só.
 */
export function criarHttp(baseURL: string): AxiosInstance {
  const http = axios.create({
    baseURL,
    // `indexes: null` -> `cliente_id=1&cliente_id=2`, e nao `cliente_id[]=1`.
    // Os dois backends sao FastAPI, e ele le lista repetindo a CHAVE: com os
    // colchetes do padrao do axios o parametro simplesmente nao chega, o filtro
    // fica valendo "sem filtro" e a tela mostra o universo inteiro como se
    // fosse o recorte pedido — sem erro nenhum, que e o pior jeito de errar.
    paramsSerializer: { indexes: null },
  });

  http.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem("access_token");
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error),
  );

  // 401 com token enviado = o token venceu (8 h) ou o usuário foi excluído.
  // Fica de fora o próprio POST /login, onde 401 é senha errada, e a chamada
  // sem token, onde não havia sessão para expirar. A promessa continua
  // rejeitando: quem chamou ainda trata o erro do seu jeito.
  http.interceptors.response.use(
    (resposta) => resposta,
    (error) => {
      if (
        isAxiosError(error) &&
        error.response?.status === 401 &&
        error.config?.url !== "/login" &&
        error.config?.headers?.Authorization
      ) {
        aoExpirarSessao?.();
      }
      return Promise.reject(error);
    },
  );

  return http;
}
