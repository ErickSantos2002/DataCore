import { useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { EstrategiaDeBusca, OpcaoDeMultiSelect } from "./buscaDeMultiSelect";
import { buscaPorTexto } from "./buscaDeMultiSelect";
import { useCliqueFora } from "../../../hooks/useCliqueFora";

export interface MultiSelectProps {
  /** Rótulo do campo — "Empresas", "Situação", "Cliente (Tomador)". */
  rotulo: string;
  opcoes: OpcaoDeMultiSelect[];
  selecionados: string[];
  onChange: (selecionados: string[]) => void;
  placeholder: string;
  /** Como o termo digitado casa com uma opção. Ver `buscaDeMultiSelect.ts`. */
  buscarPor?: EstrategiaDeBusca;
}

/**
 * Seletor de múltiplas opções com busca — filtro de barra de tela (empresa,
 * produto, vendedor, cidade). Extraído de seis cópias divergentes que as
 * telas carregavam cada uma dentro de si mesma (Produtos, Serviços,
 * Vendedores, Estoque, Clientes, Vendas); a estratégia de casar o termo com
 * a opção varia por tela e por isso é injetável (`buscarPor`, default
 * `buscaPorTexto`) em vez de fixa aqui — ver `buscaDeMultiSelect.ts`.
 *
 * Botão e painel são irmãos dentro da mesma `<div>` raiz — que também
 * carrega o `<label>` do campo —, sem portal: o painel só precisa flutuar
 * sobre a própria barra de filtros, não escapar de contêiner nenhum, e a
 * Task 2 já mostrou que portal aqui quebra o escopo de teste
 * (`botao.parentElement`) que as seis telas usam para achar o dropdown.
 * O `<label>` de cada opção envolve o `<input type="checkbox">` e o texto
 * diretamente — sem `htmlFor` — porque é essa associação implícita que dá
 * ao checkbox seu nome acessível;
 * checkbox e span soltos, ou ligados por `htmlFor`, quebrariam a busca por
 * nome acessível que os 41 testes de caracterização fazem.
 *
 * O painel NÃO fecha ao marcar uma opção. Nas seis cópias originais ele
 * fechava, mas por acidente: o componente era declarado dentro da página
 * dona do estado, então `onChange` recriava o componente a cada marcação e
 * ele remontava do zero, resetando `isOpen`. Fora da página esse acidente
 * não existe mais — e ficar aberto para marcar mais de uma opção em
 * sequência é o comportamento correto, não uma regressão.
 *
 * O nome acessível do gatilho é `aria-labelledby` apontando para o `<label>`
 * e para o `<span>` do valor — soma "Empresas" e "3 selecionado(s)" em vez de
 * um substituir o outro, que é o que `<label for>` faria num `<button>`. O
 * painel é disclosure, não listbox: um `<div role="group">` de checkboxes,
 * sem `aria-haspopup` e sem `role="option"`.
 *
 * Teclado: `Escape` fecha o painel e devolve o foco ao gatilho. Um único
 * ouvinte na raiz atende gatilho e campo de busca, por bolha de evento.
 *
 * ```tsx
 * <MultiSelect
 *   rotulo="Produtos"
 *   opcoes={deTextos(produtos)}
 *   selecionados={produtosSelecionados}
 *   onChange={setProdutosSelecionados}
 *   placeholder="Todos os produtos"
 * />
 * ```
 */
export function MultiSelect({
  rotulo,
  opcoes,
  selecionados,
  onChange,
  placeholder,
  buscarPor = buscaPorTexto,
}: MultiSelectProps) {
  // O gatilho é um `<button>`, não um campo de formulário. `<label for>` até é
  // HTML válido apontando para um botão, mas ele SUBSTITUI o nome acessível:
  // quem usa leitor de tela ouviria "Empresas" e perderia "3 selecionado(s)",
  // que é o estado do filtro. `aria-labelledby` com os dois ids soma as duas
  // coisas — "Empresas, 3 selecionado(s)".
  const id = useId();
  const idDoRotulo = `${id}-rotulo`;
  const idDoValor = `${id}-valor`;

  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const gatilhoRef = useRef<HTMLButtonElement>(null);

  function aoTeclar(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key === "Escape" && aberto) {
      setAberto(false);
      gatilhoRef.current?.focus();
    }
  }

  useCliqueFora(containerRef, () => setAberto(false), aberto);

  function alternar(valor: string) {
    if (selecionados.includes(valor)) {
      onChange(selecionados.filter((s) => s !== valor));
    } else {
      onChange([...selecionados, valor]);
    }
  }

  const opcoesFiltradas = opcoes.filter((opcao) => buscarPor(opcao, termo));

  return (
    <div className="relative flex flex-col gap-1.5" ref={containerRef} onKeyDown={aoTeclar}>
      <label id={idDoRotulo} className="text-sm font-medium text-conteudo">
        {rotulo}
      </label>

      <button
        ref={gatilhoRef}
        type="button"
        aria-expanded={aberto}
        aria-labelledby={`${idDoRotulo} ${idDoValor}`}
        onClick={() => setAberto((valor) => !valor)}
        className={[
          "w-full rounded-lg border bg-surface px-3 py-2 text-left transition-colors",
          "border-borda hover:bg-surface-elevated",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus",
        ].join(" ")}
      >
        <span id={idDoValor} className="text-sm text-conteudo">
          {selecionados.length > 0 ? `${selecionados.length} selecionado(s)` : placeholder}
        </span>
      </button>

      {/*
        `top-full` ancora o painel na base do container. Sem ele o painel
        dependia da posição estática, que a raiz em `flex` mudou: medido no
        Chrome, o painel saltava de `botão.bottom + 4px` para
        `container.top + 4px` e cobria o rótulo e o próprio gatilho. É a mesma
        âncora que a peça de Contas já usa.
      */}
      {aberto ? (
        <div className="absolute top-full z-dropdown mt-1 max-h-60 w-full overflow-auto rounded-lg border border-borda bg-surface shadow-lg">
          <div className="border-b border-borda p-2">
            <input
              type="text"
              placeholder="Pesquisar..."
              aria-label={`Pesquisar em ${rotulo}`}
              value={termo}
              onChange={(evento) => setTermo(evento.target.value)}
              className={[
                "w-full rounded border border-borda bg-surface px-2 py-1 text-conteudo",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus",
              ].join(" ")}
            />
          </div>

          <div className="p-2">
            <button
              type="button"
              onClick={() => onChange([])}
              className={[
                "w-full rounded px-2 py-1 text-left text-sm text-conteudo-muted",
                "hover:bg-surface-elevated",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus",
              ].join(" ")}
            >
              Limpar seleção
            </button>
          </div>

          <div role="group" aria-label={rotulo}>
            {opcoesFiltradas.length > 0 ? (
              opcoesFiltradas.map((opcao) => (
                <label
                  key={opcao.valor}
                  className="flex cursor-pointer items-center px-4 py-2 hover:bg-surface-elevated"
                >
                  <input
                    type="checkbox"
                    checked={selecionados.includes(opcao.valor)}
                    onChange={() => alternar(opcao.valor)}
                    className="mr-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  />
                  <span className="text-conteudo">{opcao.rotulo}</span>
                </label>
              ))
            ) : (
              <div className="px-4 py-2 text-conteudo-muted">Nenhum resultado encontrado</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
