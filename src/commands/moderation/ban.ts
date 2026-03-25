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
  .setName("ban")
  .setDescription("Banir um usuário do servidor")
  .addUserOption((o) =>
    o.setName("usuario").setDescription("Usuário a ser banido").setRequired(true)
  )
  .addStringOption((o) =>
    o.setName("motivo").setDescription("Motivo do ban").setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ embeds: [errorEmbed("Apenas administradores podem usar este comando.")], ephemeral: true });
  }

  const target = interaction.options.getUser("usuario", true);
  const reason = interaction.options.getString("motivo") ?? "Sem motivo informado";
  const member = await interaction.guild?.members.fetch(target.id).catch(() => null);

  if (!member) return interaction.reply({ embeds: [errorEmbed("Usuário não encontrado no servidor.")], ephemeral: true });
  if (!member.bannable) return interaction.reply({ embeds: [errorEmbed("Não posso banir este usuário.")], ephemeral: true });

  const encodedReason = encodeURIComponent(reason).slice(0, 80);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ban_confirm_${target.id}_${encodedReason}`)
      .setLabel("✅ Confirmar Ban")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`ban_cancel_${interaction.user.id}`)
      .setLabel("❌ Cancelar")
      .setStyle(ButtonStyle.Secondary)
  );

  // Visible to everyone so the whole server can see the ban confirmation
  await interaction.reply({
    embeds: [
      successEmbed("⚠️ Confirmação de Ban")
        .setDescription(
          `${interaction.user} quer banir ${target}!\n\n` +
          `**Usuário:** ${target.tag}\n` +
          `**Motivo:** ${reason}\n\n` +
          `⚠️ Apenas o executor pode confirmar ou cancelar.`
        )
        .setThumbnail(target.displayAvatarURL()),
    ],
    components: [row],
  });
}
