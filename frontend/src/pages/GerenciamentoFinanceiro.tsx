import React, { useMemo, useState } from "react";

import {
  Alert,
  Card,
  Spinner,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../design-system/ui";
import { useContasPagar } from "../context/ContasPagarContext";
import AbaCentroCusto from "./financeiro/AbaCentroCusto";
import AbaComissao from "./financeiro/AbaComissao";
import AbaMeta from "./financeiro/AbaMeta";
import { AbaBalancete } from "./financeiro/AbaBalancete";
import { AbaVisaoGeral } from "./financeiro/AbaVisaoGeral";
import {
  ANOS,
  alternarAno,
  combinarPorTipo,
  kpisPorAno,
  montarBalancete,
  pontosAcumulados,
  pontosComparativos,
  somaDoAno,
  variacaoMensal,
  type Ano,
  type TipoDeReceita,
} from "./financeiro/financeiro";
import { useFaturamento } from "./financeiro/useFaturamento";

/** As quatro abas da tela, na ordem em que aparecem. */
const ABAS = [
  { valor: "visaoGeral", rotulo: "Visão Geral" },
  { valor: "balancete", rotulo: "Balancete" },
  { valor: "centroCusto", rotulo: "Centro de Custo" },
  { valor: "meta", rotulo: "Meta" },
  { valor: "comissao", rotulo: "Calculadora de Comissão" },
] as const;

/**
 * Gerenciamento Financeiro — a receita da empresa vista de quatro ângulos.
 *
 * A tela é o esqueleto: junta as fontes, guarda o que a pessoa
 * escolheu (aba, anos ligados, tipo de receita, ano do balancete e ano do
 * centro de custo) e entrega cada recorte pronto para a aba correspondente.
 * As contas moram em `financeiro/financeiro.ts`, o desenho nos componentes
 * ao lado.
 *
 * O ano do Centro de Custo é estado DAQUI, e não da aba: sair para o
 * Balancete e voltar não pode devolver a aba de custo ao ano padrão.
 */
const GerenciamentoFinanceiro: React.FC = () => {
  const {
    vendas: vendasPorAnoMes,
    servicos: servicosPorAnoMes,
    notasDeVenda,
    notasDeServico,
    carregando: carregandoFaturamento,
    erro: erroDeFaturamento,
  } = useFaturamento();
  const {
    contas: contasPagar,
    carregando: carregandoPagar,
    erro: erroDePagar,
  } = useContasPagar();
  // As contas a RECEBER saíram daqui em 2026-09-09. Esta tela nunca leu os
  // dados: o provider era montado só para propagar a falha da busca, e a
  // justificativa era que outras telas contavam com as contas em memória —
  // desde o item 9.4, nenhuma conta. Baixar 11,2 MB para talvez mostrar uma
  // tarja não se paga.
  const erroDeReceber: string | null = null;

  /**
   * O que não carregou.
   *
   * Num aviso só, e não um por fonte: quando a API cai, cai para todas, e
   * tarjas vermelhas empilhadas empurrariam a tela inteira para baixo dizendo
   * a mesma coisa três vezes.
   */
  const falhas = [erroDeFaturamento, erroDePagar, erroDeReceber].filter(
    (falha): falha is string => Boolean(falha),
  );

  const [abaAtiva, setAbaAtiva] = useState<string>("visaoGeral");
  const [anosAtivos, setAnosAtivos] = useState<Set<Ano>>(new Set(ANOS));
  const [tipo, setTipo] = useState<TipoDeReceita>("combinado");
  const [anoBalancete, setAnoBalancete] = useState<number>(2026);
  const [anoCentro, setAnoCentro] = useState(2025);

  const total = useMemo(
    () => combinarPorTipo(tipo, vendasPorAnoMes, servicosPorAnoMes),
    [tipo, vendasPorAnoMes, servicosPorAnoMes],
  );

  const kpis = useMemo(
    () => kpisPorAno(total, notasDeVenda, notasDeServico, tipo),
    [total, notasDeVenda, notasDeServico, tipo],
  );
  const comparativo = useMemo(
    () => pontosComparativos(total, anosAtivos),
    [total, anosAtivos],
  );
  const acumulado = useMemo(
    () => pontosAcumulados(total, anosAtivos),
    [total, anosAtivos],
  );
  const variacao = useMemo(() => variacaoMensal(total), [total]);

  const balancete = useMemo(
    () =>
      montarBalancete(
        vendasPorAnoMes,
        servicosPorAnoMes,
        contasPagar,
        anoBalancete,
      ),
    [vendasPorAnoMes, servicosPorAnoMes, contasPagar, anoBalancete],
  );

  /**
   * O faturamento do ano passado que a aba Meta usa como base de comparação.
   *
   * Sai das séries CRUAS, e não do `total`: se respeitasse o filtro de tipo,
   * o bônus projetado da empresa mudaria conforme o botão que alguém tivesse
   * deixado clicado na Visão Geral.
   */
  const anoAnterior = new Date().getFullYear() - 1;
  const faturamentoAnoAnterior = useMemo(
    () =>
      somaDoAno(vendasPorAnoMes, anoAnterior) +
      somaDoAno(servicosPorAnoMes, anoAnterior),
    [vendasPorAnoMes, servicosPorAnoMes, anoAnterior],
  );

  if (carregandoFaturamento || carregandoPagar) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-base px-6 py-16 text-conteudo-muted md:h-full md:min-h-0">
        <Spinner size="lg" />
        <p>Carregando dados financeiros...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-base p-6 transition-colors md:h-full md:min-h-0">
      <Tabs
        value={abaAtiva}
        onChange={setAbaAtiva}
        className="flex flex-col gap-4"
      >
        <Card padding="lg">
          <h1 className="text-3xl font-bold text-conteudo-heading">
            Gerenciamento Financeiro
          </h1>
          <p className="mt-1 text-sm text-conteudo-muted">
            Análise comparativa de receitas 2022 · 2023 · 2024 · 2025 · 2026 —
            Vendas e Serviços
          </p>
          <TabsList className="mt-4">
            {ABAS.map(({ valor, rotulo }) => (
              <TabsTrigger key={valor} value={valor}>
                {rotulo}
              </TabsTrigger>
            ))}
          </TabsList>
        </Card>

        {falhas.length > 0 && (
          <Alert variant="danger" title="Parte dos dados não carregou">
            {falhas.length === 1 ? (
              falhas[0]
            ) : (
              <ul className="ml-4 list-disc">
                {falhas.map((falha) => (
                  <li key={falha}>{falha}</li>
                ))}
              </ul>
            )}
          </Alert>
        )}

        <TabsContent value="visaoGeral">
          <AbaVisaoGeral
            anosAtivos={anosAtivos}
            onAlternarAno={(ano) =>
              setAnosAtivos((atuais) => alternarAno(atuais, ano))
            }
            tipo={tipo}
            onTipo={setTipo}
            kpis={kpis}
            total={total}
            comparativo={comparativo}
            acumulado={acumulado}
            variacao={variacao}
          />
        </TabsContent>

        <TabsContent value="balancete">
          <AbaBalancete
            ano={anoBalancete}
            onAno={setAnoBalancete}
            balancete={balancete}
          />
        </TabsContent>

        <TabsContent value="centroCusto">
          <AbaCentroCusto anoCentro={anoCentro} setAnoCentro={setAnoCentro} />
        </TabsContent>

        <TabsContent value="meta">
          <AbaMeta
            faturamentoAnoAnterior={faturamentoAnoAnterior}
            anoAnterior={anoAnterior}
          />
        </TabsContent>

        <TabsContent value="comissao">
          <AbaComissao />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GerenciamentoFinanceiro;
