"""Gravação das NFS-e vindas do ADN em `tiny.servicos`.

Uma função só, usada pelos dois caminhos de entrada:

  * `POST /notas_servico/importar` — o disparo manual, que já existia;
  * `python -m app.jobs.importar_nfse` — o timer diário (desde 2026-09-11).

Até então a gravação morava dentro do endpoint. O job teria que copiá-la, e duas cópias
da regra de identidade da nota é exatamente como a régua de faturamento chegou a ter três
versões que divergiam em silêncio. A regra mora aqui; os dois caminhos só a chamam.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Dict, Iterable, List

from sqlalchemy.orm import Session

from app.models.nota_servico import NotaServico as NotaServicoModel

logger = logging.getLogger(__name__)

# Campos que a gravação da NOTA nunca sobrescreve numa atualização. Hoje só
# `cancelada`: o XML da nota não diz se ela foi cancelada (o leiaute nacional entrega
# isso como Evento separado, tratado em `aplicar_cancelamentos`), então regravar a nota
# devolveria a marcação para o padrão.
CAMPOS_DE_CURADORIA_LOCAL = {"cancelada"}


@dataclass
class ResultadoGravacao:
    # `atualizadas` conta toda nota que JÁ EXISTIA e foi regravada com o dado do ADN —
    # não distingue se algum campo mudou de fato. É a semântica que o endpoint sempre
    # teve (e que `testar_upsert_nfse.py` fixa); o job a chama de "reconferida".
    importadas: int = 0
    atualizadas: int = 0
    erros: List[Dict] = field(default_factory=list)


def gravar_notas(db: Session, notas: Iterable[Dict],
                 dry_run: bool = False) -> ResultadoGravacao:
    """Cria ou atualiza cada nota, casando pela chave de acesso.

    NÃO faz commit: quem chama decide. O endpoint e o job commitam uma vez no fim, como o
    endpoint sempre fez. Com `dry_run`, só conta o que faria — não toca na sessão.
    """
    resultado = ResultadoGravacao()

    for nota_data in notas:
        try:
            # Identidade da nota = CHAVE DE ACESSO (50 dígitos), nunca o número.
            #
            # O número da NFS-e NÃO é único: em 18/06/2026 a emissão migrou para o
            # Emissor Nacional e a numeração REINICIOU (a série do Recife estava em
            # 5.723; a nacional recomeçou em 725). Casar por número fazia a nota nova
            # nº 749 encontrar a nota de 2019 nº 749 e sobrescrevê-la, em silêncio.
            # Impacto medido em 23/08/2026: ~280 notas de 2018-2021 já foram perdidas
            # dessa forma (faixa 725-1058), e outras 4.405 estavam na fila.
            # A chave de acesso (doc["ChaveAcesso"]) é única por documento fiscal.
            chave = nota_data.get('codigo_verificacao')
            if not chave:
                # Sem chave não há identidade confiável. Não inserir às cegas nem
                # cair de volta no número: pular e reportar.
                resultado.erros.append({
                    "nfse": nota_data.get('numero_nfse'),
                    "erro": "NFS-e sem chave de acesso; ignorada para não arriscar "
                            "sobrescrever outra nota"
                })
                continue

            nota_existente = db.query(NotaServicoModel).filter(
                NotaServicoModel.codigo_verificacao == chave
            ).first()

            if nota_existente:
                # Atualiza nota existente, preservando os campos de curadoria nossa
                if not dry_run:
                    for key, value in nota_data.items():
                        if key in CAMPOS_DE_CURADORIA_LOCAL:
                            continue
                        if hasattr(nota_existente, key):
                            setattr(nota_existente, key, value)
                resultado.atualizadas += 1
            else:
                # Cria nova nota. Os campos de curadoria começam no padrão do
                # modelo (cancelada=False) e só mudam por ação nossa.
                if not dry_run:
                    db.add(NotaServicoModel(**{
                        k: v for k, v in nota_data.items()
                        if k not in CAMPOS_DE_CURADORIA_LOCAL
                    }))
                resultado.importadas += 1

        except Exception as e:
            resultado.erros.append({
                "nfse": nota_data.get('numero_nfse'),
                "erro": str(e)
            })
            logger.exception("Erro ao processar NFSe %s: %s", nota_data.get('numero_nfse'), e)

    return resultado


@dataclass
class ResultadoCancelamento:
    marcadas: int = 0       # estavam valendo e passaram a canceladas
    ja_marcadas: int = 0    # já estavam canceladas; não mexe (nem na data)
    sem_nota: int = 0       # evento de nota que não está em tiny.servicos


def aplicar_cancelamentos(db: Session, cancelamentos: Iterable[Dict],
                          dry_run: bool = False) -> ResultadoCancelamento:
    """Marca `cancelada` e `data_de_cancelamento` nas notas que o ADN diz canceladas.

    Casa pela chave de acesso, como a gravação da nota. Só liga, nunca desliga: não
    existe evento que "descancele" uma NFS-e. Chamar DEPOIS de `gravar_notas` na mesma
    sessão, para achar a nota que chegou junto com o próprio cancelamento.

    Defeito D11: até 2026-09-30 os eventos eram descartados e a marcação era só à mão
    (seed `nfse_cancelada_curada` do dbt), que parou em janeiro. Medido no dia: 52 NFS-e
    canceladas (jun-set/2026) contando como faturamento.
    """
    resultado = ResultadoCancelamento()
    # O SessionLocal tem autoflush=False: sem isto, a nota que `gravar_notas` acabou de
    # adicionar não aparece na consulta abaixo e o cancelamento dela passa em branco.
    db.flush()
    for evento in cancelamentos:
        nota = db.query(NotaServicoModel).filter(
            NotaServicoModel.codigo_verificacao == evento["chave"]
        ).first() if evento.get("chave") else None
        if nota is None:
            resultado.sem_nota += 1
        elif nota.cancelada:
            resultado.ja_marcadas += 1
        else:
            if not dry_run:
                nota.cancelada = True
                # A coluna é texto e já mistura "17/01/2024" e "2024-01-17"; o dbt lê os
                # dois pelo padrão (macro `texto_para_data`). ISO é o que não é ambíguo.
                data = evento.get("data_cancelamento")
                nota.data_cancelamento = data.isoformat() if data else None
            resultado.marcadas += 1
    return resultado
