import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { db } from "../../db";
import { coinTransfers } from "../../db";
import { eq } from "drizzle-orm";
import { errorEmbed, BLOOD_RED } from "../../lib/embed.js";
import { getOrCreateWallet } from "./coins.js";

export const data = new SlashCommandBuilder()
  .setName("transferir")
  .setDescription("Transferir coins para outro usuário (ambos precisam confirmar)")
  .addUserOption((o) =>
    o.setName("usuario").setDescription("Para quem transferir").setRequired(true)
  )
  .addIntegerOption((o) =>
    o.setName("quantidade").setDescription("Quantidade de coins").setRequired(true).setMinValue(1)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;

  const target = interaction.options.getUser("usuario", true);
  const amount = interaction.options.getInteger("quantidade", true);

  if (target.id === interaction.user.id) {
    return interaction.reply({ embeds: [errorEmbed("Você não pode transferir coins para si mesmo!")], ephemeral: true });
  }
  if (target.bot) {
    return interaction.reply({ embeds: [errorEmbed("Você não pode transferir coins para um bot!")], ephemeral: true });
  }

  const senderWallet = await getOrCreateWallet(interaction.user.id, interaction.guild.id);
  if (senderWallet.balance < amount) {
    return interaction.reply({
      embeds: [errorEmbed(`Saldo insuficiente! Você tem apenas 🪙 ${senderWallet.balance.toLocaleString("pt-BR")} coins.`)],
      ephemeral: true,
    });
  }

  const [transfer] = await db.insert(coinTransfers).values({
    fromUserId: interaction.user.id,
    toUserId: target.id,
    guildId: interaction.guild.id,
    amount,
    channelId: interaction.channel!.id,
    status: "pending",
  }).returning();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`transfer_confirm_sender_${transfer.id}`)
      .setLabel("✅ Confirmar (Remetente)")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`transfer_confirm_receiver_${transfer.id}`)
      .setLabel("✅ Confirmar (Destinatário)")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`transfer_cancel_${transfer.id}`)
      .setLabel("❌ Cancelar")
      .setStyle(ButtonStyle.Danger),
  );

  await interaction.reply({
    content: `${target}`,
    embeds: [
      new EmbedBuilder().setColor(BLOOD_RED)
        .setTitle("💸 Confirmação de Transferência")
        .setDescription(
          `**De:** ${interaction.user}\n` +
          `**Para:** ${target}\n` +
          `**Valor:** 🪙 ${amount.toLocaleString("pt-BR")} coins\n\n` +
          `⚠️ **Ambos** precisam confirmar para realizar a transferência.\n` +
          `🕐 Esta proposta expira em **5 minutos**.`
        )
        .setFooter({ text: `Transferência #${transfer.id}` })
    ],
    components: [row],
  });

  // Auto-expire after 5 minutes
  setTimeout(async () => {
    const [current] = await db.select().from(coinTransfers).where(eq(coinTransfers.id, transfer.id)).catch(() => []);
    if (current && current.status === "pending") {
      await db.update(coinTransfers).set({ status: "expired" }).where(eq(coinTransfers.id, transfer.id)).catch(() => {});
    }
  }, 5 * 60 * 1000);
}
