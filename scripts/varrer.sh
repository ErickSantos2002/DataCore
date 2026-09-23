#!/usr/bin/env bash
# Varre o que o git vai versionar (tracked + untracked não ignorado) atrás de
# credencial, IP e dado pessoal. Uso: scripts/varrer.sh [arquivo-de-valores]
# Sai 1 se achar algo. Os valores sensíveis vêm de fora do repo e nunca são impressos
# (para eles só sai arquivo:linha).
#
# Falso positivo conhecido vai em scripts/varrer-excecoes.txt, uma linha por caso:
#   caminho/do/arquivo|trecho fixo que identifica a linha inofensiva
# A exceção vale só para linhas daquele arquivo que contêm o trecho. O trecho nunca
# pode conter o valor sensível — este arquivo é público.
set -uo pipefail
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
VALORES="${1:-$HOME/.config/datacore-varredura.txt}"
EXCECOES="$RAIZ/scripts/varrer-excecoes.txt"
cd "$RAIZ"
git rev-parse --git-dir >/dev/null 2>&1 || { echo "ERRO: $RAIZ não é um repo git"; exit 2; }

# -z: nome com acento vem cru, sem as aspas do core.quotePath. Arquivo versionado que
# sumiu do disco sai da lista — senão o grep devolve 2 e esconde o que achou.
ARQS=()
while IFS= read -r -d '' f; do
    [ -f "$f" ] && ARQS+=("$f")
done < <(git ls-files -z -co --exclude-standard)
[ "${#ARQS[@]}" -gt 0 ] || { echo "ERRO: nenhum arquivo para varrer"; exit 2; }
achou=0
ERROS=$(mktemp)
trap 'rm -f "$ERROS"' EXIT

# Lê "arquivo:linha:conteúdo" e tira as linhas cobertas por uma exceção.
filtrar() {
    awk -v exc="$EXCECOES" '
        BEGIN {
            while ((getline l < exc) > 0) {
                if (l ~ /^#/ || index(l, "|") == 0) continue
                i = index(l, "|"); n++; arq[n] = substr(l, 1, i - 1); tre[n] = substr(l, i + 1)
            }
        }
        {
            i = index($0, ":"); f = substr($0, 1, i - 1)
            resto = substr($0, i + 1); c = substr(resto, index(resto, ":") + 1)
            for (k = 1; k <= n; k++) if (arq[k] == f && index(c, tre[k])) next
            print
        }'
}

# grep devolve 1 quando não acha; 2 é erro de leitura e conta como achado.
procurar() {  # $@ = opções do grep
    grep -n -H -I "$@" -- "${ARQS[@]}" 2>"$ERROS"
    if [ "$?" -ge 2 ]; then
        sed 's/^/ERRO: /' "$ERROS" >&2
        echo "ERRO_DE_LEITURA:0:"
    fi
}

if [ -f "$VALORES" ]; then
    # Linha vazia no arquivo casaria com tudo: filtra antes.
    achados=$(procurar -F -f <(grep -v '^[[:space:]]*$' "$VALORES") | filtrar | cut -d: -f1,2)
    if [ -n "$achados" ]; then
        echo "$achados"; echo "^ VALOR SENSÍVEL LITERAL (arquivo:linha)"; achou=1
    fi
else
    echo "AVISO: $VALORES não existe — valores literais NÃO foram conferidos"; achou=1
fi

padroes='postgres(ql)?(\+[a-z0-9]+)?://[^[:space:]:/]+:[^[:space:]@]+@|BEGIN [A-Z ]*PRIVATE KEY|(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|re_[A-Za-z0-9]{20,})|[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}'
achados=$(procurar -E "$padroes" | filtrar)
if [ -n "$achados" ]; then
    echo "$achados"; echo "^ PADRÃO DE CREDENCIAL/CPF — revisar cada linha"; achou=1
fi

proibidos=$(printf '%s\n' "${ARQS[@]}" | grep -E '(^|/)\.env$|(^|/)\.env\.[^e]|\.(xlsx|jsonl|pem|key|pfx|dump)$|acme\.json$|SETUP-CLAUDE\.md$' || true)
if [ -n "$proibidos" ]; then
    echo "$proibidos"; echo "^ ARQUIVO QUE NÃO DEVIA SER VERSIONADO"; achou=1
fi

[ "$achou" -eq 0 ] && echo "OK: nada encontrado"
exit "$achou"
