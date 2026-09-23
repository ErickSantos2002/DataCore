import {
  Card,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../design-system/ui";
import {
  type Ano,
  type KpiDeAno,
  type PontoAnual,
  type PontoDeVariacao,
  type SeriePorAnoMes,
  type TipoDeReceita,
} from "./financeiro";
import { GraficosDaVisaoGeral } from "./GraficosDaVisaoGeral";
import { KpisPorAno } from "./KpisPorAno";
import { SeletorDeAnos } from "./SeletorDeAnos";
import { TabelaComparativa } from "./TabelaComparativa";

/** As três opções do filtro, com o rótulo que aparece na aba. */
const TIPOS: { valor: TipoDeReceita; rotulo: string }[] = [
  { valor: "combinado", rotulo: "Combinado" },
  { valor: "vendas", rotulo: "Vendas" },
  { valor: "servicos", rotulo: "Serviços" },
];

export interface AbaVisaoGeralProps {
  anosAtivos: Set<Ano>;
  onAlternarAno: (ano: Ano) => void;
  tipo: TipoDeReceita;
  onTipo: (tipo: TipoDeReceita) => void;
  kpis: KpiDeAno[];
  total: SeriePorAnoMes;
  comparativo: PontoAnual[];
  acumulado: PontoAnual[];
  variacao: PontoDeVariacao[];
}

/**
 * A Visão Geral: dois filtros no topo e, abaixo, tudo o que eles recortam.
 *
 * Os dois filtros são de naturezas diferentes e por isso têm controles
 * diferentes. O ano é seleção múltipla — vários ligados ao mesmo tempo — e
 * vira pill com `aria-pressed`. O tipo é escolha única e governa todo o
 * conteúdo abaixo dele, que é exatamente o que uma aba faz: por isso o
 * conteúdo mora dentro do `TabsContent`, e não solto ao lado da lista de
 * abas — assim o `aria-controls` de cada aba aponta para o painel que ela de
 * fato controla.
 */
export function AbaVisaoGeral({
  anosAtivos,
  onAlternarAno,
  tipo,
  onTipo,
  kpis,
  total,
  comparativo,
  acumulado,
  variacao,
}: AbaVisaoGeralProps) {
  const conteudo = (
    <>
      <KpisPorAno kpis={kpis} />
      <GraficosDaVisaoGeral
        comparativo={comparativo}
        acumulado={acumulado}
        variacao={variacao}
        anosAtivos={anosAtivos}
      />
      <TabelaComparativa total={total} variacao={variacao} />
    </>
  );

  return (
    <Tabs
      value={tipo}
      onChange={(valor) => onTipo(valor as TipoDeReceita)}
      className="flex flex-col gap-4"
    >
      <Card className="flex flex-wrap items-center gap-4">
        <SeletorDeAnos anosAtivos={anosAtivos} onAlternar={onAlternarAno} />
        <div className="h-8 w-px bg-borda" aria-hidden="true" />
        <TabsList>
          {TIPOS.map(({ valor, rotulo }) => (
            <TabsTrigger key={valor} value={valor}>
              {rotulo}
            </TabsTrigger>
          ))}
        </TabsList>
      </Card>

      {TIPOS.map(({ valor }) => (
        <TabsContent key={valor} value={valor} className="flex flex-col gap-4">
          {conteudo}
        </TabsContent>
      ))}
    </Tabs>
  );
}
