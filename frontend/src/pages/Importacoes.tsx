import React from "react";

import { Alert, Card, Spinner } from "../design-system/ui";
import { CartaoDeImportacao } from "./importacoes/CartaoDeImportacao";
import { HistoricoDeExecucoes } from "./importacoes/HistoricoDeExecucoes";
import { contarProblemas } from "./importacoes/importacoes";
import {
  useImportacoes,
  TAMANHO_DA_PAGINA,
} from "./importacoes/useImportacoes";

/**
 * A tela de Importações: o que traz dado para o DataCore, se está funcionando,
 * quando roda e o que aconteceu nos dias anteriores.
 *
 * ## Por que ela existe
 *
 * Em 18/09/2026 a importação de notas de serviço falhou às 01:30 com um 404 do
 * ADN, e ninguém soube. A carga voltou sozinha no dia seguinte e recuperou as
 * notas, então nada se perdeu — mas por um dia inteiro o sistema esteve com
 * dado faltando, e o único lugar onde isso estava escrito era uma tabela que
 * só se alcança por SSH. Falha que ninguém vê é falha que vira "número
 * estranho no relatório" três semanas depois.
 *
 * ## O que ela NÃO faz
 *
 * Não dispara importação. Foi decisão explícita: a tela informa, e disparar
 * continua sendo por SSH. Abrir um caminho da API até os timers do host é
 * trabalho e risco de outra natureza, e merece ser decidido por si.
 */
const Importacoes: React.FC = () => {
  const {
    importacoes,
    carregandoCartoes,
    erro,
    execucoes,
    total,
    pagina,
    setPagina,
    carregandoHistorico,
    filtro,
    trocarFiltro,
  } = useImportacoes();

  const problemas = contarProblemas(importacoes);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <Card padding="lg">
        <h1 className="text-3xl font-bold text-conteudo-heading">
          Importações
        </h1>
        <p className="mt-2 text-sm text-conteudo-muted">
          As cargas que trazem dado para o DataCore: quando rodam, como foi a
          última vez e o que aconteceu nos dias anteriores. Os horários estão no
          fuso de Brasília.
        </p>
      </Card>

      {erro && <Alert variant="warning">{erro}</Alert>}

      {/* O resumo só aparece quando há problema. Tela de operação que exibe
          "tudo certo" em destaque todo dia treina a pessoa a não olhar. */}
      {problemas > 0 && (
        <Alert variant="danger" title="Tem carga precisando de atenção">
          {problemas === 1
            ? "Uma importação está com problema — veja qual abaixo."
            : `${problemas} importações estão com problema — veja quais abaixo.`}
        </Alert>
      )}

      {carregandoCartoes ? (
        <div className="flex items-center gap-3 p-6 text-conteudo-muted">
          <Spinner size="sm" />
          <span>Carregando importações...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {importacoes.map((importacao) => (
            <CartaoDeImportacao
              key={importacao.job}
              importacao={importacao}
              onVerHistorico={(job) => trocarFiltro({ ...filtro, job })}
            />
          ))}
        </div>
      )}

      <HistoricoDeExecucoes
        execucoes={execucoes}
        total={total}
        pagina={pagina}
        tamanho={TAMANHO_DA_PAGINA}
        carregando={carregandoHistorico}
        importacoes={importacoes}
        filtro={filtro}
        onFiltro={trocarFiltro}
        onPagina={setPagina}
      />
    </div>
  );
};

export default Importacoes;
