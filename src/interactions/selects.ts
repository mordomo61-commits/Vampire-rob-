import {
  EmbedBuilder,
  type StringSelectMenuInteraction,
} from "discord.js";
import { BLOOD_RED } from "../lib/embed.js";

const CATEGORIES: Record<string, { emoji: string; label: string; fields: { name: string; value: string }[] }> = {
  ajuda_economy: {
    emoji: "💰",
    label: "Economia",
    fields: [
      { name: "💰 /coins saldo", value: "Ver seu saldo de moedas" },
      { name: "🏆 /coins top", value: "Ranking de moedas do servidor" },
      { name: "📅 /daily", value: "Coletar moedas diárias (500 moedas/dia)" },
      { name: "🤲 /pedir", value: "Pedir moedas a outro usuário" },
      { name: "💸 /transfer", value: "Transferir moedas para outro usuário" },
    ],
  },
  ajuda_minigames: {
    emoji: "🎮",
    label: "Minigames",
    fields: [
      { name: "🃏 /blackjack", value: "Jogue blackjack (21) contra o bot" },
      { name: "🪙 /coinflip", value: "Cara ou coroa com apostas" },
      { name: "💣 /mines", value: "Campo minado — encontre diamantes e evite minas!" },
    ],
  },
  ajuda_moderation: {
    emoji: "🔨",
    label: "Moderação",
    fields: [
      { name: "🔨 /ban", value: "Banir usuário (com confirmação)" },
      { name: "👢 /kick", value: "Expulsar usuário (com confirmação)" },
      { name: "🔇 /mute", value: "Silenciar usuário por tempo definido (ex: 10m, 1h, 1d)" },
      { name: "🗑️ /clear", value: "Apagar até 100 mensagens de uma vez" },
    ],
  },
  ajuda_roles: {
    emoji: "🏷️",
    label: "Cargos",
    fields: [
      { name: "🏷️ /autorole set", value: "Definir cargo automático ao entrar" },
      { name: "🏷️ /autorole remove", value: "Remover cargo do autorole" },
      { name: "🏷️ /autorole lista", value: "Listar autoroles configurados" },
      { name: "🔘 /buttonrole criar", value: "Criar mensagem embed com botão de cargo" },
      { name: "🔘 /buttonrole adicionar", value: "Adicionar botão de cargo a mensagem existente" },
      { name: "🔘 /buttonrole remove", value: "Remover botão de cargo" },
      { name: "😀 /reactionrole add", value: "Adicionar cargo por reação" },
      { name: "😀 /reactionrole remove", value: "Remover reaction role" },
    ],
  },
  ajuda_server: {
    emoji: "⚙️",
    label: "Servidor",
    fields: [
      { name: "🖼️ /servericon", value: "Ver ícone do servidor em alta resolução" },
      { name: "😂 /createemoji", value: "Criar emoji personalizado" },
      { name: "🗑️ /deleteemoji", value: "Remover emoji do servidor" },
      { name: "🎨 /stickercreate", value: "Criar figurinha" },
      { name: "🗑️ /stickerdelete", value: "Remover figurinha" },
      { name: "🔒 /linkblock ativar", value: "Bloquear links em um canal" },
      { name: "🔓 /linkblock desativar", value: "Desativar bloqueio de links" },
    ],
  },
  ajuda_tickets: {
    emoji: "🎫",
    label: "Tickets",
    fields: [
      { name: "🎫 /ticketpainel", value: "Criar e configurar painel de tickets" },
    ],
  },
  ajuda_welcome: {
    emoji: "👋",
    label: "Boas-vindas e Saídas",
    fields: [
      { name: "👋 /mensagemdeentrada configurar", value: "Configurar mensagem automática de boas-vindas" },
      { name: "❌ /mensagemdeentrada remover", value: "Remover mensagem de boas-vindas" },
      { name: "🔍 /mensagemdeentrada testar", value: "Testar a mensagem de boas-vindas" },
      { name: "📋 /mensagemdeentrada status", value: "Ver configuração atual" },
      { name: "🚪 /mensagemsaida configurar", value: "Configurar mensagem automática de saída" },
      { name: "❌ /mensagemsaida remover", value: "Remover mensagem de saída" },
      { name: "🔍 /mensagemsaida testar", value: "Testar a mensagem de saída" },
      { name: "📋 /mensagemsaida status", value: "Ver configuração atual" },
    ],
  },
  ajuda_embed: {
    emoji: "📝",
    label: "Embeds",
    fields: [
      { name: "📝 /embed criar", value: "Abrir painel para criar embed personalizado com título, descrição, cor, imagem e rodapé" },
    ],
  },
  ajuda_quiz: {
    emoji: "🧠",
    label: "Quiz",
    fields: [
      { name: "🧠 /quiz iniciar", value: "Iniciar quiz com categoria, dificuldade e número de rodadas" },
      { name: "📋 /quiz status", value: "Ver pontuação e rodada atual" },
      { name: "⏹️ /quiz encerrar", value: "Encerrar quiz manualmente" },
    ],
  },
};

export async function handleSelect(interaction: StringSelectMenuInteraction) {
  const id = interaction.customId;
  const value = interaction.values[0] ?? "";

  try {
    if (id === "ajuda_menu") {
      const cat = CATEGORIES[value];
      if (!cat) return interaction.reply({ content: "Categoria inválida.", ephemeral: true });

      const embed = new EmbedBuilder()
        .setColor(BLOOD_RED)
        .setTitle(`${cat.emoji} ${cat.label}`)
        .addFields(cat.fields)
        .setFooter({ text: "Vampire Bot • Use /ajuda para voltar ao menu" });

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  } catch (err) {
    console.error("Select interaction error:", err);
    if (!interaction.replied) {
      await interaction.reply({ content: "Erro ao processar seleção.", ephemeral: true }).catch(() => {});
    }
  }
}
