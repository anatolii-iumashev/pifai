CREATE TABLE IF NOT EXISTS consultation_jobs (
  platform text NOT NULL DEFAULT 'telegram',
  update_id bigint NOT NULL,
  chat_id bigint NOT NULL,
  input_message_id bigint NOT NULL,
  status text NOT NULL CHECK (status IN ('processing', 'ready', 'attempted', 'delivered')),
  response_text text,
  model text,
  knowledge_version text,
  telegram_message_ids bigint[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (platform, update_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  platform text NOT NULL DEFAULT 'telegram',
  chat_id bigint NOT NULL,
  input_message_id bigint NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (platform, chat_id, input_message_id, role)
);

CREATE INDEX IF NOT EXISTS chat_messages_recent ON chat_messages (platform, chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS consultation_jobs_created ON consultation_jobs (created_at);
