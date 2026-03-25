import {
  type ModalSubmitInteraction,
  type Client,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type TextChannel,
} from "discord.js";
import { db } from "../db";
import { tickets, ticketPanels } from "../db";
import { eq } from "drizzle-orm";
import { BLOOD_RED, successEmbed, errorEmbed } from "../lib/embed.js";
import { setupSessions, buildPanelPreview, buildSetupButtons } from "../commands/tickets/ticketpainel.js";
import { generateTranscript } from "../lib/transcript.js";

export async function handleModal(interaction: ModalSubmitInteraction, client: Client) {
  const id = interaction.customId;

  // ─── EMBED CREATE ──────────────────────────────────────────────
  if (id === "embed_create_modal") {
    const title = interaction.fields.getTextInputValue("embed_title");
    const description = interaction.fields.getTextInputValue("embed_description");
    const colorHex = interaction.fields.getTextInputValue("embed_color") || "#8B0000";
    const imageUrl = interaction.fields.getTextInputValue("embed_image");
    const footer = interaction.fields.getTextInputValue("embed_footer");

    let color: number = BLOOD_RED as number;
    try { color = parseInt(colorHex.replace("#", ""), 16); } catch {}

    const embed = new EmbedBuilder().setColor(color as any);
    if (title) embed.setTitle(title);
    if (description) embed.setDescription(description);
    if (imageUrl) { try { embed.setImage(imageUrl); } catch {} }
    if (footer) embed.setFooter({ text: footer });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("embed_edit").setLabel("✏️ Editar").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("embed_publish").setLabel("📨 Publicar").setStyle(ButtonStyle.Success),
    );

    await interaction.reply({ content: "**Pré-visualização:**", embeds: [embed], components: [row], ephemeral: true });
  }

  // ─── TICKET CLOSE WITH REASON ─────────────────────────────────
  else if (id.startsWith("ticket_modal_close_reason_")) {
    const channelId = id.replace("ticket_modal_close_reason_", "");
    const reason = interaction.fields.getTextInputValue("reason");

    if (!interaction.guild) return;

    const [ticket] = await db.select().from(tickets).where(eq(tickets.channelId, channelId));
    if (!ticket) return interaction.reply({ embeds: [errorEmbed("Ticket não encontrado.")], ephemeral: true });

    const member = interaction.member as any;
    const isOwner = interaction.user.id === ticket.userId;
    if (!isOwner && !member.permissions?.has("ManageChannels")) {
      return interaction.reply({ embeds: [errorEmbed("Apenas o dono do ticket ou staff pode fechá-lo.")], ephemeral: true });
    }

    await db.update(tickets).set({ status: "closed", closedAt: new Date() }).where(eq(tickets.channelId, channelId));

    const channel = interaction.guild.channels.cache.get(channelId) as TextChannel | undefined;
    if (!channel) return interaction.reply({ embeds: [errorEmbed("Canal não encontrado.")], ephemeral: true });

    // Fetch panel log channel
    let logChannelId: string | null = null;
    if (ticket.panelId) {
      const [panel] = await db.select().from(ticketPanels).where(eq(ticketPanels.id, ticket.panelId));
      logChannelId = panel?.logChannelId ?? null;
    }

    // Fetch ticket owner
    const ownerUser = await interaction.guild.members.fetch(ticket.userId).catch(() => null);
    const ownerTag = ownerUser?.user?.tag ?? ticket.userId;

    // Generate transcript BEFORE deleting
    const transcriptFile = await generateTranscript(channel, ownerTag, interaction.user.tag, reason);

    const closeEmbed = new EmbedBuilder().setColor(BLOOD_RED)
      .setTitle("🔒 Ticket Fechado com Motivo")
      .setDescription(
        `Ticket fechado por ${interaction.user}\n` +
        `**Motivo:** ${reason}\n\n` +
        `O transcript foi salvo. Este canal será deletado em **10 segundos**...`
      )
      .setTimestamp();

    await interaction.reply({ embeds: [closeEmbed] });

    // Send to log channel
    if (logChannelId && transcriptFile) {
      const logChannel = interaction.guild.channels.cache.get(logChannelId) as TextChannel | undefined;
      if (logChannel) {
        const logEmbed = new EmbedBuilder().setColor(BLOOD_RED)
          .setTitle("📋 Transcript do Ticket")
          .addFields(
            { name: "Canal", value: `#${channel.name}`, inline: true },
            { name: "Usuário", value: `<@${ticket.userId}> (${ownerTag})`, inline: true },
            { name: "Fechado por", value: `${interaction.user} (${interaction.user.tag})`, inline: true },
            { name: "Motivo", value: reason, inline: false },
            { name: "Data de Abertura", value: ticket.createdAt ? new Date(ticket.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "N/A", inline: true },
            { name: "Data de Fechamento", value: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }), inline: true },
          )
          .setTimestamp();
        await logChannel.send({ embeds: [logEmbed], files: [transcriptFile] }).catch(() => {});
      }
    }

    // DM transcript to ticket owner
    if (ownerUser && transcriptFile) {
      const transcriptFileDM = await generateTranscript(channel as any, ownerTag, interaction.user.tag, reason);
      const dmEmbed = new EmbedBuilder().setColor(BLOOD_RED)
        .setTitle("📋 Seu ticket foi fechado")
        .setDescription(
          `Seu ticket **#${channel.name}** no servidor **${interaction.guild.name}** foi fechado.\n` +
          `**Motivo:** ${reason}\n\n` +
          `O transcript com todas as mensagens está anexado abaixo.`
        )
        .setTimestamp();
      await ownerUser.send({ embeds: [dmEmbed], files: transcriptFileDM ? [transcriptFileDM] : [] }).catch(() => {});
    }

    setTimeout(async () => {
      await channel.delete(`Ticket fechado: ${reason}`).catch(() => {});
    }, 10000);
  }

  // ─── TICKET SETUP MODALS ──────────────────────────────────────
  else if (id.startsWith("ticket_modal_")) {
    const parts = id.split("_");
    const action = parts[2];
    const sessionId = parts.slice(3).join("_");
    const config = setupSessions.get(sessionId);

    if (!config) return interaction.reply({ embeds: [errorEmbed("Sessão expirada. Use `/ticketpainel criar` novamente.")], ephemeral: true });

    if (action === "title") {
      config.title = interaction.fields.getTextInputValue("title");
      config.description = interaction.fields.getTextInputValue("description") || config.description;
    } else if (action === "color") {
      const c = interaction.fields.getTextInputValue("color").trim();
      config.color = c.startsWith("#") ? c : `#${c}`;
    } else if (action === "btnlabel") {
      config.buttonLabel = interaction.fields.getTextInputValue("label");
    } else if (action === "staff") {
      const raw = interaction.fields.getTextInputValue("staffIds");
      config.staffRoleIds = raw.split(/[\n,]/).map((s: string) => s.trim()).filter((s: string) => /^\d{17,20}$/.test(s));
    } else if (action === "log") {
      const v = interaction.fields.getTextInputValue("logId").trim();
      config.logChannelId = /^\d{17,20}$/.test(v) ? v : null;
    } else if (action === "category") {
      const v = interaction.fields.getTextInputValue("catId").trim();
      config.categoryId = /^\d{17,20}$/.test(v) ? v : null;
    } else if (action === "multibtns") {
      const lines = interaction.fields.getTextInputValue("buttons").split("\n").slice(0, 5).map((l: string) => l.trim()).filter(Boolean);
      config.type = "multi";
      config.buttons = lines.map((l: string) => ({ label: l.slice(0, 80) }));
    } else if (action === "menuopts") {
      const lines = interaction.fields.getTextInputValue("options").split("\n").map((l: string) => l.trim()).filter(Boolean).slice(0, 25);
      const placeholder = interaction.fields.getTextInputValue("placeholder") || "Selecione uma categoria...";
      let descriptions: string[] = [];
      try {
        const descsRaw = interaction.fields.getTextInputValue("descriptions");
        descriptions = descsRaw.split("\n").map((l: string) => l.trim());
      } catch {}
      config.type = "menu";
      config.menuPlaceholder = placeholder;
      config.menuOptions = lines.map((l: string, i: number) => ({
        label: l.slice(0, 100),
        value: l.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 20) || `opt${i}`,
        description: (descriptions[i] ?? "").slice(0, 100),
      }));
    }

    setupSessions.set(sessionId, config);
    const preview = buildPanelPreview(config);

    await interaction.reply({
      embeds: [
        new EmbedBuilder().setColor(BLOOD_RED).setTitle("✅ Configuração Salva!").setDescription("Veja a pré-visualização atualizada abaixo:"),
        ...preview.embeds,
      ],
      components: [...preview.components, ...buildSetupButtons(sessionId)],
      ephemeral: true,
    });
  }

  else {
    await interaction.deferUpdate().catch(() => {});
  }
}
