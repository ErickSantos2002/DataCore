import { useState } from "react";

import { Alert } from "../../design-system/ui/feedback";
import { Button } from "../../design-system/ui/core/Button";
import { Card } from "../../design-system/ui/core/Card";
import { RadioGroup } from "../../design-system/ui/forms/Radio";
import { Select } from "../../design-system/ui/forms/Select";
import {
  mesesPorExtenso,
  nomeDoTrimestre,
  trimestreEmApuracao,
  valorDoTrimestre,
  type NumeroDoTrimestre,
} from "../dashboard/trimestre";
import type { SecaoProps } from "./SecaoMeta";
import { useSalvarConfiguracao } from "./useSalvarConfiguracao";

const AUTO = "auto";
const FIXAR = "fixar";

/** Automático por padrão; fixar é exceção — olhar o fechamento de um trimestre
 *  que já acabou. O painel avisa enquanto estiver fixado. */
export function SecaoTrimestre({ valor, aoSalvar }: SecaoProps) {
  const hoje = new Date();
  const gravado = trimestreEmApuracao(valor, hoje);
  const calendario = trimestreEmApuracao(AUTO, hoje);

  const [modo, setModo] = useState(gravado.fixado ? FIXAR : AUTO);
  const [ano, setAno] = useState(String(gravado.ano));
  const [trimestre, setTrimestre] = useState(String(gravado.trimestre));
  const { salvar, salvando, erro } = useSalvarConfiguracao(
    "TRIMESTRE_APURACAO",
    aoSalvar,
  );

  const anoAtual = hoje.getFullYear();
  // O ano gravado entra na lista mesmo fora da janela padrão: sem ele, o
  // Select mostraria outro ano e salvar gravaria o ano que a tela esconde.
  const anos = [...new Set([gravado.ano, anoAtual - 1, anoAtual])]
    .sort((x, y) => x - y)
    .map((a) => ({
      value: String(a),
      label: String(a),
    }));
  const trimestres = [1, 2, 3, 4].map((t) => ({
    value: String(t),
    label: `${t}º trimestre`,
  }));

  const novoValor =
    modo === AUTO
      ? AUTO
      : valorDoTrimestre(Number(ano), Number(trimestre) as NumeroDoTrimestre);

  return (
    <Card padding="lg">
      <h2 className="text-lg font-semibold text-conteudo-heading">
        Trimestre em apuração
      </h2>
      <p className="mt-1 text-sm text-conteudo-muted">
        Qual trimestre o painel da meta mede.
      </p>
      <div className="mt-4 flex flex-col gap-4">
        <RadioGroup
          name="trimestre-apuracao"
          value={modo}
          onChange={setModo}
          options={[
            {
              value: AUTO,
              label: "Automático (segue o calendário)",
              hint: `Agora: ${nomeDoTrimestre(calendario)} · ${mesesPorExtenso(calendario.meses)}`,
            },
            {
              value: FIXAR,
              label: "Fixar um trimestre",
              hint: "Para olhar o fechamento de um trimestre que já acabou.",
            },
          ]}
        />
        {modo === FIXAR && (
          <div className="flex flex-wrap gap-4">
            <Select
              label="Ano"
              options={anos}
              value={ano}
              onChange={(e) => setAno(e.target.value)}
            />
            <Select
              label="Trimestre"
              options={trimestres}
              value={trimestre}
              onChange={(e) => setTrimestre(e.target.value)}
            />
          </div>
        )}
        {erro && <Alert variant="danger">{erro}</Alert>}
        <div>
          <Button
            variant="primary"
            size="sm"
            disabled={salvando || novoValor === (valor ?? AUTO)}
            onClick={() => salvar(novoValor)}
          >
            Salvar trimestre
          </Button>
        </div>
      </div>
    </Card>
  );
}
