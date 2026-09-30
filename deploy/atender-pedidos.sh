#!/usr/bin/env bash
# Atende o botão "Atualizar dados agora" da tela Meta do trimestre, na VPS.
#
# Roda a cada minuto pelo `datacore-atualizacao-manual.timer`. Sem pedido na fila
# (`operacao.pedidos_atualizacao`), sai calado. Com pedido, roda a mesma sequência da
# atualização da tarde — notas → NFS-e → dbt — e fecha o pedido com o resultado.
#
# As três cargas vão com `ORIGEM_FORCADA=manual`: este script roda sob timer, mas quem
# disparou foi uma pessoa, e a tela de Importações tem que dizer isso.
#
# Uma carga que falha NÃO interrompe as seguintes: se a NFS-e cair, as notas novas ainda
# merecem chegar na tela, e o dbt é o que as leva até lá. O pedido fecha como `falha`
# dizendo qual etapa caiu.
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
PREFIXO="${CONTAINER_PREFIXO:-erick_datacore-api}"

container_api() {
    docker ps --format '{{.Names}}' | grep -m1 "^${PREFIXO}" || true
}

fila() {
    local container
    container="$(container_api)"
    if [ -z "$container" ]; then
        echo "ERRO: nenhum container começando com '${PREFIXO}' está rodando." >&2
        return 1
    fi
    docker exec "$container" python -m app.jobs.pedido_atualizacao "$@"
}

# Se a carga agendada da mesma coisa estiver rodando agora, espera ela acabar em vez de
# rodar duas em paralelo contra as mesmas tabelas.
esperar_unidade() {
    while systemctl is-active --quiet "$1"; do
        echo "   $1 está rodando; aguardando terminar"
        sleep 15
    done
}

PEDIDO="$(fila pegar)"
if [ -z "$PEDIDO" ]; then
    exit 0
fi

echo "== $(date -Is) | pedido ${PEDIDO}: notas → NFS-e → dbt =="
FALHAS=()

for JOB in extrair_notas importar_nfse; do
    esperar_unidade "tiny-extrator@${JOB}.service"
    codigo=0
    ORIGEM_FORCADA=manual "$DIR/rodar-job.sh" "$JOB" || codigo=$?
    if [ "$codigo" -ne 0 ]; then
        FALHAS+=("${JOB} saiu com ${codigo}")
    fi
done

esperar_unidade "datacore-dbt.service"
codigo=0
ORIGEM_FORCADA=manual "$DIR/rodar-dbt.sh" || codigo=$?
if [ "$codigo" -ne 0 ]; then
    FALHAS+=("dbt build saiu com ${codigo}")
fi

if [ "${#FALHAS[@]}" -eq 0 ]; then
    fila concluir "$PEDIDO" sucesso
    echo "== $(date -Is) | pedido ${PEDIDO} concluído =="
else
    DETALHE="$(printf '%s; ' "${FALHAS[@]}")"
    DETALHE="${DETALHE%; }"
    fila concluir "$PEDIDO" falha "$DETALHE"
    echo "== $(date -Is) | pedido ${PEDIDO} FALHOU: ${DETALHE} ==" >&2
    exit 1
fi
