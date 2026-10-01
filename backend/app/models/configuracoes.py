from sqlalchemy import BigInteger, Column, DateTime, Integer, String, Text, func

from app.models.database import Base


class Configuracao(Base):
    __tablename__ = "configuracoes"
    __table_args__ = {"schema": "tiny"}

    id = Column(Integer, primary_key=True, index=True)
    chave = Column(String, unique=True, nullable=False, index=True)
    valor = Column(String, nullable=False)


class ConfiguracaoHistorico(Base):
    """Uma alteração de configuração. Criada pela migração 002."""

    __tablename__ = "configuracoes_historico"
    __table_args__ = {"schema": "tiny"}

    id = Column(BigInteger, primary_key=True)
    chave = Column(Text, nullable=False)
    valor_anterior = Column(Text, nullable=True)
    valor_novo = Column(Text, nullable=False)
    alterado_por = Column(Text, nullable=False)
    alterado_em = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
