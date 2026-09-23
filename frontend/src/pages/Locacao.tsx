import React, { useCallback, useEffect, useMemo, useState } from "react";

import { Alert, Spinner } from "../design-system/ui";
import { useAuth } from "../hooks/useAuth";
import { baixarPlanilha } from "../lib/planilha";
import { fetchLocacao, type NotaLocacao } from "../services/notasapi";
import { CabecalhoLocacao } from "./locacao/CabecalhoLocacao";
import { ResumoLocacao } from "./locacao/ResumoLocacao";
import { TabelaDeLocacao } from "./locacao/TabelaDeLocacao";
import {
  ABA_DA_PLANILHA,
  filtrarNotas,
  linhasDaPlanilha,
  nomeDoArquivo,
  ordenarNotas,
  proximaOrdenacao,
  resumirLocacao,
  ORDENACAO_INICIAL,
  type CampoOrdenavel,
} from "./locacao/notasDeLocacao";

/**
 * Locação — as notas fiscais que carregam o marcador `Locação` no Tiny.
 *
 * A tela é o esqueleto: busca as notas, guarda o que a pessoa digitou e por
 * onde ela pediu para ordenar, e entrega o recorte pronto para a tabela. As
 * contas moram em `locacao/notasDeLocacao.ts`, o desenho nos três
 * componentes ao lado.
 */
const Locacao: React.FC = () => {
  const { user } = useAuth();

  const [notas, setNotas] = useState<NotaLocacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [pesquisa, setPesquisa] = useState("");
  const [ordenacao, setOrdenacao] = useState(ORDENACAO_INICIAL);

  useEffect(() => {
    const carregar = async () => {
      try {
        setCarregando(true);
        const dados = await fetchLocacao();
        setNotas(Array.isArray(dados) ? dados : []);
        setErro(null);
      } catch (err) {
        console.error("Erro ao buscar locações", err);
        setErro("Não foi possível carregar as notas de locação.");
      } finally {
        setCarregando(false);
      }
    };
    carregar();
  }, []);

  // Os KPIs descrevem a base inteira; a busca só recorta a tabela.
  const resumo = useMemo(() => resumirLocacao(notas), [notas]);

  const notasTabela = useMemo(
    () => ordenarNotas(filtrarNotas(notas, pesquisa), ordenacao),
    [notas, pesquisa, ordenacao],
  );

  const alternarOrdenacao = useCallback((campo: CampoOrdenavel) => {
    setOrdenacao((atual) => proximaOrdenacao(atual, campo));
  }, []);

  const exportarExcel = useCallback(() => {
    baixarPlanilha(
      [{ nome: ABA_DA_PLANILHA, linhas: linhasDaPlanilha(notasTabela) }],
      nomeDoArquivo(),
    );
  }, [notasTabela]);

  if (carregando) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-base px-6 py-16 text-conteudo-muted md:h-full md:min-h-0">
        <Spinner size="lg" />
        <p>Carregando locações...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-base p-6 transition-colors md:h-full md:min-h-0">
      <div className="flex flex-col gap-4">
        <CabecalhoLocacao usuario={user} />

        {erro ? <Alert variant="danger">{erro}</Alert> : null}

        <ResumoLocacao resumo={resumo} />

        <TabelaDeLocacao
          notas={notasTabela}
          totalDeNotas={notas.length}
          pesquisa={pesquisa}
          onPesquisar={setPesquisa}
          ordenacao={ordenacao}
          onOrdenar={alternarOrdenacao}
          onExportar={exportarExcel}
        />
      </div>
    </div>
  );
};

export default Locacao;
