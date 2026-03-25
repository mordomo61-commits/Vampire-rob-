import {
  pgTable,
  text,
  integer,
  bigint,
  boolean,
  jsonb,
  serial,
  timestamp,
} from "drizzle-orm/pg-core";

export const ticketPanels = pgTable("ticket_panels", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull(),
  messageId: text("message_id"),
  type: text("type").notNull().default("single"),
  config: jsonb("config").notNull().default({}),
  staffRoleIds: text("staff_role_ids").array().notNull().default([]),
  logChannelId: text("log_channel_id"),
  categoryId: text("category_id"),
  embedColor: text("embed_color").notNull().default("#8B0000"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tickets = pgTable("tickets", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id"),
  userId: text("user_id").notNull(),
  panelId: integer("panel_id"),
  buttonLabel: text("button_label"),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  closedAt: timestamp("closed_at"),
});

export const reactionRoles = pgTable("reaction_roles", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull(),
  messageId: text("message_id").notNull(),
  emoji: text("emoji").notNull(),
  roleId: text("role_id").notNull(),
});

export const buttonRoles = pgTable("button_roles", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull(),
  messageId: text("message_id").notNull(),
  customId: text("custom_id").notNull(),
  label: text("label").notNull(),
  roleId: text("role_id").notNull(),
});

export const autoRoles = pgTable("auto_roles", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  roleId: text("role_id").notNull(),
  method: text("method").notNull().default("join"),
  messageId: text("message_id"),
  channelId: text("channel_id"),
});

export const userCoins = pgTable("user_coins", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  guildId: text("guild_id").notNull(),
  balance: bigint("balance", { mode: "number" }).notNull().default(0),
  totalEarned: bigint("total_earned", { mode: "number" }).notNull().default(0),
  lastDaily: timestamp("last_daily"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const gameSessions = pgTable("game_sessions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull(),
  gameType: text("game_type").notNull(),
  data: jsonb("data").notNull().default({}),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const quizSessions = pgTable("quiz_sessions", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull(),
  hostId: text("host_id").notNull(),
  category: text("category").notNull(),
  difficulty: text("difficulty").notNull(),
  currentRound: integer("current_round").notNull().default(0),
  totalRounds: integer("total_rounds").notNull().default(10),
  scores: jsonb("scores").notNull().default({}),
  usedQuestions: integer("used_questions").array().notNull().default([]),
  status: text("status").notNull().default("waiting"),
  currentMessageId: text("current_message_id"),
  currentQuestionId: integer("current_question_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const quizQuestions = pgTable("quiz_questions", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(),
  difficulty: text("difficulty").notNull(),
  question: text("question").notNull(),
  options: text("options").array().notNull(),
  correctIndex: integer("correct_index").notNull(),
});

export const webhooksTable = pgTable("guild_webhooks", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  avatarUrl: text("avatar_url"),
  webhookId: text("webhook_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const coinTransfers = pgTable("coin_transfers", {
  id: serial("id").primaryKey(),
  fromUserId: text("from_user_id").notNull(),
  toUserId: text("to_user_id").notNull(),
  guildId: text("guild_id").notNull(),
  amount: bigint("amount", { mode: "number" }).notNull(),
  status: text("status").notNull().default("pending"),
  channelId: text("channel_id").notNull(),
  messageId: text("message_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const coinRequests = pgTable("coin_requests", {
  id: serial("id").primaryKey(),
  fromUserId: text("from_user_id").notNull(),
  toUserId: text("to_user_id").notNull(),
  guildId: text("guild_id").notNull(),
  amount: bigint("amount", { mode: "number" }).notNull(),
  status: text("status").notNull().default("pending"),
  channelId: text("channel_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const linkBlockConfig = pgTable("link_block_config", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull(),
  message: text("message").notNull().default("🚫 Links não são permitidos neste canal!"),
  allowedRoleIds: text("allowed_role_ids").array().notNull().default([]),
  active: boolean("active").notNull().default(true),
});
