import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { db } from "../../db/index.js";
import { userCoins, coinRequests } from "../../db/index.js";
import { and, eq } from "drizzle-orm";
import { errorEmbed, BLOOD_RED } from "../../lib/embed.js";

export const data = new SlashCommandBuilder()
  .setName("pedir")
  .setDescription("Pedir moedas a outro usuário do servidor")
  .addUserOption((o) =>
    o.setName("usuario").setDescription("Usuário para pedir moedas").setRequired(true)
  )
  .addIntegerOption((o) =>
    o.setName("quantidade").setDescription("Quantidade de moedas a pedir").setRequired(true).setMinValue(1)
  )
  .addStringOption((o) =>
    o.setName("motivo").setDescription("Por que você está pedindo?").setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guild!.id;
  const fromUser = interaction.user;
  const toUser = interaction.options.getUser("usuario", true);
  const amount = interaction.options.getInteger("quantidade", true);
  const motivo = interaction.options.getString("motivo") ?? "Sem motivo";

  if (toUser.id === fromUser.id) return interaction.reply({ embeds: [errorEmbed("Você não pode pedir moedas para si mesmo!")], ephemeral: true });
  if (toUser.bot) return interaction.reply({ embeds: [errorEmbed("Você não pode pedir moedas para um bot!")], ephemeral: true });

  const toUserCoins = await db.select().from(userCoins).where(and(eq(userCoins.userId, toUser.id), eq(userCoins.guildId, guildId)));
  const toBalance = toUserCoins[0]?.balance ?? 0;
  if (toBalance < amount) {
    return interaction.reply({ embeds: [errorEmbed(`${toUser.username} não tem moedas suficientes para essa requisição.`)], ephemeral: true });
  }

  const req = await db.insert(coinRequests).values({
    fromUserId: fromUser.id,
    toUserId: toUser.id,
    guildId,
    amount,
    status: "pending",
    channelId: interaction.channel!.id,
  }).returning();
  const reqId = req[0]!.id;

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`pedir_aceitar_${reqId}`).setLabel("✅ Aceitar").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`pedir_recusar_${reqId}`).setLabel("❌ Recusar").setStyle(ButtonStyle.Danger)
  );

  const embed = new EmbedBuilder()
    .setColor(BLOOD_RED)
    .setTitle("🤲 Pedido de Moedas")
    .setDescription(
      `${fromUser} está pedindo **${amount.toLocaleString("pt-BR")} moedas** para ${toUser}!\n\n` +
      `📝 **Motivo:** ${motivo}\n\n` +
      `${toUser.username}, você aceita?`
    )
    .setFooter({ text: "Expira em 2 minutos." });

  await interaction.reply({ embeds: [embed], components: [row] });

  setTimeout(async () => {
    const check = await db.select().from(coinRequests).where(eq(coinRequests.id, reqId));
    if (check[0]?.status === "pending") {
      await db.update(coinRequests).set({ status: "expired" }).where(eq(coinRequests.id, reqId));
      await interaction.editReply({ embeds: [embed.setDescription("⏰ Pedido de moedas expirado.").setFooter(null)], components: [] }).catch(() => {});
    }
  }, 120000);
}
