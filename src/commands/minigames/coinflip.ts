import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { db } from "../../db/index.js";
import { userCoins } from "../../db/index.js";
import { and, eq } from "drizzle-orm";
import { errorEmbed, BLOOD_RED } from "../../lib/embed.js";

export const data = new SlashCommandBuilder()
  .setName("coinflip")
  .setDescription("Cara ou coroa — aposte moedas")
  .addIntegerOption((o) =>
    o.setName("aposta").setDescription("Quantidade de moedas a apostar").setRequired(true).setMinValue(1)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const bet = interaction.options.getInteger("aposta", true);
  const guildId = interaction.guild!.id;
  const userId = interaction.user.id;

  const coinRow = await db.select().from(userCoins).where(and(eq(userCoins.userId, userId), eq(userCoins.guildId, guildId)));
  const balance = coinRow[0]?.balance ?? 0;

  if (balance < bet) {
    return interaction.reply({ embeds: [errorEmbed(`Saldo insuficiente! Você tem **${balance} moedas**.`)], ephemeral: true });
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`coinflip_cara_${userId}_${bet}`)
      .setLabel("🪙 Cara")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`coinflip_coroa_${userId}_${bet}`)
      .setLabel("🦅 Coroa")
      .setStyle(ButtonStyle.Secondary)
  );

  const embed = new EmbedBuilder()
    .setColor(BLOOD_RED)
    .setTitle("🪙 Coinflip")
    .setDescription(`Você tem **${balance} moedas**.\nApostando **${bet} moedas**!\n\nEscolha: **Cara** ou **Coroa**?`)
    .setFooter({ text: "Você tem 30 segundos para escolher." });

  await interaction.reply({ embeds: [embed], components: [row] });
}
