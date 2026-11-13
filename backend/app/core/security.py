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
from sqlalchemy import func, select

from app.core.agente import TokenDeAgenteInvalido, eh_token_de_agente, validar_token_de_agente
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


def recusar_agente() -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Ação não permitida para o agente.")


def usuario_do_token_de_agente(token: str) -> Usuario:
    """Token de agente do HS.OS → o usuário do `sub`, com as permissões que ele já tem.

    Qualquer falha (assinatura, aud, exp, e-mail sem usuário) é 401. O e-mail casa
    exato, em minúsculas dos dois lados.
    """
    try:
        email, bot = validar_token_de_agente(token, settings.HSOS_AGENTE_CHAVE_PUBLICA)
    except TokenDeAgenteInvalido as erro:
        logger.warning("Token de agente recusado: %s", erro)
        raise nao_autenticado()
    db = SessionLocal()
    try:
        usuario = db.execute(
            select(Usuario).where(func.lower(Usuario.email) == email)
        ).scalar_one_or_none()
    finally:
        db.close()
    if usuario is None:
        logger.warning("Token de agente sem usuário: %r via %r", email, bot)
        raise nao_autenticado()
    logger.info("Token de agente: %s via %s", usuario.username, bot)
    return usuario


# As rotas que aceitam o token de agente do HS.OS (Iris e Guardis). Lista explícita
# e fechada: rota nova nasce recusando o agente (403) até entrar aqui. Só GET — o
# método é conferido à parte, então nem uma escrita no mesmo caminho passa.
# O HS.OS tem o espelho disto em `app/datacore_consultas.py`.
# O agente vale como a pessoa do `sub`: o que a rota exige do login (papel, se
# houver `exigir_papeis`) exige dele também, nada a mais. A lista é a chave da tabela
# abaixo: rota nova no agente entra declarando quem passa.
# Rota → quem passa nela: um conjunto de papéis, `LIVRE` (qualquer logado) ou
# `DIRETORIA_IDS` (por id). É a mesma regra das dependências das rotas — o
# `test_agente_capacidades.py` percorre a lista e confere, papel a papel, que a rota
# declarada aberta passa e a fechada leva 403. Mudou o papel de uma rota, muda aqui.
# Daqui sai o `GET /agente/capacidades`, que diz ao HS.OS o que o login alcança.
LIVRE = "livre"
PAPEIS_COMERCIAL = frozenset({"admin", "vendas", "financeiro"})
PAPEIS_SERVICOS = frozenset({"admin", "servicos", "financeiro"})
PAPEIS_FINANCEIRO = frozenset({"admin", "financeiro"})
# NÃO TROQUE POR PAPEL: ver o comentário de `DIRETORIA` abaixo.
DIRETORIA_IDS = frozenset({1, 3, 4})

QUEM_PASSA_NAS_ROTAS_DO_AGENTE = {
    "/agente/capacidades": LIVRE,
    "/estoque/": LIVRE, "/estoque/{estoque_id}": LIVRE,
    "/faturamento/mensal": LIVRE,
    "/clientes/": PAPEIS_COMERCIAL, "/clientes/{id}": PAPEIS_COMERCIAL,
    "/faturamento/resumo": PAPEIS_COMERCIAL, "/faturamento/filtros": PAPEIS_COMERCIAL,
    "/faturamento/vendas": PAPEIS_COMERCIAL,
    "/faturamento/vendas/{id_nota}/observacoes": PAPEIS_COMERCIAL,
    "/faturamento/servicos": PAPEIS_SERVICOS, "/faturamento/servicos/resumo": PAPEIS_SERVICOS,
    "/notas_fiscais/": PAPEIS_FINANCEIRO, "/notas_fiscais/vendas/": PAPEIS_FINANCEIRO,
    "/notas_fiscais/locacao/": DIRETORIA_IDS,
    "/notas_servico/": PAPEIS_FINANCEIRO,
    "/itens_nota/": PAPEIS_FINANCEIRO, "/itens_nota/{id}": PAPEIS_FINANCEIRO,
    "/contas_receber/resumo": PAPEIS_FINANCEIRO, "/contas_receber/pagina": PAPEIS_FINANCEIRO,
    "/contas_pagar/resumo": PAPEIS_FINANCEIRO, "/contas_pagar/pagina": PAPEIS_FINANCEIRO,
    "/inadimplencia/resumo": PAPEIS_FINANCEIRO, "/inadimplencia/empresas": PAPEIS_FINANCEIRO,
    "/inadimplencia/empresas/{empresa}": PAPEIS_FINANCEIRO,
    "/inadimplencia/empresas/{empresa}/titulos": PAPEIS_FINANCEIRO,
    "/inadimplencia/indicadores": PAPEIS_FINANCEIRO,
    "/centro_custo/resumo_produto/": DIRETORIA_IDS,
    "/notas_entrada/resumo": DIRETORIA_IDS, "/notas_entrada/pagina": DIRETORIA_IDS,
    "/notas_entrada/{id_nota}/itens": DIRETORIA_IDS,
}
ROTAS_DO_AGENTE = frozenset(QUEM_PASSA_NAS_ROTAS_DO_AGENTE)


def passa_na_rota_do_agente(usuario: Usuario, rota: str) -> bool:
    quem = QUEM_PASSA_NAS_ROTAS_DO_AGENTE[rota]
    if quem == LIVRE:
        return True
    if quem is DIRETORIA_IDS:
        return usuario.id in DIRETORIA_IDS
    return usuario.papel.nome in quem


def rotas_do_agente_para(usuario: Usuario) -> list[list[str]]:
    """Os pares (método, template) da lista que este login consegue usar — só GET."""
    return [["GET", rota] for rota in sorted(ROTAS_DO_AGENTE) if passa_na_rota_do_agente(usuario, rota)]


def rota_aceita_agente(request: Request) -> bool:
    rota = request.scope.get("route")
    return request.method == "GET" and getattr(rota, "path", None) in ROTAS_DO_AGENTE


def usuario_do_agente(request: Request, token: str) -> Usuario:
    """Token de agente numa requisição: 403 fora da lista, senão o usuário do `sub`.

    Fora da lista recusa antes de validar: rota fechada não diz se o token era bom.
    O usuário fica em `request.state` — `exigir_usuario` e `usuario_atual` rodam os
    dois na mesma requisição e não precisam ir ao banco duas vezes.
    """
    if not rota_aceita_agente(request):
        raise recusar_agente()
    usuario = getattr(request.state, "usuario_do_agente", None)
    if usuario is None:
        usuario = usuario_do_token_de_agente(token)
        request.state.usuario_do_agente = usuario
    return usuario


def usuario_atual(
    request: Request,
    credenciais: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
) -> Usuario:
    """O usuário logado — ou, nas `ROTAS_DO_AGENTE`, o da pessoa do token de agente."""
    if credenciais and eh_token_de_agente(credenciais.credentials):
        return usuario_do_agente(request, credenciais.credentials)
    usuario = usuario_do_token(credenciais.credentials) if credenciais else None
    if usuario is None:
        raise nao_autenticado()
    return usuario


def exigir_admin(usuario: Usuario = Depends(usuario_atual)) -> Usuario:
    if usuario.papel.nome != PAPEL_ADMIN:
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores.")
    return usuario


def exigir_papeis(*papeis: str, mensagem: str = "Acesso restrito."):
    """Dependência que deixa passar só os papéis listados — a regra no backend, não só no menu.

    Uso: `usuario: Usuario = Depends(exigir_papeis("admin", "financeiro"))`.
    """
    permitidos = set(papeis)

    def _exigir(usuario: Usuario = Depends(usuario_atual)) -> Usuario:
        if usuario.papel.nome not in permitidos:
            raise HTTPException(status_code=403, detail=mensagem)
        return usuario

    return _exigir


def exigir_usuarios(*ids: int, mensagem: str = "Acesso restrito."):
    """Como `exigir_papeis`, mas por id de usuário — liberação nominal."""
    permitidos = set(ids)

    def _exigir(usuario: Usuario = Depends(usuario_atual)) -> Usuario:
        if usuario.id not in permitidos:
            raise HTTPException(status_code=403, detail=mensagem)
        return usuario

    return _exigir


# Espelho no backend da matriz do front (`frontend/src/auth/permissoes.ts`), para as
# rotas que o token de agente lê: até 10/11/2026 só a Inadimplência conferia papel
# aqui, e o resto confiava no menu. Mudou lá, muda aqui.
COMERCIAL = exigir_papeis(*PAPEIS_COMERCIAL, mensagem="Acesso restrito ao comercial.")
SERVICOS = exigir_papeis(*PAPEIS_SERVICOS, mensagem="Acesso restrito a serviços.")
FINANCEIRO = exigir_papeis(*PAPEIS_FINANCEIRO, mensagem="Acesso restrito ao financeiro.")
# NÃO TROQUE POR PAPEL: Financeiro e Locação são liberadas para estas pessoas por
# decisão da chefia — ver o comentário de `/financeiro` no permissoes.ts.
DIRETORIA = exigir_usuarios(*DIRETORIA_IDS, mensagem="Acesso restrito.")
ADMIN = exigir_admin


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
    if credenciais and eh_token_de_agente(credenciais.credentials):
        # Fora das ROTAS_DO_AGENTE é 403, e token ruim é 401 — mesmo com
        # AUTH_OBRIGATORIA=false: token de agente nunca cai no "deixa passar".
        return usuario_do_agente(request, credenciais.credentials)
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
