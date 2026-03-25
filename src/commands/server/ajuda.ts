import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { BLOOD_RED } from "../../lib/embed.js";

export const data = new SlashCommandBuilder()
  .setName("ajuda")
  .setDescription("Ver todos os comandos e suporte do bot");

export async function execute(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setColor(BLOOD_RED)
    .setTitle("🧛 Vampire Bot — Central de Ajuda")
    .setDescription("Aqui estão todos os comandos disponíveis!\n\nPrecisa de suporte? Entre no nosso servidor!")
    .addFields(
      {
        name: "🎫 Tickets",
        value: "`/ticketpainel criar` `/ticketpainel listar` `/ticketpainel deletar`",
        inline: false,
      },
      {
        name: "👥 Cargos",
        value: "`/reactionrole` `/buttonrole` `/autorole` `/autorolebutton`",
        inline: false,
      },
      {
        name: "🎮 Minigames",
        value: "`/mines` `/blackjack` `/coinflip`",
        inline: false,
      },
      {
        name: "🪙 Economia",
        value: "`/saldo` `/ranking global` `/ranking serve` `/daily` `/transferir` `/pedir`",
        inline: false,
      },
      {
        name: "❓ Quiz",
        value: "`/quiz jogar` `/quiz encerrar`\nResponda digitando a letra **(A/B/C/D)** ou a resposta no chat!",
        inline: false,
      },
      {
        name: "🛡️ Moderação",
        value: "`/ban` `/kick` `/mute` `/clear`",
        inline: false,
      },
      {
        name: "🔧 Ferramentas",
        value: "`/webhook criar|ver|excluir` `/embed criar` `/servericon`\n`/createemoji` `/deleteemoji` `/stickercreate` `/stickerdelete`\n`/linkblock`",
        inline: false,
      },
    )
    .setFooter({ text: "Vampire Bot • Suporte em discord.gg/pZ2YpmEDSG" })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel("💬 Servidor de Suporte")
      .setStyle(ButtonStyle.Link)
      .setURL("https://discord.gg/p2jvQeptp8"),
    new ButtonBuilder()
      .setLabel("➕ Adicionar ao Servidor")
      .setStyle(ButtonStyle.Link)
      .setURL("https://discord.com/oauth2/authorize?client_id=1485871101333602444&permissions=8&integration_type=0&scope=bot+applications.commands"),
  );

  await interaction.reply({ embeds: [embed], components: [row] });
}
