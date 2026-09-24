"""Ticket de uso único entre o callback da Microsoft e o front.

O callback não pode mandar o JWT na URL (histórico, log do proxy, Referer): grava
um ticket opaco de 60 s apontando para o usuário e manda só o ticket. O front
troca por POST e só aí o JWT é criado.

No banco fica só o sha256 do ticket e o id do usuário — nem o ticket em claro nem
o JWT: o usuário de leitura da empresa (pg_read_all_data) enxerga esta tabela, e
com o ticket ou o token em mãos entraria na conta de outra pessoa.

Mora no Postgres, e não num dict em memória como no GestorHS: em memória, com dois
workers ou duas réplicas, a troca cai num processo que não emitiu o ticket e o
login falha em metade das tentativas, sem nada no log.
"""
import hashlib
import secrets
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

VALIDADE_SEGUNDOS = 60


def _hash(ticket: str) -> str:
    return hashlib.sha256(ticket.encode()).hexdigest()


def emitir(db: Session, usuario_id: int) -> str:
    ticket = secrets.token_urlsafe(32)
    db.execute(
        text(
            "INSERT INTO auth.sso_tickets (ticket_hash, usuario_id, expira_em)"
            " VALUES (:h, :u, now() + make_interval(secs => :s))"
        ),
        {"h": _hash(ticket), "u": usuario_id, "s": VALIDADE_SEGUNDOS},
    )
    db.commit()
    return ticket


def resgatar(db: Session, ticket: str) -> Optional[int]:
    """Devolve o id do usuário e queima o ticket; None se não existe, venceu ou já foi usado.

    O DELETE ... RETURNING é atômico: duas trocas simultâneas do mesmo ticket, a
    segunda espera o lock da linha, acha a linha apagada e volta vazia.
    """
    # O hash já tiraria o NUL do bind, mas vazio/NUL é inválido de qualquer jeito.
    if not ticket or "\x00" in ticket:
        return None
    db.execute(text("DELETE FROM auth.sso_tickets WHERE expira_em <= now()"))
    usuario_id = db.execute(
        text(
            "DELETE FROM auth.sso_tickets WHERE ticket_hash = :h AND expira_em > now()"
            " RETURNING usuario_id"
        ),
        {"h": _hash(ticket)},
    ).scalar_one_or_none()
    db.commit()
    return usuario_id
