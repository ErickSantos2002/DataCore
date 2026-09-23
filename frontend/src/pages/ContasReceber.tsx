import React from "react";

import { TelaDeContas, type ConfiguracaoDeContas } from "./contas/TelaDeContas";
import type { DialetoDeContas } from "./contas/contas";

/**
 * O que Contas a Receber tem de diferente da gêmea.
 *
 * A tela em si é `contas/TelaDeContas`, compartilhada com Contas a Pagar: as
 * duas eram 83% linha idêntica, e manter duas cópias era garantir que uma
 * correção entrasse só numa delas — foi assim que nasceram as divergências
 * que o levantamento de 31/08/2026 catalogou. As cinco acidentais já foram
 * unificadas; o que sobrou aqui é domínio.
 *
 * Divergência de domínio nº 1 — **o que conta como quitado**. Aqui vale
 * `recebido` OU `pago`; em Contas a Pagar vale só `pago`. Está certo pelos
 * nomes (a API do Tiny manda os dois em contas a receber), e por tabela
 * mesmo, e não por um `if` espalhado por seis lugares.
 *
 * Divergência de domínio nº 2 — **qual campo de data é a emissão**. Aqui é
 * `data`; em Contas a Pagar é `data_emissao`. A coluna e a planilha chamam os
 * dois de "Emissão". SUPOSIÇÃO NÃO CONFIRMADA CONTRA O TINY: que
 * `contas_receber.data` é mesmo a data de emissão. A decisão do Erick foi
 * preservar o comportamento de hoje exatamente como está, travado por teste,
 * até a conferência ser feita. Se ela disser outra coisa, muda esta linha.
 */
const DIALETO: DialetoDeContas = {
  chaveQuitado: "recebido",
};

const CONFIGURACAO: ConfiguracaoDeContas = {
  titulo: "Contas a Receber",
  descricao: "Acompanhe e gerencie as contas a receber integradas ao Tiny ERP.",
  mensagemDeCarregamento: "Carregando contas a receber...",
  rotuloDaContraparte: "Cliente",
  rotuloDoAberto: "Total a Receber",
  rotuloDoQuitado: "Total Recebido",
  tituloDaTabela: "Detalhamento de Contas a Receber",
  tituloDasContrapartes: "Top 10 Clientes",
  legendaQuitado: "Recebido",
  legendaAberto: "A Receber",
  tomDoAberto: "acao",
  dialeto: DIALETO,
  planilha: {
    aba: "Contas a Receber",
    prefixoDoArquivo: "contas_a_receber",
    rotuloDaContraparte: "Cliente",
    // `Forma Pagamento` e `Portador` só existem na API de contas a receber:
    // campo que só existe numa das duas fica só nela.
    colunasProprias: (conta) => ({
      "Forma Pagamento": conta.forma_pagamento ?? "",
      Portador: conta.portador ?? "",
    }),
  },
};

/** Contas a Receber — os títulos do Tiny ERP que a empresa tem para receber. */
const ContasReceber: React.FC = () => (
  <TelaDeContas tipo="contas_receber" configuracao={CONFIGURACAO} />
);

export default ContasReceber;
