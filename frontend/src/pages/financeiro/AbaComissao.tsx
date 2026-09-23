import React, { useMemo, useState } from "react";

import { Alert, Card, CardTitle, Input } from "../../design-system/ui";
import { diaLocal } from "../../lib/datas";
import {
  converterParaNumero,
  formatarDinheiro,
  mascaraDeDinheiro,
} from "../../lib/dinheiro";
import { baixarPlanilha } from "../../lib/planilha";
import {
  INCENTIVOS_ATIVOS,
  calcularComissoes,
  lerVendedorDigitado,
  vendedorDigitadoVazio,
  type VendedorDigitado,
} from "./comissaoDeVendas";
import { EQUIPE_PADRAO, calcularComissaoDeServico } from "./comissaoDeServico";
import { ComissaoDeServico, type PessoaDigitada } from "./ComissaoDeServico";
import { TabelaDeVendedores } from "./TabelaDeVendedores";

/** A equipe de serviço da planilha, já em texto para os campos. */
const EQUIPE_INICIAL: PessoaDigitada[] = EQUIPE_PADRAO.map((pessoa) => ({
  id: pessoa.id,
  nome: pessoa.nome,
  percentual: String(pessoa.percentual * 100),
}));

/** Identificador de linha — só precisa ser único dentro da sessão. */
function novoId(): string {
  return `l${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Calculadora de Comissão — o fechamento do mês, digitado à mão.
 *
 * É a única aba do Financeiro em que o número não vem da API: quem preenche é
 * o Financeiro, a partir da planilha de notas que ele já monta. Duas regras
 * diferentes convivem aqui porque o fechamento é um só — a de vendas, por
 * vendedor e canal, e a de serviço, que é uma escada de metas repartida por
 * papel.
 *
 * Nada é gravado: sair da aba perde o que foi digitado, e é por isso que a
 * exportação para Excel existe.
 */
const AbaComissao: React.FC = () => {
  const [faturamentoTotal, setFaturamentoTotal] = useState("");
  const [vendedores, setVendedores] = useState<VendedorDigitado[]>([]);
  const [faturamentoServico, setFaturamentoServico] = useState("");
  const [pessoas, setPessoas] = useState<PessoaDigitada[]>(EQUIPE_INICIAL);

  const fechamentoDeVendas = useMemo(
    () =>
      calcularComissoes(
        vendedores.map(lerVendedorDigitado),
        converterParaNumero(faturamentoTotal),
      ),
    [vendedores, faturamentoTotal],
  );

  const fechamentoDeServico = useMemo(
    () =>
      calcularComissaoDeServico(
        converterParaNumero(faturamentoServico),
        pessoas.map((pessoa) => ({
          id: pessoa.id,
          nome: pessoa.nome,
          percentual: converterParaNumero(pessoa.percentual) / 100,
        })),
      ),
    [faturamentoServico, pessoas],
  );

  function mudarVendedor(id: string, mudanca: Partial<VendedorDigitado>) {
    setVendedores((atuais) =>
      atuais.map((v) => (v.id === id ? { ...v, ...mudanca } : v)),
    );
  }

  function mudarPessoa(id: string, mudanca: Partial<PessoaDigitada>) {
    setPessoas((atuais) =>
      atuais.map((p) => (p.id === id ? { ...p, ...mudanca } : p)),
    );
  }

  /**
   * A planilha do fechamento, com número de verdade nas células de valor.
   *
   * Exportar "R$ 7.750,00" como texto daria uma coluna que o Excel não soma —
   * e somar a coluna é a primeira coisa que alguém faz com o arquivo.
   */
  function exportar() {
    baixarPlanilha(
      [
        {
          nome: "Vendas",
          linhas: fechamentoDeVendas.linhas.map((linha) => ({
            Vendedor: linha.nome,
            "Total faturado": linha.total,
            "Alíquota inbound": linha.aliquotas.inbound,
            "Alíquota recompra": linha.aliquotas.recompra,
            "Alíquota outbound": linha.aliquotas.outbound,
            Comissão: linha.comissao,
            Bônus: linha.bonus,
            Rateio: linha.rateio,
            Recebe: linha.recebe,
            "Pelo mínimo garantido": linha.peloRateio ? "sim" : "não",
          })),
        },
        {
          nome: "Serviço",
          linhas: fechamentoDeServico.linhas.map((linha) => ({
            Pessoa: linha.nome,
            "% do papel": linha.percentual,
            Valor: linha.valor,
          })),
        },
      ],
      `comissao-${diaLocal(new Date())}.xlsx`,
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardTitle>Comissão de vendas</CardTitle>
        <p className="mb-4 mt-1 text-sm text-conteudo-muted">
          A faixa de alíquota sai do total do vendedor no mês, somando os três
          canais. O rateio de 1% é piso, não acréscimo: quem tem comissão maior
          recebe a comissão, quem tem menor recebe o rateio.
        </p>
        <div className="flex flex-wrap items-end gap-6">
          <Input
            label="Faturamento total da empresa (base do rateio)"
            placeholder="0,00"
            className="w-64 text-right"
            value={faturamentoTotal}
            onChange={(e) =>
              setFaturamentoTotal(mascaraDeDinheiro(e.target.value))
            }
          />
          <p className="pb-2 text-sm text-conteudo-muted">
            Rateio por vendedor:{" "}
            <strong className="font-mono text-conteudo-heading">
              {formatarDinheiro(fechamentoDeVendas.rateio)}
            </strong>{" "}
            <span className="text-conteudo-faint">
              (1% ÷ {vendedores.length}{" "}
              {vendedores.length === 1 ? "vendedor" : "vendedores"})
            </span>
          </p>
        </div>
      </Card>

      <Alert variant="info" title="Dois incentivos ainda inativos">
        <strong>Inbound Plus</strong> (+0,25% sobre a parcela negociada) e{" "}
        <strong>Recompra Ativa</strong> (+R$ 100 por venda ativada) fazem parte
        do modelo de comissionamento, mas estão <strong>inativos</strong>: a
        regra de quando cada um vale ainda não foi confirmada. Os campos
        aparecem na tabela desabilitados, e a conta dos dois já está pronta —
        ligá-los é uma linha de código quando a regra fechar.
      </Alert>

      <TabelaDeVendedores
        vendedores={vendedores}
        linhas={fechamentoDeVendas.linhas}
        totalAPagar={fechamentoDeVendas.totalAPagar}
        incentivosAtivos={INCENTIVOS_ATIVOS}
        onMudar={mudarVendedor}
        onAdicionar={() =>
          setVendedores((atuais) => [
            ...atuais,
            vendedorDigitadoVazio(novoId()),
          ])
        }
        onRemover={(id) =>
          setVendedores((atuais) => atuais.filter((v) => v.id !== id))
        }
        onExportar={exportar}
      />

      <ComissaoDeServico
        faturamento={faturamentoServico}
        onFaturamento={setFaturamentoServico}
        pessoas={pessoas}
        fechamento={fechamentoDeServico}
        onMudarPessoa={mudarPessoa}
        onAdicionarPessoa={() =>
          setPessoas((atuais) => [
            ...atuais,
            { id: novoId(), nome: "", percentual: "100" },
          ])
        }
        onRemoverPessoa={(id) =>
          setPessoas((atuais) => atuais.filter((p) => p.id !== id))
        }
      />
    </div>
  );
};

export default AbaComissao;
