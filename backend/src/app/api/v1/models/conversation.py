"""Agent conversations across web chat, voice and WhatsApp, with every message and tool call."""

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from src.app.database import Base
from src.app.api.v1.models.base import (
    ConversationOutcome,
    MessageRole,
    SalesChannel,
    created_at_col,
    str_enum,
    updated_at_col,
    uuid_pk,
)


class Conversation(Base):
    __tablename__ = "conversations"
    __table_args__ = (Index("ix_conversations_channel_last_message", "channel", "last_message_at"),)

    id = uuid_pk()
    session_id = Column(String(100), unique=True, nullable=False, index=True)   # agent thread id
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    channel = Column(str_enum(SalesChannel, name="conversation_channel"), nullable=False, default=SalesChannel.WEB)
    customer_phone = Column(String(20), nullable=True, index=True)               # WhatsApp / voice caller

    title = Column(String(200), nullable=True)                                   # short summary for the admin list
    outcome = Column(str_enum(ConversationOutcome, name="conversation_outcome"), nullable=False, default=ConversationOutcome.OPEN)
    is_flagged = Column(Boolean, nullable=False, default=False, index=True)
    admin_note = Column(Text, nullable=True)
    handled_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)  # human takeover

    message_count = Column(Integer, nullable=False, default=0)
    last_message_at = Column(DateTime(timezone=True), nullable=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)

    created_at = created_at_col()
    updated_at = updated_at_col()

    messages = relationship(
        "Message",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(str_enum(MessageRole, name="message_role"), nullable=False)
    content = Column(Text, nullable=True)

    # Assistant messages: [{"id", "name", "args"}]. Tool messages: the call they answer + its result.
    tool_calls = Column(JSONB, nullable=True)
    tool_name = Column(String(100), nullable=True)
    tool_call_id = Column(String(100), nullable=True)
    tool_result = Column(JSONB, nullable=True)

    # Observability
    model = Column(String(100), nullable=True)
    input_tokens = Column(Integer, nullable=True)
    output_tokens = Column(Integer, nullable=True)
    latency_ms = Column(Integer, nullable=True)
    external_id = Column(String(100), nullable=True, index=True)   # WhatsApp message id, for de-duplication

    created_at = created_at_col()

    conversation = relationship("Conversation", back_populates="messages")
