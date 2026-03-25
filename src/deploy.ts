import { config } from "dotenv";
config();

import { REST, Routes } from "discord.js";

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;

if (!TOKEN) throw new Error("DISCORD_TOKEN não definido no .env");
if (!CLIENT_ID) throw new Error("DISCORD_CLIENT_ID não definido no .env");

async function loadCommands() {
  const commands: any[] = [];

  const modules = [
    await import("./commands/embed/embed.js"),
    await import("./commands/moderation/ban.js"),
    await import("./commands/moderation/kick.js"),
    await import("./commands/moderation/mute.js"),
    await import("./commands/moderation/clear.js"),
    await import("./commands/roles/autorole.js"),
    await import("./commands/roles/buttonrole.js"),
    await import("./commands/roles/reactionrole.js"),
    await import("./commands/server/servericon.js"),
    await import("./commands/server/emojis.js"),
    await import("./commands/server/linkblock.js"),
    await import("./commands/server/ajuda.js"),
    await import("./commands/minigames/coins.js"),
    await import("./commands/minigames/daily.js"),
    await import("./commands/minigames/pedir.js"),
    await import("./commands/minigames/transfer.js"),
    await import("./commands/minigames/blackjack.js"),
    await import("./commands/minigames/coinflip.js"),
    await import("./commands/minigames/mines.js"),
    await import("./commands/minigames/quiz.js"),
    await import("./commands/tickets/ticketpainel.js"),
    await import("./commands/welcome/welcome.js"),
  ];

  for (const mod of modules) {
    const data = mod.data;
    if (Array.isArray(data)) {
      for (const cmd of data) {
        commands.push(cmd.toJSON());
      }
    } else if (data) {
      commands.push(data.toJSON());
    }
  }

  return commands;
}

async function deploy() {
  const commands = await loadCommands();
  const rest = new REST().setToken(TOKEN!);

  console.log(`🚀 Registrando ${commands.length} comandos slash...`);

  try {
    const data = await rest.put(
      Routes.applicationCommands(CLIENT_ID!),
      { body: commands }
    ) as any[];

    console.log(`✅ ${data.length} comandos registrados com sucesso!`);
    console.log("📋 Comandos:");
    data.forEach((cmd) => console.log(`  /${cmd.name}`));
  } catch (err) {
    console.error("❌ Erro ao registrar comandos:", err);
    process.exit(1);
  }
}

deploy();
