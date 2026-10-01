from datetime import datetime
from typing import Optional

from pydantic import BaseModel

# Base para reuso
class ConfiguracaoBase(BaseModel):
    chave: str
    valor: str

# Schema para criação
class ConfiguracaoCreate(ConfiguracaoBase):
    pass

# Schema para atualização
class ConfiguracaoUpdate(BaseModel):
    valor: str

# Schema de resposta (com id e orm_mode configurado)
class Configuracao(ConfiguracaoBase):
    id: int

    model_config = {
        "from_attributes": True
    }


class HistoricoConfiguracao(BaseModel):
    id: int
    chave: str
    valor_anterior: Optional[str]
    valor_novo: str
    alterado_por: str
    alterado_em: datetime

    model_config = {"from_attributes": True}
