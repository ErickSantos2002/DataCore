"""Ticket de uso único entre o callback da Microsoft e o front.

O callback não pode mandar o JWT na URL (histórico, log do proxy, Referer): grava
o token sob um ticket opaco de 60 s e manda só o ticket. O front troca por POST.

Mora no Postgres, e não num dict em memória como no GestorHS: em memória, com dois
workers ou duas réplicas, a troca cai num processo que não emitiu o ticket e o
login falha em metade das tentativas, sem nada no log.
"""
import secrets
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

VALIDADE_SEGUNDOS = 60


def emitir(db: Session, access_token: str) -> str:
    ticket = secrets.token_urlsafe(32)
    db.execute(
        text(
            "INSERT INTO auth.sso_tickets (ticket, access_token, expira_em)"
            " VALUES (:t, :a, now() + make_interval(secs => :s))"
        ),
        {"t": ticket, "a": access_token, "s": VALIDADE_SEGUNDOS},
    )
    db.commit()
    return ticket


def resgatar(db: Session, ticket: str) -> Optional[str]:
    """Devolve o token e queima o ticket; None se não existe, venceu ou já foi usado.

    O DELETE ... RETURNING é atômico: duas trocas simultâneas do mesmo ticket, a
    segunda espera o lock da linha, acha a linha apagada e volta vazia.
    """
    if not ticket or "\x00" in ticket:
        return None
    db.execute(text("DELETE FROM auth.sso_tickets WHERE expira_em <= now()"))
    token = db.execute(
        text(
            "DELETE FROM auth.sso_tickets WHERE ticket = :t AND expira_em > now()"
            " RETURNING access_token"
        ),
        {"t": ticket},
    ).scalar_one_or_none()
    db.commit()
    return token
