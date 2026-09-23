from datetime import datetime
from typing import Annotated, Optional

from pydantic import AfterValidator, BaseModel, ConfigDict, Field

from app.core.security import LIMITE_SENHA_BYTES

# Os nomes do JSON seguem o authapi (o front já fala esse contrato); os nomes das
# colunas são em português, daí os validation_alias.


def _normalizar_username(valor: Optional[str]) -> Optional[str]:
    if valor is None:
        return None
    valor = valor.strip().lower()
    if not valor:
        raise ValueError("username não pode ser vazio")
    if "\x00" in valor:
        # psycopg2 não aceita NUL em literal de string; barrado aqui vira 422 em
        # vez de 500 ao tentar gravar/comparar no banco.
        raise ValueError("username não pode conter caractere nulo")
    return valor


def _normalizar_email(valor: Optional[str]) -> Optional[str]:
    if valor is None:
        return None
    valor = valor.strip().lower()
    if not valor:
        return None  # "" vira null: senão dois vazios colidiriam no índice único
    if "\x00" in valor:
        raise ValueError("e-mail não pode conter caractere nulo")
    local, arroba, dominio = valor.partition("@")
    if not arroba or not local or not dominio:
        raise ValueError("e-mail inválido")
    return valor


def _validar_senha(valor: Optional[str]) -> Optional[str]:
    if valor is None:
        return None
    if not valor:
        raise ValueError("senha não pode ser vazia")
    if len(valor.encode("utf-8")) > LIMITE_SENHA_BYTES:
        raise ValueError(f"senha acima de {LIMITE_SENHA_BYTES} bytes")
    return valor


def _validar_role_name(valor: Optional[str]) -> Optional[str]:
    if valor is None:
        return None
    if "\x00" in valor:
        # Mesmo motivo do username/e-mail: NUL quebra o bind do psycopg2 na busca
        # do papel (500 em vez de 422).
        raise ValueError("role_name não pode conter caractere nulo")
    return valor


Username = Annotated[str, AfterValidator(_normalizar_username)]
Senha = Annotated[str, AfterValidator(_validar_senha)]
Email = Annotated[Optional[str], AfterValidator(_normalizar_email)]
RoleName = Annotated[Optional[str], AfterValidator(_validar_role_name)]


class PapelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str = Field(validation_alias="nome")


class UsuarioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: Optional[str] = None
    created_at: Optional[datetime] = Field(default=None, validation_alias="criado_em")
    role: Optional[PapelOut] = Field(default=None, validation_alias="papel")


class LoginEntrada(BaseModel):
    # Sem validar a senha: no login, senha estranha é só senha errada (401).
    username: Annotated[str, AfterValidator(lambda v: v.strip().lower())]
    password: str


class TokenSaida(BaseModel):
    access_token: str
    token_type: str
    role: str
    username: str
    user_id: int


class UsuarioCriar(BaseModel):
    username: Username
    password: Senha
    role_name: RoleName = None
    email: Email = None


class UsuarioAtualizar(BaseModel):
    """Campos ausentes não mudam. Para o e-mail, enviar null ou "" limpa."""

    username: Optional[Username] = None
    password: Optional[Senha] = None
    role_name: RoleName = None
    email: Email = None
