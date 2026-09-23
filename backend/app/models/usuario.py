from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, Text, func, text
from sqlalchemy.orm import relationship
from app.models.database import Base
from app.models.papel import Papel  # noqa: F401  (registra o alvo da relação)


class Usuario(Base):
    __tablename__ = "usuarios"
    __table_args__ = (
        # E-mail é opcional, mas não pode repetir quando preenchido.
        Index(
            "usuarios_email_unico",
            "email",
            unique=True,
            postgresql_where=text("email IS NOT NULL"),
        ),
        {"schema": "auth"},
    )

    id = Column(Integer, primary_key=True)
    username = Column(Text, nullable=False, unique=True)
    email = Column(Text, nullable=True)
    senha_hash = Column(Text, nullable=False)
    papel_id = Column(Integer, ForeignKey("auth.papeis.id"), nullable=False)
    criado_em = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # joined: o papel vem junto na mesma query e continua acessível depois que a
    # sessão fecha (a autenticação usa o usuário fora da sessão da rota).
    papel = relationship("Papel", lazy="joined")
