import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  type TextChannel,
} from "discord.js";
import { db } from "../../db";
import { webhooksTable } from "../../db";
import { and, eq } from "drizzle-orm";
import { successEmbed, errorEmbed, BLOOD_RED } from "../../lib/embed.js";

export const data = new SlashCommandBuilder()
  .setName("webhook")
  .setDescription("Gerenciar webhooks do servidor")
  .addSubcommand((s) =>
    s.setName("criar")
      .setDescription("Criar um webhook personalizado")
      .addStringOption((o) => o.setName("nome").setDescription("Nome do webhook").setRequired(true))
      .addStringOption((o) => o.setName("avatar").setDescription("URL do avatar do webhook").setRequired(false))
  )
  .addSubcommand((s) =>
    s.setName("ver")
      .setDescription("Ver webhooks criados neste servidor")
  )
  .addSubcommand((s) =>
    s.setName("excluir")
      .setDescription("Excluir um webhook")
      .addIntegerOption((o) => o.setName("id").setDescription("ID do webhook na lista").setRequired(true))
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageWebhooks);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  const sub = interaction.options.getSubcommand();
  const channel = interaction.channel as TextChannel;

  if (sub === "criar") {
    const nome = interaction.options.getString("nome", true);
    const avatarUrl = interaction.options.getString("avatar") ?? undefined;

    await interaction.deferReply({ ephemeral: true });

    const webhook = await channel.createWebhook({ name: nome, avatar: avatarUrl }).catch(() => null);
    if (!webhook) return interaction.editReply({ embeds: [errorEmbed("Falha ao criar webhook. Verifique as permissões.")] });

    await db.insert(webhooksTable).values({
      guildId: interaction.guild.id,
      name: nome,
      url: webhook.url,
      avatarUrl: avatarUrl ?? null,
      webhookId: webhook.id,
    });

    await interaction.editReply({
      embeds: [
        successEmbed("✅ Webhook Criado!")
          .addFields(
            { name: "📛 Nome", value: nome, inline: true },
            { name: "🔗 URL", value: `\`${webhook.url}\`` }
          )
      ],
    });
  }

  else if (sub === "ver") {
    const rows = await db.select().from(webhooksTable).where(eq(webhooksTable.guildId, interaction.guild.id));
    if (!rows.length) return interaction.reply({ embeds: [errorEmbed("Nenhum webhook criado neste servidor.")], ephemeral: true });

    const list = rows.map((r, i) => `**${i + 1}.** ${r.name}\n🔗 \`${r.url}\``).join("\n\n");
    await interaction.reply({ embeds: [successEmbed("🔗 Webhooks do Servidor", list)], ephemeral: true });
  }

  else if (sub === "excluir") {
    const id = interaction.options.getInteger("id", true);
    const rows = await db.select().from(webhooksTable).where(eq(webhooksTable.guildId, interaction.guild.id));
    const row = rows[id - 1];
    if (!row) return interaction.reply({ embeds: [errorEmbed("Webhook não encontrado.")], ephemeral: true });

    // Delete from Discord
    const wh = await interaction.guild.fetchWebhooks().then((whs) => whs.get(row.webhookId)).catch(() => null);
    if (wh) await wh.delete().catch(() => {});

    await db.delete(webhooksTable).where(eq(webhooksTable.id, row.id));
    await interaction.reply({ embeds: [successEmbed("🗑️ Webhook Excluído", `**${row.name}** foi removido.`)] });
  }
}
