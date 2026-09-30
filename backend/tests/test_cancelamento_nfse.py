"""Cancelamento de NFS-e vindo do ADN (defeito D11).

No leiaute nacional o cancelamento não vem dentro da nota: chega na mesma distribuição
por NSU como um documento à parte, `TipoDocumento = "EVENTO"`. Até 2026-09-30 a
importação descartava esses documentos, e medido no dia eram 52 NFS-e canceladas na
prefeitura (jun-set/2026) contando como faturamento.

Os XML abaixo reproduzem a estrutura dos eventos reais do ADN (tags, namespace, versão),
com chaves e textos inventados — o repo é público.
"""
import base64
import gzip
from datetime import date

import pytest
from sqlalchemy import text

NS = "http://www.sped.fazenda.gov.br/nfse"
# Chave de acesso tem 50 dígitos: município, ambiente, tipo de inscrição, CNPJ do
# emitente, número da nota... O que importa aqui é só ser única e ter o tamanho certo.
CHAVE_A = "26116062212345678000199000000000123626090000000000"
CHAVE_B = "26116062212345678000199000000000123726090000000000"
CHAVE_SUBST = "26116062212345678000199000000000124526090000000000"
CHAVE_FORA = "26116062298765432000155000000000000926090000000000"


def _evento(chave, codigo, corpo, dh="2026-09-30T10:15:00-03:00"):
    return (
        f'<?xml version="1.0" encoding="utf-8"?><evento versao="1.01" xmlns="{NS}">'
        f'<infEvento Id="EVT{chave}{codigo}001"><nSeqEvento>1</nSeqEvento>'
        f'<dhProc>{dh}</dhProc><pedRegEvento versao="1.01" xmlns="{NS}">'
        f'<infPedReg Id="PRE{chave}{codigo}"><tpAmb>1</tpAmb><dhEvento>{dh}</dhEvento>'
        f"<CNPJAutor>12345678000199</CNPJAutor><chNFSe>{chave}</chNFSe>"
        f"<e{codigo}>{corpo}</e{codigo}></infPedReg></pedRegEvento></infEvento></evento>"
    )


def _doc(chave, tipo_evento, xml, tipo_documento="EVENTO", nsu=1):
    return {
        "NSU": nsu,
        "ChaveAcesso": chave,
        "TipoDocumento": tipo_documento,
        "TipoEvento": tipo_evento,
        "ArquivoXml": base64.b64encode(gzip.compress(xml.encode())).decode(),
    }


def cancelamento(chave, dh="2026-09-30T10:15:00-03:00"):
    corpo = ("<xDesc>Cancelamento de NFS-e</xDesc><cMotivo>1</cMotivo>"
             "<xMotivo>valor incorreto</xMotivo>")
    return _doc(chave, "CANCELAMENTO", _evento(chave, "101101", corpo, dh))


def cancelamento_por_substituicao(chave, substituta):
    corpo = ("<xDesc>Cancelamento de NFS-e por Substituição</xDesc><cMotivo>99</cMotivo>"
             f"<xMotivo>faltou o tomador</xMotivo><chSubstituta>{substituta}</chSubstituta>")
    return _doc(chave, "CANCELAMENTO_POR_SUBSTITUICAO",
                _evento(chave, "105102", corpo, "2026-09-12T08:28:11-03:00"))


def confirmacao_tomador(chave):
    corpo = "<xDesc>Manifestação de NFS-e - Confirmação do Tomador</xDesc>"
    return _doc(chave, "CONFIRMACAO_TOMADOR", _evento(chave, "203202", corpo))


@pytest.fixture
def servico():
    from app.services.nfse_recife_nacional import NFSeRecifeNacionalService

    return NFSeRecifeNacionalService("c.pem", "k.pem", "12345678000199")


# ------------------------------------------------------------------ leitura do ADN

def test_cancelamento_simples_vira_chave_e_data(servico):
    achados = servico.extrair_cancelamentos([cancelamento(CHAVE_A)])

    assert achados == [{"chave": CHAVE_A, "data_cancelamento": date(2026, 9, 30),
                        "chave_substituta": None}]


def test_cancelamento_por_substituicao_traz_a_substituta(servico):
    achados = servico.extrair_cancelamentos(
        [cancelamento_por_substituicao(CHAVE_A, CHAVE_SUBST)])

    assert achados == [{"chave": CHAVE_A, "data_cancelamento": date(2026, 9, 12),
                        "chave_substituta": CHAVE_SUBST}]


def test_manifestacao_do_tomador_nao_e_cancelamento(servico):
    # Rejeição/confirmação do tomador também são EVENTO, mas não desfazem a nota.
    assert servico.extrair_cancelamentos([confirmacao_tomador(CHAVE_A)]) == []


def test_documento_de_nota_nao_e_cancelamento(servico):
    nota = _doc(CHAVE_A, None, "<NFSe/>", tipo_documento="NFSE")
    assert servico.extrair_cancelamentos([nota]) == []


def test_consulta_devolve_notas_e_cancelamentos_da_mesma_paginacao(servico, monkeypatch):
    chamadas = []

    def paginar(desde_nsu):
        chamadas.append(desde_nsu)
        return [cancelamento(CHAVE_A)]

    monkeypatch.setattr(servico, "_paginar", paginar)
    notas, cancelamentos = servico.consultar_nfse_e_cancelamentos(
        date(2026, 9, 1), date(2026, 9, 30))

    assert notas == []
    assert [c["chave"] for c in cancelamentos] == [CHAVE_A]
    assert chamadas == [1]          # uma varredura só, não duas


# ------------------------------------------------------------------ gravação

@pytest.fixture(scope="module", autouse=True)
def tabela_servicos(engine):
    from app.models.nota_servico import NotaServico

    NotaServico.__table__.create(engine, checkfirst=True)


@pytest.fixture
def db(engine):
    from sqlalchemy.orm import sessionmaker

    with engine.begin() as conn:
        conn.execute(text("TRUNCATE tiny.servicos RESTART IDENTITY"))
    sessao = sessionmaker(bind=engine)()
    yield sessao
    sessao.close()


def _nota(db, chave, cancelada=False, data_cancelamento=None):
    from app.models.nota_servico import NotaServico

    nota = NotaServico(codigo_verificacao=chave, numero_nfse=int(chave[-6:]),
                       valor_servico="625.40", cancelada=cancelada,
                       data_cancelamento=data_cancelamento)
    db.add(nota)
    db.commit()
    return nota.id


def _estado(db, id_):
    return db.execute(text(
        "select cancelada, data_de_cancelamento from tiny.servicos where id = :id"
    ), {"id": id_}).one()


def test_marca_nota_cancelada_com_a_data(db):
    from app.services.nfse_importacao import aplicar_cancelamentos

    id_ = _nota(db, CHAVE_A)
    resultado = aplicar_cancelamentos(db, [
        {"chave": CHAVE_A, "data_cancelamento": date(2026, 9, 30), "chave_substituta": None}])
    db.commit()

    assert tuple(_estado(db, id_)) == (True, "2026-09-30")
    assert resultado.marcadas == 1


def test_evento_de_nota_fora_do_banco_e_so_contado(db):
    # A distribuição traz também notas em que somos TOMADOR; essas não estão em
    # tiny.servicos e não podem virar linha nova.
    from app.services.nfse_importacao import aplicar_cancelamentos

    resultado = aplicar_cancelamentos(db, [
        {"chave": CHAVE_FORA, "data_cancelamento": date(2026, 9, 30), "chave_substituta": None}])
    db.commit()

    assert resultado.sem_nota == 1
    assert db.execute(text("select count(*) from tiny.servicos")).scalar() == 0


def test_nota_ja_cancelada_nao_e_regravada(db):
    from app.services.nfse_importacao import aplicar_cancelamentos

    id_ = _nota(db, CHAVE_A, cancelada=True, data_cancelamento="17/01/2026")
    resultado = aplicar_cancelamentos(db, [
        {"chave": CHAVE_A, "data_cancelamento": date(2026, 9, 30), "chave_substituta": None}])
    db.commit()

    assert tuple(_estado(db, id_)) == (True, "17/01/2026")
    assert (resultado.marcadas, resultado.ja_marcadas) == (0, 1)


def test_dry_run_so_conta(db):
    from app.services.nfse_importacao import aplicar_cancelamentos

    id_ = _nota(db, CHAVE_A)
    resultado = aplicar_cancelamentos(db, [
        {"chave": CHAVE_A, "data_cancelamento": date(2026, 9, 30), "chave_substituta": None}],
        dry_run=True)
    db.commit()

    assert tuple(_estado(db, id_)) == (False, None)
    assert resultado.marcadas == 1


def test_reimportar_a_nota_nao_desfaz_o_cancelamento(db):
    from app.services.nfse_importacao import aplicar_cancelamentos, gravar_notas

    id_ = _nota(db, CHAVE_A)
    aplicar_cancelamentos(db, [
        {"chave": CHAVE_A, "data_cancelamento": date(2026, 9, 30), "chave_substituta": None}])
    gravar_notas(db, [{"codigo_verificacao": CHAVE_A, "numero_nfse": 1236,
                       "valor_servico": "625.40"}])
    db.commit()

    assert _estado(db, id_).cancelada is True


# ------------------------------------------------------------------ job diário

def test_job_grava_notas_e_depois_cancela(db, monkeypatch):
    # A nota e o cancelamento dela podem chegar na mesma passagem: a nota precisa
    # existir antes de o evento procurá-la.
    from app.jobs import importar_nfse

    nota = {"codigo_verificacao": CHAVE_B, "numero_nfse": 1237, "valor_servico": "2226.00",
            "data_emissao": date(2026, 9, 30)}

    class ServicoFalso:
        def __init__(self, **_):
            pass

        def consultar_nfse_e_cancelamentos(self, inicio, fim):
            return [nota], [{"chave": CHAVE_B, "data_cancelamento": date(2026, 9, 30),
                             "chave_substituta": None}]

    monkeypatch.setattr(importar_nfse, "NFSeRecifeNacionalService", ServicoFalso)
    monkeypatch.setattr(type(importar_nfse.settings), "get_cert_paths", lambda self: ("c", "k"))
    args = importar_nfse.montar_argumentos([])

    codigo = importar_nfse._importar(args, date(2026, 9, 1), date(2026, 9, 30), registro=None)

    assert codigo == 0
    linha = db.execute(text(
        "select cancelada, data_de_cancelamento from tiny.servicos"
        " where \"código_de_verificação_nf\" = :c"), {"c": CHAVE_B}).one()
    assert tuple(linha) == (True, "2026-09-30")


# ------------------------------------------------------------------ endpoint manual

def test_endpoint_importar_tambem_cancela(db, client, monkeypatch):
    # Mesmo sem nota nova no período, o cancelamento de uma nota antiga tem que entrar:
    # o endpoint devolvia cedo com "Nenhuma NFSe encontrada".
    import importlib

    # `app.api.endpoints.nota_servico` como atributo é o router reexportado, não o módulo.
    nota_servico = importlib.import_module("app.api.endpoints.nota_servico")
    id_ = _nota(db, CHAVE_A)

    class ServicoFalso:
        def __init__(self, **_):
            pass

        def consultar_nfse_e_cancelamentos(self, inicio, fim):
            return [], [{"chave": CHAVE_A, "data_cancelamento": date(2026, 9, 30),
                         "chave_substituta": None}]

    monkeypatch.setattr(nota_servico, "NFSeRecifeNacionalService", ServicoFalso)
    monkeypatch.setattr(type(nota_servico.settings), "get_cert_paths", lambda self: ("c", "k"))

    r = client.post("/notas_servico/importar")

    assert r.status_code == 200, r.text
    assert r.json()["total_canceladas"] == 1
    db.expire_all()
    assert tuple(_estado(db, id_)) == (True, "2026-09-30")


# ------------------------------------------------------------------ paginação do ADN

def _adn_falso(servico, monkeypatch, total_docs):
    """ADN com `total_docs` documentos, NSU 1..total, lotes de 50 como o real."""
    monkeypatch.setattr("app.services.nfse_recife_nacional.time.sleep", lambda _: None)

    def buscar_lote(session, nsu):
        return {"LoteDFe": [{"NSU": n} for n in range(nsu, min(nsu + 50, total_docs + 1))]}

    monkeypatch.setattr(servico, "_buscar_lote", buscar_lote)


def test_paginacao_passa_de_80_paginas(servico, monkeypatch):
    # Até 2026-09-30 a varredura parava em 80 páginas (4.000 documentos) e devolvia a
    # lista cortada como se fosse completa: nota e cancelamento novos sumiriam calados.
    _adn_falso(servico, monkeypatch, total_docs=4321)

    docs = servico._paginar(1)

    assert [d["NSU"] for d in docs] == list(range(1, 4322))


def test_paginacao_que_nao_termina_falha_em_vez_de_cortar(servico, monkeypatch):
    _adn_falso(servico, monkeypatch, total_docs=10**9)

    with pytest.raises(Exception, match="não terminou"):
        servico._paginar(1, max_paginas=5)
