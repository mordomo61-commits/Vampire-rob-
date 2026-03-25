import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type TextChannel,
} from "discord.js";
import { successEmbed, errorEmbed } from "../../lib/embed.js";

export const data = new SlashCommandBuilder()
  .setName("clear")
  .setDescription("Apagar mensagens do canal")
  .addIntegerOption((o) =>
    o.setName("quantidade")
      .setDescription("Quantidade de mensagens (1-100)")
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(100)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ embeds: [errorEmbed("Apenas administradores podem usar este comando.")], ephemeral: true });
  }

  const amount = interaction.options.getInteger("quantidade", true);
  const channel = interaction.channel as TextChannel;

  await interaction.deferReply({ ephemeral: true });

  const deleted = await channel.bulkDelete(amount, true).catch(() => null);
  const count = deleted?.size ?? 0;

  await interaction.editReply({
    embeds: [successEmbed("🗑️ Mensagens Apagadas", `**${count}** mensagens foram removidas do canal.`)],
  });
}
