"""O que o Guardi alcança aqui com o login da pessoa — a tela "Capacidade" do HS.OS.

Spec: HS.OS `docs/superpowers/specs/2026-11-13-capacidade-do-guardi-design.md`.
Só para token de agente: com login normal é 404 (a rota não existe para o painel).
A resposta sai de `QUEM_PASSA_NAS_ROTAS_DO_AGENTE` (core/security.py), a mesma regra
que as rotas aplicam.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials

from app.core.agente import eh_token_de_agente
from app.core.security import bearer, rotas_do_agente_para, usuario_atual
from app.models.usuario import Usuario

router = APIRouter(prefix="/agente", tags=["Agente"])

# Como o papel aparece na tela do HS.OS. Papel sem rótulo sai com o nome do banco.
ROTULO_DO_PAPEL = {
    "admin": "Administrador",
    "financeiro": "Financeiro",
    "vendas": "Vendas",
    "servicos": "Serviços",
    "comum": "Comum",
}


def so_token_de_agente(
    credenciais: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
) -> None:
    if not (credenciais and eh_token_de_agente(credenciais.credentials)):
        raise HTTPException(status_code=404, detail="Not Found")


@router.get("/capacidades", dependencies=[Depends(so_token_de_agente)])
def capacidades(request: Request, usuario: Usuario = Depends(usuario_atual)):
    nome = usuario.papel.nome
    return {"papel": ROTULO_DO_PAPEL.get(nome, nome), "rotas": rotas_do_agente_para(usuario)}
