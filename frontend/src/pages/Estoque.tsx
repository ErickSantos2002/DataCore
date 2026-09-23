import React, { useCallback, useMemo, useState } from "react";

import { useAuth } from "../hooks/useAuth";
import { useEstoque } from "../context/EstoqueContext";
import { usePaginacao } from "../hooks/usePaginacao";
import { diaLocal } from "../lib/datas";
import { baixarPlanilha } from "../lib/planilha";
import { Alert, Spinner } from "../design-system/ui";
import {
  avisoDePrincipaisAusentes,
  buscarEOrdenar,
  distribuicaoDeValor,
  estatisticasDoEstoque,
  filtrarProdutos,
  kpisDoEstoque,
  linhasDaPlanilha,
  opcoesDeProduto,
  proximaOrdenacao,
  rankingDoEstoque,
  situacaoDosProdutos,
  type CampoDeOrdenacao,
  type OrdenacaoDeEstoque,
} from "./estoque/estoque";
import { CabecalhoDeEstoque } from "./estoque/CabecalhoDeEstoque";
import { FiltrosDeEstoque } from "./estoque/FiltrosDeEstoque";
import { KpisDeEstoque } from "./estoque/KpisDeEstoque";
import { GraficosDeEstoque } from "./estoque/GraficosDeEstoque";
import { EstatisticasDoEstoque } from "./estoque/EstatisticasDoEstoque";
import { TabelaDeEstoque } from "./estoque/TabelaDeEstoque";

/**
 * A tela de Estoque, como casca: estado dos filtros e da tabela, os `useMemo`
 * que chamam a conta pura de `estoque/estoque.ts`, e as seis peças.
 *
 * Morreu na decomposição o código que ninguém chamava: `gerarPDF`, a lista
 * `solicitacao` e `atualizarQuantidade` — restos de quando a solicitação de
 * compras morava aqui. O PDF de verdade é gerado por `SolicitacaoComprasModal`.
 */
const Estoque: React.FC = () => {
  const { user } = useAuth();
  const { produtos, carregando, erro } = useEstoque();

  const [filtroProduto, setFiltroProduto] = useState<string[]>([]);
  const [filtroSituacao, setFiltroSituacao] = useState<string>("todos");
  const [filtroSaldo, setFiltroSaldo] = useState<string>("todos");
  const [filtroPersonalizado, setFiltroPersonalizado] =
    useState<string>("nenhum");

  const [ordenacao, setOrdenacao] = useState<OrdenacaoDeEstoque>({
    campo: "nome",
    direcao: "asc",
  });
  const [pesquisaTabela, setPesquisaTabela] = useState("");

  const opcoesDoProduto = useMemo(() => opcoesDeProduto(produtos), [produtos]);

  const produtosFiltrados = useMemo(
    () =>
      filtrarProdutos(produtos, {
        produto: filtroProduto,
        situacao: filtroSituacao,
        saldo: filtroSaldo,
        personalizado: filtroPersonalizado,
      }),
    [produtos, filtroProduto, filtroSituacao, filtroSaldo, filtroPersonalizado],
  );

  // Só com o filtro ligado: é quem está olhando os principais que precisa
  // saber que falta um.
  const avisoDePrincipais = useMemo(
    () =>
      filtroPersonalizado === "rapido"
        ? avisoDePrincipaisAusentes(produtos)
        : null,
    [produtos, filtroPersonalizado],
  );

  const kpis = useMemo(
    () => kpisDoEstoque(produtosFiltrados),
    [produtosFiltrados],
  );
  const ranking = useMemo(
    () => rankingDoEstoque(produtosFiltrados),
    [produtosFiltrados],
  );
  const distribuicao = useMemo(
    () => distribuicaoDeValor(produtosFiltrados),
    [produtosFiltrados],
  );
  const situacao = useMemo(
    () => situacaoDosProdutos(produtosFiltrados),
    [produtosFiltrados],
  );
  const estatisticas = useMemo(
    () => estatisticasDoEstoque(produtosFiltrados),
    [produtosFiltrados],
  );

  const produtosTabela = useMemo(
    () => buscarEOrdenar(produtosFiltrados, pesquisaTabela, ordenacao),
    [produtosFiltrados, pesquisaTabela, ordenacao],
  );

  // usePaginacao volta para a página 1 quando produtosTabela muda de
  // identidade (filtro, busca ou ordenação) — sem isso, quem filtrava na
  // página 2 ficava com slice fora da lista e o rodapé invertido.
  const {
    pagina: paginaAtual,
    setPagina: setPaginaAtual,
    itensDaPagina: produtosPaginados,
    total: totalDeProdutos,
  } = usePaginacao(produtosTabela, 15);

  const alternarOrdenacao = (campo: CampoDeOrdenacao) => {
    setOrdenacao((atual) => proximaOrdenacao(atual, campo));
  };

  const exportarExcel = useCallback(() => {
    baixarPlanilha(
      [{ nome: "Estoque", linhas: linhasDaPlanilha(produtosTabela) }],
      `estoque_${diaLocal(new Date())}.xlsx`,
    );
  }, [produtosTabela]);

  // Carregando era o último `dark:` da casca: `bg-gray-50` com `dark:` por cima
  // e um spinner cru com `border-blue-600`.
  if (carregando) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-base px-6 py-16 text-conteudo-muted">
        <Spinner size="lg" />
        <p>Carregando dados do estoque.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-base p-6 transition-colors">
      <CabecalhoDeEstoque usuario={user} />

      {/* Falha de rede é aviso no fluxo, e não toast: dura até recarregar. */}
      {erro ? (
        <div className="mt-6">
          <Alert variant="danger">{erro}</Alert>
        </div>
      ) : null}

      <div className="mt-6">
        <FiltrosDeEstoque
          opcoesDeProduto={opcoesDoProduto}
          valores={{
            produto: filtroProduto,
            situacao: filtroSituacao,
            saldo: filtroSaldo,
            personalizado: filtroPersonalizado,
          }}
          onProduto={setFiltroProduto}
          onSituacao={setFiltroSituacao}
          onSaldo={setFiltroSaldo}
          onPersonalizado={setFiltroPersonalizado}
        />

        {avisoDePrincipais ? (
          <div className="mb-6">
            <Alert variant="warning">{avisoDePrincipais}</Alert>
          </div>
        ) : null}

        <KpisDeEstoque kpis={kpis} />

        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <GraficosDeEstoque
            ranking={ranking}
            distribuicao={distribuicao}
            situacao={situacao}
          />
          <EstatisticasDoEstoque itens={estatisticas} />
        </div>

        <TabelaDeEstoque
          produtos={produtosPaginados}
          total={totalDeProdutos}
          pagina={paginaAtual}
          onPagina={setPaginaAtual}
          pesquisa={pesquisaTabela}
          onPesquisar={setPesquisaTabela}
          ordenacao={ordenacao}
          onOrdenar={alternarOrdenacao}
          onExportar={exportarExcel}
          catalogo={produtos}
          solicitante={user?.username || "Usuário"}
        />
      </div>
    </div>
  );
};

export default Estoque;
