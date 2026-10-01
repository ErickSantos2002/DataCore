"""As regras de valor das chaves de configuração que o painel entende.

A tabela tiny.configuracoes é texto livre, e por anos aceitou qualquer coisa: a
META foi digitada em três formatos diferentes, e uma lista de meses mal digitada
só aparecia como painel zerado. Aqui cada chave conhecida diz o que aceita e
como fica gravada; chave desconhecida (as que o HS.OS lê) passa como veio.

O parse da META é o mesmo do front (`parseValor` em metaTrimestral.ts) — a
prévia de degraus na página e o valor gravado têm que concordar.
"""
import re
from datetime import date
from decimal import Decimal, InvalidOperation


class ValorInvalido(ValueError):
    """Valor recusado; a mensagem vai para a tela como veio."""


def _meta(valor: str, hoje: date) -> str:
    s = valor.strip().replace("R$", "").replace(" ", "")
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    elif s.count(".") > 1:
        s = s.replace(".", "")
    try:
        numero = Decimal(s)
    except InvalidOperation:
        numero = Decimal(0)
    if not numero.is_finite() or numero <= 0:
        raise ValorInvalido("A META precisa ser um valor em reais maior que zero.")
    return str(numero.quantize(Decimal("0.01")))


_TRIMESTRE = re.compile(r"^(\d{4})-T([1-4])$", re.IGNORECASE)


def _trimestre(valor: str, hoje: date) -> str:
    s = valor.strip()
    if s.lower() == "auto":
        return "auto"
    m = _TRIMESTRE.match(s)
    if m and 2020 <= int(m.group(1)) <= hoje.year + 1:
        return f"{m.group(1)}-T{m.group(2)}"
    raise ValorInvalido(
        f"O trimestre precisa ser 'auto' ou ano-trimestre, ex.: {hoje.year}-T3 "
        f"(ano entre 2020 e {hoje.year + 1})."
    )


def _booleano(valor: str, hoje: date) -> str:
    s = valor.strip().lower()
    if s in ("true", "false"):
        return s
    raise ValorInvalido("A comemoração só aceita true ou false.")


_REGRAS = {
    "META": _meta,
    "TRIMESTRE_APURACAO": _trimestre,
    "ANIMACAO_META": _booleano,
}


def normalizar(chave: str, valor: str, hoje: date | None = None) -> str:
    regra = _REGRAS.get(chave)
    return regra(valor, hoje or date.today()) if regra else valor
