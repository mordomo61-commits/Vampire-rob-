import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
} from "discord.js";
import { successEmbed, errorEmbed } from "../../lib/embed.js";

export const data = new SlashCommandBuilder()
  .setName("kick")
  .setDescription("Expulsar um usuário do servidor")
  .addUserOption((o) =>
    o.setName("usuario").setDescription("Usuário a ser expulso").setRequired(true)
  )
  .addStringOption((o) =>
    o.setName("motivo").setDescription("Motivo do kick").setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.KickMembers)) {
    return interaction.reply({ embeds: [errorEmbed("Você não tem permissão para expulsar membros.")], ephemeral: true });
  }

  const target = interaction.options.getUser("usuario", true);
  const reason = interaction.options.getString("motivo") ?? "Sem motivo informado";
  const member = await interaction.guild?.members.fetch(target.id).catch(() => null);

  if (!member) return interaction.reply({ embeds: [errorEmbed("Usuário não encontrado.")], ephemeral: true });
  if (!member.kickable) return interaction.reply({ embeds: [errorEmbed("Não posso expulsar este usuário. Verifique se ele tem cargo superior ao meu.")], ephemeral: true });

  const encodedReason = encodeURIComponent(reason).slice(0, 80);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`kick_confirm_${target.id}_${encodedReason}`)
      .setLabel("✅ Confirmar Kick")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`kick_cancel_${interaction.user.id}`)
      .setLabel("❌ Cancelar")
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.reply({
    embeds: [
      successEmbed("⚠️ Confirmação de Kick")
        .setDescription(
          `${interaction.user} quer expulsar ${target}!\n\n` +
          `**Usuário:** ${target.tag}\n` +
          `**Motivo:** ${reason}\n\n` +
          `⚠️ Apenas o executor pode confirmar ou cancelar.`
        )
        .setThumbnail(target.displayAvatarURL())
    ],
    components: [row],
  });
}
