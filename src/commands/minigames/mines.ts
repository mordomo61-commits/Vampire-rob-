import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ChatInputCommandInteraction,
  type Client,
} from "discord.js";
import { db } from "../../db";
import { gameSessions } from "../../db";
import { and, eq } from "drizzle-orm";
import { successEmbed, errorEmbed, BLOOD_RED } from "../../lib/embed.js";
import { getOrCreateWallet, addCoins } from "./coins.js";

export const data = new SlashCommandBuilder()
  .setName("mines")
  .setDescription("Jogo de campo minado! Abra casas sem cair nas minas.")
  .addIntegerOption((o) =>
    o.setName("aposta").setDescription("Coins para apostar").setRequired(true).setMinValue(1)
  )
  .addIntegerOption((o) =>
    o.setName("minas").setDescription("Número de minas (1-24)").setRequired(true).setMinValue(1).setMaxValue(24)
  );

export function buildMinesGrid(data: any): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let row = 0; row < 5; row++) {
    const actionRow = new ActionRowBuilder<ButtonBuilder>();
    for (let col = 0; col < 5; col++) {
      const idx = row * 5 + col;
      const revealed = data.revealed[idx];
      const isMine = data.mines.includes(idx);
      let style = ButtonStyle.Secondary;
      let label = "⬜";
      let disabled = false;

      if (data.status === "lost") {
        if (isMine) { label = "💣"; style = ButtonStyle.Danger; }
        else if (revealed) { label = "💎"; style = ButtonStyle.Success; }
        disabled = true;
      } else if (data.status === "won") {
        label = isMine ? "💣" : "💎";
        style = isMine ? ButtonStyle.Danger : ButtonStyle.Success;
        disabled = true;
      } else {
        if (revealed) { label = "💎"; style = ButtonStyle.Success; disabled = true; }
      }

      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId(revealed || data.status !== "active" ? `mines_done_${idx}` : `mines_click_${data.sessionId}_${idx}`)
          .setLabel(label)
          .setStyle(style)
          .setDisabled(disabled || data.status !== "active")
      );
    }
    rows.push(actionRow);
  }

  // Add cashout row
  const cashRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`mines_cashout_${data.sessionId}`)
      .setLabel(`💰 Sacar (${calculateMultiplier(data.revealed.filter(Boolean).length, data.mines.length, 25)}x)`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(data.status !== "active" || data.revealed.filter(Boolean).length === 0)
  );
  rows.push(cashRow);

  return rows;
}

export function calculateMultiplier(safe: number, mines: number, total: number): string {
  if (safe === 0) return "1.00";
  let prob = 1;
  let remaining = total;
  for (let i = 0; i < safe; i++) {
    prob *= (remaining - mines) / remaining;
    remaining--;
  }
  return (0.97 / prob).toFixed(2);
}

export function buildMinesEmbed(data: any, bet: number): EmbedBuilder {
  const safeCount = data.revealed.filter(Boolean).length;
  const mult = calculateMultiplier(safeCount, data.mines.length, 25);
  const prize = (bet * parseFloat(mult)).toFixed(0);

  return new EmbedBuilder()
    .setColor(BLOOD_RED)
    .setTitle("💣 Campo Minado")
    .setDescription(
      `**Aposta:** 🪙 ${bet}\n` +
      `**Minas:** 💣 ${data.mines.length}\n` +
      `**Casas abertas:** 💎 ${safeCount}\n` +
      `**Multiplicador:** ${mult}x\n` +
      `**Prêmio potencial:** 🪙 ${prize}`
    );
}

export async function execute(interaction: ChatInputCommandInteraction, client: Client) {
  if (!interaction.guild) return;
  const aposta = interaction.options.getInteger("aposta", true);
  const numMinas = interaction.options.getInteger("minas", true);

  const wallet = await getOrCreateWallet(interaction.user.id, interaction.guild.id);
  if (wallet.balance < aposta) {
    return interaction.reply({ embeds: [errorEmbed(`Saldo insuficiente! Você tem 🪙 ${wallet.balance}.`)], ephemeral: true });
  }

  // Check existing session
  const existing = await db.select().from(gameSessions).where(
    and(
      eq(gameSessions.userId, interaction.user.id),
      eq(gameSessions.guildId, interaction.guild.id),
      eq(gameSessions.gameType, "mines"),
      eq(gameSessions.status, "active")
    )
  );
  if (existing.length) {
    return interaction.reply({ embeds: [errorEmbed("Você já tem um jogo de mines ativo! Termine o jogo anterior primeiro.")], ephemeral: true });
  }

  // Generate mine positions
  const minePositions: number[] = [];
  while (minePositions.length < numMinas) {
    const pos = Math.floor(Math.random() * 25);
    if (!minePositions.includes(pos)) minePositions.push(pos);
  }

  await addCoins(interaction.user.id, interaction.guild.id, -aposta);

  const [session] = await db.insert(gameSessions).values({
    userId: interaction.user.id,
    guildId: interaction.guild.id,
    channelId: interaction.channel!.id,
    gameType: "mines",
    data: { mines: minePositions, revealed: Array(25).fill(false), bet: aposta, status: "active" },
    status: "active",
  }).returning();

  const gameData = { mines: minePositions, revealed: Array(25).fill(false), bet: aposta, status: "active", sessionId: session.id };

  await interaction.reply({
    embeds: [buildMinesEmbed(gameData, aposta)],
    components: buildMinesGrid(gameData),
  });
}
