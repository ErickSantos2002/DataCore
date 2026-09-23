"""Saúde da ingestão — para o DataCoreHS mostrar quando uma carga deu errado.

Sem isto, a falha de uma carga só existe no journal da VPS: alguém precisaria abrir SSH
e procurar. O resultado prático é que ninguém olha, e o erro aparece semanas depois como
número estranho num relatório. Em 18/09/2026 a importação de NFS-e falhou com um 404 do
ADN e ninguém soube até alguém ir olhar a tabela à mão — é o caso que esta tela resolve.

A regra do que é "problema" NÃO está aqui: mora nas views `operacao.avisos_cargas` e
`operacao.resumo_importacoes` (migrations 006 e 010). Este módulo só as serve. É de
propósito — se cada tela reimplementar o critério, elas discordam entre si na primeira
mudança de horário de timer.

⚠️ FUSO. A VPS roda em UTC e a tabela guarda `timestamptz`, mas quem lê a tela pensa em
horário de Brasília: "a importação do dia 15" é o dia 15 daqui. Por isso o filtro por
data converte antes de cortar (`AT TIME ZONE 'America/Sao_Paulo'`). Cortar pelo dia UTC
jogaria toda execução posterior às 21h para o dia seguinte, sem erro nenhum.
"""

from datetime import date
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.database import SessionLocal

router = APIRouter(prefix="/operacao", tags=["Operação"])

FUSO_DA_TELA = "America/Sao_Paulo"


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class AvisoCarga(BaseModel):
    job: str
    rotulo: str
    estado: str            # ok | rodando | falha | inacabada | atrasada | sem_registro
    mensagem: str
    execucao_id: Optional[int] = None
    inicio: Optional[Any] = None
    fim: Optional[Any] = None
    resultado: Optional[str] = None
    erros: Optional[int] = None
    contagens: Optional[dict] = None
    horas_desde_inicio: Optional[float] = None


class Importacao(BaseModel):
    """Uma linha da tela de Importações: o que é, quando roda, como foi, quanto demora."""

    job: str
    rotulo: str
    descricao: str
    fonte: str
    horarios: List[str]           # "04:00", em UTC — a tela converte para Brasília
    unidade_systemd: str
    ativo: bool
    ordem: int

    estado: Optional[str] = None
    mensagem: Optional[str] = None

    ultima_execucao_id: Optional[int] = None
    ultimo_inicio: Optional[Any] = None
    ultimo_fim: Optional[Any] = None
    ultimo_resultado: Optional[str] = None
    ultimos_erros: Optional[int] = None
    ultimas_contagens: Optional[dict] = None
    ultima_duracao_seg: Optional[float] = None

    proxima_execucao: Optional[Any] = None

    # A estatística vem junto do tamanho da amostra de propósito: mediana de 3 execuções
    # não merece a mesma confiança que mediana de 30, e a tela tem que poder dizer isso.
    execucoes_na_media: int = 0
    duracao_mediana_seg: Optional[float] = None
    duracao_min_seg: Optional[float] = None
    duracao_max_seg: Optional[float] = None
    execucoes_30d: int = 0
    falhas_30d: int = 0


class Execucao(BaseModel):
    id: int
    job: str
    inicio: Any
    fim: Optional[Any] = None
    resultado: Optional[str] = None
    erros: int
    contagens: dict
    detalhe: Optional[str] = None
    argumentos: Optional[str] = None
    origem: str = "manual"
    duracao_seg: Optional[float] = None


class PaginaDeExecucoes(BaseModel):
    """`total` é do FILTRO, não da página — senão a tela soma a página e chama de total."""

    itens: List[Execucao]
    total: int


@router.get("/avisos", response_model=List[AvisoCarga])
def avisos_das_cargas(
    apenas_problemas: bool = Query(True, description="false devolve também as cargas em dia"),
    db: Session = Depends(get_db),
):
    """Estado atual de cada carga da ingestão, com a mensagem pronta para exibir.

    O padrão é `apenas_problemas=true` porque a tela normal é a tela silenciosa: quando
    tudo está bem, o frontend recebe lista vazia e não mostra nada.
    """
    sql = "SELECT * FROM operacao.avisos_cargas"
    if apenas_problemas:
        # `rodando` fica de fora junto com `ok`: carga em andamento não é problema, e
        # piscar aviso durante as 8h de um backfill treinaria qualquer um a ignorar a tela.
        sql += " WHERE estado NOT IN ('ok', 'rodando')"
    sql += " ORDER BY CASE estado WHEN 'falha' THEN 1 WHEN 'atrasada' THEN 2 " \
           "WHEN 'sem_registro' THEN 3 WHEN 'inacabada' THEN 4 " \
           "WHEN 'rodando' THEN 5 ELSE 6 END, job"
    linhas = db.execute(text(sql)).mappings().all()
    return [AvisoCarga(**dict(linha)) for linha in linhas]


@router.get("/importacoes", response_model=List[Importacao])
def importacoes(db: Session = Depends(get_db)):
    """O catálogo das importações com o estado e o desempenho de cada uma.

    É a chamada que desenha a tela inteira de cartões: uma linha por carga, na ordem em
    que elas acontecem ao longo do dia. Tudo vem da view — o endpoint não decide nada.
    """
    linhas = db.execute(text(
        "SELECT * FROM operacao.resumo_importacoes ORDER BY ordem"
    )).mappings().all()

    resultado = []
    for linha in linhas:
        dados = dict(linha)
        # `time[]` do Postgres chega como objetos `time`; a tela quer "04:00".
        dados["horarios"] = [h.strftime("%H:%M") for h in (dados.get("horarios") or [])]
        for campo in ("ultima_duracao_seg", "duracao_mediana_seg",
                      "duracao_min_seg", "duracao_max_seg"):
            if dados.get(campo) is not None:
                dados[campo] = float(dados[campo])
        resultado.append(Importacao(**dados))
    return resultado


@router.get("/execucoes", response_model=PaginaDeExecucoes)
def historico_de_execucoes(
    job: Optional[str] = Query(None, description="filtra por job (extrair_notas, ...)"),
    de: Optional[date] = Query(None, description="primeiro dia (horário de Brasília)"),
    ate: Optional[date] = Query(None, description="último dia, inclusive"),
    origem: Optional[str] = Query(None, pattern="^(agendada|manual)$"),
    apenas_problemas: bool = Query(False, description="só falhas e execuções inacabadas"),
    pagina: int = Query(1, ge=1),
    tamanho: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """Histórico das cargas: quando rodou, quanto trouxe, quanto demorou, como terminou.

    É o "a importação do dia 15 funcionou?" — filtrar por data responde em um passo.
    Também serve ao monitor de volume: "hoje chegaram 3 notas em vez de 300" é uma falha
    que nenhum código de saída detecta, porque o job termina feliz.
    """
    condicoes: List[str] = []
    params: dict = {"limite": tamanho, "salto": (pagina - 1) * tamanho, "fuso": FUSO_DA_TELA}

    if job:
        condicoes.append("job = :job")
        params["job"] = job
    if de:
        condicoes.append("(inicio AT TIME ZONE :fuso)::date >= :de")
        params["de"] = de
    if ate:
        condicoes.append("(inicio AT TIME ZONE :fuso)::date <= :ate")
        params["ate"] = ate
    if origem:
        condicoes.append("origem = :origem")
        params["origem"] = origem
    if apenas_problemas:
        # `fim IS NULL` entra porque execução que começou e nunca fechou é problema —
        # foi morta por deploy ou a VPS caiu — e não aparece como 'falha'.
        condicoes.append("(resultado = 'falha' OR erros > 0 OR fim IS NULL)")

    onde = (" WHERE " + " AND ".join(condicoes)) if condicoes else ""

    total = db.execute(
        text(f"SELECT COUNT(*) FROM operacao.execucoes_job{onde}"), params
    ).scalar_one()

    # `EXTRACT(EPOCH...)` e não a subtração crua: a tela mostra segundos, e deixar o
    # intervalo virar string do lado de lá já rendeu formatação diferente em duas telas.
    linhas = db.execute(text(
        f"""SELECT id, job, inicio, fim, resultado, erros, contagens, detalhe,
                   argumentos, origem,
                   ROUND(EXTRACT(EPOCH FROM (fim - inicio))::numeric, 1) AS duracao_seg
              FROM operacao.execucoes_job{onde}
             ORDER BY inicio DESC
             LIMIT :limite OFFSET :salto"""), params).mappings().all()

    itens = []
    for linha in linhas:
        dados = dict(linha)
        if dados.get("duracao_seg") is not None:
            dados["duracao_seg"] = float(dados["duracao_seg"])
        itens.append(Execucao(**dados))

    return PaginaDeExecucoes(itens=itens, total=total)
