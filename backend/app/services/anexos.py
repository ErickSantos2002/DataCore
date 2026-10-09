"""Anexos (imagens e PDF) dos eventos da cobrança.

O arquivo vai para `<ARQUIVOS_DIR>/cobranca/AAAA/MM/<uuid>.<ext>` e os metadados para
`tiny.cobranca_anexos` (migração 014). Como em `cobranca.py`, nada aqui faz commit:
quem chama decide — e, se o commit falhar, apaga os arquivos com `remover_arquivos`.

O tipo sai da ASSINATURA do conteúdo (os primeiros bytes), nunca da extensão nem do
content-type do pedido: os dois vêm do navegador e qualquer um manda "foto.png" com
HTML dentro — que, servido de volta como imagem, viraria página no domínio da API.
"""
import os
import re
import tempfile
import uuid
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import BinaryIO, List, Optional, Sequence, Tuple

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.inadimplencia import FUSO_DA_EMPRESA
from app.services.cobranca import ErroDeCobranca

TAMANHO_MAXIMO = 10 * 1024 * 1024
MAXIMO_POR_EVENTO = 5
_BLOCO = 64 * 1024
_CABECA = 16


def tipo_pela_assinatura(cabeca: bytes) -> Optional[Tuple[str, str]]:
    """(mime, extensão) pelo começo do arquivo. WebP é RIFF + 4 bytes de tamanho + WEBP."""
    if cabeca.startswith(b"\xff\xd8\xff"):
        return "image/jpeg", ".jpg"
    if cabeca.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png", ".png"
    if cabeca[:4] == b"RIFF" and cabeca[8:12] == b"WEBP":
        return "image/webp", ".webp"
    if cabeca.startswith(b"%PDF-"):
        return "application/pdf", ".pdf"
    return None


@dataclass
class ArquivoRecebido:
    nome: str
    conteudo: BinaryIO


@dataclass
class _Conferido:
    nome: str
    conteudo: BinaryIO
    tipo: str
    extensao: str
    tamanho: int


def pasta_de_arquivos() -> Path:
    # lido a cada chamada: os testes trocam o ARQUIVOS_DIR por teste
    return Path(settings.ARQUIVOS_DIR)


_CONTROLE = re.compile(r"[\x00-\x1f\x7f]")


def nome_seguro(nome: Optional[str], extensao: str) -> str:
    """Só o último pedaço do nome enviado, sem caractere de controle. Vai para o banco e para o
    Content-Disposition — nunca para o caminho no disco."""
    base = re.split(r"[/\\]", nome or "")[-1]
    base = _CONTROLE.sub("", base).strip().strip(".")
    return base[:200] or f"anexo{extensao}"


def _conferir(arquivo: ArquivoRecebido) -> _Conferido:
    """Lê no máximo 10 MB + 1 byte, em blocos, para saber o tamanho e a assinatura."""
    nome_exibido = nome_seguro(arquivo.nome, "")
    cabeca = b""
    tamanho = 0
    while True:
        bloco = arquivo.conteudo.read(min(_BLOCO, TAMANHO_MAXIMO + 1 - tamanho))
        if not bloco:
            break
        if len(cabeca) < _CABECA:
            cabeca += bloco[:_CABECA - len(cabeca)]
        tamanho += len(bloco)
        if tamanho > TAMANHO_MAXIMO:
            raise ErroDeCobranca(f"O arquivo {nome_exibido} passa de 10 MB.", 413)
    arquivo.conteudo.seek(0)
    if tamanho == 0:
        raise ErroDeCobranca(f"O arquivo {nome_exibido} está vazio.")
    tipo = tipo_pela_assinatura(cabeca)
    if tipo is None:
        raise ErroDeCobranca(
            f"O arquivo {nome_exibido} não é JPG, PNG, WebP nem PDF. Só esses tipos são aceitos.")
    return _Conferido(nome=nome_seguro(arquivo.nome, tipo[1]), conteudo=arquivo.conteudo,
                      tipo=tipo[0], extensao=tipo[1], tamanho=tamanho)


def _gravar_no_disco(conferido: _Conferido, agora: datetime) -> str:
    """Grava num temporário da mesma pasta e troca pelo nome final com `os.replace`: quem lê
    nunca vê arquivo pela metade. Devolve o caminho relativo ao ARQUIVOS_DIR."""
    relativo = Path("cobranca", f"{agora:%Y}", f"{agora:%m}", uuid.uuid4().hex + conferido.extensao)
    destino = pasta_de_arquivos() / relativo
    destino.parent.mkdir(parents=True, exist_ok=True)
    fd, temporario = tempfile.mkstemp(dir=destino.parent, prefix=".parcial-")
    try:
        with os.fdopen(fd, "wb") as saida:
            while bloco := conferido.conteudo.read(_BLOCO):
                saida.write(bloco)
            saida.flush()
            os.fsync(saida.fileno())
        os.replace(temporario, destino)
    except BaseException:
        Path(temporario).unlink(missing_ok=True)
        raise
    return relativo.as_posix()


def _dentro_da_pasta(caminho: str) -> Optional[Path]:
    """O arquivo do anexo, resolvido; None se o caminho sair do ARQUIVOS_DIR (`..`, absoluto,
    link). O caminho é nosso, mas o banco não é só nosso: ninguém apaga nem serve fora daqui."""
    base = pasta_de_arquivos().resolve()
    arquivo = (base / caminho).resolve()
    return arquivo if arquivo.is_relative_to(base) else None


def remover_arquivos(caminhos: Sequence[str]) -> None:
    for caminho in caminhos:
        arquivo = _dentro_da_pasta(caminho)
        if arquivo is not None:
            arquivo.unlink(missing_ok=True)


def enviar(db: Session, evento_id: int, arquivos: Sequence[ArquivoRecebido], usuario: str
           ) -> Tuple[List[dict], List[str]]:
    """Confere todos, depois grava todos (tudo ou nada). Devolve (anexos criados, caminhos
    gravados) — os caminhos para quem chama apagar se o commit falhar."""
    if not arquivos:
        raise ErroDeCobranca("Escolha ao menos um arquivo.")
    if len(arquivos) > MAXIMO_POR_EVENTO:
        raise ErroDeCobranca(f"No máximo {MAXIMO_POR_EVENTO} anexos por contato.")
    if db.execute(text("SELECT 1 FROM tiny.cobranca_eventos WHERE id = :id"), {"id": evento_id}).first() is None:
        raise ErroDeCobranca("Evento não encontrado.", 404)
    # Dois envios ao mesmo tempo no mesmo evento passariam juntos pela contagem: a trava vale
    # até o fim da transação. Sem FOR UPDATE no evento, que só tem SELECT e INSERT.
    db.execute(text("SELECT pg_advisory_xact_lock(hashtext('cobranca_anexos'), CAST(:id AS int))"),
               {"id": evento_id % 2147483647})
    ja_tem = db.execute(text(
        "SELECT count(*) FROM tiny.cobranca_anexos WHERE evento_id = :id AND apagado_em IS NULL"
    ), {"id": evento_id}).scalar_one()
    if ja_tem + len(arquivos) > MAXIMO_POR_EVENTO:
        raise ErroDeCobranca(
            f"Este contato já tem {ja_tem} anexo(s); o limite é {MAXIMO_POR_EVENTO} por contato.")

    conferidos = [_conferir(a) for a in arquivos]

    agora = datetime.now(FUSO_DA_EMPRESA)
    gravados: List[str] = []
    criados: List[dict] = []
    try:
        for c in conferidos:
            caminho = _gravar_no_disco(c, agora)
            gravados.append(caminho)
            criados.append(dict(db.execute(text("""
                INSERT INTO tiny.cobranca_anexos (evento_id, caminho, nome_original, tipo, tamanho, enviado_por)
                VALUES (:evento, :caminho, :nome, :tipo, :tamanho, :por)
                RETURNING id, nome_original, tipo, tamanho, enviado_por, enviado_em
            """), {"evento": evento_id, "caminho": caminho, "nome": c.nome, "tipo": c.tipo,
                   "tamanho": c.tamanho, "por": usuario}).mappings().one()))
    except BaseException:
        remover_arquivos(gravados)
        raise
    return criados, gravados


def anexo_para_baixar(db: Session, anexo_id: int) -> Tuple[Path, dict]:
    """O arquivo no disco e a linha do banco; 404 se apagado, inexistente ou sumido do disco."""
    linha = db.execute(text(
        "SELECT id, caminho, nome_original, tipo FROM tiny.cobranca_anexos"
        " WHERE id = :id AND apagado_em IS NULL"
    ), {"id": anexo_id}).mappings().first()
    if linha is None:
        raise ErroDeCobranca("Anexo não encontrado.", 404)
    arquivo = _dentro_da_pasta(linha["caminho"])
    if arquivo is None or not arquivo.is_file():
        raise ErroDeCobranca("O arquivo deste anexo não está mais no servidor.", 404)
    return arquivo, dict(linha)


def apagar(db: Session, anexo_id: int, usuario: str) -> str:
    """Marca como apagado e devolve o caminho; quem chama remove o arquivo DEPOIS do commit
    (se o commit falhar, o anexo continua inteiro)."""
    caminho = db.execute(text(
        "UPDATE tiny.cobranca_anexos SET apagado_em = now(), apagado_por = :por"
        " WHERE id = :id AND apagado_em IS NULL RETURNING caminho"
    ), {"id": anexo_id, "por": usuario}).scalar_one_or_none()
    if caminho is None:
        raise ErroDeCobranca("Anexo não encontrado.", 404)
    return caminho
