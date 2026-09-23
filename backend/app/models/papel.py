from sqlalchemy import Column, Integer, Text
from app.models.database import Base


class Papel(Base):
    __tablename__ = "papeis"
    __table_args__ = {"schema": "auth"}

    id = Column(Integer, primary_key=True)
    nome = Column(Text, nullable=False, unique=True)
