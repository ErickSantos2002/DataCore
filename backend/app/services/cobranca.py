"""Cobrança da inadimplência: o que o financeiro registra e o que o sistema faz sozinho.

Nenhuma função aqui faz commit — quem chama decide (a rota, ou o job de contas).
Spec: docs/superpowers/specs/2026-10-09-inadimplencia-design.md
"""
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.inadimplencia import (
    FUSO_DA_EMPRESA,
    SQL_BASE,
    filiais_da_empresa,
    params_base,
    valores_da_empresa,
)

STATUS_DO_SISTEMA = {"sem_contato", "quebrada", "pago"}
STATUS_MANUAIS = {"em_contato", "respondeu", "promessa", "negociacao", "contestado", "juridico", "perda"}
CANAIS = {"telefone", "email", "whatsapp", "presencial", "outro"}
SISTEMA = "sistema"


class ErroDeCobranca(Exception):
    def __init__(self, mensagem: str, status_code: int = 422):
        super().__init__(mensagem)
        self.status_code = status_code


class Promessa(BaseModel):
    data: date
    valor: Optional[float] = Field(None, gt=0)
    condicoes: Optional[str] = Field(None, max_length=1000)


class NovoEvento(BaseModel):
    ocorrido_em: datetime
    canal: Optional[str] = None
    filial_cnpj: Optional[str] = None
    status_novo: Optional[str] = None
    promessa: Optional[Promessa] = None
    anotacao: Optional[str] = None

    @field_validator("ocorrido_em")
    @classmethod
    def _com_fuso(cls, v):
        # sem fuso na entrada, vale o horário de Brasília (o da empresa)
        return v.replace(tzinfo=FUSO_DA_EMPRESA) if v.tzinfo is None else v

    @field_validator("anotacao")
    @classmethod
    def _tamanho(cls, v):
        if v is None:
            return None
        # o limite de 4.000 é checado em registrar_evento, para o 422 sair em português
        return v.strip() or None


def _evento(db, ciclo_id, *, por, tipo, ocorrido_em=None, valor=None, **campos):
    db.execute(text("""
        INSERT INTO tiny.cobranca_eventos
            (ciclo_id, ocorrido_em, registrado_por, tipo, canal, filial_cnpj, status_anterior,
             status_novo, promessa_data, promessa_valor, promessa_condicoes, anotacao,
             valor_inadimplente)
        VALUES (:ciclo, :quando, :por, :tipo, :canal, :filial, :antes, :novo, :pd, :pv, :pc,
                :anotacao, :valor)
    """), {
        "ciclo": ciclo_id, "quando": ocorrido_em or datetime.now(timezone.utc), "por": por,
        "tipo": tipo, "canal": campos.get("canal"), "filial": campos.get("filial_cnpj"),
        "antes": campos.get("status_anterior"), "novo": campos.get("status_novo"),
        "pd": campos.get("promessa_data"), "pv": campos.get("promessa_valor"),
        "pc": campos.get("promessa_condicoes"), "anotacao": campos.get("anotacao"),
        "valor": valor,
    })


def _ciclo_aberto(db, empresa):
    return db.execute(text(
        "SELECT * FROM tiny.cobranca_ciclos WHERE empresa = :e AND encerrado_em IS NULL FOR UPDATE"
    ), {"e": empresa}).mappings().first()


def _abrir_ciclo(db, empresa, status, por):
    """Abre o ciclo; devolve None se outra execução abriu primeiro (índice de um aberto)."""
    return db.execute(text(
        "INSERT INTO tiny.cobranca_ciclos (empresa, status, aberto_por) VALUES (:e, :s, :p) "
        "ON CONFLICT (empresa) WHERE encerrado_em IS NULL DO NOTHING RETURNING id"
    ), {"e": empresa, "s": status, "p": por}).scalar_one_or_none()


def sincronizar(db: Session, hoje: date) -> dict:
    """Abre, fecha e quebra promessa — idempotente. Ordem: abre, fecha, quebra."""
    p = params_base(hoje)
    contagem = {"abertos": 0, "pagos": 0, "quebradas": 0}

    novos = db.execute(text(SQL_BASE + """
        SELECT e.empresa, e.valor_inadimplente, e.maior_atraso FROM empresas e
        WHERE e.valor_inadimplente > 0
          AND NOT EXISTS (SELECT 1 FROM tiny.cobranca_ciclos c
                          WHERE c.empresa = e.empresa AND c.encerrado_em IS NULL)
    """), p).mappings().all()
    for n in novos:
        ciclo = _abrir_ciclo(db, n["empresa"], "sem_contato", SISTEMA)
        if ciclo is None:
            continue
        _evento(db, ciclo, por=SISTEMA, tipo="sistema", status_novo="sem_contato",
                anotacao=f"Cobrança aberta: título com {n['maior_atraso']} dias de atraso.",
                valor=n["valor_inadimplente"])
        contagem["abertos"] += 1

    quitados = db.execute(text(SQL_BASE + """
        SELECT c.id, c.status FROM tiny.cobranca_ciclos c
        WHERE c.encerrado_em IS NULL
          AND NOT EXISTS (SELECT 1 FROM empresas e WHERE e.empresa = c.empresa)
    """), p).mappings().all()
    for c in quitados:
        fechado = db.execute(text(
            "UPDATE tiny.cobranca_ciclos SET status = 'pago', encerrado_em = now() "
            "WHERE id = :id AND encerrado_em IS NULL RETURNING id"
        ), {"id": c["id"]}).scalar_one_or_none()
        if fechado is None:
            continue
        _evento(db, c["id"], por=SISTEMA, tipo="sistema", status_anterior=c["status"],
                status_novo="pago", anotacao="Sem títulos vencidos no Tiny.", valor=0)
        contagem["pagos"] += 1

    quebradas = db.execute(text("""
        SELECT id, empresa, promessa_data, promessa_valor FROM tiny.cobranca_ciclos
        WHERE encerrado_em IS NULL AND status = 'promessa' AND promessa_data < CAST(:hoje AS date)
    """), p).mappings().all()
    for c in quebradas:
        valores = valores_da_empresa(db, hoje, c["empresa"]) or {}
        virou = db.execute(text(
            "UPDATE tiny.cobranca_ciclos SET status = 'quebrada' "
            "WHERE id = :id AND encerrado_em IS NULL AND status = 'promessa' "
            "AND promessa_data < CAST(:hoje AS date) RETURNING id"
        ), {"id": c["id"], "hoje": hoje}).scalar_one_or_none()
        if virou is None:
            continue
        _evento(db, c["id"], por=SISTEMA, tipo="sistema", status_anterior="promessa",
                status_novo="quebrada", promessa_data=c["promessa_data"],
                promessa_valor=c["promessa_valor"],
                anotacao=f"Promessa para {c['promessa_data']:%d/%m/%Y} venceu sem pagamento no Tiny.",
                valor=valores.get("valor_inadimplente"))
        contagem["quebradas"] += 1
    return contagem


def registrar_evento(db: Session, hoje: date, empresa: str, dados: NovoEvento, usuario: str) -> None:
    ciclo = _ciclo_aberto(db, empresa)
    valores = valores_da_empresa(db, hoje, empresa)
    if valores is None and ciclo is None:
        raise ErroDeCobranca("Empresa sem título vencido em aberto.", 404)

    if dados.anotacao is not None and len(dados.anotacao) > 4000:
        raise ErroDeCobranca("A anotação passa de 4.000 caracteres.")
    novo = dados.status_novo
    if novo in STATUS_DO_SISTEMA:
        raise ErroDeCobranca("Este status é posto pelo sistema, não à mão.")
    if novo is not None and novo not in STATUS_MANUAIS:
        raise ErroDeCobranca(f"Status desconhecido: {novo}.")
    if dados.canal is not None and dados.canal not in CANAIS:
        raise ErroDeCobranca(f"canal inválido: {dados.canal}.")
    if dados.canal is None and novo is None:
        raise ErroDeCobranca("Informe um canal ou um status.")
    if novo == "promessa" and dados.promessa is None:
        raise ErroDeCobranca("Promessa de pagamento precisa de data.")
    if dados.promessa is not None and novo != "promessa":
        raise ErroDeCobranca("Data prometida só com o status Promessa de pagamento.")
    if dados.promessa is not None and dados.promessa.data < hoje:
        raise ErroDeCobranca("A data prometida já passou.")
    if dados.ocorrido_em > datetime.now(timezone.utc) + timedelta(minutes=5):
        raise ErroDeCobranca("A data do contato está no futuro.")
    filial = "".join(c for c in (dados.filial_cnpj or "") if c.isdigit()) or None
    if filial is not None and filial not in filiais_da_empresa(db, empresa):
        raise ErroDeCobranca("Este CNPJ não é filial desta empresa.")

    if ciclo is None:
        id_ciclo = _abrir_ciclo(db, empresa, novo or "em_contato", usuario)
        anterior = None
        if id_ciclo is None:
            # outra chamada abriu o ciclo no meio: segue com ele
            ciclo = _ciclo_aberto(db, empresa)
            if ciclo is None:
                raise ErroDeCobranca("A cobrança desta empresa mudou agora há pouco. Tente de novo.", 409)
            id_ciclo = ciclo["id"]
            anterior = ciclo["status"]
    else:
        id_ciclo = ciclo["id"]
        anterior = ciclo["status"]

    if novo is None and dados.canal is not None and anterior in (None, "sem_contato"):
        novo = "em_contato"
    status = novo or anterior

    promessa = dados.promessa
    manter_promessa = status in ("promessa", "quebrada") and promessa is None and ciclo is not None
    db.execute(text("""
        UPDATE tiny.cobranca_ciclos SET
            status = :status,
            promessa_data = :pd, promessa_valor = :pv, promessa_condicoes = :pc,
            ultimo_contato_em = CASE WHEN CAST(:contato AS boolean)
                                     THEN GREATEST(ultimo_contato_em, CAST(:quando AS timestamptz))
                                     ELSE ultimo_contato_em END
        WHERE id = :id
    """), {
        "id": id_ciclo, "status": status, "contato": dados.canal is not None,
        "quando": dados.ocorrido_em,
        "pd": promessa.data if promessa else (ciclo["promessa_data"] if manter_promessa else None),
        "pv": promessa.valor if promessa else (ciclo["promessa_valor"] if manter_promessa else None),
        "pc": promessa.condicoes if promessa else (ciclo["promessa_condicoes"] if manter_promessa else None),
    })
    _evento(db, id_ciclo, por=usuario, tipo="contato" if dados.canal else "status",
            ocorrido_em=dados.ocorrido_em, canal=dados.canal, filial_cnpj=filial,
            status_anterior=anterior if novo else None, status_novo=novo,
            promessa_data=promessa.data if promessa else None,
            promessa_valor=promessa.valor if promessa else None,
            promessa_condicoes=promessa.condicoes if promessa else None,
            anotacao=dados.anotacao,
            valor=(valores or {}).get("valor_inadimplente"))


def gravar_observacao(db: Session, empresa: str, texto: str, usuario: str) -> None:
    texto = (texto or "").strip()
    if len(texto) > 4000:
        raise ErroDeCobranca("A observação passa de 4.000 caracteres.")
    antes = db.execute(text("SELECT observacao FROM tiny.cobranca_empresas WHERE empresa = :e"),
                       {"e": empresa}).scalar()
    if texto:
        db.execute(text("""
            INSERT INTO tiny.cobranca_empresas (empresa, observacao, alterado_por) VALUES (:e, :t, :u)
            ON CONFLICT (empresa) DO UPDATE SET observacao = :t, alterado_por = :u, alterado_em = now()
        """), {"e": empresa, "t": texto, "u": usuario})
    else:
        db.execute(text("DELETE FROM tiny.cobranca_empresas WHERE empresa = :e"), {"e": empresa})
    ciclo = _ciclo_aberto(db, empresa)
    if ciclo is not None and antes:
        _evento(db, ciclo["id"], por=usuario, tipo="observacao", anotacao=f"Antes: {antes}")
    elif ciclo is not None and texto:
        _evento(db, ciclo["id"], por=usuario, tipo="observacao", anotacao="Observação criada.")
