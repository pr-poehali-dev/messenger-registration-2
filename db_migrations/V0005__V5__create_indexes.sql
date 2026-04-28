CREATE INDEX idx_messages_conv ON messages(conversation_id, created_at);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_messages_sender ON messages(sender_id)
