import React, { createContext, useContext, useEffect, useState } from "react";
import { fetchEstoque } from "../services/notasapi";

// Tipagem do Produto do Estoque
interface ProdutoEstoque {
  id: number;
  nome: string;
  codigo: string;
  /** `null` quando o produto foi cadastrado no Tiny sem unidade. */
  unidade: string | null;
  preco: number;
  saldo: number;
  situacao: "A" | "I"; // A = Ativo, I = Inativo
}

// Tipagem do contexto
interface EstoqueContextType {
  produtos: ProdutoEstoque[];
  carregando: boolean;
  /** A frase para a tela quando a busca falha; `null` quando deu certo. */
  erro: string | null;
  atualizarProdutos: () => Promise<void>;
}

const EstoqueContext = createContext<EstoqueContextType | undefined>(undefined);

export const EstoqueProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [produtos, setProdutos] = useState<ProdutoEstoque[]>([]);
  const [carregando, setCarregando] = useState(true);
  // Sem isto o `catch` só escrevia no console: com a API caída a tela abria com
  // "0" produtos e "R$ 0,00", e lia-se "o estoque está zerado".
  const [erro, setErro] = useState<string | null>(null);

  // A busca da montagem não liga `carregando` — ele já começa ligado, e
  // ligar de novo dentro do efeito é o que a regra `set-state-in-effect`
  // acusa —, e os setters moram no `.then`: depois de um `await` a regra os
  // lê como síncronos. Quem recarrega à mão passa pela função de baixo.
  const buscarProdutos = () =>
    fetchEstoque().then(
      (data) => {
        setProdutos(data);
        setErro(null);
        setCarregando(false);
      },
      (error) => {
        console.error("Erro ao buscar produtos do estoque:", error);
        setErro("Não foi possível carregar o estoque.");
        setCarregando(false);
      },
    );

  const atualizarProdutos = async () => {
    setCarregando(true);
    await buscarProdutos();
  };

  // Buscar uma vez ao montar
  useEffect(() => {
    buscarProdutos();
  }, []);

  return (
    <EstoqueContext.Provider
      value={{ produtos, carregando, erro, atualizarProdutos }}
    >
      {children}
    </EstoqueContext.Provider>
  );
};

// Hook para usar em qualquer lugar
export const useEstoque = () => {
  const context = useContext(EstoqueContext);
  if (!context) {
    throw new Error("useEstoque deve ser usado dentro de um EstoqueProvider");
  }
  return context;
};
