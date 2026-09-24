"""Conversa com a Microsoft no login por Entra ID: autorização, token e e-mail.

O token da Microsoft só serve para ler o e-mail no Graph e é descartado — nada
dele é guardado. Mensagens de ErroMicrosoft vão para o log: nunca pôr ali o
`code`, o token ou o segredo.
"""
from typing import Optional
from urllib.parse import urlencode

import requests

from app.core.config import settings

ESCOPOS = "openid email profile User.Read"
GRAPH_ME = "https://graph.microsoft.com/v1.0/me"
TIMEOUT = 10


class ErroMicrosoft(Exception):
    """Falha de rede ou resposta inesperada da Microsoft."""


def _base() -> str:
    return f"https://login.microsoftonline.com/{settings.MS_TENANT_ID}/oauth2/v2.0"


def _corpo(resposta, etapa: str) -> dict:
    if not resposta.ok:
        raise ErroMicrosoft(f"{etapa}: HTTP {resposta.status_code}")
    try:
        corpo = resposta.json()
    except ValueError as erro:
        raise ErroMicrosoft(f"{etapa}: resposta não é JSON") from erro
    if not isinstance(corpo, dict):
        raise ErroMicrosoft(f"{etapa}: resposta inesperada")
    return corpo


def url_de_autorizacao(state: str) -> str:
    parametros = {
        "client_id": settings.MS_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": settings.MS_REDIRECT_URI,
        "response_mode": "query",
        "scope": ESCOPOS,
        "state": state,
    }
    return f"{_base()}/authorize?{urlencode(parametros)}"


def trocar_code_por_token(code: str) -> str:
    try:
        resposta = requests.post(
            f"{_base()}/token",
            data={
                "grant_type": "authorization_code",
                "client_id": settings.MS_CLIENT_ID,
                "client_secret": settings.MS_CLIENT_SECRET,
                "code": code,
                "redirect_uri": settings.MS_REDIRECT_URI,
                "scope": ESCOPOS,
            },
            timeout=TIMEOUT,
        )
    except requests.RequestException as erro:
        raise ErroMicrosoft(f"troca do code: {type(erro).__name__}") from erro
    token = _corpo(resposta, "troca do code").get("access_token")
    if not isinstance(token, str) or not token:
        raise ErroMicrosoft("troca do code: sem access_token")
    return token


def email_do_usuario(access_token: str) -> Optional[str]:
    """E-mail da conta, cru (quem chama normaliza). `mail` vem nulo em conta sem
    caixa de correio; aí vale o `userPrincipalName`, que no tenant da H&S é o e-mail."""
    try:
        resposta = requests.get(
            GRAPH_ME,
            headers={"Authorization": f"Bearer {access_token}"},
            params={"$select": "mail,userPrincipalName"},
            timeout=TIMEOUT,
        )
    except requests.RequestException as erro:
        raise ErroMicrosoft(f"Graph /me: {type(erro).__name__}") from erro
    corpo = _corpo(resposta, "Graph /me")
    return corpo.get("mail") or corpo.get("userPrincipalName") or None
