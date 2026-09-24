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

padroes='postgres(ql)?(\+[a-z0-9]+)?://[^[:space:]:/]+:[^[:space:]@]+@|BEGIN [A-Z ]*PRIVATE KEY|(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|re_[A-Za-z0-9]{20,})|eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}|[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}'
achados=$(procurar -E "$padroes" | filtrar)
if [ -n "$achados" ]; then
    echo "$achados"; echo "^ PADRÃO DE CREDENCIAL/JWT/CPF — revisar cada linha"; achou=1
fi

# IP e CNPJ passam por uma segunda peneira, senão todo número de versão e todo CNPJ
# inventado de teste vira alarme: IP só conta se for público; CNPJ, se o dígito
# verificador bater (os de fixture quase nunca batem).
peneirar() {
    awk '
        function ip_publico(s,   o, n) {
            n = split(s, o, ".")
            if (n != 4 || o[1] > 255 || o[2] > 255 || o[3] > 255 || o[4] > 255) return 0
            if (o[1] == 0 || o[1] == 10 || o[1] == 127 || o[1] >= 224) return 0
            if (o[1] == 172 && o[2] >= 16 && o[2] <= 31) return 0
            if (o[1] == 192 && o[2] == 168) return 0
            if (o[1] == 169 && o[2] == 254) return 0
            return 1
        }
        function cnpj_valido(s,   d, i, soma, r, pesos, n) {
            gsub(/[^0-9]/, "", s)
            if (length(s) != 14 || s ~ /^(.)\1*$/) return 0
            split("5 4 3 2 9 8 7 6 5 4 3 2", pesos, " ")
            for (n = 13; n <= 14; n++) {
                soma = 0
                for (i = 1; i < n; i++) soma += substr(s, i, 1) * pesos[i]
                r = soma % 11; r = (r < 2) ? 0 : 11 - r
                if (substr(s, n, 1) != r) return 0
                split("6 5 4 3 2 9 8 7 6 5 4 3 2", pesos, " ")
            }
            return 1
        }
        # Varre a linha inteira: casamentos colados em outros dígitos (chave de
        # acesso de 44 dígitos, por exemplo) não contam.
        function tem(linha, re, tipo,   p, ini, fim, antes, depois, m) {
            p = 1
            while (match(substr(linha, p), re)) {
                ini = p + RSTART - 1; fim = ini + RLENGTH
                m = substr(linha, ini, RLENGTH)
                antes = (ini > 1) ? substr(linha, ini - 1, 1) : ""
                depois = substr(linha, fim, 1)
                if (antes !~ /[0-9.]/ && depois !~ /[0-9]/ && !(depois == "." && substr(linha, fim + 1, 1) ~ /[0-9]/)) {
                    if (tipo == "ip" && ip_publico(m)) return 1
                    if (tipo == "cnpj" && cnpj_valido(m)) return 1
                }
                p = ini + 1
            }
            return 0
        }
        {
            if (tem($0, "[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+", "ip") ||
                tem($0, "[0-9][0-9]\\.?[0-9][0-9][0-9]\\.?[0-9][0-9][0-9]/?[0-9][0-9][0-9][0-9]-?[0-9][0-9]", "cnpj"))
                print
        }'
}
achados=$(procurar -E '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+|[0-9]{8}/?[0-9]{4}|[0-9]{2}\.[0-9]{3}\.[0-9]{3}/' | peneirar | filtrar)
if [ -n "$achados" ]; then
    echo "$achados"; echo "^ IP PÚBLICO OU CNPJ VÁLIDO — revisar cada linha"; achou=1
fi

proibidos=$(printf '%s\n' "${ARQS[@]}" | grep -E '(^|/)\.env$|(^|/)\.env\.[^e]|\.(xlsx|jsonl|pem|key|pfx|dump)$|acme\.json$|SETUP-CLAUDE\.md$' || true)
if [ -n "$proibidos" ]; then
    echo "$proibidos"; echo "^ ARQUIVO QUE NÃO DEVIA SER VERSIONADO"; achou=1
fi

[ "$achou" -eq 0 ] && echo "OK: nada encontrado"
exit "$achou"
