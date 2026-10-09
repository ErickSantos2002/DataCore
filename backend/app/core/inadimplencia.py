"""Inadimplência: as consultas de leitura da página, somadas no banco.

Spec: docs/superpowers/specs/2026-10-09-inadimplencia-design.md

As definições — empresa, faixas, carência e taxa de safra — moram aqui e em nenhum
outro lugar. A tela recebe tudo somado, como em `contas_agregado.py` (item 9.4).
"""
import re
from calendar import monthrange
from datetime import date, datetime
from typing import List, Optional, Tuple
from zoneinfo import ZoneInfo

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


FUSO_DA_EMPRESA = ZoneInfo("America/Sao_Paulo")


def hoje_na_empresa() -> date:
    """O dia na empresa: o container roda em UTC e, depois das 21h em Brasília, date.today() já é amanhã."""
    return datetime.now(FUSO_DA_EMPRESA).date()


#: Os filtros de data que recortam TÍTULOS (antes de agregar) e os que recortam EMPRESAS
#: (pelo ciclo de cobrança aberto). O nome vem do pedido; o campo, desta lista fechada.
DATAS_DE_TITULO = ("vencimento", "emissao")
DATAS_DE_EMPRESA = ("promessa", "contato")
TIPOS_DE_DATA = DATAS_DE_TITULO + DATAS_DE_EMPRESA

#: "Sem contato há mais de": dias, ou "nunca" (sem ciclo aberto ou sem contato registrado).
SEM_CONTATO = {"7": 7, "15": 15, "30": 30, "nunca": None}


def params_base(hoje: date) -> dict:
    return {
        "hoje": hoje,
        "quitadas": QUITADAS_A_RECEBER,
        "canceladas": SITUACOES_CANCELADAS,
        "carencia": CARENCIA_DIAS,
        # sem recorte de títulos: tudo nulo
        "tit_campo": "vencimento", "tit_ini": None, "tit_fim": None,
        "tit_categorias": None, "tit_formas": None, "tit_ufs": None, "tit_nome": None, "tit_doc": None,
    }


#: O valor da lista de categoria/forma/UF que quer dizer "nulo ou vazio" ("Sem categoria" na tela).
SEM_VALOR = "__sem__"
#: A partir de quantos dígitos o texto do cliente também procura no documento (a raiz do CNPJ tem 8).
DIGITOS_PARA_DOCUMENTO = 8
_MES = re.compile(r"^(\d{4})-(0[1-9]|1[0-2])$")


def intervalo_dos_meses(mes_inicio: Optional[str], mes_fim: Optional[str]) -> Tuple[Optional[date], Optional[date]]:
    """`AAAA-MM` → (1º dia do mês inicial, último dia do mês final). `ValueError` com a frase do 422."""
    def ler(mes: Optional[str], nome: str):
        if mes is None or mes == "":
            return None
        m = _MES.match(mes)
        if not m:
            raise ValueError(f"`{nome}` deve estar no formato AAAA-MM.")
        return int(m.group(1)), int(m.group(2))

    ini, fim = ler(mes_inicio, "mes_inicio"), ler(mes_fim, "mes_fim")
    if ini and fim and fim < ini:
        raise ValueError("O mês final não pode ser anterior ao inicial.")
    de = date(ini[0], ini[1], 1) if ini else None
    ate = date(fim[0], fim[1], monthrange(fim[0], fim[1])[1]) if fim else None
    return de, ate


def _padrao_do_nome(texto: str) -> str:
    """O texto do cliente como pedaço de LIKE: `%`, `_` e a barra viram literais (a barra é o escape padrão)."""
    return texto.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def params_de_titulos(hoje: date, *, mes_inicio: Optional[str] = None, mes_fim: Optional[str] = None,
                      categoria: Optional[List[str]] = None, forma_pagamento: Optional[List[str]] = None,
                      uf: Optional[List[str]] = None, cliente: Optional[str] = None) -> dict:
    """Os filtros da aba Indicadores: todos recortam TÍTULOS, na CTE `titulos`. Lista vazia = sem filtro."""
    de, ate = intervalo_dos_meses(mes_inicio, mes_fim)
    texto = (cliente or "").strip()
    digitos = re.sub(r"[^0-9]", "", texto)
    return {**params_base(hoje),
            "tit_campo": "vencimento", "tit_ini": de, "tit_fim": ate,
            "tit_categorias": categoria or None, "tit_formas": forma_pagamento or None, "tit_ufs": uf or None,
            "tit_nome": _padrao_do_nome(texto) if texto else None,
            "tit_doc": digitos if len(digitos) >= DIGITOS_PARA_DOCUMENTO else None}


def params_do_recorte(hoje: date, *, status: Optional[List[str]] = None, faixa: Optional[str] = None,
                      data_tipo: Optional[str] = None, data_inicio: Optional[date] = None,
                      data_fim: Optional[date] = None, sem_contato: Optional[str] = None) -> dict:
    """Os parâmetros dos filtros que a lista e o resumo compartilham (menos busca e ordenação)."""
    lo, hi = FAIXAS[faixa] if faixa else (None, None)
    p = {**params_base(hoje), "status": status or None, "faixa_lo": lo, "faixa_hi": hi,
         "emp_campo": None, "emp_ini": None, "emp_fim": None,
         "sem_dias": None, "nunca": False}
    if data_tipo in DATAS_DE_TITULO:
        p.update(tit_campo=data_tipo, tit_ini=data_inicio, tit_fim=data_fim)
    elif data_tipo in DATAS_DE_EMPRESA:
        p.update(emp_campo=data_tipo, emp_ini=data_inicio, emp_fim=data_fim)
    if sem_contato == "nunca":
        p["nunca"] = True
    elif sem_contato:
        p["sem_dias"] = SEM_CONTATO[sem_contato]
    # Só restringe os cards a um conjunto de empresas quando algum filtro de empresa está ativo.
    p["restringe"] = bool(p["status"] or lo is not None or p["nunca"] or p["sem_dias"]
                          or (p["emp_campo"] and (data_inicio or data_fim)))
    return p


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
      -- recorte opcional de títulos por vencimento ou emissão (`:tit_campo` vem de lista fechada)
      AND (CAST(:tit_ini AS date) IS NULL
           OR CASE WHEN CAST(:tit_campo AS text) = 'emissao' THEN data ELSE vencimento END
              >= CAST(:tit_ini AS date))
      AND (CAST(:tit_fim AS date) IS NULL
           OR CASE WHEN CAST(:tit_campo AS text) = 'emissao' THEN data ELSE vencimento END
              <= CAST(:tit_fim AS date))
      -- recortes da aba Indicadores; `__sem__` é nulo ou vazio (ver `SEM_VALOR`)
      AND (CAST(:tit_categorias AS text[]) IS NULL
           OR COALESCE(NULLIF(trim(categoria), ''), '__sem__') = ANY(CAST(:tit_categorias AS text[])))
      AND (CAST(:tit_formas AS text[]) IS NULL
           OR COALESCE(NULLIF(trim(forma_pagamento), ''), '__sem__') = ANY(CAST(:tit_formas AS text[])))
      AND (CAST(:tit_ufs AS text[]) IS NULL
           OR COALESCE(NULLIF(trim(cliente_uf), ''), '__sem__') = ANY(CAST(:tit_ufs AS text[])))
      -- cliente: nome contém o texto (já escapado), ou documento começa pelos dígitos (raiz pega as filiais)
      AND (CAST(:tit_nome AS text) IS NULL
           OR cliente_nome ILIKE '%' || CAST(:tit_nome AS text) || '%'
           OR (CAST(:tit_doc AS text) IS NOT NULL
               AND regexp_replace(COALESCE(cliente_cpf_cnpj, ''), '[^0-9]', '', 'g')
                   LIKE CAST(:tit_doc AS text) || '%'))
),
t AS (
    SELECT *,
           CASE WHEN length(doc) = 14 THEN left(doc, 8)
                WHEN length(doc) = 11 THEN doc
                ELSE 'nome' || chr(58) || md5(lower(trim(COALESCE(cliente_nome, ''))))
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
# Sem documento, a chave é `nome:` + md5 do nome normalizado (minúsculo, sem espaços das pontas):
# o nome cru podia ter "/" e a rota nunca o alcançaria (o Starlette decodifica %2F antes de rotear).


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


# Os filtros de EMPRESA, iguais na lista e no resumo. `c` é o ciclo aberto, `e` a empresa.
# O dia do contato é o dia no fuso da empresa; `AT TIME ZONE` e `CAST`, nunca o cast com dois-pontos.
STATUS_DA_EMPRESA = "COALESCE(c.status, CASE WHEN e.valor_inadimplente > 0 THEN 'sem_contato' END)"
DIA_DO_CONTATO = "CAST((c.ultimo_contato_em AT TIME ZONE 'America/Sao_Paulo') AS date)"
FILTROS_DE_EMPRESA = f"""
      AND (CAST(:status AS text[]) IS NULL OR {STATUS_DA_EMPRESA} = ANY(CAST(:status AS text[])))
      AND (CAST(:faixa_lo AS int) IS NULL OR EXISTS (
            SELECT 1 FROM t WHERE t.empresa = e.empresa
               AND t.atraso >= CAST(:faixa_lo AS int)
               AND (CAST(:faixa_hi AS int) IS NULL OR t.atraso <= CAST(:faixa_hi AS int))))
      AND (CAST(:emp_campo AS text) IS NULL OR (
            (CAST(:emp_ini AS date) IS NULL OR
               CASE WHEN CAST(:emp_campo AS text) = 'promessa' THEN c.promessa_data
                    ELSE {DIA_DO_CONTATO} END >= CAST(:emp_ini AS date))
        AND (CAST(:emp_fim AS date) IS NULL OR
               CASE WHEN CAST(:emp_campo AS text) = 'promessa' THEN c.promessa_data
                    ELSE {DIA_DO_CONTATO} END <= CAST(:emp_fim AS date))))
      AND (NOT CAST(:nunca AS boolean) OR c.ultimo_contato_em IS NULL)
      AND (CAST(:sem_dias AS int) IS NULL OR c.ultimo_contato_em IS NULL
           OR {DIA_DO_CONTATO} < CAST(:hoje AS date) - CAST(:sem_dias AS int))
"""

# As empresas do recorte (sem busca nem "incluir só em atraso") e os títulos delas: o resumo
# conta em cima de `tr`. Sem filtro de empresa ativo, `tr` é `t` inteiro.
SQL_RECORTE = f"""
, recorte AS (
    SELECT e.*, c.status AS ciclo_status, c.promessa_data
    FROM empresas e
    LEFT JOIN tiny.cobranca_ciclos c ON c.empresa = e.empresa AND c.encerrado_em IS NULL
    WHERE TRUE {FILTROS_DE_EMPRESA}
),
tr AS (
    SELECT * FROM t WHERE NOT CAST(:restringe AS boolean) OR empresa IN (SELECT empresa FROM recorte)
)
"""

SQL_RESUMO = """
SELECT
    COALESCE(sum(saldo) FILTER (WHERE em_aberto), 0)                         AS total_a_receber,
    COALESCE(sum(saldo) FILTER (WHERE atraso > 0), 0)                        AS total_vencido,
    COALESCE(sum(saldo) FILTER (WHERE atraso BETWEEN 1 AND CAST(:carencia AS int)), 0) AS em_atraso,
    COALESCE(sum(saldo) FILTER (WHERE atraso > CAST(:carencia AS int)), 0)   AS inadimplente,
    count(*) FILTER (WHERE atraso > 0)                                       AS titulos_vencidos,
    count(*) FILTER (WHERE atraso > CAST(:carencia AS int))                  AS titulos_inadimplentes,
    count(DISTINCT empresa) FILTER (WHERE atraso > CAST(:carencia AS int))   AS empresas_inadimplentes
FROM tr
"""

# A safra inteira: o que passou de 30 dias (estritamente) sem pagar, na história; pago no dia 30
# ainda é em dia, e 30 dias de atraso ainda é atraso, como nas faixas. É o histórico todo: roda
# com os parâmetros SEM filtro, e por isso o "recuperado" não segue os filtros da tela.
SQL_SAFRA = """
SELECT COALESCE(sum(saldo) FILTER (WHERE atraso > CAST(:carencia AS int)), 0) AS inadimplente,
       COALESCE(sum(CASE WHEN em_aberto THEN saldo
                         WHEN liquidacao > vencimento + CAST(:carencia AS int) THEN valor
                         ELSE 0 END)
                FILTER (WHERE vencimento + CAST(:carencia AS int) < CAST(:hoje AS date)), 0)
                                                                              AS safra_inadimplente
FROM t
"""

SQL_FAIXA = """
SELECT count(*) AS titulos, count(DISTINCT empresa) AS empresas, COALESCE(sum(saldo), 0) AS valor
FROM tr
WHERE atraso >= CAST(:lo AS int) AND (CAST(:hi AS int) IS NULL OR atraso <= CAST(:hi AS int))
"""

SQL_CONTAGEM_COBRANCA = """
SELECT
    count(*) FILTER (WHERE valor_inadimplente > 0
                     AND COALESCE(ciclo_status, 'sem_contato') = 'sem_contato') AS sem_contato,
    count(*) FILTER (WHERE ciclo_status = 'promessa'
                     AND promessa_data BETWEEN CAST(:hoje AS date)
                                           AND CAST(:hoje AS date) + 7)       AS promessas_7_dias,
    count(*) FILTER (WHERE ciclo_status = 'quebrada')                         AS promessas_quebradas,
    count(*) FILTER (WHERE ciclo_status = 'negociacao')                       AS em_negociacao
FROM recorte
"""


def resumo(db: Session, hoje: date, *, status: Optional[List[str]] = None, faixa: Optional[str] = None,
           data_tipo: Optional[str] = None, data_inicio: Optional[date] = None,
           data_fim: Optional[date] = None, sem_contato: Optional[str] = None) -> ResumoDeInadimplencia:
    """Os cards. Seguem os filtros da lista, menos a busca por nome. A barra de faixas ignora o
    filtro de faixa (senão escolher uma zeraria as outras); o recuperado ignora todos."""
    recorte = dict(status=status, faixa=faixa, data_tipo=data_tipo, data_inicio=data_inicio,
                   data_fim=data_fim, sem_contato=sem_contato)
    p = params_do_recorte(hoje, **recorte)
    base = SQL_BASE + SQL_RECORTE
    linha = db.execute(text(base + SQL_RESUMO), p).mappings().one()
    cobranca = db.execute(text(base + SQL_CONTAGEM_COBRANCA), p).mappings().one()
    safra = db.execute(text(SQL_BASE + SQL_SAFRA), params_base(hoje)).mappings().one()

    pf = params_do_recorte(hoje, **{**recorte, "faixa": None})
    faixas = []
    for nome, (lo, hi) in FAIXAS.items():
        f = db.execute(text(base + SQL_FAIXA), {**pf, "lo": lo, "hi": hi}).mappings().one()
        faixas.append(Faixa(faixa=nome, titulos=f["titulos"], empresas=f["empresas"],
                            valor=float(f["valor"])))

    total = float(linha["total_a_receber"])
    inad = float(linha["inadimplente"])
    inad_global = float(safra["inadimplente"])
    safra_global = float(safra["safra_inadimplente"])
    return ResumoDeInadimplencia(
        total_a_receber=total,
        total_vencido=float(linha["total_vencido"]),
        em_atraso=float(linha["em_atraso"]),
        inadimplente=inad,
        inadimplencia_carteira=(inad / total) if total else 0.0,
        recuperado=(1 - inad_global / safra_global) if safra_global else None,
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

SQL_LISTA = f"""
, lista AS (
    SELECT e.*,
           {STATUS_DA_EMPRESA} AS status,
           c.promessa_data      AS proxima_data,
           c.ultimo_contato_em  AS ultimo_contato
    FROM empresas e
    LEFT JOIN tiny.cobranca_ciclos c ON c.empresa = e.empresa AND c.encerrado_em IS NULL
    WHERE (CAST(:incluir_atraso AS boolean) OR e.valor_inadimplente > 0)
      {FILTROS_DE_EMPRESA}
      AND (CAST(:busca AS text) IS NULL
           OR lower(e.nome) LIKE '%' || lower(CAST(:busca AS text)) || '%'
           OR (length(regexp_replace(CAST(:busca AS text), '[^0-9]', '', 'g')) >= 3
               AND EXISTS (SELECT 1 FROM t WHERE t.empresa = e.empresa
                   AND t.doc LIKE '%' || regexp_replace(CAST(:busca AS text), '[^0-9]', '', 'g') || '%'))
           OR EXISTS (SELECT 1 FROM t WHERE t.empresa = e.empresa
                   AND lower(t.cliente_nome) LIKE '%' || lower(CAST(:busca AS text)) || '%'))
)
"""


def pagina_de_empresas(db: Session, hoje: date, *, busca: Optional[str], status: Optional[List[str]],
                       faixa: Optional[str], incluir_atraso: bool, ordenar_por: str, direcao: str,
                       limite: int, offset: int, data_tipo: Optional[str] = None,
                       data_inicio: Optional[date] = None, data_fim: Optional[date] = None,
                       sem_contato: Optional[str] = None) -> PaginaDeEmpresas:
    p = {**params_do_recorte(hoje, status=status, faixa=faixa, data_tipo=data_tipo,
                             data_inicio=data_inicio, data_fim=data_fim, sem_contato=sem_contato),
         "busca": (busca or "").strip() or None, "incluir_atraso": incluir_atraso}
    total = db.execute(text(SQL_BASE + SQL_LISTA + "SELECT count(*) FROM lista"), p).scalar_one()
    # `direcao` entra no ORDER BY, que não aceita bind param: só ASC ou DESC chegam ao SQL.
    d = "DESC" if str(direcao).lower() == "desc" else "ASC"
    ordem = ORDENACOES_DE_EMPRESAS[ordenar_por].format(d=d)
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
        {**params_base(hoje_na_empresa()), "empresa": empresa},
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


class OpcoesDosFiltros(BaseModel):
    categorias: List[str]
    formas_pagamento: List[str]
    ufs: List[str]


class Indicadores(BaseModel):
    mensal: List[MesDeTaxa]
    anual: List[AnoDeTaxa]
    total: PontoDeTaxa
    desde: Optional[date]
    ultimo_fechado: Optional[MesDeTaxa]
    media_12_meses: Optional[float]
    opcoes: OpcoesDosFiltros


# As opções dos selects saem da base inteira, SEM os filtros: escolher uma categoria não pode
# sumir com as outras do select. Nulo e vazio ficam de fora — a tela acrescenta "Sem …" (`__sem__`).
SQL_OPCOES = """
SELECT array_agg(DISTINCT trim(categoria)) FILTER (WHERE trim(categoria) <> '')             AS categorias,
       array_agg(DISTINCT trim(forma_pagamento)) FILTER (WHERE trim(forma_pagamento) <> '') AS formas_pagamento,
       array_agg(DISTINCT trim(cliente_uf)) FILTER (WHERE trim(cliente_uf) <> '')           AS ufs
FROM tiny.contas_receber
WHERE excluida_na_origem_em IS NULL
  AND lower(COALESCE(situacao, '')) <> ALL(CAST(:canceladas AS text[]))
"""


SQL_MADUROS = """
, maduros AS (
    SELECT vencimento, valor,
           CASE WHEN em_aberto THEN saldo
                WHEN liquidacao > vencimento + CAST(:carencia AS int) THEN valor
                ELSE 0 END AS inad
    FROM t
    WHERE vencimento + CAST(:carencia AS int) < CAST(:hoje AS date)
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


def opcoes_dos_filtros(db: Session) -> OpcoesDosFiltros:
    l = db.execute(text(SQL_OPCOES), {"canceladas": SITUACOES_CANCELADAS}).mappings().one()
    return OpcoesDosFiltros(**{k: sorted(v or []) for k, v in l.items()})


def indicadores(db: Session, hoje: date, *, mes_inicio: Optional[str] = None, mes_fim: Optional[str] = None,
                categoria: Optional[List[str]] = None, forma_pagamento: Optional[List[str]] = None,
                uf: Optional[List[str]] = None, cliente: Optional[str] = None) -> Indicadores:
    """A taxa de safra no recorte de títulos pedido. Sem período, a série mensal são os últimos
    `MESES_NA_SERIE` meses; com período, são os meses dele, sem teto (o recorte já está nos títulos)."""
    p = params_de_titulos(hoje, mes_inicio=mes_inicio, mes_fim=mes_fim, categoria=categoria,
                          forma_pagamento=forma_pagamento, uf=uf, cliente=cliente)
    if p["tit_ini"] is not None or p["tit_fim"] is not None:
        p["inicio_serie"] = None
    else:
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
                + CAST(:carencia AS int) * interval '1 day') >= CAST(:hoje AS date) AS em_apuracao,
               {_SOMAS}
        FROM maduros
        WHERE CAST(:inicio_serie AS date) IS NULL OR vencimento >= CAST(:inicio_serie AS date)
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
        opcoes=opcoes_dos_filtros(db),
    )
