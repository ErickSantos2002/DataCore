import { useCallback, useState } from "react";

import { periodoDoPreset } from "../lib/periodo";

/**
 * O período das telas com filtro de data: o preset e as duas datas.
 *
 * Trocar de preset reescreve as duas datas NO MESMO clique, e não num
 * `useEffect` que olha o preset depois do render. Eram seis cópias do efeito
 * (Clientes, Produtos, Serviços, Vendas, Vendedores e Contas), e cada uma
 * desenhava um render a mais, inconsistente: o seletor já em "Mês atual" e os
 * campos ainda com as datas de antes, até o efeito corrigir. É o caso da
 * regra `react-hooks/set-state-in-effect`: estado que muda por causa de um
 * evento muda no evento.
 *
 * "Personalizado" (`custom`) não mexe nas datas: `periodoDoPreset` devolve
 * `null`, e o que a pessoa digitou ou clicou no gráfico fica. É por isso que
 * a tela chama `escolherPreset("custom")` depois de escrever uma data à mão.
 */
export function usePeriodo() {
  const [preset, setPreset] = useState("todos");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const escolherPreset = useCallback((valor: string) => {
    setPreset(valor);
    const periodo = periodoDoPreset(valor, new Date());
    if (!periodo) return;
    setDataInicio(periodo.inicio);
    setDataFim(periodo.fim);
  }, []);

  return {
    preset,
    escolherPreset,
    dataInicio,
    setDataInicio,
    dataFim,
    setDataFim,
  };
}
