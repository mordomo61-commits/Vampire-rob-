import {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
  type StringSelectMenuInteraction,
} from "discord.js";
import { BLOOD_RED } from "../../lib/embed.js";

const CATEGORIES: Record<string, { emoji: string; label: string; description: string; fields: { name: string; value: string }[] }> = {
  economy: {
    emoji: "💰",
    label: "Economia",
    description: "Sistema de moedas, apostas e transferências",
    fields: [
      { name: "💰 /coins", value: "Ver seu saldo e top de moedas" },
      { name: "📅 /daily", value: "Coletar moedas diárias" },
      { name: "🤲 /pedir", value: "Pedir moedas a outro usuário" },
      { name: "💸 /transfer", value: "Transferir moedas para outro usuário" },
    ],
  },
  minigames: {
    emoji: "🎮",
    label: "Minigames",
    description: "Jogos para ganhar (ou perder) moedas",
    fields: [
      { name: "🃏 /blackjack", value: "Jogue blackjack contra o bot" },
      { name: "🪙 /coinflip", value: "Aposte moedas no cara ou coroa" },
      { name: "💣 /mines", value: "Jogo de campo minado — saiba a hora de parar!" },
    ],
  },
  moderation: {
    emoji: "🔨",
    label: "Moderação",
    description: "Ferramentas para moderar o servidor",
    fields: [
      { name: "🔨 /ban", value: "Banir um usuário do servidor" },
      { name: "👢 /kick", value: "Expulsar um usuário do servidor" },
      { name: "🔇 /mute", value: "Silenciar um usuário temporariamente" },
      { name: "🗑️ /clear", value: "Apagar múltiplas mensagens" },
    ],
  },
  roles: {
    emoji: "🏷️",
    label: "Cargos",
    description: "Gerenciar cargos automáticos e interativos",
    fields: [
      { name: "🏷️ /autorole", value: "Cargo automático ao entrar no servidor" },
      { name: "🔘 /buttonrole", value: "Cargo via botão interativo" },
      { name: "😀 /reactionrole", value: "Cargo via reação em mensagem" },
    ],
  },
  server: {
    emoji: "⚙️",
    label: "Servidor",
    description: "Ferramentas de configuração do servidor",
    fields: [
      { name: "🖼️ /servericon", value: "Ver ícone do servidor" },
      { name: "😂 /createemoji", value: "Criar emoji com imagem" },
      { name: "🗑️ /deleteemoji", value: "Remover emoji do servidor" },
      { name: "🎨 /stickercreate", value: "Criar figurinha no servidor" },
      { name: "🗑️ /stickerdelete", value: "Remover figurinha do servidor" },
      { name: "🔒 /linkblock", value: "Bloquear/desbloquear links em canais" },
    ],
  },
  tickets: {
    emoji: "🎫",
    label: "Tickets",
    description: "Sistema de atendimento e suporte via tickets",
    fields: [
      { name: "🎫 /ticketpainel", value: "Criar painel de tickets no canal" },
    ],
  },
  welcome: {
    emoji: "👋",
    label: "Boas-vindas e Saídas",
    description: "Mensagens automáticas de entrada e saída de membros",
    fields: [
      { name: "👋 /mensagemdeentrada configurar", value: "Configurar mensagem de boas-vindas ao entrar" },
      { name: "❌ /mensagemdeentrada remover", value: "Remover mensagem de boas-vindas" },
      { name: "🚪 /mensagemsaida configurar", value: "Configurar mensagem ao sair do servidor" },
      { name: "❌ /mensagemsaida remover", value: "Remover mensagem de saída" },
    ],
  },
  embed: {
    emoji: "📝",
    label: "Embeds",
    description: "Criar mensagens embed personalizadas",
    fields: [
      { name: "📝 /embed criar", value: "Criar embed personalizado com painel visual" },
    ],
  },
  quiz: {
    emoji: "🧠",
    label: "Quiz",
    description: "Sistema de quiz interativo para o servidor",
    fields: [
      { name: "🧠 /quiz iniciar", value: "Iniciar rodada de quiz no canal" },
      { name: "📋 /quiz status", value: "Ver status do quiz em andamento" },
      { name: "⏹️ /quiz encerrar", value: "Encerrar quiz manualmente" },
    ],
  },
};

export const data = new SlashCommandBuilder()
  .setName("ajuda")
  .setDescription("Veja todos os comandos disponíveis do Vampire Bot");

export async function execute(interaction: ChatInputCommandInteraction) {
  const mainEmbed = new EmbedBuilder()
    .setColor(BLOOD_RED)
    .setTitle("🧛 Vampire Bot — Central de Ajuda")
    .setDescription(
      "Selecione uma categoria abaixo para ver os comandos disponíveis.\n\n" +
      Object.entries(CATEGORIES)
        .map(([, cat]) => `${cat.emoji} **${cat.label}** — ${cat.description}`)
        .join("\n")
    )
    .setFooter({ text: "Vampire Bot • Selecione a categoria no menu abaixo" });

  const select = new StringSelectMenuBuilder()
    .setCustomId("ajuda_menu")
    .setPlaceholder("📂 Selecione uma categoria...")
    .addOptions(
      Object.entries(CATEGORIES).map(([key, cat]) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(cat.label)
          .setValue(`ajuda_${key}`)
          .setDescription(cat.description)
          .setEmoji(cat.emoji)
      )
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

  await interaction.reply({ embeds: [mainEmbed], components: [row] });
}
