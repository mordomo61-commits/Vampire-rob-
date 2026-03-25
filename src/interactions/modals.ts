import {
  EmbedBuilder,
  type ModalSubmitInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  TextChannel,
} from "discord.js";
import { db } from "../db/index.js";
import { ticketPanels, tickets } from "../db/index.js";
import { eq } from "drizzle-orm";
import { BLOOD_RED, successEmbed, errorEmbed } from "../lib/embed.js";
import { generateTranscript } from "../lib/transcript.js";

export async function handleModal(interaction: ModalSubmitInteraction) {
  const id = interaction.customId;

  try {
    if (id === "embed_create_modal") await handleEmbedCreate(interaction);
    else if (id === "ticket_panel_create") await handleTicketPanelCreate(interaction);
    else if (id.startsWith("ticket_close_reason_")) await handleTicketCloseReason(interaction, id);
  } catch (err) {
    console.error("Modal error:", err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ embeds: [errorEmbed("Ocorreu um erro ao processar este formulário.")], ephemeral: true }).catch(() => {});
    }
  }
}

async function handleEmbedCreate(interaction: ModalSubmitInteraction) {
  const title = interaction.fields.getTextInputValue("embed_title") || undefined;
  const description = interaction.fields.getTextInputValue("embed_description") || undefined;
  const colorHex = interaction.fields.getTextInputValue("embed_color") || "#8B0000";
  const imageUrl = interaction.fields.getTextInputValue("embed_image") || undefined;
  const footer = interaction.fields.getTextInputValue("embed_footer") || undefined;

  const hexClean = colorHex.startsWith("#") ? colorHex : `#${colorHex}`;
  let colorInt = BLOOD_RED as number;
  if (/^#[0-9A-Fa-f]{6}$/.test(hexClean)) {
    colorInt = parseInt(hexClean.replace("#", ""), 16);
  }

  const embed = new EmbedBuilder().setColor(colorInt);
  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (imageUrl && isValidUrl(imageUrl)) embed.setImage(imageUrl);
  if (footer) embed.setFooter({ text: footer });
  embed.setTimestamp();

  await interaction.reply({
    embeds: [
      new EmbedBuilder().setColor(BLOOD_RED).setDescription("✅ **Preview do seu embed abaixo!** Se estiver correto, confirme para enviar."),
      embed,
    ],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`embed_send_${encodePayload({ title, description, colorHex: hexClean, imageUrl, footer })}`).setLabel("📤 Enviar Embed").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("embed_cancel").setLabel("❌ Cancelar").setStyle(ButtonStyle.Secondary),
      ),
    ],
    ephemeral: true,
  });
}

function encodePayload(obj: object): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64").slice(0, 80);
}

function isValidUrl(str: string): boolean {
  try { new URL(str); return true; } catch { return false; }
}

async function handleTicketPanelCreate(interaction: ModalSubmitInteraction) {
  if (!interaction.guild) return;

  const title = interaction.fields.getTextInputValue("ticket_title");
  const description = interaction.fields.getTextInputValue("ticket_description");
  const staffRolesRaw = interaction.fields.getTextInputValue("ticket_staff_roles");
  const logChannelId = interaction.fields.getTextInputValue("ticket_log_channel")?.trim() || null;
  const categoryId = interaction.fields.getTextInputValue("ticket_category")?.trim() || null;

  const staffRoleIds = staffRolesRaw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^\d+$/.test(s));

  await interaction.deferReply({ ephemeral: true });

  const [panel] = await db.insert(ticketPanels).values({
    guildId: interaction.guild.id,
    channelId: interaction.channel!.id,
    type: "single",
    config: { title, description },
    staffRoleIds,
    logChannelId,
    categoryId,
    embedColor: "#8B0000",
  }).returning();

  const embed = new EmbedBuilder()
    .setColor(parseInt("8B0000", 16))
    .setTitle(title || "🎫 Suporte")
    .setDescription(description || "Clique no botão abaixo para abrir um ticket de suporte!")
    .setFooter({ text: "Vampire Bot • Sistema de Tickets" });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket_open_${panel!.id}_Suporte`)
      .setLabel("🎫 Abrir Ticket")
      .setStyle(ButtonStyle.Danger)
  );

  await (interaction.channel as any).send({ embeds: [embed], components: [row] });

  await db.update(ticketPanels).set({ channelId: interaction.channel!.id }).where(eq(ticketPanels.id, panel!.id));

  await interaction.editReply({ embeds: [successEmbed("✅ Painel de Tickets Criado!", "O painel de tickets foi criado neste canal com sucesso!")] });
}

async function handleTicketCloseReason(interaction: ModalSubmitInteraction, id: string) {
  const ticketId = parseInt(id.replace("ticket_close_reason_", ""));
  const reason = interaction.fields.getTextInputValue("reason") || "Sem motivo informado";

  const ticketList = await db.select().from(tickets).where(eq(tickets.id, ticketId));
  if (!ticketList.length) return interaction.reply({ embeds: [errorEmbed("Ticket não encontrado.")], ephemeral: true });

  const ticket = ticketList[0]!;
  const guild = interaction.guild!;
  const channel = guild.channels.cache.get(ticket.channelId ?? "") as TextChannel | undefined;

  if (!channel) return interaction.reply({ embeds: [errorEmbed("Canal do ticket não encontrado.")], ephemeral: true });

  await interaction.deferReply({ ephemeral: true });

  await db.update(tickets).set({ status: "closed", closedAt: new Date() }).where(eq(tickets.id, ticketId));

  const ticketOwner = await interaction.client.users.fetch(ticket.userId).catch(() => null);
  const transcript = await generateTranscript(
    channel,
    ticketOwner?.tag ?? "Desconhecido",
    interaction.user.tag,
    reason
  );

  const panels = ticket.panelId ? await db.select().from(ticketPanels).where(eq(ticketPanels.id, ticket.panelId)) : [];
  const panel = panels[0];

  const closedEmbed = new EmbedBuilder()
    .setColor(parseInt("8B0000", 16))
    .setTitle("🔒 Ticket Fechado")
    .addFields(
      { name: "👤 Fechado por", value: interaction.user.toString(), inline: true },
      { name: "🕐 Data", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
      { name: "📝 Motivo", value: reason, inline: false },
    );

  const deleteRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`ticket_delete_${ticketId}`).setLabel("🗑️ Excluir Canal").setStyle(ButtonStyle.Danger)
  );

  const files = transcript ? [transcript] : [];
  await channel.send({ embeds: [closedEmbed], components: [deleteRow], files }).catch(() => null);

  if (panel?.logChannelId) {
    const logChannel = guild.channels.cache.get(panel.logChannelId) as TextChannel | undefined;
    if (logChannel) {
      const logEmbed = new EmbedBuilder()
        .setColor(parseInt("8B0000", 16))
        .setTitle("📋 Ticket Fechado — Log")
        .addFields(
          { name: "🎫 Canal", value: channel.name, inline: true },
          { name: "👤 Usuário", value: ticketOwner?.tag ?? ticket.userId, inline: true },
          { name: "🔒 Fechado por", value: interaction.user.tag, inline: true },
          { name: "📝 Motivo", value: reason, inline: false },
        )
        .setTimestamp();

      await logChannel.send({ embeds: [logEmbed], files: transcript ? [transcript] : [] }).catch(() => null);
    }
  }

  await channel.permissionOverwrites.edit(ticket.userId, { SendMessages: false }).catch(() => null);

  await interaction.editReply({ embeds: [successEmbed("🔒 Ticket Fechado!", "O ticket foi fechado. O canal permanece visível para o histórico.")] });
}
