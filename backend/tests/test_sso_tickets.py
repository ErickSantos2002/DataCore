import threading

from sqlalchemy import text

from app.core import sso_tickets
from app.models.database import SessionLocal


def _sessao():
    return SessionLocal()


def test_emitir_e_resgatar_devolve_o_token():
    db = _sessao()
    try:
        ticket = sso_tickets.emitir(db, "jwt-da-maria")
        assert len(ticket) >= 40
        assert sso_tickets.resgatar(db, ticket) == "jwt-da-maria"
    finally:
        db.close()


def test_ticket_e_de_uso_unico():
    db = _sessao()
    try:
        ticket = sso_tickets.emitir(db, "jwt")
        assert sso_tickets.resgatar(db, ticket) == "jwt"
        assert sso_tickets.resgatar(db, ticket) is None
    finally:
        db.close()


def test_tickets_sao_diferentes_a_cada_emissao():
    db = _sessao()
    try:
        assert sso_tickets.emitir(db, "a") != sso_tickets.emitir(db, "a")
    finally:
        db.close()


def test_ticket_vencido_nao_vale_e_e_apagado(engine):
    with engine.begin() as conn:
        conn.execute(text(
            "INSERT INTO auth.sso_tickets (ticket, access_token, expira_em)"
            " VALUES ('velho', 'jwt', now() - interval '1 second')"
        ))
    db = _sessao()
    try:
        assert sso_tickets.resgatar(db, "velho") is None
    finally:
        db.close()
    with engine.connect() as conn:
        assert conn.execute(text("SELECT count(*) FROM auth.sso_tickets")).scalar_one() == 0


def test_resgate_limpa_os_vencidos_de_outros(engine):
    with engine.begin() as conn:
        conn.execute(text(
            "INSERT INTO auth.sso_tickets (ticket, access_token, expira_em)"
            " VALUES ('esquecido', 'jwt', now() - interval '1 minute')"
        ))
    db = _sessao()
    try:
        sso_tickets.resgatar(db, "qualquer")
    finally:
        db.close()
    with engine.connect() as conn:
        assert conn.execute(text("SELECT count(*) FROM auth.sso_tickets")).scalar_one() == 0


def test_ticket_inexistente_vazio_ou_com_nul_devolve_none():
    db = _sessao()
    try:
        assert sso_tickets.resgatar(db, "nao-existe") is None
        assert sso_tickets.resgatar(db, "") is None
        # NUL quebra o bind do psycopg2 (ValueError -> 500); tem que ser só "inválido".
        assert sso_tickets.resgatar(db, "ab\x00cd") is None
    finally:
        db.close()


def test_duas_trocas_simultaneas_so_uma_leva():
    db = _sessao()
    try:
        ticket = sso_tickets.emitir(db, "jwt-unico")
    finally:
        db.close()

    largada = threading.Barrier(2)
    resultados = []

    def trocar():
        sessao = _sessao()
        try:
            largada.wait()
            resultados.append(sso_tickets.resgatar(sessao, ticket))
        finally:
            sessao.close()

    fios = [threading.Thread(target=trocar) for _ in range(2)]
    for f in fios:
        f.start()
    for f in fios:
        f.join()
    assert len(resultados) == 2
    assert resultados.count("jwt-unico") == 1
    assert resultados.count(None) == 1
