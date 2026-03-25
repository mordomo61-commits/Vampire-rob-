import {
  type StringSelectMenuInteraction,
  type Client,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { db } from "../db";
import { ticketPanels, tickets } from "../db";
import { and, eq } from "drizzle-orm";
import { BLOOD_RED, successEmbed, errorEmbed } from "../lib/embed.js";
import { createTicketChannel } from "../commands/tickets/ticketpainel.js";

export async function handleSelect(interaction: StringSelectMenuInteraction, client: Client) {
  const id = interaction.customId;

  // ─── TICKET MENU OPEN ─────────────────────────────────────────
  if (id.startsWith("ticket_menu_open_") || id.startsWith("ticket_open_menu_")) {
    if (!interaction.guild) return;
    await interaction.deferReply({ ephemeral: true });

    const [panel] = await db.select().from(ticketPanels).where(eq(ticketPanels.messageId, interaction.message.id));
    const config = panel?.config as any;

    const selectedValue = interaction.values[0];
    const selectedOption = (config?.menuOptions ?? []).find((o: any) => o.value === selectedValue);
    const label = selectedOption?.label ?? selectedValue;

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
      return interaction.editReply({ embeds: [errorEmbed("Falha ao criar o ticket. Verifique se o bot tem permissões de criar canais.")] });
    }

    await interaction.editReply({ embeds: [successEmbed("✅ Ticket Aberto!", `Seu ticket foi criado em ${channel}!\n**Categoria:** ${label}`)] });
  }

  else {
    await interaction.deferUpdate().catch(() => {});
  }
}
