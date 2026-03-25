import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { db } from "../../db/index.js";
import { userCoins } from "../../db/index.js";
import { and, eq } from "drizzle-orm";
import { BLOOD_RED, errorEmbed } from "../../lib/embed.js";

const DAILY_AMOUNT = 500;
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

export const data = new SlashCommandBuilder()
  .setName("daily")
  .setDescription(`Coletar suas moedas diárias (${DAILY_AMOUNT} moedas, uma vez por dia)`);

export async function execute(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guild!.id;
  const userId = interaction.user.id;

  const rows = await db.select().from(userCoins).where(and(eq(userCoins.userId, userId), eq(userCoins.guildId, guildId)));

  if (rows.length && rows[0]!.lastDaily) {
    const lastDaily = new Date(rows[0]!.lastDaily).getTime();
    const now = Date.now();
    const diff = now - lastDaily;

    if (diff < COOLDOWN_MS) {
      const remaining = COOLDOWN_MS - diff;
      const hours = Math.floor(remaining / 3600000);
      const minutes = Math.floor((remaining % 3600000) / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      return interaction.reply({
        embeds: [errorEmbed(`Você já coletou seu daily hoje!\n\n⏰ Próximo daily em: **${hours}h ${minutes}m ${seconds}s**`)],
        ephemeral: true,
      });
    }
  }

  const currentBalance = rows[0]?.balance ?? 0;
  const newBalance = currentBalance + DAILY_AMOUNT;
  const totalEarned = (rows[0]?.totalEarned ?? 0) + DAILY_AMOUNT;

  if (rows.length) {
    await db.update(userCoins).set({ balance: newBalance, totalEarned, lastDaily: new Date() })
      .where(and(eq(userCoins.userId, userId), eq(userCoins.guildId, guildId)));
  } else {
    await db.insert(userCoins).values({ userId, guildId, balance: newBalance, totalEarned, lastDaily: new Date() });
  }

  const embed = new EmbedBuilder()
    .setColor(BLOOD_RED)
    .setTitle("📅 Daily Coletado!")
    .setDescription(`Você recebeu **${DAILY_AMOUNT} moedas**!\n\n💰 Novo saldo: **${newBalance.toLocaleString("pt-BR")} moedas**`)
    .setThumbnail(interaction.user.displayAvatarURL())
    .setFooter({ text: "Volte amanhã para coletar mais!" });

  await interaction.reply({ embeds: [embed] });
}
