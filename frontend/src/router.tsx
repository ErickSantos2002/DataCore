import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";
import RequirePermissao from "./auth/RequirePermissao";
import { Spinner } from "./design-system/ui/core/Spinner";

import { ConfiguracoesProvider } from "./context/ConfiguracoesContext";
import { ContasPagarProvider } from "./context/ContasPagarContext";
import { DashboardProvider } from "./context/DashboardContext";
import { EstoqueProvider } from "./context/EstoqueContext";

const Login = lazy(() => import("./pages/Login"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const Home = lazy(() => import("./pages/Home"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const NotFound = lazy(() => import("./pages/NotFound"));

const Clientes = lazy(() => import("./pages/Clientes"));
const Estoque = lazy(() => import("./pages/Estoque"));
const Servicos = lazy(() => import("./pages/Servicos"));
const Vendas = lazy(() => import("./pages/Vendas"));
const Locacao = lazy(() => import("./pages/Locacao"));
const Vendedores = lazy(() => import("./pages/Vendedores"));
const Produtos = lazy(() => import("./pages/Produtos"));
const GerenciamentoFinanceiro = lazy(
  () => import("./pages/GerenciamentoFinanceiro"),
);
const Usuarios = lazy(() => import("./pages/Usuarios"));
const Importacoes = lazy(() => import("./pages/Importacoes"));
const ContasPagar = lazy(() => import("./pages/ContasPagar"));
const ContasReceber = lazy(() => import("./pages/ContasReceber"));

/**
 * Rotas e, junto delas, os providers de dados de cada ramo.
 *
 * A regra de quem entra em cada rota mora em `auth/permissoes.ts`, e
 * `RequirePermissao` a aplica — antes, seis guardas eram definidos aqui dentro,
 * cada um com a própria condição de papel escrita à mão.
 *
 * `ProtectedRoute` continua por fora: ele decide entre *entrar no app* e ir
 * para o login. `RequirePermissao` decide entre *ver a tela* e ver o bloqueio.
 *
 * ## Por que os providers estão aqui
 *
 * O `main.tsx` empilhava dez providers em volta do aplicativo inteiro, então
 * abrir a tela de login montava `EstoqueProvider`, `DataProvider`,
 * `ContasPagarProvider` e mais sete — cada um carregando dados que aquela tela
 * nunca ia usar. Agora cada context é montado no ramo que o consome, e o
 * `main.tsx` guarda só o que é global de verdade: tema, sessão e o router.
 *
 * O critério, quando um context tem mais de um consumidor: ele sobe até o
 * menor grupo de rotas que **só** contém consumidores dele. Quando dois
 * conjuntos de consumidores se cruzam sem um conter o outro — o caso de
 * `ContasPagar` (`/contas-pagar` e `/financeiro`) e de `ContasReceber`
 * (`/contas-receber` e `/financeiro`) — o
 * provider aparece em dois pontos de montagem, em vez de subir até um ancestral
 * que arrastaria junto rotas que não o consomem. O preço é não compartilhar
 * estado entre esses ramos; o preço da alternativa seria voltar a montar dados
 * de contas a pagar para quem abriu serviços.
 *
 * `ThemeProvider` e `AuthProvider` ficaram no `main.tsx` porque toda rota,
 * inclusive `/login`, depende das duas.
 *
 * ## Por que as páginas são carregadas sob demanda
 *
 * Com import estático o build saía num pacote só de ~1,7 MB: quem abria a tela
 * de login baixava o `xlsx`, o `jspdf` e o `recharts` das telas de relatório
 * antes de digitar a senha. Cada página vira um chunk próprio, buscado no
 * momento em que a rota é aberta — e só se o guarda deixar, porque o `import()`
 * só dispara quando o elemento chega a renderizar.
 */
/**
 * O que ocupa a área de conteúdo enquanto o chunk da página vem pela rede.
 * Mesmo desenho do estado de carregando de `RequirePermissao`, com primitivo
 * do Design System em vez de marcação crua.
 */
const CarregandoPagina: React.FC = () => (
  <div className="flex items-center gap-3 p-6 text-conteudo-muted">
    <Spinner size="sm" />
    <span>Carregando página...</span>
  </div>
);

const AppRoutes: React.FC = () => (
  <Suspense fallback={<CarregandoPagina />}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      <Route
        path="/inicio"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />

      <Route
        path="/estoque"
        element={
          <ProtectedRoute>
            <EstoqueProvider>
              <Estoque />
            </EstoqueProvider>
          </ProtectedRoute>
        }
      />

      <Route
        path="/servicos"
        element={
          <ProtectedRoute>
            <RequirePermissao rota="/servicos">
              <Servicos />
            </RequirePermissao>
          </ProtectedRoute>
        }
      />

      <Route
        path="/locacao"
        element={
          <ProtectedRoute>
            <RequirePermissao rota="/locacao">
              <Locacao />
            </RequirePermissao>
          </ProtectedRoute>
        }
      />

      <Route
        path="/importacoes"
        element={
          <ProtectedRoute>
            <RequirePermissao rota="/importacoes">
              <Importacoes />
            </RequirePermissao>
          </ProtectedRoute>
        }
      />

      <Route
        path="/usuarios"
        element={
          <ProtectedRoute>
            <RequirePermissao rota="/usuarios">
              <Usuarios />
            </RequirePermissao>
          </ProtectedRoute>
        }
      />

      {/* Comercial: clientes, vendas, produtos e vendedores.
        O `DataProvider` saiu daqui (item 9.4): as quatro telas pedem ao banco o
        recorte que desenham, cada uma com o seu, em vez de compartilharem uma
        carga do histórico inteiro. Estado global que existia só para não baixar
        as mesmas 4.330 notas quatro vezes deixou de ter motivo quando ninguém
        mais baixa as 4.330 notas. */}
      <Route
        element={
          <ProtectedRoute>
            <Outlet />
          </ProtectedRoute>
        }
      >
        <Route
          path="/clientes"
          element={
            <RequirePermissao rota="/clientes">
              <Clientes />
            </RequirePermissao>
          }
        />
        <Route
          path="/vendas"
          element={
            <RequirePermissao rota="/vendas">
              <Vendas />
            </RequirePermissao>
          }
        />
        <Route
          path="/produtos"
          element={
            <RequirePermissao rota="/produtos">
              <Produtos />
            </RequirePermissao>
          }
        />
        <Route
          path="/vendedores"
          element={
            <RequirePermissao rota="/vendedores">
              <Vendedores />
            </RequirePermissao>
          }
        />
      </Route>

      {/* As duas telas de contas não montam provider nenhum desde o item 9.4:
        cada uma pede ao banco o recorte que desenha. O que havia aqui eram dois
        contextos que baixavam a tabela inteira — 7,9 MB e 11,2 MB — para a tela
        somar os KPIs e os três gráficos no navegador. */}
      <Route
        path="/contas-pagar"
        element={
          <ProtectedRoute>
            <RequirePermissao rota="/contas-pagar">
              <ContasPagar />
            </RequirePermissao>
          </ProtectedRoute>
        }
      />

      <Route
        path="/contas-receber"
        element={
          <ProtectedRoute>
            <RequirePermissao rota="/contas-receber">
              <ContasReceber />
            </RequirePermissao>
          </ProtectedRoute>
        }
      />

      {/* `/configuracoes`, `/dashboard` e `/financeiro` formam um ramo aninhado
        de fora para dentro pelo que cada uma consome: as três leem as metas de
        `ConfiguracoesContext`; `/dashboard` e `/financeiro` também leem
        `DashboardContext`; e `/financeiro` ainda carrega os quatro próprios.
        (`/financeiro` chega em `Dashboard` e `Configuracoes` via `MetaTab`.) */}
      <Route
        element={
          <ProtectedRoute>
            <ConfiguracoesProvider>
              <Outlet />
            </ConfiguracoesProvider>
          </ProtectedRoute>
        }
      >
        <Route
          path="/configuracoes"
          element={
            <RequirePermissao rota="/configuracoes">
              <Configuracoes />
            </RequirePermissao>
          }
        />

        <Route
          element={
            <DashboardProvider>
              <Outlet />
            </DashboardProvider>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />

          <Route
            path="/financeiro"
            element={
              <RequirePermissao rota="/financeiro">
                {/* O `ContasReceberProvider` saiu daqui em 2026-09-09. Ele
                    existia para propagar a falha de uma busca que esta tela
                    NÃO lê — o comentário dizia que outras telas contavam com
                    as contas em memória, e desde o item 9.4 nenhuma conta. Um
                    provider que baixa 11,2 MB para talvez mostrar uma tarja
                    não se paga.
                    O de PAGAR fica: o balancete soma os custos por mês a
                    partir da lista. É a última agregação de contas que ainda
                    acontece no navegador. */}
                <ContasPagarProvider>
                  <GerenciamentoFinanceiro />
                </ContasPagarProvider>
              </RequirePermissao>
            }
          />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/inicio" />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </Suspense>
);

export default AppRoutes;
