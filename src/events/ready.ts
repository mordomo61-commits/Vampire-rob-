import { Events, type Client, ActivityType } from "discord.js";

export const name = Events.ClientReady;
export const once = true;

export async function execute(client: Client) {
  console.log(`✅ Bot online como ${client.user?.tag}`);
  console.log(`📡 Servidores: ${client.guilds.cache.size}`);

  client.user?.setPresence({
    activities: [
      {
        name: `/ajuda | ${client.guilds.cache.size} servidores`,
        type: ActivityType.Watching,
      },
    ],
    status: "online",
  });
}
