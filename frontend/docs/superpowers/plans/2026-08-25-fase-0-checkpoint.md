# Fase 0 — Checkpoint humano (Task 8)

Este é o portão que a própria Fase 0 definiu. Nenhuma tela foi reescrita nesta
fase: o que mudou foi a paleta, a fonte e o tema escuro, tudo por configuração.
O que se procura aqui é o efeito colateral que configuração produz e que teste
não pega.

**Como rodar:** `npm run dev` e abrir `http://localhost:5174`.

---

## O que já sabemos — não precisa reportar

Estes itens estão medidos, registrados e endereçados. Se aparecerem, é o
esperado.

| O que você vai ver                                       | Por quê                                                                      | Quando se resolve                                        |
| -------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------- |
| Tela de login continua escura no tema claro              | Painel escuro deliberado; o design system registra login escuro como exceção | Fase 1, ao migrar o Login                                |
| No escuro, o card quase não se separa do fundo da página | Os papéis dos tokens estão invertidos: contraste caiu de 1,72 para 1,09      | Fase 1, no `AppShell` — está escrito no spec             |
| Barra de rolagem continua com o desenho antigo           | Regra do design system perde na cascata para a que já existia                | Fase 1, no `AppShell`                                    |
| Links não têm a cor do design system                     | Perdem para o preflight do Tailwind                                          | Fase 1, no `AppShell`                                    |
| Valor em azul sobre fundo escuro parece apagado          | `text-blue-600` dá 3,29:1 no escuro — já reprovava antes da fase (3,45)      | Fase 3, ao trocar para `text-action`, que sobe para 6,64 |
| Botão verde "Exportar Excel" com texto branco            | 3,30:1, pré-existente, a fase não tocou em verde                             | Fase 3                                                   |
| Percentual em vermelho apagado                           | `text-red-600`, 3,60:1, pré-existente                                        | Fase 3                                                   |

---

## O que procurar

**O tema claro é a prioridade.** Ele nunca foi visto por ninguém nesta branch —
a medição automática só conseguiu rodar no escuro. A ponte de paleta mexeu nos
dez degraus de `blue-*`, e é o tema claro que mais os usa.

Em cada rota, nos dois temas:

- [ ] Texto ilegível, ou elemento que sumiu
- [ ] Branco sobre branco, ou card sem contraste contra a página
- [ ] Botão que perdeu a cor
- [ ] **Azul que antes significava "aviso" e agora parece ação.** Este é o único
      item que a fase pediu explicitamente para catalogar. É uma caixa de aviso
      ou uma faixa informativa que ficou com a cara de botão primário. Anote a
      tela e o que estava escrito.

## As 18 rotas

- [ ] `/login` — claro e escuro
- [ ] `/inicio`
- [ ] `/dashboard`
- [ ] `/clientes`
- [ ] `/estoque`
- [ ] `/servicos`
- [ ] `/vendas`
- [ ] `/locacao`
- [ ] `/produtos`
- [ ] `/vendedores`
- [ ] `/usuarios`
- [ ] `/configuracoes`
- [ ] `/financeiro`
- [ ] `/contas-pagar`
- [ ] `/contas-receber`
- [ ] `/` — deve redirecionar para `/inicio`
- [ ] Uma URL inexistente — deve dar 404
- [ ] Uma rota bloqueada para o seu papel — deve dar a tela de bloqueio

## Onde anotar

O que você achar vai para a seção **Perguntas em aberto** do spec
(`docs/superpowers/specs/2026-08-25-datacorehs-design-system-design.md`), cada
item amarrado à tela onde apareceu. É de lá que a Fase 3 vai tirar o trabalho de
cada tela — o ledger da execução é descartado quando a fase fecha.

Basta me dizer o que viu; eu registro.
