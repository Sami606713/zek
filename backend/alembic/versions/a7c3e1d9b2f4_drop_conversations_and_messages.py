"""drop conversations and messages

Chats are stored by LangGraph (its own checkpoint tables), so the app's own
conversations/messages tables, and the unused orders.conversation_id link, are removed.

Written by hand: autogenerate would also try to drop LangGraph's tables, which
aren't in the app's models.

Revision ID: a7c3e1d9b2f4
Revises: 6438dbae1831
Create Date: 2026-10-23 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'a7c3e1d9b2f4'
down_revision: Union[str, None] = '6438dbae1831'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint('orders_conversation_id_fkey', 'orders', type_='foreignkey')
    op.drop_column('orders', 'conversation_id')
    op.drop_table('messages')       # its indexes go with it
    op.drop_table('conversations')


def downgrade() -> None:
    # Restores the empty tables and column (the old rows are not restored).
    op.create_table('conversations',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('session_id', sa.String(length=100), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=True),
    sa.Column('channel', sa.Enum('web', 'agent', 'whatsapp', 'voice', name='conversation_channel', native_enum=False, length=32), nullable=False),
    sa.Column('customer_phone', sa.String(length=20), nullable=True),
    sa.Column('title', sa.String(length=200), nullable=True),
    sa.Column('outcome', sa.Enum('open', 'purchased', 'answered', 'unresolved', 'handed_off', name='conversation_outcome', native_enum=False, length=32), nullable=False),
    sa.Column('is_flagged', sa.Boolean(), nullable=False),
    sa.Column('admin_note', sa.Text(), nullable=True),
    sa.Column('handled_by_id', sa.UUID(), nullable=True),
    sa.Column('message_count', sa.Integer(), nullable=False),
    sa.Column('last_message_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['handled_by_id'], ['users.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_conversations_channel_last_message', 'conversations', ['channel', 'last_message_at'], unique=False)
    op.create_index(op.f('ix_conversations_customer_phone'), 'conversations', ['customer_phone'], unique=False)
    op.create_index(op.f('ix_conversations_id'), 'conversations', ['id'], unique=False)
    op.create_index(op.f('ix_conversations_is_flagged'), 'conversations', ['is_flagged'], unique=False)
    op.create_index(op.f('ix_conversations_session_id'), 'conversations', ['session_id'], unique=True)
    op.create_index(op.f('ix_conversations_user_id'), 'conversations', ['user_id'], unique=False)
    op.create_table('messages',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('conversation_id', sa.UUID(), nullable=False),
    sa.Column('role', sa.Enum('user', 'assistant', 'tool', 'system', 'admin', name='message_role', native_enum=False, length=32), nullable=False),
    sa.Column('content', sa.Text(), nullable=True),
    sa.Column('tool_calls', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('tool_name', sa.String(length=100), nullable=True),
    sa.Column('tool_call_id', sa.String(length=100), nullable=True),
    sa.Column('tool_result', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('model', sa.String(length=100), nullable=True),
    sa.Column('input_tokens', sa.Integer(), nullable=True),
    sa.Column('output_tokens', sa.Integer(), nullable=True),
    sa.Column('latency_ms', sa.Integer(), nullable=True),
    sa.Column('external_id', sa.String(length=100), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_messages_conversation_id'), 'messages', ['conversation_id'], unique=False)
    op.create_index(op.f('ix_messages_external_id'), 'messages', ['external_id'], unique=False)
    op.add_column('orders', sa.Column('conversation_id', sa.UUID(), nullable=True))
    op.create_foreign_key('orders_conversation_id_fkey', 'orders', 'conversations', ['conversation_id'], ['id'], ondelete='SET NULL')
