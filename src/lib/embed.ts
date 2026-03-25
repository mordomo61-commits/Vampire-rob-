import { EmbedBuilder, type ColorResolvable } from "discord.js";

export const BLOOD_RED = 0x8b0000 as ColorResolvable;
export const PREVIEW_BLUE = 0x5865f2 as ColorResolvable;

export function errorEmbed(description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(BLOOD_RED)
    .setDescription(`❌ ${description}`);
}

export function successEmbed(title: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(BLOOD_RED)
    .setTitle(title);
  if (description) embed.setDescription(description);
  return embed;
}

export function infoEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(BLOOD_RED)
    .setTitle(title)
    .setDescription(description);
}

export function baseEmbed(): EmbedBuilder {
  return new EmbedBuilder().setColor(BLOOD_RED);
}

export function hexToNumber(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}
