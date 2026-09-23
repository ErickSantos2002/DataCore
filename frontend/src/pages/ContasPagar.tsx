import React from "react";

import { TelaDeContas, type ConfiguracaoDeContas } from "./contas/TelaDeContas";
import type { DialetoDeContas } from "./contas/contas";

/**
 * O que Contas a Pagar tem de diferente da gêmea.
 *
 * A tela em si é `contas/TelaDeContas`, compartilhada com Contas a Receber.
 *
 * Divergência de domínio nº 1 — **o que conta como quitado**. Aqui vale só
 * `pago`; em Contas a Receber vale `recebido` OU `pago`.
 *
 * Divergência de domínio nº 2 — **qual campo de data é a emissão**. Aqui é
 * `data_emissao`, o nome que a API de contas a pagar usa; a de contas a
 * receber chama o mesmo dado de `data`. A coluna e a planilha chamam os dois
 * de "Emissão".
 *
 * `cliente_nome` não é cópia mal feita da gêmea: é o nome do campo que a API
 * manda para o FORNECEDOR, e é por isso que a tela o rotula "Fornecedor".
 */
const DIALETO: DialetoDeContas = {
  chaveQuitado: "pago",
};

const CONFIGURACAO: ConfiguracaoDeContas = {
  titulo: "Contas a Pagar",
  descricao: "Acompanhe e gerencie as contas a pagar integradas ao Tiny ERP.",
  mensagemDeCarregamento: "Carregando contas a pagar...",
  rotuloDaContraparte: "Fornecedor",
  rotuloDoAberto: "Total em Aberto",
  rotuloDoQuitado: "Total Pago",
  tituloDaTabela: "Detalhamento de Contas",
  tituloDasContrapartes: "Top 10 Fornecedores",
  legendaQuitado: "Pago",
  legendaAberto: "Em Aberto",
  tomDoAberto: "perigo",
  dialeto: DIALETO,
  planilha: {
    aba: "Contas a Pagar",
    prefixoDoArquivo: "contas_a_pagar",
    rotuloDaContraparte: "Fornecedor",
    // `Ocorrência` só existe na API de contas a pagar: campo que só existe
    // numa das duas fica só nela.
    colunasProprias: (conta) => ({ Ocorrência: conta.ocorrencia }),
  },
};

/** Contas a Pagar — os títulos do Tiny ERP que a empresa tem para pagar. */
const ContasPagar: React.FC = () => (
  <TelaDeContas tipo="contas_pagar" configuracao={CONFIGURACAO} />
);

export default ContasPagar;
