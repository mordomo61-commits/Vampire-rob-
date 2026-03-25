import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { db } from "../../db/index.js";
import { userCoins } from "../../db/index.js";
import { eq, desc, and } from "drizzle-orm";
import { BLOOD_RED, errorEmbed } from "../../lib/embed.js";

export const data = new SlashCommandBuilder()
  .setName("coins")
  .setDescription("Ver seu saldo de moedas e ranking do servidor")
  .addSubcommand((s) =>
    s.setName("saldo").setDescription("Ver seu saldo atual")
      .addUserOption((o) => o.setName("usuario").setDescription("Ver saldo de outro usuário").setRequired(false))
  )
  .addSubcommand((s) =>
    s.setName("top").setDescription("Ver o ranking de moedas do servidor")
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guild!.id;

  if (sub === "saldo") {
    const target = interaction.options.getUser("usuario") ?? interaction.user;
    const row = await db.select().from(userCoins).where(
      and(eq(userCoins.userId, target.id), eq(userCoins.guildId, guildId))
    );
    const bal = row[0]?.balance ?? 0;
    const totalEarned = row[0]?.totalEarned ?? 0;

    const embed = new EmbedBuilder()
      .setColor(BLOOD_RED)
      .setTitle(`💰 Saldo de ${target.username}`)
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: "💰 Saldo Atual", value: `**${bal.toLocaleString("pt-BR")} moedas**`, inline: true },
        { name: "📈 Total Ganho", value: `**${totalEarned.toLocaleString("pt-BR")} moedas**`, inline: true },
      );
    await interaction.reply({ embeds: [embed] });
  }

  else if (sub === "top") {
    const rows = await db.select().from(userCoins).where(eq(userCoins.guildId, guildId)).orderBy(desc(userCoins.balance)).limit(10);

    if (!rows.length) return interaction.reply({ embeds: [errorEmbed("Nenhum usuário com moedas neste servidor ainda.")], ephemeral: true });

    const medals = ["🥇", "🥈", "🥉"];
    const list = rows.map((r, i) => {
      const medal = medals[i] ?? `**${i + 1}.**`;
      return `${medal} <@${r.userId}> — **${r.balance.toLocaleString("pt-BR")} moedas**`;
    }).join("\n");

    const embed = new EmbedBuilder()
      .setColor(BLOOD_RED)
      .setTitle("🏆 Ranking de Moedas")
      .setDescription(list)
      .setFooter({ text: `Top ${rows.length} membros do servidor` });

    await interaction.reply({ embeds: [embed] });
  }
}
