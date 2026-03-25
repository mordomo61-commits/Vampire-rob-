import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  EmbedBuilder,
  ChannelType,
  type ChatInputCommandInteraction,
  type TextChannel,
} from "discord.js";
import { db } from "../../db";
import { ticketPanels, tickets } from "../../db";
import { eq } from "drizzle-orm";
import { successEmbed, errorEmbed, BLOOD_RED } from "../../lib/embed.js";

export const data = new SlashCommandBuilder()
  .setName("ticketpainel")
  .setDescription("Gerenciar painéis de tickets")
  .addSubcommand((s) => s.setName("criar").setDescription("Criar um painel de tickets interativo"))
  .addSubcommand((s) => s.setName("listar").setDescription("Listar painéis de tickets criados"))
  .addSubcommand((s) =>
    s.setName("deletar")
      .setDescription("Deletar um painel de tickets")
      .addIntegerOption((o) => o.setName("id").setDescription("ID do painel").setRequired(true))
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export const setupSessions = new Map<string, any>();

export function buildPanelPreview(config: any): { embeds: EmbedBuilder[]; components: ActionRowBuilder<any>[] } {
  let colorNum: number = BLOOD_RED as number;
  try { colorNum = parseInt((config.color ?? "#8B0000").replace("#", ""), 16); } catch {}

  const embed = new EmbedBuilder()
    .setColor(colorNum as any)
    .setTitle(config.title ?? "🎫 Central de Suporte")
    .setDescription(config.description ?? "Clique abaixo para abrir um ticket!")
    .setFooter({ text: "🔴 Pré-visualização em tempo real" });

  const components: ActionRowBuilder<any>[] = [];

  if (config.type === "single" || !config.type) {
    components.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_preview_disabled")
          .setLabel(config.buttonLabel ?? "📩 Abrir Ticket")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true)
      )
    );
  } else if (config.type === "multi") {
    const btns = (config.buttons ?? []).slice(0, 5);
    if (btns.length > 0) {
      components.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          btns.map((b: any, i: number) =>
            new ButtonBuilder()
              .setCustomId(`ticket_preview_multi_${i}`)
              .setLabel(b.label ?? `Botão ${i + 1}`)
              .setStyle(ButtonStyle.Primary)
              .setDisabled(true)
          )
        )
      );
    } else {
      embed.addFields({ name: "ℹ️ Botões", value: "Nenhum botão configurado ainda" });
    }
  } else if (config.type === "menu") {
    const opts = (config.menuOptions ?? []).slice(0, 25);
    if (opts.length > 0) {
      components.push(
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("ticket_preview_menu_disabled")
            .setPlaceholder(config.menuPlaceholder ?? "Selecione uma categoria...")
            .addOptions(opts.map((o: any) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(o.label ?? "Opção")
                .setValue(o.value ?? "opt")
                .setDescription(o.description ?? "")
            ))
            .setDisabled(true)
        )
      );
    } else {
      embed.addFields({ name: "ℹ️ Menu", value: "Nenhuma opção configurada ainda" });
    }
  }

  return { embeds: [embed], components };
}

export function buildSetupButtons(sessionId: string): ActionRowBuilder<ButtonBuilder>[] {
  const r1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`ticket_setup_type_${sessionId}`).setLabel("📋 Tipo de Painel").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`ticket_setup_title_${sessionId}`).setLabel("✏️ Título/Descrição").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`ticket_setup_color_${sessionId}`).setLabel("🎨 Cor").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`ticket_setup_btnlabel_${sessionId}`).setLabel("🏷️ Label Botão").setStyle(ButtonStyle.Secondary),
  );
  const r2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`ticket_setup_staff_${sessionId}`).setLabel("👥 Set Staff").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ticket_setup_log_${sessionId}`).setLabel("📋 Set Log").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ticket_setup_category_${sessionId}`).setLabel("📁 Set Categoria").setStyle(ButtonStyle.Secondary),
  );
  const r3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`ticket_setup_finish_${sessionId}`).setLabel("✅ Finalizar e Publicar").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`ticket_setup_cancel_${sessionId}`).setLabel("❌ Cancelar").setStyle(ButtonStyle.Danger),
  );
  return [r1, r2, r3];
}

export async function buildFinalPanel(config: any): Promise<ActionRowBuilder<any>[]> {
  const components: ActionRowBuilder<any>[] = [];
  const ts = Date.now();

  if (config.type === "single") {
    components.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket_open_single_${ts}`)
          .setLabel(config.buttonLabel ?? "📩 Abrir Ticket")
          .setStyle(ButtonStyle.Primary)
      )
    );
  } else if (config.type === "multi") {
    const btns = (config.buttons ?? []).slice(0, 5);
    if (btns.length > 0) {
      components.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          btns.map((b: any, i: number) =>
            new ButtonBuilder()
              .setCustomId(`ticket_open_btn_${i}_${ts}`)
              .setLabel(b.label)
              .setStyle(ButtonStyle.Primary)
          )
        )
      );
    }
  } else if (config.type === "menu") {
    const opts = (config.menuOptions ?? []).slice(0, 25);
    if (opts.length > 0) {
      components.push(
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`ticket_open_menu_${ts}`)
            .setPlaceholder(config.menuPlaceholder ?? "Selecione uma categoria...")
            .addOptions(opts.map((o: any) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(o.label)
                .setValue(o.value)
                .setDescription(o.description ?? "")
            ))
        )
      );
    }
  }

  return components;
}

export async function createTicketChannel(
  guild: any,
  userId: string,
  userTag: string,
  panelId: number | null,
  staffRoleIds: string[],
  categoryId: string | null,
  logChannelId: string | null,
  label: string | null
): Promise<TextChannel | null> {
  const safeName = `ticket-${userTag.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 15) || "user"}-${Date.now().toString().slice(-4)}`;

  const channel = await guild.channels.create({
    name: safeName,
    type: ChannelType.GuildText,
    parent: categoryId ?? undefined,
    permissionOverwrites: [
      { id: guild.id, deny: ["ViewChannel"] },
      { id: userId, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory", "AttachFiles"] },
      { id: guild.members.me!.id, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory", "ManageMessages", "ManageChannels"] },
      ...staffRoleIds.map((rid) => ({
        id: rid,
        allow: ["ViewChannel", "SendMessages", "ReadMessageHistory", "ManageMessages"] as any[],
      })),
    ],
  }).catch((e: any) => { console.error("Error creating ticket channel:", e); return null; });

  if (!channel) return null;

  await db.insert(tickets).values({
    guildId: guild.id,
    channelId: channel.id,
    userId,
    panelId,
    buttonLabel: label,
    status: "open",
  });

  const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`ticket_close_${channel.id}`).setLabel("🔒 Fechar Ticket").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`ticket_close_reason_${channel.id}`).setLabel("🔒 Fechar com Motivo").setStyle(ButtonStyle.Secondary),
  );

  const user = await guild.client.users.fetch(userId);
  await channel.send({
    content: `<@${userId}> ${staffRoleIds.map((r) => `<@&${r}>`).join(" ")}`,
    embeds: [
      new EmbedBuilder()
        .setColor(BLOOD_RED)
        .setTitle(`🎫 Ticket ${label ? `— ${label}` : "Aberto"}`)
        .setDescription(`Olá <@${userId}>! Descreva sua solicitação e aguarde o atendimento.\n\n✅ Nossa equipe responderá em breve.\n\n*Use os botões abaixo para fechar o ticket.*`)
        .setFooter({ text: `Ticket criado por ${userTag}` })
        .setTimestamp(),
    ],
    components: [closeRow],
  });

  if (logChannelId) {
    const logCh = await guild.channels.fetch(logChannelId).catch(() => null) as any;
    if (logCh) {
      await logCh.send({
        embeds: [
          new EmbedBuilder().setColor(BLOOD_RED)
            .setTitle("📋 Ticket Aberto")
            .addFields(
              { name: "👤 Usuário", value: `<@${userId}> (${userId})`, inline: true },
              { name: "📁 Canal", value: `<#${channel.id}>`, inline: true },
              { name: "🏷️ Categoria", value: label ?? "Geral", inline: true },
            )
            .setTimestamp()
        ]
      });
    }
  }

  return channel;
}

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  const sub = interaction.options.getSubcommand();

  if (sub === "criar") {
    const sessionId = `ts_${interaction.user.id}_${Date.now()}`;
    const config = {
      guildId: interaction.guild.id,
      channelId: interaction.channel!.id,
      type: "single",
      title: "🎫 Central de Suporte",
      description: "Clique abaixo para abrir um ticket!\nNossa equipe irá te atender em breve.",
      color: "#8B0000",
      buttonLabel: "📩 Abrir Ticket",
      staffRoleIds: [] as string[],
      logChannelId: null as string | null,
      categoryId: null as string | null,
      buttons: [] as any[],
      menuOptions: [] as any[],
      menuPlaceholder: "Selecione uma categoria...",
    };
    setupSessions.set(sessionId, config);

    const preview = buildPanelPreview(config);
    await interaction.reply({
      embeds: [
        new EmbedBuilder().setColor(BLOOD_RED)
          .setTitle("🎫 Criação de Painel de Tickets")
          .setDescription(
            "Configure seu painel usando os botões abaixo.\n" +
            "**A pré-visualização atualiza em tempo real!**\n\n" +
            "📋 **Tipos disponíveis:**\n" +
            "• **Botão Único** — Um botão abre o ticket\n" +
            "• **Multi-Botões** — Até 5 botões com categorias\n" +
            "• **Menu de Seleção** — Dropdown com categorias\n\n" +
            "🔴 **Pré-visualização:**"
          ),
        ...preview.embeds,
      ],
      components: [...preview.components, ...buildSetupButtons(sessionId)],
      ephemeral: true,
    });
  }

  else if (sub === "listar") {
    const panels = await db.select().from(ticketPanels).where(eq(ticketPanels.guildId, interaction.guild.id));
    if (!panels.length) return interaction.reply({ embeds: [errorEmbed("Nenhum painel criado neste servidor.")], ephemeral: true });

    const list = panels.map((p) => {
      const conf = p.config as any;
      return `**ID ${p.id}** — ${conf?.title ?? "Painel"}\n└ Tipo: \`${p.type}\` | Canal: <#${p.channelId}>${p.logChannelId ? ` | Log: <#${p.logChannelId}>` : ""}`;
    }).join("\n\n");

    await interaction.reply({ embeds: [successEmbed("📋 Painéis de Tickets", list)] });
  }

  else if (sub === "deletar") {
    const id = interaction.options.getInteger("id", true);
    const [panel] = await db.select().from(ticketPanels).where(eq(ticketPanels.id, id));

    if (!panel || panel.guildId !== interaction.guild.id) {
      return interaction.reply({ embeds: [errorEmbed("Painel não encontrado.")], ephemeral: true });
    }

    if (panel.messageId) {
      const ch = await interaction.guild.channels.fetch(panel.channelId).catch(() => null) as any;
      if (ch) await ch.messages.fetch(panel.messageId).then((m: any) => m.delete()).catch(() => {});
    }

    await db.delete(ticketPanels).where(eq(ticketPanels.id, id));
    await interaction.reply({ embeds: [successEmbed("🗑️ Painel Deletado", `Painel **ID ${id}** removido com sucesso.`)] });
  }
}
