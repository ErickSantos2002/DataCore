import { Badge, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "../../design-system/ui";
import { dataDeCalendario } from "../../lib/datas";
import type { ContaDaTela } from "../../services/notasapi";
import { formatarMoeda } from "../contas/contas";
import { SeloDeSituacao } from "../contas/TabelaDeContas";
import { diasDeAtraso } from "./inadimplencia";

const DIALETO = { chaveQuitado: "recebido" };
const CABECALHO = ["ID Tiny", "Vencimento", "Emissão", "Cliente", "Categoria", "Valor", "Saldo", "Situação", "Atraso"];

/**
 * Os títulos em aberto da empresa, agrupados por filial, com as colunas da tabela
 * de Contas a Receber e mais o Atraso. Os a vencer vão juntos no fim, à parte.
 */
export function TitulosDaEmpresa({ titulos, hoje }: { titulos: ContaDaTela[]; hoje: Date }) {
  const vencidos = titulos.filter((t) => diasDeAtraso(t.vencimento, hoje) > 0);
  const aVencer = titulos.filter((t) => diasDeAtraso(t.vencimento, hoje) === 0);
  const porFilial = new Map<string, ContaDaTela[]>();
  for (const t of vencidos) {
    const chave = t.cliente_cpf_cnpj ?? t.cliente_nome ?? "";
    porFilial.set(chave, [...(porFilial.get(chave) ?? []), t]);
  }
  const grupos = [...porFilial.values()].sort(
    (a, b) => b.reduce((s, t) => s + t.saldo, 0) - a.reduce((s, t) => s + t.saldo, 0),
  );

  if (titulos.length === 0) return <p className="py-8 text-center text-conteudo-muted">Nenhum título em aberto.</p>;
  return (
    <div className="flex flex-col gap-6">
      {grupos.map((g) => (
        <Grupo key={g[0].cliente_cpf_cnpj ?? g[0].cliente_nome} titulo={`${g[0].cliente_nome} · ${g[0].cliente_cpf_cnpj ?? ""}`} titulos={g} hoje={hoje} />
      ))}
      {aVencer.length ? <Grupo titulo="A vencer" titulos={aVencer} hoje={hoje} /> : null}
    </div>
  );
}

function Grupo({ titulo, titulos, hoje }: { titulo: string; titulos: ContaDaTela[]; hoje: Date }) {
  const subtotal = titulos.reduce((s, t) => s + t.saldo, 0);
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <h3 className="text-sm font-semibold text-conteudo-heading">{titulo}</h3>
        <span className="font-mono text-sm font-semibold">{formatarMoeda(subtotal)}</span>
      </div>
      <Table>
        <TableHead>
          <TableRow>{CABECALHO.map((c) => <TableHeaderCell key={c}>{c}</TableHeaderCell>)}</TableRow>
        </TableHead>
        <TableBody>
          {titulos.map((t) => {
            const dias = diasDeAtraso(t.vencimento, hoje);
            return (
              <TableRow key={t.id}>
                <TableCell muted className="font-mono text-xs">{t.id_tiny}</TableCell>
                <TableCell muted className="whitespace-nowrap font-mono text-xs">{dataDeCalendario(t.vencimento)}</TableCell>
                <TableCell muted className="whitespace-nowrap font-mono text-xs">{dataDeCalendario(t.emissao)}</TableCell>
                <TableCell className="min-w-[180px]">
                  <p className="font-medium">{t.cliente_nome}</p>
                  {t.cliente_cpf_cnpj ? <p className="font-mono text-xs text-conteudo-muted">{t.cliente_cpf_cnpj}</p> : null}
                </TableCell>
                <TableCell muted>{t.categoria ?? "-"}</TableCell>
                <TableCell className="whitespace-nowrap font-mono font-semibold text-action">{formatarMoeda(t.valor)}</TableCell>
                <TableCell className="whitespace-nowrap font-mono font-semibold">{formatarMoeda(t.saldo)}</TableCell>
                <TableCell><SeloDeSituacao conta={t} dialeto={DIALETO} /></TableCell>
                <TableCell>{dias > 0 ? <Badge variant={dias > 30 ? "danger" : "warning"}>{dias} dias</Badge> : "—"}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </section>
  );
}
