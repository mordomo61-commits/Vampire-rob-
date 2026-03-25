import { REST, Routes } from "discord.js";
import { readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function deployCommands() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;

  if (!token || !clientId) {
    throw new Error("DISCORD_TOKEN and DISCORD_CLIENT_ID must be set");
  }

  const commandData: any[] = [];

  const commandsPath = join(__dirname, "commands");
  const categories = readdirSync(commandsPath);
  for (const category of categories) {
    const files = readdirSync(join(commandsPath, category)).filter((f) =>
      f.endsWith(".ts") || f.endsWith(".js")
    );
    for (const file of files) {
      const filePath = join(commandsPath, category, file);
      const mod = await import(pathToFileURL(filePath).href);
      if (mod.data) {
        if (Array.isArray(mod.data)) {
          commandData.push(...mod.data.map((d: any) => d.toJSON()));
        } else {
          commandData.push(mod.data.toJSON());
        }
      }
    }
  }

  const rest = new REST().setToken(token);
  console.log(`Registering ${commandData.length} commands globally...`);
  await rest.put(Routes.applicationCommands(clientId), { body: commandData });
  console.log("Commands registered successfully!");
}

deployCommands().catch(console.error);
