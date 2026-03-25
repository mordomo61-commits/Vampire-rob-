import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  type ChatInputCommandInteraction,
  type TextChannel,
} from "discord.js";
import { db } from "../../db/index.js";
import { welcomeConfig, leaveConfig } from "../../db/index.js";
import { eq } from "drizzle-orm";
import { successEmbed, errorEmbed, BLOOD_RED } from "../../lib/embed.js";

export const data = [
  new SlashCommandBuilder()
    .setName("mensagemdeentrada")
    .setDescription("Configurar mensagens automáticas de boas-vindas ao entrar no servidor")
    .addSubcommand((s) =>
      s.setName("configurar")
        .setDescription("Configurar o sistema de boas-vindas")
        .addChannelOption((o) =>
          o.setName("canal").setDescription("Canal onde a mensagem será enviada").setRequired(true)
        )
        .addStringOption((o) =>
          o.setName("mensagem")
            .setDescription("Mensagem de boas-vindas. Use {user} para mencionar o membro, {server} para o nome do servidor")
            .setRequired(false)
        )
        .addStringOption((o) =>
          o.setName("titulo")
            .setDescription("Título do embed")
            .setRequired(false)
        )
        .addStringOption((o) =>
          o.setName("cor")
            .setDescription("Cor do embed (hex, ex: #FF0000). Padrão: #8B0000")
            .setRequired(false)
        )
    )
    .addSubcommand((s) =>
      s.setName("remover")
        .setDescription("Remover o sistema de mensagens de boas-vindas")
    )
    .addSubcommand((s) =>
      s.setName("testar")
        .setDescription("Testar a mensagem de boas-vindas configurada")
    )
    .addSubcommand((s) =>
      s.setName("status")
        .setDescription("Ver a configuração atual das boas-vindas")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("mensagemsaida")
    .setDescription("Configurar mensagens automáticas ao sair do servidor")
    .addSubcommand((s) =>
      s.setName("configurar")
        .setDescription("Configurar o sistema de mensagem de saída")
        .addChannelOption((o) =>
          o.setName("canal").setDescription("Canal onde a mensagem será enviada").setRequired(true)
        )
        .addStringOption((o) =>
          o.setName("mensagem")
            .setDescription("Mensagem de saída. Use {user} para o nome do membro, {server} para o nome do servidor")
            .setRequired(false)
        )
        .addStringOption((o) =>
          o.setName("titulo")
            .setDescription("Título do embed")
            .setRequired(false)
        )
        .addStringOption((o) =>
          o.setName("cor")
            .setDescription("Cor do embed (hex, ex: #FF0000). Padrão: #8B0000")
            .setRequired(false)
        )
    )
    .addSubcommand((s) =>
      s.setName("remover")
        .setDescription("Remover o sistema de mensagens de saída")
    )
    .addSubcommand((s) =>
      s.setName("testar")
        .setDescription("Testar a mensagem de saída configurada")
    )
    .addSubcommand((s) =>
      s.setName("status")
        .setDescription("Ver a configuração atual das mensagens de saída")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
];

function parseColor(hex: string | null): string {
  if (!hex) return "#8B0000";
  const clean = hex.startsWith("#") ? hex : `#${hex}`;
  if (/^#[0-9A-Fa-f]{6}$/.test(clean)) return clean;
  return "#8B0000";
}

function replacePlaceholders(text: string, memberName: string, serverName: string, mention: string): string {
  return text
    .replace(/\{user\}/g, mention)
    .replace(/\{username\}/g, memberName)
    .replace(/\{server\}/g, serverName);
}

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  const cmd = interaction.commandName;
  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;
  const isWelcome = cmd === "mensagemdeentrada";
  const table = isWelcome ? welcomeConfig : leaveConfig;
  const label = isWelcome ? "boas-vindas" : "saída";

  if (sub === "configurar") {
    const channel = interaction.options.getChannel("canal", true);
    const mensagem = interaction.options.getString("mensagem") ??
      (isWelcome ? "👋 Bem-vindo(a) ao servidor, {user}!" : "😢 {user} saiu do servidor.");
    const titulo = interaction.options.getString("titulo") ??
      (isWelcome ? "👋 Novo Membro!" : "👋 Membro Saiu");
    const cor = parseColor(interaction.options.getString("cor"));

    if (!("send" in channel)) {
      return interaction.reply({ embeds: [errorEmbed("Por favor, selecione um canal de texto válido.")], ephemeral: true });
    }

    const existing = await db.select().from(table).where(eq(table.guildId, guildId));

    if (existing.length) {
      await db.update(table).set({
        channelId: channel.id,
        message: mensagem,
        embedEnabled: true,
        embedColor: cor,
        embedTitle: titulo,
      }).where(eq(table.guildId, guildId));
    } else {
      await db.insert(table).values({
        guildId,
        channelId: channel.id,
        message: mensagem,
        embedEnabled: true,
        embedColor: cor,
        embedTitle: titulo,
      });
    }

    const preview = new EmbedBuilder()
      .setColor(parseInt(cor.replace("#", ""), 16))
      .setTitle(titulo)
      .setDescription(mensagem
        .replace(/\{user\}/g, `@${interaction.user.username}`)
        .replace(/\{username\}/g, interaction.user.username)
        .replace(/\{server\}/g, interaction.guild.name))
      .setFooter({ text: "Pré-visualização da mensagem" });

    await interaction.reply({
      embeds: [
        successEmbed(`✅ Mensagem de ${label} configurada!`)
          .addFields(
            { name: "📁 Canal", value: `<#${channel.id}>`, inline: true },
            { name: "🎨 Cor", value: cor, inline: true },
            { name: "📝 Placeholders", value: "`{user}` → menciona o membro\n`{username}` → nome do membro\n`{server}` → nome do servidor", inline: false },
          ),
        preview,
      ],
    });
  }

  else if (sub === "remover") {
    const existing = await db.select().from(table).where(eq(table.guildId, guildId));
    if (!existing.length) {
      return interaction.reply({ embeds: [errorEmbed(`Nenhuma mensagem de ${label} configurada neste servidor.`)], ephemeral: true });
    }

    await db.delete(table).where(eq(table.guildId, guildId));

    await interaction.reply({ embeds: [successEmbed(`🗑️ Mensagem de ${label} removida`, `O sistema de mensagem de ${label} foi desativado neste servidor.`)] });
  }

  else if (sub === "testar") {
    const config = await db.select().from(table).where(eq(table.guildId, guildId));
    if (!config.length) {
      return interaction.reply({ embeds: [errorEmbed(`Nenhuma mensagem de ${label} configurada. Use /${cmd === "mensagemdeentrada" ? "mensagemdeentrada" : "mensagemsaida"} configurar primeiro.`)], ephemeral: true });
    }

    const cfg = config[0]!;
    const member = interaction.member as any;
    const displayName = member?.displayName ?? interaction.user.username;
    const mention = `<@${interaction.user.id}>`;
    const serverName = interaction.guild.name;

    const finalMsg = replacePlaceholders(cfg.message, displayName, serverName, mention);

    const previewEmbed = new EmbedBuilder()
      .setColor(parseInt(cfg.embedColor.replace("#", ""), 16))
      .setTitle(cfg.embedTitle)
      .setDescription(finalMsg)
      .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
      .setTimestamp()
      .setFooter({ text: `${interaction.guild.memberCount} membros` });

    const channel = await interaction.guild.channels.fetch(cfg.channelId).catch(() => null) as TextChannel | null;
    if (!channel || !("send" in channel)) {
      return interaction.reply({ embeds: [errorEmbed(`Canal configurado (<#${cfg.channelId}>) não encontrado ou inválido. Reconfigure.`)], ephemeral: true });
    }

    await channel.send({ embeds: [previewEmbed] });
    await interaction.reply({ embeds: [successEmbed("✅ Teste enviado!", `Mensagem de ${label} enviada em <#${cfg.channelId}>!`)], ephemeral: true });
  }

  else if (sub === "status") {
    const config = await db.select().from(table).where(eq(table.guildId, guildId));
    if (!config.length) {
      return interaction.reply({ embeds: [errorEmbed(`Nenhuma mensagem de ${label} configurada neste servidor.`)], ephemeral: true });
    }

    const cfg = config[0]!;
    const embed = successEmbed(`📋 Configuração de ${label.charAt(0).toUpperCase() + label.slice(1)}`)
      .addFields(
        { name: "📁 Canal", value: `<#${cfg.channelId}>`, inline: true },
        { name: "🎨 Cor", value: cfg.embedColor, inline: true },
        { name: "🏷️ Título", value: cfg.embedTitle, inline: false },
        { name: "💬 Mensagem", value: cfg.message, inline: false },
      );

    await interaction.reply({ embeds: [embed] });
  }
}
