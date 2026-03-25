import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { db } from "../../db";
import { userCoins } from "../../db";
import { and, eq } from "drizzle-orm";
import { successEmbed, errorEmbed } from "../../lib/embed.js";
import { getOrCreateWallet, addCoins } from "./coins.js";

const DAILY_AMOUNT = 4500;
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

export const data = new SlashCommandBuilder()
  .setName("daily")
  .setDescription("Resgatar suas moedas diárias (4.500 coins a cada 24 horas)");

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;

  const wallet = await getOrCreateWallet(interaction.user.id, interaction.guild.id);
  const now = new Date();

  if (wallet.lastDaily) {
    const diff = now.getTime() - wallet.lastDaily.getTime();
    if (diff < COOLDOWN_MS) {
      const remaining = COOLDOWN_MS - diff;
      const hours = Math.floor(remaining / 3600000);
      const minutes = Math.floor((remaining % 3600000) / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);

      return interaction.reply({
        embeds: [
          errorEmbed(
            `Você já resgatou seu daily hoje!\n\n` +
            `⏳ **Próximo daily em:** ${hours}h ${minutes}m ${seconds}s\n\n` +
            `Volte amanhã para resgatar mais **🪙 4.500 coins**!`
          )
        ],
        ephemeral: true,
      });
    }
  }

  // Set lastDaily first to prevent race conditions
  await db.update(userCoins)
    .set({ lastDaily: now })
    .where(and(eq(userCoins.userId, interaction.user.id), eq(userCoins.guildId, interaction.guild.id)));

  // Then add the coins
  const newBalance = await addCoins(interaction.user.id, interaction.guild.id, DAILY_AMOUNT);

  await interaction.reply({
    embeds: [
      successEmbed("🎁 Daily Resgatado!")
        .setDescription(
          `Você resgatou **🪙 ${DAILY_AMOUNT.toLocaleString("pt-BR")} coins**!\n\n` +
          `**Saldo atual:** 🪙 ${newBalance.toLocaleString("pt-BR")}\n\n` +
          `⏳ Volte em **24 horas** para resgatar novamente!`
        )
        .setThumbnail(interaction.user.displayAvatarURL()),
    ],
  });
}
