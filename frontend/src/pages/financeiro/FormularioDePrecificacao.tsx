import { Plus, Trash2 } from "lucide-react";

import { Button, Card, CardTitle, Input } from "../../design-system/ui";
import {
  formatarDinheiro,
  mascaraDeData,
  mascaraDeDinheiro,
  type CalculoDeCusto,
  type FormularioDeCusto,
} from "./centroCusto";

export interface FormularioDePrecificacaoProps {
  form: FormularioDeCusto;
  onMudar: (mudanca: Partial<FormularioDeCusto>) => void;
  calculo: CalculoDeCusto;
}

/**
 * Campo de uma linha da grade.
 *
 * É `input` cru, e não o `Input` do design system, de propósito: o primitivo
 * traz o próprio invólucro com rótulo, e aqui o rótulo é o cabeçalho da
 * coluna, uma vez só para a coluna inteira. O `aria-label` é o que dá nome ao
 * campo para quem usa leitor de tela, já que não há `<label>` por linha.
 */
function CampoDaLinha({
  rotulo,
  ...props
}: { rotulo: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input-cc" aria-label={rotulo} {...props} />;
}

/** Botão de remover uma linha — só ícone, com nome acessível. */
function BotaoRemover({
  rotulo,
  onClick,
}: {
  rotulo: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      onClick={onClick}
      className="flex items-center justify-center rounded text-conteudo-faint transition-colors hover:text-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
    >
      <Trash2 size={14} aria-hidden="true" />
    </button>
  );
}

/** A caixa de fórmula: mostra a conta por extenso, no resultado dela. */
function Formula({ conta, resultado }: { conta: string; resultado: string }) {
  return (
    <div className="mt-3 rounded-lg bg-tint-primary px-4 py-2 text-xs">
      <span className="font-mono text-on-tint-primary">{conta}</span>
      <span className="ml-2 font-bold text-on-tint-primary">= {resultado}</span>
    </div>
  );
}

/**
 * O formulário de precificação, em quatro passos numerados.
 *
 * A ordem dos blocos é a ordem da conta: o que vem da importação, o que vem
 * por unidade, o que vem rateado da empresa e, por último, o preço — que é
 * opcional porque na falta dele vale o preço médio já realizado.
 */
export function FormularioDePrecificacao({
  form,
  onMudar,
  calculo,
}: FormularioDePrecificacaoProps) {
  return (
    <>
      <Card padding="lg">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <CardTitle className="text-sm">1. Serviços Aduaneiros</CardTitle>
            <p className="mt-0.5 text-xs text-conteudo-faint">
              NFs de importação que incluem este produto
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={<Plus size={13} aria-hidden="true" />}
            onClick={() =>
              onMudar({
                servicos_aduaneiros: [
                  ...form.servicos_aduaneiros,
                  { mes_ano: "", valor: "", nf: "" },
                ],
              })
            }
          >
            Adicionar NF
          </Button>
        </div>

        {form.servicos_aduaneiros.length === 0 ? (
          <p className="py-4 text-center text-xs italic text-conteudo-faint">
            Nenhuma NF adicionada. Clique em "Adicionar NF".
          </p>
        ) : (
          <div className="mb-4 flex flex-col gap-2">
            <div className="grid grid-cols-[100px_1fr_100px_32px] gap-2 px-1 text-xs font-semibold text-conteudo-faint">
              <span>Mês/Ano</span>
              <span>Valor (R$)</span>
              <span>NF</span>
              <span />
            </div>
            {form.servicos_aduaneiros.map((servico, indice) => (
              <div
                key={indice}
                className="grid grid-cols-[100px_1fr_100px_32px] items-center gap-2"
              >
                <CampoDaLinha
                  rotulo={`Mês/ano da NF ${indice + 1}`}
                  placeholder="03/2026"
                  value={servico.mes_ano}
                  onChange={(e) => {
                    const linhas = [...form.servicos_aduaneiros];
                    linhas[indice] = {
                      ...linhas[indice],
                      mes_ano: mascaraDeData(e.target.value),
                    };
                    onMudar({ servicos_aduaneiros: linhas });
                  }}
                />
                <CampoDaLinha
                  rotulo={`Valor da NF ${indice + 1}`}
                  placeholder="221.371,58"
                  value={servico.valor}
                  onChange={(e) => {
                    const linhas = [...form.servicos_aduaneiros];
                    linhas[indice] = {
                      ...linhas[indice],
                      valor: mascaraDeDinheiro(e.target.value),
                    };
                    onMudar({ servicos_aduaneiros: linhas });
                  }}
                />
                <CampoDaLinha
                  rotulo={`Número da NF ${indice + 1}`}
                  placeholder="7858"
                  value={servico.nf}
                  onChange={(e) => {
                    const linhas = [...form.servicos_aduaneiros];
                    linhas[indice] = { ...linhas[indice], nf: e.target.value };
                    onMudar({ servicos_aduaneiros: linhas });
                  }}
                />
                <BotaoRemover
                  rotulo={`Remover a NF ${indice + 1}`}
                  onClick={() =>
                    onMudar({
                      servicos_aduaneiros: form.servicos_aduaneiros.filter(
                        (_, outra) => outra !== indice,
                      ),
                    })
                  }
                />
              </div>
            ))}
            <p className="pt-1 text-right text-xs text-conteudo-muted">
              Total NFs:{" "}
              <span className="font-semibold text-conteudo">
                {formatarDinheiro(calculo.totalAduaneiro)}
              </span>
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 border-t border-borda pt-4">
          <Input
            label="% da NF que é deste produto"
            placeholder="13,9"
            value={form.participacao_pct}
            onChange={(e) => onMudar({ participacao_pct: e.target.value })}
          />
          <Input
            label="Unidades importadas (total NFs)"
            placeholder="510"
            value={form.unidades_importadas}
            onChange={(e) => onMudar({ unidades_importadas: e.target.value })}
          />
        </div>

        {calculo.custoAduaneiroPorUn !== null && (
          <Formula
            conta={`${formatarDinheiro(calculo.totalAduaneiro)} × ${form.participacao_pct}% (NF) ÷ ${form.unidades_importadas} un`}
            resultado={`${formatarDinheiro(calculo.custoAduaneiroPorUn)} / unidade`}
          />
        )}
      </Card>

      <Card padding="lg">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <CardTitle className="text-sm">
              2. Custos Diretos por Unidade
            </CardTitle>
            <p className="mt-0.5 text-xs text-conteudo-faint">
              Produto, embalagem, insumos, frete, etc.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={<Plus size={13} aria-hidden="true" />}
            onClick={() =>
              onMudar({
                custos_diretos: [
                  ...form.custos_diretos,
                  { descricao: "", valor: "" },
                ],
              })
            }
          >
            Adicionar item
          </Button>
        </div>

        {form.custos_diretos.length === 0 ? (
          <p className="py-4 text-center text-xs italic text-conteudo-faint">
            Nenhum custo adicionado. Clique em "Adicionar item".
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-[1fr_140px_32px] gap-2 px-1 text-xs font-semibold text-conteudo-faint">
              <span>Descrição</span>
              <span>Valor / unidade (R$)</span>
              <span />
            </div>
            {form.custos_diretos.map((custo, indice) => (
              <div
                key={indice}
                className="grid grid-cols-[1fr_140px_32px] items-center gap-2"
              >
                <CampoDaLinha
                  rotulo={`Descrição do custo ${indice + 1}`}
                  placeholder="Ex: Caixa, Frete, Produto..."
                  value={custo.descricao}
                  onChange={(e) => {
                    const linhas = [...form.custos_diretos];
                    linhas[indice] = {
                      ...linhas[indice],
                      descricao: e.target.value,
                    };
                    onMudar({ custos_diretos: linhas });
                  }}
                />
                <CampoDaLinha
                  rotulo={`Valor do custo ${indice + 1}`}
                  placeholder="0,00"
                  value={custo.valor}
                  onChange={(e) => {
                    const linhas = [...form.custos_diretos];
                    linhas[indice] = {
                      ...linhas[indice],
                      valor: mascaraDeDinheiro(e.target.value),
                    };
                    onMudar({ custos_diretos: linhas });
                  }}
                />
                <BotaoRemover
                  rotulo={`Remover o custo ${indice + 1}`}
                  onClick={() =>
                    onMudar({
                      custos_diretos: form.custos_diretos.filter(
                        (_, outra) => outra !== indice,
                      ),
                    })
                  }
                />
              </div>
            ))}
            <p className="pt-1 text-right text-xs text-conteudo-muted">
              Total custos diretos:{" "}
              <span className="font-semibold text-conteudo">
                {formatarDinheiro(calculo.totalDireto)} / unidade
              </span>
            </p>
          </div>
        )}
      </Card>

      <Card padding="lg">
        <div className="mb-4">
          <CardTitle className="text-sm">
            3. Custos Variáveis (Overhead)
          </CardTitle>
          <p className="mt-0.5 text-xs text-conteudo-faint">
            Despesas fixas da empresa alocadas proporcionalmente ao produto
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Input
            label="Custo fixo anual da empresa (R$)"
            placeholder="2.636.200,00"
            value={form.estimativa_custos_variaveis_anual}
            onChange={(e) =>
              onMudar({
                estimativa_custos_variaveis_anual: mascaraDeDinheiro(
                  e.target.value,
                ),
              })
            }
          />
          <Input
            label="% deste produto no estoque"
            placeholder="13,9"
            value={form.participacao_overhead_pct}
            onChange={(e) =>
              onMudar({ participacao_overhead_pct: e.target.value })
            }
          />
          <Input
            label="Unidades a vender no ano"
            placeholder="510"
            value={form.quantidade_planejada}
            onChange={(e) => onMudar({ quantidade_planejada: e.target.value })}
          />
        </div>

        {calculo.overheadPorUn !== null && (
          <Formula
            conta={`${formatarDinheiro(calculo.estimativaAnual)} × ${form.participacao_overhead_pct}% ÷ ${form.quantidade_planejada} un`}
            resultado={`${formatarDinheiro(calculo.overheadPorUn)} / unidade`}
          />
        )}
      </Card>

      <Card padding="lg">
        <div className="mb-4">
          <CardTitle className="text-sm">
            4. Preço de Venda{" "}
            <span className="font-normal text-conteudo-faint">(opcional)</span>
          </CardTitle>
          <p className="mt-0.5 text-xs text-conteudo-faint">
            Substitui o ticket médio do sistema para calcular a margem. Se
            vazio, usa o preço médio real das vendas.
          </p>
        </div>
        <Input
          label="Preço unitário (R$)"
          placeholder={
            calculo.ticketMedioSistema
              ? `${calculo.ticketMedioSistema.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (preço médio sistema)`
              : "Ex: 24.500,00"
          }
          value={form.preco_unitario_planejado}
          onChange={(e) =>
            onMudar({
              preco_unitario_planejado: mascaraDeDinheiro(e.target.value),
            })
          }
        />
      </Card>
    </>
  );
}
