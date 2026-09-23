# Origem destes arquivos

Cópia fiel do design system publicado no Claude Design.

- **Projeto:** Health & Safety Design System
- **projectId:** `ef9f35f6-3af0-4651-9dee-45d08884432a`
- **Sincronizado em:** 2026-08-25
- **Arquivos copiados:** `styles.css` e `tokens/{colors,typography,spacing,shape,motion,base}.css`

## Regras

Estes arquivos **não são editados aqui**. Mudança de token acontece no projeto
do Claude Design e desce por novo sync. Editar localmente é o caminho conhecido
para os oito sistemas da H&S divergirem de novo — foi assim que se chegou a
quatro azuis diferentes.

`src/design-system` está no `.prettierignore` pelo mesmo motivo: reformatar faria
o próximo sync divergir por espaço em branco.

Os **primitivos** do design system (`Button`, `Card`, `Table`...) não estão aqui.
Eles são portados para `.tsx` + Tailwind na Fase 1, porque o original é escrito
com estilo inline e hover em JavaScript — o que não entrega `focus-visible`,
que o próprio checklist do design system exige. Ver a Decisão 4 do spec.

## Documento que governa

`docs/superpowers/specs/2026-08-25-datacorehs-design-system-design.md`
