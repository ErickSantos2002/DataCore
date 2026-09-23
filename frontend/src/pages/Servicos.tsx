import React, { useMemo, useState, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import {
  usePaginaDeServicos,
  useResumoDeServicos,
  todosOsServicos,
  type RecorteDeServicos,
} from "./servicos/useServicos";
import { Alert, Spinner } from "../design-system/ui";
import { diaLocal } from "../lib/datas";
import { baixarPlanilha } from "../lib/planilha";
import { avisoDoCorteDoPdf } from "../lib/pdf";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  cidadesDoResumo,
  evolucaoDoResumo,
  kpisDoResumo,
  linhasDaPlanilha,
  linhasDoPdf,
  proximaOrdenacao,
  rankingDoResumo,
  recorteDeServicos,
  type OrdenacaoDeServicos,
} from "./servicos/servicos";
import { CabecalhoServicos } from "./servicos/CabecalhoServicos";
import { FiltrosDeServicos } from "./servicos/FiltrosDeServicos";
import { KpisDeServicos } from "./servicos/KpisDeServicos";
import { GraficosDeServicos } from "./servicos/GraficosDeServicos";
import {
  TabelaDeServicos,
  type ExportacaoEmCurso,
} from "./servicos/TabelaDeServicos";
import { usePeriodo } from "../hooks/usePeriodo";
import { usePaginaDoRecorte } from "../hooks/usePaginaDoRecorte";

const Servicos: React.FC = () => {
  const { user } = useAuth();

  // Estados dos filtros
  const [filtroCliente, setFiltroCliente] = useState<string[]>([]);
  const [filtroCidade, setFiltroCidade] = useState<string[]>([]);
  const [filtroTipoServico, setFiltroTipoServico] = useState<string[]>([]);
  const {
    preset: presetPeriodo,
    escolherPreset: setPresetPeriodo,
    dataInicio,
    setDataInicio,
    dataFim,
    setDataFim,
  } = usePeriodo();

  // Estados da tabela
  const [ordenacao, setOrdenacao] = useState<OrdenacaoDeServicos>({
    campo: "data_emissao",
    direcao: "desc",
  });
  const [pesquisaTabela, setPesquisaTabela] = useState("");

  // O `useMemo` não é enfeite: `useResumoDeServicos` e `usePaginaDeServicos`
  // montam a chave da busca a partir deste objeto, e um objeto novo a cada
  // render poria a tela em laço de requisições.
  const recorte: RecorteDeServicos = useMemo(
    () =>
      recorteDeServicos({
        cliente: filtroCliente,
        cidade: filtroCidade,
        tipoServico: filtroTipoServico,
        dataInicio,
        dataFim,
      }),
    [filtroCliente, filtroCidade, filtroTipoServico, dataInicio, dataFim],
  );

  const { resumo, carregando, erro } = useResumoDeServicos(recorte);

  // Voltar para a página 1 quando o recorte, a busca ou a ordem mudam: quem
  // estava na página 12 de um filtro amplo ficaria olhando página vazia.
  const chaveDoRecorte =
    JSON.stringify(recorte) + pesquisaTabela + JSON.stringify(ordenacao);
  const [paginaAtual, setPaginaAtual] = usePaginaDoRecorte(chaveDoRecorte);

  const { pagina, erro: erroDaTabela } = usePaginaDeServicos(recorte, {
    busca: pesquisaTabela,
    ordenarPor: ordenacao.campo,
    direcao: ordenacao.direcao,
    pagina: paginaAtual,
    porPagina: 15,
  });

  const servicosPaginados = pagina.itens;
  const totalDeServicos = pagina.total;

  // As opções dos multiselects vêm do banco, e não de percorrer as notas.
  const clientesUnicos = useMemo(
    () => resumo.opcoes.clientes,
    [resumo.opcoes.clientes],
  );
  const cidadesUnicas = useMemo(
    () => resumo.opcoes.cidades,
    [resumo.opcoes.cidades],
  );
  const tiposServicoUnicos = useMemo(
    () => resumo.opcoes.tipos,
    [resumo.opcoes.tipos],
  );

  // KPIs — somados pelo banco sobre o recorte inteiro.
  const kpis = useMemo(() => kpisDoResumo(resumo), [resumo]);

  // Evolução: o banco devolve uma linha por mês com nota; o rótulo e a troca
  // para escala anual acima de 24 meses continuam sendo decisão da tela.
  const evolucaoMensal = useMemo(
    () => evolucaoDoResumo(resumo.evolucao_mensal),
    [resumo.evolucao_mensal],
  );

  // Ranking de clientes (Top 10) — já vem ordenado por valor do banco.
  const rankingClientes = useMemo(
    () => rankingDoResumo(resumo.por_cliente),
    [resumo.por_cliente],
  );

  // Distribuição por cidade — as dez maiores.
  const distribuicaoCidades = useMemo(
    () => cidadesDoResumo(resumo.por_cidade),
    [resumo.por_cidade],
  );

  // A regra de alternar (campo novo comeca em desc, mesmo campo inverte) mora
  // em `servicos.ts`, `proximaOrdenacao` — o mesmo molde de Contas e Locacao.
  const alternarOrdenacao = (campo: OrdenacaoDeServicos["campo"]) => {
    setOrdenacao((prev) => proximaOrdenacao(prev, campo));
  };

  // Qual exportação está em curso — vai para os dois botões, que desabilitam
  // enquanto ela existe. Exportar busca o recorte INTEIRO do servidor, página
  // a página (`todosOsServicos`): num recorte grande isso demora, e sem este
  // estado a tela não dava retorno nenhum — a pessoa clicava de novo e
  // disparava a busca inteira outra vez.
  const [exportando, setExportando] = useState<ExportacaoEmCurso>(null);

  /** O recorte inteiro, e não a página visível — a planilha e o PDF sempre
   *  levaram a lista filtrada toda. */
  const buscarTudo = useCallback(
    () =>
      todosOsServicos(recorte, {
        busca: pesquisaTabela,
        ordenarPor: ordenacao.campo,
        direcao: ordenacao.direcao,
      }),
    [recorte, pesquisaTabela, ordenacao],
  );

  // Exportação para Excel — a modelagem da linha mora em servicos.ts.
  const exportarExcel = useCallback(async () => {
    setExportando("excel");
    try {
      baixarPlanilha(
        [{ nome: "Serviços", linhas: linhasDaPlanilha(await buscarTudo()) }],
        `servicos_${diaLocal(new Date())}.xlsx`,
      );
    } catch (falha) {
      console.error("Erro ao exportar os serviços:", falha);
    } finally {
      setExportando(null);
    }
  }, [buscarTudo]);

  // Exportação para PDF — a montagem do documento (margens, cabeçalho,
  // download) é apresentação e fica aqui; as linhas do corpo (`linhasDoPdf`)
  // são modelagem de dado e moram em servicos.ts, junto de `linhasDaPlanilha`.
  const exportarPDF = useCallback(async () => {
    setExportando("pdf");
    try {
      const doc = new jsPDF();

      // Cabeçalho
      doc.setFontSize(16);
      doc.text("Relatório de Serviços", 14, 20);
      doc.setFontSize(10);
      doc.text(`Data: ${new Date().toLocaleDateString("pt-BR")}`, 14, 28);
      doc.text(`Usuário: ${user?.username}`, 14, 34);
      const servicos = await buscarTudo();
      const aviso = avisoDoCorteDoPdf(servicos.length);
      if (aviso) doc.text(aviso, 14, 40);

      autoTable(doc, {
        startY: aviso ? 46 : 40,
        head: [["NFS-e", "Cliente", "Data", "Valor", "Cidade"]],
        body: linhasDoPdf(servicos),
      });

      doc.save(`servicos_${diaLocal(new Date())}.pdf`);
    } catch (falha) {
      console.error("Erro ao exportar o PDF dos serviços:", falha);
    } finally {
      setExportando(null);
    }
  }, [buscarTudo, user]);

  // O estado de carregando era o unico bloco de cor que sobrava na casca:
  // `bg-gray-50` com `dark:` por cima, e um spinner cru de `<div>` girando com
  // `border-blue-600`. Token nao precisa de `dark:` — `bg-surface-base` e
  // `text-conteudo-muted` ja saem de `var(--...)` e viram sozinhos com o tema,
  // e o `Spinner` do design system e o mesmo anel de Produtos.tsx.
  if (carregando) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-base px-6 py-16 text-conteudo-muted">
        <Spinner size="lg" />
        <p>Carregando dados de serviços.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-base transition-colors">
      <div className="p-6">
        {/* Cabeçalho */}
        <CabecalhoServicos usuario={user} />

        {/*
          Falha de busca é AVISO EM BLOCO, e não toast. Os dois hooks já
          calculavam `erro` com a frase pronta e a tela descartava os dois:
          com a API caída, `RESUMO_VAZIO` e `PAGINA_VAZIA` desenhavam uma tela
          inteira e plausível — "R$ 0,00", "N/A" no Top Cliente, gráficos
          vazios, "Nenhum resultado encontrado." — e quem olhava lia "não
          houve serviço nesse período" e ia embora. O estado é permanente até
          recarregar, então o aviso tem de ficar na tela: um toast some em 4
          segundos e devolve a pessoa à tela vazia sem explicação. Mesmo
          padrão de `contas/TelaDeContas.tsx` e da tela de Locação; o
          `role="alert"` do primitivo anuncia sozinho.

          Um `Alert` só para as duas buscas: as duas caem pela mesma queda de
          rede, e dois blocos vermelhos idênticos diriam a mesma coisa duas
          vezes.
        */}
        {erro || erroDaTabela ? (
          <div className="mt-6">
            <Alert variant="danger">{erro ?? erroDaTabela}</Alert>
          </div>
        ) : null}

        <div className="mt-6">
          {/* Filtros */}
          <FiltrosDeServicos
            opcoes={{
              clientes: clientesUnicos,
              cidades: cidadesUnicas,
              tipos: tiposServicoUnicos,
            }}
            valores={{
              cliente: filtroCliente,
              cidade: filtroCidade,
              tipoServico: filtroTipoServico,
              presetPeriodo,
              dataInicio,
              dataFim,
            }}
            onCliente={setFiltroCliente}
            onCidade={setFiltroCidade}
            onTipoServico={setFiltroTipoServico}
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
          <KpisDeServicos kpis={kpis} />

          {/* Gráficos */}
          <GraficosDeServicos
            evolucaoMensal={evolucaoMensal}
            rankingClientes={rankingClientes}
            distribuicaoCidades={distribuicaoCidades}
          />

          {/* Tabela de Serviços */}
          <TabelaDeServicos
            servicos={servicosPaginados}
            total={totalDeServicos}
            pagina={paginaAtual}
            onPagina={setPaginaAtual}
            pesquisa={pesquisaTabela}
            onPesquisar={setPesquisaTabela}
            ordenacao={ordenacao}
            onOrdenar={alternarOrdenacao}
            onExportarExcel={exportarExcel}
            onExportarPDF={exportarPDF}
            exportando={exportando}
          />
        </div>
      </div>
    </div>
  );
};

export default Servicos;
