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

const SUITS = ["♥️", "♦️", "♣️", "♠️"];
const VALUES = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function createDeck(): string[] {
  const deck: string[] = [];
  for (const suit of SUITS) for (const val of VALUES) deck.push(`${val}${suit}`);
  return deck;
}

function shuffle(deck: string[]): string[] {
  return [...deck].sort(() => Math.random() - 0.5);
}

function cardValue(card: string): number {
  const v = card.slice(0, -2);
  if (["J", "Q", "K"].includes(v)) return 10;
  if (v === "A") return 11;
  return parseInt(v);
}

function handTotal(hand: string[]): number {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    total += cardValue(card);
    if (card.startsWith("A")) aces++;
  }
  while (total > 21 && aces-- > 0) total -= 10;
  return total;
}

function handStr(hand: string[]): string {
  return hand.join(" ") + ` **(${handTotal(hand)})**`;
}

function bjEmbed(playerHand: string[], dealerHand: string[], bet: number, showFull = false): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(BLOOD_RED)
    .setTitle("🃏 Blackjack")
    .addFields(
      { name: "🎩 Dealer", value: showFull ? handStr(dealerHand) : `${dealerHand[0]} 🂠 **(${cardValue(dealerHand[0]!)}+?)**`, inline: true },
      { name: "🫵 Você", value: handStr(playerHand), inline: true },
    )
    .setFooter({ text: `Aposta: ${bet} moedas` });
}

export const data = new SlashCommandBuilder()
  .setName("blackjack")
  .setDescription("Jogar blackjack apostando moedas")
  .addIntegerOption((o) =>
    o.setName("aposta").setDescription("Quantidade de moedas para apostar").setRequired(true).setMinValue(1)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const bet = interaction.options.getInteger("aposta", true);
  const guildId = interaction.guild!.id;
  const userId = interaction.user.id;

  const existing = await db.select().from(gameSessions).where(
    and(eq(gameSessions.userId, userId), eq(gameSessions.guildId, guildId), eq(gameSessions.gameType, "blackjack"), eq(gameSessions.status, "active"))
  );
  if (existing.length) return interaction.reply({ embeds: [errorEmbed("Você já tem um jogo de blackjack em andamento! Termine antes de iniciar outro.")], ephemeral: true });

  const coinRow = await db.select().from(userCoins).where(
    and(eq(userCoins.userId, userId), eq(userCoins.guildId, guildId))
  );
  const balance = coinRow[0]?.balance ?? 0;
  if (balance < bet) return interaction.reply({ embeds: [errorEmbed(`Saldo insuficiente! Você tem **${balance} moedas** mas quer apostar **${bet}**.`)], ephemeral: true });

  const deck = shuffle(createDeck());
  const playerHand = [deck.pop()!, deck.pop()!];
  const dealerHand = [deck.pop()!, deck.pop()!];

  let sessionId = 0;
  const sess = await db.insert(gameSessions).values({
    userId, guildId, channelId: interaction.channel!.id, gameType: "blackjack",
    data: { bet, deck, playerHand, dealerHand },
    status: "active",
  }).returning();
  sessionId = sess[0]!.id;

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`bj_hit_${sessionId}`).setLabel("🃏 Pedir Carta").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`bj_stand_${sessionId}`).setLabel("✋ Parar").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`bj_double_${sessionId}`).setLabel("💰 Dobrar (Double Down)").setStyle(ButtonStyle.Success)
      .setDisabled(balance < bet * 2),
  );

  const embed = bjEmbed(playerHand, dealerHand, bet);
  if (handTotal(playerHand) === 21) {
    embed.setDescription("🎉 **BLACKJACK!** Você venceu com 21!");
    await handleBjEnd(interaction, sessionId, "blackjack", userId, guildId, bet, embed);
    return;
  }

  await interaction.reply({ embeds: [embed], components: [row] });
}

async function handleBjEnd(
  interaction: ChatInputCommandInteraction,
  sessionId: number,
  result: "win" | "lose" | "tie" | "blackjack",
  userId: string,
  guildId: string,
  bet: number,
  embed: EmbedBuilder
) {
  await db.update(gameSessions).set({ status: "completed" }).where(eq(gameSessions.id, sessionId));

  const coinRow = await db.select().from(userCoins).where(and(eq(userCoins.userId, userId), eq(userCoins.guildId, guildId)));
  const balance = coinRow[0]?.balance ?? 0;

  let newBalance = balance;
  let resultText = "";

  if (result === "blackjack") {
    const win = Math.floor(bet * 1.5);
    newBalance = balance + win;
    resultText = `🎊 **Blackjack!** Ganhou **+${win} moedas** (1.5x)!\nNovo saldo: **${newBalance}**`;
    embed.setColor(0x00ff00);
  } else if (result === "win") {
    newBalance = balance + bet;
    resultText = `✅ **Vitória!** Ganhou **+${bet} moedas**!\nNovo saldo: **${newBalance}**`;
    embed.setColor(0x00ff00);
  } else if (result === "tie") {
    resultText = `🤝 **Empate!** Sua aposta foi devolvida.\nSaldo: **${balance}**`;
    embed.setColor(0xffff00);
  } else {
    newBalance = balance - bet;
    resultText = `❌ **Derrota!** Perdeu **${bet} moedas**.\nNovo saldo: **${newBalance}**`;
    embed.setColor(0xff0000);
  }

  embed.setDescription(resultText);

  if (coinRow.length) {
    await db.update(userCoins).set({ balance: newBalance }).where(and(eq(userCoins.userId, userId), eq(userCoins.guildId, guildId)));
  } else {
    await db.insert(userCoins).values({ userId, guildId, balance: newBalance, totalEarned: result !== "lose" ? bet : 0 });
  }

  await interaction.reply({ embeds: [embed] });
}
