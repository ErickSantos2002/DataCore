"""Inadimplência: as consultas de leitura da página, somadas no banco.

Spec: docs/superpowers/specs/2026-10-09-inadimplencia-design.md

As definições — empresa, faixas, carência e taxa de safra — moram aqui e em nenhum
outro lugar. A tela recebe tudo somado, como em `contas_agregado.py` (item 9.4).
"""
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.contas_agregado import (
    COLUNAS_DA_TELA,
    QUITADAS_A_RECEBER,
    SITUACOES_CANCELADAS,
    SITUACOES_QUE_NAO_VENCEM,
    ContaDaTela,
)

#: Até aqui é atraso; depois, inadimplência. Decisão do Erick (padrão de mercado).
CARENCIA_DIAS = 30

#: As faixas de atraso, em dias, inclusivas. `None` é sem teto.
FAIXAS = {"atraso": (1, 30), "31_60": (31, 60), "61_90": (61, 90), "90_mais": (91, None)}

#: Desde quando a série anual começa — antes disso a base tem pouco volume.
ANO_INICIAL = 2019
#: Quantos meses a série mensal mostra.
MESES_NA_SERIE = 24


def params_base(hoje: date) -> dict:
    return {
        "hoje": hoje,
        "quitadas": QUITADAS_A_RECEBER,
        "canceladas": SITUACOES_CANCELADAS,
        "carencia": CARENCIA_DIAS,
    }


# A chave da empresa: raiz do CNPJ (8 dígitos), CPF inteiro, ou o nome normalizado.
# `CAST` e nunca o cast com dois-pontos — ver o aviso em `contas_agregado._clausulas`.
SQL_BASE = """
WITH titulos AS (
    SELECT id, data AS emissao, vencimento, liquidacao, situacao,
           cliente_nome, cliente_cpf_cnpj, cliente_fone, cliente_email,
           COALESCE(valor, 0) AS valor,
           COALESCE(saldo, 0) AS saldo,
           regexp_replace(COALESCE(cliente_cpf_cnpj, ''), '[^0-9]', '', 'g') AS doc,
           lower(COALESCE(situacao, '')) = ANY(CAST(:quitadas AS text[])) AS quitada
    FROM tiny.contas_receber
    WHERE excluida_na_origem_em IS NULL
      AND lower(COALESCE(situacao, '')) <> ALL(CAST(:canceladas AS text[]))
),
t AS (
    SELECT *,
           CASE WHEN length(doc) = 14 THEN left(doc, 8)
                WHEN length(doc) = 11 THEN doc
                ELSE 'nome' || chr(58) || lower(trim(COALESCE(cliente_nome, '')))
           END AS empresa,
           NOT quitada AS em_aberto,
           CASE WHEN NOT quitada AND vencimento < CAST(:hoje AS date)
                THEN CAST(:hoje AS date) - vencimento ELSE 0 END AS atraso
    FROM titulos
),
empresas AS (
    SELECT empresa,
           (array_agg(cliente_nome ORDER BY emissao DESC, id DESC)
               FILTER (WHERE em_aberto))[1]                          AS nome,
           count(DISTINCT doc) FILTER (WHERE atraso > 0)             AS filiais,
           min(cliente_cpf_cnpj) FILTER (WHERE atraso > 0)           AS cnpj_unico,
           count(*) FILTER (WHERE atraso > 0)                        AS titulos,
           COALESCE(sum(saldo) FILTER (WHERE atraso > 0), 0)         AS valor_vencido,
           COALESCE(sum(saldo) FILTER (WHERE atraso > CAST(:carencia AS int)), 0)
                                                                      AS valor_inadimplente,
           COALESCE(max(atraso), 0)                                  AS maior_atraso
    FROM t
    GROUP BY empresa
    HAVING count(*) FILTER (WHERE atraso > 0) > 0
)
"""
# `chr(58)` é o dois-pontos: escrito literal dentro de `text()` ele vira bind param.


def documento_exibido(empresa: str, filiais: int, cnpj_unico: Optional[str]) -> Optional[str]:
    """O que vai embaixo do nome: o CNPJ completo se for uma filial só, senão a raiz."""
    if empresa.startswith("nome:"):
        return None
    if len(empresa) == 11:  # CPF
        d = empresa
        return f"{d[0:3]}.{d[3:6]}.{d[6:9]}-{d[9:11]}"
    if filiais <= 1 and cnpj_unico:
        d = "".join(c for c in cnpj_unico if c.isdigit())
        if len(d) == 14:
            return f"{d[0:2]}.{d[2:5]}.{d[5:8]}/{d[8:12]}-{d[12:14]}"
        return cnpj_unico
    raiz = f"{empresa[0:2]}.{empresa[2:5]}.{empresa[5:8]}"
    return f"{raiz} · {filiais} filiais"


# ─────────────────────────────────────────────────────────────── resumo

class Faixa(BaseModel):
    faixa: str
    titulos: int
    empresas: int
    valor: float


class ResumoDeInadimplencia(BaseModel):
    total_a_receber: float
    total_vencido: float
    em_atraso: float
    inadimplente: float
    inadimplencia_carteira: float
    recuperado: Optional[float]
    titulos_vencidos: int
    titulos_inadimplentes: int
    empresas_inadimplentes: int
    faixas: List[Faixa]
    sem_contato: int
    promessas_7_dias: int
    promessas_quebradas: int
    em_negociacao: int


SQL_RESUMO = """
SELECT
    COALESCE(sum(saldo) FILTER (WHERE em_aberto), 0)                         AS total_a_receber,
    COALESCE(sum(saldo) FILTER (WHERE atraso > 0), 0)                        AS total_vencido,
    COALESCE(sum(saldo) FILTER (WHERE atraso BETWEEN 1 AND CAST(:carencia AS int)), 0) AS em_atraso,
    COALESCE(sum(saldo) FILTER (WHERE atraso > CAST(:carencia AS int)), 0)   AS inadimplente,
    count(*) FILTER (WHERE atraso > 0)                                       AS titulos_vencidos,
    count(*) FILTER (WHERE atraso > CAST(:carencia AS int))                  AS titulos_inadimplentes,
    count(DISTINCT empresa) FILTER (WHERE atraso > CAST(:carencia AS int))   AS empresas_inadimplentes,
    -- a safra inteira: o que passou de 30 dias sem pagar, na história
    COALESCE(sum(CASE WHEN em_aberto THEN saldo
                      WHEN liquidacao > vencimento + CAST(:carencia AS int) THEN valor
                      ELSE 0 END)
             FILTER (WHERE vencimento + CAST(:carencia AS int) <= CAST(:hoje AS date)), 0)
                                                                              AS safra_inadimplente
FROM t
"""

SQL_FAIXA = """
SELECT count(*) AS titulos, count(DISTINCT empresa) AS empresas, COALESCE(sum(saldo), 0) AS valor
FROM t
WHERE atraso >= CAST(:lo AS int) AND (CAST(:hi AS int) IS NULL OR atraso <= CAST(:hi AS int))
"""

SQL_CONTAGEM_COBRANCA = """
SELECT
    count(*) FILTER (WHERE e.valor_inadimplente > 0
                     AND COALESCE(c.status, 'sem_contato') = 'sem_contato')    AS sem_contato,
    count(*) FILTER (WHERE c.status = 'promessa'
                     AND c.promessa_data BETWEEN CAST(:hoje AS date)
                                             AND CAST(:hoje AS date) + 7)      AS promessas_7_dias,
    count(*) FILTER (WHERE c.status = 'quebrada')                              AS promessas_quebradas,
    count(*) FILTER (WHERE c.status = 'negociacao')                            AS em_negociacao
FROM empresas e
LEFT JOIN tiny.cobranca_ciclos c ON c.empresa = e.empresa AND c.encerrado_em IS NULL
"""


def resumo(db: Session, hoje: date) -> ResumoDeInadimplencia:
    p = params_base(hoje)
    linha = db.execute(text(SQL_BASE + SQL_RESUMO), p).mappings().one()
    cobranca = db.execute(text(SQL_BASE + SQL_CONTAGEM_COBRANCA), p).mappings().one()

    faixas = []
    for nome, (lo, hi) in FAIXAS.items():
        f = db.execute(text(SQL_BASE + SQL_FAIXA), {**p, "lo": lo, "hi": hi}).mappings().one()
        faixas.append(Faixa(faixa=nome, titulos=f["titulos"], empresas=f["empresas"],
                            valor=float(f["valor"])))

    total = float(linha["total_a_receber"])
    inad = float(linha["inadimplente"])
    safra = float(linha["safra_inadimplente"])
    return ResumoDeInadimplencia(
        total_a_receber=total,
        total_vencido=float(linha["total_vencido"]),
        em_atraso=float(linha["em_atraso"]),
        inadimplente=inad,
        inadimplencia_carteira=(inad / total) if total else 0.0,
        recuperado=(1 - inad / safra) if safra else None,
        titulos_vencidos=linha["titulos_vencidos"],
        titulos_inadimplentes=linha["titulos_inadimplentes"],
        empresas_inadimplentes=linha["empresas_inadimplentes"],
        faixas=faixas,
        **{k: int(v) for k, v in cobranca.items()},
    )


# ─────────────────────────────────────────────────────────────── lista

class EmpresaDaLista(BaseModel):
    empresa: str
    nome: str
    documento: Optional[str]
    filiais: int
    titulos: int
    valor_devido: float
    valor_inadimplente: float
    maior_atraso: int
    status: Optional[str]
    proxima_data: Optional[date]
    ultimo_contato: Optional[datetime]


class PaginaDeEmpresas(BaseModel):
    itens: List[EmpresaDaLista]
    total: int
    limite: int
    offset: int


# Ordenação por lista fechada: o ORDER BY não aceita bind param.
ORDENACOES_DE_EMPRESAS = {
    "valor": "valor_vencido {d}, empresa",
    "maior_atraso": "maior_atraso {d}, valor_vencido DESC",
    "titulos": "titulos {d}, valor_vencido DESC",
    "nome": "nome {d}, empresa",
    "status": "status {d} NULLS LAST, valor_vencido DESC",
    "proxima_data": "proxima_data {d} NULLS LAST, valor_vencido DESC",
    "ultimo_contato": "ultimo_contato {d} NULLS FIRST, valor_vencido DESC",
}

SQL_LISTA = """
, lista AS (
    SELECT e.*,
           COALESCE(c.status, CASE WHEN e.valor_inadimplente > 0 THEN 'sem_contato' END) AS status,
           c.promessa_data      AS proxima_data,
           c.ultimo_contato_em  AS ultimo_contato
    FROM empresas e
    LEFT JOIN tiny.cobranca_ciclos c ON c.empresa = e.empresa AND c.encerrado_em IS NULL
    WHERE (CAST(:incluir_atraso AS boolean) OR e.valor_inadimplente > 0)
      AND (CAST(:status AS text[]) IS NULL
           OR COALESCE(c.status, CASE WHEN e.valor_inadimplente > 0 THEN 'sem_contato' END)
              = ANY(CAST(:status AS text[])))
      AND (CAST(:faixa_lo AS int) IS NULL OR EXISTS (
            SELECT 1 FROM t WHERE t.empresa = e.empresa
               AND t.atraso >= CAST(:faixa_lo AS int)
               AND (CAST(:faixa_hi AS int) IS NULL OR t.atraso <= CAST(:faixa_hi AS int))))
      AND (CAST(:busca AS text) IS NULL
           OR lower(e.nome) LIKE '%' || lower(CAST(:busca AS text)) || '%'
           OR (length(regexp_replace(CAST(:busca AS text), '[^0-9]', '', 'g')) >= 3
               AND EXISTS (SELECT 1 FROM t WHERE t.empresa = e.empresa
                   AND t.doc LIKE '%' || regexp_replace(CAST(:busca AS text), '[^0-9]', '', 'g') || '%')))
)
"""


def pagina_de_empresas(db: Session, hoje: date, *, busca: Optional[str], status: Optional[List[str]],
                       faixa: Optional[str], incluir_atraso: bool, ordenar_por: str, direcao: str,
                       limite: int, offset: int) -> PaginaDeEmpresas:
    lo, hi = FAIXAS[faixa] if faixa else (None, None)
    p = {**params_base(hoje), "busca": (busca or "").strip() or None, "status": status or None,
         "faixa_lo": lo, "faixa_hi": hi, "incluir_atraso": incluir_atraso}
    total = db.execute(text(SQL_BASE + SQL_LISTA + "SELECT count(*) FROM lista"), p).scalar_one()
    ordem = ORDENACOES_DE_EMPRESAS[ordenar_por].format(d=direcao.upper())
    linhas = db.execute(
        text(SQL_BASE + SQL_LISTA + f"SELECT * FROM lista ORDER BY {ordem} LIMIT :limite OFFSET :offset"),
        {**p, "limite": limite, "offset": offset},
    ).mappings()
    itens = [
        EmpresaDaLista(
            empresa=l["empresa"], nome=l["nome"] or "",
            documento=documento_exibido(l["empresa"], l["filiais"], l["cnpj_unico"]),
            filiais=l["filiais"], titulos=l["titulos"], valor_devido=float(l["valor_vencido"]),
            valor_inadimplente=float(l["valor_inadimplente"]), maior_atraso=l["maior_atraso"],
            status=l["status"], proxima_data=l["proxima_data"], ultimo_contato=l["ultimo_contato"],
        )
        for l in linhas
    ]
    return PaginaDeEmpresas(itens=itens, total=total, limite=limite, offset=offset)


# ─────────────────────────────────────────────────────────────── detalhe

class Filial(BaseModel):
    cnpj: str
    nome: str
    titulos: int
    valor_vencido: float


class Ciclo(BaseModel):
    id: int
    status: str
    promessa_data: Optional[date]
    promessa_valor: Optional[float]
    promessa_condicoes: Optional[str]
    aberto_em: datetime
    aberto_por: str
    encerrado_em: Optional[datetime]
    ultimo_contato_em: Optional[datetime]


class Evento(BaseModel):
    id: int
    ciclo_id: int
    ocorrido_em: datetime
    registrado_em: datetime
    registrado_por: str
    tipo: str
    canal: Optional[str]
    filial_cnpj: Optional[str]
    status_anterior: Optional[str]
    status_novo: Optional[str]
    promessa_data: Optional[date]
    promessa_valor: Optional[float]
    promessa_condicoes: Optional[str]
    anotacao: Optional[str]
    valor_inadimplente: Optional[float]


class DetalheDaEmpresa(BaseModel):
    empresa: str
    nome: str
    documento: Optional[str]
    valor_devido: float
    valor_inadimplente: float
    maior_atraso: int
    telefone: Optional[str]
    email: Optional[str]
    observacao: Optional[str]
    observacao_por: Optional[str]
    observacao_em: Optional[datetime]
    filiais: List[Filial]
    ciclo: Optional[Ciclo]
    ciclos_anteriores: List[Ciclo]
    eventos: List[Evento]


def valores_da_empresa(db: Session, hoje: date, empresa: str) -> Optional[dict]:
    linha = db.execute(
        text(SQL_BASE + "SELECT * FROM empresas WHERE empresa = :empresa"),
        {**params_base(hoje), "empresa": empresa},
    ).mappings().first()
    return dict(linha) if linha else None


def filiais_da_empresa(db: Session, empresa: str) -> set:
    linhas = db.execute(
        text(SQL_BASE + "SELECT DISTINCT doc FROM t WHERE empresa = :empresa AND doc <> ''"),
        {**params_base(date.today()), "empresa": empresa},
    ).scalars()
    return set(linhas)


def detalhe_da_empresa(db: Session, hoje: date, empresa: str) -> Optional[DetalheDaEmpresa]:
    p = {**params_base(hoje), "empresa": empresa}
    valores = valores_da_empresa(db, hoje, empresa)
    ciclos = [Ciclo(**dict(c)) for c in db.execute(text(
        "SELECT id, status, promessa_data, promessa_valor, promessa_condicoes, aberto_em,"
        " aberto_por, encerrado_em, ultimo_contato_em"
        " FROM tiny.cobranca_ciclos WHERE empresa = :empresa ORDER BY aberto_em DESC"
    ), p).mappings()]
    if valores is None and not any(c.encerrado_em is None for c in ciclos):
        return None

    filiais = [Filial(cnpj=f["doc"], nome=f["nome"], titulos=f["titulos"],
                      valor_vencido=float(f["valor"])) for f in db.execute(text(SQL_BASE + """
        SELECT doc, (array_agg(cliente_nome ORDER BY emissao DESC, id DESC))[1] AS nome,
               count(*) AS titulos, COALESCE(sum(saldo), 0) AS valor
        FROM t WHERE empresa = :empresa AND atraso > 0
        GROUP BY doc ORDER BY valor DESC, doc
    """), p).mappings()]
    contato = db.execute(text(SQL_BASE + """
        SELECT cliente_fone, cliente_email FROM t WHERE empresa = :empresa
        ORDER BY emissao DESC, id DESC LIMIT 1
    """), p).mappings().first() or {}
    obs = db.execute(text(
        "SELECT observacao, alterado_por, alterado_em FROM tiny.cobranca_empresas WHERE empresa = :empresa"
    ), p).mappings().first() or {}
    eventos = [Evento(**dict(e)) for e in db.execute(text("""
        SELECT ev.* FROM tiny.cobranca_eventos ev
        JOIN tiny.cobranca_ciclos c ON c.id = ev.ciclo_id
        WHERE c.empresa = :empresa
        ORDER BY ev.ocorrido_em DESC, ev.id DESC
    """), p).mappings()]

    v = valores or {"nome": "", "filiais": 0, "cnpj_unico": None, "valor_vencido": 0,
                    "valor_inadimplente": 0, "maior_atraso": 0}
    if not v["nome"]:
        v["nome"] = db.execute(text(SQL_BASE + """
            SELECT cliente_nome FROM t WHERE empresa = :empresa ORDER BY emissao DESC, id DESC LIMIT 1
        """), p).scalar() or empresa
    aberto = next((c for c in ciclos if c.encerrado_em is None), None)
    return DetalheDaEmpresa(
        empresa=empresa, nome=v["nome"],
        documento=documento_exibido(empresa, v["filiais"], v["cnpj_unico"]),
        valor_devido=float(v["valor_vencido"]), valor_inadimplente=float(v["valor_inadimplente"]),
        maior_atraso=v["maior_atraso"],
        telefone=contato.get("cliente_fone"), email=contato.get("cliente_email"),
        observacao=obs.get("observacao"), observacao_por=obs.get("alterado_por"),
        observacao_em=obs.get("alterado_em"),
        filiais=filiais, ciclo=aberto,
        ciclos_anteriores=[c for c in ciclos if c.encerrado_em is not None],
        eventos=eventos,
    )


def titulos_da_empresa(db: Session, hoje: date, empresa: str) -> List[ContaDaTela]:
    """Os títulos em aberto da empresa, vencidos e a vencer, no formato da tela de Contas."""
    p = {**params_base(hoje), "empresa": empresa, "nao_vencem": SITUACOES_QUE_NAO_VENCEM}
    sql = (SQL_BASE + "SELECT " + COLUNAS_DA_TELA.format(campo_emissao="data")
           + ", forma_pagamento, portador FROM tiny.contas_receber"
           " WHERE id IN (SELECT id FROM t WHERE empresa = :empresa AND em_aberto)"
           " ORDER BY vencimento, id")
    return [ContaDaTela(**dict(l)) for l in db.execute(text(sql), p).mappings()]


# ─────────────────────────────────────────────────────────────── indicadores

class PontoDeTaxa(BaseModel):
    valor: float
    inadimplente: float
    titulos: int
    titulos_inadimplentes: int
    taxa: Optional[float]


class MesDeTaxa(PontoDeTaxa):
    mes: str            # "AAAA-MM"
    em_apuracao: bool


class AnoDeTaxa(PontoDeTaxa):
    ano: int
    ano_corrente: bool


class Indicadores(BaseModel):
    mensal: List[MesDeTaxa]
    anual: List[AnoDeTaxa]
    total: PontoDeTaxa
    desde: Optional[date]
    ultimo_fechado: Optional[MesDeTaxa]
    media_12_meses: Optional[float]


SQL_MADUROS = """
, maduros AS (
    SELECT vencimento, valor,
           CASE WHEN em_aberto THEN saldo
                WHEN liquidacao > vencimento + CAST(:carencia AS int) THEN valor
                ELSE 0 END AS inad
    FROM t
    WHERE vencimento + CAST(:carencia AS int) <= CAST(:hoje AS date)
)
"""
_SOMAS = ("COALESCE(sum(valor), 0) AS valor, COALESCE(sum(inad), 0) AS inadimplente,"
          " count(*) AS titulos, count(*) FILTER (WHERE inad > 0) AS titulos_inadimplentes")


def _taxa(l) -> dict:
    valor = float(l["valor"])
    inad = float(l["inadimplente"])
    return {"valor": valor, "inadimplente": inad, "titulos": l["titulos"],
            "titulos_inadimplentes": l["titulos_inadimplentes"],
            "taxa": (inad / valor) if valor else None}


def indicadores(db: Session, hoje: date) -> Indicadores:
    p = params_base(hoje)
    primeiro = date(hoje.year, hoje.month, 1)
    ano, mes = primeiro.year, primeiro.month - (MESES_NA_SERIE - 1)
    while mes <= 0:
        mes += 12
        ano -= 1
    p["inicio_serie"] = date(ano, mes, 1)
    p["ano_inicial"] = ANO_INICIAL

    mensal = []
    for l in db.execute(text(SQL_BASE + SQL_MADUROS + f"""
        SELECT to_char(vencimento, 'YYYY-MM') AS mes,
               (date_trunc('month', vencimento) + interval '1 month' - interval '1 day'
                + CAST(:carencia AS int) * interval '1 day') > CAST(:hoje AS date) AS em_apuracao,
               {_SOMAS}
        FROM maduros WHERE vencimento >= CAST(:inicio_serie AS date)
        GROUP BY 1, 2 ORDER BY 1
    """), p).mappings():
        mensal.append(MesDeTaxa(mes=l["mes"], em_apuracao=l["em_apuracao"], **_taxa(l)))

    anual = [AnoDeTaxa(ano=l["ano"], ano_corrente=l["ano"] == hoje.year, **_taxa(l))
             for l in db.execute(text(SQL_BASE + SQL_MADUROS + f"""
        SELECT CAST(EXTRACT(YEAR FROM vencimento) AS int) AS ano, {_SOMAS}
        FROM maduros WHERE EXTRACT(YEAR FROM vencimento) >= :ano_inicial
        GROUP BY 1 ORDER BY 1
    """), p).mappings()]

    tot = db.execute(text(SQL_BASE + SQL_MADUROS + f"SELECT min(vencimento) AS desde, {_SOMAS} FROM maduros"),
                     p).mappings().one()

    fechados = [m for m in mensal if not m.em_apuracao]
    ultimos = fechados[-12:]
    soma_v = sum(m.valor for m in ultimos)
    return Indicadores(
        mensal=mensal, anual=anual, total=PontoDeTaxa(**_taxa(tot)), desde=tot["desde"],
        ultimo_fechado=fechados[-1] if fechados else None,
        media_12_meses=(sum(m.inadimplente for m in ultimos) / soma_v) if soma_v else None,
    )
