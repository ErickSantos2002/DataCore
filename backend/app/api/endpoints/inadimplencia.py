"""Inadimplência: a página de cobrança e indicadores do financeiro.

Todas as rotas exigem admin ou financeiro NO BACKEND — a tela também esconde, mas a
regra não pode morar só nela. Spec: docs/superpowers/specs/2026-10-09-inadimplencia-design.md
"""
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core import inadimplencia as consultas
from app.core.inadimplencia import hoje_na_empresa
from app.core.contas_agregado import ContaDaTela
from app.core.paginacao import limite_query, offset_query
from app.core.security import exigir_papeis
from app.models.database import SessionLocal
from app.models.usuario import Usuario
from app.services import cobranca

router = APIRouter(prefix="/inadimplencia", tags=["Inadimplência"])
FINANCEIRO = exigir_papeis("admin", "financeiro", mensagem="Acesso restrito ao financeiro.")
TODOS_OS_STATUS = cobranca.STATUS_DO_SISTEMA | cobranca.STATUS_MANUAIS


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _validar_recorte(status, faixa, data_tipo, data_inicio, data_fim, sem_contato) -> None:
    """Os filtros que a lista e o resumo compartilham; o erro é 422 com mensagem em português."""
    if faixa is not None and faixa not in consultas.FAIXAS:
        raise HTTPException(422, f"`faixa` deve ser uma de: {', '.join(consultas.FAIXAS)}.")
    if status and not set(status) <= TODOS_OS_STATUS:
        raise HTTPException(422, "Status desconhecido no filtro.")
    if data_tipo is not None and data_tipo not in consultas.TIPOS_DE_DATA:
        raise HTTPException(422, f"`data_tipo` deve ser um de: {', '.join(consultas.TIPOS_DE_DATA)}.")
    if data_inicio and data_fim and data_fim < data_inicio:
        raise HTTPException(422, "A data final não pode ser anterior à inicial.")
    if sem_contato is not None and sem_contato not in consultas.SEM_CONTATO:
        raise HTTPException(422, f"`sem_contato` deve ser um de: {', '.join(consultas.SEM_CONTATO)}.")


@router.get("/resumo", response_model=consultas.ResumoDeInadimplencia)
def resumo(
    status: Optional[List[str]] = Query(None),
    faixa: Optional[str] = Query(None),
    data_tipo: Optional[str] = Query(None),
    data_inicio: Optional[date] = Query(None),
    data_fim: Optional[date] = Query(None),
    sem_contato: Optional[str] = Query(None),
    db: Session = Depends(get_db), _u: Usuario = Depends(FINANCEIRO),
):
    _validar_recorte(status, faixa, data_tipo, data_inicio, data_fim, sem_contato)
    return consultas.resumo(db, hoje_na_empresa(), status=status, faixa=faixa, data_tipo=data_tipo,
                            data_inicio=data_inicio, data_fim=data_fim, sem_contato=sem_contato)


@router.get("/empresas", response_model=consultas.PaginaDeEmpresas)
def empresas(
    busca: Optional[str] = Query(None, max_length=120),
    status: Optional[List[str]] = Query(None),
    faixa: Optional[str] = Query(None),
    data_tipo: Optional[str] = Query(None),
    data_inicio: Optional[date] = Query(None),
    data_fim: Optional[date] = Query(None),
    sem_contato: Optional[str] = Query(None),
    incluir_atraso: bool = Query(False),
    ordenar_por: str = Query("valor"),
    direcao: str = Query("desc", pattern="^(asc|desc)$"),
    limite: int = limite_query(),
    offset: int = offset_query(),
    db: Session = Depends(get_db),
    _u: Usuario = Depends(FINANCEIRO),
):
    if ordenar_por not in consultas.ORDENACOES_DE_EMPRESAS:
        raise HTTPException(422, f"`ordenar_por` deve ser um de: {', '.join(consultas.ORDENACOES_DE_EMPRESAS)}.")
    _validar_recorte(status, faixa, data_tipo, data_inicio, data_fim, sem_contato)
    return consultas.pagina_de_empresas(
        db, hoje_na_empresa(), busca=busca, status=status, faixa=faixa, incluir_atraso=incluir_atraso,
        ordenar_por=ordenar_por, direcao=direcao, limite=limite, offset=offset, data_tipo=data_tipo,
        data_inicio=data_inicio, data_fim=data_fim, sem_contato=sem_contato)


def _detalhe_ou_404(db, empresa):
    d = consultas.detalhe_da_empresa(db, hoje_na_empresa(), empresa)
    if d is None:
        raise HTTPException(404, "Empresa sem título vencido em aberto.")
    return d


@router.get("/empresas/{empresa}", response_model=consultas.DetalheDaEmpresa)
def detalhe(empresa: str, db: Session = Depends(get_db), _u: Usuario = Depends(FINANCEIRO)):
    return _detalhe_ou_404(db, empresa)


@router.get("/empresas/{empresa}/titulos", response_model=List[ContaDaTela])
def titulos(empresa: str, db: Session = Depends(get_db), _u: Usuario = Depends(FINANCEIRO)):
    return consultas.titulos_da_empresa(db, hoje_na_empresa(), empresa)


@router.get("/indicadores", response_model=consultas.Indicadores)
def indicadores(
    mes_inicio: Optional[str] = Query(None, description="AAAA-MM: vencimento a partir do 1º dia deste mês."),
    mes_fim: Optional[str] = Query(None, description="AAAA-MM: vencimento até o último dia deste mês."),
    categoria: Optional[List[str]] = Query(None, description="`__sem__` = sem categoria."),
    forma_pagamento: Optional[List[str]] = Query(None, description="`__sem__` = sem forma de pagamento."),
    uf: Optional[List[str]] = Query(None, description="UF do cliente; `__sem__` = sem UF."),
    cliente: Optional[str] = Query(None, max_length=120, description="Nome, ou 8+ dígitos do documento."),
    db: Session = Depends(get_db), _u: Usuario = Depends(FINANCEIRO),
):
    try:
        consultas.intervalo_dos_meses(mes_inicio, mes_fim)
    except ValueError as erro:
        raise HTTPException(422, str(erro))
    return consultas.indicadores(db, hoje_na_empresa(), mes_inicio=mes_inicio, mes_fim=mes_fim,
                                 categoria=categoria, forma_pagamento=forma_pagamento, uf=uf, cliente=cliente)


class TextoDaObservacao(BaseModel):
    texto: str = ""


@router.post("/empresas/{empresa}/eventos", response_model=consultas.DetalheDaEmpresa)
def registrar_evento(empresa: str, dados: cobranca.NovoEvento, db: Session = Depends(get_db),
                     usuario: Usuario = Depends(FINANCEIRO)):
    try:
        cobranca.registrar_evento(db, hoje_na_empresa(), empresa, dados, usuario.username)
        db.commit()
    except cobranca.ErroDeCobranca as erro:
        db.rollback()
        raise HTTPException(erro.status_code, str(erro))
    return _detalhe_ou_404(db, empresa)


@router.put("/empresas/{empresa}/observacao", response_model=consultas.DetalheDaEmpresa)
def gravar_observacao(empresa: str, dados: TextoDaObservacao, db: Session = Depends(get_db),
                      usuario: Usuario = Depends(FINANCEIRO)):
    _detalhe_ou_404(db, empresa)
    try:
        cobranca.gravar_observacao(db, empresa, dados.texto, usuario.username)
        db.commit()
    except cobranca.ErroDeCobranca as erro:
        db.rollback()
        raise HTTPException(erro.status_code, str(erro))
    return _detalhe_ou_404(db, empresa)
