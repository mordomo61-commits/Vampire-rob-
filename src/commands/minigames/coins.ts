import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { db } from "../../db";
import { userCoins } from "../../db";
import { eq, desc, and } from "drizzle-orm";
import { successEmbed, errorEmbed } from "../../lib/embed.js";

export const data = [
  new SlashCommandBuilder()
    .setName("saldo")
    .setDescription("Ver seu saldo de coins")
    .addUserOption((o) => o.setName("usuario").setDescription("Ver saldo de outro usuário").setRequired(false)),

  new SlashCommandBuilder()
    .setName("ranking")
    .setDescription("Ver ranking de coins")
    .addSubcommand((s) => s.setName("global").setDescription("Ranking global de todos os servidores"))
    .addSubcommand((s) => s.setName("serve").setDescription("Ranking apenas deste servidor")),
];

export async function getOrCreateWallet(userId: string, guildId: string) {
  const [existing] = await db.select().from(userCoins).where(
    and(eq(userCoins.userId, userId), eq(userCoins.guildId, guildId))
  );
  if (existing) return existing;

  const [created] = await db.insert(userCoins).values({ userId, guildId, balance: 0, totalEarned: 0 }).returning();
  return created;
}

export async function addCoins(userId: string, guildId: string, amount: number) {
  const wallet = await getOrCreateWallet(userId, guildId);
  const newBalance = Math.max(0, wallet.balance + amount);
  const newEarned = amount > 0 ? wallet.totalEarned + amount : wallet.totalEarned;
  await db.update(userCoins).set({ balance: newBalance, totalEarned: newEarned, updatedAt: new Date() })
    .where(and(eq(userCoins.userId, userId), eq(userCoins.guildId, guildId)));
  return newBalance;
}

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  const cmd = interaction.commandName;

  if (cmd === "saldo") {
    const target = interaction.options.getUser("usuario") ?? interaction.user;
    const wallet = await getOrCreateWallet(target.id, interaction.guild.id);

    await interaction.reply({
      embeds: [
        successEmbed(`💰 Saldo de ${target.displayName}`)
          .setDescription(`**Coins:** 🪙 ${wallet.balance.toLocaleString("pt-BR")}\n**Total ganho:** 🏆 ${wallet.totalEarned.toLocaleString("pt-BR")}`)
          .setThumbnail(target.displayAvatarURL()),
      ],
    });
  }

  else if (cmd === "ranking") {
    const sub = interaction.options.getSubcommand();

    if (sub === "global") {
      const top = await db.select().from(userCoins).orderBy(desc(userCoins.balance)).limit(10);
      if (!top.length) return interaction.reply({ embeds: [errorEmbed("Nenhum dado disponível.")], ephemeral: true });

      const medals = ["🥇", "🥈", "🥉"];
      const list = top.map((r, i) =>
        `${medals[i] ?? `**${i + 1}.**`} <@${r.userId}> — 🪙 ${r.balance.toLocaleString("pt-BR")}`
      ).join("\n");

      await interaction.reply({ embeds: [successEmbed("🏆 Ranking Global de Coins", list)] });
    }

    else if (sub === "serve") {
      const top = await db.select().from(userCoins)
        .where(eq(userCoins.guildId, interaction.guild.id))
        .orderBy(desc(userCoins.balance)).limit(10);

      if (!top.length) return interaction.reply({ embeds: [errorEmbed("Nenhum dado disponível.")], ephemeral: true });

      const medals = ["🥇", "🥈", "🥉"];
      const list = top.map((r, i) =>
        `${medals[i] ?? `**${i + 1}.**`} <@${r.userId}> — 🪙 ${r.balance.toLocaleString("pt-BR")}`
      ).join("\n");

      await interaction.reply({ embeds: [successEmbed(`🏆 Ranking de ${interaction.guild.name}`, list)] });
    }
  }
}
