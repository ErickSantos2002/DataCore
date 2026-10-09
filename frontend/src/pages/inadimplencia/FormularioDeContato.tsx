import { useState } from "react";

import { Button, Input, Select, Textarea } from "../../design-system/ui";
import { diaLocal } from "../../lib/datas";
import { converterParaNumero } from "../../lib/dinheiro";
import { registrarEvento, type CodigoDeStatus, type DetalheDaEmpresa } from "../../services/inadimplencia";
import { CANAIS, STATUS, STATUS_MANUAIS, mensagemDeErro } from "./inadimplencia";

const doisDigitos = (n: number) => String(n).padStart(2, "0");

/** Valor inicial do campo datetime-local: agora, no fuso de quem olha (sem passar por UTC). */
function agoraLocal(): string {
  const d = new Date();
  return `${diaLocal(d)}T${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`;
}

/** Instante com o deslocamento do fuso local escrito (ex.: 2026-10-09T14:30:00-03:00): o backend lê sem ambiguidade. */
function comFusoLocal(d: Date): string {
  const minutos = -d.getTimezoneOffset();
  const sinal = minutos >= 0 ? "+" : "-";
  const abs = Math.abs(minutos);
  return `${diaLocal(d)}T${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}:${doisDigitos(d.getSeconds())}`
    + `${sinal}${doisDigitos(Math.floor(abs / 60))}:${doisDigitos(abs % 60)}`;
}

/** Registra um contato de cobrança (e, se for o caso, a promessa). Erros do servidor sobem pelo `onErro`. */
export function FormularioDeContato({ detalhe, onGravou, onErro, onCancelar }: {
  detalhe: DetalheDaEmpresa;
  onGravou: (novo: DetalheDaEmpresa) => void;
  onErro: (mensagem: string) => void;
  onCancelar: () => void;
}) {
  const [quando, setQuando] = useState(agoraLocal);
  const [canal, setCanal] = useState("");
  const [filial, setFilial] = useState("");
  const [status, setStatus] = useState<CodigoDeStatus | "">("");
  const [data, setData] = useState("");
  const [valor, setValor] = useState("");
  const [condicoes, setCondicoes] = useState("");
  const [anotacao, setAnotacao] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [gravando, setGravando] = useState(false);

  const gravar = async () => {
    if (!canal && !status) { setAviso("Escolha o canal do contato ou um novo status."); return; }
    if (status === "promessa" && !data) { setAviso("Informe a data prometida."); return; }
    const instante = new Date(quando);
    if (Number.isNaN(instante.getTime())) { setAviso("Informe quando o contato aconteceu."); return; }
    setAviso(null);
    setGravando(true);
    try {
      onGravou(await registrarEvento(detalhe.empresa, {
        ocorrido_em: comFusoLocal(instante),
        canal: canal || null,
        filial_cnpj: filial || null,
        status_novo: status || null,
        promessa: status === "promessa"
          ? { data, valor: valor ? converterParaNumero(valor) : null, condicoes: condicoes.trim() || null }
          : null,
        anotacao: anotacao.trim() || null,
      }));
    } catch (falha) {
      onErro(mensagemDeErro(falha));
    } finally {
      setGravando(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-borda p-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input label="Quando" type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} />
        <Select label="Canal" placeholder="—" value={canal} onChange={(e) => setCanal(e.target.value)} options={CANAIS} />
        <Select label="Filial" placeholder="Empresa toda" value={filial} onChange={(e) => setFilial(e.target.value)}
          options={detalhe.filiais.map((f) => ({ value: f.cnpj, label: `${f.nome} · ${f.cnpj}` }))} />
        <Select label="Novo status" placeholder="Manter o atual" value={status}
          onChange={(e) => setStatus(e.target.value as CodigoDeStatus | "")}
          options={STATUS_MANUAIS.map((s) => ({ value: s, label: STATUS[s].rotulo }))} />
      </div>
      {status === "promessa" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Input label="Data prometida" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          <Input label="Valor prometido" inputMode="decimal" placeholder="opcional" value={valor} onChange={(e) => setValor(e.target.value)} />
          <Input label="Condições" placeholder="ex.: metade agora, metade em 30 dias" value={condicoes} onChange={(e) => setCondicoes(e.target.value)} />
        </div>
      ) : null}
      <Textarea label="Anotação" rows={3} maxLength={4000} value={anotacao} onChange={(e) => setAnotacao(e.target.value)}
        placeholder="Com quem falou, o que ficou combinado..." />
      {aviso ? <p className="text-sm text-danger">{aviso}</p> : null}
      <div className="flex gap-2">
        <Button onClick={gravar} disabled={gravando}>Gravar</Button>
        <Button variant="secondary" onClick={onCancelar}>Cancelar</Button>
      </div>
    </div>
  );
}
