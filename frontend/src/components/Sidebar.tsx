import { KeyRound, RefreshCw } from "lucide-react";

import { useAuth } from "../hooks/useAuth";
import { podeAcessar } from "../auth/permissoes";
import type {
  NavGroup,
  NavItem,
} from "../design-system/ui/navigation/AppShell";

interface ItemBruto {
  label: string;
  path: string;
  icon: NavItem["icon"];
}

/**
 * Itens de navegação do DataCoreHS, por seção do design.
 *
 * Este arquivo **não decide mais quem vê o quê**. Até a Fase 2 ele carregava os
 * próprios predicados — `idsFinanceiroLegado`, `podeContas`, `ehAdmin` —, uma
 * segunda fonte de verdade escrita à mão ao lado da do `router.tsx`. Duas
 * fontes escritas separadamente podem discordar, e discordavam em silêncio:
 * todo o grupo "Comercial" aparecia para qualquer papel, então quem tinha papel
 * `servicos` via Vendas, Clientes, Produtos e Vendedores no menu e levava
 * bloqueio ao clicar. Agora a visibilidade de cada item é uma pergunta só —
 * `podeAcessar(path, user)`, a mesma função que o `RequirePermissao` consulta.
 * Item no menu e porta aberta passam a ser, por construção, a mesma coisa.
 *
 * Consequência prática de derivar da matriz: adicionar um item aqui é declarar
 * rótulo, rota e ícone. Quem pode ver sai da matriz em `auth/permissoes.ts`, e
 * `Sidebar.invariante.test.tsx` cobre o item novo sem que ninguém precise
 * lembrar de atualizar teste nenhum.
 *
 * **Estoque fica em "Principal"**, não em "Administração". A rota é livre por
 * decisão do Erick — a empresa inteira pode ver —, e exibi-la sob Administração
 * fazia o menu prometer uma restrição que não existe. Com ela em Principal a
 * estrutura diz a verdade: Principal é o que todo mundo vê; Comercial,
 * Financeiro e Administração são áreas restritas.
 *
 * Os ícones vêm do `Icon` do design system (`IconName`, ex.: "dashboard"),
 * exceto Locação: não existe traço de "chave" no `ICON_PATHS`, então ela usa
 * o `KeyRound` do lucide-react — o próprio `Icon` recomenda pegar o
 * equivalente em Lucide quando falta um traçado.
 */
export default function useNavGroups(): NavGroup[] {
  const { user } = useAuth();

  const secoes: { label: string; itens: ItemBruto[] }[] = [
    {
      label: "Principal",
      itens: [
        { label: "Início", path: "/inicio", icon: "dashboard" },
        { label: "Meta do trimestre", path: "/dashboard", icon: "chart" },
        { label: "Estoque", path: "/estoque", icon: "cpu" },
      ],
    },
    {
      label: "Comercial",
      itens: [
        { label: "Vendas", path: "/vendas", icon: "ticket" },
        { label: "Serviços", path: "/servicos", icon: "clock" },
        { label: "Clientes", path: "/clientes", icon: "users" },
        { label: "Produtos", path: "/produtos", icon: "box" },
        { label: "Vendedores", path: "/vendedores", icon: "groups" },
      ],
    },
    {
      label: "Financeiro",
      itens: [
        { label: "Gerenciamento", path: "/financeiro", icon: "chart" },
        { label: "Contas a pagar", path: "/contas-pagar", icon: "tag" },
        { label: "Contas a receber", path: "/contas-receber", icon: "tag" },
        {
          label: "Locação",
          path: "/locacao",
          // "key" não existe no ICON_PATHS do Icon — pegando o equivalente
          // em Lucide, como a própria doc do design system recomenda.
          icon: (
            <KeyRound
              size={20}
              strokeWidth={1.75}
              aria-hidden="true"
              className="shrink-0"
            />
          ),
        },
      ],
    },
    {
      label: "Administração",
      itens: [
        {
          label: "Importações",
          path: "/importacoes",
          // Como a Locação: "refresh" não existe no ICON_PATHS do `Icon`, e o
          // campo aceita string — o ícone sumiria sem erro nenhum.
          icon: (
            <RefreshCw
              size={20}
              strokeWidth={1.75}
              aria-hidden="true"
              className="shrink-0"
            />
          ),
        },
        { label: "Usuários", path: "/usuarios", icon: "groups" },
        { label: "Configurações", path: "/configuracoes", icon: "shield" },
      ],
    },
  ];

  return secoes
    .map((secao) => ({
      label: secao.label,
      items: secao.itens
        .filter((item) => podeAcessar(item.path, user))
        .map(({ label, path, icon }) => ({ label, path, icon })),
    }))
    .filter((grupo) => grupo.items.length > 0);
}
