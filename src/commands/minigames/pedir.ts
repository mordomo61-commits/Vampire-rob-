import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { db } from "../../db";
import { coinRequests } from "../../db";
import { errorEmbed, BLOOD_RED } from "../../lib/embed.js";

export const data = new SlashCommandBuilder()
  .setName("pedir")
  .setDescription("Pedir coins para outro usuário")
  .addUserOption((o) =>
    o.setName("usuario").setDescription("Quem você quer pedir coins").setRequired(true)
  )
  .addIntegerOption((o) =>
    o.setName("quantidade").setDescription("Quantidade de coins para pedir").setRequired(true).setMinValue(1)
  )
  .addStringOption((o) =>
    o.setName("motivo").setDescription("Motivo do pedido").setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;

  const target = interaction.options.getUser("usuario", true);
  const amount = interaction.options.getInteger("quantidade", true);
  const motivo = interaction.options.getString("motivo") ?? "Sem motivo";

  if (target.id === interaction.user.id) {
    return interaction.reply({ embeds: [errorEmbed("Você não pode pedir coins para si mesmo!")], ephemeral: true });
  }
  if (target.bot) {
    return interaction.reply({ embeds: [errorEmbed("Você não pode pedir coins para um bot!")], ephemeral: true });
  }

  const [request] = await db.insert(coinRequests).values({
    fromUserId: interaction.user.id,
    toUserId: target.id,
    guildId: interaction.guild.id,
    amount,
    channelId: interaction.channel!.id,
    status: "pending",
  }).returning();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`coinreq_accept_${request.id}`).setLabel("✅ Aceitar").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`coinreq_deny_${request.id}`).setLabel("❌ Recusar").setStyle(ButtonStyle.Danger),
  );

  await interaction.reply({
    content: `${target}`,
    embeds: [
      new EmbedBuilder().setColor(BLOOD_RED)
        .setTitle("🙏 Pedido de Coins")
        .setDescription(
          `${interaction.user} está pedindo **🪙 ${amount.toLocaleString("pt-BR")} coins** para você!\n\n` +
          `**Motivo:** ${motivo}\n\n` +
          `Você aceita enviar esses coins?`
        )
        .setThumbnail(interaction.user.displayAvatarURL())
        .setFooter({ text: `ID do pedido: ${request.id}` })
    ],
    components: [row],
  });
}
