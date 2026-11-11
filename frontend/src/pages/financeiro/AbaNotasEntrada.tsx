import React, { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Search } from "lucide-react";

import {
  Alert,
  Badge,
  Card,
  CardTitle,
  ChartEmpty,
  Input,
  KpiCard,
  Modal,
  Pagination,
  RankedList,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "../../design-system/ui";
import {
  chartTheme,
  corDaSerie,
  useTemaDoGrafico,
} from "../../design-system/chartTheme";
import { dataDeCalendario } from "../../lib/datas";
import { formatarDinheiroAbreviado } from "../../lib/dinheiro";
import {
  fetchItensDaEntrada,
  fetchPaginaDeEntradas,
  fetchResumoDeEntradas,
  type ItemDaEntrada,
  type NotaDeEntrada,
  type PaginaDeEntradas,
  type ResumoDeEntradas,
  type SituacaoDeEntrada,
  type TipoDeEntrada,
} from "../../services/notasEntrada";
import { ANOS, formatarMoeda } from "./financeiro";
import {
  ITENS_POR_PAGINA,
  ROTULO_DA_SITUACAO,
  ROTULO_DO_TIPO,
  SITUACOES,
  SITUACOES_PADRAO,
  TIPOS,
  VARIANTE_DA_SITUACAO,
  alternarSituacao,
  datasDoPeriodo,
  rotuloDoMes,
  type Periodo,
} from "./notasEntrada";

const ALTURA_DO_GRAFICO = 260;
const COLUNAS = 7;

type CampoDeOrdem = "numero" | "data_emissao" | "remetente" | "valor";

/** Botão de filtro: `aria-pressed`, porque refaz o conteúdo, não troca de painel. */
function BotaoDeFiltro({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={[
        "rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus",
        ativo
          ? "border-action bg-action text-on-primary"
          : "border-borda text-conteudo-muted hover:bg-surface-elevated",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/**
 * Notas de Entrada — o que entrou na empresa: compras, importações, devoluções
 * de cliente e equipamentos recebidos para conserto.
 *
 * Pedido do dono e do financeiro em 11/11/2026, sem lista fechada de campos: a aba
 * resume (indicadores, mês a mês, tipo, maiores remetentes) e a tabela dá o
 * detalhe, nota a nota, com os itens num clique. Toda soma vem do banco
 * (`/notas_entrada/resumo`); a tabela é paginada no servidor.
 */
const AbaNotasEntrada: React.FC = () => {
  useTemaDoGrafico();
  const [periodo, setPeriodo] = useState<Periodo>(ANOS[ANOS.length - 1]);
  const [situacoes, setSituacoes] =
    useState<SituacaoDeEntrada[]>(SITUACOES_PADRAO);
  const [tipo, setTipo] = useState<TipoDeEntrada | null>(null);
  const [digitado, setDigitado] = useState("");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [ordem, setOrdem] = useState<{
    campo: CampoDeOrdem;
    direcao: "asc" | "desc";
  }>({ campo: "data_emissao", direcao: "desc" });
  const [notaAberta, setNotaAberta] = useState<NotaDeEntrada | null>(null);

  const recorte = {
    ...datasDoPeriodo(periodo),
    situacao: situacoes,
    tipo: tipo ? [tipo] : undefined,
  };
  // A chave do que está na tela: o "carregando" sai dela, derivado, no mesmo
  // render em que o filtro muda — sem o render intermediário com o número velho.
  const chaveDoResumo = JSON.stringify(recorte);
  const chaveDaPagina = JSON.stringify({ recorte, busca, pagina, ordem });

  const [resumo, setResumo] = useState<{
    chave: string;
    dados: ResumoDeEntradas | null;
  } | null>(null);
  const [lista, setLista] = useState<{
    chave: string;
    dados: PaginaDeEntradas | null;
  } | null>(null);

  useEffect(() => {
    let vivo = true;
    fetchResumoDeEntradas(JSON.parse(chaveDoResumo))
      .then((dados) => vivo && setResumo({ chave: chaveDoResumo, dados }))
      .catch((falha) => {
        console.error("Erro ao carregar o resumo das notas de entrada:", falha);
        if (vivo) setResumo({ chave: chaveDoResumo, dados: null });
      });
    return () => {
      vivo = false;
    };
  }, [chaveDoResumo]);

  useEffect(() => {
    let vivo = true;
    const {
      recorte: r,
      busca: b,
      pagina: p,
      ordem: o,
    } = JSON.parse(chaveDaPagina);
    fetchPaginaDeEntradas({
      ...r,
      busca: b || undefined,
      ordenar_por: o.campo,
      direcao: o.direcao,
      limite: ITENS_POR_PAGINA,
      offset: (p - 1) * ITENS_POR_PAGINA,
    })
      .then((dados) => vivo && setLista({ chave: chaveDaPagina, dados }))
      .catch((falha) => {
        console.error("Erro ao carregar as notas de entrada:", falha);
        if (vivo) setLista({ chave: chaveDaPagina, dados: null });
      });
    return () => {
      vivo = false;
    };
  }, [chaveDaPagina]);

  const carregandoResumo = resumo?.chave !== chaveDoResumo;
  const carregandoLista = lista?.chave !== chaveDaPagina;
  const falhou =
    (!carregandoResumo && resumo?.dados === null) ||
    (!carregandoLista && lista?.dados === null);

  // Todo filtro novo volta para a primeira página: na página 7 de um recorte que
  // passou a ter duas, a tabela ficaria vazia sem motivo aparente.
  function filtrar(aplicar: () => void) {
    aplicar();
    setPagina(1);
  }

  function ordenar(campo: CampoDeOrdem) {
    filtrar(() =>
      setOrdem((atual) =>
        atual.campo === campo
          ? { campo, direcao: atual.direcao === "asc" ? "desc" : "asc" }
          : { campo, direcao: campo === "remetente" ? "asc" : "desc" },
      ),
    );
  }

  const dadosDoResumo = carregandoResumo ? null : (resumo?.dados ?? null);
  const dadosDaLista = carregandoLista ? null : (lista?.dados ?? null);
  const contagem = Object.fromEntries(
    (resumo?.dados?.por_situacao ?? []).map((s) => [s.situacao, s.quantidade]),
  ) as Partial<Record<SituacaoDeEntrada, number>>;

  return (
    <div className="flex flex-col gap-4">
      <Card padding="lg" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-conteudo-muted">
            Ano:
          </span>
          {ANOS.map((ano) => (
            <BotaoDeFiltro
              key={ano}
              ativo={periodo === ano}
              onClick={() => filtrar(() => setPeriodo(ano))}
            >
              {ano}
            </BotaoDeFiltro>
          ))}
          <BotaoDeFiltro
            ativo={periodo === "todos"}
            onClick={() => filtrar(() => setPeriodo("todos"))}
          >
            Todo o histórico
          </BotaoDeFiltro>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-conteudo-muted">
            Situação:
          </span>
          {SITUACOES.map((s) => (
            <BotaoDeFiltro
              key={s}
              ativo={situacoes.includes(s)}
              onClick={() =>
                filtrar(() =>
                  setSituacoes((atuais) => alternarSituacao(atuais, s)),
                )
              }
            >
              {ROTULO_DA_SITUACAO[s]}
              {contagem[s] !== undefined ? ` (${contagem[s]})` : ""}
            </BotaoDeFiltro>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-conteudo-muted">
            Tipo:
          </span>
          <BotaoDeFiltro
            ativo={tipo === null}
            onClick={() => filtrar(() => setTipo(null))}
          >
            Todos
          </BotaoDeFiltro>
          {TIPOS.map((t) => (
            <BotaoDeFiltro
              key={t}
              ativo={tipo === t}
              onClick={() => filtrar(() => setTipo(t))}
            >
              {ROTULO_DO_TIPO[t]}
            </BotaoDeFiltro>
          ))}
        </div>
      </Card>

      {falhou && (
        <Alert variant="danger" title="As notas de entrada não carregaram">
          Não foi possível buscar as notas de entrada. Tente de novo em
          instantes.
        </Alert>
      )}

      {carregandoResumo ? (
        <div className="flex justify-center p-8">
          <Spinner size="lg" />
        </div>
      ) : (
        dadosDoResumo && (
          <>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4">
              <KpiCard
                label="Valor das entradas"
                value={formatarMoeda(dadosDoResumo.valor_total)}
                tone="acao"
              />
              <KpiCard
                label="Notas de entrada"
                value={dadosDoResumo.quantidade}
              />
              <KpiCard
                label="Remetentes"
                value={dadosDoResumo.remetentes}
                note="Fornecedores e clientes distintos"
              />
              <KpiCard
                label="Importação"
                value={formatarMoeda(dadosDoResumo.importacao_valor)}
                note={`${dadosDoResumo.importacao_quantidade} notas do exterior`}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card padding="lg" className="lg:col-span-2">
                <CardTitle className="mb-4">Entradas por mês</CardTitle>
                {dadosDoResumo.por_mes.length === 0 ? (
                  <ChartEmpty
                    height={ALTURA_DO_GRAFICO}
                    message="Nenhuma nota de entrada no período."
                  />
                ) : (
                  <ResponsiveContainer width="100%" height={ALTURA_DO_GRAFICO}>
                    <BarChart
                      data={dadosDoResumo.por_mes.map((m) => ({
                        ...m,
                        rotulo: rotuloDoMes(m.mes),
                      }))}
                      margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={chartTheme.grid.stroke}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="rotulo"
                        tick={{ fill: chartTheme.axis.stroke, fontSize: 12 }}
                        axisLine={{ stroke: chartTheme.grid.stroke }}
                      />
                      <YAxis
                        tickFormatter={formatarDinheiroAbreviado}
                        tick={{ fill: chartTheme.axis.stroke, fontSize: 12 }}
                        width={80}
                        axisLine={{ stroke: chartTheme.grid.stroke }}
                      />
                      <Tooltip
                        contentStyle={chartTheme.tooltip}
                        itemStyle={chartTheme.tooltipItem}
                        formatter={(valor, _nome, item) => [
                          `${formatarMoeda(Number(valor))} · ${item.payload.quantidade} nota(s)`,
                          "Entradas",
                        ]}
                      />
                      <Bar
                        dataKey="valor"
                        name="Entradas"
                        fill={corDaSerie(0)}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>

              <Card padding="lg">
                <CardTitle className="mb-4">Por tipo de entrada</CardTitle>
                <RankedList
                  items={dadosDoResumo.por_tipo
                    .filter((t) => t.quantidade > 0)
                    .sort((a, b) => b.valor - a.valor)
                    .map((t) => ({
                      key: t.tipo,
                      nome: `${ROTULO_DO_TIPO[t.tipo]} · ${t.quantidade} nota(s)`,
                      valor: t.valor,
                      valorFormatado: formatarMoeda(t.valor),
                    }))}
                />
                {dadosDoResumo.quantidade === 0 && (
                  <p className="text-sm text-conteudo-muted">
                    Nenhuma nota de entrada no período.
                  </p>
                )}
              </Card>

              <Card padding="lg">
                <CardTitle className="mb-4">Maiores remetentes</CardTitle>
                <RankedList
                  items={dadosDoResumo.maiores_remetentes.map((r, i) => ({
                    key: `${i}-${r.remetente}`,
                    nome: `${r.remetente}${r.uf ? ` (${r.uf})` : ""}`,
                    valor: r.valor,
                    valorFormatado: formatarMoeda(r.valor),
                  }))}
                />
                {dadosDoResumo.maiores_remetentes.length === 0 && (
                  <p className="text-sm text-conteudo-muted">
                    Nenhuma nota de entrada no período.
                  </p>
                )}
              </Card>
            </div>
          </>
        )
      )}

      <Card padding="lg" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <CardTitle>Notas de entrada</CardTitle>
          <form
            className="w-full max-w-sm"
            onSubmit={(evento) => {
              evento.preventDefault();
              filtrar(() => setBusca(digitado.trim()));
            }}
          >
            <Input
              aria-label="Buscar nota de entrada"
              placeholder="Remetente, número ou CNPJ — Enter para buscar"
              icon={<Search size={16} />}
              value={digitado}
              onChange={(evento) => setDigitado(evento.target.value)}
            />
          </form>
        </div>

        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell
                sortable
                sorted={ordem.campo === "numero" ? ordem.direcao : null}
                onSort={() => ordenar("numero")}
              >
                Nº
              </TableHeaderCell>
              <TableHeaderCell
                sortable
                sorted={ordem.campo === "data_emissao" ? ordem.direcao : null}
                onSort={() => ordenar("data_emissao")}
              >
                Emissão
              </TableHeaderCell>
              <TableHeaderCell
                sortable
                sorted={ordem.campo === "remetente" ? ordem.direcao : null}
                onSort={() => ordenar("remetente")}
              >
                Remetente
              </TableHeaderCell>
              <TableHeaderCell>UF</TableHeaderCell>
              <TableHeaderCell>Tipo</TableHeaderCell>
              <TableHeaderCell>Situação</TableHeaderCell>
              <TableHeaderCell
                sortable
                sorted={ordem.campo === "valor" ? ordem.direcao : null}
                onSort={() => ordenar("valor")}
                className="text-right"
              >
                Valor
              </TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {carregandoLista ? (
              <TableEmpty colSpan={COLUNAS} message="Carregando notas..." />
            ) : !dadosDaLista || dadosDaLista.itens.length === 0 ? (
              <TableEmpty
                colSpan={COLUNAS}
                message="Nenhuma nota de entrada encontrada."
              />
            ) : (
              dadosDaLista.itens.map((nota) => (
                <TableRow
                  key={nota.id}
                  clickable
                  tabIndex={0}
                  aria-label={`Ver itens da nota ${nota.numero ?? nota.id}`}
                  onClick={() => setNotaAberta(nota)}
                  onKeyDown={(evento) => {
                    if (evento.key === "Enter") setNotaAberta(nota);
                  }}
                >
                  <TableCell>{nota.numero ?? "-"}</TableCell>
                  <TableCell muted>
                    {dataDeCalendario(nota.data_emissao)}
                  </TableCell>
                  <TableCell>{nota.remetente}</TableCell>
                  <TableCell muted>{nota.uf ?? "-"}</TableCell>
                  <TableCell>
                    <span className="inline-flex flex-wrap items-center gap-1">
                      {ROTULO_DO_TIPO[nota.tipo]}
                      {nota.importacao && (
                        <Badge variant="info">Importação</Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={VARIANTE_DA_SITUACAO[nota.situacao]}>
                      {nota.descricao_situacao ||
                        ROTULO_DA_SITUACAO[nota.situacao]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatarMoeda(nota.valor)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {dadosDaLista && (
          <Pagination
            page={pagina}
            pageSize={ITENS_POR_PAGINA}
            total={dadosDaLista.total}
            itemLabel="notas"
            onPageChange={setPagina}
          />
        )}
      </Card>

      {notaAberta && (
        <ItensDaNota nota={notaAberta} onFechar={() => setNotaAberta(null)} />
      )}
    </div>
  );
};

/** Os itens da nota, num modal montado só quando aberto. */
function ItensDaNota({
  nota,
  onFechar,
}: {
  nota: NotaDeEntrada;
  onFechar: () => void;
}) {
  const [itens, setItens] = useState<ItemDaEntrada[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetchItensDaEntrada(nota.id)
      .then((dados) => vivo && setItens(dados))
      .catch(
        () => vivo && setErro("Não foi possível carregar os itens da nota."),
      );
    return () => {
      vivo = false;
    };
  }, [nota.id]);

  return (
    <Modal
      open
      onClose={onFechar}
      size="xl"
      title={`Nota ${nota.numero ?? nota.id} · ${nota.remetente}`}
      erro={erro}
    >
      <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-conteudo-muted">Emissão</dt>
        <dd>{dataDeCalendario(nota.data_emissao)}</dd>
        <dt className="text-conteudo-muted">Natureza</dt>
        <dd>{nota.natureza_operacao || "-"}</dd>
        <dt className="text-conteudo-muted">CNPJ/CPF</dt>
        <dd>{nota.cpf_cnpj || "-"}</dd>
        <dt className="text-conteudo-muted">Chave de acesso</dt>
        <dd className="break-all">{nota.chave_acesso || "-"}</dd>
        <dt className="text-conteudo-muted">Valor da nota</dt>
        <dd className="font-semibold">{formatarMoeda(nota.valor)}</dd>
      </dl>
      {itens === null && !erro ? (
        <div className="flex justify-center p-6">
          <Spinner />
        </div>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Código</TableHeaderCell>
              <TableHeaderCell>Descrição</TableHeaderCell>
              <TableHeaderCell>CFOP</TableHeaderCell>
              <TableHeaderCell className="text-right">Qtd.</TableHeaderCell>
              <TableHeaderCell className="text-right">Unitário</TableHeaderCell>
              <TableHeaderCell className="text-right">Total</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(itens ?? []).length === 0 ? (
              <TableEmpty colSpan={6} message="Nota sem itens." />
            ) : (
              (itens ?? []).map((item) => (
                <TableRow key={item.id}>
                  <TableCell muted>{item.codigo || "-"}</TableCell>
                  <TableCell>{item.descricao || "-"}</TableCell>
                  <TableCell muted>{item.cfop || "-"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {item.quantidade.toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatarMoeda(item.valor_unitario)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatarMoeda(item.valor_total)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}
    </Modal>
  );
}

export default AbaNotasEntrada;
