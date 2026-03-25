import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
} from "discord.js";
import { successEmbed, errorEmbed, BLOOD_RED } from "../../lib/embed.js";
import { getOrCreateWallet, addCoins } from "./coins.js";

export const data = new SlashCommandBuilder()
  .setName("coinflip")
  .setDescription("Jogar cara ou coroa com seus coins!")
  .addIntegerOption((o) =>
    o.setName("aposta").setDescription("Quantidade de coins para apostar").setRequired(true).setMinValue(1)
  )
  .addStringOption((o) =>
    o.setName("escolha")
      .setDescription("Cara ou Coroa?")
      .setRequired(true)
      .addChoices({ name: "🪙 Cara", value: "cara" }, { name: "🦅 Coroa", value: "coroa" })
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  const aposta = interaction.options.getInteger("aposta", true);
  const escolha = interaction.options.getString("escolha", true);

  const wallet = await getOrCreateWallet(interaction.user.id, interaction.guild.id);
  if (wallet.balance < aposta) {
    return interaction.reply({ embeds: [errorEmbed(`Saldo insuficiente! Você tem apenas 🪙 ${wallet.balance}.`)], ephemeral: true });
  }

  const resultado = Math.random() < 0.5 ? "cara" : "coroa";
  const ganhou = resultado === escolha;
  const emoji = resultado === "cara" ? "🪙" : "🦅";

  const newBalance = await addCoins(interaction.user.id, interaction.guild.id, ganhou ? aposta : -aposta);

  const embed = successEmbed(
    ganhou ? "🎉 Você ganhou!" : "💀 Você perdeu!",
  )
    .setDescription(
      `**Resultado:** ${emoji} ${resultado.charAt(0).toUpperCase() + resultado.slice(1)}\n` +
      `**Sua escolha:** ${escolha === "cara" ? "🪙" : "🦅"} ${escolha.charAt(0).toUpperCase() + escolha.slice(1)}\n\n` +
      `${ganhou ? `✅ **+${aposta}** coins!` : `❌ **-${aposta}** coins!`}\n` +
      `**Saldo atual:** 🪙 ${newBalance.toLocaleString("pt-BR")}`
    );

  await interaction.reply({ embeds: [embed] });
}
