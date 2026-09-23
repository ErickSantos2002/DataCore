/**
 * As quatro maneiras de casar o termo digitado com uma opção do MultiSelect.
 *
 * Quatro, e não uma, porque as seis telas divergiram: o mesmo componente foi
 * copiado e cada cópia ganhou um pedaço de busca que as outras não ganharam.
 * Elas existem aqui nomeadas para que a extração do primitivo preserve o
 * comportamento de cada tela — unificar as quatro é a fase seguinte, e é ela
 * que apaga este arquivo.
 */

export interface OpcaoDeMultiSelect {
  /** O que entra na seleção. */
  valor: string;
  /** O que a pessoa lê. */
  rotulo: string;
}

export type EstrategiaDeBusca = (
  opcao: OpcaoDeMultiSelect,
  termo: string,
) => boolean;

/** Texto solto vira par com valor igual ao rótulo. */
export function deTextos(textos: string[]): OpcaoDeMultiSelect[] {
  return textos.map((texto) => ({ valor: texto, rotulo: texto }));
}

const soDigitos = (texto: string) => texto.replace(/\D/g, "");

/** Produtos e Estoque: só o rótulo, sem diferenciar maiúscula. */
export const buscaPorTexto: EstrategiaDeBusca = (opcao, termo) =>
  opcao.rotulo.toLowerCase().includes(termo.toLowerCase());

/** Serviços: o rótulo, ou os dígitos do rótulo contra os dígitos do termo. */
export const buscaPorTextoOuNumero: EstrategiaDeBusca = (opcao, termo) => {
  if (buscaPorTexto(opcao, termo)) return true;
  const digitosDoTermo = soDigitos(termo);
  return (
    digitosDoTermo.length > 0 &&
    soDigitos(opcao.rotulo).includes(digitosDoTermo)
  );
};

/**
 * Vendedores e Vendas: o rótulo, ou o CNPJ que está entre parênteses.
 *
 * Só normaliza quando o termo é TODO dígito: "a11" procura o texto "a11", e
 * não o número 11.
 *
 * As duas telas de origem têm uma terceira condição no meio —
 * `cnpj.toLowerCase().includes(searchLower)`, o CNPJ ainda com pontuação
 * contra o termo cru — que não entrou aqui de propósito: o CNPJ vem de
 * `rotulo.match(/\(...\)/)`, então ele é sempre um pedaço LITERAL do próprio
 * rótulo. Qualquer termo que bata nesse pedaço já bate no rótulo inteiro
 * (a primeira condição abaixo) — a terceira condição nunca decide sozinha o
 * resultado, para nenhum rótulo ou termo possível, não só para os do
 * fixture. Diferente do ramo morto de Clientes (ver
 * `buscaPorRotuloValorOuNumero`), que é inalcançável só por como aquela tela
 * monta os dados: aqui a redundância vem da própria forma da regex, então
 * omitir é seguro pra qualquer opção que se passe a esta função.
 */
export const buscaPorCnpjEntreParenteses: EstrategiaDeBusca = (
  opcao,
  termo,
) => {
  if (buscaPorTexto(opcao, termo)) return true;
  if (!/^\d+$/.test(termo)) return false;
  const entreParenteses = opcao.rotulo.match(/\((.*?)\)/);
  if (!entreParenteses) return false;
  return soDigitos(entreParenteses[1]).includes(soDigitos(termo));
};

/**
 * Clientes: rótulo, valor cru, ou os dígitos do valor.
 *
 * A condição do valor cru (`opcao.valor.toLowerCase().includes(...)`) é
 * RAMO MORTO com os dados que a tela de Clientes produz hoje:
 * `clientesUnicos` monta o `valor` já normalizado
 * (`cpf_cnpj.replace(/\D/g, "")`, só dígitos), então
 * `valorMinusculo === valorNormalizado` sempre. Termo todo dígito faz as
 * condições 2 e 3 virarem a mesma expressão (o que a 2 aceitar, a 3 também
 * aceita); termo com qualquer caractere fora dígito nunca bate na condição
 * 2, porque `valor` não tem pontuação nenhuma para casar. Provado por
 * execução na Task 5 (apagar a condição e rodar a caracterização de
 * Clientes: os testes continuaram passando).
 *
 * Mantida mesmo assim: este primitivo é genérico, e pode receber opções de
 * outra procedência em que o `valor` venha pontuado — é o formato que
 * `OpcaoDeMultiSelect` teria se aplicado às opções de Estoque (código
 * "1.163", com ponto), onde a condição do valor cru volta a ser alcançável
 * em separado da dos dígitos. Apagar aqui resolveria o caso de Clientes e
 * quebraria silenciosamente o de Estoque. Candidata a simplificação na fase
 * de unificação das quatro estratégias, quando o dono do produto decidir se
 * `clientesUnicos` passa a guardar o valor com pontuação como as outras
 * telas, ou se a condição sai de vez.
 */
export const buscaPorRotuloValorOuNumero: EstrategiaDeBusca = (
  opcao,
  termo,
) => {
  const termoMinusculo = termo.toLowerCase();
  if (opcao.rotulo.toLowerCase().includes(termoMinusculo)) return true;
  if (opcao.valor.toLowerCase().includes(termoMinusculo)) return true;
  const digitosDoTermo = soDigitos(termo);
  return (
    digitosDoTermo.length > 0 &&
    soDigitos(opcao.valor).includes(digitosDoTermo)
  );
};
