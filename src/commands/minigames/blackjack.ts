import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { db } from "../../db";
import { gameSessions } from "../../db";
import { and, eq } from "drizzle-orm";
import { errorEmbed, BLOOD_RED } from "../../lib/embed.js";
import { getOrCreateWallet, addCoins } from "./coins.js";

const SUITS = ["♠", "♥", "♦", "♣"];
const VALUES = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export function createDeck(): string[] {
  const deck: string[] = [];
  for (const suit of SUITS) for (const val of VALUES) deck.push(`${val}${suit}`);
  return deck.sort(() => Math.random() - 0.5);
}

export function cardValue(card: string): number {
  const val = card.slice(0, -1);
  if (["J", "Q", "K"].includes(val)) return 10;
  if (val === "A") return 11;
  return parseInt(val);
}

export function handValue(hand: string[]): number {
  let total = hand.reduce((sum, c) => sum + cardValue(c), 0);
  let aces = hand.filter((c) => c.startsWith("A")).length;
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

export function buildBJEmbed(data: any, showDealer = false): EmbedBuilder {
  const playerVal = handValue(data.playerHand);
  const dealerVal = showDealer ? handValue(data.dealerHand) : cardValue(data.dealerHand[0]);
  const dealerDisplay = showDealer
    ? data.dealerHand.join(" ") + ` (${handValue(data.dealerHand)})`
    : `${data.dealerHand[0]} 🂠 (${cardValue(data.dealerHand[0])}+?)`;

  let resultText = "";
  if (data.status === "won") resultText = `\n\n🎉 **VOCÊ GANHOU!** +🪙 ${data.prize}`;
  else if (data.status === "lost") resultText = `\n\n💀 **VOCÊ PERDEU!** -🪙 ${data.bet}`;
  else if (data.status === "tie") resultText = `\n\n🤝 **EMPATE!** Aposta devolvida`;

  return new EmbedBuilder()
    .setColor(BLOOD_RED)
    .setTitle("🃏 Blackjack")
    .setDescription(
      `**Dealer:** ${dealerDisplay}\n` +
      `**Você:** ${data.playerHand.join(" ")} **(${playerVal})**\n\n` +
      `**Aposta:** 🪙 ${data.bet}` +
      resultText
    );
}

export function buildBJButtons(sessionId: number, disabled = false): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`bj_hit_${sessionId}`).setLabel("🃏 Pedir").setStyle(ButtonStyle.Primary).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`bj_stand_${sessionId}`).setLabel("✋ Parar").setStyle(ButtonStyle.Secondary).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`bj_double_${sessionId}`).setLabel("2x Dobrar").setStyle(ButtonStyle.Danger).setDisabled(disabled)
  );
}

export const data = new SlashCommandBuilder()
  .setName("blackjack")
  .setDescription("Jogar Blackjack com seus coins!")
  .addIntegerOption((o) =>
    o.setName("aposta").setDescription("Coins para apostar").setRequired(true).setMinValue(1)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  const aposta = interaction.options.getInteger("aposta", true);

  const wallet = await getOrCreateWallet(interaction.user.id, interaction.guild.id);
  if (wallet.balance < aposta) {
    return interaction.reply({ embeds: [errorEmbed(`Saldo insuficiente! Você tem 🪙 ${wallet.balance}.`)], ephemeral: true });
  }

  const existing = await db.select().from(gameSessions).where(
    and(eq(gameSessions.userId, interaction.user.id), eq(gameSessions.guildId, interaction.guild.id), eq(gameSessions.gameType, "blackjack"), eq(gameSessions.status, "active"))
  );
  if (existing.length) return interaction.reply({ embeds: [errorEmbed("Você já tem um jogo ativo!")], ephemeral: true });

  await addCoins(interaction.user.id, interaction.guild.id, -aposta);

  const deck = createDeck();
  const playerHand = [deck.pop()!, deck.pop()!];
  const dealerHand = [deck.pop()!, deck.pop()!];

  const [session] = await db.insert(gameSessions).values({
    userId: interaction.user.id,
    guildId: interaction.guild.id,
    channelId: interaction.channel!.id,
    gameType: "blackjack",
    data: { deck: deck.slice(0, 30), playerHand, dealerHand, bet: aposta, status: "active" },
    status: "active",
  }).returning();

  const gameData = { deck: deck.slice(0, 30), playerHand, dealerHand, bet: aposta, status: "active" };
  const playerVal = handValue(playerHand);

  if (playerVal === 21) {
    const prize = Math.floor(aposta * 2.5);
    await addCoins(interaction.user.id, interaction.guild.id, prize);
    await db.update(gameSessions).set({ status: "finished", data: { ...gameData, status: "won", prize } }).where(eq(gameSessions.id, session.id));
    return interaction.reply({ embeds: [buildBJEmbed({ ...gameData, status: "won", prize }, true)], components: [] });
  }

  await interaction.reply({
    embeds: [buildBJEmbed(gameData)],
    components: [buildBJButtons(session.id)],
  });
}
