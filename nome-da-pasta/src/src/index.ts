import { config } from "dotenv";
  config();

  import http from "http";
  import {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  Events,
  type Interaction,
  type Message,
} from "discord.js";
import { readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { db } from "./db";
import { autoRoles, reactionRoles, linkBlockConfig } from "./db";
import { and, eq } from "drizzle-orm";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.GuildMember,
  ],
});

export const commands: Collection<string, any> = new Collection();

async function loadCommands() {
  const commandsPath = join(__dirname, "commands");
  const categories = readdirSync(commandsPath);
  for (const category of categories) {
    const files = readdirSync(join(commandsPath, category)).filter(
      (f) => f.endsWith(".ts") || f.endsWith(".js")
    );
    for (const file of files) {
      const filePath = join(commandsPath, category, file);
      const mod = await import(pathToFileURL(filePath).href);
      if (mod.data && mod.execute) {
        if (Array.isArray(mod.data)) {
          for (const d of mod.data) commands.set(d.name, mod);
        } else {
          commands.set(mod.data.name, mod);
        }
      }
    }
  }
}

async function loadEvents() {
  const eventsPath = join(__dirname, "events");
  const files = readdirSync(eventsPath).filter(
    (f) => f.endsWith(".ts") || f.endsWith(".js")
  );
  for (const file of files) {
    const filePath = join(eventsPath, file);
    const mod = await import(pathToFileURL(filePath).href);
    if (mod.name && mod.execute) {
      if (mod.once) {
        client.once(mod.name, (...args: any[]) => mod.execute(...args));
      } else {
        client.on(mod.name, (...args: any[]) => mod.execute(...args));
      }
    }
  }
}

// ─── INTERACTION HANDLER ─────────────────────────────────────────────────────
client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction, client);
    } catch (err) {
      console.error(`Error in command ${interaction.commandName}:`, err);
      const msg = { content: "❌ Ocorreu um erro ao executar esse comando.", ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg).catch(() => {});
      } else {
        await interaction.reply(msg).catch(() => {});
      }
    }
  } else if (interaction.isButton()) {
    const { handleButton } = await import("./interactions/buttons.js");
    await handleButton(interaction, client).catch(console.error);
  } else if (interaction.isStringSelectMenu()) {
    const { handleSelect } = await import("./interactions/selects.js");
    await handleSelect(interaction, client).catch(console.error);
  } else if (interaction.isModalSubmit()) {
    const { handleModal } = await import("./interactions/modals.js");
    await handleModal(interaction, client).catch(console.error);
  }
});

// ─── REACTION ROLES ──────────────────────────────────────────────────────────
client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (user.bot) return;
  try {
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();
    const guildId = reaction.message.guildId;
    if (!guildId) return;

    const emoji = reaction.emoji.id
      ? `<:${reaction.emoji.name}:${reaction.emoji.id}>`
      : reaction.emoji.name!;

    const rows = await db.select().from(reactionRoles).where(eq(reactionRoles.messageId, reaction.message.id));
    const match = rows.find((r) => r.emoji === emoji || r.emoji === reaction.emoji.name);
    if (!match) return;

    const guild = reaction.message.guild;
    if (!guild) return;
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    if (member.roles.cache.has(match.roleId)) {
      await member.roles.remove(match.roleId).catch(() => {});
    } else {
      await member.roles.add(match.roleId).catch(() => {});
    }
  } catch {}
});

// ─── AUTO ROLES ON JOIN ──────────────────────────────────────────────────────
client.on(Events.GuildMemberAdd, async (member) => {
  try {
    const rows = await db.select().from(autoRoles).where(eq(autoRoles.guildId, member.guild.id));
    for (const row of rows) {
      if (row.method === "join") {
        await member.roles.add(row.roleId).catch(() => {});
      }
    }
  } catch {}
});

// ─── LINK BLOCKER ────────────────────────────────────────────────────────────
const URL_REGEX = /(https?:\/\/[^\s]+|discord\.gg\/[^\s]+|www\.[^\s]+\.[a-z]{2,})/gi;

client.on(Events.MessageCreate, async (message: Message) => {
  if (message.author.bot) return;
  if (!message.guild) return;
  if (!URL_REGEX.test(message.content)) return;
  URL_REGEX.lastIndex = 0; // reset regex state

  try {
    const [config] = await db.select().from(linkBlockConfig).where(
      and(
        eq(linkBlockConfig.guildId, message.guild.id),
        eq(linkBlockConfig.channelId, message.channel.id),
        eq(linkBlockConfig.active, true),
      )
    );

    if (!config) return;

    // Check if user has an allowed role
    const member = message.member;
    if (member) {
      // Staff/admin bypass
      if (member.permissions.has("ManageMessages")) return;
      // Check allowed roles
      const allowedRoles = config.allowedRoleIds ?? [];
      if (allowedRoles.some((rid: string) => member.roles.cache.has(rid))) return;
    }

    await message.delete().catch(() => {});
    const warn = await message.channel.send({
      content: `${message.author} ${config.message}`,
    });

    setTimeout(() => warn.delete().catch(() => {}), 8000);
  } catch {}
});

// ─── KEEP-ALIVE HTTP SERVER ───────────────────────────────────────────────────
  // Mantém o bot online em hospedagens gratuitas (Railway, Render, Replit, etc.)
  // Use o UptimeRobot para pingar essa URL a cada 5 minutos.
  const PORT = process.env.PORT ?? 3000;
  http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("✅ Vampire Bot online!\n");
  }).listen(PORT, () => {
    console.log(`🌐 Keep-alive server rodando na porta ${PORT}`);
  });

  // ─── MAIN ─────────────────────────────────────────────────────────────────────
  async function main() {
  if (!process.env.DISCORD_TOKEN) throw new Error("DISCORD_TOKEN not set");
  if (!process.env.DISCORD_CLIENT_ID) throw new Error("DISCORD_CLIENT_ID not set");

  await loadCommands();
  await loadEvents();
  await client.login(process.env.DISCORD_TOKEN);
}

main().catch(console.error);
