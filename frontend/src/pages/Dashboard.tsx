import React from "react";
import { useAuth } from "../hooks/useAuth";
import { useDashboard } from "../context/DashboardContext";
import { useConfiguracoes } from "../context/ConfiguracoesContext";
import { Spinner } from "../design-system/ui";
import { CabecalhoMeta } from "./dashboard/CabecalhoMeta";
import { FaturamentoPorMes } from "./dashboard/FaturamentoPorMes";
import { ProjecaoFechamento } from "./dashboard/ProjecaoFechamento";
import { ResumoTrimestre } from "./dashboard/ResumoTrimestre";
import { Velocimetro } from "./dashboard/Velocimetro";
import {
  degrausDaMeta,
  mesesDoTrimestre,
  projecaoDeFechamento,
} from "./dashboard/metaTrimestral";
import { useComemoracaoMeta } from "./dashboard/useComemoracaoMeta";

/** Percentual de um degrau, travado em 100% — passar da meta não estica o arco. */
function progressoAte(total: number, degrau: number): number {
  return Math.min((total / degrau) * 100, 100);
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { dados, total, carregando, totalAno, serieMensal, totaisAnoAnterior } =
    useDashboard();
  const { configuracoes } = useConfiguracoes();

  const metaConfig = configuracoes.find((c) => c.chave === "META");
  const degraus = degrausDaMeta(metaConfig?.valor);
  const { degrau55, degrau85, degrau100 } = degraus;

  const animacaoConfig = configuracoes.find((c) => c.chave === "ANIMACAO_META");

  // Os mesmos meses que o DashboardContext usou para somar o `total`: é o
  // calendário sobre o qual a projeção mede o ritmo.
  const mesesConfig = configuracoes.find((c) => c.chave === "MESES_ANALISE");
  const projecao = projecaoDeFechamento({
    realizado: total,
    meses: mesesDoTrimestre(mesesConfig?.valor),
    hoje: new Date(),
    // A forma do mesmo trimestre no ano anterior. Sem ela a projeção cai no
    // método linear — e o card diz isso, em vez de calar.
    totaisAnoAnterior: totaisAnoAnterior ?? [],
  });

  useComemoracaoMeta({
    habilitada: animacaoConfig?.valor === "true",
    carregando,
    total,
    degrau55,
    degrau85,
    degrau100,
  });

  if (carregando) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-base px-6 py-16 text-conteudo-muted md:h-full md:min-h-0">
        <Spinner size="lg" />
        <p>Carregando os dados da meta do trimestre.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-base p-6 transition-colors md:h-full md:min-h-0">
      <div className="flex flex-col gap-4">
        <CabecalhoMeta usuario={user} />

        <ProjecaoFechamento
          realizado={total}
          projecao={projecao}
          degraus={degraus}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Velocimetro
            progresso={progressoAte(total, degrau55)}
            degrau={degrau55}
            valor={total}
            corDoArco="stroke-bronze"
            rotuloBonus="55%"
            descricaoDegrau="PL sobre 0,9× META÷4"
          />
          <Velocimetro
            progresso={progressoAte(total, degrau85)}
            degrau={degrau85}
            valor={total}
            corDoArco="stroke-prata"
            rotuloBonus="85%"
            descricaoDegrau="PL sobre 1,2× META÷4"
          />
          <Velocimetro
            progresso={progressoAte(total, degrau100)}
            degrau={degrau100}
            valor={total}
            corDoArco="stroke-ouro"
            rotuloBonus="100%"
            descricaoDegrau="PL sobre 1,4× META÷4"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.6fr]">
          <ResumoTrimestre meses={dados} total={total} totalAno={totalAno} />
          <FaturamentoPorMes
            meses={serieMensal ?? []}
            destacar={dados.map((mes) => mes.mes)}
          />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
