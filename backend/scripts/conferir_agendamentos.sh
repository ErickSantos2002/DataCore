#!/usr/bin/env bash
# Confere se `operacao.jobs` (o catálogo que a tela de Importações mostra) ainda descreve
# os timers que a VPS realmente executa.
#
# POR QUE ISTO EXISTE
# O catálogo é declarado na migration 010 e não é lido por ninguém na VPS: quem dispara as
# cargas continua sendo o systemd. Duas fontes que ninguém compara acabam divergindo — e a
# divergência aqui é do tipo caro, porque a tela continua mostrando um horário com cara de
# certo depois que o timer mudou. Nada no sistema acusaria.
#
# Roda NA VPS:  ssh datacore '/opt/datacore-jobs/conferir-agendamentos.sh'
#
# Sai 0 quando tudo bate, 1 quando há divergência, 2 quando não conseguiu conferir.
set -euo pipefail

PREFIXO_BANCO="${CONTAINER_BANCO_PREFIXO:-erick_datacore-banco}"
BANCO="${PGDATABASE:-datacore-banco}"
USUARIO="${PGUSER:-administrador}"

container_do_banco() {
    docker ps --format '{{.Names}}' | grep -m1 "^${PREFIXO_BANCO}" || true
}

CONTAINER="$(container_do_banco)"
if [ -z "$CONTAINER" ]; then
    echo "ERRO: nenhum container começando com '${PREFIXO_BANCO}' está rodando." >&2
    exit 2
fi

consultar() {
    docker exec "$CONTAINER" psql -U "$USUARIO" -d "$BANCO" -At -F'|' -c "$1"
}

# Horários que o systemd tem para a unidade, em HH:MM, um por linha e ordenados.
horarios_do_systemd() {
    systemctl show "$1" -p TimersCalendar --value 2>/dev/null \
        | grep -oE '[0-9]{2}:[0-9]{2}:[0-9]{2}' \
        | cut -c1-5 | sort -u | paste -sd, -
}

divergencias=0
echo "== conferindo o catálogo de importações contra os timers da VPS =="
echo

while IFS='|' read -r job unidade horarios_banco ativo; do
    if [ -z "${job:-}" ]; then
        continue
    fi

    horarios_systemd="$(horarios_do_systemd "$unidade")"

    # O timer existe?
    if [ -z "$horarios_systemd" ]; then
        echo "✗ ${job}: o catálogo aponta para '${unidade}', que não tem OnCalendar nenhum"
        echo "   (unidade não existe, está sem agendamento, ou o nome mudou)"
        divergencias=$((divergencias + 1))
        continue
    fi

    # Os horários batem?
    if [ "$horarios_banco" != "$horarios_systemd" ]; then
        echo "✗ ${job}: horários diferentes"
        echo "   catálogo: ${horarios_banco}"
        echo "   systemd:  ${horarios_systemd}"
        divergencias=$((divergencias + 1))
        continue
    fi

    # E o "ativo" do catálogo corresponde ao timer estar habilitado?
    habilitado="$(systemctl is-enabled "$unidade" 2>/dev/null || true)"
    if [ "$ativo" = "t" ] && [ "$habilitado" != "enabled" ]; then
        echo "✗ ${job}: o catálogo diz ATIVO, mas '${unidade}' está '${habilitado:-desconhecido}'"
        divergencias=$((divergencias + 1))
        continue
    fi
    if [ "$ativo" != "t" ] && [ "$habilitado" = "enabled" ]; then
        echo "✗ ${job}: o catálogo diz INATIVO, mas '${unidade}' está habilitado e vai rodar"
        divergencias=$((divergencias + 1))
        continue
    fi

    echo "✓ ${job}: ${horarios_systemd} UTC"
done < <(consultar "SELECT job, unidade_systemd,
                           (SELECT string_agg(to_char(h, 'HH24:MI'), ',' ORDER BY h)
                              FROM unnest(horarios) h),
                           ativo
                      FROM operacao.jobs
                     ORDER BY ordem")

echo
if [ "$divergencias" -eq 0 ]; then
    echo "Tudo batendo: o que a tela mostra é o que a VPS faz."
    exit 0
fi

echo "${divergencias} divergência(s). Conserte o catálogo (UPDATE em operacao.jobs) ou o"
echo "timer, conforme qual dos dois está certo — mas não deixe os dois discordando."
exit 1
