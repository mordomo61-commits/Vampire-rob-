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
  .setName("embed")
  .setDescription("Criar embeds personalizados com pré-visualização em tempo real")
  .addSubcommand((s) => s.setName("criar").setDescription("Abrir o painel de criação de embeds"))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();

  if (sub === "criar") {
    const modal = new ModalBuilder()
      .setCustomId("embed_create_modal")
      .setTitle("Criar Embed Personalizado");

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("embed_title").setLabel("Título").setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(256)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("embed_description").setLabel("Descrição").setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(4000)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("embed_color").setLabel("Cor (hex, ex: #FF0000)").setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(7).setValue("#8B0000")
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("embed_image").setLabel("URL da Imagem").setStyle(TextInputStyle.Short).setRequired(false)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("embed_footer").setLabel("Rodapé").setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(2048)
      )
    );

    await interaction.showModal(modal);
  }
}
