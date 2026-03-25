import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";
import { db } from "../../db";
import { reactionRoles } from "../../db";
import { and, eq } from "drizzle-orm";
import { successEmbed, errorEmbed } from "../../lib/embed.js";

export const data = new SlashCommandBuilder()
  .setName("reactionrole")
  .setDescription("Configurar cargo por reação")
  .addSubcommand((s) =>
    s.setName("add")
      .setDescription("Adicionar reaction role")
      .addStringOption((o) => o.setName("mensagem_id").setDescription("ID da mensagem").setRequired(true))
      .addStringOption((o) => o.setName("emoji").setDescription("Emoji (ex: 👍 ou <:nome:id>)").setRequired(true))
      .addRoleOption((o) => o.setName("cargo").setDescription("Cargo a atribuir").setRequired(true))
      .addChannelOption((o) => o.setName("canal").setDescription("Canal onde está a mensagem").setRequired(false))
  )
  .addSubcommand((s) =>
    s.setName("remove")
      .setDescription("Remover reaction role")
      .addStringOption((o) => o.setName("mensagem_id").setDescription("ID da mensagem").setRequired(true))
      .addStringOption((o) => o.setName("emoji").setDescription("Emoji").setRequired(true))
  )
  .addSubcommand((s) =>
    s.setName("lista")
      .setDescription("Listar todos os reaction roles do servidor")
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  const sub = interaction.options.getSubcommand();

  if (sub === "add") {
    const messageId = interaction.options.getString("mensagem_id", true);
    const emoji = interaction.options.getString("emoji", true);
    const role = interaction.options.getRole("cargo", true);
    const channel = interaction.options.getChannel("canal") ?? interaction.channel;

    if (!channel || !("messages" in channel)) {
      return interaction.reply({ embeds: [errorEmbed("Canal inválido.")], ephemeral: true });
    }

    const message = await (channel as any).messages.fetch(messageId).catch(() => null);
    if (!message) return interaction.reply({ embeds: [errorEmbed("Mensagem não encontrada.")], ephemeral: true });

    await message.react(emoji).catch(() => null);

    await db.insert(reactionRoles).values({
      guildId: interaction.guild.id,
      channelId: channel.id,
      messageId,
      emoji,
      roleId: role.id,
    }).onConflictDoNothing();

    await interaction.reply({
      embeds: [successEmbed("✅ Reaction Role Configurado", `Emoji **${emoji}** → Cargo ${role} configurado com sucesso!`)],
    });
  }

  else if (sub === "remove") {
    const messageId = interaction.options.getString("mensagem_id", true);
    const emoji = interaction.options.getString("emoji", true);

    await db.delete(reactionRoles).where(
      and(
        eq(reactionRoles.guildId, interaction.guild.id),
        eq(reactionRoles.messageId, messageId),
        eq(reactionRoles.emoji, emoji)
      )
    );

    await interaction.reply({ embeds: [successEmbed("🗑️ Reaction Role Removido", `Configuração removida com sucesso.`)] });
  }

  else if (sub === "lista") {
    const rows = await db.select().from(reactionRoles).where(eq(reactionRoles.guildId, interaction.guild.id));
    if (!rows.length) return interaction.reply({ embeds: [errorEmbed("Nenhum reaction role configurado.")], ephemeral: true });

    const list = rows.map((r) => `**Msg:** \`${r.messageId}\` | **Emoji:** ${r.emoji} | **Cargo:** <@&${r.roleId}>`).join("\n");

    await interaction.reply({
      embeds: [successEmbed("📋 Reaction Roles", list)],
    });
  }
}
