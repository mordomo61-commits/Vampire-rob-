import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type Message,
  Events,
} from "discord.js";
import { db } from "../../db";
import { linkBlockConfig } from "../../db";
import { and, eq } from "drizzle-orm";
import { successEmbed, errorEmbed, BLOOD_RED } from "../../lib/embed.js";

const URL_REGEX = /(https?:\/\/[^\s]+|discord\.gg\/[^\s]+|www\.[^\s]+\.[a-z]{2,})/gi;

export const data = new SlashCommandBuilder()
  .setName("linkblock")
  .setDescription("Gerenciar bloqueio de links")
  .addSubcommand((s) =>
    s.setName("ativar")
      .setDescription("Bloquear links em um canal")
      .addChannelOption((o) => o.setName("canal").setDescription("Canal para bloquear links").setRequired(true))
      .addStringOption((o) => o.setName("mensagem").setDescription("Mensagem ao bloquear link (padrão: 🚫 Links não são permitidos!)").setRequired(false))
      .addRoleOption((o) => o.setName("cargo_permitido").setDescription("Cargo que pode enviar links (ex: staff)").setRequired(false))
  )
  .addSubcommand((s) =>
    s.setName("desativar")
      .setDescription("Desativar bloqueio de links em um canal")
      .addChannelOption((o) => o.setName("canal").setDescription("Canal para desativar o bloqueio").setRequired(true))
  )
  .addSubcommand((s) =>
    s.setName("lista")
      .setDescription("Ver canais com bloqueio de links ativo")
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  const sub = interaction.options.getSubcommand();

  if (sub === "ativar") {
    const channel = interaction.options.getChannel("canal", true);
    const message = interaction.options.getString("mensagem") ?? "🚫 Links não são permitidos neste canal!";
    const allowedRole = interaction.options.getRole("cargo_permitido");

    const existing = await db.select().from(linkBlockConfig).where(
      and(eq(linkBlockConfig.guildId, interaction.guild.id), eq(linkBlockConfig.channelId, channel.id))
    );

    if (existing.length) {
      await db.update(linkBlockConfig).set({
        message,
        allowedRoleIds: allowedRole ? [allowedRole.id] : [],
        active: true,
      }).where(and(eq(linkBlockConfig.guildId, interaction.guild.id), eq(linkBlockConfig.channelId, channel.id)));
    } else {
      await db.insert(linkBlockConfig).values({
        guildId: interaction.guild.id,
        channelId: channel.id,
        message,
        allowedRoleIds: allowedRole ? [allowedRole.id] : [],
        active: true,
      });
    }

    await interaction.reply({
      embeds: [
        successEmbed("🔒 Bloqueio de Links Ativado!")
          .addFields(
            { name: "📁 Canal", value: `<#${channel.id}>`, inline: true },
            { name: "💬 Mensagem", value: message, inline: false },
            { name: "✅ Cargo permitido", value: allowedRole ? `<@&${allowedRole.id}>` : "Nenhum (staff não precisa do cargo)", inline: false },
          )
      ],
    });
  }

  else if (sub === "desativar") {
    const channel = interaction.options.getChannel("canal", true);

    await db.update(linkBlockConfig).set({ active: false }).where(
      and(eq(linkBlockConfig.guildId, interaction.guild.id), eq(linkBlockConfig.channelId, channel.id))
    );

    await interaction.reply({ embeds: [successEmbed("🔓 Bloqueio Desativado", `Links liberados em <#${channel.id}>!`)] });
  }

  else if (sub === "lista") {
    const rows = await db.select().from(linkBlockConfig).where(
      and(eq(linkBlockConfig.guildId, interaction.guild.id), eq(linkBlockConfig.active, true))
    );

    if (!rows.length) return interaction.reply({ embeds: [errorEmbed("Nenhum canal com bloqueio de links ativo.")], ephemeral: true });

    const list = rows.map((r) => `<#${r.channelId}> — "${r.message}"`).join("\n");
    await interaction.reply({ embeds: [successEmbed("🔒 Canais com Bloqueio de Links", list)] });
  }
}

export { URL_REGEX };
