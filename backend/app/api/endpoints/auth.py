import secrets
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.core import microsoft, sso_tickets
from app.core.config import settings
from app.core.security import (
    PAPEL_ADMIN,
    criar_token,
    exigir_admin,
    gerar_hash_senha,
    logger,
    usuario_atual,
    verificar_senha,
)
from app.models.database import SessionLocal
from app.models.papel import Papel
from app.models.usuario import Usuario
from app.schemas.auth import (
    LoginEntrada,
    PapelOut,
    SsoStatus,
    TicketEntrada,
    TokenSaida,
    UsuarioAtualizar,
    UsuarioCriar,
    UsuarioOut,
    _normalizar_email,
)

# Substitui o authapi para o DataCoreHS. Caminhos e JSON iguais aos dele; o front
# só troca a base URL para .../auth.
router = APIRouter(prefix="/auth", tags=["Autenticação"])

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _buscar_papel(db: Session, nome: str) -> Papel:
    papel = db.query(Papel).filter(Papel.nome == nome).first()
    if not papel:
        raise HTTPException(status_code=400, detail=f"Role '{nome}' not found.")
    return papel


def _username_em_uso(db: Session, username: str, ignorar_id: Optional[int] = None) -> bool:
    query = db.query(Usuario.id).filter(func.lower(Usuario.username) == username)
    if ignorar_id is not None:
        query = query.filter(Usuario.id != ignorar_id)
    return query.first() is not None


def _email_em_uso(db: Session, email: str, ignorar_id: Optional[int] = None) -> bool:
    query = db.query(Usuario.id).filter(Usuario.email == email)
    if ignorar_id is not None:
        query = query.filter(Usuario.id != ignorar_id)
    return query.first() is not None


def _salvar(db: Session, usuario: Usuario) -> None:
    # As checagens acima cobrem o caso normal; isto cobre duas requisições
    # simultâneas com o mesmo username/e-mail.
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Username ou e-mail já cadastrado.")
    db.refresh(usuario)


# POST /auth/login
@router.post("/login", response_model=TokenSaida)
def login(dados: LoginEntrada, db: Session = Depends(get_db)):
    # LoginEntrada não valida o conteúdo (senha estranha é só senha errada); mas um
    # NUL no username quebra o bind do psycopg2 (ValueError -> 500), então barra
    # aqui como credencial inválida antes de tocar no banco.
    if "\x00" in dados.username:
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    usuario = db.query(Usuario).filter(func.lower(Usuario.username) == dados.username).first()
    if not usuario or not verificar_senha(dados.password, usuario.senha_hash):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    return TokenSaida(
        access_token=criar_token(usuario),
        token_type="bearer",
        role=usuario.papel.nome,
        username=usuario.username,
        user_id=usuario.id,
    )


# GET /auth/me
@router.get("/me", response_model=UsuarioOut)
def ler_me(atual: Usuario = Depends(usuario_atual)):
    return atual


# GET /auth/roles
@router.get("/roles", response_model=List[PapelOut])
def listar_papeis(db: Session = Depends(get_db), atual: Usuario = Depends(usuario_atual)):
    return db.query(Papel).order_by(Papel.id).all()


# GET /auth/users
@router.get("/users", response_model=List[UsuarioOut])
def listar_usuarios(db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    return db.query(Usuario).order_by(Usuario.id).all()


# GET /auth/users/{user_id} — admin vê qualquer um; os demais, só a si mesmos
@router.get("/users/{user_id}", response_model=UsuarioOut)
def obter_usuario(user_id: int, db: Session = Depends(get_db), atual: Usuario = Depends(usuario_atual)):
    if atual.papel.nome != PAPEL_ADMIN and atual.id != user_id:
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores.")
    usuario = db.get(Usuario, user_id)
    if not usuario:
        raise HTTPException(status_code=404, detail=f"Usuário {user_id} não encontrado")
    return usuario


# POST /auth/register — só admin (no authapi era aberta)
@router.post("/register", response_model=UsuarioOut)
def cadastrar_usuario(dados: UsuarioCriar, db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    if _username_em_uso(db, dados.username):
        raise HTTPException(status_code=400, detail="Username already registered")
    if dados.email is not None and _email_em_uso(db, dados.email):
        raise HTTPException(status_code=400, detail="E-mail já cadastrado.")
    papel = _buscar_papel(db, dados.role_name or "comum")

    usuario = Usuario(
        username=dados.username,
        email=dados.email,
        senha_hash=gerar_hash_senha(dados.password),
        papel=papel,
    )
    db.add(usuario)
    _salvar(db, usuario)
    return usuario


# PUT /auth/users/{user_id} — só admin; senha e e-mail são definidos pelo admin
@router.put("/users/{user_id}", response_model=UsuarioOut)
def atualizar_usuario(
    user_id: int,
    dados: UsuarioAtualizar,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(exigir_admin),
):
    usuario = db.get(Usuario, user_id)
    if not usuario:
        raise HTTPException(status_code=404, detail="User not found")

    if dados.username is not None:
        if _username_em_uso(db, dados.username, ignorar_id=usuario.id):
            raise HTTPException(status_code=400, detail="Username already registered")
        usuario.username = dados.username

    if "email" in dados.model_fields_set:
        if dados.email is not None and _email_em_uso(db, dados.email, ignorar_id=usuario.id):
            raise HTTPException(status_code=400, detail="E-mail já cadastrado.")
        usuario.email = dados.email

    if dados.password is not None:
        usuario.senha_hash = gerar_hash_senha(dados.password)

    if dados.role_name is not None:
        papel = _buscar_papel(db, dados.role_name)
        # Evita o admin se trancar pra fora (e a empresa ficar sem admin).
        if usuario.id == admin.id and papel.nome != PAPEL_ADMIN:
            raise HTTPException(
                status_code=400,
                detail="Não é possível remover seu próprio papel de administrador.",
            )
        usuario.papel = papel

    _salvar(db, usuario)
    return usuario


# DELETE /auth/users/{user_id}
@router.delete("/users/{user_id}", status_code=204)
def excluir_usuario(user_id: int, db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    if admin.id == user_id:
        raise HTTPException(status_code=400, detail="Não é possível excluir seu próprio usuário.")
    usuario = db.get(Usuario, user_id)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    db.delete(usuario)
    db.commit()


# ---------------------------------------------------------------- login com Microsoft
#
# Fluxo e decisões: docs/superpowers/specs/2026-09-24-login-microsoft-design.md.
# Quem não tem usuário com o e-mail da conta Microsoft não entra (não há cadastro
# automático). Excluir o usuário aqui continua sendo o que corta o acesso.

COOKIE_STATE = "sso_state"
CAMINHO_COOKIE = "/auth/microsoft"  # cobre /auth/microsoft/callback
TICKET_INVALIDO = "Link de acesso inválido ou expirado."


def _para_o_front(caminho: str) -> RedirectResponse:
    if not settings.FRONTEND_URL:
        # Sem FRONTEND_URL não há para onde mandar a pessoa.
        raise HTTPException(status_code=404, detail="Login com Microsoft não configurado.")
    return RedirectResponse(settings.FRONTEND_URL.rstrip("/") + caminho, status_code=302)


def _erro_sso(codigo: str) -> RedirectResponse:
    return _para_o_front(f"/login?erro_sso={codigo}")


# GET /auth/sso/status
@router.get("/sso/status", response_model=SsoStatus)
def sso_status():
    return SsoStatus(ativo=settings.sso_ativo)


# GET /auth/microsoft — o botão do front navega para cá
@router.get("/microsoft")
def iniciar_login_microsoft():
    if not settings.sso_ativo:
        return _erro_sso("sso_desligado")
    state = secrets.token_urlsafe(32)
    resposta = RedirectResponse(microsoft.url_de_autorizacao(state), status_code=302)
    # O state no cookie impede login CSRF: sem ele, alguém com conta mandaria um
    # link que faz outra pessoa entrar na conta DELE.
    resposta.set_cookie(
        COOKIE_STATE, state, max_age=600, path=CAMINHO_COOKIE,
        secure=True, httponly=True, samesite="lax",
    )
    return resposta


def _resultado_do_callback(
    request: Request, code: Optional[str], state: Optional[str], error: Optional[str], db: Session
) -> RedirectResponse:
    if not settings.sso_ativo:
        return _erro_sso("sso_desligado")

    guardado = request.cookies.get(COOKIE_STATE) or ""
    # compare_digest sobre bytes: sobre str ele levanta TypeError com acento, e o
    # state vem da query string — seria um 500 esperando acontecer.
    if not state or not guardado or not secrets.compare_digest(state.encode(), guardado.encode()):
        return _erro_sso("state_invalido")

    if error == "access_denied":
        return _erro_sso("cancelado")
    if error:
        logger.warning("Login com Microsoft: a Microsoft devolveu error=%r", error)
        return _erro_sso("falha_microsoft")
    if not code:
        return _erro_sso("falha_microsoft")

    try:
        email_cru = microsoft.email_do_usuario(microsoft.trocar_code_por_token(code))
    except microsoft.ErroMicrosoft as erro:
        logger.warning("Login com Microsoft falhou: %s", erro)
        return _erro_sso("falha_microsoft")

    try:
        email = _normalizar_email(email_cru)
    except ValueError:
        email = None
    usuario = db.query(Usuario).filter(Usuario.email == email).first() if email else None
    if usuario is None:
        logger.warning("Login com Microsoft sem usuário no DataCore: %r", email_cru)
        return _erro_sso("usuario_nao_encontrado")

    try:
        ticket = sso_tickets.emitir(db, usuario.id)
    except SQLAlchemyError as erro:
        # Ex.: API no ar antes da migration 0002. Volta ao login em vez de 500.
        db.rollback()
        logger.error("Login com Microsoft: falha ao gravar o ticket (%s)", type(erro).__name__)
        return _erro_sso("falha_microsoft")
    return _para_o_front(f"/auth/callback?ticket={ticket}")


# GET /auth/microsoft/callback — a Microsoft devolve a pessoa para cá
@router.get("/microsoft/callback")
def callback_microsoft(
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    db: Session = Depends(get_db),
):
    resposta = _resultado_do_callback(request, code, state, error, db)
    resposta.delete_cookie(
        COOKIE_STATE, path=CAMINHO_COOKIE, secure=True, httponly=True, samesite="lax"
    )
    return resposta


# POST /auth/sso/exchange — o front troca o ticket pelo token
@router.post("/sso/exchange", response_model=TokenSaida)
def trocar_ticket(dados: TicketEntrada, db: Session = Depends(get_db)):
    usuario_id = sso_tickets.resgatar(db, dados.ticket)
    # O ticket guarda só o id: o JWT nasce aqui, do usuário relido do banco. Se ele
    # foi excluído nos 60 s do ticket, o cascade já levou o ticket e a troca falha.
    usuario = db.get(Usuario, usuario_id) if usuario_id is not None else None
    if usuario is None:
        raise HTTPException(status_code=400, detail=TICKET_INVALIDO)
    return TokenSaida(
        access_token=criar_token(usuario),
        token_type="bearer",
        role=usuario.papel.nome,
        username=usuario.username,
        user_id=usuario.id,
    )
