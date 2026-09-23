import { useCallback, useMemo, useState } from "react";

import { Alert, Spinner } from "../../design-system/ui";
import { useAuth } from "../../hooks/useAuth";
import { baixarPlanilha } from "../../lib/planilha";
import { CabecalhoContas } from "./CabecalhoContas";
import { FiltrosDeContas } from "./FiltrosDeContas";
import { GraficosDeContas } from "./GraficosDeContas";
import { KpisDeContas } from "./KpisDeContas";
import { TabelaDeContas } from "./TabelaDeContas";
import type { TipoDeContas } from "../../services/notasapi";
import {
  ORDENACAO_INICIAL,
  linhasDaPlanilha,
  montarCategorias,
  montarContrapartes,
  montarEvolucao,
  nomeDoArquivo,
  periodoDaBarra,
  proximaOrdenacao,
  type ContaBase,
  type DialetoDeContas,
  type FormatoDaPlanilha,
} from "./contas";
import {
  todasAsContas,
  usePaginaDeContas,
  useResumoDeContas,
} from "./useContas";
import { usePeriodo } from "../../hooks/usePeriodo";

/**
 * Tudo o que difere entre Contas a Receber e Contas a Pagar, num objeto só.
 *
 * A régua para uma entrada existir aqui é uma só: ela tem de ser divergência
 * de DOMÍNIO — o que conta como quitado, qual campo de data é a emissão, e o
 * vocabulário do negócio (cliente ou fornecedor, receber ou pagar). Não há
 * segunda categoria. O que divergia por descuido — a ordem das colunas, as
 * colunas da planilha, a mensagem de lista vazia, o texto do selo, o CPF/CNPJ
 * na célula, além de cor de KPI, cor de barra, moldura de card e paginação —
 * não tem entrada nenhuma: virou código igual para as duas.
 */
export interface ConfiguracaoDeContas {
  titulo: string;
  descricao: string;
  mensagemDeCarregamento: string;
  /** "Cliente" ou "Fornecedor" — o rótulo do filtro. */
  rotuloDaContraparte: string;
  rotuloDoAberto: string;
  rotuloDoQuitado: string;
  tituloDaTabela: string;
  tituloDasContrapartes: string;
  legendaQuitado: string;
  legendaAberto: string;
  tomDoAberto: "acao" | "perigo";
  dialeto: DialetoDeContas;
  planilha: FormatoDaPlanilha<ContaBase>;
}

export interface TelaDeContasProps {
  /** Qual das duas: decide o endpoint e o dialeto do banco. */
  tipo: TipoDeContas;
  configuracao: ConfiguracaoDeContas;
}

/**
 * O esqueleto das duas telas de Contas.
 *
 * Guarda o que a pessoa escolheu — os cinco filtros, o preset de período, a
 * busca, a página e a ordenação — e entrega o recorte pronto para o
 * cabeçalho, a faixa de KPIs, os três gráficos e a tabela. As contas moram em
 * `contas.ts`; o desenho, nos componentes ao lado.
 *
 * A ordem das camadas importa e é a de hoje:
 *
 *  1. os filtros do topo recortam a base — e é desse recorte que saem os KPIs
 *     e os três gráficos;
 *  2. a busca da tabela recorta de novo, só para a tabela e para a planilha.
 *
 * Por isso digitar na busca muda a tabela e não mexe nos números do topo.
 */
export function TelaDeContas({ tipo, configuracao }: TelaDeContasProps) {
  const { user } = useAuth();
  const { dialeto } = configuracao;

  const [filtroSituacao, setFiltroSituacao] = useState<string[]>([]);
  const [filtroCategoria, setFiltroCategoria] = useState<string[]>([]);
  const [filtroContraparte, setFiltroContraparte] = useState<string[]>([]);
  const {
    preset,
    escolherPreset: setPreset,
    dataInicio,
    setDataInicio,
    dataFim,
    setDataFim,
  } = usePeriodo();
  const [pesquisa, setPesquisa] = useState("");
  const [pagina, setPagina] = useState(1);
  const [ordenacao, setOrdenacao] = useState(ORDENACAO_INICIAL);

  const filtros = useMemo(
    () => ({
      situacao: filtroSituacao,
      categoria: filtroCategoria,
      contraparte: filtroContraparte,
      dataInicio,
      dataFim,
    }),
    [filtroSituacao, filtroCategoria, filtroContraparte, dataInicio, dataFim],
  );

  // Os KPIs e os três gráficos, somados pelo banco sobre o recorte inteiro.
  const { resumo, carregando, erro } = useResumoDeContas(tipo, filtros);

  // A tabela é uma consulta à parte porque tem um filtro a mais — a busca — e
  // porque muda de página sem que os números do topo mudem. É essa separação
  // que faz digitar na busca não mexer nos KPIs, como sempre foi.
  const { pagina: paginaDaTabela, erro: erroDaTabela } = usePaginaDeContas(
    tipo,
    filtros,
    pesquisa,
    ordenacao,
    pagina,
  );

  // As opções saem da base INTEIRA, e não do que sobrou dos outros filtros:
  // assim a lista não encolhe embaixo do dedo de quem está escolhendo. Quem
  // garante isso agora é o banco — as três consultas de opção ignoram o
  // recorte de propósito.
  const opcoes = resumo.opcoes;

  const kpis = useMemo(
    () => ({
      totalAberto: resumo.kpis.total_aberto,
      totalQuitado: resumo.kpis.total_quitado,
      contasVencidas: resumo.kpis.contas_vencidas,
      aVencer30: resumo.kpis.a_vencer_30,
      mediaMensal: resumo.kpis.media_mensal,
    }),
    [resumo.kpis],
  );

  const evolucao = useMemo(
    () => montarEvolucao(resumo.por_ano, resumo.por_mes, dialeto, new Date()),
    [resumo.por_ano, resumo.por_mes, dialeto],
  );
  const categorias = useMemo(
    () => montarCategorias(resumo.por_categoria),
    [resumo.por_categoria],
  );
  const contrapartes = useMemo(
    () => montarContrapartes(resumo.por_contraparte),
    [resumo.por_contraparte],
  );

  const daPagina = paginaDaTabela.itens;

  const aoClicarNaEvolucao = useCallback(
    (estado: { activeLabel?: string }) => {
      const periodo = periodoDaBarra(
        estado?.activeLabel,
        evolucao.modo,
        evolucao.ano,
      );
      if (!periodo) return;
      setDataInicio(periodo.inicio);
      setDataFim(periodo.fim);
      // O seletor passa a "Personalizado", que não mexe nas datas: senão
      // ficaria mostrando o preset anterior ao lado do período clicado.
      setPreset("custom");
      setPagina(1);
    },
    [evolucao.modo, evolucao.ano, setDataInicio, setDataFim, setPreset],
  );

  // A planilha leva o recorte INTEIRO, e não a página visível — exportar o que
  // está na tela seria o mesmo erro de ler a primeira página como se fosse o
  // total, num arquivo que alguém manda por e-mail.
  const exportar = useCallback(async () => {
    try {
      const linhas = linhasDaPlanilha(
        await todasAsContas(tipo, filtros, pesquisa, ordenacao),
        configuracao.planilha,
      );
      baixarPlanilha(
        [{ nome: configuracao.planilha.aba, linhas }],
        nomeDoArquivo(configuracao.planilha.prefixoDoArquivo, new Date()),
      );
    } catch (falha) {
      console.error("Erro ao exportar as contas:", falha);
    }
  }, [tipo, filtros, pesquisa, ordenacao, configuracao.planilha]);

  if (carregando) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-base px-6 py-16 text-conteudo-muted md:h-full md:min-h-0">
        <Spinner size="lg" />
        <p>{configuracao.mensagemDeCarregamento}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-base p-6 transition-colors md:h-full md:min-h-0">
      <div className="flex flex-col gap-6">
        <CabecalhoContas
          titulo={configuracao.titulo}
          descricao={configuracao.descricao}
          usuario={user}
        />

        {/*
          Falha de busca é AVISO EM BLOCO, e não toast. A tela abria zerada e
          quem usava não distinguia "a API caiu" de "não há conta nenhuma"
          (defeito 1.10). O estado é permanente até recarregar, então o aviso
          tem de ficar na tela — um toast some em 4 segundos e quem desviou o
          olhar volta para uma tela vazia sem explicação. É o mesmo padrão que
          a tela de Locação já usa, e o que o `Alert` do design system diz de
          si: "erro de carregamento (...) não empilhe com <Toast> para o mesmo
          evento". O `role="alert"` do primitivo anuncia sozinho.
        */}
        {erro || erroDaTabela ? (
          <Alert variant="danger">{erro ?? erroDaTabela}</Alert>
        ) : null}

        <FiltrosDeContas
          rotuloDaContraparte={configuracao.rotuloDaContraparte}
          opcoes={opcoes}
          valores={filtros}
          preset={preset}
          onSituacao={(valores) => {
            setFiltroSituacao(valores);
            setPagina(1);
          }}
          onCategoria={(valores) => {
            setFiltroCategoria(valores);
            setPagina(1);
          }}
          onContraparte={(valores) => {
            setFiltroContraparte(valores);
            setPagina(1);
          }}
          onPreset={(valor) => {
            setPreset(valor);
            setPagina(1);
          }}
          onDataInicio={(valor) => {
            setDataInicio(valor);
            setPreset("custom");
            setPagina(1);
          }}
          onDataFim={(valor) => {
            setDataFim(valor);
            setPreset("custom");
            setPagina(1);
          }}
        />

        <KpisDeContas
          kpis={kpis}
          rotuloDoAberto={configuracao.rotuloDoAberto}
          rotuloDoQuitado={configuracao.rotuloDoQuitado}
        />

        <GraficosDeContas
          evolucao={evolucao}
          categorias={categorias}
          contrapartes={contrapartes}
          chaveQuitado={dialeto.chaveQuitado}
          legendaQuitado={configuracao.legendaQuitado}
          legendaAberto={configuracao.legendaAberto}
          tomDoAberto={configuracao.tomDoAberto}
          tituloDasContrapartes={configuracao.tituloDasContrapartes}
          onClicarNaEvolucao={aoClicarNaEvolucao}
        />

        <TabelaDeContas
          titulo={configuracao.tituloDaTabela}
          rotuloDaContraparte={configuracao.rotuloDaContraparte}
          dialeto={dialeto}
          contas={daPagina}
          total={paginaDaTabela.total}
          pagina={pagina}
          onPagina={setPagina}
          pesquisa={pesquisa}
          onPesquisar={(termo) => {
            setPesquisa(termo);
            setPagina(1);
          }}
          ordenacao={ordenacao}
          onOrdenar={(campo) => {
            setOrdenacao((atual) => proximaOrdenacao(atual, campo));
            // Como todo handler que muda a lista: reordenar na página 2
            // deixava a pessoa na página 2 de uma lista que já não é a mesma
            // (defeito 1.13). A ordenação era o único que não voltava.
            setPagina(1);
          }}
          onExportar={exportar}
        />
      </div>
    </div>
  );
}
