"""Inadimplência: a página de cobrança e indicadores do financeiro.

Todas as rotas exigem admin ou financeiro NO BACKEND — a tela também esconde, mas a
regra não pode morar só nela. Spec: docs/superpowers/specs/2026-10-09-inadimplencia-design.md
"""
import logging
from datetime import date, datetime
from typing import List, Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from starlette.datastructures import UploadFile
from starlette.exceptions import HTTPException as ErroDoStarlette

from app.core import inadimplencia as consultas
from app.core.inadimplencia import hoje_na_empresa
from app.core.contas_agregado import ContaDaTela
from app.core.paginacao import limite_query, offset_query
from app.core.security import exigir_papeis
from app.models.database import SessionLocal
from app.models.usuario import Usuario
from app.services import anexos, cobranca

log = logging.getLogger(__name__)

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


class DetalheComEventoNovo(consultas.DetalheDaEmpresa):
    #: o evento que acabou de ser gravado — pela ordem da linha do tempo (data do contato)
    #: ele nem sempre é o primeiro, e a tela precisa do id para mandar os anexos.
    evento_id: int


@router.post("/empresas/{empresa}/eventos", response_model=DetalheComEventoNovo)
def registrar_evento(empresa: str, dados: cobranca.NovoEvento, db: Session = Depends(get_db),
                     usuario: Usuario = Depends(FINANCEIRO)):
    try:
        evento_id = cobranca.registrar_evento(db, hoje_na_empresa(), empresa, dados, usuario.username)
        db.commit()
    except cobranca.ErroDeCobranca as erro:
        db.rollback()
        raise HTTPException(erro.status_code, str(erro))
    return DetalheComEventoNovo(**_detalhe_ou_404(db, empresa).model_dump(), evento_id=evento_id)


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


# ─────────────────────────────────────────────────────────────── anexos

class AnexoCriado(BaseModel):
    id: int
    nome_original: str
    tipo: str
    tamanho: int
    enviado_por: str
    enviado_em: datetime


#: Teto do corpo inteiro do envio: 5 arquivos de 10 MB e folga para o envelope multipart.
#: Checado no Content-Length ANTES de ler — o Starlette grava o multipart inteiro em
#: arquivo temporário antes de a rota ver o primeiro byte, e não limita o tamanho de arquivo.
TETO_DO_PEDIDO = anexos.MAXIMO_POR_EVENTO * anexos.TAMANHO_MAXIMO + 1024 * 1024


async def _arquivos_do_pedido(request: Request):
    """O campo `arquivos` do multipart, com teto de tamanho e de quantidade antes de ler."""
    declarado = request.headers.get("content-length", "")
    if not declarado.isdigit():
        # sem Content-Length (chunked) não dá para saber o tamanho sem ler tudo
        raise HTTPException(411, "Envio sem tamanho declarado (Content-Length).")
    if int(declarado) > TETO_DO_PEDIDO:
        raise HTTPException(413, f"O envio passa do limite de {anexos.MAXIMO_POR_EVENTO} arquivos de 10 MB.")
    try:
        form = await request.form(max_files=anexos.MAXIMO_POR_EVENTO, max_fields=anexos.MAXIMO_POR_EVENTO)
    except ErroDoStarlette:
        raise HTTPException(422, f"No máximo {anexos.MAXIMO_POR_EVENTO} anexos por contato.")
    try:
        yield [a for a in form.getlist("arquivos") if isinstance(a, UploadFile)]
    finally:
        await form.close()


@router.post("/eventos/{evento_id}/anexos", response_model=List[AnexoCriado])
def enviar_anexos(evento_id: int, db: Session = Depends(get_db), usuario: Usuario = Depends(FINANCEIRO),
                  arquivos: List[UploadFile] = Depends(_arquivos_do_pedido)):
    """Multipart com o campo `arquivos` repetido (1 a 5): JPG, PNG, WebP ou PDF, até 10 MB cada.
    O corpo é lido por `_arquivos_do_pedido`, com teto, e não pelo `File()` do FastAPI."""
    recebidos = [anexos.ArquivoRecebido(nome=a.filename or "", conteudo=a.file) for a in arquivos]
    gravados: List[str] = []
    try:
        criados, gravados = anexos.enviar(db, evento_id, recebidos, usuario.username)
        db.commit()
    except cobranca.ErroDeCobranca as erro:
        db.rollback()
        raise HTTPException(erro.status_code, str(erro))
    except BaseException:
        # o commit falhou depois de os arquivos estarem no disco: sem linha, sem arquivo
        db.rollback()
        anexos.remover_arquivos(gravados)
        raise
    return criados


@router.get("/anexos/{anexo_id}")
def baixar_anexo(anexo_id: int, db: Session = Depends(get_db), _u: Usuario = Depends(FINANCEIRO)):
    try:
        arquivo, linha = anexos.anexo_para_baixar(db, anexo_id)
    except cobranca.ErroDeCobranca as erro:
        raise HTTPException(erro.status_code, str(erro))
    # inline para a imagem e o PDF abrirem no navegador; nosniff para ele não "adivinhar" outro tipo
    return FileResponse(arquivo, media_type=linha["tipo"], headers={
        "Content-Disposition": "inline; filename*=UTF-8''" + quote(linha["nome_original"], safe=""),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
    })


@router.delete("/anexos/{anexo_id}", status_code=204)
def apagar_anexo(anexo_id: int, db: Session = Depends(get_db), usuario: Usuario = Depends(FINANCEIRO)):
    try:
        caminho = anexos.apagar(db, anexo_id, usuario.username)
        db.commit()
    except cobranca.ErroDeCobranca as erro:
        db.rollback()
        raise HTTPException(erro.status_code, str(erro))
    # Depois do commit: se ele falhasse com o arquivo já apagado, o anexo ficaria quebrado.
    try:
        anexos.remover_arquivos([caminho])
    except OSError:
        log.exception("Anexo %s marcado como apagado, mas o arquivo ficou no disco.", anexo_id)
    return Response(status_code=204)
