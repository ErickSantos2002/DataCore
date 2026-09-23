# app/core/security.py
"""Autenticação da API: hash de senha, JWT e as dependências de proteção.

Os usuários moram no schema auth do datacore (antes ficavam no authapi). Os hashes
são bcrypt $2b$, compatíveis com os que o authapi gerava.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings
from app.models.database import SessionLocal
from app.models.usuario import Usuario

PAPEL_ADMIN = "admin"
LIMITE_SENHA_BYTES = 72  # limite do bcrypt
ALGORITMO = "HS256"
logger = logging.getLogger("app.auth")


def gerar_hash_senha(senha: str) -> str:
    dados = senha.encode("utf-8")
    if len(dados) > LIMITE_SENHA_BYTES:
        raise ValueError(f"Senha acima de {LIMITE_SENHA_BYTES} bytes.")
    return bcrypt.hashpw(dados, bcrypt.gensalt()).decode("ascii")


def verificar_senha(senha: str, senha_hash: str) -> bool:
    # Trunca em 72 bytes como o bcrypt 4.x do authapi fazia em silêncio: assim a
    # senha de quem foi copiado continua valendo e o bcrypt 5 não lança erro.
    try:
        return bcrypt.checkpw(
            senha.encode("utf-8")[:LIMITE_SENHA_BYTES], senha_hash.encode("ascii")
        )
    except ValueError:
        return False


def criar_token(usuario) -> str:
    expira = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    dados = {
        "sub": usuario.username,
        "user_id": usuario.id,
        "role": usuario.papel.nome,
        "exp": expira,
    }
    return jwt.encode(dados, settings.SECRET_KEY, algorithm=ALGORITMO)


def decodificar_token(token: str) -> Optional[int]:
    """Devolve o user_id de um token válido, ou None."""
    try:
        dados = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITMO])
    except jwt.PyJWTError:
        return None
    user_id = dados.get("user_id")
    if not isinstance(user_id, int) or isinstance(user_id, bool):
        return None
    return user_id


# auto_error=False: quem decide o que fazer sem token são as dependências abaixo
# (e exigir_usuario, que na transição deixa passar).
bearer = HTTPBearer(auto_error=False)


def nao_autenticado() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido ou expirado.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def usuario_do_token(token: str) -> Optional[Usuario]:
    """Valida o token e busca o usuário no banco.

    O papel que vale é o do banco, não o gravado no token: exclusão ou rebaixamento
    têm efeito na hora.
    """
    user_id = decodificar_token(token)
    if user_id is None:
        return None
    db = SessionLocal()
    try:
        return db.get(Usuario, user_id)  # papel vem junto (lazy="joined")
    finally:
        db.close()


def usuario_atual(
    credenciais: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
) -> Usuario:
    usuario = usuario_do_token(credenciais.credentials) if credenciais else None
    if usuario is None:
        raise nao_autenticado()
    return usuario


def exigir_admin(usuario: Usuario = Depends(usuario_atual)) -> Usuario:
    if usuario.papel.nome != PAPEL_ADMIN:
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores.")
    return usuario


def exigir_usuario(
    request: Request,
    credenciais: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
) -> Optional[Usuario]:
    """Protege as rotas de dados.

    AUTH_OBRIGATORIA=true: sem token válido, 401.
    AUTH_OBRIGATORIA=false (transição): deixa passar, mas registra quem chamou sem
    token — é assim que se descobre cliente esquecido antes de ligar a flag.

    O caminho vai no log com %r (repr): assim um path forjado com %0A vira
    "'...\\n...'" em vez de quebrar em duas linhas de log.
    """
    usuario = usuario_do_token(credenciais.credentials) if credenciais else None
    if usuario is not None:
        return usuario
    if settings.AUTH_OBRIGATORIA:
        raise nao_autenticado()
    origem = request.client.host if request.client else "?"
    if credenciais is None:
        logger.warning(
            "Acesso sem token: %s %r (origem %s)", request.method, request.url.path, origem
        )
    else:
        # Credenciais presentes mas usuario_do_token devolveu None: token inválido
        # ou expirado, não cliente anônimo. Durante a transição, o front do
        # DataCore ainda manda token do authapi em toda chamada — sem essa
        # distinção, essa enxurrada esconde os clientes realmente sem token.
        logger.warning(
            "Acesso com token inválido: %s %r (origem %s)", request.method, request.url.path, origem
        )
    return None
