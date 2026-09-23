import React, { useCallback, useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { useAuth } from "../hooks/useAuth";
import { usePaginacao } from "../hooks/usePaginacao";
import { diaLocal } from "../lib/datas";
import { baixarPlanilha } from "../lib/planilha";
import { avisoDoCorteDoPdf } from "../lib/pdf";
import { Alert, Spinner } from "../design-system/ui";
import {
  useFiltrosComerciais,
  useResumoComercial,
} from "./comercial/useComercial";
import {
  CABECALHO_DO_PDF,
  buscarEOrdenar,
  carteiraDoResumo,
  chavePorRotulo,
  estatisticasDaCarteira,
  idsPorDocumento,
  kpisDaCarteira,
  linhasDaPlanilha,
  linhasDoPdf,
  opcoesDeCliente,
  proximaOrdenacao,
  rankingDeClientes,
  recorteDosFiltros,
  rotuloDoProduto,
  type CampoDeOrdenacao,
  type OrdenacaoDeClientes,
} from "./clientes/clientes";
import { CabecalhoDeClientes } from "./clientes/CabecalhoDeClientes";
import { FiltrosDeClientes } from "./clientes/FiltrosDeClientes";
import { KpisDeClientes } from "./clientes/KpisDeClientes";
import { GraficoDeClientes } from "./clientes/GraficoDeClientes";
import { EstatisticasDeClientes } from "./clientes/EstatisticasDeClientes";
import { TabelaDeClientes } from "./clientes/TabelaDeClientes";
import { usePeriodo } from "../hooks/usePeriodo";

/**
 * A tela de Clientes, como casca: estado dos filtros e da tabela, os `useMemo`
 * que chamam a conta pura de `clientes/clientes.ts`, e as seis peças.
 */
const Clientes: React.FC = () => {
  const { user } = useAuth();

  const [filtroCliente, setFiltroCliente] = useState<string[]>([]);
  const [filtroProduto, setFiltroProduto] = useState<string[]>([]);
  const [filtroVendedor, setFiltroVendedor] = useState<string[]>([]);
  const {
    preset: presetPeriodo,
    escolherPreset: setPresetPeriodo,
    dataInicio,
    setDataInicio,
    dataFim,
    setDataFim,
  } = usePeriodo();

  const [ordenacao, setOrdenacao] = useState<OrdenacaoDeClientes>({
    campo: "ultimaCompra",
    direcao: "desc",
  });
  const [pesquisaTabela, setPesquisaTabela] = useState("");

  const { opcoes } = useFiltrosComerciais();

  const opcoesDoCliente = useMemo(
    () => opcoesDeCliente(opcoes.clientes),
    [opcoes.clientes],
  );
  const idsDoDocumento = useMemo(
    () => idsPorDocumento(opcoes.clientes),
    [opcoes.clientes],
  );
  const rotulosDeProduto = useMemo(
    () => opcoes.produtos.map(rotuloDoProduto),
    [opcoes.produtos],
  );
  const chaveDoRotulo = useMemo(
    () => chavePorRotulo(opcoes.produtos),
    [opcoes.produtos],
  );

  const recorte = useMemo(
    () =>
      recorteDosFiltros(
        {
          cliente: filtroCliente,
          vendedor: filtroVendedor,
          produto: filtroProduto,
          dataInicio,
          dataFim,
        },
        idsDoDocumento,
        chaveDoRotulo,
      ),
    [
      filtroCliente,
      filtroVendedor,
      filtroProduto,
      dataInicio,
      dataFim,
      idsDoDocumento,
      chaveDoRotulo,
    ],
  );

  const { resumo, carregando, erro } = useResumoComercial(recorte);

  // Os clientes com compra no recorte, já consolidados por documento pelo
  // banco. Isto era o `clientesEnriquecidos` do contexto cruzado com as notas
  // no navegador: para cada um dos 2.084 cadastros, um `filter` sobre as 4.330
  // notas.
  const carteira = useMemo(
    () => carteiraDoResumo(resumo.por_cliente, new Date()),
    [resumo.por_cliente],
  );
  const kpis = useMemo(() => kpisDaCarteira(carteira), [carteira]);
  const ranking = useMemo(() => rankingDeClientes(carteira), [carteira]);
  const estatisticas = useMemo(
    () => estatisticasDaCarteira(carteira, kpis, resumo.kpis.faturamento),
    [carteira, kpis, resumo.kpis.faturamento],
  );

  const clientesTabela = useMemo(
    () => buscarEOrdenar(carteira, pesquisaTabela, ordenacao),
    [carteira, pesquisaTabela, ordenacao],
  );

  // usePaginacao volta para a página 1 quando clientesTabela muda de
  // identidade (filtro, busca ou ordenação) — sem isso, quem filtrava na
  // página 2 ficava com slice fora da lista e o rodapé invertido.
  const {
    pagina: paginaAtual,
    setPagina: setPaginaAtual,
    itensDaPagina: clientesPaginados,
    total: totalDeClientes,
  } = usePaginacao(clientesTabela, 15);

  const alternarOrdenacao = (campo: CampoDeOrdenacao) => {
    setOrdenacao((atual) => proximaOrdenacao(atual, campo));
  };

  const exportarExcel = useCallback(() => {
    baixarPlanilha(
      [{ nome: "Clientes", linhas: linhasDaPlanilha(clientesTabela) }],
      `clientes_${diaLocal(new Date())}.xlsx`,
    );
  }, [clientesTabela]);

  const exportarPDF = useCallback(() => {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("Relatório de Clientes", 14, 20);
    doc.setFontSize(10);
    doc.text(`Data: ${new Date().toLocaleDateString("pt-BR")}`, 14, 28);
    doc.text(`Usuário: ${user?.username}`, 14, 34);
    const aviso = avisoDoCorteDoPdf(clientesTabela.length);
    if (aviso) doc.text(aviso, 14, 40);

    autoTable(doc, {
      startY: aviso ? 46 : 40,
      head: [CABECALHO_DO_PDF],
      body: linhasDoPdf(clientesTabela),
    });

    doc.save(`clientes_${diaLocal(new Date())}.pdf`);
  }, [clientesTabela, user]);

  if (carregando) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-base px-6 py-16 text-conteudo-muted">
        <Spinner size="lg" />
        <p>Carregando dados dos clientes.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-base p-6 transition-colors">
      <CabecalhoDeClientes usuario={user} />

      {/*
        O hook já devolvia `erro` quando a rede caía, e a casca descartava: a
        pessoa via "0" ativos, "N/A" e "Nenhum resultado encontrado.", e lia
        "não tenho cliente nenhum". Alert no fluxo, e não toast, porque o
        estado dura até recarregar. A frase é daqui: a do hook
        (`comercial/useComercial.ts`, da outra frente) vem sem acento.
      */}
      {erro ? (
        <div className="mt-6">
          <Alert variant="danger">
            Não foi possível carregar os clientes. Confira a conexão e
            recarregue a página.
          </Alert>
        </div>
      ) : null}

      <div className="mt-6">
        <FiltrosDeClientes
          opcoes={{
            clientes: opcoesDoCliente,
            vendedores: opcoes.vendedores,
            produtos: rotulosDeProduto,
          }}
          valores={{
            cliente: filtroCliente,
            vendedor: filtroVendedor,
            produto: filtroProduto,
            presetPeriodo,
            dataInicio,
            dataFim,
          }}
          onCliente={setFiltroCliente}
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

        <KpisDeClientes kpis={kpis} />

        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <GraficoDeClientes ranking={ranking} />
          <EstatisticasDeClientes itens={estatisticas} />
        </div>

        <TabelaDeClientes
          clientes={clientesPaginados}
          total={totalDeClientes}
          pagina={paginaAtual}
          onPagina={setPaginaAtual}
          pesquisa={pesquisaTabela}
          onPesquisar={setPesquisaTabela}
          ordenacao={ordenacao}
          onOrdenar={alternarOrdenacao}
          onExportarExcel={exportarExcel}
          onExportarPdf={exportarPDF}
        />
      </div>
    </div>
  );
};

export default Clientes;
