import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { fetchContasPagar } from "../services/notasapi";
import { converterParaNumero } from "../lib/dinheiro";

export interface ContaPagar {
  id: number;
  id_tiny: number;
  data_emissao: string;
  vencimento: string;
  competencia: string | null;
  valor: string | number;
  saldo: string | number;
  nro_documento: string | null;
  historico: string | null;
  categoria: string | null;
  situacao: string | null;
  ocorrencia: string;
  dia_vencimento: number | null;
  numero_parcelas: number | null;
  dia_semana_vencimento: number | null;
  cliente_codigo: string | null;
  cliente_nome: string;
  cliente_tipo_pessoa: string | null;
  cliente_cpf_cnpj: string | null;
  cliente_ie: string | null;
  cliente_rg: string | null;
  cliente_fone: string | null;
  cliente_email: string | null;
  cliente_endereco: string | null;
  cliente_numero: string | null;
  cliente_complemento: string | null;
  cliente_bairro: string | null;
  cliente_cep: string | null;
  cliente_cidade: string | null;
  cliente_uf: string | null;
  cliente_pais: string | null;
  liquidacao: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ContaPagarEnriquecida extends ContaPagar {
  valor_numero: number;
  saldo_numero: number;
  mes: string;
  ano: number;
  vencida: boolean;
}

interface ContasPagarContextType {
  contas: ContaPagar[];
  contasEnriquecidas: ContaPagarEnriquecida[];
  carregando: boolean;
  /**
   * A mensagem de falha da última busca, ou `null` quando deu certo.
   *
   * O `catch` só escrevia no console: a tela abria zerada e quem usava não
   * tinha como distinguir "a API caiu" de "não há conta nenhuma" (defeito
   * 1.10). Quem desenha o aviso é a tela, com o `Alert` do design system.
   */
  erro: string | null;
  atualizarContas: () => Promise<void>;
}

const ContasPagarContext = createContext<ContasPagarContextType | undefined>(
  undefined,
);

export const ContasPagarProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [contas, setContas] = useState<ContaPagar[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // A busca da montagem não liga `carregando` — ele já começa ligado, e
  // ligar de novo dentro do efeito é o que a regra `set-state-in-effect`
  // acusa —, e os setters moram no `.then`: depois de um `await` a regra os
  // lê como síncronos. Quem recarrega à mão passa pela função de baixo.
  const buscarContas = useCallback(
    () =>
      fetchContasPagar().then(
        (data) => {
          setContas(Array.isArray(data) ? data : []);
          setErro(null);
          setCarregando(false);
        },
        (error) => {
          console.error("Erro ao buscar contas a pagar:", error);
          setContas([]);
          setErro("Não foi possível carregar as contas a pagar.");
          setCarregando(false);
        },
      ),
    [],
  );

  const atualizarContas = useCallback(async () => {
    setCarregando(true);
    await buscarContas();
  }, [buscarContas]);

  const contasEnriquecidas = React.useMemo<ContaPagarEnriquecida[]>(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    return contas.map((conta) => {
      const [ano, mes, dia] = conta.data_emissao.split("-");
      const dataEmissao = new Date(Number(ano), Number(mes) - 1, Number(dia));

      const [vAno, vMes, vDia] = conta.vencimento.split("-");
      const dataVencimento = new Date(
        Number(vAno),
        Number(vMes) - 1,
        Number(vDia),
      );

      const situacaoLower = conta.situacao?.toLowerCase() ?? "";
      const vencida = dataVencimento < hoje && situacaoLower !== "pago";

      return {
        ...conta,
        valor_numero: converterParaNumero(conta.valor),
        saldo_numero: converterParaNumero(conta.saldo),
        mes: dataEmissao.toLocaleDateString("pt-BR", { month: "long" }),
        ano: dataEmissao.getFullYear(),
        vencida,
      };
    });
  }, [contas]);

  useEffect(() => {
    buscarContas();
  }, [buscarContas]);

  return (
    <ContasPagarContext.Provider
      value={{ contas, contasEnriquecidas, carregando, erro, atualizarContas }}
    >
      {children}
    </ContasPagarContext.Provider>
  );
};

export const useContasPagar = () => {
  const context = useContext(ContasPagarContext);
  if (!context) {
    throw new Error(
      "useContasPagar deve ser usado dentro de um ContasPagarProvider",
    );
  }
  return context;
};
