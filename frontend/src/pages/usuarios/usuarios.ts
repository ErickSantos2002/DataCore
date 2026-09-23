import { dataDeCalendario } from "../../lib/datas";
import type { Papel, Usuario } from "../../services/api";

/**
 * A regra da tela de Usuários, separada da tela.
 *
 * São as coisas que ninguém mais no sistema repete: a ordem das validações
 * do cadastro, o mínimo da senha (um só, para a criação e para a troca), o
 * perfil com que um formulário abre, e a cor do selo de cada papel. A tela
 * decide quando chamar; a resposta é sempre a mesma para a mesma entrada.
 */

/**
 * Os cinco perfis que a tela desenha quando o `/roles` não responde.
 *
 * Não é a lista de verdade — é o que a tela sempre teve embutido para não
 * ficar com um `<select>` vazio quando o backend de autenticação cai.
 */
export const PAPEIS_EMBUTIDOS: Papel[] = [
  { id: 1, name: "admin" },
  { id: 2, name: "vendas" },
  { id: 3, name: "financeiro" },
  { id: 4, name: "servicos" },
  { id: 5, name: "comum" },
];

/** O perfil de menor privilégio — a escolha certa quando nada mais manda. */
export const PAPEL_PREFERIDO = "comum";

/**
 * O mínimo da senha, num lugar só.
 *
 * A criação sempre exigiu 6 caracteres e a troca não exigia nada — dava
 * para gravar senha em branco num usuário que já existia. Agora as duas
 * chamam `validarSenha`, então não há como uma subir o mínimo e a outra
 * ficar para trás.
 */
export const TAMANHO_MINIMO_DA_SENHA = 6;

/** Tons de `Badge` que a coluna Perfil usa. */
export type TomDoPapel = "info" | "success" | "warning" | "secondary";

/**
 * Cor do selo de cada papel, conforme o desenho da Fase 1. O rótulo continua
 * carregando o significado — a cor só o reforça.
 *
 * `vendas` e `comum` ficam em `secondary` de propósito: são os papéis sem
 * poder especial, e pintar todos de cores diferentes só faria a coluna
 * piscar sem dizer nada. Papel desconhecido cai no mesmo neutro.
 */
export function tomDoPapel(papel: string | null | undefined): TomDoPapel {
  switch ((papel ?? "").toLowerCase()) {
    case "admin":
      return "info";
    case "financeiro":
      return "success";
    case "servicos":
    case "serviços":
      return "warning";
    default:
      return "secondary";
  }
}

/** O nome do papel do usuário, ou o travessão quando ele não tem nenhum. */
export function nomeDoPapel(usuario: Usuario): string {
  return usuario.role?.name ?? "—";
}

/**
 * A data de criação como a tabela mostra.
 *
 * `created_at` é dia de calendário: não passa por `Date` nenhum, senão
 * `2026-01-15` viraria 14/01 em Brasília. Ver `src/lib/datas.ts`.
 */
export function dataDeCriacao(iso: string | null | undefined): string {
  return dataDeCalendario(iso);
}

/** As opções do `<select>` de perfil, na ordem em que a API mandou. */
export function opcoesDePapel(
  papeis: Papel[],
): { value: string; label: string }[] {
  return papeis.map((papel) => ({ value: papel.name, label: papel.name }));
}

/**
 * Com que perfil um formulário abre — sempre um perfil que existe na lista.
 *
 * Antes o valor inicial era a string `"comum"`, chutada pela tela. Quando o
 * `/roles` não trazia "comum", o `<select>` desenhava o primeiro perfil da
 * lista (o navegador não tem a opção pedida, então mostra a primeira) e o
 * POST mandava `role_name: "comum"`: lia-se uma coisa e gravava-se outra.
 *
 * `preferido` é o papel que o usuário sendo editado já tem. Se ele não
 * estiver na lista, cai na mesma regra do formulário de criação.
 */
export function papelInicial(
  papeis: Papel[],
  preferido?: string | null,
): string {
  const existe = (nome: string) => papeis.some((papel) => papel.name === nome);
  if (preferido && existe(preferido)) return preferido;
  if (existe(PAPEL_PREFERIDO)) return PAPEL_PREFERIDO;
  return papeis[0]?.name ?? "";
}

/**
 * A regra da senha, uma só para os dois formulários: tamanho antes de
 * conferência. Devolve a mensagem a mostrar, ou `null` quando está tudo bem.
 */
export function validarSenha(
  senha: string,
  confirmacao: string,
): string | null {
  if (senha.length < TAMANHO_MINIMO_DA_SENHA) {
    return `A senha deve ter pelo menos ${TAMANHO_MINIMO_DA_SENHA} caracteres.`;
  }
  if (senha !== confirmacao) return "As senhas não coincidem.";
  return null;
}

/**
 * O e-mail como o formulário manda: sem os espaços das pontas, e vazio vira
 * `null`. O backend tem índice único no e-mail preenchido — duas strings
 * vazias colidiriam, dois `null` não.
 */
export function emailDoFormulario(texto: string): string | null {
  const email = texto.trim();
  return email ? email : null;
}

/**
 * O e-mail é opcional; se veio, precisa ter algo antes e depois da arroba. A
 * conferência de verdade é do backend — aqui é só para não mandar "maria@".
 */
export function validarEmail(texto: string): string | null {
  const email = emailDoFormulario(texto);
  if (email === null) return null;
  const [local, dominio, ...resto] = email.split("@");
  if (!local || !dominio || resto.length > 0 || /\s/.test(email)) {
    return "Informe um e-mail válido.";
  }
  return null;
}

/**
 * As três validações do cadastro, na ordem em que a tela sempre as fez:
 * nome, depois tamanho da senha, depois conferência. A ordem importa —
 * quem preenche tudo errado de uma vez só vê a primeira mensagem, e trocar
 * a ordem muda o que a pessoa lê primeiro.
 */
export function validarCriacao(dados: {
  username: string;
  senha: string;
  confirmacao: string;
  email?: string;
}): string | null {
  if (!dados.username.trim()) return "Informe um nome de usuário.";
  return (
    validarEmail(dados.email ?? "") ??
    validarSenha(dados.senha, dados.confirmacao)
  );
}

/** A validação da edição, que não mexe em senha. */
export function validarEdicao(username: string, email = ""): string | null {
  if (!username.trim()) return "Informe um nome de usuário.";
  return validarEmail(email);
}

/**
 * O que mostrar quando a API recusa: o `detail` que o backend mandou, ou a
 * frase genérica de quem chamou.
 */
export function mensagemDeErro(erro: unknown, padrao: string): string {
  const detalhe = (
    erro as { response?: { data?: { detail?: unknown } } } | null
  )?.response?.data?.detail;
  return typeof detalhe === "string" && detalhe ? detalhe : padrao;
}

/** "1 usuário cadastrado" / "3 usuários cadastrados" — frase concorda em número. */
export function contarUsuarios(quantidade: number): string {
  return quantidade === 1
    ? "1 usuário cadastrado"
    : `${quantidade} usuários cadastrados`;
}
