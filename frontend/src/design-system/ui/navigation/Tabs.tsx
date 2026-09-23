import React, { createContext, useContext, useId } from "react";
import type { KeyboardEvent } from "react";

// `Omit<..., "onChange">`: `HTMLAttributes<HTMLDivElement>` já declara
// `onChange?: FormEventHandler<HTMLDivElement>` (o evento nativo de
// formulário), que colide com a assinatura `(value: string) => void` do
// `.d.ts` — TS2430. Mesmo defeito do `CardHeaderProps` na Task 3 (`title`
// sobre `title` nativo), mesmo conserto. A API vista pelo consumidor não
// muda: `value` e `onChange` continuam exatamente como o `.d.ts` declara.
export interface TabsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** Aba ativa — controlado. */
  value: string;
  onChange: (value: string) => void;
}

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

interface TabsContextValue {
  value: string;
  onChange: (value: string) => void;
  /** Prefixo de `useId()` — deriva os pares de id aba/painel nos dois lados. */
  idBase: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(nomeComponente: string): TabsContextValue {
  const contexto = useContext(TabsContext);
  if (!contexto) {
    throw new Error(`${nomeComponente} precisa estar dentro de um <Tabs>.`);
  }
  return contexto;
}

function idDaAba(idBase: string, value: string) {
  return `${idBase}-aba-${value}`;
}

function idDoPainel(idBase: string, value: string) {
  return `${idBase}-painel-${value}`;
}

/**
 * Abas de seção — pílula sobre fundo recuado, aba ativa em branco.
 * Controlado: `value` e `onChange` são obrigatórios, não existe estado
 * interno nem `defaultValue`.
 *
 * Teclado — acréscimo do port, o original não tinha nenhum: dentro do
 * `TabsList`, seta esquerda/direita anda entre as abas e `Home`/`End` vai
 * para a primeira/última, o resto do padrão ARIA de `tablist`. A aba ativa
 * dentro do trilho é o único lugar da biblioteca com `shadow-sm` além do
 * modal e da lista do seletor — ela de fato flutua sobre o trilho recuado.
 *
 * ```tsx
 * const [aba, setAba] = useState("centro");
 * <Tabs value={aba} onChange={setAba}>
 *   <TabsList>
 *     <TabsTrigger value="centro">Centro de custo</TabsTrigger>
 *     <TabsTrigger value="meta">Meta</TabsTrigger>
 *   </TabsList>
 *   <TabsContent value="centro">Rateio por centro</TabsContent>
 *   <TabsContent value="meta">Meta do mês</TabsContent>
 * </Tabs>
 * ```
 */
export function Tabs({ value, onChange, children, ...props }: TabsProps) {
  const idBase = useId();

  return (
    <TabsContext.Provider value={{ value, onChange, idBase }}>
      <div {...props}>{children}</div>
    </TabsContext.Provider>
  );
}

/** Trilho das abas — `role="tablist"`, fundo recuado, pílulas em fila. */
export function TabsList({ className, onKeyDown, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { value, onChange } = useTabsContext("TabsList");

  // Um único ouvinte no trilho pega o teclado de qualquer aba focada, por
  // bolha de evento — não precisa de handler por TabsTrigger.
  function aoTeclar(evento: KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(evento);
    if (evento.defaultPrevented) return;

    const abas = Array.from(
      evento.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'),
    );
    if (abas.length === 0) return;

    const indiceAtual = abas.findIndex((aba) => aba.dataset.value === value);

    let proximoIndice: number | null = null;
    if (evento.key === "ArrowRight") {
      proximoIndice = indiceAtual === -1 ? 0 : (indiceAtual + 1) % abas.length;
    } else if (evento.key === "ArrowLeft") {
      proximoIndice = indiceAtual === -1 ? abas.length - 1 : (indiceAtual - 1 + abas.length) % abas.length;
    } else if (evento.key === "Home") {
      proximoIndice = 0;
    } else if (evento.key === "End") {
      proximoIndice = abas.length - 1;
    }

    if (proximoIndice === null) return;
    evento.preventDefault();

    const proximaAba = abas[proximoIndice];
    const proximoValue = proximaAba.dataset.value;
    if (proximoValue !== undefined) {
      onChange(proximoValue);
      proximaAba.focus();
    }
  }

  return (
    <div
      role="tablist"
      onKeyDown={aoTeclar}
      className={["inline-flex gap-1 rounded-lg bg-surface-elevated p-1", className].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Uma aba — `<button role="tab">`. Repouso: fundo transparente, texto
 * apagado. Ativa: fundo `surface`, texto de destaque e `shadow-sm` — a
 * sombra que faz a pílula flutuar sobre o trilho.
 */
export function TabsTrigger({ value, className, id, children, ...props }: TabsTriggerProps) {
  const { value: valorAtivo, onChange, idBase } = useTabsContext("TabsTrigger");
  const ativa = value === valorAtivo;

  return (
    <button
      type="button"
      role="tab"
      id={id ?? idDaAba(idBase, value)}
      data-value={value}
      aria-selected={ativa}
      aria-controls={idDoPainel(idBase, value)}
      tabIndex={ativa ? 0 : -1}
      onClick={() => onChange(value)}
      className={[
        "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus",
        ativa
          ? "bg-surface text-conteudo-heading shadow-sm"
          : "bg-transparent text-conteudo-muted hover:text-conteudo",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * Painel de uma aba — só renderiza quando `value` é a aba ativa.
 * `role="tabpanel"` ligado à aba correspondente via `aria-labelledby`.
 */
export function TabsContent({
  value,
  className,
  children,
  ...props
}: { value: string } & React.HTMLAttributes<HTMLDivElement>) {
  const { value: valorAtivo, idBase } = useTabsContext("TabsContent");
  if (value !== valorAtivo) return null;

  return (
    <div
      id={idDoPainel(idBase, value)}
      role="tabpanel"
      aria-labelledby={idDaAba(idBase, value)}
      className={className}
      {...props}
    >
      {children}
    </div>
  );
}
