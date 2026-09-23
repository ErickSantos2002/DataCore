from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import (
    PAPEL_ADMIN,
    criar_token,
    exigir_admin,
    gerar_hash_senha,
    usuario_atual,
    verificar_senha,
)
from app.models.database import SessionLocal
from app.models.papel import Papel
from app.models.usuario import Usuario
from app.schemas.auth import (
    LoginEntrada,
    PapelOut,
    TokenSaida,
    UsuarioAtualizar,
    UsuarioCriar,
    UsuarioOut,
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
