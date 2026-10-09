import hashlib
from datetime import date, datetime, timedelta, timezone

import pytest
from sqlalchemy.orm import Session

from sqlalchemy import text

from tests.semente_contas import contas, tabela_contas  # noqa: F401
from tests.test_inadimplencia_migracao import rodar_migracao

HOJE = date.today()


@pytest.fixture(scope="module", autouse=True)
def tabelas_de_cobranca(engine):
    # As consultas fazem LEFT JOIN nas tabelas da cobrança: o módulo não pode depender
    # da ordem em que o pytest roda os arquivos.
    with engine.begin() as conn:
        conn.execute(text(
            "CREATE TABLE IF NOT EXISTS tiny.configuracoes ("
            " id serial PRIMARY KEY, chave varchar NOT NULL UNIQUE, valor varchar NOT NULL)"))
    rodar_migracao(engine, "013_cobranca.sql")
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE tiny.cobranca_eventos, tiny.cobranca_ciclos, tiny.cobranca_empresas RESTART IDENTITY CASCADE"))


@pytest.fixture
def db(engine):
    with Session(engine) as sessao:
        yield sessao


def _pagina(db, **kw):
    from app.core.inadimplencia import pagina_de_empresas

    padrao = dict(busca=None, status=None, faixa=None, incluir_atraso=False,
                  ordenar_por="valor", direcao="desc", limite=15, offset=0)
    padrao.update(kw)
    return pagina_de_empresas(db, HOJE, **padrao)


def test_filiais_e_grafias_do_mesmo_cnpj_viram_uma_empresa(db, contas):
    contas(nome="Alfa Ltda - Cidade A", doc="11.111.111/0001-11", venceu_ha=40, valor=100)
    contas(nome="ALFA LTDA", doc="11111111000111", venceu_ha=50, valor=200)
    contas(nome="Alfa Ltda - Cidade B", doc="11.111.111/0002-02", venceu_ha=60, valor=300)
    p = _pagina(db)
    assert p.total == 1
    e = p.itens[0]
    assert e.empresa == "11111111"
    assert e.filiais == 2
    assert e.titulos == 3
    assert e.valor_devido == 600
    assert e.maior_atraso == 60
    assert e.documento == "11.111.111 · 2 filiais"


def test_uma_filial_so_mostra_o_cnpj_completo(db, contas):
    contas(doc="11111111000111", venceu_ha=40)
    assert _pagina(db).itens[0].documento == "11.111.111/0001-11"


def test_cpf_e_documento_vazio(db, contas):
    contas(nome="Pessoa Física", doc="00000000191", venceu_ha=40)
    contas(nome=" Sem Documento ", doc="", venceu_ha=40)
    chaves = {e.empresa for e in _pagina(db).itens}
    assert chaves == {"00000000191", "nome:" + hashlib.md5(b"sem documento").hexdigest()}


def test_cancelada_excluida_e_quitada_nao_entram(db, contas):
    contas(situacao="cancelada", venceu_ha=40)
    contas(excluida=True, venceu_ha=40)
    contas(pago_dias_depois=2, venceu_ha=40)
    assert _pagina(db).total == 0


def test_so_atraso_fica_fora_a_menos_que_peca(db, contas):
    contas(venceu_ha=10)
    assert _pagina(db).total == 0
    assert _pagina(db, incluir_atraso=True).total == 1


def test_carencia_de_30_dias_e_inclusiva_no_atraso(db, contas):
    from app.core.inadimplencia import resumo

    contas(venceu_ha=30, valor=100)   # ainda atraso
    contas(venceu_ha=31, valor=200)   # inadimplente
    r = resumo(db, HOJE)
    assert r.em_atraso == 100
    assert r.inadimplente == 200
    assert r.total_vencido == 300


def test_faixa_filtra_por_titulo_na_faixa(db, contas):
    contas(doc="11111111000111", venceu_ha=40)
    contas(doc="22222222000122", venceu_ha=100)
    assert {e.empresa for e in _pagina(db, faixa="31_60").itens} == {"11111111"}
    assert {e.empresa for e in _pagina(db, faixa="90_mais").itens} == {"22222222"}


def test_busca_por_nome_e_por_cnpj_com_e_sem_pontuacao(db, contas):
    contas(nome="Alfa Ltda", doc="11111111000111", venceu_ha=40)
    contas(nome="Beta SA", doc="22222222000122", venceu_ha=40)
    assert [e.nome for e in _pagina(db, busca="beta").itens] == ["Beta SA"]
    assert [e.nome for e in _pagina(db, busca="22.222.222").itens] == ["Beta SA"]
    assert [e.nome for e in _pagina(db, busca="22222222").itens] == ["Beta SA"]


def test_busca_acha_pela_grafia_antiga_do_nome(db, contas):
    contas(nome="Velha Razao Ltda", doc="11111111000111", venceu_ha=60)
    contas(nome="Alfa Ltda", doc="11111111000111", venceu_ha=40)
    assert [e.nome for e in _pagina(db, busca="velha razao").itens] == ["Alfa Ltda"]


def test_hoje_na_empresa_usa_o_fuso_de_sao_paulo(monkeypatch):
    from datetime import datetime, timezone

    from app.core import inadimplencia

    class RelogioFalso(datetime):
        @classmethod
        def now(cls, tz=None):
            # 23h em Brasília (UTC-3) do dia 9 já é 02h do dia 10 em UTC
            return datetime(2026, 10, 10, 2, 0, tzinfo=timezone.utc).astimezone(tz)

    monkeypatch.setattr(inadimplencia, "datetime", RelogioFalso)
    assert inadimplencia.hoje_na_empresa() == date(2026, 10, 9)


def test_status_sem_ciclo_e_sem_contato(db, contas):
    contas(venceu_ha=40)
    assert _pagina(db).itens[0].status == "sem_contato"
    assert _pagina(db, status=["sem_contato"]).total == 1
    assert _pagina(db, status=["promessa"]).total == 0


def test_resumo_faixas_e_carteira(db, contas):
    from app.core.inadimplencia import resumo

    contas(doc="11111111000111", venceu_ha=10, valor=100)
    contas(doc="11111111000111", venceu_ha=45, valor=200)
    contas(doc="22222222000122", venceu_ha=-5, valor=700)   # a vencer
    r = resumo(db, HOJE)
    assert r.total_a_receber == 1000
    assert r.inadimplencia_carteira == pytest.approx(0.2)
    faixas = {f.faixa: (f.titulos, f.empresas, f.valor) for f in r.faixas}
    assert faixas["atraso"] == (1, 1, 100)
    assert faixas["31_60"] == (1, 1, 200)
    assert faixas["90_mais"] == (0, 0, 0)


def test_safra_conta_pago_depois_de_30_dias_e_nao_conta_pago_em_dia(db, contas):
    from app.core.inadimplencia import indicadores

    contas(venceu_ha=200, valor=100, pago_dias_depois=5)    # em dia
    contas(venceu_ha=200, valor=300, pago_dias_depois=31)   # inadimplente, pago depois
    contas(venceu_ha=200, valor=600)                         # inadimplente, em aberto
    i = indicadores(db, HOJE)
    assert i.total.valor == 1000
    assert i.total.inadimplente == 900
    assert i.total.taxa == pytest.approx(0.9)


def test_titulo_ainda_nao_maduro_fica_fora_da_safra(db, contas):
    from app.core.inadimplencia import indicadores

    contas(venceu_ha=29, valor=100)
    assert indicadores(db, HOJE).total.valor == 0


def test_mes_em_apuracao_nao_entra_no_ultimo_fechado_nem_na_media(db, contas):
    from app.core.inadimplencia import indicadores

    fixo = date(2026, 10, 9)
    contas(hoje=fixo, venceu_ha=31, valor=1000)   # 08/09: maduro, mês de set em apuração
    contas(hoje=fixo, venceu_ha=55, valor=100)    # 15/08: aberto, mês fechado
    contas(hoje=fixo, venceu_ha=86, valor=100, pago_dias_depois=5)  # jul, em dia
    i = indicadores(db, fixo)
    meses = {m.mes: m for m in i.mensal}
    assert meses["2026-09"].em_apuracao is True    # 30/09 + 30 = 30/10 >= 09/10
    assert meses["2026-08"].em_apuracao is False   # 31/08 + 30 = 30/09 < 09/10
    assert i.ultimo_fechado.mes == "2026-08"
    # a média dos fechados (jul + ago) deixa setembro de fora: 100 / 200, e não 1100 / 1200
    assert i.media_12_meses == pytest.approx(0.5)


def test_safra_carencia_estrita_no_atraso_e_no_pagamento(db, contas):
    from app.core.inadimplencia import indicadores

    contas(venceu_ha=30, valor=100)
    assert indicadores(db, HOJE).total.valor == 0     # 30 dias ainda é atraso
    contas(venceu_ha=31, valor=200)
    i = indicadores(db, HOJE)
    assert i.total.valor == 200 and i.total.inadimplente == 200


def test_pago_exatamente_no_dia_30_e_em_dia(db, contas):
    from app.core.inadimplencia import indicadores

    contas(venceu_ha=100, valor=100, pago_dias_depois=30)
    i = indicadores(db, HOJE)
    assert i.total.valor == 100
    assert i.total.inadimplente == 0


def test_direcao_maliciosa_nao_chega_ao_sql(db, contas):
    contas(venceu_ha=40)
    p = _pagina(db, direcao="desc; DROP TABLE tiny.contas_receber")
    assert p.total == 1
    assert db.execute(text("SELECT count(*) FROM tiny.contas_receber")).scalar_one() == 1


def test_recuperado(db, contas):
    from app.core.inadimplencia import resumo

    contas(venceu_ha=200, valor=300, pago_dias_depois=40)  # atrasou e pagou
    contas(venceu_ha=200, valor=100)                        # atrasou e não pagou
    r = resumo(db, HOJE)
    assert r.recuperado == pytest.approx(0.75)


def test_titulos_da_empresa_traz_vencidos_e_a_vencer_no_formato_da_tela(db, contas):
    from app.core.inadimplencia import titulos_da_empresa

    contas(doc="11111111000111", venceu_ha=40)
    contas(doc="11111111000222", venceu_ha=-10)
    contas(doc="22222222000122", venceu_ha=40)
    t = titulos_da_empresa(db, HOJE, "11111111")
    assert len(t) == 2
    assert {c.vencida for c in t} == {True, False}


def test_detalhe(db, contas):
    from app.core.inadimplencia import detalhe_da_empresa

    contas(nome="Alfa - A", doc="11111111000111", venceu_ha=40, valor=100)
    contas(nome="Alfa - B", doc="11111111000222", venceu_ha=50, valor=200)
    d = detalhe_da_empresa(db, HOJE, "11111111")
    assert d.valor_devido == 300
    assert [f.cnpj for f in d.filiais] == ["11111111000222", "11111111000111"]
    assert d.telefone == "(11) 0000-0000"
    assert d.ciclo is None and d.eventos == []
    assert detalhe_da_empresa(db, HOJE, "99999999") is None


# ─────────────────────────────────────────────────────── dados de cobrança

def _ciclo(engine, empresa, status, *, promessa_data=None, encerrado=False, ultimo_contato=None):
    with engine.begin() as conn:
        return conn.execute(text(
            "INSERT INTO tiny.cobranca_ciclos (empresa, status, promessa_data, aberto_por,"
            " encerrado_em, ultimo_contato_em, aberto_em)"
            " VALUES (:e, :s, :p, 'tester', :enc, :uc, now() - interval '5 days') RETURNING id"
        ), {"e": empresa, "s": status, "p": promessa_data,
            "enc": datetime(2026, 1, 1) if encerrado else None, "uc": ultimo_contato}).scalar_one()


def _evento(engine, ciclo_id, ocorrido_em, tipo, anotacao):
    with engine.begin() as conn:
        conn.execute(text(
            "INSERT INTO tiny.cobranca_eventos (ciclo_id, ocorrido_em, registrado_por, tipo, anotacao)"
            " VALUES (:c, :o, 'tester', :t, :a)"
        ), {"c": ciclo_id, "o": ocorrido_em, "t": tipo, "a": anotacao})


@pytest.fixture
def limpa_cobranca(engine):
    def _limpar():
        with engine.begin() as conn:
            conn.execute(text("TRUNCATE tiny.cobranca_eventos, tiny.cobranca_ciclos RESTART IDENTITY CASCADE"))
    _limpar()
    yield
    _limpar()


def test_detalhe_mapeia_ciclo_anteriores_e_eventos(limpa_cobranca, db, contas, engine):
    from app.core.inadimplencia import detalhe_da_empresa

    contas(doc="11111111000111", venceu_ha=40)
    antigo = _ciclo(engine, "11111111", "pago", encerrado=True)
    atual = _ciclo(engine, "11111111", "promessa", promessa_data=HOJE + timedelta(days=3))
    _evento(engine, antigo, datetime(2026, 1, 1, 10), "nota", "primeiro")
    _evento(engine, atual, datetime(2026, 5, 1, 10), "nota", "segundo")
    _evento(engine, atual, datetime(2026, 6, 1, 10), "nota", "terceiro")
    d = detalhe_da_empresa(db, HOJE, "11111111")
    assert d.ciclo.id == atual and d.ciclo.status == "promessa"
    assert [c.id for c in d.ciclos_anteriores] == [antigo]
    assert [e.anotacao for e in d.eventos] == ["terceiro", "segundo", "primeiro"]


def test_resumo_conta_a_cobranca(limpa_cobranca, db, contas, engine):
    from app.core.inadimplencia import resumo

    for doc in ("11111111000111", "22222222000122", "33333333000133", "44444444000144", "55555555000155"):
        contas(nome="E" + doc[:2], doc=doc, venceu_ha=40)
    _ciclo(engine, "22222222", "em_contato")
    _ciclo(engine, "33333333", "promessa", promessa_data=HOJE + timedelta(days=7))
    _ciclo(engine, "44444444", "promessa", promessa_data=HOJE + timedelta(days=8))
    _ciclo(engine, "55555555", "quebrada")
    # 1111...: sem ciclo -> sem_contato; em_contato não conta
    r = resumo(db, HOJE)
    assert r.sem_contato == 1
    assert r.promessas_7_dias == 1
    assert r.promessas_quebradas == 1
    assert r.em_negociacao == 0
    _ciclo(engine, "11111111", "negociacao")
    r = resumo(db, HOJE)
    assert r.em_negociacao == 1 and r.sem_contato == 0


def test_pagina_traz_o_ciclo_aberto_e_filtra_por_status(limpa_cobranca, db, contas, engine):
    contas(nome="Alfa", doc="11111111000111", venceu_ha=40, valor=500)
    contas(nome="Beta", doc="22222222000122", venceu_ha=40, valor=100)
    promessa = HOJE + timedelta(days=2)
    contato = datetime(2026, 9, 1, 12)
    _ciclo(engine, "11111111", "promessa", promessa_data=promessa, ultimo_contato=contato)
    _ciclo(engine, "11111111", "pago", encerrado=True)
    p = _pagina(db)
    alfa = next(e for e in p.itens if e.empresa == "11111111")
    assert alfa.status == "promessa"
    assert alfa.proxima_data == promessa
    assert alfa.ultimo_contato.replace(tzinfo=None) == contato
    assert [e.empresa for e in _pagina(db, status=["promessa"]).itens] == ["11111111"]
    assert [e.empresa for e in _pagina(db, status=["sem_contato"]).itens] == ["22222222"]


# ─────────────────────────────────────────────────────── filtros de data e de contato

def _resumo(db, **kw):
    from app.core.inadimplencia import resumo

    return resumo(db, HOJE, **kw)


def test_filtro_de_vencimento_recorta_titulos_e_valores(db, contas):
    contas(doc="11111111000111", venceu_ha=40, valor=100)
    contas(doc="11111111000111", venceu_ha=100, valor=200)
    ini, fim = HOJE - timedelta(days=50), HOJE - timedelta(days=30)
    p = _pagina(db, data_tipo="vencimento", data_inicio=ini, data_fim=fim)
    e = p.itens[0]
    assert (e.titulos, e.valor_devido, e.maior_atraso) == (1, 100, 40)
    r = _resumo(db, data_tipo="vencimento", data_inicio=ini, data_fim=fim)
    assert r.total_a_receber == 100 and r.total_vencido == 100 and r.inadimplente == 100
    assert r.titulos_vencidos == 1
    # sem filtro, tudo
    assert _pagina(db).itens[0].valor_devido == 300
    assert _resumo(db).total_a_receber == 300


def test_filtro_de_vencimento_que_zera_a_empresa_a_tira_da_lista(db, contas):
    contas(venceu_ha=40)
    p = _pagina(db, data_tipo="vencimento", data_inicio=HOJE - timedelta(days=5), data_fim=HOJE)
    assert p.total == 0


def test_filtro_de_emissao_usa_a_data_de_emissao(db, contas):
    contas(doc="11111111000111", venceu_ha=40, valor=100, emissao_ha=10)   # emitido há 50
    contas(doc="11111111000111", venceu_ha=40, valor=200, emissao_ha=60)   # emitido há 100
    ini, fim = HOJE - timedelta(days=120), HOJE - timedelta(days=80)  # so a de emissao -100
    e = _pagina(db, data_tipo="emissao", data_inicio=ini, data_fim=fim).itens[0]
    assert (e.titulos, e.valor_devido) == (1, 200)
    assert _resumo(db, data_tipo="emissao", data_inicio=ini, data_fim=fim).total_a_receber == 200


def test_data_so_com_inicio_ou_so_com_fim(db, contas):
    contas(doc="11111111000111", venceu_ha=40, valor=100)
    contas(doc="11111111000111", venceu_ha=100, valor=200)
    corte = HOJE - timedelta(days=60)
    assert _pagina(db, data_tipo="vencimento", data_inicio=corte).itens[0].valor_devido == 100
    assert _pagina(db, data_tipo="vencimento", data_fim=corte).itens[0].valor_devido == 200


def test_filtro_de_promessa_recorta_empresas_sem_mudar_valores(limpa_cobranca, db, contas, engine):
    contas(nome="Alfa", doc="11111111000111", venceu_ha=40, valor=100)
    contas(nome="Alfa", doc="11111111000111", venceu_ha=100, valor=50)
    contas(nome="Beta", doc="22222222000122", venceu_ha=40, valor=700)
    _ciclo(engine, "11111111", "promessa", promessa_data=HOJE + timedelta(days=3))
    _ciclo(engine, "22222222", "promessa", promessa_data=HOJE + timedelta(days=20))
    p = _pagina(db, data_tipo="promessa", data_inicio=HOJE, data_fim=HOJE + timedelta(days=7))
    assert [e.empresa for e in p.itens] == ["11111111"]
    assert p.itens[0].valor_devido == 150  # a dívida inteira
    r = _resumo(db, data_tipo="promessa", data_inicio=HOJE, data_fim=HOJE + timedelta(days=7))
    assert r.total_vencido == 150 and r.promessas_7_dias == 1 and r.sem_contato == 0


def test_filtro_de_contato_usa_o_dia_no_fuso_da_empresa(limpa_cobranca, db, contas, engine):
    contas(nome="Alfa", doc="11111111000111", venceu_ha=40, valor=100)
    contas(nome="Beta", doc="22222222000122", venceu_ha=40, valor=700)
    # 01h UTC de HOJE ainda e a noite de ontem em Sao Paulo
    _ciclo(engine, "11111111", "em_contato",
           ultimo_contato=datetime(HOJE.year, HOJE.month, HOJE.day, 1, tzinfo=timezone.utc))
    _ciclo(engine, "22222222", "em_contato", ultimo_contato=datetime.now(timezone.utc) - timedelta(days=30))
    ontem = HOJE - timedelta(days=1)
    p = _pagina(db, data_tipo="contato", data_inicio=ontem, data_fim=ontem)
    assert [e.empresa for e in p.itens] == ["11111111"]
    assert p.itens[0].valor_devido == 100


def test_sem_contato_ha_mais_de_n_dias_inclui_quem_nunca_foi_contatado(limpa_cobranca, db, contas, engine):
    agora = datetime.now(timezone.utc)
    for doc in ("11111111000111", "22222222000122", "33333333000133", "44444444000144"):
        contas(nome="E" + doc[:2], doc=doc, venceu_ha=40)
    _ciclo(engine, "11111111", "em_contato", ultimo_contato=agora - timedelta(days=3))    # recente
    _ciclo(engine, "22222222", "em_contato", ultimo_contato=agora - timedelta(days=20))   # 20 dias
    _ciclo(engine, "33333333", "em_contato")                                              # ciclo sem contato
    # 4444...: sem ciclo
    def quem(v):
        return {e.empresa for e in _pagina(db, sem_contato=v).itens}
    assert quem("7") == {"22222222", "33333333", "44444444"}
    assert quem("15") == {"22222222", "33333333", "44444444"}
    assert quem("30") == {"33333333", "44444444"}
    assert quem("nunca") == {"33333333", "44444444"}
    assert _resumo(db, sem_contato="nunca").empresas_inadimplentes == 2


def test_resumo_segue_status_e_faixa_mas_a_barra_de_faixas_continua_navegavel(db, contas):
    contas(doc="11111111000111", venceu_ha=40, valor=100)
    contas(doc="22222222000122", venceu_ha=100, valor=200)
    r = _resumo(db, faixa="31_60")
    assert r.total_vencido == 100
    faixas = {f.faixa: f.valor for f in r.faixas}
    assert faixas["31_60"] == 100 and faixas["90_mais"] == 200
    assert _resumo(db, status=["promessa"]).total_vencido == 0


def test_recuperado_nao_segue_o_filtro(db, contas):
    contas(doc="11111111000111", venceu_ha=200, valor=300, pago_dias_depois=40)
    contas(doc="11111111000111", venceu_ha=200, valor=100)
    contas(doc="22222222000122", venceu_ha=5, valor=10)
    filtro = dict(data_tipo="vencimento", data_inicio=HOJE - timedelta(days=10), data_fim=HOJE)
    assert _resumo(db, **filtro).total_vencido == 10
    assert _resumo(db, **filtro).recuperado == pytest.approx(0.75)
    assert _resumo(db, **filtro).recuperado == _resumo(db).recuperado
