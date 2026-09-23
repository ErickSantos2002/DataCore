import React from "react";

import {
  Badge,
  Card,
  CardTitle,
  Input,
  Pagination,
  Select,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "../../design-system/ui";
import type { Execucao, Importacao } from "../../services/operacao";
import {
  agruparPorDia,
  descreverContagens,
  formatarDuracao,
  formatarInstante,
  rotuloDaExecucao,
  type TomDoEstado,
} from "./importacoes";

const VARIANTE: Record<
  TomDoEstado,
  "success" | "danger" | "warning" | "info" | "muted"
> = {
  ok: "success",
  erro: "danger",
  alerta: "warning",
  info: "info",
  neutro: "muted",
};

export interface FiltroDoHistorico {
  job: string;
  de: string;
  ate: string;
  origem: "" | "agendada" | "manual";
  apenasProblemas: boolean;
}

export interface HistoricoDeExecucoesProps {
  execucoes: Execucao[];
  total: number;
  pagina: number;
  tamanho: number;
  carregando: boolean;
  /** Para o seletor de carga e para traduzir `job` em nome legível. */
  importacoes: Importacao[];
  filtro: FiltroDoHistorico;
  onFiltro: (filtro: FiltroDoHistorico) => void;
  onPagina: (pagina: number) => void;
}

/**
 * O histórico: "a importação do dia 15 funcionou?" em um filtro e uma olhada.
 *
 * As linhas vêm **agrupadas por dia** porque é assim que a pergunta é feita —
 * uma lista corrida de trinta execuções obriga a ler data em toda linha para
 * achar o dia que interessa.
 *
 * O `detalhe` aparece inteiro na linha que falhou, e só nela. É onde mora a
 * frase que explica o problema — `Falha ao consultar ADN no NSU 1633 após 4
 * tentativas (HTTP 404)` — e escondê-la atrás de um clique transformaria a
 * resposta em mais um passo.
 */
export function HistoricoDeExecucoes({
  execucoes,
  total,
  pagina,
  tamanho,
  carregando,
  importacoes,
  filtro,
  onFiltro,
  onPagina,
}: HistoricoDeExecucoesProps) {
  const dias = agruparPorDia(execucoes);
  const nomeDoJob = (job: string) =>
    importacoes.find((i) => i.job === job)?.rotulo ?? job;

  return (
    <Card padding="lg">
      <CardTitle>Histórico</CardTitle>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[12rem]">
          <Select
            label="Importação"
            value={filtro.job}
            onChange={(e) => onFiltro({ ...filtro, job: e.target.value })}
            options={[
              { value: "", label: "Todas" },
              ...importacoes.map((i) => ({ value: i.job, label: i.rotulo })),
            ]}
          />
        </div>

        <Input
          label="De"
          type="date"
          value={filtro.de}
          onChange={(e) => onFiltro({ ...filtro, de: e.target.value })}
        />

        <Input
          label="Até"
          type="date"
          value={filtro.ate}
          onChange={(e) => onFiltro({ ...filtro, ate: e.target.value })}
        />

        <div className="min-w-[10rem]">
          <Select
            label="Origem"
            value={filtro.origem}
            onChange={(e) =>
              onFiltro({
                ...filtro,
                origem: e.target.value as FiltroDoHistorico["origem"],
              })
            }
            options={[
              { value: "", label: "Todas" },
              { value: "agendada", label: "Automática" },
              { value: "manual", label: "Rodada à mão" },
            ]}
          />
        </div>

        <label className="flex items-center gap-2 pb-2 text-sm text-conteudo">
          <input
            type="checkbox"
            checked={filtro.apenasProblemas}
            onChange={(e) =>
              onFiltro({ ...filtro, apenasProblemas: e.target.checked })
            }
          />
          Só o que deu problema
        </label>
      </div>

      <div className="mt-4">
        {carregando ? (
          <div className="flex items-center gap-3 p-6 text-conteudo-muted">
            <Spinner size="sm" />
            <span>Carregando histórico...</span>
          </div>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Início</TableHeaderCell>
                <TableHeaderCell>Importação</TableHeaderCell>
                <TableHeaderCell>Resultado</TableHeaderCell>
                <TableHeaderCell>Duração</TableHeaderCell>
                <TableHeaderCell>O que trouxe</TableHeaderCell>
                <TableHeaderCell>Origem</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {execucoes.length === 0 && (
                <TableEmpty
                  colSpan={6}
                  message="Nenhuma execução no período escolhido."
                />
              )}

              {dias.map((dia) => (
                <React.Fragment key={dia.dia}>
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="bg-surface-base text-xs font-semibold uppercase tracking-wide text-conteudo-muted"
                    >
                      {dia.dia}
                    </TableCell>
                  </TableRow>

                  {dia.execucoes.map((execucao) => {
                    const selo = rotuloDaExecucao(execucao);
                    return (
                      <TableRow key={execucao.id}>
                        <TableCell>
                          {formatarInstante(execucao.inicio)}
                        </TableCell>
                        <TableCell>{nomeDoJob(execucao.job)}</TableCell>
                        <TableCell>
                          <Badge variant={VARIANTE[selo.tom]}>
                            {selo.texto}
                          </Badge>
                          {execucao.detalhe && selo.tom !== "ok" && (
                            <span className="mt-1 block text-xs text-conteudo-muted">
                              {execucao.detalhe}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {formatarDuracao(execucao.duracao_seg)}
                        </TableCell>
                        <TableCell className="text-conteudo-muted">
                          {descreverContagens(execucao.contagens)}
                        </TableCell>
                        <TableCell className="text-conteudo-muted">
                          {execucao.origem === "agendada"
                            ? "Automática"
                            : "À mão"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Pagination
        page={pagina}
        pageSize={tamanho}
        total={total}
        onPageChange={onPagina}
        itemLabel="execuções"
      />
    </Card>
  );
}
