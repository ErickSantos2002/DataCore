# Fase 1 — Checkpoint humano (Task 15)

A Fase 1 portou os 21 primitivos do Design System, refez a casca do app sobre o
`AppShell` e migrou seis telas piloto. Este é o portão antes de dar a fase por
pronta.

**Como rodar:** `npm run dev` e abrir `http://localhost:5174`. As credenciais
estão no `.env`, em `login` e `senha`.

---

## O que a verificação automática já garante

| Critério                         | Resultado                                                  |
| -------------------------------- | ---------------------------------------------------------- |
| Suíte de testes                  | **124** passando em 40 arquivos (eram 24 no fim da Fase 0) |
| Build                            | limpo                                                      |
| Lint                             | **190**, abaixo da linha de base de 192 da Fase 0          |
| As 12 telas grandes              | tocadas **só** pela troca de token e pelos três toasts     |
| Ícone remoto em `src/`           | **zero** — os 19 viraram `lucide-react`                    |
| Hexadecimal arbitrário em classe | **zero**                                                   |

Cinco testes de guarda vigiam o que a Fase 3 vai escrever: cor, ícone remoto,
`alert()` do navegador, papéis de token e contrato de port dos primitivos.

---

## O que procurar

**A pergunta que só olho humano responde: as seis telas migradas parecem irmãs
das doze que ainda não foram?** Se uma piloto parecer de outro sistema, o
contrato da Fase 3 precisa de ajuste antes de encostar em `Vendas.tsx`.

### As seis telas migradas

- [ ] `/login` — **continua escuro nos dois temas?** É painel escuro deliberado
- [ ] `/inicio` (Home)
- [ ] `/configuracoes` — o formulário: campo, interruptor e botão
- [ ] Uma URL inexistente (NotFound)
- [ ] Uma rota bloqueada para o seu papel (Bloqueio)
- [ ] Uma tela em construção (EmConstrucao)

### A casca, em qualquer tela

- [ ] Item de menu ativo: fundo de tinta, texto azul, **barra de 2px à esquerda**
- [ ] Sidebar recolhendo para 72px, e o **tooltip aparecendo à direita** do ícone
- [ ] `Ctrl+clique` num item de menu abre em nova aba — ele é link de verdade agora
- [ ] O card se separando do fundo da página, nos dois temas
- [ ] Ícones do menu desenhados localmente, sem depender do icons8

### O que mudou de comportamento, de propósito

- [ ] Os **quatro `alert()`** do navegador viraram toast no canto superior
      direito. Dispare um: em Configurações, tente trocar a senha com as duas
      diferentes
- [ ] O `Bloqueio` **não pisca mais**. Havia uma animação em laço infinito
      (preto ↔ vermelho, 1s) que o checklist proíbe e que é problema de
      acessibilidade

### Correções de acessibilidade que entraram junto

Os campos do `/login` e o interruptor de `/configuracoes` **não tinham rótulo
acessível**. Não era defeito da migração — já estava assim, e só apareceu
porque o teste de caracterização pergunta pelo rótulo. Se você usa leitor de
tela ou navega por `Tab`, vale conferir que agora fazem sentido.

---

## Onde anotar

O que você achar vai para a seção **Achados do checkpoint** do spec
(`docs/superpowers/specs/2026-08-25-datacorehs-design-system-design.md`), amarrado
à tela onde apareceu. É de lá que a Fase 3 tira o trabalho de cada tela.

Basta me dizer o que viu; eu registro.
