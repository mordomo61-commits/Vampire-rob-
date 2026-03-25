import {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  type ButtonInteraction,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { db } from "../db/index.js";
import {
  gameSessions, userCoins, coinTransfers, coinRequests,
  tickets, ticketPanels, buttonRoles, autoRoles,
} from "../db/index.js";
import { and, eq } from "drizzle-orm";
import { BLOOD_RED, errorEmbed, successEmbed } from "../lib/embed.js";
import { generateTranscript } from "../lib/transcript.js";

export async function handleButton(interaction: ButtonInteraction) {
  const id = interaction.customId;
  const guild = interaction.guild!;
  const user = interaction.user;

  try {
    if (id.startsWith("bj_")) await handleBlackjack(interaction, id);
    else if (id.startsWith("coinflip_")) await handleCoinflip(interaction, id);
    else if (id.startsWith("mines_")) await handleMines(interaction, id);
    else if (id.startsWith("ban_")) await handleBan(interaction, id);
    else if (id.startsWith("kick_")) await handleKick(interaction, id);
    else if (id.startsWith("transfer_")) await handleTransfer(interaction, id);
    else if (id.startsWith("pedir_")) await handlePedir(interaction, id);
    else if (id.startsWith("ticket_open_")) await handleTicketOpen(interaction, id);
    else if (id.startsWith("ticket_close_")) await handleTicketClose(interaction, id);
    else if (id.startsWith("ticket_transcript_")) await handleTicketTranscript(interaction, id);
    else if (id.startsWith("ticket_delete_")) await handleTicketDelete(interaction, id);
    else if (id.startsWith("buttonrole_")) await handleButtonRole(interaction, id);
    else if (id.startsWith("autorole_btn_")) await handleAutoRoleButton(interaction, id);
    else if (id.startsWith("quiz_answer_")) await handleQuizAnswer(interaction, id);
  } catch (err) {
    console.error("Button interaction error:", err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ embeds: [errorEmbed("Ocorreu um erro ao processar esta ação.")], ephemeral: true }).catch(() => {});
    }
  }
}

async function handleBlackjack(interaction: ButtonInteraction, id: string) {
  const parts = id.split("_");
  const action = parts[1]!;
  const sessionId = parseInt(parts[2]!);

  const sessions = await db.select().from(gameSessions).where(and(eq(gameSessions.id, sessionId), eq(gameSessions.status, "active")));
  if (!sessions.length) return interaction.reply({ embeds: [errorEmbed("Sessão de blackjack não encontrada ou já encerrada.")], ephemeral: true });

  const session = sessions[0]!;
  if (session.userId !== interaction.user.id) {
    return interaction.reply({ embeds: [errorEmbed("Este não é o seu jogo de blackjack!")], ephemeral: true });
  }

  const data = session.data as any;
  let { bet, deck, playerHand, dealerHand } = data;
  const guildId = interaction.guild!.id;
  const userId = interaction.user.id;

  const SUITS = ["♥️", "♦️", "♣️", "♠️"];
  const VALUES = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

  function cardValue(card: string): number {
    const v = card.slice(0, -2);
    if (["J", "Q", "K"].includes(v)) return 10;
    if (v === "A") return 11;
    return parseInt(v);
  }

  function handTotal(hand: string[]): number {
    let total = 0; let aces = 0;
    for (const card of hand) { total += cardValue(card); if (card.startsWith("A")) aces++; }
    while (total > 21 && aces-- > 0) total -= 10;
    return total;
  }

  function handStr(hand: string[]): string { return hand.join(" ") + ` **(${handTotal(hand)})**`; }

  async function resolveGame(pHand: string[], dHand: string[], extraBet = 0) {
    let dTotal = handTotal(dHand);
    while (dTotal < 17 && deck.length) { dHand.push(deck.pop()!); dTotal = handTotal(dHand); }

    const pTotal = handTotal(pHand);
    const totalBet = bet + extraBet;

    let result: "win" | "lose" | "tie";
    if (pTotal > 21) result = "lose";
    else if (dTotal > 21 || pTotal > dTotal) result = "win";
    else if (pTotal === dTotal) result = "tie";
    else result = "lose";

    await db.update(gameSessions).set({ status: "completed" }).where(eq(gameSessions.id, sessionId));

    const coinRow = await db.select().from(userCoins).where(and(eq(userCoins.userId, userId), eq(userCoins.guildId, guildId)));
    const balance = coinRow[0]?.balance ?? 0;
    let newBalance = balance;
    let resultText = "";

    if (result === "win") {
      newBalance += totalBet;
      resultText = `✅ **Vitória!** +${totalBet} moedas!\nNovo saldo: **${newBalance}**`;
    } else if (result === "tie") {
      if (extraBet) newBalance -= extraBet;
      resultText = `🤝 **Empate!** Aposta devolvida.\nSaldo: **${newBalance}**`;
    } else {
      newBalance -= totalBet;
      resultText = `❌ **Derrota!** −${totalBet} moedas.\nNovo saldo: **${newBalance}**`;
    }

    const embed = new EmbedBuilder().setColor(result === "win" ? 0x00ff00 : result === "tie" ? 0xffff00 : 0xff0000)
      .setTitle("🃏 Blackjack — Resultado")
      .addFields(
        { name: "🎩 Dealer", value: handStr(dHand), inline: true },
        { name: "🫵 Você", value: handStr(pHand), inline: true },
      )
      .setDescription(resultText)
      .setFooter({ text: `Aposta: ${totalBet} moedas` });

    if (coinRow.length) {
      await db.update(userCoins).set({ balance: newBalance }).where(and(eq(userCoins.userId, userId), eq(userCoins.guildId, guildId)));
    } else {
      await db.insert(userCoins).values({ userId, guildId, balance: newBalance, totalEarned: result === "win" ? totalBet : 0 });
    }

    await interaction.update({ embeds: [embed], components: [] });
  }

  if (action === "hit") {
    playerHand.push(deck.pop()!);
    const total = handTotal(playerHand);
    if (total >= 21) { await resolveGame(playerHand, dealerHand); return; }
    await db.update(gameSessions).set({ data: { ...data, deck, playerHand } }).where(eq(gameSessions.id, sessionId));
    const coinRow = await db.select().from(userCoins).where(and(eq(userCoins.userId, userId), eq(userCoins.guildId, guildId)));
    const balance = coinRow[0]?.balance ?? 0;
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`bj_hit_${sessionId}`).setLabel("🃏 Pedir Carta").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`bj_stand_${sessionId}`).setLabel("✋ Parar").setStyle(ButtonStyle.Secondary),
    );
    const embed = new EmbedBuilder().setColor(BLOOD_RED).setTitle("🃏 Blackjack")
      .addFields(
        { name: "🎩 Dealer", value: `${dealerHand[0]} 🂠`, inline: true },
        { name: "🫵 Você", value: handStr(playerHand), inline: true },
      ).setFooter({ text: `Aposta: ${bet} moedas | Saldo: ${balance}` });
    await interaction.update({ embeds: [embed], components: [row] });
  }

  else if (action === "stand") {
    await resolveGame(playerHand, dealerHand);
  }

  else if (action === "double") {
    const coinRow = await db.select().from(userCoins).where(and(eq(userCoins.userId, userId), eq(userCoins.guildId, guildId)));
    const balance = coinRow[0]?.balance ?? 0;
    if (balance < bet * 2) return interaction.reply({ embeds: [errorEmbed("Saldo insuficiente para dobrar!")], ephemeral: true });
    playerHand.push(deck.pop()!);
    await resolveGame(playerHand, dealerHand, bet);
  }
}

async function handleCoinflip(interaction: ButtonInteraction, id: string) {
  const parts = id.split("_");
  const choice = parts[1]!;
  const userId = parts[2]!;
  const bet = parseInt(parts[3]!);

  if (interaction.user.id !== userId) {
    return interaction.reply({ embeds: [errorEmbed("Este não é o seu coinflip!")], ephemeral: true });
  }

  const guildId = interaction.guild!.id;
  const coinRow = await db.select().from(userCoins).where(and(eq(userCoins.userId, userId), eq(userCoins.guildId, guildId)));
  const balance = coinRow[0]?.balance ?? 0;

  if (balance < bet) return interaction.reply({ embeds: [errorEmbed("Saldo insuficiente!")], ephemeral: true });

  const result = Math.random() < 0.5 ? "cara" : "coroa";
  const win = result === choice;
  const newBalance = win ? balance + bet : balance - bet;

  if (coinRow.length) {
    await db.update(userCoins).set({ balance: newBalance, totalEarned: win ? (coinRow[0]!.totalEarned + bet) : coinRow[0]!.totalEarned })
      .where(and(eq(userCoins.userId, userId), eq(userCoins.guildId, guildId)));
  } else {
    await db.insert(userCoins).values({ userId, guildId, balance: newBalance, totalEarned: win ? bet : 0 });
  }

  const embed = new EmbedBuilder()
    .setColor(win ? 0x00ff00 : 0xff0000)
    .setTitle(`🪙 Coinflip — ${win ? "Você Ganhou! 🎉" : "Você Perdeu! 😢"}`)
    .setDescription(
      `A moeda caiu em **${result === "cara" ? "Cara 🪙" : "Coroa 🦅"}**!\n` +
      `Você escolheu: **${choice === "cara" ? "Cara 🪙" : "Coroa 🦅"}**\n\n` +
      (win ? `✅ +${bet} moedas` : `❌ −${bet} moedas`) +
      `\n💰 Novo saldo: **${newBalance.toLocaleString("pt-BR")} moedas**`
    );

  await interaction.update({ embeds: [embed], components: [] });
}

async function handleMines(interaction: ButtonInteraction, id: string) {
  const parts = id.split("_");
  const action = parts[1]!;

  if (action === "cashout") {
    const sessionId = parseInt(parts[2]!);
    const sessions = await db.select().from(gameSessions).where(and(eq(gameSessions.id, sessionId), eq(gameSessions.status, "active")));
    if (!sessions.length) return interaction.reply({ embeds: [errorEmbed("Sessão não encontrada.")], ephemeral: true });
    const session = sessions[0]!;
    if (session.userId !== interaction.user.id) return interaction.reply({ embeds: [errorEmbed("Não é o seu jogo!")], ephemeral: true });

    const data = session.data as any;
    const { bet, mineSet, revealed, mineCount } = data;
    const revealedSet = new Set<number>(revealed);
    const safe = revealedSet.size;

    if (safe === 0) {
      await db.update(gameSessions).set({ status: "completed" }).where(eq(gameSessions.id, sessionId));
      await interaction.update({ embeds: [errorEmbed("Você deve revelar pelo menos uma célula antes de sacar!")], components: [] });
      return;
    }

    const mult = Math.max(1, +(Math.pow(1 / (1 - mineCount / 25), safe) * 0.9).toFixed(2));
    const prize = Math.floor(bet * mult);

    const guildId = interaction.guild!.id;
    const userId = session.userId;
    const coinRow = await db.select().from(userCoins).where(and(eq(userCoins.userId, userId), eq(userCoins.guildId, guildId)));
    const balance = coinRow[0]?.balance ?? 0;
    const profit = prize - bet;
    const newBalance = balance + profit;

    if (coinRow.length) {
      await db.update(userCoins).set({ balance: newBalance, totalEarned: profit > 0 ? coinRow[0]!.totalEarned + profit : coinRow[0]!.totalEarned })
        .where(and(eq(userCoins.userId, userId), eq(userCoins.guildId, guildId)));
    } else {
      await db.insert(userCoins).values({ userId, guildId, balance: newBalance, totalEarned: profit > 0 ? profit : 0 });
    }

    await db.update(gameSessions).set({ status: "completed" }).where(eq(gameSessions.id, sessionId));

    const embed = new EmbedBuilder().setColor(0x00ff00).setTitle("💰 Saque Realizado!")
      .setDescription(
        `Você sacou com **${safe}** diamante(s) encontrados!\n\n` +
        `Multiplicador: **${mult}x**\n` +
        `Aposta: **${bet}** → Prêmio: **${prize} moedas** (+${profit})\n\n` +
        `💰 Novo saldo: **${newBalance.toLocaleString("pt-BR")} moedas**`
      );

    await interaction.update({ embeds: [embed], components: [] });
    return;
  }

  if (action === "cell") {
    const sessionId = parseInt(parts[2]!);
    const cellIdx = parseInt(parts[3]!);

    const sessions = await db.select().from(gameSessions).where(and(eq(gameSessions.id, sessionId), eq(gameSessions.status, "active")));
    if (!sessions.length) return interaction.reply({ embeds: [errorEmbed("Sessão não encontrada.")], ephemeral: true });
    const session = sessions[0]!;
    if (session.userId !== interaction.user.id) return interaction.reply({ embeds: [errorEmbed("Não é o seu jogo!")], ephemeral: true });

    const data = session.data as any;
    const { bet, mineSet, revealed, mineCount } = data;
    const mineSetObj = new Set<number>(mineSet);
    const revealedSet = new Set<number>(revealed);

    if (mineSetObj.has(cellIdx)) {
      await db.update(gameSessions).set({ status: "completed" }).where(eq(gameSessions.id, sessionId));

      const guildId = interaction.guild!.id;
      const userId = session.userId;
      const coinRow = await db.select().from(userCoins).where(and(eq(userCoins.userId, userId), eq(userCoins.guildId, guildId)));
      const balance = coinRow[0]?.balance ?? 0;
      const newBalance = balance - bet;
      if (coinRow.length) { await db.update(userCoins).set({ balance: newBalance }).where(and(eq(userCoins.userId, userId), eq(userCoins.guildId, guildId))); }
      else { await db.insert(userCoins).values({ userId, guildId, balance: newBalance, totalEarned: 0 }); }

      const embed = new EmbedBuilder().setColor(0xff0000).setTitle("💥 BOOM! — Você acertou uma mina!")
        .setDescription(`❌ Você perdeu **${bet} moedas**!\n💰 Novo saldo: **${newBalance.toLocaleString("pt-BR")} moedas**`);

      const GRID_SIZE = 5;
      const rows: ActionRowBuilder<ButtonBuilder>[] = [];
      for (let r = 0; r < GRID_SIZE; r++) {
        const row = new ActionRowBuilder<ButtonBuilder>();
        for (let c = 0; c < GRID_SIZE; c++) {
          const idx = r * GRID_SIZE + c;
          const isMine = mineSetObj.has(idx);
          const isRevealed = revealedSet.has(idx);
          const btn = new ButtonBuilder().setCustomId(`mines_done_${idx}`).setDisabled(true);
          if (isMine) btn.setEmoji("💣").setStyle(ButtonStyle.Danger);
          else if (isRevealed) btn.setEmoji("💎").setStyle(ButtonStyle.Success);
          else btn.setLabel("·").setStyle(ButtonStyle.Secondary);
          row.addComponents(btn);
        }
        rows.push(row);
      }
      rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("mines_done_cashout").setLabel("💰 Sacar Prêmio").setStyle(ButtonStyle.Primary).setDisabled(true)
      ));

      await interaction.update({ embeds: [embed], components: rows });
      return;
    }

    revealedSet.add(cellIdx);
    const safe = revealedSet.size;
    const mult = Math.max(1, +(Math.pow(1 / (1 - mineCount / 25), safe) * 0.9).toFixed(2));
    const potential = Math.floor(bet * mult);

    await db.update(gameSessions).set({ data: { ...data, revealed: Array.from(revealedSet) } }).where(eq(gameSessions.id, sessionId));

    const GRID_SIZE = 5;
    const componentRows: ActionRowBuilder<ButtonBuilder>[] = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      const row = new ActionRowBuilder<ButtonBuilder>();
      for (let c = 0; c < GRID_SIZE; c++) {
        const idx = r * GRID_SIZE + c;
        const isRevealed = revealedSet.has(idx);
        const btn = new ButtonBuilder().setCustomId(`mines_cell_${sessionId}_${idx}`);
        if (isRevealed) btn.setEmoji("💎").setStyle(ButtonStyle.Success).setDisabled(true);
        else btn.setLabel("·").setStyle(ButtonStyle.Secondary);
        row.addComponents(btn);
      }
      componentRows.push(row);
    }
    componentRows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`mines_cashout_${sessionId}`).setLabel("💰 Sacar Prêmio").setStyle(ButtonStyle.Primary)
    ));

    const embed = new EmbedBuilder().setColor(BLOOD_RED).setTitle("💣 Mines")
      .setDescription(`Aposta: **${bet} moedas** | Minas: **${mineCount}**\n\n💎 Diamantes revelados: **${safe}**\n📈 Multiplicador: **${mult}x**\n💰 Potencial: **${potential} moedas**`)
      .setFooter({ text: "Continue revelando ou saque agora!" });

    await interaction.update({ embeds: [embed], components: componentRows });
  }
}

async function handleBan(interaction: ButtonInteraction, id: string) {
  const parts = id.split("_");
  const action = parts[1]!;

  if (action === "confirm") {
    const targetId = parts[2]!;
    const reason = decodeURIComponent(parts.slice(3).join("_"));

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
      return interaction.reply({ embeds: [errorEmbed("Você não tem permissão para banir!")], ephemeral: true });
    }

    const member = await interaction.guild!.members.fetch(targetId).catch(() => null);
    if (!member) {
      await interaction.guild!.bans.create(targetId, { reason }).catch(() => null);
    } else {
      if (!member.bannable) return interaction.reply({ embeds: [errorEmbed("Não posso banir este usuário.")], ephemeral: true });
      await member.ban({ reason });
    }

    const embed = new EmbedBuilder().setColor(BLOOD_RED).setTitle("🔨 Usuário Banido!")
      .setDescription(`<@${targetId}> foi banido por **${interaction.user}**.\n\n**Motivo:** ${reason}`);
    await interaction.update({ embeds: [embed], components: [] });
  }

  else if (action === "cancel") {
    const execId = parts[2]!;
    if (interaction.user.id !== execId) return interaction.reply({ embeds: [errorEmbed("Apenas o executor pode cancelar!")], ephemeral: true });
    await interaction.update({ embeds: [new EmbedBuilder().setColor(BLOOD_RED).setTitle("❌ Ban Cancelado").setDescription("O ban foi cancelado.")], components: [] });
  }
}

async function handleKick(interaction: ButtonInteraction, id: string) {
  const parts = id.split("_");
  const action = parts[1]!;

  if (action === "confirm") {
    const targetId = parts[2]!;
    const reason = decodeURIComponent(parts.slice(3).join("_"));

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.KickMembers)) {
      return interaction.reply({ embeds: [errorEmbed("Você não tem permissão para expulsar!")], ephemeral: true });
    }

    const member = await interaction.guild!.members.fetch(targetId).catch(() => null);
    if (!member) return interaction.reply({ embeds: [errorEmbed("Usuário não encontrado.")], ephemeral: true });
    if (!member.kickable) return interaction.reply({ embeds: [errorEmbed("Não posso expulsar este usuário.")], ephemeral: true });

    await member.kick(reason);
    const embed = new EmbedBuilder().setColor(BLOOD_RED).setTitle("👢 Usuário Expulso!")
      .setDescription(`<@${targetId}> foi expulso por **${interaction.user}**.\n\n**Motivo:** ${reason}`);
    await interaction.update({ embeds: [embed], components: [] });
  }

  else if (action === "cancel") {
    const execId = parts[2]!;
    if (interaction.user.id !== execId) return interaction.reply({ embeds: [errorEmbed("Apenas o executor pode cancelar!")], ephemeral: true });
    await interaction.update({ embeds: [new EmbedBuilder().setColor(BLOOD_RED).setTitle("❌ Kick Cancelado").setDescription("O kick foi cancelado.")], components: [] });
  }
}

async function handleTransfer(interaction: ButtonInteraction, id: string) {
  const parts = id.split("_");
  const action = parts[1]!;
  const transferId = parseInt(parts[2]!);

  const transfers = await db.select().from(coinTransfers).where(and(eq(coinTransfers.id, transferId), eq(coinTransfers.status, "pending")));
  if (!transfers.length) return interaction.reply({ embeds: [errorEmbed("Transferência não encontrada ou já processada.")], ephemeral: true });

  const transfer = transfers[0]!;
  if (interaction.user.id !== transfer.fromUserId) {
    return interaction.reply({ embeds: [errorEmbed("Apenas quem iniciou a transferência pode confirmar ou cancelar.")], ephemeral: true });
  }

  if (action === "confirmar") {
    const guildId = interaction.guild!.id;
    const fromRow = await db.select().from(userCoins).where(and(eq(userCoins.userId, transfer.fromUserId), eq(userCoins.guildId, guildId)));
    const fromBalance = fromRow[0]?.balance ?? 0;

    if (fromBalance < transfer.amount) {
      await db.update(coinTransfers).set({ status: "failed" }).where(eq(coinTransfers.id, transferId));
      return interaction.update({ embeds: [errorEmbed("Saldo insuficiente!")], components: [] });
    }

    const toRow = await db.select().from(userCoins).where(and(eq(userCoins.userId, transfer.toUserId), eq(userCoins.guildId, guildId)));

    await db.update(userCoins).set({ balance: fromBalance - transfer.amount })
      .where(and(eq(userCoins.userId, transfer.fromUserId), eq(userCoins.guildId, guildId)));

    if (toRow.length) {
      await db.update(userCoins).set({ balance: (toRow[0]!.balance) + transfer.amount, totalEarned: toRow[0]!.totalEarned + transfer.amount })
        .where(and(eq(userCoins.userId, transfer.toUserId), eq(userCoins.guildId, guildId)));
    } else {
      await db.insert(userCoins).values({ userId: transfer.toUserId, guildId, balance: transfer.amount, totalEarned: transfer.amount });
    }

    await db.update(coinTransfers).set({ status: "completed" }).where(eq(coinTransfers.id, transferId));

    const embed = new EmbedBuilder().setColor(0x00ff00).setTitle("✅ Transferência Concluída!")
      .setDescription(`<@${transfer.fromUserId}> transferiu **${transfer.amount.toLocaleString("pt-BR")} moedas** para <@${transfer.toUserId}>!`);
    await interaction.update({ embeds: [embed], components: [] });
  }

  else if (action === "cancelar") {
    await db.update(coinTransfers).set({ status: "cancelled" }).where(eq(coinTransfers.id, transferId));
    await interaction.update({ embeds: [new EmbedBuilder().setColor(BLOOD_RED).setTitle("❌ Transferência Cancelada")], components: [] });
  }
}

async function handlePedir(interaction: ButtonInteraction, id: string) {
  const parts = id.split("_");
  const action = parts[1]!;
  const requestId = parseInt(parts[2]!);

  const requests = await db.select().from(coinRequests).where(and(eq(coinRequests.id, requestId), eq(coinRequests.status, "pending")));
  if (!requests.length) return interaction.reply({ embeds: [errorEmbed("Pedido não encontrado ou já processado.")], ephemeral: true });

  const req = requests[0]!;
  if (interaction.user.id !== req.toUserId) {
    return interaction.reply({ embeds: [errorEmbed("Apenas quem recebeu o pedido pode aceitar ou recusar.")], ephemeral: true });
  }

  if (action === "aceitar") {
    const guildId = interaction.guild!.id;
    const fromRow = await db.select().from(userCoins).where(and(eq(userCoins.userId, req.toUserId), eq(userCoins.guildId, guildId)));
    const toRow = await db.select().from(userCoins).where(and(eq(userCoins.userId, req.fromUserId), eq(userCoins.guildId, guildId)));

    const fromBalance = fromRow[0]?.balance ?? 0;
    if (fromBalance < req.amount) {
      await db.update(coinRequests).set({ status: "failed" }).where(eq(coinRequests.id, requestId));
      return interaction.update({ embeds: [errorEmbed("Saldo insuficiente para aceitar o pedido.")], components: [] });
    }

    await db.update(userCoins).set({ balance: fromBalance - req.amount }).where(and(eq(userCoins.userId, req.toUserId), eq(userCoins.guildId, guildId)));

    if (toRow.length) {
      await db.update(userCoins).set({ balance: toRow[0]!.balance + req.amount, totalEarned: toRow[0]!.totalEarned + req.amount })
        .where(and(eq(userCoins.userId, req.fromUserId), eq(userCoins.guildId, guildId)));
    } else {
      await db.insert(userCoins).values({ userId: req.fromUserId, guildId, balance: req.amount, totalEarned: req.amount });
    }

    await db.update(coinRequests).set({ status: "completed" }).where(eq(coinRequests.id, requestId));

    const embed = new EmbedBuilder().setColor(0x00ff00).setTitle("✅ Pedido Aceito!")
      .setDescription(`<@${req.toUserId}> aceitou o pedido de <@${req.fromUserId}>!\n**${req.amount.toLocaleString("pt-BR")} moedas** transferidas!`);
    await interaction.update({ embeds: [embed], components: [] });
  }

  else if (action === "recusar") {
    await db.update(coinRequests).set({ status: "rejected" }).where(eq(coinRequests.id, requestId));
    const embed = new EmbedBuilder().setColor(0xff0000).setTitle("❌ Pedido Recusado!")
      .setDescription(`<@${req.toUserId}> recusou o pedido de <@${req.fromUserId}>.`);
    await interaction.update({ embeds: [embed], components: [] });
  }
}

async function handleTicketOpen(interaction: ButtonInteraction, id: string) {
  const parts = id.split("_");
  const panelId = parseInt(parts[2]!);
  const buttonLabel = parts.slice(3).join("_") || "Suporte";

  const guild = interaction.guild!;
  const userId = interaction.user.id;

  const existingTicket = await db.select().from(tickets).where(
    and(eq(tickets.guildId, guild.id), eq(tickets.userId, userId), eq(tickets.status, "open"))
  );
  if (existingTicket.length) {
    return interaction.reply({
      embeds: [errorEmbed(`Você já tem um ticket aberto! <#${existingTicket[0]!.channelId}>`)],
      ephemeral: true,
    });
  }

  const panels = await db.select().from(ticketPanels).where(eq(ticketPanels.id, panelId));
  if (!panels.length) return interaction.reply({ embeds: [errorEmbed("Painel de ticket não encontrado.")], ephemeral: true });
  const panel = panels[0]!;

  await interaction.deferReply({ ephemeral: true });

  const ticketNum = await db.select().from(tickets).where(eq(tickets.guildId, guild.id)).then((r) => r.length + 1);

  const channelOptions: any = {
    name: `ticket-${ticketNum.toString().padStart(4, "0")}`,
    topic: `Ticket de ${interaction.user.tag} | Assunto: ${buttonLabel}`,
    permissionOverwrites: [
      { id: guild.roles.everyone, deny: ["ViewChannel"] },
      { id: userId, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"] },
      { id: guild.members.me!.id, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory", "ManageChannels", "AttachFiles"] },
    ],
  };

  for (const roleId of panel.staffRoleIds) {
    channelOptions.permissionOverwrites.push({
      id: roleId,
      allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"],
    });
  }

  if (panel.categoryId) channelOptions.parent = panel.categoryId;

  const channel = await guild.channels.create(channelOptions).catch((e: Error) => { console.error("Create channel error:", e); return null; });
  if (!channel) return interaction.editReply({ embeds: [errorEmbed("Falha ao criar o canal do ticket. Verifique as permissões do bot.")] });

  const [ticket] = await db.insert(tickets).values({
    guildId: guild.id, channelId: channel.id, userId, panelId, buttonLabel, status: "open",
  }).returning();

  const staffMention = panel.staffRoleIds.map((r) => `<@&${r}>`).join(" ") || "Staff";

  const embed = new EmbedBuilder()
    .setColor(parseInt(panel.embedColor.replace("#", ""), 16))
    .setTitle(`🎫 Ticket #${ticketNum.toString().padStart(4, "0")} — ${buttonLabel}`)
    .setDescription(`Olá ${interaction.user}!\n\nSeu ticket foi aberto. Nossa equipe irá te atender em breve!\n\n📋 **Categoria:** ${buttonLabel}\n⏰ **Aberto em:** ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`)
    .setFooter({ text: "Use os botões abaixo para gerenciar o ticket" });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`ticket_close_${ticket!.id}`).setLabel("🔒 Fechar Ticket").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`ticket_transcript_${ticket!.id}`).setLabel("📄 Gerar Transcript").setStyle(ButtonStyle.Secondary),
  );

  await (channel as any).send({ content: `${staffMention} | ${interaction.user}`, embeds: [embed], components: [row] });
  await interaction.editReply({ embeds: [successEmbed("✅ Ticket Aberto!", `Seu ticket foi criado em <#${channel.id}>!`)] });
}

async function handleTicketClose(interaction: ButtonInteraction, id: string) {
  const ticketId = parseInt(id.split("_")[2]!);

  const ticketList = await db.select().from(tickets).where(eq(tickets.id, ticketId));
  if (!ticketList.length) return interaction.reply({ embeds: [errorEmbed("Ticket não encontrado.")], ephemeral: true });

  const ticket = ticketList[0]!;
  const isStaff = interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels);
  const isOwner = ticket.userId === interaction.user.id;

  if (!isStaff && !isOwner) {
    return interaction.reply({ embeds: [errorEmbed("Apenas a equipe ou o dono do ticket pode fechá-lo.")], ephemeral: true });
  }

  const modal = new ModalBuilder().setCustomId(`ticket_close_reason_${ticketId}`).setTitle("Fechar Ticket");
  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId("reason").setLabel("Motivo do fechamento (opcional)").setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(200)
    )
  );
  await interaction.showModal(modal);
}

async function handleTicketTranscript(interaction: ButtonInteraction, id: string) {
  const ticketId = parseInt(id.split("_")[2]!);

  const ticketList = await db.select().from(tickets).where(eq(tickets.id, ticketId));
  if (!ticketList.length) return interaction.reply({ embeds: [errorEmbed("Ticket não encontrado.")], ephemeral: true });

  const isStaff = interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels);
  if (!isStaff) return interaction.reply({ embeds: [errorEmbed("Apenas a equipe pode gerar transcripts.")], ephemeral: true });

  await interaction.deferReply({ ephemeral: true });

  const ticketOwner = await interaction.client.users.fetch(ticketList[0]!.userId).catch(() => null);
  const transcript = await generateTranscript(
    interaction.channel as any,
    ticketOwner?.tag ?? "Desconhecido",
    interaction.user.tag,
    null
  );

  if (!transcript) return interaction.editReply({ embeds: [errorEmbed("Falha ao gerar transcript.")] });

  await interaction.editReply({ files: [transcript], embeds: [successEmbed("📄 Transcript Gerado!")] });
}

async function handleTicketDelete(interaction: ButtonInteraction, id: string) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
    return interaction.reply({ embeds: [errorEmbed("Apenas a equipe pode excluir tickets.")], ephemeral: true });
  }
  await interaction.reply({ embeds: [successEmbed("🗑️ Canal sendo excluído...", "Este canal será apagado em 5 segundos.")], ephemeral: true });
  setTimeout(() => interaction.channel?.delete().catch(() => {}), 5000);
}

async function handleButtonRole(interaction: ButtonInteraction, id: string) {
  const roleId = id.split("_")[1]!;
  const member = interaction.member as any;

  if (member.roles.cache.has(roleId)) {
    await member.roles.remove(roleId).catch(() => null);
    await interaction.reply({ embeds: [successEmbed("🏷️ Cargo Removido", `Cargo <@&${roleId}> removido!`)], ephemeral: true });
  } else {
    await member.roles.add(roleId).catch(() => null);
    await interaction.reply({ embeds: [successEmbed("🏷️ Cargo Adicionado", `Cargo <@&${roleId}> adicionado!`)], ephemeral: true });
  }
}

async function handleAutoRoleButton(interaction: ButtonInteraction, id: string) {
  const roleId = id.replace("autorole_btn_", "");
  const member = interaction.member as any;

  if (member.roles.cache.has(roleId)) {
    await member.roles.remove(roleId).catch(() => null);
    await interaction.reply({ embeds: [successEmbed("🏷️ Cargo Removido", `Cargo <@&${roleId}> removido!`)], ephemeral: true });
  } else {
    await member.roles.add(roleId).catch(() => null);
    await interaction.reply({ embeds: [successEmbed("🏷️ Cargo Adicionado", `Cargo <@&${roleId}> adicionado!`)], ephemeral: true });
  }
}

async function handleQuizAnswer(interaction: ButtonInteraction, id: string) {
  const parts = id.split("_");
  const sessionId = parseInt(parts[2]!);
  const answerIndex = parseInt(parts[3]!);

  const { quizSessions, quizQuestions } = await import("../db/index.js");
  const sessions = await db.select().from(quizSessions).where(and(eq(quizSessions.id, sessionId), eq(quizSessions.status, "active")));
  if (!sessions.length) return interaction.reply({ embeds: [errorEmbed("Quiz não encontrado ou já encerrado.")], ephemeral: true });

  const session = sessions[0]!;
  if (!session.currentQuestionId) return interaction.reply({ embeds: [errorEmbed("Nenhuma pergunta ativa.")], ephemeral: true });

  const questionList = await db.select().from(quizQuestions).where(eq(quizQuestions.id, session.currentQuestionId));
  if (!questionList.length) return interaction.reply({ embeds: [errorEmbed("Pergunta não encontrada.")], ephemeral: true });

  const question = questionList[0]!;
  const correct = answerIndex === question.correctIndex;
  const scores = session.scores as Record<string, number>;
  const userId = interaction.user.id;

  if (correct) {
    scores[userId] = (scores[userId] ?? 0) + 1;
    await db.update(quizSessions).set({ scores }).where(eq(quizSessions.id, sessionId));

    await interaction.reply({
      embeds: [
        new EmbedBuilder().setColor(0x00ff00).setTitle("✅ Resposta Correta!")
          .setDescription(`${interaction.user} acertou!\n\n**${question.options[question.correctIndex]}** era a resposta certa!\n🏆 Pontos: **${scores[userId]}**`)
      ],
      ephemeral: false,
    });

    const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      question.options.map((_, i) =>
        new ButtonBuilder().setCustomId(`quiz_done_${i}`).setLabel(`${["A", "B", "C", "D"][i]}) ${question.options[i]}`)
          .setStyle(i === question.correctIndex ? ButtonStyle.Success : ButtonStyle.Secondary).setDisabled(true)
      )
    );

    await interaction.message.edit({ components: [disabledRow] }).catch(() => null);
  } else {
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xff0000).setTitle("❌ Resposta Errada!").setDescription(`${interaction.user} errou!\n\nA resposta certa era: **${question.options[question.correctIndex]}**`)],
      ephemeral: true,
    });
  }
}
