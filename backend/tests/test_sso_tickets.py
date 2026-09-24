import threading

import pytest
from sqlalchemy import text

from app.core import sso_tickets
from app.models.database import SessionLocal


def _sessao():
    return SessionLocal()


@pytest.fixture
def uid(criar_usuario):
    return criar_usuario("maria", email="maria@healthsafetytech.com")


def _inserir_cru(engine, hash_, usuario_id, validade):
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO auth.sso_tickets (ticket_hash, usuario_id, expira_em)"
                f" VALUES (:h, :u, now() + interval '{validade}')"
            ),
            {"h": hash_, "u": usuario_id},
        )


def _contar(engine):
    with engine.connect() as conn:
        return conn.execute(text("SELECT count(*) FROM auth.sso_tickets")).scalar_one()


def test_emitir_e_resgatar_devolve_o_usuario(uid):
    db = _sessao()
    try:
        ticket = sso_tickets.emitir(db, uid)
        assert len(ticket) >= 40
        assert sso_tickets.resgatar(db, ticket) == uid
    finally:
        db.close()


def test_ticket_em_claro_nao_vai_ao_banco(uid, engine):
    db = _sessao()
    try:
        ticket = sso_tickets.emitir(db, uid)
    finally:
        db.close()
    with engine.connect() as conn:
        linhas = conn.execute(text("SELECT * FROM auth.sso_tickets")).all()
    assert len(linhas) == 1
    assert all(ticket not in str(valor) for valor in linhas[0])


def test_excluir_o_usuario_apaga_o_ticket(uid, engine):
    db = _sessao()
    try:
        ticket = sso_tickets.emitir(db, uid)
    finally:
        db.close()
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM auth.usuarios WHERE id = :u"), {"u": uid})
    assert _contar(engine) == 0
    db = _sessao()
    try:
        assert sso_tickets.resgatar(db, ticket) is None
    finally:
        db.close()


def test_ticket_e_de_uso_unico(uid):
    db = _sessao()
    try:
        ticket = sso_tickets.emitir(db, uid)
        assert sso_tickets.resgatar(db, ticket) == uid
        assert sso_tickets.resgatar(db, ticket) is None
    finally:
        db.close()


def test_tickets_sao_diferentes_a_cada_emissao(uid):
    db = _sessao()
    try:
        assert sso_tickets.emitir(db, uid) != sso_tickets.emitir(db, uid)
    finally:
        db.close()


def test_ticket_vencido_nao_vale_e_e_apagado(uid, engine):
    _inserir_cru(engine, sso_tickets._hash("velho"), uid, "-1 second")
    db = _sessao()
    try:
        assert sso_tickets.resgatar(db, "velho") is None
    finally:
        db.close()
    assert _contar(engine) == 0


def test_resgate_limpa_os_vencidos_de_outros(uid, engine):
    _inserir_cru(engine, sso_tickets._hash("esquecido"), uid, "-1 minute")
    db = _sessao()
    try:
        sso_tickets.resgatar(db, "qualquer")
    finally:
        db.close()
    assert _contar(engine) == 0


def test_ticket_inexistente_vazio_ou_com_nul_devolve_none():
    db = _sessao()
    try:
        assert sso_tickets.resgatar(db, "nao-existe") is None
        assert sso_tickets.resgatar(db, "") is None
        # NUL não pode virar 500; tem que ser só "inválido".
        assert sso_tickets.resgatar(db, "ab\x00cd") is None
    finally:
        db.close()


def test_duas_trocas_simultaneas_so_uma_leva(uid):
    db = _sessao()
    try:
        ticket = sso_tickets.emitir(db, uid)
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
    assert resultados.count(uid) == 1
    assert resultados.count(None) == 1
