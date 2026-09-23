import React, { useState, useMemo, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import { useIsMobile } from "../hooks/useIsMobile";
import {
  useFiltrosComerciais,
  useResumoComercial,
  type RecorteComercial,
} from "./comercial/useComercial";
import { Spinner } from "../design-system/ui";
import { usePaginacao } from "../hooks/usePaginacao";
import { diaLocal } from "../lib/datas";
import { baixarPlanilha } from "../lib/planilha";
import {
  rotuloDoCliente,
  rotuloDoProduto,
  indicesDeRotulo,
  recorteDeProdutos,
  produtosDoResumo,
  calcularKpis,
  evolucaoDoResumo,
  rankingPorValor,
  ordenarEBuscar,
  linhasDaPlanilha,
  type OrdenacaoDeProdutos,
} from "./produtos/produtos";
import { CabecalhoProdutos } from "./produtos/CabecalhoProdutos";
import { FiltrosDeProdutos } from "./produtos/FiltrosDeProdutos";
import { KpisDeProdutos } from "./produtos/KpisDeProdutos";
import { GraficosDeProdutos } from "./produtos/GraficosDeProdutos";
import { TabelaDeProdutos } from "./produtos/TabelaDeProdutos";
import { usePeriodo } from "../hooks/usePeriodo";

const Produtos: React.FC = () => {
  const { user } = useAuth();

  // Achado ao mover (não corrigido): nada nesta tela lê `isMobile` — o
  // docblock de `useIsMobile` já registra que `Produtos` declarava o hook e
  // nunca usava a resposta. A linha fica porque tirá-la seria corrigir, e
  // este commit só move.
  const isMobile = useIsMobile();

  // Estados dos filtros
  const [filtroEmpresa, setFiltroEmpresa] = useState<string[]>([]);
  const [filtroVendedor, setFiltroVendedor] = useState<string[]>([]);
  const [filtroProduto, setFiltroProduto] = useState<string[]>([]);
  const {
    preset: presetPeriodo,
    escolherPreset: setPresetPeriodo,
    dataInicio,
    setDataInicio,
    dataFim,
    setDataFim,
  } = usePeriodo();

  // Estados da tabela
  const [ordenacao, setOrdenacao] = useState<OrdenacaoDeProdutos>({
    campo: "quantidadeVendida",
    direcao: "desc",
  });
  const [pesquisaTabela, setPesquisaTabela] = useState("");

  const { opcoes } = useFiltrosComerciais();

  // Opções dos filtros — o rótulo é conta pura e mora em produtos.ts.
  const empresasUnicas: string[] = useMemo(
    () => opcoes.clientes.map(rotuloDoCliente),
    [opcoes.clientes],
  );
  const vendedoresUnicos = useMemo(
    () => opcoes.vendedores,
    [opcoes.vendedores],
  );
  const produtosUnicos = useMemo(
    () => opcoes.produtos.map(rotuloDoProduto),
    [opcoes.produtos],
  );

  const opcoesDosFiltros = useMemo(
    () => ({
      empresas: empresasUnicas,
      vendedores: vendedoresUnicos,
      produtos: produtosUnicos,
    }),
    [empresasUnicas, vendedoresUnicos, produtosUnicos],
  );

  // O caminho de volta: do rótulo que a pessoa escolheu para o id/chave que o
  // servidor filtra.
  const indices = useMemo(() => indicesDeRotulo(opcoes), [opcoes]);

  const recorte: RecorteComercial = useMemo(
    () =>
      recorteDeProdutos(
        {
          empresa: filtroEmpresa,
          vendedor: filtroVendedor,
          produto: filtroProduto,
          dataInicio,
          dataFim,
        },
        indices,
      ),
    [
      filtroEmpresa,
      filtroVendedor,
      filtroProduto,
      dataInicio,
      dataFim,
      indices,
    ],
  );

  const { resumo, carregando } = useResumoComercial(recorte);

  // A tabela desta tela é a lista de PRODUTOS agregados — hoje 127 linhas —, e
  // não a de notas. Ela continua paginando no navegador de propósito: paginar
  // no servidor só é necessário quando o que se pagina cresce com o histórico,
  // e este agregado cresce com o catálogo. E, ao contrário do que acontecia
  // antes, a lista aqui é COMPLETA: cada linha já é a soma do recorte inteiro,
  // então a página nunca é confundida com o total.
  //
  // ⚠️ A agregação passou a incluir item SEM código (36 itens, 0,12% do valor),
  // que a versão anterior descartava com um `if (!item.codigo) return`.
  const produtosAgregados = useMemo(
    () => produtosDoResumo(resumo.por_produto),
    [resumo.por_produto],
  );

  // KPIs Calculados
  const kpis = useMemo(
    () => calcularKpis(produtosAgregados),
    [produtosAgregados],
  );

  // Evolução: itens vendidos por mês. A quantidade vem do banco já com o filtro
  // de produto aplicado no nível do ITEM — que é a distinção que esta tela faz
  // e a de Vendas não: lá o filtro escolhe notas, aqui ele escolhe itens.
  const dadosEvolucao = useMemo(
    () => evolucaoDoResumo(resumo.evolucao_mensal),
    [resumo.evolucao_mensal],
  );

  // Ranking de produtos por valor (top 10) — a conta pura devolve
  // `ProdutoAgregado[]`; é o `GraficosDeProdutos` que converte para a forma
  // que o `BarChart` espera.
  const rankingProdutosValor = useMemo(
    () => rankingPorValor(produtosAgregados, 10),
    [produtosAgregados],
  );

  // Tabela com pesquisa e ordenação
  const produtosTabela = useMemo(
    () => ordenarEBuscar(produtosAgregados, pesquisaTabela, ordenacao),
    [produtosAgregados, pesquisaTabela, ordenacao],
  );

  // Paginacao: usePaginacao volta para a pagina 1 quando produtosTabela muda
  // de identidade (filtro, busca ou ordenacao) — sem isso, quem filtrava na
  // pagina 7 ficava com slice fora da lista e o rodape invertido.
  const {
    pagina: paginaAtual,
    setPagina: setPaginaAtual,
    itensDaPagina: produtosPaginados,
    total: totalDeProdutos,
  } = usePaginacao(produtosTabela, 15);

  // Função para alternar ordenação
  const alternarOrdenacao = (campo: string) => {
    setOrdenacao((prev) => ({
      campo,
      direcao: prev.campo === campo && prev.direcao === "desc" ? "asc" : "desc",
    }));
  };

  // Exportação para Excel — a modelagem da linha mora em produtos.ts.
  const exportarExcel = useCallback(() => {
    baixarPlanilha(
      [{ nome: "Produtos", linhas: linhasDaPlanilha(produtosTabela) }],
      `produtos_${diaLocal(new Date())}.xlsx`,
    );
  }, [produtosTabela]);

  if (carregando) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-base px-6 py-16 text-conteudo-muted md:h-full md:min-h-0">
        <Spinner size="lg" />
        <p>Carregando dados de produtos.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-base p-6 transition-colors md:h-full md:min-h-0">
      {/* Cabeçalho */}
      <CabecalhoProdutos usuario={user} />

      <div className="mt-6 overflow-x-hidden">
        {/* Filtros */}
        <FiltrosDeProdutos
          opcoes={opcoesDosFiltros}
          valores={{
            empresa: filtroEmpresa,
            vendedor: filtroVendedor,
            produto: filtroProduto,
            presetPeriodo,
            dataInicio,
            dataFim,
          }}
          onEmpresa={setFiltroEmpresa}
          onVendedor={setFiltroVendedor}
          onProduto={setFiltroProduto}
          onPreset={setPresetPeriodo}
          onDataInicio={(data) => {
            setDataInicio(data);
            setPresetPeriodo("custom");
          }}
          onDataFim={(data) => {
            setDataFim(data);
            setPresetPeriodo("custom");
          }}
        />

        {/* KPIs */}
        <KpisDeProdutos kpis={kpis} />

        {/* Gráficos */}
        <GraficosDeProdutos
          evolucao={dadosEvolucao}
          ranking={rankingProdutosValor}
        />

        {/* Tabela de Produtos */}
        <TabelaDeProdutos
          produtos={produtosPaginados}
          total={totalDeProdutos}
          pagina={paginaAtual}
          onPagina={setPaginaAtual}
          pesquisa={pesquisaTabela}
          onPesquisar={setPesquisaTabela}
          ordenacao={ordenacao}
          onOrdenar={alternarOrdenacao}
          onExportar={exportarExcel}
        />
      </div>
    </div>
  );
};

export default Produtos;
