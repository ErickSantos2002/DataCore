"""Ponte entre a fila do botão "Atualizar dados agora" e o `deploy/atender-pedidos.sh`.

    python -m app.jobs.pedido_atualizacao pegar
        imprime o id do pedido pendente (e o marca como iniciado); nada se não houver
    python -m app.jobs.pedido_atualizacao concluir 42 sucesso
    python -m app.jobs.pedido_atualizacao concluir 42 falha "importar_nfse saiu com 1"

Não é uma carga e não grava em `operacao.execucoes_job`: quem aparece na tela de
Importações são as três cargas que o script roda, cada uma com origem `manual`.
"""

from __future__ import annotations

import argparse

from app.models.database import SessionLocal
from app.services import pedidos_atualizacao


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="Fila do botão de atualização manual.")
    sub = p.add_subparsers(dest="acao", required=True)
    sub.add_parser("pegar")
    c = sub.add_parser("concluir")
    c.add_argument("id", type=int)
    c.add_argument("resultado", choices=["sucesso", "falha"])
    c.add_argument("detalhe", nargs="?", default=None)
    args = p.parse_args(argv)

    db = SessionLocal()
    try:
        if args.acao == "pegar":
            pedido_id = pedidos_atualizacao.pegar(db)
            if pedido_id is not None:
                print(pedido_id)
        else:
            pedidos_atualizacao.concluir(db, args.id, args.resultado, args.detalhe)
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
