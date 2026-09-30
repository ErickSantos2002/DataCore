"""Fila do botão "Atualizar dados agora", em `operacao.pedidos_atualizacao`.

Dois lados usam este módulo e nenhum dos dois executa a atualização:

* a **API** grava o pedido (`pedir`) e responde a tela (`ultimo`);
* a **VPS**, pelo `deploy/atender-pedidos.sh`, pega o pedido (`pegar`), roda as três
  cargas e fecha a linha (`concluir`) — ver `app/jobs/pedido_atualizacao.py`.

A API não roda as cargas porque o dbt mora em outro container, que ela não alcança. Ver
a migration 012.
"""

from __future__ import annotations

from typing import Any, Optional

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

# Pedido aberto há mais que isso não vai mais terminar: a VPS caiu ou o timer está
# desligado. A sequência normal leva ~7 min; o pior caso honesto é o dbt esgotar as três
# tentativas (~10 min) depois de esperar uma carga agendada terminar (~6 min).
ABANDONO = "1 hour"

_COLUNAS = "id, pedido_em, pedido_por, iniciado_em, concluido_em, resultado, detalhe"


class PedidoEmAndamento(Exception):
    """Já existe um pedido aberto. Carrega esse pedido, para a tela mostrar o estado dele."""

    def __init__(self, pedido: Optional[dict[str, Any]]) -> None:
        super().__init__("já existe uma atualização em andamento")
        self.pedido = pedido


def _abandonar_velhos(db: Session) -> None:
    db.execute(text(
        "UPDATE operacao.pedidos_atualizacao"
        "   SET concluido_em = now(), resultado = 'abandonado',"
        "       detalhe = 'ficou aberto mais de 1 hora sem terminar'"
        f" WHERE concluido_em IS NULL AND pedido_em < now() - interval '{ABANDONO}'"
    ))


def ultimo(db: Session) -> Optional[dict[str, Any]]:
    linha = db.execute(text(
        f"SELECT {_COLUNAS} FROM operacao.pedidos_atualizacao ORDER BY id DESC LIMIT 1"
    )).mappings().first()
    return dict(linha) if linha else None


def pedir(db: Session, usuario: str) -> dict[str, Any]:
    """Grava um pedido novo. Se já houver um aberto, levanta `PedidoEmAndamento`."""
    _abandonar_velhos(db)
    db.commit()
    try:
        linha = db.execute(text(
            "INSERT INTO operacao.pedidos_atualizacao (pedido_por) VALUES (:usuario)"
            f" RETURNING {_COLUNAS}"
        ), {"usuario": usuario}).mappings().one()
        db.commit()
    except IntegrityError:
        # O índice único parcial é quem garante "um por vez", não um SELECT antes do
        # INSERT: dois cliques simultâneos passariam os dois pelo SELECT.
        db.rollback()
        raise PedidoEmAndamento(ultimo(db))
    return dict(linha)


def pegar(db: Session) -> Optional[int]:
    """Marca o pedido pendente como iniciado e devolve o id; None se não houver."""
    pedido_id = db.execute(text(
        "UPDATE operacao.pedidos_atualizacao SET iniciado_em = now()"
        " WHERE id = (SELECT id FROM operacao.pedidos_atualizacao"
        "              WHERE iniciado_em IS NULL AND concluido_em IS NULL"
        "              ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED)"
        " RETURNING id"
    )).scalar()
    db.commit()
    return pedido_id


def concluir(db: Session, pedido_id: int, resultado: str,
             detalhe: Optional[str] = None) -> None:
    db.execute(text(
        "UPDATE operacao.pedidos_atualizacao"
        "   SET concluido_em = now(), resultado = :resultado, detalhe = :detalhe"
        " WHERE id = :id AND concluido_em IS NULL"
    ), {"id": pedido_id, "resultado": resultado, "detalhe": detalhe or None})
    db.commit()
