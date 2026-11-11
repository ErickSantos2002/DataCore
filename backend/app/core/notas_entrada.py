"""Notas de entrada: a regra de o que é entrada, e as consultas da aba do Financeiro.

## O que é nota de entrada

**Nota com algum item de CFOP iniciado em 1, 2 ou 3** (entrada estadual, interestadual
e do exterior). Não use `notas_fiscais.tipo_nota`: ele grava "N" até em nota de compra,
e "E" só em 65 das 341 notas que o Tiny lista como entrada. Medido em 11/11/2026: pelo
CFOP saem 340 notas e R$ 17.422.702,11, contra 341 e R$ 17.425.352,11 da tela do Tiny.
Os grupos batem (172 emitidas, 144 registradas, 8 canceladas); a que falta é uma
pendente que não veio na extração.

O CFOP vem do item, igual à régua de venda do dbt (`analytics/models/silver/vendas.sql`):
é o campo estruturado; a natureza da operação é texto livre.

## Tipo de entrada

Pelos três últimos dígitos do CFOP de entrada da nota (o menor, se houver mais de um):
compra (x101, x102, x551–x556), devolução de venda (x201–x204, x410, x411),
conserto/reparo (x915, x916) e outras. Importação é a nota com CFOP 3xxx — uma
compra do exterior, marcada à parte em `importacao`.

## Remetente

O nome vem de `tiny.clientes`. ⚠️ As notas de importação antigas apontam todas para
um único cadastro sem CNPJ (o sistema anterior juntava os estrangeiros); o nome real
não está no banco, então elas saem como "Exterior — remetente não identificado".

## Situação

Os mesmos grupos das abas do Tiny: emitida (6 autorizada, 7 emitida DANFE),
registrada (8, XML de fornecedor lançado), cancelada (3) e pendente (o resto:
pendente, rejeitada, denegada…). Sem filtro de situação, a cancelada fica de fora,
como no faturamento.
"""
from datetime import date
from typing import List, Optional

from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

TIPOS = ("compra", "devolucao", "conserto", "outras")
SITUACOES = ("emitida", "registrada", "pendente", "cancelada")
SITUACOES_PADRAO = ("emitida", "registrada", "pendente")
ORDENACOES = {
    "data_emissao": "data_emissao",
    "valor": "valor",
    "numero": "numero",
    "remetente": "remetente",
}

# A nota de entrada já classificada: uma linha por nota. Toda consulta parte daqui.
_NOTAS = r"""
with itens as (
    select id_nota, regexp_replace(coalesce(cfop, ''), '\D', '', 'g') as cfop
    from tiny.itens_nota
),
entrada as (
    select id_nota, min(cfop) as cfop, bool_or(left(cfop, 1) = '3') as importacao
    from itens
    where left(cfop, 1) in ('1', '2', '3')
    group by id_nota
),
notas as (
    select
        n.id,
        n.numero,
        n.serie,
        n.data_emissao,
        coalesce(n.valor_nota, 0) as valor,
        n.natureza_operacao,
        n.chave_acesso,
        n.descricao_situacao,
        -- Cadastro sem CNPJ não identifica ninguém: o sistema antigo juntou todo
        -- remetente estrangeiro num cadastro só (o nome dele é o do último que entrou).
        case
            when nullif(btrim(c.cpf_cnpj), '') is null and c.uf = 'EX'
                then 'Exterior — remetente não identificado'
            when nullif(btrim(c.cpf_cnpj), '') is null then '(sem remetente)'
            else coalesce(nullif(btrim(c.nome), ''), '(sem remetente)')
        end as remetente,
        nullif(btrim(c.cpf_cnpj), '') as cpf_cnpj,
        c.uf,
        e.cfop,
        e.importacao,
        case
            when right(e.cfop, 3) in ('101', '102', '551', '552', '553', '554', '555', '556')
                then 'compra'
            when right(e.cfop, 3) in ('201', '202', '203', '204', '410', '411') then 'devolucao'
            when right(e.cfop, 3) in ('915', '916') then 'conserto'
            else 'outras'
        end as tipo,
        case
            when n.situacao::text in ('6', '7') then 'emitida'
            when n.situacao::text = '8' then 'registrada'
            when n.situacao::text = '3' then 'cancelada'
            else 'pendente'
        end as situacao
    from tiny.notas_fiscais n
    join entrada e on e.id_nota = n.id
    left join tiny.clientes c on c.id = n.id_cliente
)
"""


class Recorte(BaseModel):
    data_inicio: Optional[date] = None
    data_fim: Optional[date] = None
    situacao: Optional[List[str]] = None
    tipo: Optional[List[str]] = None
    importacao: Optional[bool] = None
    busca: Optional[str] = None


def _filtro(r: Recorte, *, com_situacao: bool = True) -> tuple[str, dict]:
    condicoes, p = [], {}
    if r.data_inicio:
        condicoes.append("data_emissao >= :data_inicio")
        p["data_inicio"] = r.data_inicio
    if r.data_fim:
        condicoes.append("data_emissao <= :data_fim")
        p["data_fim"] = r.data_fim
    if com_situacao:
        condicoes.append("situacao = any(:situacao)")
        p["situacao"] = list(r.situacao or SITUACOES_PADRAO)
    if r.tipo:
        condicoes.append("tipo = any(:tipo)")
        p["tipo"] = list(r.tipo)
    if r.importacao is not None:
        condicoes.append("importacao = :importacao")
        p["importacao"] = r.importacao
    if r.busca and r.busca.strip():
        condicoes.append(
            "(remetente ilike :busca or numero ilike :busca or cpf_cnpj ilike :busca"
            " or natureza_operacao ilike :busca)"
        )
        p["busca"] = f"%{r.busca.strip()}%"
    return (" where " + " and ".join(condicoes)) if condicoes else "", p


# ───────────────────────────────────────────────────────────────────── resumo


class PorTipo(BaseModel):
    tipo: str
    quantidade: int
    valor: float


class PorMes(BaseModel):
    mes: str  # AAAA-MM
    quantidade: int
    valor: float


class PorRemetente(BaseModel):
    remetente: str
    uf: Optional[str]
    quantidade: int
    valor: float


class PorSituacao(BaseModel):
    situacao: str
    quantidade: int


class ResumoDeEntradas(BaseModel):
    quantidade: int
    valor_total: float
    remetentes: int
    importacao_quantidade: int
    importacao_valor: float
    por_tipo: List[PorTipo]
    por_mes: List[PorMes]
    maiores_remetentes: List[PorRemetente]
    #: Contagem por situação no recorte, ignorando o filtro de situação — as "abas" do Tiny.
    por_situacao: List[PorSituacao]


def resumo(db: Session, r: Recorte) -> ResumoDeEntradas:
    onde, p = _filtro(r)

    kpi = db.execute(text(_NOTAS + f"""
        select count(*) as quantidade, coalesce(sum(valor), 0) as valor_total,
               count(distinct coalesce(cpf_cnpj, remetente)) as remetentes,
               count(*) filter (where importacao) as importacao_quantidade,
               coalesce(sum(valor) filter (where importacao), 0) as importacao_valor
        from notas {onde}
    """), p).mappings().one()

    tipos = {
        linha["tipo"]: linha
        for linha in db.execute(text(_NOTAS + f"""
            select tipo, count(*) as quantidade, coalesce(sum(valor), 0) as valor
            from notas {onde} group by tipo
        """), p).mappings()
    }

    meses = db.execute(text(_NOTAS + f"""
        select to_char(date_trunc('month', data_emissao), 'YYYY-MM') as mes,
               count(*) as quantidade, coalesce(sum(valor), 0) as valor
        from notas {onde} {'and' if onde else 'where'} data_emissao is not null
        group by 1 order by 1
    """), p).mappings().all()

    remetentes = db.execute(text(_NOTAS + f"""
        select min(remetente) as remetente, min(uf) as uf,
               count(*) as quantidade, coalesce(sum(valor), 0) as valor
        from notas {onde}
        group by coalesce(cpf_cnpj, remetente)
        order by valor desc, remetente
        limit 10
    """), p).mappings().all()

    onde_s, p_s = _filtro(r, com_situacao=False)
    situacoes = {
        linha["situacao"]: linha["quantidade"]
        for linha in db.execute(text(_NOTAS + f"""
            select situacao, count(*) as quantidade from notas {onde_s} group by situacao
        """), p_s).mappings()
    }

    return ResumoDeEntradas(
        quantidade=kpi["quantidade"],
        valor_total=float(kpi["valor_total"]),
        remetentes=kpi["remetentes"],
        importacao_quantidade=kpi["importacao_quantidade"],
        importacao_valor=float(kpi["importacao_valor"]),
        por_tipo=[
            PorTipo(
                tipo=t,
                quantidade=tipos[t]["quantidade"] if t in tipos else 0,
                valor=float(tipos[t]["valor"]) if t in tipos else 0.0,
            )
            for t in TIPOS
        ],
        por_mes=[PorMes(mes=m["mes"], quantidade=m["quantidade"], valor=float(m["valor"])) for m in meses],
        maiores_remetentes=[
            PorRemetente(remetente=x["remetente"], uf=x["uf"], quantidade=x["quantidade"], valor=float(x["valor"]))
            for x in remetentes
        ],
        por_situacao=[PorSituacao(situacao=s, quantidade=situacoes.get(s, 0)) for s in SITUACOES],
    )


# ───────────────────────────────────────────────────────────────────── página


class NotaDeEntrada(BaseModel):
    id: int
    numero: Optional[str]
    serie: Optional[str]
    data_emissao: Optional[date]
    remetente: str
    cpf_cnpj: Optional[str]
    uf: Optional[str]
    tipo: str
    importacao: bool
    situacao: str
    descricao_situacao: Optional[str]
    natureza_operacao: Optional[str]
    cfop: str
    chave_acesso: Optional[str]
    valor: float


class PaginaDeEntradas(BaseModel):
    itens: List[NotaDeEntrada]
    total: int
    limite: int
    offset: int


def pagina(db: Session, r: Recorte, *, ordenar_por: str, direcao: str, limite: int, offset: int) -> PaginaDeEntradas:
    onde, p = _filtro(r)
    coluna = ORDENACOES[ordenar_por]  # validado no endpoint; nunca texto do usuário no SQL
    sentido = "desc" if direcao == "desc" else "asc"
    total = db.execute(text(_NOTAS + f"select count(*) from notas {onde}"), p).scalar_one()
    linhas = db.execute(text(_NOTAS + f"""
        select * from notas {onde}
        order by {coluna} {sentido} nulls last, id {sentido}
        limit :limite offset :offset
    """), {**p, "limite": limite, "offset": offset}).mappings().all()
    itens = [NotaDeEntrada(**{**linha, "valor": float(linha["valor"])}) for linha in linhas]
    return PaginaDeEntradas(itens=itens, total=total, limite=limite, offset=offset)


# ───────────────────────────────────────────────────────────────────── itens


class ItemDaEntrada(BaseModel):
    id: int
    codigo: Optional[str]
    descricao: Optional[str]
    unidade: Optional[str]
    ncm: Optional[str]
    cfop: Optional[str]
    quantidade: float
    valor_unitario: float
    valor_total: float


def itens(db: Session, id_nota: int) -> Optional[List[ItemDaEntrada]]:
    """Os itens da nota, ou None se ela não é nota de entrada."""
    existe = db.execute(text(_NOTAS + "select 1 from notas where id = :id"), {"id": id_nota}).first()
    if not existe:
        return None
    linhas = db.execute(text("""
        select id, codigo, descricao, unidade, ncm, cfop,
               coalesce(quantidade, 0) as quantidade,
               coalesce(valor_unitario, 0) as valor_unitario,
               coalesce(valor_total, 0) as valor_total
        from tiny.itens_nota where id_nota = :id order by id
    """), {"id": id_nota}).mappings().all()
    return [
        ItemDaEntrada(**{**x, "quantidade": float(x["quantidade"]), "valor_unitario": float(x["valor_unitario"]),
                         "valor_total": float(x["valor_total"])})
        for x in linhas
    ]
