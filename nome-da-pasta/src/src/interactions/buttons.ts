import {
  type ButtonInteraction,
  type Client,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type TextChannel,
} from "discord.js";
import { db } from "../db";
import {
  gameSessions, ticketPanels, tickets, buttonRoles, autoRoles,
  coinTransfers, coinRequests,
} from "../db";
import { and, eq } from "drizzle-orm";
import { BLOOD_RED, successEmbed, errorEmbed } from "../lib/embed.js";
import { addCoins, getOrCreateWallet } from "../commands/minigames/coins.js";
import { buildMinesGrid, buildMinesEmbed, calculateMultiplier } from "../commands/minigames/mines.js";
import { buildBJEmbed, buildBJButtons, handValue } from "../commands/minigames/blackjack.js";
import { setupSessions, buildPanelPreview, buildSetupButtons, createTicketChannel } from "../commands/tickets/ticketpainel.js";
import { generateTranscript } from "../lib/transcript.js";

export async function handleButton(interaction: ButtonInteraction, client: Client) {
  const id = interaction.customId;

  // ─── BAN CONFIRM ─────────────────────────────────────────────
  if (id.startsWith("ban_confirm_")) {
    if (!interaction.memberPermissions?.has("BanMembers" as any)) {
      return interaction.reply({ embeds: [errorEmbed("Apenas quem executou o comando pode confirmar.")], ephemeral: true });
    }
    const parts = id.split("_");
    const userId = parts[2];
    const reason = decodeURIComponent(parts.slice(3).join("_"));
    const member = await interaction.guild?.members.fetch(userId).catch(() => null);
    if (!member) return interaction.update({ embeds: [errorEmbed("Usuário não encontrado.")], components: [] });
    await member.ban({ reason });
    await interaction.update({
      embeds: [successEmbed("✅ Usuário Banido", `<@${userId}> foi banido.\n**Motivo:** ${reason}`)],
      components: [],
    });
  }

  else if (id.startsWith("ban_cancel_")) {
    const executorId = id.split("_")[2];
    if (interaction.user.id !== executorId) {
      return interaction.reply({ embeds: [errorEmbed("Apenas quem executou o comando pode cancelar.")], ephemeral: true });
    }
    await interaction.update({ embeds: [errorEmbed("❌ Ban cancelado.")], components: [] });
  }

  // ─── KICK CONFIRM ─────────────────────────────────────────────
  else if (id.startsWith("kick_confirm_")) {
    if (!interaction.memberPermissions?.has("KickMembers" as any)) {
      return interaction.reply({ embeds: [errorEmbed("Apenas quem executou o comando pode confirmar.")], ephemeral: true });
    }
    const parts = id.split("_");
    const userId = parts[2];
    const reason = decodeURIComponent(parts.slice(3).join("_"));
    const member = await interaction.guild?.members.fetch(userId).catch(() => null);
    if (!member) return interaction.update({ embeds: [errorEmbed("Usuário não encontrado.")], components: [] });
    await member.kick(reason);
    await interaction.update({
      embeds: [successEmbed("✅ Usuário Expulso", `<@${userId}> foi expulso.\n**Motivo:** ${reason}`)],
      components: [],
    });
  }

  else if (id.startsWith("kick_cancel_")) {
    const executorId = id.split("_")[2];
    if (interaction.user.id !== executorId) {
      return interaction.reply({ embeds: [errorEmbed("Apenas quem executou o comando pode cancelar.")], ephemeral: true });
    }
    await interaction.update({ embeds: [errorEmbed("❌ Kick cancelado.")], components: [] });
  }

  // ─── MINES GAME ───────────────────────────────────────────────
  else if (id.startsWith("mines_click_")) {
    const parts = id.split("_");
    const sessionId = parseInt(parts[2]);
    const cellIdx = parseInt(parts[3]);

    const [session] = await db.select().from(gameSessions).where(
      and(eq(gameSessions.id, sessionId), eq(gameSessions.userId, interaction.user.id))
    );
    if (!session || session.status !== "active") return interaction.deferUpdate();

    const data = session.data as any;
    if (data.revealed[cellIdx]) return interaction.deferUpdate();

    if (data.mines.includes(cellIdx)) {
      data.revealed[cellIdx] = true;
      data.status = "lost";
      await db.update(gameSessions).set({ status: "finished", data }).where(eq(gameSessions.id, sessionId));
      await interaction.update({ embeds: [buildMinesEmbed(data, data.bet).setColor(0xff0000 as any).setTitle("💥 Você explodiu!")], components: buildMinesGrid({ ...data, sessionId }) });
    } else {
      data.revealed[cellIdx] = true;
      const safeCount = data.revealed.filter(Boolean).length;
      const totalSafe = 25 - data.mines.length;

      if (safeCount === totalSafe) {
        data.status = "won";
        const mult = parseFloat(calculateMultiplier(safeCount, data.mines.length, 25));
        const prize = Math.floor(data.bet * mult);
        await addCoins(interaction.user.id, interaction.guild!.id, prize);
        await db.update(gameSessions).set({ status: "finished", data: { ...data, prize } }).where(eq(gameSessions.id, sessionId));
        await interaction.update({ embeds: [buildMinesEmbed({ ...data, prize }, data.bet).setColor(0x00ff00 as any).setTitle("🎉 Você ganhou tudo!")], components: buildMinesGrid({ ...data, sessionId }) });
      } else {
        await db.update(gameSessions).set({ data }).where(eq(gameSessions.id, sessionId));
        await interaction.update({ embeds: [buildMinesEmbed({ ...data, sessionId }, data.bet)], components: buildMinesGrid({ ...data, sessionId }) });
      }
    }
  }

  else if (id.startsWith("mines_cashout_")) {
    const sessionId = parseInt(id.split("_")[2]);
    const [session] = await db.select().from(gameSessions).where(
      and(eq(gameSessions.id, sessionId), eq(gameSessions.userId, interaction.user.id))
    );
    if (!session || session.status !== "active") return interaction.deferUpdate();
    const data = session.data as any;
    const safeCount = data.revealed.filter(Boolean).length;
    if (safeCount === 0) return interaction.deferUpdate();

    const mult = parseFloat(calculateMultiplier(safeCount, data.mines.length, 25));
    const prize = Math.floor(data.bet * mult);
    data.status = "cashed";
    await addCoins(interaction.user.id, interaction.guild!.id, prize);
    await db.update(gameSessions).set({ status: "finished", data: { ...data, prize } }).where(eq(gameSessions.id, sessionId));
    await interaction.update({ embeds: [buildMinesEmbed({ ...data }, data.bet).setTitle(`💰 Saque realizado! +🪙 ${prize}`).setColor(0x00ff00 as any)], components: buildMinesGrid({ ...data, status: "won", sessionId }) });
  }

  // ─── BLACKJACK ────────────────────────────────────────────────
  else if (id.startsWith("bj_")) {
    const parts = id.split("_");
    const action = parts[1];
    const sessionId = parseInt(parts[2]);

    const [session] = await db.select().from(gameSessions).where(
      and(eq(gameSessions.id, sessionId), eq(gameSessions.userId, interaction.user.id))
    );
    if (!session || session.status !== "active") return interaction.deferUpdate();
    const data = session.data as any;

    if (action === "hit") {
      const card = data.deck.pop()!;
      data.playerHand.push(card);
      const pv = handValue(data.playerHand);
      if (pv > 21) {
        data.status = "lost";
        await db.update(gameSessions).set({ status: "finished", data }).where(eq(gameSessions.id, sessionId));
        await interaction.update({ embeds: [buildBJEmbed(data, true)], components: [buildBJButtons(sessionId, true)] });
      } else if (pv === 21) {
        await runDealerAndFinish(interaction, sessionId, data);
      } else {
        await db.update(gameSessions).set({ data }).where(eq(gameSessions.id, sessionId));
        await interaction.update({ embeds: [buildBJEmbed(data)], components: [buildBJButtons(sessionId)] });
      }
    } else if (action === "stand") {
      await runDealerAndFinish(interaction, sessionId, data);
    } else if (action === "double") {
      const wallet = await getOrCreateWallet(interaction.user.id, interaction.guild!.id);
      if (wallet.balance < data.bet) return interaction.reply({ embeds: [errorEmbed("Saldo insuficiente para dobrar!")], ephemeral: true });
      await addCoins(interaction.user.id, interaction.guild!.id, -data.bet);
      data.bet *= 2;
      const card = data.deck.pop()!;
      data.playerHand.push(card);
      await runDealerAndFinish(interaction, sessionId, data);
    }
  }

  // ─── TICKET PANEL SETUP ──────────────────────────────────────
  else if (id.startsWith("ticket_setup_")) {
    const parts = id.split("_");
    const action = parts[2];
    const sessionId = parts.slice(3).join("_");
    const config = setupSessions.get(sessionId);
    if (!config) return interaction.reply({ embeds: [errorEmbed("Sessão expirada. Use `/ticketpainel criar` novamente.")], ephemeral: true });

    if (action === "type") {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`ticket_settype_single_${sessionId}`).setLabel("🔘 Botão Único").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`ticket_settype_multi_${sessionId}`).setLabel("🔢 Multi-Botões (até 5)").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`ticket_settype_menu_${sessionId}`).setLabel("📋 Menu de Seleção").setStyle(ButtonStyle.Secondary),
      );
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(BLOOD_RED).setTitle("📋 Tipo de Painel").setDescription("Escolha como os usuários vão abrir tickets:")], components: [row], ephemeral: true });
    }

    else if (action === "title") {
      const modal = new ModalBuilder().setCustomId(`ticket_modal_title_${sessionId}`).setTitle("Título e Descrição do Painel");
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId("title").setLabel("Título do painel").setStyle(TextInputStyle.Short).setValue(config.title ?? "🎫 Central de Suporte").setRequired(true).setMaxLength(100)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId("description").setLabel("Descrição do painel").setStyle(TextInputStyle.Paragraph).setValue(config.description ?? "").setRequired(false).setMaxLength(2000)
        )
      );
      await interaction.showModal(modal);
    }

    else if (action === "color") {
      const modal = new ModalBuilder().setCustomId(`ticket_modal_color_${sessionId}`).setTitle("Cor da Embed");
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId("color").setLabel("Cor hexadecimal (ex: #8B0000)").setStyle(TextInputStyle.Short).setValue(config.color ?? "#8B0000").setRequired(true).setMaxLength(7)
        )
      );
      await interaction.showModal(modal);
    }

    else if (action === "btnlabel") {
      const modal = new ModalBuilder().setCustomId(`ticket_modal_btnlabel_${sessionId}`).setTitle("Label do Botão (Painel Único)");
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId("label").setLabel("Texto do botão de abertura").setStyle(TextInputStyle.Short).setValue(config.buttonLabel ?? "📩 Abrir Ticket").setRequired(true).setMaxLength(80)
        )
      );
      await interaction.showModal(modal);
    }

    else if (action === "staff") {
      const modal = new ModalBuilder().setCustomId(`ticket_modal_staff_${sessionId}`).setTitle("Cargos de Staff");
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId("staffIds").setLabel("IDs dos cargos de staff (um por linha)").setStyle(TextInputStyle.Paragraph).setRequired(false)
            .setPlaceholder("123456789012345678\n987654321098765432")
            .setValue((config.staffRoleIds ?? []).join("\n"))
        )
      );
      await interaction.showModal(modal);
    }

    else if (action === "log") {
      const modal = new ModalBuilder().setCustomId(`ticket_modal_log_${sessionId}`).setTitle("Canal de Log");
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId("logId").setLabel("ID do canal de log (deixe vazio para nenhum)").setStyle(TextInputStyle.Short).setRequired(false)
            .setValue(config.logChannelId ?? "")
        )
      );
      await interaction.showModal(modal);
    }

    else if (action === "category") {
      const modal = new ModalBuilder().setCustomId(`ticket_modal_category_${sessionId}`).setTitle("Categoria dos Tickets");
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId("catId").setLabel("ID da categoria (deixe vazio para nenhuma)").setStyle(TextInputStyle.Short).setRequired(false)
            .setValue(config.categoryId ?? "")
        )
      );
      await interaction.showModal(modal);
    }

    else if (action === "finish") {
      await interaction.deferUpdate();
      const guild = interaction.guild!;
      const channel = await guild.channels.fetch(config.channelId).catch(() => null) as any;
      if (!channel) return interaction.editReply({ embeds: [errorEmbed("Canal não encontrado.")], components: [] }).catch(() => {});

      const embed = new EmbedBuilder()
        .setColor(parseInt((config.color ?? "#8B0000").replace("#", ""), 16) as any)
        .setTitle(config.title ?? "🎫 Central de Suporte")
        .setDescription(config.description ?? "Clique abaixo para abrir um ticket!");

      const ts = Date.now();
      const finalComponents: ActionRowBuilder<any>[] = [];

      if (config.type === "single") {
        finalComponents.push(
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`ticket_open_single_${ts}`).setLabel(config.buttonLabel ?? "📩 Abrir Ticket").setStyle(ButtonStyle.Primary)
          )
        );
      } else if (config.type === "multi") {
        const buttons = (config.buttons ?? []).slice(0, 5);
        if (buttons.length > 0) {
          finalComponents.push(
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              buttons.map((b: any, i: number) =>
                new ButtonBuilder().setCustomId(`ticket_open_btn_${i}_${ts}`).setLabel(b.label ?? `Opção ${i + 1}`).setStyle(ButtonStyle.Primary)
              )
            )
          );
        }
      } else if (config.type === "menu") {
        const opts = (config.menuOptions ?? []).slice(0, 25);
        if (opts.length > 0) {
          finalComponents.push(
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId(`ticket_menu_open_${ts}`)
                .setPlaceholder(config.menuPlaceholder ?? "Selecione uma categoria...")
                .addOptions(opts.map((o: any) =>
                  new StringSelectMenuOptionBuilder().setLabel(o.label).setValue(o.value).setDescription(o.description ?? "")
                ))
            )
          );
        }
      }

      const msg = await channel.send({ embeds: [embed], components: finalComponents });

      await db.insert(ticketPanels).values({
        guildId: config.guildId,
        channelId: config.channelId,
        messageId: msg.id,
        type: config.type,
        config,
        staffRoleIds: config.staffRoleIds ?? [],
        logChannelId: config.logChannelId,
        categoryId: config.categoryId,
        embedColor: config.color ?? "#8B0000",
      });

      setupSessions.delete(sessionId);

      await interaction.editReply({
        embeds: [successEmbed("✅ Painel Publicado!", `O painel foi criado em <#${config.channelId}>!`)],
        components: [],
      });
    }

    else if (action === "cancel") {
      setupSessions.delete(sessionId);
      await interaction.update({ embeds: [errorEmbed("❌ Criação do painel cancelada.")], components: [] });
    }
  }

  // ─── TICKET TYPE SELECTOR ─────────────────────────────────────
  else if (id.startsWith("ticket_settype_")) {
    const parts = id.split("_");
    const type = parts[2];
    const sessionId = parts.slice(3).join("_");
    const config = setupSessions.get(sessionId);
    if (!config) return interaction.reply({ embeds: [errorEmbed("Sessão expirada.")], ephemeral: true });

    if (type === "multi") {
      const modal = new ModalBuilder().setCustomId(`ticket_modal_multibtns_${sessionId}`).setTitle("Configurar Multi-Botões");
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId("buttons").setLabel("Um botão por linha (até 5, máx 80 chars cada)").setStyle(TextInputStyle.Paragraph).setRequired(true)
            .setPlaceholder("📞 Suporte Técnico\n💰 Financeiro\n❓ Dúvidas Gerais\n🛒 Compras")
        )
      );
      await interaction.showModal(modal);
    } else if (type === "menu") {
      const modal = new ModalBuilder().setCustomId(`ticket_modal_menuopts_${sessionId}`).setTitle("Configurar Menu de Seleção");
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId("options").setLabel("Uma opção por linha (até 25)").setStyle(TextInputStyle.Paragraph).setRequired(true)
            .setPlaceholder("Suporte Técnico\nFinanceiro\nDúvidas Gerais\nParcerias")
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId("placeholder").setLabel("Texto placeholder do menu").setStyle(TextInputStyle.Short).setValue("Selecione uma categoria...").setRequired(false)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId("descriptions").setLabel("Descrições (1 por linha, mesma ordem das opções)").setStyle(TextInputStyle.Paragraph).setRequired(false)
            .setPlaceholder("Suporte para problemas técnicos\nQuestões financeiras")
        )
      );
      await interaction.showModal(modal);
    } else {
      config.type = "single";
      setupSessions.set(sessionId, config);
      const prev = buildPanelPreview(config);
      await interaction.update({
        embeds: [
          new EmbedBuilder().setColor(BLOOD_RED).setTitle("🎫 Tipo: Botão Único").setDescription("✅ Tipo definido! Configure o label do botão abaixo."),
          ...prev.embeds,
        ],
        components: [...prev.components, ...buildSetupButtons(sessionId)],
      });
    }
  }

  // ─── TICKET OPEN (Button) ─────────────────────────────────────
  else if (id.startsWith("ticket_open_")) {
    if (!interaction.guild) return;
    await interaction.deferReply({ ephemeral: true });

    const [panel] = await db.select().from(ticketPanels).where(eq(ticketPanels.messageId, interaction.message.id));
    const config = panel?.config as any;

    let label: string | null = null;
    if (id.includes("_btn_")) {
      const btnIdx = parseInt(id.split("_")[3] ?? "0");
      label = config?.buttons?.[btnIdx]?.label ?? `Categoria ${btnIdx + 1}`;
    } else {
      label = config?.buttonLabel ?? "Ticket";
    }

    // Check for existing open ticket
    const existingTicket = await db.select().from(tickets).where(
      and(eq(tickets.guildId, interaction.guild.id), eq(tickets.userId, interaction.user.id), eq(tickets.status, "open"))
    );
    if (existingTicket.length) {
      return interaction.editReply({ embeds: [errorEmbed(`Você já tem um ticket aberto em <#${existingTicket[0].channelId}>!`)] });
    }

    const channel = await createTicketChannel(
      interaction.guild,
      interaction.user.id,
      interaction.user.tag,
      panel?.id ?? null,
      panel?.staffRoleIds ?? [],
      panel?.categoryId ?? null,
      panel?.logChannelId ?? null,
      label,
    );

    if (!channel) {
      return interaction.editReply({ embeds: [errorEmbed("Falha ao criar o ticket. Verifique se o bot tem permissões.")] });
    }

    await interaction.editReply({ embeds: [successEmbed("✅ Ticket Aberto!", `Seu ticket foi criado em ${channel}!`)] });
  }

  // ─── TICKET CLOSE ─────────────────────────────────────────────
  else if (id.startsWith("ticket_close_reason_")) {
    const channelId = id.replace("ticket_close_reason_", "");
    const modal = new ModalBuilder().setCustomId(`ticket_modal_close_reason_${channelId}`).setTitle("Fechar Ticket com Motivo");
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("reason").setLabel("Motivo do fechamento").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500)
      )
    );
    await interaction.showModal(modal);
  }

  else if (id.startsWith("ticket_close_")) {
    const channelId = id.replace("ticket_close_", "");
    await closeTicket(interaction, channelId, null);
  }

  // ─── BUTTON ROLE ─────────────────────────────────────────────
  else if (id.startsWith("buttonrole_")) {
    const [row] = await db.select().from(buttonRoles).where(eq(buttonRoles.customId, id));
    if (!row) return interaction.reply({ embeds: [errorEmbed("Configuração de cargo não encontrada.")], ephemeral: true });
    const member = interaction.member as any;
    if (member.roles.cache.has(row.roleId)) {
      await member.roles.remove(row.roleId);
      await interaction.reply({ embeds: [successEmbed("✅ Cargo Removido", `O cargo <@&${row.roleId}> foi removido.`)], ephemeral: true });
    } else {
      await member.roles.add(row.roleId);
      await interaction.reply({ embeds: [successEmbed("✅ Cargo Adicionado", `O cargo <@&${row.roleId}> foi adicionado!`)], ephemeral: true });
    }
  }

  // ─── AUTOROLE BUTTON ─────────────────────────────────────────
  else if (id.startsWith("autorole_btn_")) {
    const roleId = id.replace("autorole_btn_", "");
    const member = interaction.member as any;
    if (member.roles.cache.has(roleId)) {
      await member.roles.remove(roleId);
      await interaction.reply({ embeds: [successEmbed("✅ Cargo Removido", `O cargo <@&${roleId}> foi removido.`)], ephemeral: true });
    } else {
      await member.roles.add(roleId);
      await interaction.reply({ embeds: [successEmbed("✅ Cargo Adicionado", `O cargo <@&${roleId}> foi adicionado!`)], ephemeral: true });
    }
  }

  // ─── COIN TRANSFER ────────────────────────────────────────────
  else if (id.startsWith("transfer_confirm_sender_")) {
    const transferId = parseInt(id.split("_")[3]);
    const [transfer] = await db.select().from(coinTransfers).where(eq(coinTransfers.id, transferId));
    if (!transfer || transfer.status !== "pending") return interaction.reply({ embeds: [errorEmbed("Transferência não encontrada ou expirada.")], ephemeral: true });
    if (interaction.user.id !== transfer.fromUserId) return interaction.reply({ embeds: [errorEmbed("Apenas o remetente pode confirmar este botão!")], ephemeral: true });

    await db.update(coinTransfers).set({ status: "sender_confirmed" }).where(eq(coinTransfers.id, transferId));
    await interaction.reply({ embeds: [successEmbed("✅ Você confirmou!", "Aguardando o destinatário confirmar também...")], ephemeral: true });
  }

  else if (id.startsWith("transfer_confirm_receiver_")) {
    const transferId = parseInt(id.split("_")[3]);
    const [transfer] = await db.select().from(coinTransfers).where(eq(coinTransfers.id, transferId));
    if (!transfer || (transfer.status !== "pending" && transfer.status !== "sender_confirmed")) {
      return interaction.reply({ embeds: [errorEmbed("Transferência não encontrada ou expirada.")], ephemeral: true });
    }
    if (interaction.user.id !== transfer.toUserId) return interaction.reply({ embeds: [errorEmbed("Apenas o destinatário pode confirmar este botão!")], ephemeral: true });

    // Check sender balance
    const senderWallet = await getOrCreateWallet(transfer.fromUserId, transfer.guildId);
    if (senderWallet.balance < transfer.amount) {
      await db.update(coinTransfers).set({ status: "failed" }).where(eq(coinTransfers.id, transferId));
      return interaction.update({ embeds: [errorEmbed("Saldo insuficiente! O remetente não tem coins suficientes.")], components: [] });
    }

    // Execute transfer
    await addCoins(transfer.fromUserId, transfer.guildId, -transfer.amount);
    await addCoins(transfer.toUserId, transfer.guildId, transfer.amount);
    await db.update(coinTransfers).set({ status: "completed" }).where(eq(coinTransfers.id, transferId));

    await interaction.update({
      embeds: [
        new EmbedBuilder().setColor(0x00ff00 as any)
          .setTitle("✅ Transferência Concluída!")
          .setDescription(
            `**De:** <@${transfer.fromUserId}>\n` +
            `**Para:** <@${transfer.toUserId}>\n` +
            `**Valor:** 🪙 ${transfer.amount.toLocaleString("pt-BR")} coins\n\n` +
            `Ambos confirmaram! Transferência realizada com sucesso.`
          )
      ],
      components: [],
    });
  }

  else if (id.startsWith("transfer_cancel_")) {
    const transferId = parseInt(id.split("_")[2]);
    const [transfer] = await db.select().from(coinTransfers).where(eq(coinTransfers.id, transferId));
    if (!transfer || transfer.status !== "pending") return interaction.reply({ embeds: [errorEmbed("Transferência não encontrada ou já processada.")], ephemeral: true });
    if (interaction.user.id !== transfer.fromUserId && interaction.user.id !== transfer.toUserId) {
      return interaction.reply({ embeds: [errorEmbed("Apenas os envolvidos podem cancelar a transferência.")], ephemeral: true });
    }

    await db.update(coinTransfers).set({ status: "cancelled" }).where(eq(coinTransfers.id, transferId));
    await interaction.update({ embeds: [errorEmbed("❌ Transferência cancelada.")], components: [] });
  }

  // ─── COIN REQUEST ─────────────────────────────────────────────
  else if (id.startsWith("coinreq_accept_")) {
    const reqId = parseInt(id.split("_")[2]);
    const [request] = await db.select().from(coinRequests).where(eq(coinRequests.id, reqId));
    if (!request || request.status !== "pending") return interaction.reply({ embeds: [errorEmbed("Pedido não encontrado ou já processado.")], ephemeral: true });
    if (interaction.user.id !== request.toUserId) return interaction.reply({ embeds: [errorEmbed("Apenas o destinatário do pedido pode aceitar!")], ephemeral: true });

    const accepterWallet = await getOrCreateWallet(request.toUserId, request.guildId);
    if (accepterWallet.balance < request.amount) {
      await db.update(coinRequests).set({ status: "failed" }).where(eq(coinRequests.id, reqId));
      return interaction.update({ embeds: [errorEmbed("Saldo insuficiente para aceitar o pedido!")], components: [] });
    }

    await addCoins(request.toUserId, request.guildId, -request.amount);
    await addCoins(request.fromUserId, request.guildId, request.amount);
    await db.update(coinRequests).set({ status: "accepted" }).where(eq(coinRequests.id, reqId));

    await interaction.update({
      embeds: [
        new EmbedBuilder().setColor(0x00ff00 as any)
          .setTitle("✅ Pedido Aceito!")
          .setDescription(`<@${interaction.user.id}> enviou **🪙 ${request.amount.toLocaleString("pt-BR")} coins** para <@${request.fromUserId}>!`)
      ],
      components: [],
    });
  }

  else if (id.startsWith("coinreq_deny_")) {
    const reqId = parseInt(id.split("_")[2]);
    const [request] = await db.select().from(coinRequests).where(eq(coinRequests.id, reqId));
    if (!request || request.status !== "pending") return interaction.reply({ embeds: [errorEmbed("Pedido não encontrado.")], ephemeral: true });
    if (interaction.user.id !== request.toUserId) return interaction.reply({ embeds: [errorEmbed("Apenas o destinatário do pedido pode recusar!")], ephemeral: true });

    await db.update(coinRequests).set({ status: "denied" }).where(eq(coinRequests.id, reqId));
    await interaction.update({
      embeds: [errorEmbed(`❌ <@${interaction.user.id}> recusou o pedido de <@${request.fromUserId}>.`)],
      components: [],
    });
  }

  else {
    await interaction.deferUpdate().catch(() => {});
  }
}

async function closeTicket(interaction: ButtonInteraction, channelId: string, reason: string | null) {
  if (!interaction.guild) return;

  const [ticket] = await db.select().from(tickets).where(eq(tickets.channelId, channelId));
  if (!ticket) return interaction.reply({ embeds: [errorEmbed("Ticket não encontrado.")], ephemeral: true });

  const member = interaction.member as any;
  const isOwner = interaction.user.id === ticket.userId;
  if (!isOwner && !member.permissions?.has("ManageChannels")) {
    return interaction.reply({ embeds: [errorEmbed("Apenas o dono do ticket ou staff pode fechá-lo.")], ephemeral: true });
  }

  await db.update(tickets).set({ status: "closed", closedAt: new Date() }).where(eq(tickets.channelId, channelId));

  const channel = interaction.guild.channels.cache.get(channelId) as TextChannel;
  if (!channel) return;

  // Fetch panel log channel
  let logChannelId: string | null = null;
  if (ticket.panelId) {
    const [panel] = await db.select().from(ticketPanels).where(eq(ticketPanels.id, ticket.panelId));
    logChannelId = panel?.logChannelId ?? null;
  }

  // Fetch ticket owner tag
  const ownerUser = await interaction.guild.members.fetch(ticket.userId).catch(() => null);
  const ownerTag = ownerUser?.user?.tag ?? ticket.userId;

  // Generate transcript BEFORE deleting
  const transcriptFile = await generateTranscript(channel, ownerTag, interaction.user.tag, reason);

  const closeEmbed = new EmbedBuilder().setColor(BLOOD_RED)
    .setTitle("🔒 Ticket Fechado")
    .setDescription(
      `Ticket fechado por ${interaction.user}\n` +
      (reason ? `**Motivo:** ${reason}\n` : "") +
      `\nO transcript foi salvo. Este canal será deletado em **10 segundos**...`
    )
    .setTimestamp();

  await interaction.reply({ embeds: [closeEmbed] });

  // Send transcript to log channel
  if (logChannelId && transcriptFile) {
    const logChannel = interaction.guild.channels.cache.get(logChannelId) as TextChannel | undefined;
    if (logChannel) {
      const logEmbed = new EmbedBuilder().setColor(BLOOD_RED)
        .setTitle("📋 Transcript do Ticket")
        .addFields(
          { name: "Canal", value: `#${channel.name}`, inline: true },
          { name: "Usuário", value: `<@${ticket.userId}> (${ownerTag})`, inline: true },
          { name: "Fechado por", value: `${interaction.user} (${interaction.user.tag})`, inline: true },
          ...(reason ? [{ name: "Motivo", value: reason, inline: false }] : []),
          { name: "Data de Abertura", value: ticket.createdAt ? new Date(ticket.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "N/A", inline: true },
          { name: "Data de Fechamento", value: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }), inline: true },
        )
        .setTimestamp();
      await logChannel.send({ embeds: [logEmbed], files: [transcriptFile] }).catch(() => {});
    }
  }

  // DM transcript to ticket owner
  if (ownerUser) {
    const transcriptFileDM = await generateTranscript(channel, ownerTag, interaction.user.tag, reason);
    const dmEmbed = new EmbedBuilder().setColor(BLOOD_RED)
      .setTitle("📋 Seu ticket foi fechado")
      .setDescription(
        `Seu ticket **#${channel.name}** no servidor **${interaction.guild.name}** foi fechado.\n` +
        (reason ? `**Motivo:** ${reason}\n` : "") +
        `\nO transcript com todas as mensagens está anexado abaixo.`
      )
      .setTimestamp();
    await ownerUser.send({ embeds: [dmEmbed], ...(transcriptFileDM ? { files: [transcriptFileDM] } : {}) }).catch(() => {});
  }

  setTimeout(async () => {
    await channel.delete(`Ticket fechado por ${interaction.user.tag}`).catch(() => {});
  }, 10000);
}

async function runDealerAndFinish(interaction: ButtonInteraction, sessionId: number, data: any) {
  while (handValue(data.dealerHand) < 17) {
    const card = data.deck.pop();
    if (card) data.dealerHand.push(card);
    else break;
  }

  const pv = handValue(data.playerHand);
  const dv = handValue(data.dealerHand);
  let status: string;
  let prize = 0;

  if (pv > 21) { status = "lost"; }
  else if (dv > 21 || pv > dv) { status = "won"; prize = data.bet * 2; }
  else if (pv === dv) { status = "tie"; prize = data.bet; }
  else { status = "lost"; }

  if (prize > 0) await addCoins(interaction.user.id, interaction.guild!.id, prize);
  data.status = status;
  data.prize = prize;
  await db.update(gameSessions).set({ status: "finished", data }).where(eq(gameSessions.id, sessionId));
  await interaction.update({ embeds: [buildBJEmbed(data, true)], components: [buildBJButtons(sessionId, true)] });
}
