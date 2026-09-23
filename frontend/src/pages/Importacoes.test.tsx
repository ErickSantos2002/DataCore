import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Importacoes from "./Importacoes";
import type { Execucao, Importacao } from "../services/operacao";
import { noFuso } from "../test/fuso";

/**
 * Caracterização da tela de Importações pelo que a pessoa vê.
 *
 * O fixture reproduz o estado real de 19/09/2026, inclusive a falha da NFS-e do
 * dia anterior — que é o caso que motivou a tela. Os números são distintos
 * campo a campo de propósito: a última duração (17,9 s) é diferente da mediana
 * (17,4 s), então trocar um pelo outro na exibição quebra o teste em vez de
 * passar por coincidência.
 */

const NOTAS: Importacao = {
  job: "extrair_notas",
  rotulo: "Notas fiscais",
  descricao: "Baixa do Tiny ERP as notas de venda emitidas.",
  fonte: "Tiny ERP",
  horarios: ["04:00", "15:00"],
  unidade_systemd: "tiny-extrator-notas.timer",
  ativo: true,
  ordem: 1,
  estado: "ok",
  mensagem: "A carga de Notas fiscais rodou normalmente.",
  ultima_execucao_id: 71,
  ultimo_inicio: "2026-09-19T04:00:06Z",
  ultimo_fim: "2026-09-19T04:03:17Z",
  ultimo_resultado: "sucesso",
  ultimos_erros: 0,
  ultimas_contagens: { criada: 4, inalterada: 50 },
  ultima_duracao_seg: 191.4,
  proxima_execucao: "2026-09-19T15:00:00Z",
  execucoes_na_media: 20,
  duracao_mediana_seg: 172.1,
  duracao_min_seg: 159.4,
  duracao_max_seg: 201.9,
  execucoes_30d: 22,
  falhas_30d: 0,
};

const NFSE: Importacao = {
  ...NOTAS,
  job: "importar_nfse",
  rotulo: "Notas de serviço",
  descricao: "Busca no ADN as notas de serviço dos últimos 30 dias.",
  fonte: "ADN (NFS-e nacional)",
  horarios: ["04:30"],
  unidade_systemd: "tiny-extrator-nfse.timer",
  ordem: 2,
  estado: "falha",
  mensagem: "A carga de Notas de serviço falhou com 1 erro(s).",
  ultima_duracao_seg: 17.9,
  duracao_mediana_seg: 17.4,
  duracao_min_seg: 12.4,
  duracao_max_seg: 31.9,
  execucoes_na_media: 8,
  execucoes_30d: 9,
  falhas_30d: 1,
};

const EXECUCOES: Execucao[] = [
  {
    id: 72,
    job: "importar_nfse",
    inicio: "2026-09-19T04:30:06Z",
    fim: "2026-09-19T04:30:23Z",
    resultado: "sucesso",
    erros: 0,
    contagens: { criada: 23, reconferida: 99 },
    detalhe: null,
    argumentos: null,
    origem: "agendada",
    duracao_seg: 17.9,
  },
  {
    id: 66,
    job: "importar_nfse",
    inicio: "2026-09-18T04:30:03Z",
    fim: "2026-09-18T04:30:34Z",
    resultado: "falha",
    erros: 1,
    contagens: {},
    detalhe: "ADN: Falha ao consultar ADN no NSU 1633 após 4 tentativas",
    argumentos: null,
    origem: "agendada",
    duracao_seg: 31.9,
  },
];

const fetchImportacoes = vi.fn();
const fetchExecucoes = vi.fn();

vi.mock("../services/operacao", () => ({
  fetchImportacoes: (...args: unknown[]) => fetchImportacoes(...args),
  fetchExecucoes: (...args: unknown[]) => fetchExecucoes(...args),
}));

beforeEach(() => {
  fetchImportacoes.mockReset();
  fetchExecucoes.mockReset();
  fetchImportacoes.mockResolvedValue([NOTAS, NFSE]);
  fetchExecucoes.mockResolvedValue({ itens: EXECUCOES, total: 2 });
});

describe("tela de Importações", () => {
  it("mostra cada carga com o estado e o horário em Brasília", async () => {
    render(<Importacoes />);

    // Por PAPEL, e não por texto: "Notas fiscais" aparece duas vezes na tela —
    // no título do cartão e como opção do filtro de importação.
    expect(
      await screen.findByRole("heading", { name: "Notas fiscais" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Notas de serviço" }),
    ).toBeInTheDocument();

    // 04:00 e 15:00 UTC são 01:00 e 12:00 aqui. Mostrar o horário cru da VPS
    // faria a tela dizer que a carga roda às quatro da manhã.
    expect(
      screen.getByText(
        `Todo dia às ${noFuso({ brasilia: "01:00 e 12:00", utc: "04:00 e 15:00" })}`,
        { exact: false },
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/04:00, 15:00 UTC/)).toBeInTheDocument();
  });

  it("avisa no topo quando há carga com problema", async () => {
    render(<Importacoes />);

    expect(
      await screen.findByText(/Uma importação está com problema/),
    ).toBeInTheDocument();
    // "Falhou" aparece no selo do cartão e nas linhas do histórico.
    expect(screen.getAllByText("Falhou").length).toBeGreaterThan(0);
  });

  it("fica calada quando está tudo em dia", async () => {
    // Tela de operação que exibe "tudo certo" todo dia treina a pessoa a não
    // olhar — quando não há problema, o topo não diz nada.
    fetchImportacoes.mockResolvedValue([NOTAS]);
    render(<Importacoes />);

    expect(
      await screen.findByRole("heading", { name: "Notas fiscais" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/está com problema/)).not.toBeInTheDocument();
    expect(screen.queryByText(/estão com problema/)).not.toBeInTheDocument();
  });

  it("mostra a mediana, e não a duração da última, como o costume", async () => {
    render(<Importacoes />);

    // 17,4 s é a mediana da NFS-e; 17,9 s foi a última. São valores diferentes
    // no fixture justamente para que a troca não passe despercebida.
    expect(
      await screen.findByText(/17 s \(mediana de 8 execuções\)/),
    ).toBeInTheDocument();
  });

  it("mostra o erro da execução que falhou, no histórico", async () => {
    render(<Importacoes />);

    // A frase que explica o problema fica na linha, não atrás de um clique:
    // é a resposta de "a importação do dia 18 funcionou?".
    expect(
      await screen.findByText(/NSU 1633 após 4 tentativas/),
    ).toBeInTheDocument();
  });

  it("agrupa o histórico por dia", async () => {
    render(<Importacoes />);

    expect(await screen.findByText("19/09/2026")).toBeInTheDocument();
    expect(screen.getByText("18/09/2026")).toBeInTheDocument();
  });

  it("mantém os cartões na tela quando o servidor cai", async () => {
    render(<Importacoes />);
    expect(
      await screen.findByRole("heading", { name: "Notas fiscais" }),
    ).toBeInTheDocument();

    // Apagar os cartões numa falha de rede esconderia justamente a carga com
    // problema que a pessoa veio ver.
    fetchImportacoes.mockRejectedValue(new Error("sem rede"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Notas fiscais" }),
      ).toBeInTheDocument();
    });
  });
});
