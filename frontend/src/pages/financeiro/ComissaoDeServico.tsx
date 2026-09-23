import { Plus, Trash2 } from "lucide-react";

import {
  Button,
  Card,
  CardTitle,
  Input,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "../../design-system/ui";
import { formatarDinheiro, mascaraDeDinheiro } from "../../lib/dinheiro";
import type { FechamentoDeServico } from "./comissaoDeServico";

/** Pessoa + percentual + valor + ações. */
const COLUNAS = 4;

const CELULA = "px-3 py-2 text-right font-mono tabular-nums";

/** A pessoa como a tela a guarda: percentual em texto, em pontos inteiros. */
export interface PessoaDigitada {
  id: string;
  nome: string;
  /** Em pontos percentuais — "100", "75", "50". */
  percentual: string;
}

export interface ComissaoDeServicoProps {
  faturamento: string;
  onFaturamento: (texto: string) => void;
  pessoas: PessoaDigitada[];
  fechamento: FechamentoDeServico;
  onMudarPessoa: (id: string, mudanca: Partial<PessoaDigitada>) => void;
  onAdicionarPessoa: () => void;
  onRemoverPessoa: (id: string) => void;
}

/**
 * O bloco de comissão da equipe de serviço.
 *
 * A leitura importante desta tela é que **o valor de referência não é o que
 * sai do caixa**: os percentuais dos papéis somam mais de 100%, então cada
 * pessoa recebe uma fração daquele número e o total pago é maior que ele. Os
 * dois aparecem lado a lado justamente para que ninguém confunda um com o
 * outro — na planilha, os dois se chamavam "Comissão Total".
 */
export function ComissaoDeServico({
  faturamento,
  onFaturamento,
  pessoas,
  fechamento,
  onMudarPessoa,
  onAdicionarPessoa,
  onRemoverPessoa,
}: ComissaoDeServicoProps) {
  return (
    <Card padding="none">
      <div className="flex flex-wrap items-end justify-between gap-4 px-5 pt-5">
        <div>
          <CardTitle>Comissão de serviço</CardTitle>
          <p className="mt-1 text-sm text-conteudo-muted">
            A escada de metas roda sobre o faturamento de serviços do mês e
            produz um valor de referência; cada pessoa recebe a fração do papel.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon={<Plus size={14} aria-hidden="true" />}
          onClick={onAdicionarPessoa}
        >
          Adicionar pessoa
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-6 px-5 pt-4">
        <Input
          label="Faturamento de serviços"
          placeholder="0,00"
          className="w-56 text-right"
          value={faturamento}
          onChange={(e) => onFaturamento(mascaraDeDinheiro(e.target.value))}
        />
        <div>
          <p className="text-sm text-conteudo-muted">
            Degrau atingido: {fechamento.descricaoDoDegrau}
          </p>
          <p className="mt-1 text-sm text-conteudo-muted">
            Valor de referência:{" "}
            <strong className="font-mono text-conteudo-heading">
              {formatarDinheiro(fechamento.base)}
            </strong>
          </p>
        </div>
      </div>

      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell className="w-[280px] px-3 py-2 text-left">
              Pessoa
            </TableHeaderCell>
            <TableHeaderCell className="w-[140px] px-3 py-2 text-right">
              % do papel
            </TableHeaderCell>
            <TableHeaderCell className="px-3 py-2 text-right">
              Valor
            </TableHeaderCell>
            <TableHeaderCell className="px-3 py-2" />
          </TableRow>
        </TableHead>
        <TableBody>
          {pessoas.length === 0 ? (
            <TableEmpty
              colSpan={COLUNAS}
              message="Ninguém na equipe de serviço. Adicione quem recebe a comissão do mês."
            />
          ) : (
            pessoas.map((pessoa, indice) => (
              <TableRow key={pessoa.id}>
                <TableCell className="px-3 py-2">
                  <input
                    className="input-cc"
                    aria-label={`Nome da pessoa ${indice + 1}`}
                    placeholder="Nome"
                    value={pessoa.nome}
                    onChange={(e) =>
                      onMudarPessoa(pessoa.id, { nome: e.target.value })
                    }
                  />
                </TableCell>
                <TableCell className="px-3 py-2">
                  <input
                    className="input-cc text-right"
                    aria-label={`Percentual da pessoa ${indice + 1}`}
                    placeholder="100"
                    value={pessoa.percentual}
                    onChange={(e) =>
                      onMudarPessoa(pessoa.id, {
                        percentual: e.target.value.replace(/[^\d,]/g, ""),
                      })
                    }
                  />
                </TableCell>
                <TableCell className={CELULA}>
                  {formatarDinheiro(fechamento.linhas[indice]?.valor ?? 0)}
                </TableCell>
                <TableCell className="px-3 py-2">
                  <button
                    type="button"
                    aria-label={`Remover a pessoa ${indice + 1}`}
                    onClick={() => onRemoverPessoa(pessoa.id)}
                    className="rounded text-conteudo-faint transition-colors hover:text-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </TableCell>
              </TableRow>
            ))
          )}

          {pessoas.length > 0 && (
            <TableRow className="border-t-2 border-borda-strong bg-surface-elevated font-bold">
              <TableCell className="px-3 py-3" colSpan={2}>
                Total de serviço
              </TableCell>
              <TableCell className={`${CELULA} py-3 text-conteudo-heading`}>
                {formatarDinheiro(fechamento.totalAPagar)}
              </TableCell>
              <TableCell className="px-3 py-3" />
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
