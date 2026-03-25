import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { db } from "../../db/index.js";
import { userCoins, coinTransfers } from "../../db/index.js";
import { and, eq } from "drizzle-orm";
import { errorEmbed, BLOOD_RED } from "../../lib/embed.js";

export const data = new SlashCommandBuilder()
  .setName("transfer")
  .setDescription("Transferir moedas para outro usuário")
  .addUserOption((o) =>
    o.setName("usuario").setDescription("Usuário que vai receber").setRequired(true)
  )
  .addIntegerOption((o) =>
    o.setName("quantidade").setDescription("Quantidade de moedas a transferir").setRequired(true).setMinValue(1)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guild!.id;
  const fromUser = interaction.user;
  const toUser = interaction.options.getUser("usuario", true);
  const amount = interaction.options.getInteger("quantidade", true);

  if (toUser.id === fromUser.id) return interaction.reply({ embeds: [errorEmbed("Você não pode transferir moedas para si mesmo!")], ephemeral: true });
  if (toUser.bot) return interaction.reply({ embeds: [errorEmbed("Você não pode transferir moedas para bots!")], ephemeral: true });

  const fromRow = await db.select().from(userCoins).where(and(eq(userCoins.userId, fromUser.id), eq(userCoins.guildId, guildId)));
  const fromBalance = fromRow[0]?.balance ?? 0;

  if (fromBalance < amount) {
    return interaction.reply({ embeds: [errorEmbed(`Saldo insuficiente! Você tem **${fromBalance.toLocaleString("pt-BR")} moedas**.`)], ephemeral: true });
  }

  const transfer = await db.insert(coinTransfers).values({
    fromUserId: fromUser.id,
    toUserId: toUser.id,
    guildId,
    amount,
    status: "pending",
    channelId: interaction.channel!.id,
  }).returning();
  const transferId = transfer[0]!.id;

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`transfer_confirmar_${transferId}`).setLabel("✅ Confirmar Transferência").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`transfer_cancelar_${transferId}`).setLabel("❌ Cancelar").setStyle(ButtonStyle.Danger)
  );

  const embed = new EmbedBuilder()
    .setColor(BLOOD_RED)
    .setTitle("💸 Confirmação de Transferência")
    .setDescription(
      `Você quer transferir **${amount.toLocaleString("pt-BR")} moedas** para ${toUser}?\n\n` +
      `💰 Seu saldo atual: **${fromBalance.toLocaleString("pt-BR")} moedas**\n` +
      `💰 Após transferência: **${(fromBalance - amount).toLocaleString("pt-BR")} moedas**`
    )
    .setFooter({ text: "Apenas você pode confirmar ou cancelar." });

  await interaction.reply({ embeds: [embed], components: [row] });

  setTimeout(async () => {
    const check = await db.select().from(coinTransfers).where(eq(coinTransfers.id, transferId));
    if (check[0]?.status === "pending") {
      await db.update(coinTransfers).set({ status: "expired" }).where(eq(coinTransfers.id, transferId));
      await interaction.editReply({ embeds: [embed.setDescription("⏰ Transferência expirada.").setFooter(null)], components: [] }).catch(() => {});
    }
  }, 120000);
}
