import { Plus, Trash2 } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "../../design-system/ui";
import { formatarDinheiro, mascaraDeDinheiro } from "../../lib/dinheiro";
import type { ComissaoDoVendedor, VendedorDigitado } from "./comissaoDeVendas";

/** Vendedor + três canais + dois inativos + cinco resultados. */
const COLUNAS = 11;

/** Célula compacta: são doze colunas, o padding do primitivo não cabe. */
const CELULA = "px-2 py-2 text-right font-mono tabular-nums";

/**
 * A coluna do que o vendedor recebe fica presa à direita.
 *
 * São onze colunas e a tabela rola na horizontal em tela de 1080p — sem o
 * `sticky`, a única coluna que a pessoa veio ver é justamente a que sai de
 * vista ao rolar para conferir os canais. O fundo opaco é obrigatório: sem
 * ele o texto das colunas que passam por baixo aparece através, e a borda à
 * esquerda é o que conta para a pessoa que aquela coluna está flutuando.
 *
 * É a ÚLTIMA coluna de propósito: o botão de remover foi para junto do nome,
 * porque uma coluna de ação depois da coluna presa ficaria escondida atrás
 * dela — e porque é olhando o nome que se decide tirar alguém da lista.
 */
const COLUNA_PRESA = "sticky right-0 z-10 border-l border-borda";

export interface TabelaDeVendedoresProps {
  vendedores: VendedorDigitado[];
  linhas: ComissaoDoVendedor[];
  totalAPagar: number;
  onMudar: (id: string, mudanca: Partial<VendedorDigitado>) => void;
  onAdicionar: () => void;
  onRemover: (id: string) => void;
  onExportar: () => void;
  /** Enquanto os incentivos não forem confirmados, os campos ficam travados. */
  incentivosAtivos: boolean;
}

/**
 * Um percentual escrito como a pessoa lê: `0,75%`, `1%`, `1,5%`.
 *
 * Sem casas fixas de propósito — "1,00%" ao lado de "0,75%" faria parecer que
 * a diferença é de centésimos, quando é de um quarto de ponto.
 */
function percentual(fracao: number): string {
  return `${(fracao * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

/**
 * Campo de uma linha da tabela.
 *
 * É `input` cru, e não o `Input` do design system, porque o rótulo aqui é o
 * cabeçalho da coluna — um só para a coluna inteira. O `aria-label` dá nome
 * ao campo para quem usa leitor de tela e diz de qual vendedor ele é.
 */
function CampoDaLinha({
  rotulo,
  ...props
}: { rotulo: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="input-cc text-right disabled:cursor-not-allowed disabled:opacity-50"
      aria-label={rotulo}
      {...props}
    />
  );
}

/**
 * O fechamento de comissão do mês, uma linha por vendedor.
 *
 * Todo vendedor ativo entra, inclusive quem não vendeu: o rateio de 1% divide
 * pela lista, e quem fica de fora dela perde o mínimo garantido — que existe
 * justamente para quem ainda não formou carteira.
 */
export function TabelaDeVendedores({
  vendedores,
  linhas,
  totalAPagar,
  onMudar,
  onAdicionar,
  onRemover,
  onExportar,
  incentivosAtivos,
}: TabelaDeVendedoresProps) {
  /** Campo de dinheiro: mascara enquanto digita e devolve o texto mascarado. */
  const dinheiro = (id: string, campo: keyof VendedorDigitado) => ({
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      onMudar(id, { [campo]: mascaraDeDinheiro(e.target.value) }),
  });

  return (
    <Card padding="none">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
        <CardTitle>Vendedores</CardTitle>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onExportar}
            disabled={vendedores.length === 0}
          >
            Exportar para Excel
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={14} aria-hidden="true" />}
            onClick={onAdicionar}
          >
            Adicionar vendedor
          </Button>
        </div>
      </div>

      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell className="min-w-[190px] px-2 py-2 text-left">
              Vendedor
            </TableHeaderCell>
            <TableHeaderCell className="min-w-[130px] px-2 py-2 text-right">
              Inbound
            </TableHeaderCell>
            <TableHeaderCell className="min-w-[130px] px-2 py-2 text-right">
              Recompra
            </TableHeaderCell>
            <TableHeaderCell className="min-w-[130px] px-2 py-2 text-right">
              Outbound
            </TableHeaderCell>
            <TableHeaderCell className="min-w-[120px] px-2 py-2 text-right text-conteudo-faint">
              Inbound Plus
            </TableHeaderCell>
            <TableHeaderCell className="px-2 py-2 text-right text-conteudo-faint">
              Recompras ativas
            </TableHeaderCell>
            <TableHeaderCell className="px-2 py-2 text-right">
              Total
            </TableHeaderCell>
            <TableHeaderCell className="whitespace-nowrap px-2 py-2 text-right">
              Alíquotas
            </TableHeaderCell>
            <TableHeaderCell className="px-2 py-2 text-right">
              Comissão
            </TableHeaderCell>
            <TableHeaderCell className="px-2 py-2 text-right">
              Bônus
            </TableHeaderCell>
            <TableHeaderCell
              className={`${COLUNA_PRESA} bg-surface px-2 py-2 text-right`}
            >
              Recebe
            </TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {vendedores.length === 0 ? (
            <TableEmpty
              colSpan={COLUNAS}
              message="Nenhum vendedor no fechamento. Adicione o primeiro para calcular a comissão do mês."
            />
          ) : (
            vendedores.map((vendedor, indice) => {
              const linha = linhas[indice];
              const numero = indice + 1;
              return (
                <TableRow key={vendedor.id}>
                  <TableCell className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      <CampoDaLinha
                        rotulo={`Nome do vendedor ${numero}`}
                        className="input-cc"
                        placeholder="Nome"
                        value={vendedor.nome}
                        onChange={(e) =>
                          onMudar(vendedor.id, { nome: e.target.value })
                        }
                      />
                      <button
                        type="button"
                        aria-label={`Remover o vendedor ${numero}`}
                        onClick={() => onRemover(vendedor.id)}
                        className="shrink-0 rounded text-conteudo-faint transition-colors hover:text-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </TableCell>
                  <TableCell className="px-2 py-2">
                    <CampoDaLinha
                      rotulo={`Inbound do vendedor ${numero}`}
                      placeholder="0,00"
                      value={vendedor.inbound}
                      {...dinheiro(vendedor.id, "inbound")}
                    />
                  </TableCell>
                  <TableCell className="px-2 py-2">
                    <CampoDaLinha
                      rotulo={`Recompra do vendedor ${numero}`}
                      placeholder="0,00"
                      value={vendedor.recompra}
                      {...dinheiro(vendedor.id, "recompra")}
                    />
                  </TableCell>
                  <TableCell className="px-2 py-2">
                    <CampoDaLinha
                      rotulo={`Outbound do vendedor ${numero}`}
                      placeholder="0,00"
                      value={vendedor.outbound}
                      {...dinheiro(vendedor.id, "outbound")}
                    />
                  </TableCell>
                  <TableCell className="px-2 py-2">
                    <CampoDaLinha
                      rotulo={`Inbound Plus do vendedor ${numero}`}
                      placeholder="inativo"
                      disabled={!incentivosAtivos}
                      value={vendedor.inboundPlus}
                      {...dinheiro(vendedor.id, "inboundPlus")}
                    />
                  </TableCell>
                  <TableCell className="px-2 py-2">
                    <CampoDaLinha
                      rotulo={`Recompras ativas do vendedor ${numero}`}
                      placeholder="inativo"
                      disabled={!incentivosAtivos}
                      value={vendedor.recomprasAtivas}
                      onChange={(e) =>
                        onMudar(vendedor.id, {
                          recomprasAtivas: e.target.value.replace(/\D/g, ""),
                        })
                      }
                    />
                  </TableCell>
                  <TableCell className={CELULA}>
                    {formatarDinheiro(linha.total)}
                  </TableCell>
                  <TableCell
                    className={`${CELULA} whitespace-nowrap text-conteudo-muted`}
                  >
                    {`${percentual(linha.aliquotas.inbound)} · ${percentual(linha.aliquotas.recompra)} · ${percentual(linha.aliquotas.outbound)}`}
                  </TableCell>
                  <TableCell className={CELULA}>
                    {formatarDinheiro(linha.comissao)}
                  </TableCell>
                  <TableCell className={CELULA}>
                    {formatarDinheiro(linha.bonus)}
                  </TableCell>
                  <TableCell
                    className={`${CELULA} ${COLUNA_PRESA} bg-surface font-bold text-conteudo-heading`}
                  >
                    {formatarDinheiro(linha.recebe)}
                    {linha.peloRateio && (
                      <div className="mt-1">
                        <Badge variant="info">mínimo garantido</Badge>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}

          {vendedores.length > 0 && (
            <TableRow className="border-t-2 border-borda-strong bg-surface-elevated font-bold">
              <TableCell className="px-2 py-3" colSpan={COLUNAS - 1}>
                Total a pagar
              </TableCell>
              <TableCell
                className={`${CELULA} ${COLUNA_PRESA} bg-surface-elevated py-3 text-conteudo-heading`}
              >
                {formatarDinheiro(totalAPagar)}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
