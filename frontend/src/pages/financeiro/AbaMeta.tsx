import React, { useMemo } from "react";
import { Trophy } from "lucide-react";

import { Card, CardTitle, KpiCard, Spinner } from "../../design-system/ui";
import { useConfiguracoes } from "../../context/ConfiguracoesContext";
import { useDashboard } from "../../context/DashboardContext";
import {
  faixaAtual as acharFaixaAtual,
  faixasDeBonificacao,
  formatarDinheiro,
  lerValorDaMeta,
  proximaFaixa as acharProximaFaixa,
} from "./meta";
import { ListaDeFaixas } from "./ListaDeFaixas";
import { ValorEditavel } from "./ValorEditavel";

export interface AbaMetaProps {
  /** Faturamento do ano anterior (vendas + serviços), vindo da Visão Geral. */
  faturamentoAnoAnterior?: number;
  /** Ano usado como base de comparação (ex.: 2025). */
  anoAnterior?: number;
}

/**
 * Meta — quanto de PL os funcionários recebem no trimestre.
 *
 * A META é definida de forma ANUAL na tabela de configurações, mas o PL é
 * apurado por TRIMESTRE: a base de tudo aqui é META ÷ 4. A curva de
 * bonificação e as dez faixas moram em `meta.ts`; esta aba é composição.
 */
const AbaMeta: React.FC<AbaMetaProps> = ({
  faturamentoAnoAnterior = 0,
  anoAnterior,
}) => {
  const { total, totalAno, dados, carregando } = useDashboard();
  const { configuracoes, editarConfiguracao } = useConfiguracoes();

  const metaAnual = useMemo(
    () => lerValorDaMeta(configuracoes.find((c) => c.chave === "META")?.valor),
    [configuracoes],
  );
  const metaTrimestral = metaAnual / 4;

  const faixas = useMemo(
    () => faixasDeBonificacao(metaAnual, total, faturamentoAnoAnterior),
    [metaAnual, total, faturamentoAnoAnterior],
  );
  const faixaAtual = acharFaixaAtual(faixas);
  const proximaFaixa = acharProximaFaixa(faixas);
  const plAtual = faixaAtual ? faixaAtual.bonus : 0;
  const metaMaxima = faixas[faixas.length - 1].alvo;

  if (carregando) {
    return (
      <Card
        padding="lg"
        className="flex flex-col items-center gap-4 text-conteudo-muted"
      >
        <Spinner size="lg" />
        <p>Carregando dados de meta...</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card padding="lg">
        <div className="flex flex-col gap-6 md:flex-row">
          <ValorEditavel
            label="META Anual"
            sublabel="(base · 65% · 1,0×)"
            valor={metaAnual}
            onSalvar={(valor) => editarConfiguracao("META", valor)}
          />
          <div className="flex-1">
            <p className="text-sm text-conteudo-muted">
              Faturamento do Ano Passado{" "}
              <span className="text-xs">(base de comparação)</span>
            </p>
            <p className="mt-1 text-2xl font-bold text-conteudo-heading">
              {formatarDinheiro(faturamentoAnoAnterior)}
            </p>
            <p className="mt-0.5 text-xs text-conteudo-faint">
              {anoAnterior ? `ano ${anoAnterior} · ` : ""}calculado da Visão
              Geral
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-conteudo-muted">
          O valor da META é <strong>anual</strong>. O PL é apurado por{" "}
          <strong>trimestre</strong>, usando META ÷ 4 ={" "}
          <strong>{formatarDinheiro(metaTrimestral)}</strong> como base
          trimestral.
        </p>
      </Card>

      {/*
        O destaque do PL é o único bloco de fundo cheio da tela — é o número
        que a pessoa veio ver. Sem faixa batida ele perde a cor em vez de
        ficar verde com "0%", que leria como conquista.
      */}
      <Card
        padding="lg"
        className={
          plAtual > 0 ? "border-success bg-success text-on-success" : undefined
        }
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Trophy className="h-12 w-12 opacity-90" aria-hidden="true" />
            <div>
              <p className="text-sm uppercase tracking-wide opacity-90">
                PL que os funcionários vão receber — trimestre atual
              </p>
              <p className="text-5xl font-extrabold leading-tight">
                {plAtual}%
              </p>
              <p className="text-sm opacity-90">
                {plAtual > 0
                  ? "do salário, com base no faturamento até agora"
                  : "nenhuma faixa atingida ainda"}
              </p>
            </div>
          </div>
          <div className="md:text-right">
            <p className="text-sm opacity-90">Faturamento do trimestre</p>
            <p className="text-2xl font-bold">{formatarDinheiro(total)}</p>
            {proximaFaixa && (
              <p className="mt-1 text-sm opacity-90">
                Faltam <strong>{formatarDinheiro(proximaFaixa.falta)}</strong>{" "}
                para {proximaFaixa.bonus}%
              </p>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4">
        <KpiCard
          label="Faturamento do Trimestre"
          value={formatarDinheiro(total)}
          tone="acao"
          note={`Ano: ${formatarDinheiro(totalAno)}`}
        />
        <KpiCard
          label="Meta 100% (trimestre)"
          value={formatarDinheiro(metaMaxima)}
          note="Bônus máximo do trimestre"
        />
        <KpiCard
          label="Bônus Atual"
          value={faixaAtual ? `${faixaAtual.bonus}%` : "—"}
          tone={faixaAtual ? "positivo" : "neutro"}
          note={
            faixaAtual
              ? "Faixa garantida no momento"
              : "Nenhuma faixa atingida ainda"
          }
        />
        <KpiCard
          label="Próxima Faixa"
          // Sem o ✅ do original: o checklist da tela migrada proíbe emoji
          // fazendo papel de ícone, e o `KpiCard` só aceita texto no valor.
          // A informação não se perde — a nota abaixo diz "Todas as metas
          // batidas!", que é mais claro do que o visto verde era.
          value={proximaFaixa ? `${proximaFaixa.bonus}%` : "100%"}
          note={
            proximaFaixa
              ? `Faltam ${formatarDinheiro(proximaFaixa.falta)}`
              : "Todas as metas batidas!"
          }
        />
      </div>

      <ListaDeFaixas
        faixas={faixas}
        proxima={proximaFaixa}
        faturamentoAnoPassado={faturamentoAnoAnterior}
      />

      {dados.length > 0 && (
        <Card padding="lg">
          <CardTitle className="mb-2 text-sm">
            Composição do trimestre
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            {dados.map((mes) => (
              <span
                key={mes.mes}
                className="rounded-full bg-surface-elevated px-3 py-1 text-xs text-conteudo"
              >
                {mes.mes}: <strong>{formatarDinheiro(mes.total)}</strong>
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default AbaMeta;
