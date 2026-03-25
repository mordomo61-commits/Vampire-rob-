import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";
import { db } from "../../db/index.js";
import { quizSessions, quizQuestions } from "../../db/index.js";
import { and, eq, notInArray } from "drizzle-orm";
import { successEmbed, errorEmbed, BLOOD_RED } from "../../lib/embed.js";
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

const QUESTION_TIMEOUT = 20000;
const BETWEEN_ROUNDS = 3000;

const DEFAULT_QUESTIONS = [
  { category: "geral", difficulty: "facil", question: "Qual é a capital do Brasil?", options: ["São Paulo", "Brasília", "Rio de Janeiro", "Belo Horizonte"], correctIndex: 1 },
  { category: "geral", difficulty: "facil", question: "Quantos continentes existem no planeta Terra?", options: ["4", "5", "6", "7"], correctIndex: 3 },
  { category: "geral", difficulty: "facil", question: "Qual animal é o maior do mundo?", options: ["Elefante", "Girafa", "Baleia Azul", "Tubarão"], correctIndex: 2 },
  { category: "geral", difficulty: "medio", question: "Em que ano o Brasil se tornou independente de Portugal?", options: ["1800", "1822", "1850", "1889"], correctIndex: 1 },
  { category: "geral", difficulty: "medio", question: "Qual é o elemento mais abundante no universo?", options: ["Oxigênio", "Carbono", "Hidrogênio", "Hélio"], correctIndex: 2 },
  { category: "geral", difficulty: "dificil", question: "Quem pintou a Mona Lisa?", options: ["Michelangelo", "Rafael", "Leonardo da Vinci", "Botticelli"], correctIndex: 2 },
  { category: "geral", difficulty: "dificil", question: "Qual é a fórmula química da água?", options: ["H2O", "CO2", "NaCl", "O2"], correctIndex: 0 },
  { category: "tecnologia", difficulty: "facil", question: "O que significa a sigla 'CPU'?", options: ["Central Processing Unit", "Computer Power Unit", "Core Processing Utility", "Central Power Unit"], correctIndex: 0 },
  { category: "tecnologia", difficulty: "medio", question: "Qual linguagem de programação foi criada pela Guido van Rossum?", options: ["Java", "Python", "Ruby", "PHP"], correctIndex: 1 },
  { category: "tecnologia", difficulty: "dificil", question: "Em que ano foi fundada a empresa Microsoft?", options: ["1972", "1975", "1980", "1983"], correctIndex: 1 },
];

async function seedQuestions() {
  const existing = await db.select().from(quizQuestions).limit(1);
  if (existing.length) return;
  for (const q of DEFAULT_QUESTIONS) {
    await db.insert(quizQuestions).values(q);
  }
}

export const data = new SlashCommandBuilder()
  .setName("quiz")
  .setDescription("Sistema de quiz interativo para o servidor")
  .addSubcommand((s) =>
    s.setName("iniciar")
      .setDescription("Iniciar um quiz no canal")
      .addStringOption((o) =>
        o.setName("categoria")
          .setDescription("Categoria das perguntas")
          .addChoices(
            { name: "🌍 Geral", value: "geral" },
            { name: "💻 Tecnologia", value: "tecnologia" },
          )
          .setRequired(false)
      )
      .addStringOption((o) =>
        o.setName("dificuldade")
          .setDescription("Dificuldade das perguntas")
          .addChoices(
            { name: "😊 Fácil", value: "facil" },
            { name: "😐 Médio", value: "medio" },
            { name: "😈 Difícil", value: "dificil" },
          )
          .setRequired(false)
      )
      .addIntegerOption((o) =>
        o.setName("rodadas")
          .setDescription("Número de rodadas (1-20)")
          .setMinValue(1)
          .setMaxValue(20)
          .setRequired(false)
      )
  )
  .addSubcommand((s) =>
    s.setName("status")
      .setDescription("Ver status do quiz em andamento neste canal")
  )
  .addSubcommand((s) =>
    s.setName("encerrar")
      .setDescription("Encerrar o quiz manualmente")
      .setDescriptionLocalizations({})
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;
  const channelId = interaction.channel!.id;

  if (sub === "iniciar") {
    const activeSession = await db.select().from(quizSessions).where(
      and(eq(quizSessions.guildId, guildId), eq(quizSessions.channelId, channelId), eq(quizSessions.status, "active"))
    );
    if (activeSession.length) return interaction.reply({ embeds: [errorEmbed("Já há um quiz em andamento neste canal! Use `/quiz encerrar` para encerrar.")], ephemeral: true });

    await seedQuestions();

    const category = interaction.options.getString("categoria") ?? "geral";
    const difficulty = interaction.options.getString("dificuldade") ?? "facil";
    const totalRounds = interaction.options.getInteger("rodadas") ?? 5;

    const availableQs = await db.select().from(quizQuestions).where(
      and(eq(quizQuestions.category, category), eq(quizQuestions.difficulty, difficulty))
    );

    if (availableQs.length < totalRounds) {
      return interaction.reply({
        embeds: [errorEmbed(`Não há perguntas suficientes para **${totalRounds} rodadas** nessa categoria/dificuldade. Disponível: **${availableQs.length}** pergunta(s).`)],
        ephemeral: true,
      });
    }

    const session = await db.insert(quizSessions).values({
      guildId, channelId, hostId: interaction.user.id,
      category, difficulty, totalRounds,
      currentRound: 0, scores: {}, usedQuestions: [], status: "active",
    }).returning();
    const sessionId = session[0]!.id;

    const embed = new EmbedBuilder()
      .setColor(BLOOD_RED)
      .setTitle("🧠 Quiz Iniciado!")
      .setDescription(
        `**Categoria:** ${category === "geral" ? "🌍 Geral" : "💻 Tecnologia"}\n` +
        `**Dificuldade:** ${difficulty === "facil" ? "😊 Fácil" : difficulty === "medio" ? "😐 Médio" : "😈 Difícil"}\n` +
        `**Rodadas:** ${totalRounds}\n\n` +
        `Iniciado por ${interaction.user}! A primeira pergunta chega em segundos...\n\n` +
        `Responda clicando nos botões! ⏱️ **${QUESTION_TIMEOUT / 1000}s por pergunta**`
      )
      .setFooter({ text: "Use /quiz encerrar para cancelar o quiz" });

    await interaction.reply({ embeds: [embed] });

    setTimeout(() => startNextRound(interaction, sessionId, guildId, channelId, category, difficulty, totalRounds, []), BETWEEN_ROUNDS);
  }

  else if (sub === "status") {
    const session = await db.select().from(quizSessions).where(
      and(eq(quizSessions.guildId, guildId), eq(quizSessions.channelId, channelId), eq(quizSessions.status, "active"))
    );
    if (!session.length) return interaction.reply({ embeds: [errorEmbed("Nenhum quiz ativo neste canal.")], ephemeral: true });

    const s = session[0]!;
    const scores = s.scores as Record<string, number>;
    const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const scoreboard = sortedScores.length
      ? sortedScores.map(([uid, pts], i) => `**${i + 1}.** <@${uid}> — **${pts} pontos**`).join("\n")
      : "Nenhum ponto ainda.";

    await interaction.reply({
      embeds: [
        successEmbed("📊 Status do Quiz")
          .addFields(
            { name: "🎯 Rodada", value: `${s.currentRound}/${s.totalRounds}`, inline: true },
            { name: "📂 Categoria", value: s.category, inline: true },
            { name: "⚡ Dificuldade", value: s.difficulty, inline: true },
            { name: "🏆 Placar", value: scoreboard, inline: false },
          )
      ],
      ephemeral: true,
    });
  }

  else if (sub === "encerrar") {
    const session = await db.select().from(quizSessions).where(
      and(eq(quizSessions.guildId, guildId), eq(quizSessions.channelId, channelId), eq(quizSessions.status, "active"))
    );
    if (!session.length) return interaction.reply({ embeds: [errorEmbed("Nenhum quiz ativo neste canal.")], ephemeral: true });

    await db.update(quizSessions).set({ status: "cancelled" }).where(eq(quizSessions.id, session[0]!.id));
    await interaction.reply({ embeds: [successEmbed("⏹️ Quiz Encerrado", "O quiz foi encerrado manualmente.")] });
  }
}

async function startNextRound(
  interaction: ChatInputCommandInteraction,
  sessionId: number,
  guildId: string,
  channelId: string,
  category: string,
  difficulty: string,
  totalRounds: number,
  usedIds: number[]
) {
  const session = await db.select().from(quizSessions).where(and(eq(quizSessions.id, sessionId), eq(quizSessions.status, "active")));
  if (!session.length) return;

  const s = session[0]!;
  const currentRound = s.currentRound + 1;

  if (currentRound > totalRounds) {
    await endQuiz(interaction, s);
    return;
  }

  const usedQ = s.usedQuestions as number[];
  let questionsQuery;

  if (usedQ.length > 0) {
    questionsQuery = await db.select().from(quizQuestions).where(
      and(eq(quizQuestions.category, category), eq(quizQuestions.difficulty, difficulty), notInArray(quizQuestions.id, usedQ))
    );
  } else {
    questionsQuery = await db.select().from(quizQuestions).where(
      and(eq(quizQuestions.category, category), eq(quizQuestions.difficulty, difficulty))
    );
  }

  if (!questionsQuery.length) {
    await endQuiz(interaction, s);
    return;
  }

  const randomQ = questionsQuery[Math.floor(Math.random() * questionsQuery.length)]!;
  const newUsed = [...usedQ, randomQ.id];

  await db.update(quizSessions).set({ currentRound, usedQuestions: newUsed, currentQuestionId: randomQ.id, status: "active" }).where(eq(quizSessions.id, sessionId));

  const letters = ["A", "B", "C", "D"];
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    randomQ.options.map((opt, i) =>
      new ButtonBuilder()
        .setCustomId(`quiz_answer_${sessionId}_${i}`)
        .setLabel(`${letters[i]}) ${opt}`)
        .setStyle(ButtonStyle.Primary)
    )
  );

  const embed = new EmbedBuilder()
    .setColor(BLOOD_RED)
    .setTitle(`🧠 Rodada ${currentRound}/${totalRounds}`)
    .setDescription(`**${randomQ.question}**\n\n${randomQ.options.map((o, i) => `${letters[i]}) ${o}`).join("\n")}`)
    .setFooter({ text: `⏱️ Você tem ${QUESTION_TIMEOUT / 1000} segundos para responder!` });

  const channel = await interaction.guild!.channels.fetch(channelId).catch(() => null);
  if (!channel || !("send" in channel)) return;

  const msg = await (channel as any).send({ embeds: [embed], components: [row] }).catch(() => null);
  if (msg) {
    await db.update(quizSessions).set({ currentMessageId: msg.id }).where(eq(quizSessions.id, sessionId));
  }

  setTimeout(async () => {
    const freshSession = await db.select().from(quizSessions).where(eq(quizSessions.id, sessionId));
    if (!freshSession.length || freshSession[0]!.status !== "active") return;
    if (freshSession[0]!.currentMessageId === msg?.id) {
      const timeoutEmbed = new EmbedBuilder()
        .setColor(0xff8800)
        .setTitle(`⏰ Tempo Esgotado! — Rodada ${currentRound}/${totalRounds}`)
        .setDescription(`Ninguém respondeu a tempo!\n\n✅ **Resposta correta:** ${randomQ.options[randomQ.correctIndex]}`);
      await msg?.edit({ embeds: [timeoutEmbed], components: [] }).catch(() => null);
      setTimeout(() => startNextRound(interaction, sessionId, guildId, channelId, category, difficulty, totalRounds, newUsed), BETWEEN_ROUNDS);
    }
  }, QUESTION_TIMEOUT);
}

async function endQuiz(interaction: ChatInputCommandInteraction, session: typeof quizSessions.$inferSelect) {
  await db.update(quizSessions).set({ status: "completed" }).where(eq(quizSessions.id, session.id));

  const scores = session.scores as Record<string, number>;
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);

  const medals = ["🥇", "🥈", "🥉"];
  const scoreboard = sorted.length
    ? sorted.map(([uid, pts], i) => `${medals[i] ?? `**${i + 1}.**`} <@${uid}> — **${pts} pontos**`).join("\n")
    : "Nenhum ponto registrado.";

  const embed = new EmbedBuilder()
    .setColor(BLOOD_RED)
    .setTitle("🏆 Quiz Finalizado!")
    .setDescription(`Placar final após **${session.totalRounds}** rodadas:\n\n${scoreboard}`)
    .setFooter({ text: "Obrigado por participar!" });

  const channel = await interaction.guild!.channels.fetch(session.channelId).catch(() => null);
  if (channel && "send" in channel) {
    await (channel as any).send({ embeds: [embed] }).catch(() => null);
  }
}
