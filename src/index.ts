import { config } from "dotenv";
config();

import {
  Client,
  GatewayIntentBits,
  Events,
  Partials,
  type GuildMember,
  type PartialGuildMember,
} from "discord.js";

import { db } from "./db/index.js";
import {
  autoRoles,
  reactionRoles,
  linkBlockConfig,
  welcomeConfig,
  leaveConfig,
} from "./db/index.js";
import { and, eq } from "drizzle-orm";

import { handleButton } from "./interactions/buttons.js";
import { handleModal } from "./interactions/modals.js";
import { handleSelect } from "./interactions/selects.js";

import { URL_REGEX } from "./commands/server/linkblock.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember],
});

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ Bot online como ${c.user.tag}`);
  console.log(`📡 Servidores: ${c.guilds.cache.size}`);

  const { ActivityType } = await import("discord.js");
  c.user.setPresence({
    activities: [{ name: `/ajuda | ${c.guilds.cache.size} servidores`, type: ActivityType.Watching }],
    status: "online",
  });
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const commandFiles: Record<string, any> = {
        embed: () => import("./commands/embed/embed.js"),
        ban: () => import("./commands/moderation/ban.js"),
        kick: () => import("./commands/moderation/kick.js"),
        mute: () => import("./commands/moderation/mute.js"),
        clear: () => import("./commands/moderation/clear.js"),
        autorole: () => import("./commands/roles/autorole.js"),
        autorolebutton: () => import("./commands/roles/autorole.js"),
        buttonrole: () => import("./commands/roles/buttonrole.js"),
        reactionrole: () => import("./commands/roles/reactionrole.js"),
        servericon: () => import("./commands/server/servericon.js"),
        createemoji: () => import("./commands/server/emojis.js"),
        deleteemoji: () => import("./commands/server/emojis.js"),
        stickercreate: () => import("./commands/server/emojis.js"),
        stickerdelete: () => import("./commands/server/emojis.js"),
        linkblock: () => import("./commands/server/linkblock.js"),
        ajuda: () => import("./commands/server/ajuda.js"),
        coins: () => import("./commands/minigames/coins.js"),
        daily: () => import("./commands/minigames/daily.js"),
        pedir: () => import("./commands/minigames/pedir.js"),
        transfer: () => import("./commands/minigames/transfer.js"),
        blackjack: () => import("./commands/minigames/blackjack.js"),
        coinflip: () => import("./commands/minigames/coinflip.js"),
        mines: () => import("./commands/minigames/mines.js"),
        quiz: () => import("./commands/minigames/quiz.js"),
        ticketpainel: () => import("./commands/tickets/ticketpainel.js"),
        mensagemdeentrada: () => import("./commands/welcome/welcome.js"),
        mensagemsaida: () => import("./commands/welcome/welcome.js"),
      };

      const loader = commandFiles[interaction.commandName];
      if (loader) {
        const mod = await loader();
        await mod.execute(interaction);
      } else {
        await interaction.reply({ content: "Comando não reconhecido.", ephemeral: true });
      }
    }

    else if (interaction.isButton()) {
      if (interaction.customId.startsWith("embed_send_")) {
        await interaction.reply({ embeds: (interaction.message.embeds.slice(1) as any), ephemeral: false });
        await interaction.message.delete().catch(() => null);
        return;
      }
      if (interaction.customId === "embed_cancel") {
        await interaction.update({ content: "❌ Embed cancelado.", embeds: [], components: [] });
        return;
      }
      await handleButton(interaction);
    }

    else if (interaction.isModalSubmit()) {
      await handleModal(interaction);
    }

    else if (interaction.isStringSelectMenu()) {
      await handleSelect(interaction);
    }
  } catch (err) {
    console.error("InteractionCreate error:", err);
    try {
      const errMsg = { content: "Ocorreu um erro ao processar este comando.", ephemeral: true };
      if (!interaction.isRepliable()) return;
      if ((interaction as any).replied || (interaction as any).deferred) {
        await (interaction as any).followUp(errMsg).catch(() => {});
      } else {
        await (interaction as any).reply(errMsg).catch(() => {});
      }
    } catch {}
  }
});

client.on(Events.GuildMemberAdd, async (member: GuildMember | PartialGuildMember) => {
  try {
    const guild = member.guild;

    const roles = await db.select().from(autoRoles).where(
      and(eq(autoRoles.guildId, guild.id), eq(autoRoles.method, "join"))
    );

    for (const role of roles) {
      await (member as GuildMember).roles.add(role.roleId).catch((e) =>
        console.error(`AutoRole error (add ${role.roleId}):`, e)
      );
    }

    const config = await db.select().from(welcomeConfig).where(eq(welcomeConfig.guildId, guild.id));
    if (!config.length) return;

    const cfg = config[0]!;
    const channel = guild.channels.cache.get(cfg.channelId);
    if (!channel || !("send" in channel)) return;

    const fullMember = member.partial ? await member.fetch().catch(() => null) : member as GuildMember;
    if (!fullMember) return;

    const displayName = fullMember.displayName ?? fullMember.user.username;
    const mention = `<@${fullMember.user.id}>`;
    const serverName = guild.name;

    const finalMsg = cfg.message
      .replace(/\{user\}/g, mention)
      .replace(/\{username\}/g, displayName)
      .replace(/\{server\}/g, serverName);

    const { EmbedBuilder } = await import("discord.js");
    const embed = new EmbedBuilder()
      .setColor(parseInt(cfg.embedColor.replace("#", ""), 16))
      .setTitle(cfg.embedTitle)
      .setDescription(finalMsg)
      .setThumbnail(fullMember.user.displayAvatarURL({ size: 256 }))
      .setTimestamp()
      .setFooter({ text: `${guild.memberCount} membros` });

    await (channel as any).send({ embeds: [embed] }).catch((e: Error) =>
      console.error("Welcome message send error:", e)
    );
  } catch (err) {
    console.error("GuildMemberAdd error:", err);
  }
});

client.on(Events.GuildMemberRemove, async (member: GuildMember | PartialGuildMember) => {
  try {
    const guild = member.guild;

    const config = await db.select().from(leaveConfig).where(eq(leaveConfig.guildId, guild.id));
    if (!config.length) return;

    const cfg = config[0]!;
    const channel = guild.channels.cache.get(cfg.channelId);
    if (!channel || !("send" in channel)) return;

    const fullMember = member.partial ? await member.fetch().catch(() => null) : member as GuildMember;
    const displayName = fullMember?.displayName ?? (member as any).user?.username ?? "Membro";
    const mention = fullMember ? `<@${fullMember.user.id}>` : displayName;
    const serverName = guild.name;

    const finalMsg = cfg.message
      .replace(/\{user\}/g, mention)
      .replace(/\{username\}/g, displayName)
      .replace(/\{server\}/g, serverName);

    const { EmbedBuilder } = await import("discord.js");
    const embed = new EmbedBuilder()
      .setColor(parseInt(cfg.embedColor.replace("#", ""), 16))
      .setTitle(cfg.embedTitle)
      .setDescription(finalMsg)
      .setTimestamp()
      .setFooter({ text: `${guild.memberCount} membros` });

    const avatarUrl = fullMember?.user?.displayAvatarURL({ size: 256 });
    if (avatarUrl) embed.setThumbnail(avatarUrl);

    await (channel as any).send({ embeds: [embed] }).catch((e: Error) =>
      console.error("Leave message send error:", e)
    );
  } catch (err) {
    console.error("GuildMemberRemove error:", err);
  }
});

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (user.bot) return;
  try {
    const message = reaction.partial ? await reaction.message.fetch() : reaction.message;
    if (!message.guild) return;

    const emoji = reaction.emoji.id
      ? `<${reaction.emoji.animated ? "a" : ""}:${reaction.emoji.name}:${reaction.emoji.id}>`
      : reaction.emoji.name ?? "";

    const rows = await db.select().from(reactionRoles).where(
      and(
        eq(reactionRoles.guildId, message.guild.id),
        eq(reactionRoles.messageId, message.id),
        eq(reactionRoles.emoji, emoji)
      )
    );

    if (!rows.length) return;

    const member = await message.guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    for (const row of rows) {
      await member.roles.add(row.roleId).catch((e) => console.error("ReactionRole add error:", e));
    }
  } catch (err) {
    console.error("MessageReactionAdd error:", err);
  }
});

client.on(Events.MessageReactionRemove, async (reaction, user) => {
  if (user.bot) return;
  try {
    const message = reaction.partial ? await reaction.message.fetch() : reaction.message;
    if (!message.guild) return;

    const emoji = reaction.emoji.id
      ? `<${reaction.emoji.animated ? "a" : ""}:${reaction.emoji.name}:${reaction.emoji.id}>`
      : reaction.emoji.name ?? "";

    const rows = await db.select().from(reactionRoles).where(
      and(
        eq(reactionRoles.guildId, message.guild.id),
        eq(reactionRoles.messageId, message.id),
        eq(reactionRoles.emoji, emoji)
      )
    );

    if (!rows.length) return;

    const member = await message.guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    for (const row of rows) {
      await member.roles.remove(row.roleId).catch((e) => console.error("ReactionRole remove error:", e));
    }
  } catch (err) {
    console.error("MessageReactionRemove error:", err);
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;
  try {
    const configs = await db.select().from(linkBlockConfig).where(
      and(eq(linkBlockConfig.guildId, message.guild.id), eq(linkBlockConfig.channelId, message.channel.id), eq(linkBlockConfig.active, true))
    );
    if (!configs.length) return;

    const cfg = configs[0]!;

    const member = message.member;
    if (!member) return;

    if (member.permissions.has("ManageMessages")) return;

    if (cfg.allowedRoleIds?.some((r) => member.roles.cache.has(r))) return;

    if (URL_REGEX.test(message.content)) {
      URL_REGEX.lastIndex = 0;
      await message.delete().catch(() => null);
      const warn = await message.channel.send({ content: `${message.author} ${cfg.message}` });
      setTimeout(() => warn.delete().catch(() => null), 5000);
    }
  } catch (err) {
    console.error("MessageCreate (linkblock) error:", err);
  }
});

const token = process.env.DISCORD_TOKEN;
if (!token) throw new Error("DISCORD_TOKEN não definido no .env");

client.login(token).catch((err) => {
  console.error("Falha ao fazer login no Discord:", err);
  process.exit(1);
});
