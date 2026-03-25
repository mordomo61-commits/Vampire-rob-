import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { db } from "../../db/index.js";
import { gameSessions, userCoins } from "../../db/index.js";
import { and, eq } from "drizzle-orm";
import { errorEmbed, BLOOD_RED } from "../../lib/embed.js";

const GRID_SIZE = 5;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;

function buildGrid(mineCount: number, revealed: Set<number>): { mineSet: Set<number> } {
  const mineSet = new Set<number>();
  while (mineSet.size < mineCount) {
    mineSet.add(Math.floor(Math.random() * TOTAL_CELLS));
  }
  return { mineSet };
}

function multiplier(safe: number, mines: number): number {
  const r = mines / TOTAL_CELLS;
  return Math.pow(1 / (1 - r), safe) * 0.9;
}

function buildComponents(mineSet: Set<number>, revealed: Set<number>, gameOver = false, sessionId = 0): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    const actionRow = new ActionRowBuilder<ButtonBuilder>();
    for (let col = 0; col < GRID_SIZE; col++) {
      const idx = row * GRID_SIZE + col;
      const isMine = mineSet.has(idx);
      const isRevealed = revealed.has(idx);
      const btn = new ButtonBuilder().setCustomId(`mines_cell_${sessionId}_${idx}`);
      if (gameOver) {
        if (isMine) { btn.setEmoji("💣").setStyle(ButtonStyle.Danger).setDisabled(true); }
        else if (isRevealed) { btn.setEmoji("💎").setStyle(ButtonStyle.Success).setDisabled(true); }
        else { btn.setLabel("·").setStyle(ButtonStyle.Secondary).setDisabled(true); }
      } else {
        if (isRevealed) { btn.setEmoji("💎").setStyle(ButtonStyle.Success).setDisabled(true); }
        else { btn.setLabel("·").setStyle(ButtonStyle.Secondary); }
      }
      actionRow.addComponents(btn);
    }
    rows.push(actionRow);
  }
  const cashRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`mines_cashout_${sessionId}`).setLabel("💰 Sacar Prêmio").setStyle(ButtonStyle.Primary).setDisabled(gameOver)
  );
  rows.push(cashRow);
  return rows;
}

export const data = new SlashCommandBuilder()
  .setName("mines")
  .setDescription("Jogo de campo minado — encontre diamantes e evite as minas!")
  .addIntegerOption((o) =>
    o.setName("aposta").setDescription("Valor da aposta").setRequired(true).setMinValue(1)
  )
  .addIntegerOption((o) =>
    o.setName("minas").setDescription("Número de minas no campo (1-20)").setRequired(false).setMinValue(1).setMaxValue(20)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const bet = interaction.options.getInteger("aposta", true);
  const mineCount = interaction.options.getInteger("minas") ?? 5;
  const guildId = interaction.guild!.id;
  const userId = interaction.user.id;

  const existing = await db.select().from(gameSessions).where(
    and(eq(gameSessions.userId, userId), eq(gameSessions.guildId, guildId), eq(gameSessions.gameType, "mines"), eq(gameSessions.status, "active"))
  );
  if (existing.length) return interaction.reply({ embeds: [errorEmbed("Você já tem um jogo de mines em andamento!")], ephemeral: true });

  const coinRow = await db.select().from(userCoins).where(and(eq(userCoins.userId, userId), eq(userCoins.guildId, guildId)));
  const balance = coinRow[0]?.balance ?? 0;
  if (balance < bet) return interaction.reply({ embeds: [errorEmbed(`Saldo insuficiente! Você tem **${balance} moedas**.`)], ephemeral: true });

  const { mineSet } = buildGrid(mineCount, new Set());
  const mineArray = Array.from(mineSet);

  const sess = await db.insert(gameSessions).values({
    userId, guildId, channelId: interaction.channel!.id, gameType: "mines",
    data: { bet, mineCount, mineSet: mineArray, revealed: [] },
    status: "active",
  }).returning();
  const sessionId = sess[0]!.id;

  const components = buildComponents(new Set(mineArray), new Set(), false, sessionId);

  const embed = new EmbedBuilder()
    .setColor(BLOOD_RED)
    .setTitle("💣 Mines")
    .setDescription(`Aposta: **${bet} moedas** | Minas: **${mineCount}**\n\nClique nos botões para revelar diamantes 💎. Evite as minas 💣!\n\n**Multiplicador atual:** 1.00x`)
    .setFooter({ text: "Saque a qualquer momento para garantir seus ganhos!" });

  await interaction.reply({ embeds: [embed], components });
}
