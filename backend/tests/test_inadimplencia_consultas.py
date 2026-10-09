from datetime import date, timedelta

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
    assert chaves == {"00000000191", "nome:sem documento"}


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

    # um título maduro no mês passado: o mês passado só fecha 30 dias depois do fim dele
    inicio_mes = HOJE.replace(day=1)
    fim_mes_passado = inicio_mes - timedelta(days=1)
    contas(venceu_ha=(HOJE - fim_mes_passado.replace(day=1)).days, valor=100)
    contas(venceu_ha=400, valor=100)  # mês velho, fechado
    i = indicadores(db, HOJE)
    passado = [m for m in i.mensal if m.mes == fim_mes_passado.strftime("%Y-%m")]
    if passado:  # só existe se o título já está maduro
        assert passado[0].em_apuracao == (fim_mes_passado + timedelta(days=30) > HOJE)
    assert i.ultimo_fechado is not None
    assert not i.ultimo_fechado.em_apuracao


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
