"""Token de agente do HS.OS (JWT EdDSA). Função pura: sem config e sem banco.

A Iris (agente do HS.OS) lê a Inadimplência COMO a pessoa que perguntou: o token traz
o e-mail dela em `sub` e o bot em `act.sub`. Mesmo desenho do TaskHS
(`TaskHS/backend/app/core/agente.py`), com `aud="datacore"`.
"""
import time

import jwt

# HS.OS emite tokens de 5 min; a folga cobre diferença de relógio.
VIDA_MAXIMA_SEGUNDOS = 600
AUDIENCIA = "datacore"
EMISSOR = "hsos"


class TokenDeAgenteInvalido(Exception):
    pass


def eh_token_de_agente(token: str) -> bool:
    """Olha o payload SEM verificar: só decide o caminho (agente ou login normal)."""
    try:
        payload = jwt.decode(token, options={"verify_signature": False})
    except Exception:
        return False
    return isinstance(payload, dict) and payload.get("iss") == EMISSOR


def validar_token_de_agente(token: str, chave_pem: str) -> tuple[str, str]:
    """→ (email em minúsculas, bot). Qualquer falha lança TokenDeAgenteInvalido."""
    # O EasyPanel guarda o PEM numa linha só, com \n literal.
    chave = (chave_pem or "").replace("\\n", "\n").strip()
    if not chave:
        raise TokenDeAgenteInvalido("chave pública não configurada")
    try:
        payload = jwt.decode(
            token,
            chave,
            algorithms=["EdDSA"],
            audience=AUDIENCIA,
            issuer=EMISSOR,
            options={"require": ["exp", "sub", "iss", "aud"]},
        )
    except (jwt.PyJWTError, ValueError, TypeError) as exc:
        raise TokenDeAgenteInvalido(str(exc)) from exc
    if payload["exp"] - time.time() > VIDA_MAXIMA_SEGUNDOS:
        raise TokenDeAgenteInvalido("exp longe demais")
    email = payload.get("sub")
    act = payload.get("act")
    bot = act.get("sub") if isinstance(act, dict) else None
    if not isinstance(email, str) or not email or not isinstance(bot, str) or not bot:
        raise TokenDeAgenteInvalido("sub ou act.sub ausente")
    return email.strip().lower(), bot
