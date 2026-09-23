/**
 * O estoque de mentira dos testes de caracterização de Estoque.
 *
 * Seis produtos, com todo campo que a tela mostra ou soma distinto entre eles,
 * e cada filtro com o que separar:
 *
 * | id | nome                                  | código | un | preço  | saldo | sit | saldo×preço |
 * |----|---------------------------------------|--------|----|--------|-------|-----|-------------|
 * | 1  | Bafômetro Phoebus Premium Edition XL  | 1      | UN | 250    | 10    | A   | 2.500       |
 * | 2  | Tubo descartável                      | P2     | CX | 5      | 100   | A   | 500         |
 * | 3  | Bocal                                 | 163    | UN | 3,50   | 0     | A   | 0           |
 * | 4  | Sensor antigo                         | 900    | PC | 80     | -2    | I   | -160        |
 * | 5  | Kit calibração                        | 4      | KT | 1.200  | 3     | I   | 3.600       |
 * | 6  | Brinde                                | 77     | UN | 0      | 50    | A   | 0           |
 *
 * - "Principais" (a lista cravada de códigos) pega 1, 163 e 4.
 * - O nome do produto 1 passa de 20 caracteres: o gráfico de barras e a pizza
 *   cortam o nome, e o balão mostra o inteiro.
 * - Produto 6 tem saldo mas preço zero, e produto 3 tem preço mas saldo zero:
 *   os dois ficam fora dos gráficos por motivos diferentes.
 *
 * ⚠️ Não é `.test`: é importado de dentro de fábrica de `vi.mock`, que roda antes
 * dos imports do arquivo de teste — por isso o `await import(...)` lá.
 */
export const PRODUTOS_ESTOQUE = [
  {
    id: 1,
    nome: "Bafômetro Phoebus Premium Edition XL",
    codigo: "1",
    unidade: "UN",
    preco: 250,
    saldo: 10,
    situacao: "A" as const,
  },
  {
    id: 2,
    nome: "Tubo descartável",
    codigo: "P2",
    unidade: "CX",
    preco: 5,
    saldo: 100,
    situacao: "A" as const,
  },
  {
    id: 3,
    nome: "Bocal",
    codigo: "163",
    unidade: "UN",
    preco: 3.5,
    saldo: 0,
    situacao: "A" as const,
  },
  {
    id: 4,
    nome: "Sensor antigo",
    codigo: "900",
    unidade: "PC",
    preco: 80,
    saldo: -2,
    situacao: "I" as const,
  },
  {
    id: 5,
    nome: "Kit calibração",
    codigo: "4",
    unidade: "KT",
    preco: 1200,
    saldo: 3,
    situacao: "I" as const,
  },
  {
    id: 6,
    nome: "Brinde",
    codigo: "77",
    unidade: "UN",
    preco: 0,
    saldo: 50,
    situacao: "A" as const,
  },
];
