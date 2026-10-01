import { createContext, useContext, useEffect, useState } from "react";
import {
  fetchConfiguracoes,
  updateConfiguracao,
  createConfiguracao,
} from "../services/notasapi";

interface Configuracao {
  id: number;
  chave: string;
  valor: string;
}

interface ConfiguracoesContextType {
  configuracoes: Configuracao[];
  carregando: boolean;
  editarConfiguracao: (chave: string, valor: string) => Promise<void>;
  criarConfiguracao: (chave: string, valor: string) => Promise<void>;
}

export const ConfiguracoesContext = createContext<ConfiguracoesContextType>({
  configuracoes: [],
  carregando: true,
  editarConfiguracao: async () => {},
  criarConfiguracao: async () => {},
});

export const ConfiguracoesProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [configuracoes, setConfiguracoes] = useState<Configuracao[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const carregar = async () => {
      try {
        const res = await fetchConfiguracoes();
        setConfiguracoes(res);
      } catch (err) {
        console.error("Erro ao carregar configurações:", err);
      } finally {
        setCarregando(false);
      }
    };
    carregar();
  }, []);

  // O estado recebe o valor que o backend GRAVOU (normalizado), não o digitado.
  // Erro sobe para quem chamou — a página mostra a mensagem.
  const editarConfiguracao = async (chave: string, valor: string) => {
    const gravada = await updateConfiguracao(chave, valor);
    setConfiguracoes((prev) =>
      prev.map((c) => (c.chave === chave ? { ...c, valor: gravada.valor } : c)),
    );
  };

  const criarConfiguracao = async (chave: string, valor: string) => {
    const nova = await createConfiguracao(chave, valor);
    setConfiguracoes((prev) => [...prev, nova]);
  };

  return (
    <ConfiguracoesContext.Provider
      value={{
        configuracoes,
        carregando,
        editarConfiguracao,
        criarConfiguracao,
      }}
    >
      {children}
    </ConfiguracoesContext.Provider>
  );
};

export const useConfiguracoes = () => useContext(ConfiguracoesContext);
