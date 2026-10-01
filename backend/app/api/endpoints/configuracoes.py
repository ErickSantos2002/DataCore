from datetime import date
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.configuracoes import ValorInvalido, normalizar
from app.core.security import exigir_admin
from app.models.configuracoes import Configuracao as ConfiguracaoModel
from app.models.configuracoes import ConfiguracaoHistorico
from app.models.database import SessionLocal
from app.models.usuario import Usuario
from app.schemas.configuracoes import (
    Configuracao,
    ConfiguracaoCreate,
    ConfiguracaoUpdate,
    HistoricoConfiguracao,
)

router = APIRouter(prefix="/configuracoes", tags=["Configurações"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _normalizar_ou_422(chave: str, valor: str) -> str:
    try:
        return normalizar(chave, valor, date.today())
    except ValorInvalido as erro:
        raise HTTPException(status_code=422, detail=str(erro))


@router.get("/", response_model=List[Configuracao])
def listar_configuracoes(db: Session = Depends(get_db)):
    return db.query(ConfiguracaoModel).all()


# Antes de GET /{chave}: senão o FastAPI lê "historico" como nome de chave.
@router.get("/historico", response_model=List[HistoricoConfiguracao])
def listar_historico(
    limite: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _admin: Usuario = Depends(exigir_admin),
):
    return (
        db.query(ConfiguracaoHistorico)
        .order_by(ConfiguracaoHistorico.alterado_em.desc(), ConfiguracaoHistorico.id.desc())
        .limit(limite)
        .all()
    )


@router.get("/{chave}", response_model=Configuracao)
def obter_configuracao(chave: str, db: Session = Depends(get_db)):
    config = db.query(ConfiguracaoModel).filter_by(chave=chave).first()
    if not config:
        raise HTTPException(status_code=404, detail="Configuração não encontrada")
    return config


@router.put("/{chave}", response_model=Configuracao)
def atualizar_configuracao(
    chave: str,
    dados: ConfiguracaoUpdate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(exigir_admin),
):
    config = db.query(ConfiguracaoModel).filter_by(chave=chave).first()
    if not config:
        raise HTTPException(status_code=404, detail="Configuração não encontrada")
    valor = _normalizar_ou_422(chave, dados.valor)
    # Mesmo valor não é alteração: o switch clicado duas vezes não polui o histórico.
    if valor != config.valor:
        db.add(ConfiguracaoHistorico(
            chave=chave, valor_anterior=config.valor, valor_novo=valor,
            alterado_por=usuario.username,
        ))
        config.valor = valor
        db.commit()  # alteração e histórico na mesma transação
        db.refresh(config)
    return config


@router.post("/", response_model=Configuracao)
def criar_configuracao(
    dados: ConfiguracaoCreate,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(exigir_admin),
):
    existente = db.query(ConfiguracaoModel).filter_by(chave=dados.chave).first()
    if existente:
        raise HTTPException(status_code=400, detail="Chave já existente")
    valor = _normalizar_ou_422(dados.chave, dados.valor)
    nova = ConfiguracaoModel(chave=dados.chave, valor=valor)
    db.add(nova)
    db.add(ConfiguracaoHistorico(
        chave=dados.chave, valor_anterior=None, valor_novo=valor,
        alterado_por=usuario.username,
    ))
    db.commit()
    db.refresh(nova)
    return nova
