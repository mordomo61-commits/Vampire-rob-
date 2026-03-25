import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { infoEmbed, errorEmbed } from "../../lib/embed.js";

export const data = new SlashCommandBuilder()
  .setName("servericon")
  .setDescription("Exibe a foto/ícone do servidor");

export async function execute(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild;
  if (!guild) return interaction.reply({ embeds: [errorEmbed("Este comando só pode ser usado em servidores.")], ephemeral: true });

  const icon = guild.iconURL({ size: 4096, extension: "png" });

  if (!icon) {
    return interaction.reply({ embeds: [errorEmbed("Este servidor não possui foto de perfil.")], ephemeral: true });
  }

  await interaction.reply({
    embeds: [
      infoEmbed(`🖼️ Foto do servidor: ${guild.name}`, `[Clique para baixar em alta resolução](${icon})`)
        .setImage(icon)
        .setFooter({ text: `ID: ${guild.id}` }),
    ],
  });
}
