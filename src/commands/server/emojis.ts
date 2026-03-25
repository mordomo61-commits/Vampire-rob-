import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";
import { successEmbed, errorEmbed } from "../../lib/embed.js";

export const data = [
  new SlashCommandBuilder()
    .setName("createemoji")
    .setDescription("Criar um emoji no servidor a partir de uma imagem")
    .addStringOption((o) =>
      o.setName("nome").setDescription("Nome do emoji (apenas letras, números e _)").setRequired(true)
    )
    .addAttachmentOption((o) =>
      o.setName("imagem").setDescription("Imagem do emoji (PNG/GIF, máx 256KB)").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEmojisAndStickers),

  new SlashCommandBuilder()
    .setName("deleteemoji")
    .setDescription("Remover um emoji do servidor")
    .addStringOption((o) =>
      o.setName("emoji").setDescription("ID ou nome do emoji a remover").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEmojisAndStickers),

  new SlashCommandBuilder()
    .setName("stickercreate")
    .setDescription("Criar uma figurinha no servidor")
    .addStringOption((o) =>
      o.setName("nome").setDescription("Nome da figurinha (2-30 caracteres)").setRequired(true)
    )
    .addAttachmentOption((o) =>
      o.setName("imagem").setDescription("Imagem PNG (máx 512KB)").setRequired(true)
    )
    .addStringOption((o) =>
      o.setName("emoji_relacionado").setDescription("Emoji relacionado (ex: 😀)").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEmojisAndStickers),

  new SlashCommandBuilder()
    .setName("stickerdelete")
    .setDescription("Remover uma figurinha do servidor")
    .addStringOption((o) =>
      o.setName("nome").setDescription("Nome da figurinha a remover").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEmojisAndStickers),
];

export async function execute(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild;
  if (!guild) return interaction.reply({ embeds: [errorEmbed("Comando apenas para servidores.")], ephemeral: true });

  const cmd = interaction.commandName;

  if (cmd === "createemoji") {
    const name = interaction.options.getString("nome", true).replace(/\s/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
    const attachment = interaction.options.getAttachment("imagem", true);

    await interaction.deferReply();

    if (attachment.size > 256000) {
      return interaction.editReply({ embeds: [errorEmbed("Imagem muito grande para emoji. Máximo 256KB.")] });
    }

    const emoji = await guild.emojis.create({ attachment: attachment.url, name }).catch((e) => { console.error(e); return null; });
    if (!emoji) return interaction.editReply({ embeds: [errorEmbed("Falha ao criar emoji. Verifique se há espaço disponível ou se o formato é válido (PNG/GIF/WEBP).")] });

    await interaction.editReply({
      embeds: [successEmbed("✅ Emoji Criado!", `Emoji **${emoji.name}** criado com sucesso!\n${emoji.toString()}`)],
    });
  }

  else if (cmd === "deleteemoji") {
    const input = interaction.options.getString("emoji", true).trim();
    const emojiId = input.match(/<a?:.+:(\d+)>/)?.[1] ?? input;
    const emoji = guild.emojis.cache.find(
      (e) => e.name === input || e.id === emojiId || e.id === input
    );
    if (!emoji) return interaction.reply({ embeds: [errorEmbed("Emoji não encontrado. Use o nome ou o ID.")], ephemeral: true });

    const emojiName = emoji.name;
    await emoji.delete();
    await interaction.reply({ embeds: [successEmbed("🗑️ Emoji Removido", `Emoji **${emojiName}** foi removido.`)] });
  }

  else if (cmd === "stickercreate") {
    const name = interaction.options.getString("nome", true).trim();
    const attachment = interaction.options.getAttachment("imagem", true);
    const relatedEmoji = interaction.options.getString("emoji_relacionado") ?? "⭐";

    if (name.length < 2 || name.length > 30) {
      return interaction.reply({ embeds: [errorEmbed("O nome da figurinha deve ter entre 2 e 30 caracteres.")], ephemeral: true });
    }

    await interaction.deferReply();

    if (attachment.size > 512000) {
      return interaction.editReply({ embeds: [errorEmbed("Imagem muito grande. Máximo 512KB para figurinhas.")] });
    }

    if (!attachment.contentType?.includes("png") && !attachment.contentType?.includes("apng")) {
      return interaction.editReply({ embeds: [errorEmbed("Formato inválido. Use PNG ou APNG para figurinhas.")] });
    }

    const sticker = await guild.stickers.create({
      file: attachment.url,
      name,
      tags: relatedEmoji.replace(/\s/g, "").slice(0, 1) || "⭐",
      description: `Figurinha: ${name}`,
    }).catch((e) => { console.error("Sticker create error:", e); return null; });

    if (!sticker) return interaction.editReply({ embeds: [errorEmbed("Falha ao criar figurinha. Verifique se: o arquivo é PNG válido, o servidor tem espaço e o bot tem permissão.")] });

    await interaction.editReply({
      embeds: [successEmbed("✅ Figurinha Criada!", `Figurinha **${sticker.name}** criada com sucesso!`)],
    });
  }

  else if (cmd === "stickerdelete") {
    const name = interaction.options.getString("nome", true);

    await guild.stickers.fetch().catch(() => null);
    const sticker = guild.stickers.cache.find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (!sticker) return interaction.reply({ embeds: [errorEmbed(`Figurinha **${name}** não encontrada.`)], ephemeral: true });

    await sticker.delete();
    await interaction.reply({ embeds: [successEmbed("🗑️ Figurinha Removida", `Figurinha **${name}** foi removida.`)] });
  }
}
