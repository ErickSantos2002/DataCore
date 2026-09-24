from sqlalchemy import Column, DateTime, ForeignKey, Integer, Text

from app.models.database import Base


class SsoTicket(Base):
    """Ticket de uso único do login com Microsoft (ver app/core/sso_tickets.py).

    O código lê e escreve por SQL direto; o modelo existe para o `alembic check`
    enxergar a tabela e não acusá-la como sobra.
    """

    __tablename__ = "sso_tickets"
    __table_args__ = {"schema": "auth"}

    ticket_hash = Column(Text, primary_key=True)
    usuario_id = Column(Integer, ForeignKey("auth.usuarios.id", ondelete="CASCADE"), nullable=False)
    expira_em = Column(DateTime(timezone=True), nullable=False)
