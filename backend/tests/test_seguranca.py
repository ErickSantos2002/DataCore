from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import jwt
import pytest
from pydantic import ValidationError

from app.core.config import Settings, settings
from app.core.security import (
    criar_token,
    decodificar_token,
    gerar_hash_senha,
    verificar_senha,
)

# Gerado pelo authapi real (passlib 1.7.4 + bcrypt 4.1.2) para a senha abaixo.
HASH_AUTHAPI = "$2b$12$ePWpw.mP7U.dQzH/FYu8L.IVq1sjlXV3VQ.Pt.vJhQLSS/ExU8Q6e"
SENHA_AUTHAPI = "senha-do-authapi"

USUARIO = SimpleNamespace(id=7, username="maria", papel=SimpleNamespace(nome="financeiro"))


def test_config_tem_os_padroes_da_spec():
    assert settings.ACCESS_TOKEN_EXPIRE_MINUTES == 480
    assert settings.AUTH_OBRIGATORIA is False


def test_secret_key_curta_recusa_no_startup():
    with pytest.raises(ValidationError):
        Settings(DATABASE_URL="postgresql://x/y", SECRET_KEY="curta")


def test_hash_e_verificacao():
    h = gerar_hash_senha("abc12345")
    assert h.startswith("$2b$")
    assert verificar_senha("abc12345", h) is True
    assert verificar_senha("outra", h) is False


def test_hash_gerado_pelo_authapi_continua_valido():
    assert verificar_senha(SENHA_AUTHAPI, HASH_AUTHAPI) is True
    assert verificar_senha("errada", HASH_AUTHAPI) is False


def test_gerar_hash_recusa_senha_acima_de_72_bytes():
    with pytest.raises(ValueError):
        gerar_hash_senha("x" * 73)
    # 72 bytes contando multibyte: "ç" ocupa 2 bytes em UTF-8.
    with pytest.raises(ValueError):
        gerar_hash_senha("ç" * 37)


def test_verificar_senha_longa_nao_explode_e_compara_os_72_primeiros_bytes():
    # O authapi (bcrypt 4.x) truncava em 72 bytes em silêncio; mantemos a
    # compatibilidade em vez de estourar ValueError no login.
    h = gerar_hash_senha("x" * 72)
    assert verificar_senha("x" * 100, h) is True
    assert verificar_senha("y" * 100, h) is False


def test_verificar_senha_com_hash_corrompido_devolve_false():
    assert verificar_senha("abc", "nao-e-um-hash") is False


def test_token_tem_os_campos_do_authapi():
    token = criar_token(USUARIO)
    dados = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    assert dados["sub"] == "maria"
    assert dados["user_id"] == 7
    assert dados["role"] == "financeiro"
    expira = datetime.fromtimestamp(dados["exp"], tz=timezone.utc)
    restante = expira - datetime.now(timezone.utc)
    assert timedelta(minutes=479) < restante <= timedelta(minutes=480)


def test_decodificar_token_valido_devolve_user_id():
    assert decodificar_token(criar_token(USUARIO)) == 7


def _assinado(dados, chave=None):
    return jwt.encode(dados, chave or settings.SECRET_KEY, algorithm="HS256")


@pytest.mark.parametrize(
    "token",
    [
        "lixo",
        "",
        _assinado({"user_id": 7, "exp": datetime.now(timezone.utc) + timedelta(minutes=5)}, chave="chave-do-authapi-antiga-com-32-bytes-ou-mais"),
        _assinado({"user_id": 7, "exp": datetime.now(timezone.utc) - timedelta(seconds=1)}),
        _assinado({"user_id": "7", "exp": datetime.now(timezone.utc) + timedelta(minutes=5)}),
        _assinado({"sub": "maria", "exp": datetime.now(timezone.utc) + timedelta(minutes=5)}),
    ],
    ids=["lixo", "vazio", "outra-chave", "expirado", "user-id-texto", "sem-user-id"],
)
def test_decodificar_token_invalido_devolve_none(token):
    assert decodificar_token(token) is None


def test_hash_2a_do_authapi_tambem_vale():
    # 17 dos 31 usuários copiados do authapi têm hash $2a$ (versão antiga da
    # biblioteca), não $2b$. Se este prefixo deixasse de ser aceito, mais da
    # metade da empresa ficaria sem conseguir entrar.
    import bcrypt

    h = bcrypt.hashpw(b"senha-antiga", bcrypt.gensalt(prefix=b"2a")).decode()
    assert h.startswith("$2a$")
    assert verificar_senha("senha-antiga", h) is True
    assert verificar_senha("errada", h) is False
