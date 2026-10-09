import { useMemo, useState } from "react";

import { Badge, Button, Modal, Spinner, Tabs, TabsContent, TabsList, TabsTrigger, Textarea } from "../../design-system/ui";
import { gravarObservacao, type DetalheDaEmpresa } from "../../services/inadimplencia";
import { formatarMoeda } from "../contas/contas";
import { FormularioDeContato } from "./FormularioDeContato";
import { LinhaDoTempo } from "./LinhaDoTempo";
import { STATUS, mensagemDeErro } from "./inadimplencia";
import { TitulosDaEmpresa } from "./TitulosDaEmpresa";
import { useDetalhe, useTitulos } from "./useInadimplencia";

type Props = { empresa: string | null; onFechar: () => void; onGravou: () => void };

/** Uma empresa por vez: trocar de empresa remonta o corpo e zera aba, formulário e erro. */
export function ModalDaEmpresa(props: Props) {
  return <CorpoDoModal key={props.empresa ?? ""} {...props} />;
}

function CorpoDoModal({ empresa, onFechar, onGravou }: Props) {
  const detalhe = useDetalhe(empresa);
  const titulos = useTitulos(empresa);
  const [gravado, setGravado] = useState<DetalheDaEmpresa | null>(null);
  const [aba, setAba] = useState("titulos");
  const [registrando, setRegistrando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const hoje = useMemo(() => new Date(), []);

  const gravou = (novo: DetalheDaEmpresa) => { setGravado(novo); setErro(null); onGravou(); };
  const d = gravado ?? detalhe.dado;

  return (
    <Modal open={empresa !== null} onClose={onFechar} size="2xl" title={d?.nome ?? "Empresa"} erro={erro ?? detalhe.erro}>
      {!d ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              {d.documento ? <p className="font-mono text-xs text-conteudo-muted">{d.documento}</p> : null}
              <p className="mt-1 text-sm">
                Devendo <b className="font-mono">{formatarMoeda(d.valor_devido)}</b> · maior atraso <b>{d.maior_atraso} dias</b>
              </p>
              <p className="mt-1 text-xs text-conteudo-muted">
                {d.telefone ? <span>{d.telefone}</span> : null}
                {d.telefone && d.email ? " · " : null}
                {d.email ? <a href={`mailto:${d.email}`}>{d.email}</a> : null}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {d.ciclo ? <Badge variant={STATUS[d.ciclo.status].variante}>{STATUS[d.ciclo.status].rotulo}</Badge> : null}
              <Button onClick={() => setRegistrando(true)}>Registrar contato</Button>
            </div>
          </div>

          <Observacao detalhe={d} onGravou={gravou} onErro={setErro} />

          {/* fora das abas: TabsContent desmonta ao trocar de aba e o que foi digitado se perdia */}
          {registrando ? (
            <FormularioDeContato detalhe={d} onGravou={(n) => { gravou(n); setRegistrando(false); }}
              onErro={setErro} onCancelar={() => setRegistrando(false)} />
          ) : null}

          <Tabs value={aba} onChange={setAba}>
            <TabsList>
              <TabsTrigger value="titulos">Títulos</TabsTrigger>
              <TabsTrigger value="cobranca">Cobrança</TabsTrigger>
            </TabsList>
            <TabsContent value="titulos" className="mt-4">
              {titulos.dado ? <TitulosDaEmpresa titulos={titulos.dado} hoje={hoje} /> : <Spinner />}
            </TabsContent>
            <TabsContent value="cobranca" className="mt-4 flex flex-col gap-6">
              <LinhaDoTempo eventos={d.eventos} ciclo={d.ciclo} anteriores={d.ciclos_anteriores} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </Modal>
  );
}

function Observacao({ detalhe, onGravou, onErro }: {
  detalhe: DetalheDaEmpresa;
  onGravou: (d: DetalheDaEmpresa) => void;
  onErro: (m: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(detalhe.observacao ?? "");
  const [gravando, setGravando] = useState(false);

  const salvar = async () => {
    setGravando(true);
    try {
      onGravou(await gravarObservacao(detalhe.empresa, texto));
      setEditando(false);
    } catch (falha) {
      onErro(mensagemDeErro(falha));
    } finally {
      setGravando(false);
    }
  };

  if (editando) {
    return (
      <div className="flex flex-col gap-2">
        <Textarea label="Observação" value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} maxLength={4000} />
        <div className="flex gap-2">
          <Button onClick={salvar} disabled={gravando}>Salvar observação</Button>
          <Button variant="secondary" onClick={() => { setTexto(detalhe.observacao ?? ""); setEditando(false); }}>Cancelar</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-borda bg-surface-elevated p-3">
      <p className="whitespace-pre-wrap text-sm">{detalhe.observacao || <span className="text-conteudo-muted">Sem observação.</span>}</p>
      <Button variant="ghost" size="sm" onClick={() => setEditando(true)} aria-label="Editar observação">Editar</Button>
    </div>
  );
}
