import { useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "../design-system/ui";
import { useAuth } from "../hooks/useAuth";
import { CabecalhoContas } from "./contas/CabecalhoContas";
import { AbaCobranca } from "./inadimplencia/AbaCobranca";
import { AbaIndicadores } from "./inadimplencia/AbaIndicadores";

/**
 * Inadimplência — a cobrança do dia a dia e o indicador para acompanhar.
 * Spec: docs/superpowers/specs/2026-10-09-inadimplencia-design.md
 */
export default function Inadimplencia() {
  const { user } = useAuth();
  const [aba, setAba] = useState("cobranca");
  return (
    <div className="min-h-screen bg-surface-base p-6 transition-colors md:h-full md:min-h-0">
      <div className="flex flex-col gap-6">
        <CabecalhoContas
          titulo="Inadimplência"
          descricao="Quem está devendo, a cobrança de cada empresa e se a inadimplência está melhorando ou piorando."
          usuario={user}
        />
        <Tabs value={aba} onChange={setAba}>
          <TabsList>
            <TabsTrigger value="cobranca">Cobrança</TabsTrigger>
            <TabsTrigger value="indicadores">Indicadores</TabsTrigger>
          </TabsList>
          <TabsContent value="cobranca" className="mt-6"><AbaCobranca /></TabsContent>
          <TabsContent value="indicadores" className="mt-6"><AbaIndicadores ativo={aba === "indicadores"} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
