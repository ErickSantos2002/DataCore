import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Icon } from "../core/Icon";
import { useCliqueFora } from "../../../hooks/useCliqueFora";

export interface SearchSelectOption {
  value: string;
  label: string;
}

export interface SearchSelectProps {
  label?: string;
  /** `form` = campo de formulário. `filter` = compacto, para barra de filtros. */
  variant?: "form" | "filter";
  options: SearchSelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  /** Campo de busca no topo da lista. Ligado por padrão. */
  searchable?: boolean;
  disabled?: boolean;
  error?: string;
}

const GATILHO_CLASSES: Record<NonNullable<SearchSelectProps["variant"]>, string> = {
  form: "px-3 py-2 text-sm",
  filter: "px-2.5 py-1.5 text-xs",
};

/**
 * Seletor com lista própria, para listas longas: cliente, técnico, produto,
 * equipamento. Unifica os três seletores que os repositórios tinham
 * separados (`FormDropdown`, `FilterSelect`, `SearchSelect`): `variant="form"`
 * é o campo de formulário, `variant="filter"` é a versão compacta de barra
 * de filtros, `searchable` liga a busca por digitação. Lista curta e
 * conhecida → use `Select` nativo.
 *
 * Teclado — acréscimo do port, o original só fechava por clique fora ou na
 * opção: seta para baixo abre a lista e anda pelas opções, `Enter` escolhe a
 * opção em foco, `Esc` fecha e devolve o foco ao gatilho. A lista aberta é a
 * única coisa desta família com sombra (`shadow-lg`), porque de fato flutua.
 *
 * ```tsx
 * <SearchSelect label="Responsável" options={tecnicos} value={id} onChange={setId} />
 * <SearchSelect variant="filter" placeholder="Todos os status" options={status} searchable={false} />
 * ```
 */
export function SearchSelect({
  label,
  variant = "form",
  options,
  value,
  onChange,
  placeholder = "Selecione",
  searchable = true,
  disabled = false,
  error,
}: SearchSelectProps) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [indiceAtivo, setIndiceAtivo] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const gatilhoRef = useRef<HTMLButtonElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);

  const idGerado = useId();
  const gatilhoId = `${idGerado}-gatilho`;

  const opcoesFiltradas = searchable
    ? options.filter((opcao) => opcao.label.toLowerCase().includes(busca.toLowerCase()))
    : options;

  const selecionada = options.find((opcao) => opcao.value === value);

  useCliqueFora(containerRef, fechar, aberto);

  useEffect(() => {
    if (aberto && searchable) buscaRef.current?.focus();
  }, [aberto, searchable]);

  function abrir() {
    if (disabled) return;
    setAberto(true);
    setIndiceAtivo(0);
  }

  function fechar() {
    setAberto(false);
    setBusca("");
    setIndiceAtivo(0);
  }

  function aoBuscar(texto: string) {
    setBusca(texto);
    setIndiceAtivo(0);
  }

  function escolher(opcaoValue: string) {
    onChange?.(opcaoValue);
    fechar();
  }

  // Um único ouvinte no envolvente pega o teclado tanto do gatilho quanto do
  // campo de busca, por bolha de evento — não importa qual dos dois está
  // focado no momento.
  function aoTeclar(evento: KeyboardEvent<HTMLDivElement>) {
    if (!aberto) {
      if (evento.key === "ArrowDown") {
        evento.preventDefault();
        abrir();
      }
      return;
    }
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      setIndiceAtivo((indice) => Math.min(indice + 1, opcoesFiltradas.length - 1));
    } else if (evento.key === "ArrowUp") {
      evento.preventDefault();
      setIndiceAtivo((indice) => Math.max(indice - 1, 0));
    } else if (evento.key === "Enter") {
      evento.preventDefault();
      const opcao = opcoesFiltradas[indiceAtivo];
      if (opcao) escolher(opcao.value);
    } else if (evento.key === "Escape") {
      evento.preventDefault();
      fechar();
      gatilhoRef.current?.focus();
    }
  }

  return (
    <div ref={containerRef} onKeyDown={aoTeclar} className="relative flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={gatilhoId} className="text-sm font-medium text-conteudo">
          {label}
        </label>
      ) : null}
      <button
        ref={gatilhoRef}
        type="button"
        id={gatilhoId}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-invalid={error ? true : undefined}
        onClick={() => (aberto ? fechar() : abrir())}
        className={[
          "flex w-full items-center justify-between gap-2 rounded-lg border bg-surface font-sans transition-colors",
          "focus:outline-none",
          "focus-visible:ring-2 focus-visible:ring-focus",
          "disabled:cursor-not-allowed disabled:opacity-50",
          aberto ? "border-action" : error ? "border-danger" : "border-borda",
          GATILHO_CLASSES[variant],
        ].join(" ")}
      >
        <span
          className={[
            "truncate text-left",
            selecionada ? "text-conteudo" : "text-conteudo-faint",
          ].join(" ")}
        >
          {selecionada ? selecionada.label : placeholder}
        </span>
        <Icon
          name="chevronDown"
          size={16}
          className={[
            "text-conteudo-faint transition-transform",
            aberto ? "rotate-180" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        />
      </button>
      {aberto ? (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full z-dropdown mt-1 max-h-60 overflow-auto rounded-lg border border-borda bg-surface p-1 shadow-lg"
        >
          {searchable ? (
            <input
              ref={buscaRef}
              type="text"
              value={busca}
              onChange={(evento) => aoBuscar(evento.target.value)}
              placeholder="Buscar…"
              className={[
                "mb-1 w-full rounded-md border border-borda bg-surface-base px-2 py-1.5 font-sans text-xs text-conteudo",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus",
              ].join(" ")}
            />
          ) : null}
          {opcoesFiltradas.length === 0 ? (
            <p className="p-3 text-center text-xs text-conteudo-muted">Nenhum resultado encontrado.</p>
          ) : (
            opcoesFiltradas.map((opcao, indice) => (
              <button
                key={opcao.value}
                type="button"
                role="option"
                aria-selected={opcao.value === value}
                onClick={() => escolher(opcao.value)}
                className={[
                  "block w-full rounded-md px-2.5 py-[0.4375rem] text-left text-sm transition-colors",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                  opcao.value === value
                    ? "bg-action-tint font-medium text-action"
                    : indice === indiceAtivo
                      ? "bg-surface-elevated text-conteudo"
                      : "text-conteudo hover:bg-surface-elevated",
                ].join(" ")}
              >
                {opcao.label}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
