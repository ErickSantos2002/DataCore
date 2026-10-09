from datetime import date, datetime, timedelta, timezone

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from tests.semente_contas import contas, tabela_contas  # noqa: F401
from tests.test_inadimplencia_migracao import rodar_migracao

HOJE = date.today()
AGORA = datetime.now(timezone.utc)


@pytest.fixture(scope="module", autouse=True)
def tabelas(engine):
    with engine.begin() as conn:
        conn.execute(text(
            "CREATE TABLE IF NOT EXISTS tiny.configuracoes ("
            " id serial PRIMARY KEY, chave varchar NOT NULL UNIQUE, valor varchar NOT NULL)"))
    rodar_migracao(engine, "013_cobranca.sql")


@pytest.fixture
def db(engine):
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE tiny.cobranca_eventos, tiny.cobranca_ciclos, tiny.cobranca_empresas RESTART IDENTITY CASCADE"))
    with Session(engine) as sessao:
        yield sessao


def _ciclos(db):
    return db.execute(text("SELECT empresa, status, encerrado_em IS NOT NULL AS fechado FROM tiny.cobranca_ciclos ORDER BY id")).all()


def _eventos(db):
    return db.execute(text("SELECT tipo, status_anterior, status_novo, registrado_por FROM tiny.cobranca_eventos ORDER BY id")).all()


def test_abre_ciclo_so_para_inadimplente(db, contas):
    from app.services.cobranca import sincronizar

    contas(doc="11111111000111", venceu_ha=40)
    contas(doc="22222222000122", venceu_ha=10)
    assert sincronizar(db, HOJE) == {"abertos": 1, "pagos": 0, "quebradas": 0}
    assert _ciclos(db) == [("11111111", "sem_contato", False)]
    assert _eventos(db) == [("sistema", None, "sem_contato", "sistema")]


def test_e_idempotente(db, contas):
    from app.services.cobranca import sincronizar

    contas(venceu_ha=40)
    sincronizar(db, HOJE)
    assert sincronizar(db, HOJE) == {"abertos": 0, "pagos": 0, "quebradas": 0}
    assert len(_ciclos(db)) == 1 and len(_eventos(db)) == 1


def test_fecha_como_pago_quando_nao_ha_mais_vencido(db, contas, engine):
    from app.services.cobranca import sincronizar

    contas(venceu_ha=40)
    sincronizar(db, HOJE)
    with engine.begin() as conn:
        conn.execute(text("UPDATE tiny.contas_receber SET situacao = 'pago', saldo = 0, liquidacao = CURRENT_DATE"))
    assert sincronizar(db, HOJE)["pagos"] == 1
    assert _ciclos(db) == [("11111111", "pago", True)]


def test_nao_fecha_enquanto_houver_titulo_em_atraso(db, contas, engine):
    from app.services.cobranca import sincronizar

    contas(venceu_ha=40)
    contas(venceu_ha=5)
    sincronizar(db, HOJE)
    with engine.begin() as conn:
        conn.execute(text("UPDATE tiny.contas_receber SET situacao = 'pago', saldo = 0 WHERE vencimento < CURRENT_DATE - 30"))
    assert sincronizar(db, HOJE)["pagos"] == 0


def test_quebra_promessa_vencida_uma_vez_so(db, contas):
    from app.services.cobranca import NovoEvento, Promessa, registrar_evento, sincronizar

    contas(venceu_ha=40)
    sincronizar(db, HOJE)
    registrar_evento(db, HOJE, "11111111", NovoEvento(
        ocorrido_em=AGORA, canal="telefone", status_novo="promessa",
        promessa=Promessa(data=HOJE)), "erick")
    amanha = HOJE + timedelta(days=1)
    assert sincronizar(db, amanha)["quebradas"] == 1
    assert sincronizar(db, amanha)["quebradas"] == 0
    assert _ciclos(db)[0][1] == "quebrada"


def test_reabre_ciclo_novo_depois_de_pago(db, contas, engine):
    from app.services.cobranca import sincronizar

    contas(venceu_ha=40)
    sincronizar(db, HOJE)
    with engine.begin() as conn:
        conn.execute(text("UPDATE tiny.contas_receber SET situacao = 'pago', saldo = 0"))
    sincronizar(db, HOJE)
    contas(venceu_ha=35)
    assert sincronizar(db, HOJE)["abertos"] == 1
    assert [c[2] for c in _ciclos(db)] == [True, False]


def test_registrar_contato_abre_ciclo_para_empresa_so_em_atraso(db, contas):
    from app.services.cobranca import NovoEvento, registrar_evento

    contas(venceu_ha=10)
    registrar_evento(db, HOJE, "11111111", NovoEvento(ocorrido_em=AGORA, canal="email"), "erick")
    assert _ciclos(db) == [("11111111", "em_contato", False)]


def test_contato_tira_de_sem_contato_e_atualiza_ultimo_contato(db, contas):
    from app.services.cobranca import NovoEvento, registrar_evento, sincronizar

    contas(venceu_ha=40)
    sincronizar(db, HOJE)
    registrar_evento(db, HOJE, "11111111", NovoEvento(ocorrido_em=AGORA, canal="whatsapp",
                                                      anotacao="Falei com o financeiro"), "erick")
    status, ultimo = db.execute(text("SELECT status, ultimo_contato_em FROM tiny.cobranca_ciclos")).one()
    assert status == "em_contato" and ultimo is not None


@pytest.mark.parametrize("dados, mensagem", [
    ({"status_novo": "pago"}, "sistema"),
    ({"status_novo": "inventado"}, "desconhecido"),
    ({"status_novo": "promessa"}, "data"),
    ({"status_novo": "promessa", "promessa": {"data": "2000-01-01"}}, "passou"),
    ({"canal": "telefone", "promessa": {"data": "2999-01-01"}}, "Promessa de pagamento"),
    ({"canal": "pombo"}, "canal"),
    ({}, "canal ou um status"),
    ({"canal": "telefone", "filial_cnpj": "22222222000122"}, "filial"),
    ({"canal": "telefone", "ocorrido_em": "2999-01-01T00:00:00Z"}, "futuro"),
    ({"canal": "telefone", "anotacao": "x" * 4001}, "4.000"),
])
def test_validacao(db, contas, dados, mensagem):
    from pydantic import ValidationError
    from app.services.cobranca import ErroDeCobranca, NovoEvento, registrar_evento

    contas(venceu_ha=40)
    try:
        evento = NovoEvento(**{"ocorrido_em": AGORA, **dados})
    except ValidationError as erro:
        assert mensagem in str(erro)
        return
    with pytest.raises(ErroDeCobranca) as erro:
        registrar_evento(db, HOJE, "11111111", evento, "erick")
    assert erro.value.status_code == 422
    assert mensagem in str(erro.value)


def test_empresa_inexistente_e_404(db, contas):
    from app.services.cobranca import ErroDeCobranca, NovoEvento, registrar_evento

    with pytest.raises(ErroDeCobranca) as erro:
        registrar_evento(db, HOJE, "99999999", NovoEvento(ocorrido_em=AGORA, canal="telefone"), "erick")
    assert erro.value.status_code == 404


def test_observacao_grava_apaga_e_registra_evento(db, contas):
    from app.services.cobranca import gravar_observacao, sincronizar

    contas(venceu_ha=40)
    sincronizar(db, HOJE)
    gravar_observacao(db, "11111111", "Só boleto por e-mail", "erick")
    gravar_observacao(db, "11111111", "Pagam dia 10", "erick")
    assert db.execute(text("SELECT observacao FROM tiny.cobranca_empresas")).scalar() == "Pagam dia 10"
    anot = db.execute(text("SELECT anotacao FROM tiny.cobranca_eventos WHERE tipo = 'observacao' ORDER BY id")).scalars().all()
    assert anot[-1] == "Antes: Só boleto por e-mail"
    gravar_observacao(db, "11111111", "  ", "erick")
    assert db.execute(text("SELECT count(*) FROM tiny.cobranca_empresas")).scalar() == 0


def test_observacao_vazia_sem_observacao_previa_nao_gera_evento(db, contas):
    from app.services.cobranca import gravar_observacao, sincronizar

    contas(venceu_ha=40)
    sincronizar(db, HOJE)
    gravar_observacao(db, "11111111", "   ", "erick")
    assert db.execute(text("SELECT count(*) FROM tiny.cobranca_eventos WHERE tipo = 'observacao'")).scalar() == 0


# ───────────────────────────────────────────── o gancho no job extrair_contas

def _rodar_carregar(monkeypatch, tipo, dry_run, sincronizar):
    import types

    from app.jobs import extrair_contas

    monkeypatch.setattr(extrair_contas, "TinyAPI", lambda *a, **k: object())
    monkeypatch.setattr(extrair_contas, "processar", lambda api, db, t, args: ({}, 0))
    from app.services import cobranca as servico_cobranca

    # o gancho importa dentro do try; o teste troca a função no módulo de origem
    monkeypatch.setattr(servico_cobranca, "sincronizar", sincronizar)

    class SessaoFalsa:
        commits = rollbacks = 0

        def commit(self):
            SessaoFalsa.commits += 1

        def rollback(self):
            SessaoFalsa.rollbacks += 1

        def close(self):
            pass

    monkeypatch.setattr(extrair_contas, "SessionLocal", SessaoFalsa)
    registro = types.SimpleNamespace(detalhe=None, contagens=None, erros=None)
    args = types.SimpleNamespace(tipo=tipo, dry_run=dry_run, espera=0)
    codigo = extrair_contas._carregar(args, registro)
    return codigo, registro, SessaoFalsa


def test_job_sincroniza_e_soma_nas_contagens(monkeypatch):
    codigo, registro, sessao = _rodar_carregar(
        monkeypatch, "receber", False,
        lambda db, hoje: {"abertos": 2, "pagos": 1, "quebradas": 0})
    assert codigo == 0 and sessao.commits == 1
    assert registro.contagens["cobrança: abertos"] == 2


def test_job_nao_falha_quando_a_sincronizacao_quebra(monkeypatch):
    def quebra(db, hoje):
        raise RuntimeError("banco fora")

    codigo, registro, sessao = _rodar_carregar(monkeypatch, "ambos", False, quebra)
    assert codigo == 0 and sessao.rollbacks == 1
    assert "Sincronização da cobrança falhou" in registro.detalhe
    assert "banco fora" in registro.detalhe
    assert registro.contagens["cobrança: falhou"] == 1


def test_job_nao_falha_quando_o_import_da_cobranca_quebra(monkeypatch):
    import builtins

    original = builtins.__import__

    def import_quebrado(nome, *a, **k):
        if nome == "app.core.inadimplencia":
            raise ImportError("módulo fora")
        return original(nome, *a, **k)

    def nao_chega(db, hoje):
        raise AssertionError("não deveria chegar")

    import types
    from app.jobs import extrair_contas

    monkeypatch.setattr(builtins, "__import__", import_quebrado)
    codigo, registro, sessao = _rodar_carregar(monkeypatch, "receber", False, nao_chega)
    assert codigo == 0
    assert "módulo fora" in registro.detalhe
    assert registro.contagens["cobrança: falhou"] == 1


@pytest.mark.parametrize("tipo, dry_run", [("receber", True), ("pagar", False)])
def test_job_pula_a_sincronizacao(monkeypatch, tipo, dry_run):
    def nao_deve_chamar(db, hoje):
        raise AssertionError("não devia sincronizar")

    codigo, registro, sessao = _rodar_carregar(monkeypatch, tipo, dry_run, nao_deve_chamar)
    assert codigo == 0 and registro.detalhe is None and sessao.commits == 0


# ───────────────────────────────────────────── fuso e corridas

def test_data_sem_fuso_vale_horario_de_brasilia(db, contas):
    from zoneinfo import ZoneInfo

    from app.services.cobranca import NovoEvento, registrar_evento

    contas(venceu_ha=40)
    naive = datetime.now(ZoneInfo("America/Sao_Paulo")).replace(tzinfo=None) - timedelta(hours=2)
    evento = NovoEvento(ocorrido_em=naive, canal="telefone")
    assert evento.ocorrido_em.tzinfo is not None
    registrar_evento(db, HOJE, "11111111", evento, "erick")
    gravado = db.execute(text("SELECT ocorrido_em FROM tiny.cobranca_eventos WHERE tipo = 'contato'")).scalar()
    assert gravado == naive.replace(tzinfo=ZoneInfo("America/Sao_Paulo"))


def test_data_sem_fuso_no_futuro_e_422(db, contas):
    from app.services.cobranca import ErroDeCobranca, NovoEvento, registrar_evento

    contas(venceu_ha=40)
    evento = NovoEvento(ocorrido_em=datetime(2999, 1, 1, 10, 0, 0), canal="telefone")
    with pytest.raises(ErroDeCobranca) as erro:
        registrar_evento(db, HOJE, "11111111", evento, "erick")
    assert erro.value.status_code == 422 and "futuro" in str(erro.value)


class _Resultado:
    def __init__(self, linhas):
        self._linhas = linhas

    def mappings(self):
        return self

    def all(self):
        return self._linhas


def _com_candidatos_velhos(db, monkeypatch, trecho, linhas):
    """Faz o SELECT de candidatos que contém `trecho` devolver `linhas` (já defasadas)."""
    original = db.execute

    def falso(stmt, *a, **k):
        if trecho in str(stmt) and str(stmt).lstrip().upper().startswith(("WITH", "SELECT")):
            return _Resultado(linhas)
        return original(stmt, *a, **k)

    monkeypatch.setattr(db, "execute", falso)


def test_corrida_fechar_ciclo_ja_fechado_nao_conta_nem_grava(db, contas, engine, monkeypatch):
    from app.services.cobranca import sincronizar

    contas(venceu_ha=40)
    sincronizar(db, HOJE)
    with engine.begin() as conn:
        conn.execute(text("UPDATE tiny.contas_receber SET situacao = 'pago', saldo = 0"))
    sincronizar(db, HOJE)
    eventos = len(_eventos(db))
    ciclo_id = db.execute(text("SELECT id FROM tiny.cobranca_ciclos")).scalar()
    _com_candidatos_velhos(db, monkeypatch, "NOT EXISTS (SELECT 1 FROM empresas e",
                           [{"id": ciclo_id, "status": "sem_contato"}])
    assert sincronizar(db, HOJE)["pagos"] == 0
    assert len(_eventos(db)) == eventos


def test_corrida_quebrar_nao_pisa_em_quem_saiu_de_promessa(db, contas, monkeypatch):
    from app.services.cobranca import NovoEvento, Promessa, registrar_evento, sincronizar

    contas(venceu_ha=40)
    sincronizar(db, HOJE)
    registrar_evento(db, HOJE, "11111111", NovoEvento(
        ocorrido_em=AGORA, canal="telefone", status_novo="promessa",
        promessa=Promessa(data=HOJE)), "erick")
    registrar_evento(db, HOJE, "11111111", NovoEvento(ocorrido_em=AGORA, status_novo="negociacao"), "erick")
    ciclo = db.execute(text("SELECT id, empresa FROM tiny.cobranca_ciclos")).one()
    eventos = len(_eventos(db))
    _com_candidatos_velhos(db, monkeypatch, "status = 'promessa' AND promessa_data <",
                           [{"id": ciclo[0], "empresa": ciclo[1], "promessa_data": HOJE, "promessa_valor": None}])
    assert sincronizar(db, HOJE + timedelta(days=1))["quebradas"] == 0
    assert _ciclos(db)[0][1] == "negociacao" and len(_eventos(db)) == eventos


def test_corrida_abrir_ciclo_ja_aberto_nao_estoura_nem_duplica(db, contas, monkeypatch):
    from app.services.cobranca import sincronizar

    contas(venceu_ha=40)
    sincronizar(db, HOJE)
    eventos = len(_eventos(db))
    _com_candidatos_velhos(db, monkeypatch, "e.valor_inadimplente > 0",
                           [{"empresa": "11111111", "valor_inadimplente": 1000, "maior_atraso": 40}])
    assert sincronizar(db, HOJE)["abertos"] == 0
    assert len(_ciclos(db)) == 1 and len(_eventos(db)) == eventos


def test_registrar_evento_perde_a_corrida_de_abrir_ciclo(db, contas, monkeypatch):
    from app.services import cobranca
    from app.services.cobranca import NovoEvento, registrar_evento

    contas(venceu_ha=40)
    cobranca.sincronizar(db, HOJE)  # outro processo já abriu o ciclo
    original = cobranca._ciclo_aberto
    chamadas = []

    def primeira_vez_vazio(d, empresa):
        chamadas.append(1)
        return None if len(chamadas) == 1 else original(d, empresa)

    monkeypatch.setattr(cobranca, "_ciclo_aberto", primeira_vez_vazio)
    registrar_evento(db, HOJE, "11111111", NovoEvento(ocorrido_em=AGORA, canal="email"), "erick")
    assert _ciclos(db) == [("11111111", "em_contato", False)]
