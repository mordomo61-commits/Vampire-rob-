CREATE TABLE IF NOT EXISTS ticket_panels (
  id SERIAL PRIMARY KEY, guild_id TEXT NOT NULL, channel_id TEXT NOT NULL,
  message_id TEXT, type TEXT NOT NULL DEFAULT 'single', config JSONB NOT NULL DEFAULT '{}',
  staff_role_ids TEXT[] NOT NULL DEFAULT '{}', log_channel_id TEXT, category_id TEXT,
  embed_color TEXT NOT NULL DEFAULT '#8B0000', created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY, guild_id TEXT NOT NULL, channel_id TEXT, user_id TEXT NOT NULL,
  panel_id INTEGER, button_label TEXT, status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(), closed_at TIMESTAMP
);
CREATE TABLE IF NOT EXISTS reaction_roles (
  id SERIAL PRIMARY KEY, guild_id TEXT NOT NULL, channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL, emoji TEXT NOT NULL, role_id TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS button_roles (
  id SERIAL PRIMARY KEY, guild_id TEXT NOT NULL, channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL, custom_id TEXT NOT NULL, label TEXT NOT NULL, role_id TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS auto_roles (
  id SERIAL PRIMARY KEY, guild_id TEXT NOT NULL, role_id TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'join', message_id TEXT, channel_id TEXT
);
CREATE TABLE IF NOT EXISTS user_coins (
  id SERIAL PRIMARY KEY, user_id TEXT NOT NULL, guild_id TEXT NOT NULL,
  balance BIGINT NOT NULL DEFAULT 0, total_earned BIGINT NOT NULL DEFAULT 0,
  last_daily TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS game_sessions (
  id SERIAL PRIMARY KEY, user_id TEXT NOT NULL, guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL, game_type TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active', created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS quiz_sessions (
  id SERIAL PRIMARY KEY, guild_id TEXT NOT NULL, channel_id TEXT NOT NULL,
  host_id TEXT NOT NULL, category TEXT NOT NULL, difficulty TEXT NOT NULL,
  current_round INTEGER NOT NULL DEFAULT 0, total_rounds INTEGER NOT NULL DEFAULT 10,
  scores JSONB NOT NULL DEFAULT '{}', used_questions INTEGER[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'waiting', current_message_id TEXT,
  current_question_id INTEGER, created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS quiz_questions (
  id SERIAL PRIMARY KEY, category TEXT NOT NULL, difficulty TEXT NOT NULL,
  question TEXT NOT NULL, options TEXT[] NOT NULL, correct_index INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS guild_webhooks (
  id SERIAL PRIMARY KEY, guild_id TEXT NOT NULL, name TEXT NOT NULL, url TEXT NOT NULL,
  avatar_url TEXT, webhook_id TEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS coin_transfers (
  id SERIAL PRIMARY KEY, from_user_id TEXT NOT NULL, to_user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL, amount BIGINT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
  channel_id TEXT NOT NULL, message_id TEXT, created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS coin_requests (
  id SERIAL PRIMARY KEY, from_user_id TEXT NOT NULL, to_user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL, amount BIGINT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
  channel_id TEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS link_block_config (
  id SERIAL PRIMARY KEY, guild_id TEXT NOT NULL, channel_id TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '🚫 Links não são permitidos neste canal!',
  allowed_role_ids TEXT[] NOT NULL DEFAULT '{}', active BOOLEAN NOT NULL DEFAULT TRUE
);
