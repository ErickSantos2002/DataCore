import { createContext, useContext, useEffect, useState } from "react";
import { fetchFaturamentoMensal } from "../services/notasapi";
import { useConfiguracoes } from "./ConfiguracoesContext";
import { rotuloDoMes } from "./mes";

interface FaturamentoMensal {
  mes: string;
  total: number;
}

interface DashboardContextType {
  /** Os meses do trimestre em apuração (MESES_ANALISE). */
  dados: FaturamentoMensal[];
  /** A soma do trimestre — o número que os velocímetros medem. */
  total: number;
  /** O faturamento do ano corrente inteiro. */
  totalAno: number;
  /** Janeiro até o mês corrente, para o gráfico de barras. Sai da MESMA
   *  requisição do `totalAno`: é a quebra por mês que antes era jogada fora. */
  serieMensal: FaturamentoMensal[];
  /** O faturamento de cada mês do ANO ANTERIOR, índice 0 = janeiro. É a forma
   *  sazonal sobre a qual a projeção de fechamento estima o que falta do
   *  trimestre. Vazio quando não há dado do ano anterior — e aí a projeção
   *  cai no método linear e a tela diz que caiu. */
  totaisAnoAnterior: number[];
  carregando: boolean;
}

const DashboardContext = createContext<DashboardContextType>({
  dados: [],
  total: 0,
  totalAno: 0,
  serieMensal: [],
  totaisAnoAnterior: [],
  carregando: true,
});

export const DashboardProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [dados, setDados] = useState<FaturamentoMensal[]>([]);
  const [total, setTotal] = useState(0);
  const [totalAno, setTotalAno] = useState(0);
  const [serieMensal, setSerieMensal] = useState<FaturamentoMensal[]>([]);
  const [totaisAnoAnterior, setTotaisAnoAnterior] = useState<number[]>([]);
  const [carregando, setCarregando] = useState(true);

  const { configuracoes, carregando: carregandoConfig } = useConfiguracoes();

  useEffect(() => {
    const carregar = async () => {
      if (carregandoConfig) return;

      function getArray(chave: string): string[] {
        const config = configuracoes.find((c) => c.chave === chave);
        return config?.valor?.split(",").map((v) => v.trim()) || [];
      }

      // CFOP_VALIDOS e MARCADORES_INVALIDOS nao sao mais lidos aqui: o que conta
      // como faturamento e decidido na camada `gold` e chega pronto pela API.
      // A configuracao continua existindo para quem ainda filtra no navegador —
      // ver as outras telas — mas esta parou de ter uma copia da regua.

      // MESES_ANALISE é 1-based (1 = janeiro), do jeito que se digita em
      // Configurações. O Date do JS conta mês a partir de 0 — daí o -1 abaixo.
      const meses = getArray("MESES_ANALISE")
        .map(Number)
        .filter((m) => Number.isInteger(m) && m >= 1 && m <= 12);

      const hoje = new Date();
      const anoAtual = hoje.getFullYear();

      // O ano corrente inteiro, em UMA requisição de doze linhas. Dela saem as
      // TRÊS leituras que a tela faz: o total do ano, a quebra mês a mês do
      // gráfico e os meses do trimestre em apuração.
      //
      // O trimestre sai daqui, e não de requisições próprias: ele é um recorte
      // dos mesmos doze meses. Já foi um laço de seis requisições, apagado
      // depois de rodar os dois caminhos lado a lado contra a base real (24
      // pares conferidos, diferença máxima de 7e-10 — ruído de ponto
      // flutuante). Continua valendo, e agora por um motivo mais forte: quem
      // separa os meses é o banco, não esta tela.
      let totalAnoCompleto = 0;
      let serieDoAno: FaturamentoMensal[] = [];
      let mesesEmApuracao: FaturamentoMensal[] = [];

      try {
        const totais = await totaisDoAno(anoAtual);
        totalAnoCompleto = totais.reduce((acc, valor) => acc + valor, 0);
        // Mês futuro ficaria como barra vazia no fim do gráfico, sugerindo
        // queda onde só há calendário. O gráfico para no mês corrente.
        serieDoAno = totais
          .slice(0, hoje.getMonth() + 1)
          .map((valor, indice) => ({
            mes: rotuloDoMes(indice + 1, anoAtual),
            total: valor,
          }));
        mesesEmApuracao = meses.map((mes) => ({
          mes: rotuloDoMes(mes, anoAtual),
          total: totais[mes - 1],
        }));
      } catch (err) {
        console.error("Erro ao buscar total do ano", err);
      }

      const totalQuadrimestre = mesesEmApuracao.reduce(
        (acc, cur) => acc + cur.total,
        0,
      );

      // O ano anterior: a forma sazonal que a projeção de fechamento usa para
      // estimar o que falta do trimestre. Falhar aqui não derruba a tela — sem
      // esta série a projeção cai no método linear e diz na tela que caiu.
      //
      // Segue DEPOIS do ano corrente, e não em paralelo. O motivo original era
      // que as quatro requisições pesadas disputavam a API (1.421 ms em
      // paralelo contra 1.072 ms em série, medido). Agora são duas requisições
      // de doze linhas e a disputa não existe mais; manter em série é só o
      // custo de uma viagem, e não vale reescrever sem medir de novo.
      let totaisDoAnoAnterior: number[] = [];

      try {
        totaisDoAnoAnterior = await totaisDoAno(anoAtual - 1);
      } catch (err) {
        console.error("Erro ao buscar o faturamento do ano anterior", err);
      }

      setDados(mesesEmApuracao);
      setTotal(totalQuadrimestre);
      setTotalAno(totalAnoCompleto);
      setSerieMensal(serieDoAno);
      setTotaisAnoAnterior(totaisDoAnoAnterior);
      setCarregando(false);
    };

    carregar();
  }, [carregandoConfig, configuracoes]);

  return (
    <DashboardContext.Provider
      value={{
        dados,
        total,
        totalAno,
        serieMensal,
        totaisAnoAnterior,
        carregando,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => useContext(DashboardContext);

// Helpers

/** O faturamento de cada mês de um ano, em doze posições — índice 0 é janeiro.
 *
 *  UMA requisição, e a soma já vem pronta do banco.
 *
 *  Antes eram duas (as notas de venda e as de serviço do ano inteiro), e a
 *  soma acontecia aqui: milhares de notas com cliente, itens e marcadores
 *  dentro trafegavam para virar doze números. Pior que o peso era a régua —
 *  filtrar CFOP e marcador aqui significava manter, no navegador, uma terceira
 *  cópia da definição de faturamento, que ninguém sincronizava com a do
 *  backend nem com a do dbt.
 *
 *  Agora a régua mora num lugar só, na camada `gold`. Aqui só se lê.
 *
 *  A API devolve sempre doze linhas, com zero em mês sem nota — por isso não
 *  há preenchimento de buraco deste lado. `total` é produto (NF-e) mais
 *  serviço (NFS-e), a mesma soma que esta tela sempre mostrou.
 */
async function totaisDoAno(ano: number): Promise<number[]> {
  const linhas = await fetchFaturamentoMensal(ano);

  const totais = Array<number>(12).fill(0);
  for (const linha of linhas) {
    // Defensivo de propósito: mês fora de 1..12 seria índice inválido, e
    // `totais[-1] = x` em JS não estoura — cria uma propriedade "-1" no array
    // e some do gráfico sem erro nenhum.
    if (linha.mes >= 1 && linha.mes <= 12) {
      totais[linha.mes - 1] = linha.total;
    }
  }
  return totais;
}
