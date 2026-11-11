"""Notas de entrada — a aba do Gerenciamento Financeiro.

A regra de o que é entrada (CFOP do item 1/2/3, não `tipo_nota`) e as consultas moram
em `core/notas_entrada.py`. Acesso: o mesmo da página Financeiro (usuários 1, 3 e 4).
Na `ROTAS_DO_AGENTE` desde 11/11/2026 (pedido do HS.OS): o Guardi de quem é da diretoria lê.
"""
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core import notas_entrada as consultas
from app.core import security as acesso  # papéis: espelho de permissoes.ts
from app.core.paginacao import limite_query, offset_query
from app.models.database import SessionLocal

router = APIRouter(prefix="/notas_entrada", tags=["Notas de Entrada"],
                   dependencies=[Depends(acesso.DIRETORIA)])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _recorte(
    data_inicio: Optional[date] = Query(None, description="Emissão a partir de (inclusive)"),
    data_fim: Optional[date] = Query(None, description="Emissão até (inclusive)"),
    situacao: Optional[List[str]] = Query(
        None, description="emitida, registrada, pendente, cancelada (repetível). Sem filtro: todas menos cancelada"
    ),
    tipo: Optional[List[str]] = Query(None, description="compra, devolucao, conserto, outras (repetível)"),
    importacao: Optional[bool] = Query(None, description="Só importação (true) ou só nacional (false)"),
    busca: Optional[str] = Query(None, max_length=120, description="Remetente, número, CNPJ ou natureza"),
) -> consultas.Recorte:
    if data_inicio and data_fim and data_fim < data_inicio:
        raise HTTPException(422, "`data_fim` não pode ser anterior a `data_inicio`.")
    if situacao and not set(situacao) <= set(consultas.SITUACOES):
        raise HTTPException(422, f"`situacao` deve ser uma de: {', '.join(consultas.SITUACOES)}.")
    if tipo and not set(tipo) <= set(consultas.TIPOS):
        raise HTTPException(422, f"`tipo` deve ser um de: {', '.join(consultas.TIPOS)}.")
    return consultas.Recorte(data_inicio=data_inicio, data_fim=data_fim, situacao=situacao,
                             tipo=tipo, importacao=importacao, busca=busca)


@router.get("/resumo", response_model=consultas.ResumoDeEntradas)
def resumo(recorte: consultas.Recorte = Depends(_recorte), db: Session = Depends(get_db)):
    """Indicadores, tipos, meses, maiores remetentes e contagem por situação do recorte."""
    return consultas.resumo(db, recorte)


@router.get("/pagina", response_model=consultas.PaginaDeEntradas)
def pagina(
    recorte: consultas.Recorte = Depends(_recorte),
    ordenar_por: str = Query("data_emissao"),
    direcao: str = Query("desc", pattern="^(asc|desc)$"),
    limite: int = limite_query(),
    offset: int = offset_query(),
    db: Session = Depends(get_db),
):
    if ordenar_por not in consultas.ORDENACOES:
        raise HTTPException(422, f"`ordenar_por` deve ser um de: {', '.join(consultas.ORDENACOES)}.")
    return consultas.pagina(db, recorte, ordenar_por=ordenar_por, direcao=direcao, limite=limite, offset=offset)


@router.get("/{id_nota}/itens", response_model=List[consultas.ItemDaEntrada])
def itens(id_nota: int, db: Session = Depends(get_db)):
    resultado = consultas.itens(db, id_nota)
    if resultado is None:
        raise HTTPException(404, "Nota de entrada não encontrada.")
    return resultado
