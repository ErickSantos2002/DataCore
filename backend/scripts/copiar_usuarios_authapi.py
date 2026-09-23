"""Copia papéis e usuários do banco do authapi para o schema auth do datacore.

Preserva ids e hashes (ninguém troca de senha; os ids 1, 3 e 4 liberam
/financeiro e /locacao no front). E-mail fica vazio. Idempotente: quem já existe
(mesmo id) é pulado. Tudo numa transação: se algo falha, nada é gravado.

Uso, no Konsole e na raiz do repo, depois de scripts/migrar.sh:
    .venv/bin/python scripts/copiar_usuarios_authapi.py
A URL do banco do authapi é pedida sem eco (tem senha). O destino vem do admin.toml.
"""
import getpass
import sys
from pathlib import Path

from sqlalchemy import create_engine, text

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _admin_url import url_admin  # noqa: E402

INSERIR_PAPEL = text(
    "INSERT INTO auth.papeis (id, nome) VALUES (:id, :nome)"
    " ON CONFLICT (id) DO NOTHING RETURNING id"
)
INSERIR_USUARIO = text(
    "INSERT INTO auth.usuarios (id, username, senha_hash, papel_id, criado_em)"
    " VALUES (:id, lower(:username), :senha_hash, :papel_id, COALESCE(:criado_em, now()))"
    " ON CONFLICT (id) DO NOTHING RETURNING id"
)
# Próximo id = max + 1 (ou 1 com a tabela vazia).
AJUSTAR_SEQUENCE = (
    "SELECT setval(pg_get_serial_sequence('auth.{t}', 'id'),"
    " COALESCE((SELECT max(id) FROM auth.{t}), 0) + 1, false)"
)


def copiar(origem_url: str, destino_url: str) -> dict:
    origem = create_engine(origem_url)
    destino = create_engine(destino_url)
    try:
        with origem.connect() as conn:
            papeis = conn.execute(text("SELECT id, name FROM roles ORDER BY id")).all()
            usuarios = conn.execute(text(
                "SELECT id, username, password_hash, role_id, created_at FROM users ORDER BY id"
            )).all()

        resultado = {"papeis_copiados": [], "papeis_pulados": [], "usuarios_copiados": [], "usuarios_pulados": []}
        with destino.begin() as conn:
            for p in papeis:
                novo = conn.execute(INSERIR_PAPEL, {"id": p.id, "nome": p.name}).first()
                resultado["papeis_copiados" if novo else "papeis_pulados"].append(p.name)
            for u in usuarios:
                novo = conn.execute(INSERIR_USUARIO, {
                    "id": u.id,
                    "username": u.username,
                    "senha_hash": u.password_hash,
                    "papel_id": u.role_id,
                    "criado_em": u.created_at,
                }).first()
                resultado["usuarios_copiados" if novo else "usuarios_pulados"].append(u.username.lower())
            for tabela in ("papeis", "usuarios"):
                conn.execute(text(AJUSTAR_SEQUENCE.format(t=tabela)))
        return resultado
    finally:
        origem.dispose()
        destino.dispose()


def main() -> None:
    origem_url = getpass.getpass("URL do banco do authapi (postgresql://...): ").strip()
    resultado = copiar(origem_url, url_admin("datacore"))
    print(f"Papéis copiados ({len(resultado['papeis_copiados'])}): {', '.join(resultado['papeis_copiados']) or '-'}")
    print(f"Papéis já existentes ({len(resultado['papeis_pulados'])}): {', '.join(resultado['papeis_pulados']) or '-'}")
    print(f"Usuários copiados ({len(resultado['usuarios_copiados'])}): {', '.join(resultado['usuarios_copiados']) or '-'}")
    print(f"Usuários já existentes ({len(resultado['usuarios_pulados'])}): {', '.join(resultado['usuarios_pulados']) or '-'}")


if __name__ == "__main__":
    main()
