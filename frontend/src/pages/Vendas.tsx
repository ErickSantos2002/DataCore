import React, { useCallback, useMemo, useState } from "react";

import { useAuth } from "../hooks/useAuth";
import { useToast } from "../components/ToastProvider";
import { diaLocal } from "../lib/datas";
import { baixarPlanilha } from "../lib/planilha";
import { fetchVendas, type NotaVenda } from "../services/notasapi";
import { Alert, Spinner } from "../design-system/ui";
import {
  paramsDoRecorte,
  useFiltrosComerciais,
  useResumoComercial,
  useVendasPaginadas,
  type CampoDeOrdenacao,
} from "./comercial/useComercial";
import {
  chavePorRotulo,
  comparativoMensal,
  distribuicaoDeEmpresas,
  evolucaoDoResumo,
  evolucaoEhAnual,
  intervaloDeComparacao,
  idPorRotulo,
  kpisDoResumo,
  linhasDaPlanilha,
  performanceDeVendas,
  proximaOrdenacao,
  rankingDeProdutos,
  rankingDeVendedores,
  recorteDosFiltros,
  resumoDoPeriodo,
  rotuloDoCliente,
  rotuloDoProduto,
  type OrdenacaoDeVendas,
} from "./vendas/vendas";
import { useBaseDoComparativo } from "./vendas/useBaseDoComparativo";
import { CabecalhoDeVendas } from "./vendas/CabecalhoDeVendas";
import { FiltrosDeVendas } from "./vendas/FiltrosDeVendas";
import { KpisDeVendas } from "./vendas/KpisDeVendas";
import { GraficosDeVendas } from "./vendas/GraficosDeVendas";
import { TabelaDeVendas } from "./vendas/TabelaDeVendas";
import { EstatisticasDeVendas } from "./vendas/EstatisticasDeVendas";
import { usePeriodo } from "../hooks/usePeriodo";
import { usePaginaDoRecorte } from "../hooks/usePaginaDoRecorte";

/**
 * A tela de Vendas, como casca: estado dos filtros e da tabela, os `useMemo`
 * que chamam a conta pura de `vendas/vendas.ts`, a exportação e as seis peças.
 */
const Vendas: React.FC = () => {
  const { user } = useAuth();
  const { erro: avisarErro } = useToast();

  // Os filtros guardam o RÓTULO que o multiselect mostra; o id do cliente e a
  // chave do produto saem dos mapas montados a partir das opções.
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

  const [ordenacao, setOrdenacao] = useState<OrdenacaoDeVendas>({
    campo: "data_emissao",
    direcao: "desc",
  });
  const [pesquisaTabela, setPesquisaTabela] = useState("");

  // As opções dos multiselects vêm do banco, e não de percorrer as notas: era
  // por causa delas (e das agregações) que a tela baixava o histórico inteiro.
  const { opcoes } = useFiltrosComerciais();

  const empresasUnicas = useMemo(
    () => opcoes.clientes.map(rotuloDoCliente),
    [opcoes.clientes],
  );
  const produtosUnicos = useMemo(
    () => opcoes.produtos.map(rotuloDoProduto),
    [opcoes.produtos],
  );
  const idDoRotulo = useMemo(
    () => idPorRotulo(opcoes.clientes),
    [opcoes.clientes],
  );
  const chaveDoRotulo = useMemo(
    () => chavePorRotulo(opcoes.produtos),
    [opcoes.produtos],
  );

  const recorte = useMemo(
    () =>
      recorteDosFiltros(
        {
          empresa: filtroEmpresa,
          vendedor: filtroVendedor,
          produto: filtroProduto,
          dataInicio,
          dataFim,
        },
        idDoRotulo,
        chaveDoRotulo,
      ),
    [
      filtroEmpresa,
      filtroVendedor,
      filtroProduto,
      dataInicio,
      dataFim,
      idDoRotulo,
      chaveDoRotulo,
    ],
  );

  const {
    resumo,
    carregando,
    atualizando,
    erro: erroDoResumo,
  } = useResumoComercial(recorte);

  // Voltar para a página 1 quando o recorte muda: quem estava na página 12 de
  // um filtro amplo ficaria olhando uma página vazia depois de estreitá-lo.
  const chaveDoRecorte =
    JSON.stringify(recorte) + pesquisaTabela + JSON.stringify(ordenacao);
  const [paginaAtual, setPaginaAtual] = usePaginaDoRecorte(chaveDoRecorte);

  const { pagina, erro: erroDaTabela } = useVendasPaginadas(recorte, {
    busca: pesquisaTabela,
    ordenarPor: ordenacao.campo,
    direcao: ordenacao.direcao,
    pagina: paginaAtual,
    porPagina: 15,
  });

  const kpis = useMemo(() => kpisDoResumo(resumo), [resumo]);
  const evolucao = useMemo(
    () => evolucaoDoResumo(resumo.evolucao_mensal),
    [resumo.evolucao_mensal],
  );
  const rankingProdutos = useMemo(
    () => rankingDeProdutos(resumo.por_produto),
    [resumo.por_produto],
  );
  const rankingVendedores = useMemo(
    () => rankingDeVendedores(resumo.por_vendedor),
    [resumo.por_vendedor],
  );
  const distribuicaoEmpresas = useMemo(
    () => distribuicaoDeEmpresas(resumo.por_cliente),
    [resumo.por_cliente],
  );
  const resumoDoPeriodoItens = useMemo(() => resumoDoPeriodo(resumo), [resumo]);
  // Com o último período aberto, a variação compara o MESMO intervalo do
  // período anterior, numa segunda busca — ver `intervaloDeComparacao`.
  // Enquanto o resumo do recorte novo não chega (`atualizando`), a evolução na
  // tela ainda é a do recorte anterior: o intervalo sairia de um e as datas do
  // outro. Nem busca nem compara — a variação fica em traço até assentar.
  const intervalo = useMemo(
    () =>
      atualizando
        ? null
        : intervaloDeComparacao(resumo.evolucao_mensal, recorte, new Date()),
    [atualizando, resumo.evolucao_mensal, recorte],
  );
  const baseAnterior = useBaseDoComparativo(recorte, intervalo);
  const comparativo = useMemo(
    () =>
      comparativoMensal(
        evolucao,
        // Atualizando: sem base, traço. Aberto: a base buscada. Fechado: a
        // conta de sempre, contra o penúltimo ponto.
        atualizando
          ? { base: null }
          : intervalo
            ? { base: baseAnterior }
            : undefined,
      ),
    [evolucao, atualizando, intervalo, baseAnterior],
  );
  const performance = useMemo(() => performanceDeVendas(resumo), [resumo]);

  const alternarOrdenacao = (campo: CampoDeOrdenacao) => {
    setOrdenacao((atual) => proximaOrdenacao(atual, campo));
  };

  // Exportação: percorre as páginas até o fim, em vez de exportar o que está
  // na tela — exportar só a página visível seria o mesmo erro de ler a
  // primeira página como se fosse o total, só que num arquivo que alguém manda
  // por e-mail.
  const [exportando, setExportando] = useState(false);

  const exportarExcel = useCallback(async () => {
    setExportando(true);
    try {
      const porPagina = 500;
      const todas: NotaVenda[] = [];
      let offset = 0;
      for (;;) {
        const resposta = await fetchVendas({
          ...paramsDoRecorte(recorte),
          busca: pesquisaTabela.trim() || undefined,
          ordenar_por: ordenacao.campo,
          direcao: ordenacao.direcao,
          limite: porPagina,
          offset,
        });
        todas.push(...resposta.itens);
        offset += porPagina;
        if (offset >= resposta.total) break;
      }

      baixarPlanilha(
        [{ nome: "Vendas", linhas: linhasDaPlanilha(todas) }],
        `vendas_${diaLocal(new Date())}.xlsx`,
      );
    } catch (falha) {
      console.error("Erro ao exportar as vendas:", falha);
      // Só escrevia no console: o botão girava e nada acontecia. Toast, e não
      // Alert, porque é retorno de uma ação que a pessoa acabou de tomar.
      avisarErro("Não foi possível exportar as vendas.");
    } finally {
      setExportando(false);
    }
  }, [recorte, pesquisaTabela, ordenacao, avisarErro]);

  if (carregando) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-base px-6 py-16 text-conteudo-muted">
        <Spinner size="lg" />
        <p>Carregando dados de vendas.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-base p-6 transition-colors">
      <CabecalhoDeVendas usuario={user} />

      {/*
        Os dois hooks já devolviam `erro` quando a rede caía, e a casca
        descartava os dois: a pessoa via "R$ 0,00", "0" vendas e "Nenhum
        resultado encontrado.", e lia "não vendemos nada". Alert no fluxo, e
        não toast, porque o estado dura até recarregar. A frase é daqui: a do
        hook (`comercial/useComercial.ts`, da outra frente) vem sem acento.
      */}
      {erroDoResumo || erroDaTabela ? (
        <div className="mt-6">
          <Alert variant="danger">
            Não foi possível carregar as vendas. Confira a conexão e recarregue
            a página.
          </Alert>
        </div>
      ) : null}

      <div className="mt-6 overflow-x-hidden">
        <FiltrosDeVendas
          opcoes={{
            empresas: empresasUnicas,
            vendedores: opcoes.vendedores,
            produtos: produtosUnicos,
          }}
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

        <KpisDeVendas kpis={kpis} />

        <GraficosDeVendas
          evolucao={evolucao}
          rankingProdutos={rankingProdutos}
          rankingVendedores={rankingVendedores}
          distribuicaoEmpresas={distribuicaoEmpresas}
        />

        <TabelaDeVendas
          notas={pagina.itens}
          total={pagina.total}
          pagina={paginaAtual}
          onPagina={setPaginaAtual}
          pesquisa={pesquisaTabela}
          onPesquisar={setPesquisaTabela}
          ordenacao={ordenacao}
          onOrdenar={alternarOrdenacao}
          onExportar={exportarExcel}
          exportando={exportando}
        />

        <EstatisticasDeVendas
          resumo={resumoDoPeriodoItens}
          comparativo={comparativo}
          porAno={evolucaoEhAnual(resumo.evolucao_mensal)}
          ate={intervalo?.ate}
          performance={performance}
        />
      </div>
    </div>
  );
};

export default Vendas;
