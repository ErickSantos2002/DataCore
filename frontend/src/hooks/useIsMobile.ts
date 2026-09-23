import { useEffect, useState } from "react";

/** O `sm` do Tailwind. Estava cravado como `640` em cinco lugares — quatro
 *  cópias deste hook e mais um `window.innerWidth < 640` solto dentro do
 *  tooltip de `Clientes` —, sempre como literal sem nome. Se um dia divergir do
 *  `tailwind.config.js`, é por aqui que alguém descobre. */
export const LARGURA_DE_CELULAR = 640;

/**
 * Responde se a janela está em largura de celular, e reage a `resize`.
 *
 * Nasceu do item 5 da Fase 4, que achou QUATRO cópias disto — `Clientes`,
 * `Estoque`, `Produtos` e `Vendas` — funcionalmente idênticas. Ao contrário do
 * `useCliqueFora`, aqui as cópias não discordavam entre si: o defeito estava no
 * uso. `Produtos` e `Vendas` declaravam o hook e nunca liam o valor, e o lint acusava
 * as duas do mesmo jeito — mas o problema delas era diferente. `Produtos` não
 * perguntava nada sobre a largura da janela; `Vendas` perguntava três vezes, com
 * `window.innerWidth` solto dentro do gráfico, sem reagir a `resize`. `Clientes`
 * fazia o mesmo, uma vez. **A variável não usada era o sintoma; a pergunta era
 * quem precisa da resposta.**
 *
 * **O estado inicial lê `window.innerWidth` na hora, em vez de nascer em
 * `false`.** Sem isso, em celular o primeiro render é sempre o de desktop, e só
 * o efeito corrige depois da montagem — é esse intervalo que faz
 * `<ResponsiveContainer height={isMobile ? 420 : 300}>` (`Clientes`, `Estoque`)
 * montar com 300px e saltar para 420 junto com a fonte dos eixos, a largura do
 * eixo Y e a do tooltip; no `Estoque` o `trigger` do popover também muda, de
 * `"hover"` para `"click"`, e por um instante a tela responde ao gesto errado.
 * É seguro ler `window` direto no inicializador **aqui**: `src/main.tsx` usa
 * `createRoot` puro, sem hidratação, e não há `ssr` no `vite.config.ts` — não
 * existe um primeiro render no servidor que precise bater com o do cliente.
 * Num projeto com SSR esta linha quebraria o build do servidor, que é
 * exatamente a razão pela qual o padrão `useState(false)` existe no mundo.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => window.innerWidth < LARGURA_DE_CELULAR,
  );

  useEffect(() => {
    const aoRedimensionar = () =>
      setIsMobile(window.innerWidth < LARGURA_DE_CELULAR);
    // Chamada imediata: cobre o resize que acontecer ENTRE o render (onde o
    // inicializador preguiçoso já leu `window.innerWidth` acima) e o commit
    // deste efeito — janela estreita, mas real. É um `setState` em corpo de
    // efeito, o mesmo padrão que o lint deste repo acusa 15 vezes; aqui
    // escapa só porque a chamada passa por uma função nomeada, não porque
    // foi avaliado como seguro. Revisão futura: não tratar a isenção como aval.
    aoRedimensionar();
    window.addEventListener("resize", aoRedimensionar);
    return () => window.removeEventListener("resize", aoRedimensionar);
  }, []);

  return isMobile;
}
