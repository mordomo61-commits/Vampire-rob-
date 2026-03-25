import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
  type Client,
  type TextChannel,
  type Message,
} from "discord.js";
import { db } from "../../db";
import { quizSessions, quizQuestions } from "../../db";
import { and, eq, notInArray } from "drizzle-orm";
import { successEmbed, errorEmbed, BLOOD_RED } from "../../lib/embed.js";

const TIMEOUT_MAP: Record<string, number> = { facil: 30, medio: 20, dificil: 15, hardcore: 10 };

const DEFAULT_QUESTIONS: Record<string, any[]> = {
  "anime_facil": [
    { question: "Qual é o nome do protagonista de **Naruto**?", options: ["Naruto Uzumaki", "Sasuke Uchiha", "Sakura Haruno", "Kakashi Hatake"], correctIndex: 0 },
    { question: "Qual fruta do demônio **Luffy** comeu em One Piece?", options: ["Gomu Gomu", "Mera Mera", "Hie Hie", "Yami Yami"], correctIndex: 0 },
    { question: "Em **Attack on Titan**, quem é o protagonista principal?", options: ["Eren Yeager", "Levi Ackerman", "Armin Arlert", "Mikasa Ackerman"], correctIndex: 0 },
    { question: "Qual é a transformação mais conhecida de **Goku**?", options: ["Super Saiyajin", "Oozaru", "Kaioken", "Ultra Instinto"], correctIndex: 0 },
    { question: "Em **Bleach**, qual é o nome do poder de Ichigo?", options: ["Bankai", "Shikai", "Resurreccion", "Vollstandig"], correctIndex: 0 },
    { question: "Em **Dragon Ball**, qual é o nome do planeta natal de Goku?", options: ["Planeta Vegeta", "Namekusei", "Planeta Terra", "Planeta Freeza"], correctIndex: 0 },
    { question: "Em **Sword Art Online**, qual é o nome do jogo inicial?", options: ["Sword Art Online", "ALfheim Online", "Gun Gale Online", "Underworld"], correctIndex: 0 },
    { question: "Em **My Hero Academia**, qual é o apelido de Izuku Midoriya?", options: ["Deku", "Kacchan", "Todo", "Shoto"], correctIndex: 0 },
    { question: "Em **Demon Slayer**, quem é o irmão de Tanjiro?", options: ["Nezuko", "Zenitsu", "Inosuke", "Kanao"], correctIndex: 0 },
    { question: "Qual anime tem o personagem **Pikachu**?", options: ["Pokémon", "Digimon", "Yo-kai Watch", "Monster Rancher"], correctIndex: 0 },
  ],
  "futebol_facil": [
    { question: "Qual país ganhou **mais Copas do Mundo**?", options: ["Brasil", "Alemanha", "Argentina", "Itália"], correctIndex: 0 },
    { question: "Quantas Copas do Mundo o **Brasil** ganhou?", options: ["5", "4", "6", "3"], correctIndex: 0 },
    { question: "Qual jogador é conhecido como **CR7**?", options: ["Cristiano Ronaldo", "Claudio Reyna", "Cafu", "Carlos Roberto"], correctIndex: 0 },
    { question: "Em qual ano o **Brasil** ganhou sua última Copa?", options: ["2002", "1998", "2006", "1994"], correctIndex: 0 },
    { question: "**Pelé** jogou a maior parte da carreira em qual clube?", options: ["Santos", "Cosmos", "Botafogo", "Flamengo"], correctIndex: 0 },
    { question: "Quantos jogadores tem uma equipe de **futebol em campo**?", options: ["11", "10", "12", "9"], correctIndex: 0 },
    { question: "Qual é o apelido de **Ronaldinho Gaúcho**?", options: ["O Bruxo", "O Fenômeno", "O Rei", "O Baixinho"], correctIndex: 0 },
    { question: "Em qual cidade fica o **Maracanã**?", options: ["Rio de Janeiro", "São Paulo", "Belo Horizonte", "Brasília"], correctIndex: 0 },
    { question: "Qual clube é conhecido como **'O Maior do Mundo'** no Brasil?", options: ["Flamengo", "Corinthians", "Santos", "Vasco"], correctIndex: 0 },
    { question: "Quem foi eleito melhor do mundo **5 vezes seguidas** pela FIFA?", options: ["Cristiano Ronaldo", "Lionel Messi", "Ronaldo", "Pelé"], correctIndex: 0 },
  ],
  "geografia_facil": [
    { question: "Qual é a **capital do Brasil**?", options: ["Brasília", "São Paulo", "Rio de Janeiro", "Salvador"], correctIndex: 0 },
    { question: "Qual é o **maior país do mundo**?", options: ["Rússia", "China", "EUA", "Canadá"], correctIndex: 0 },
    { question: "Qual continente tem **mais países**?", options: ["África", "Ásia", "Europa", "Américas"], correctIndex: 0 },
    { question: "Qual é o **maior oceano** do mundo?", options: ["Pacífico", "Atlântico", "Índico", "Ártico"], correctIndex: 0 },
    { question: "Qual é a **montanha mais alta** do mundo?", options: ["Everest", "K2", "Aconcágua", "Kilimanjaro"], correctIndex: 0 },
    { question: "Qual é o maior **rio do mundo por vazão**?", options: ["Amazonas", "Nilo", "Mississippi", "Congo"], correctIndex: 0 },
    { question: "Qual é a capital da **Argentina**?", options: ["Buenos Aires", "Córdoba", "Rosário", "Mendoza"], correctIndex: 0 },
    { question: "Qual é o **deserto mais quente** do mundo?", options: ["Saara", "Atacama", "Gobi", "Kalahari"], correctIndex: 0 },
    { question: "Em qual continente fica o **Brasil**?", options: ["América do Sul", "América do Norte", "África", "Europa"], correctIndex: 0 },
    { question: "Qual país tem a **maior população** do mundo?", options: ["Índia", "China", "EUA", "Brasil"], correctIndex: 0 },
  ],
  "matematica_facil": [
    { question: "Quanto é **7 × 8**?", options: ["56", "54", "64", "48"], correctIndex: 0 },
    { question: "Qual é a **raiz quadrada de 144**?", options: ["12", "14", "11", "13"], correctIndex: 0 },
    { question: "Quanto é **25% de 200**?", options: ["50", "25", "75", "100"], correctIndex: 0 },
    { question: "Qual é o valor aproximado de **π (Pi)**?", options: ["3,14", "2,71", "1,41", "4,20"], correctIndex: 0 },
    { question: "Quanto é **2³**?", options: ["8", "6", "9", "4"], correctIndex: 0 },
    { question: "Quanto é **100 ÷ 4**?", options: ["25", "20", "30", "40"], correctIndex: 0 },
    { question: "Qual é a **área de um quadrado** de lado 5?", options: ["25", "20", "15", "10"], correctIndex: 0 },
    { question: "Quanto é **12 + 13 × 0**?", options: ["12", "0", "25", "1"], correctIndex: 0 },
    { question: "Qual é o **MDC de 12 e 18**?", options: ["6", "3", "9", "12"], correctIndex: 0 },
    { question: "Quanto é **√81**?", options: ["9", "8", "7", "10"], correctIndex: 0 },
  ],
  "ciencias_facil": [
    { question: "Qual gás os **humanos respiram**?", options: ["Oxigênio", "CO₂", "Nitrogênio", "Hélio"], correctIndex: 0 },
    { question: "Qual é o **símbolo químico do ouro**?", options: ["Au", "Ag", "Fe", "Go"], correctIndex: 0 },
    { question: "Quantos **planetas** tem o sistema solar?", options: ["8", "9", "7", "10"], correctIndex: 0 },
    { question: "Qual é a **velocidade da luz**?", options: ["300.000 km/s", "150.000 km/s", "100.000 km/s", "500.000 km/s"], correctIndex: 0 },
    { question: "Qual é o **maior osso** do corpo humano?", options: ["Fêmur", "Tíbia", "Úmero", "Costela"], correctIndex: 0 },
    { question: "Qual é o **menor planeta** do sistema solar?", options: ["Mercúrio", "Marte", "Vênus", "Plutão"], correctIndex: 0 },
    { question: "Qual substância é **H₂O**?", options: ["Água", "Sal", "Açúcar", "Álcool"], correctIndex: 0 },
    { question: "Quem descobriu a **penicilina**?", options: ["Alexander Fleming", "Pasteur", "Marie Curie", "Newton"], correctIndex: 0 },
    { question: "Qual célula carrega **oxigênio no sangue**?", options: ["Hemácia", "Leucócito", "Plaqueta", "Neurônio"], correctIndex: 0 },
    { question: "Qual é a **fórmula do sal de cozinha**?", options: ["NaCl", "HCl", "H₂SO₄", "NaOH"], correctIndex: 0 },
  ],
  "filmes_facil": [
    { question: "Qual estúdio produziu **Toy Story**?", options: ["Pixar", "DreamWorks", "Disney", "Universal"], correctIndex: 0 },
    { question: "Quem interpretou **Tony Stark** no MCU?", options: ["Robert Downey Jr.", "Chris Evans", "Chris Hemsworth", "Mark Ruffalo"], correctIndex: 0 },
    { question: "Qual é o **filme mais lucrativo** de todos os tempos?", options: ["Avatar", "Endgame", "Titanic", "Star Wars"], correctIndex: 0 },
    { question: "Quem dirigiu **Jurassic Park**?", options: ["Steven Spielberg", "James Cameron", "Nolan", "Peter Jackson"], correctIndex: 0 },
    { question: "Qual ator interpreta **Jack em Titanic**?", options: ["Leonardo DiCaprio", "Brad Pitt", "Tom Hanks", "Johnny Depp"], correctIndex: 0 },
    { question: "Qual filme tem a frase **'I'll be back'**?", options: ["Exterminador do Futuro", "Die Hard", "RoboCop", "Commando"], correctIndex: 0 },
    { question: "Qual é o nome do **leão em O Rei Leão**?", options: ["Simba", "Mufasa", "Scar", "Nala"], correctIndex: 0 },
    { question: "Quem escreveu **Harry Potter**?", options: ["J.K. Rowling", "Tolkien", "C.S. Lewis", "Roald Dahl"], correctIndex: 0 },
    { question: "Em **Star Wars**, quem é o pai de Luke Skywalker?", options: ["Darth Vader", "Yoda", "Palpatine", "Han Solo"], correctIndex: 0 },
    { question: "Qual é o **boneco que ganha vida** em Toy Story?", options: ["Woody", "Buzz", "Rex", "Hamm"], correctIndex: 0 },
  ],
};

async function seedQuestions() {
  for (const [key, questions] of Object.entries(DEFAULT_QUESTIONS)) {
    const [cat, diff] = key.split("_");
    const existing = await db.select().from(quizQuestions)
      .where(and(eq(quizQuestions.category, cat), eq(quizQuestions.difficulty, diff)));
    if (existing.length === 0) {
      await db.insert(quizQuestions).values(
        questions.map((q) => ({ category: cat, difficulty: diff, question: q.question, options: q.options, correctIndex: q.correctIndex }))
      );
    }
  }
}

// Active quiz collectors stored in memory to cancel them
export const activeCollectors = new Map<string, any>();

export async function sendNextQuestion(sessionId: number, client: Client) {
  const [session] = await db.select().from(quizSessions).where(
    and(eq(quizSessions.id, sessionId), eq(quizSessions.status, "active"))
  );
  if (!session) return;

  const channel = await client.channels.fetch(session.channelId).catch(() => null) as TextChannel | null;
  if (!channel) return;

  const usedIds = session.usedQuestions as number[];
  const query = usedIds.length > 0
    ? db.select().from(quizQuestions).where(and(eq(quizQuestions.category, session.category), eq(quizQuestions.difficulty, session.difficulty), notInArray(quizQuestions.id, usedIds)))
    : db.select().from(quizQuestions).where(and(eq(quizQuestions.category, session.category), eq(quizQuestions.difficulty, session.difficulty)));

  const available = await query;

  if (!available.length) {
    await endQuiz(sessionId, client, "all_used");
    return;
  }

  const q = available[Math.floor(Math.random() * available.length)];
  const timeoutSec = TIMEOUT_MAP[session.difficulty] ?? 20;
  const correctAnswer = q.options[q.correctIndex].toLowerCase().trim();

  // Update DB with current question
  await db.update(quizSessions).set({
    usedQuestions: [...usedIds, q.id],
    currentRound: session.currentRound + 1,
    currentQuestionId: q.id,
  }).where(eq(quizSessions.id, sessionId));

  const embed = new EmbedBuilder()
    .setColor(BLOOD_RED)
    .setTitle(`❓ Pergunta ${session.currentRound + 1}/${session.totalRounds}`)
    .setDescription(
      `${q.question}\n\n` +
      `**Opções:**\n` +
      q.options.map((opt, i) => `**${["A", "B", "C", "D"][i]})** ${opt}`).join("\n") +
      `\n\n⏱️ **${timeoutSec} segundos** para responder!\n*Digite a letra (A/B/C/D) ou a resposta completa no chat!*`
    )
    .setFooter({ text: `Categoria: ${session.category} | Dificuldade: ${session.difficulty} | Rodada ${session.currentRound + 1}/${session.totalRounds}` });

  const questionMsg = await channel.send({ embeds: [embed] });

  const letters = ["a", "b", "c", "d"];
  const correctLetter = letters[q.correctIndex];

  // Create message collector for this question
  const filter = (msg: Message) => !msg.author.bot;
  const collector = channel.createMessageCollector({ filter, time: timeoutSec * 1000 });

  activeCollectors.set(`${session.channelId}_question`, collector);

  let answered = false;

  collector.on("collect", async (msg: Message) => {
    if (answered) return;
    const content = msg.content.toLowerCase().trim();
    const isCorrect =
      content === correctAnswer ||
      content === correctLetter ||
      content.startsWith(correctLetter + " ") ||
      content.startsWith(correctLetter + ")") ||
      (content.length > 2 && correctAnswer.startsWith(content)) ||
      (content.length > 3 && content.includes(correctAnswer.split(" ")[0]?.toLowerCase() ?? ""));

    if (isCorrect) {
      answered = true;
      collector.stop("correct");

      // Update scores
      const [freshSession] = await db.select().from(quizSessions).where(eq(quizSessions.id, sessionId));
      if (!freshSession || freshSession.status !== "active") return;

      const scores = (freshSession.scores as Record<string, number>) ?? {};
      scores[msg.author.id] = (scores[msg.author.id] ?? 0) + 1;
      await db.update(quizSessions).set({ scores }).where(eq(quizSessions.id, sessionId));

      const correctEmbed = new EmbedBuilder()
        .setColor(0x00ff00 as any)
        .setTitle("✅ Resposta Correta!")
        .setDescription(
          `🎉 **${msg.author.displayName}** acertou!\n\n` +
          `**Resposta:** ${q.options[q.correctIndex]}\n` +
          `**Pontuação de ${msg.author.displayName}:** ${scores[msg.author.id]} ponto(s)\n\n` +
          `⏳ Próxima pergunta em **10 segundos**...`
        );

      await channel.send({ embeds: [correctEmbed] });

      if ((freshSession.currentRound + 1) >= freshSession.totalRounds) {
        setTimeout(() => endQuiz(sessionId, client, "finished"), 10000);
      } else {
        setTimeout(() => sendNextQuestion(sessionId, client), 10000);
      }
    }
  });

  collector.on("end", async (_, reason) => {
    if (reason === "correct") return; // Already handled

    const [freshSession] = await db.select().from(quizSessions).where(eq(quizSessions.id, sessionId));
    if (!freshSession || freshSession.status !== "active") return;

    const timeoutEmbed = new EmbedBuilder()
      .setColor(0xff6600 as any)
      .setTitle("⏱️ Tempo Esgotado!")
      .setDescription(
        `Ninguém acertou!\n\n` +
        `**Resposta correta:** ${q.options[q.correctIndex]}\n\n` +
        `⏳ Próxima pergunta em **10 segundos**...`
      );
    await channel.send({ embeds: [timeoutEmbed] });

    if ((freshSession.currentRound) >= freshSession.totalRounds) {
      setTimeout(() => endQuiz(sessionId, client, "finished"), 10000);
    } else {
      setTimeout(() => sendNextQuestion(sessionId, client), 10000);
    }
  });
}

export async function endQuiz(sessionId: number, client: Client, reason: string = "finished") {
  const [session] = await db.select().from(quizSessions).where(eq(quizSessions.id, sessionId));
  if (!session) return;

  await db.update(quizSessions).set({ status: "finished" }).where(eq(quizSessions.id, sessionId));

  const collector = activeCollectors.get(`${session.channelId}_question`);
  if (collector) { collector.stop("quiz_ended"); activeCollectors.delete(`${session.channelId}_question`); }

  const channel = await client.channels.fetch(session.channelId).catch(() => null) as TextChannel | null;
  if (!channel) return;

  const scores = (session.scores as Record<string, number>) ?? {};
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);

  if (!sorted.length) {
    await channel.send({ embeds: [new EmbedBuilder().setColor(BLOOD_RED).setTitle("🏁 Quiz Encerrado!").setDescription("Ninguém pontuou desta vez! Melhor sorte na próxima.")] });
    return;
  }

  const medals = ["🥇", "🥈", "🥉"];
  const podium = sorted.slice(0, 10).map(([uid, pts], i) =>
    `${medals[i] ?? `**${i + 1}.**`} <@${uid}> — **${pts}** ${pts === 1 ? "ponto" : "pontos"}`
  ).join("\n");

  await channel.send({
    embeds: [
      new EmbedBuilder().setColor(BLOOD_RED)
        .setTitle("🏆 Quiz Finalizado! Resultado Final")
        .setDescription(podium)
        .addFields(
          { name: "📚 Categoria", value: session.category, inline: true },
          { name: "⚡ Dificuldade", value: session.difficulty, inline: true },
          { name: "🔢 Rodadas", value: `${session.currentRound}/${session.totalRounds}`, inline: true },
        )
        .setTimestamp()
    ]
  });
}

export const data = new SlashCommandBuilder()
  .setName("quiz")
  .setDescription("Sistema de Quiz interativo! Responda no chat.")
  .addSubcommand((s) =>
    s.setName("jogar")
      .setDescription("Iniciar um quiz")
      .addStringOption((o) =>
        o.setName("categoria").setDescription("Categoria do quiz").setRequired(true)
          .addChoices(
            { name: "🎌 Anime", value: "anime" },
            { name: "⚽ Futebol", value: "futebol" },
            { name: "🎬 Filmes", value: "filmes" },
            { name: "🌍 Geografia", value: "geografia" },
            { name: "🔬 Ciências", value: "ciencias" },
            { name: "📐 Matemática", value: "matematica" }
          )
      )
      .addStringOption((o) =>
        o.setName("dificuldade").setDescription("Dificuldade").setRequired(true)
          .addChoices(
            { name: "🟢 Fácil", value: "facil" },
            { name: "🟡 Médio", value: "medio" },
            { name: "🔴 Difícil", value: "dificil" },
            { name: "💀 Hardcore", value: "hardcore" }
          )
      )
      .addIntegerOption((o) =>
        o.setName("rodadas").setDescription("Número de rodadas (padrão: 10)").setMinValue(1).setMaxValue(30).setRequired(false)
      )
  )
  .addSubcommand((s) => s.setName("encerrar").setDescription("Encerrar o quiz atual deste canal"));

export async function execute(interaction: ChatInputCommandInteraction, client: Client) {
  if (!interaction.guild) return;
  const sub = interaction.options.getSubcommand();

  if (sub === "jogar") {
    const categoria = interaction.options.getString("categoria", true);
    const dificuldade = interaction.options.getString("dificuldade", true);
    const rodadas = interaction.options.getInteger("rodadas") ?? 10;

    const existing = await db.select().from(quizSessions).where(
      and(eq(quizSessions.channelId, interaction.channel!.id), eq(quizSessions.status, "active"))
    );
    if (existing.length) return interaction.reply({ embeds: [errorEmbed("Já existe um quiz ativo neste canal! Use `/quiz encerrar` para terminar.")], ephemeral: true });

    await seedQuestions();

    const [session] = await db.insert(quizSessions).values({
      guildId: interaction.guild.id,
      channelId: interaction.channel!.id,
      hostId: interaction.user.id,
      category: categoria,
      difficulty: dificuldade,
      currentRound: 0,
      totalRounds: rodadas,
      scores: {},
      usedQuestions: [],
      status: "active",
    }).returning();

    const timeoutSec = TIMEOUT_MAP[dificuldade] ?? 20;

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(BLOOD_RED)
          .setTitle("🎯 Quiz Iniciado!")
          .setDescription(
            `**Categoria:** ${categoria}\n` +
            `**Dificuldade:** ${dificuldade}\n` +
            `**Rodadas:** ${rodadas}\n` +
            `**Tempo por pergunta:** ${timeoutSec}s\n\n` +
            `📝 **Como jogar:** As perguntas aparecerão no chat!\n` +
            `Digite a **letra** (A/B/C/D) ou a **resposta completa** no chat.\n\n` +
            `⏳ Primeira pergunta em **15 segundos**...`
          )
      ],
    });

    setTimeout(() => sendNextQuestion(session.id, client), 15000);
  }

  else if (sub === "encerrar") {
    const [session] = await db.select().from(quizSessions).where(
      and(eq(quizSessions.channelId, interaction.channel!.id), eq(quizSessions.status, "active"))
    );

    if (!session) return interaction.reply({ embeds: [errorEmbed("Nenhum quiz ativo neste canal.")], ephemeral: true });

    await endQuiz(session.id, client, "manual");
    await interaction.reply({ embeds: [successEmbed("✅ Quiz encerrado pelo moderador!")], ephemeral: true });
  }
}
