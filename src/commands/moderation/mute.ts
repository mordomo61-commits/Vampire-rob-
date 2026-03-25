import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";
import { successEmbed, errorEmbed } from "../../lib/embed.js";

export const data = new SlashCommandBuilder()
  .setName("mute")
  .setDescription("Silenciar um usuário temporariamente")
  .addUserOption((o) =>
    o.setName("usuario").setDescription("Usuário a ser silenciado").setRequired(true)
  )
  .addStringOption((o) =>
    o.setName("tempo")
      .setDescription("Duração (ex: 10m, 1h, 1d)")
      .setRequired(true)
  )
  .addStringOption((o) =>
    o.setName("motivo").setDescription("Motivo").setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

function parseDuration(str: string): number | null {
  const match = str.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return null;
  const val = parseInt(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return val * multipliers[unit];
}

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ embeds: [errorEmbed("Apenas administradores podem usar este comando.")], ephemeral: true });
  }

  const target = interaction.options.getUser("usuario", true);
  const tempoStr = interaction.options.getString("tempo", true);
  const reason = interaction.options.getString("motivo") ?? "Sem motivo informado";

  const duration = parseDuration(tempoStr);
  if (!duration) {
    return interaction.reply({ embeds: [errorEmbed("Formato de tempo inválido. Use: 10m, 1h, 1d")], ephemeral: true });
  }

  if (duration > 28 * 24 * 3600000) {
    return interaction.reply({ embeds: [errorEmbed("Duração máxima é 28 dias.")], ephemeral: true });
  }

  const member = await interaction.guild?.members.fetch(target.id).catch(() => null);
  if (!member) return interaction.reply({ embeds: [errorEmbed("Usuário não encontrado.")], ephemeral: true });

  await member.timeout(duration, reason);

  await interaction.reply({
    embeds: [
      successEmbed("🔇 Usuário Silenciado")
        .setDescription(`${target} foi silenciado por **${tempoStr}**.\n\n**Motivo:** ${reason}`)
        .setThumbnail(target.displayAvatarURL())
    ],
  });
}
