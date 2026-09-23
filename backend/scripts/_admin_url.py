"""Monta a URL de conexão de um banco a partir do admin.toml do cadastro central.

Roda no Konsole do Erick: o admin.toml tem o superusuário, e o Claude não lê esse
arquivo. Uso direto: python scripts/_admin_url.py datacore
"""
import sys
import tomllib
from pathlib import Path
from urllib.parse import quote

ADMIN_TOML = Path.home() / ".config" / "bancos" / "admin.toml"


def url_admin(apelido: str) -> str:
    with ADMIN_TOML.open("rb") as fh:
        cadastro = tomllib.load(fh)
    if apelido not in cadastro:
        raise SystemExit(f"Banco '{apelido}' não está no {ADMIN_TOML}.")
    d = cadastro[apelido]
    usuario = quote(str(d["usuario"]), safe="")
    senha = quote(str(d["senha"]), safe="")
    return f"postgresql://{usuario}:{senha}@{d['host']}:{d['porta']}/{d['banco']}"


if __name__ == "__main__":
    print(url_admin(sys.argv[1] if len(sys.argv) > 1 else "datacore"))
