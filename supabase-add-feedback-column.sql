-- Añadir columna para feedback de satisfacción del usuario
ALTER TABLE chat_conversations 
ADD COLUMN IF NOT EXISTS feedback_helpful BOOLEAN;

-- Añadir índice para búsquedas por feedback
CREATE INDEX IF NOT EXISTS idx_chat_conversations_feedback ON chat_conversations(feedback_helpful) WHERE feedback_helpful IS NOT NULL;

-- Añadir política para permitir actualización de feedback
CREATE POLICY "Allow public update feedback" ON chat_conversations
  FOR UPDATE USING (true)
  WITH CHECK (true);







