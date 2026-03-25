import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("ticketpainel")
  .setDescription("Criar e configurar o painel de tickets neste canal")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction) {
  const modal = new ModalBuilder()
    .setCustomId("ticket_panel_create")
    .setTitle("Configurar Painel de Tickets");

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("ticket_title")
        .setLabel("Título do painel")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue("🎫 Suporte")
        .setMaxLength(100)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("ticket_description")
        .setLabel("Descrição do painel")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setValue("Clique no botão abaixo para abrir um ticket de suporte!")
        .setMaxLength(1000)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("ticket_staff_roles")
        .setLabel("IDs dos cargos da equipe (separados por vírgula)")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder("123456789, 987654321")
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("ticket_log_channel")
        .setLabel("ID do canal de logs (opcional)")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("ticket_category")
        .setLabel("ID da categoria para os tickets (opcional)")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
    )
  );

  await interaction.showModal(modal);
}
