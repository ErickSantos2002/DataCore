#!/usr/bin/env bash
# Varre o que o git vai versionar (tracked + untracked não ignorado) atrás de
# credencial, IP e dado pessoal. Uso: scripts/varrer.sh [arquivo-de-valores]
# Sai 1 se achar algo. Os valores sensíveis vêm de fora do repo e nunca são impressos.
set -uo pipefail
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
VALORES="${1:-$HOME/.config/datacore-varredura.txt}"
cd "$RAIZ"
mapfile -t ARQS < <(git ls-files -co --exclude-standard)
achou=0

if [ -f "$VALORES" ]; then
    # Linha vazia no arquivo casaria com tudo: filtra antes.
    if grep -l -I -F -f <(grep -v '^[[:space:]]*$' "$VALORES") -- "${ARQS[@]}" 2>/dev/null; then
        echo "^ VALOR SENSÍVEL LITERAL nos arquivos acima"; achou=1
    fi
else
    echo "AVISO: $VALORES não existe — valores literais NÃO foram conferidos"; achou=1
fi

padroes='postgres(ql)?(\+[a-z0-9]+)?://[^[:space:]:/]+:[^[:space:]@]+@|BEGIN [A-Z ]*PRIVATE KEY|(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|re_[A-Za-z0-9]{20,})|[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}'
if grep -n -I -E "$padroes" -- "${ARQS[@]}" 2>/dev/null; then
    echo "^ PADRÃO DE CREDENCIAL/CPF — revisar cada linha"; achou=1
fi

proibidos=$(printf '%s\n' "${ARQS[@]}" | grep -E '(^|/)\.env$|(^|/)\.env\.[^e]|\.(xlsx|jsonl|pem|key|pfx|dump)$|acme\.json$|SETUP-CLAUDE\.md$' || true)
if [ -n "$proibidos" ]; then
    echo "$proibidos"; echo "^ ARQUIVO QUE NÃO DEVIA SER VERSIONADO"; achou=1
fi

[ "$achou" -eq 0 ] && echo "OK: nada encontrado"
exit "$achou"
