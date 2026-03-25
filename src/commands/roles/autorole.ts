import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { db } from "../../db/index.js";
import { autoRoles } from "../../db/index.js";
import { and, eq } from "drizzle-orm";
import { successEmbed, errorEmbed, BLOOD_RED } from "../../lib/embed.js";

export const data = [
  new SlashCommandBuilder()
    .setName("autorole")
    .setDescription("Configurar cargos automáticos ao entrar no servidor")
    .addSubcommand((s) =>
      s.setName("set")
        .setDescription("Definir cargo automático ao entrar no servidor")
        .addRoleOption((o) => o.setName("cargo").setDescription("Cargo a ser dado automaticamente").setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName("remove")
        .setDescription("Remover um auto-role configurado")
        .addRoleOption((o) => o.setName("cargo").setDescription("Cargo a remover do auto-role").setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName("lista")
        .setDescription("Ver todos os auto-roles configurados neste servidor")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName("autorolebutton")
    .setDescription("Criar botão interativo para atribuição de cargo")
    .addRoleOption((o) => o.setName("cargo").setDescription("Cargo que o botão vai atribuir/remover").setRequired(true))
    .addStringOption((o) => o.setName("label").setDescription("Texto do botão").setRequired(true))
    .addStringOption((o) => o.setName("titulo").setDescription("Título da mensagem embed").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
];

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;

  const cmd = interaction.commandName;

  if (cmd === "autorole") {
    const sub = interaction.options.getSubcommand();

    if (sub === "set") {
      const role = interaction.options.getRole("cargo", true);

      const existing = await db.select().from(autoRoles).where(
        and(eq(autoRoles.guildId, interaction.guild.id), eq(autoRoles.roleId, role.id), eq(autoRoles.method, "join"))
      );

      if (existing.length) {
        return interaction.reply({ embeds: [errorEmbed(`O cargo ${role} já está configurado como auto-role!`)], ephemeral: true });
      }

      await db.insert(autoRoles).values({
        guildId: interaction.guild.id,
        roleId: role.id,
        method: "join",
      });

      await interaction.reply({
        embeds: [successEmbed("✅ Auto-Role Configurado", `O cargo ${role} será dado automaticamente a todos os novos membros!`)],
      });
    }

    else if (sub === "remove") {
      const role = interaction.options.getRole("cargo", true);

      const deleted = await db.delete(autoRoles).where(
        and(eq(autoRoles.guildId, interaction.guild.id), eq(autoRoles.roleId, role.id))
      ).returning();

      if (!deleted.length) {
        return interaction.reply({ embeds: [errorEmbed(`O cargo ${role} não está configurado como auto-role.`)], ephemeral: true });
      }

      await interaction.reply({ embeds: [successEmbed("🗑️ Auto-Role Removido", `Cargo ${role} removido do auto-role com sucesso.`)] });
    }

    else if (sub === "lista") {
      const rows = await db.select().from(autoRoles).where(eq(autoRoles.guildId, interaction.guild.id));
      if (!rows.length) return interaction.reply({ embeds: [errorEmbed("Nenhum auto-role configurado neste servidor.")], ephemeral: true });
      const list = rows.map((r) => `<@&${r.roleId}> — método: **${r.method}**`).join("\n");
      await interaction.reply({ embeds: [successEmbed("📋 Auto-Roles Configurados", list)] });
    }
  }

  else if (cmd === "autorolebutton") {
    const role = interaction.options.getRole("cargo", true);
    const label = interaction.options.getString("label", true);
    const title = interaction.options.getString("titulo") ?? "Clique para receber seu cargo!";
    const customId = `autorole_btn_${role.id}`;

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(ButtonStyle.Primary)
    );

    const embed = new EmbedBuilder().setColor(BLOOD_RED).setTitle(title)
      .setDescription(`Clique em **${label}** para receber ou remover o cargo ${role}!`);

    await (interaction.channel as any).send({ embeds: [embed], components: [row] });

    await db.insert(autoRoles).values({
      guildId: interaction.guild.id,
      roleId: role.id,
      method: "button",
      channelId: interaction.channel!.id,
    }).onConflictDoNothing();

    await interaction.reply({ embeds: [successEmbed("✅ Botão Criado!", `Botão para o cargo ${role} criado com sucesso neste canal!`)], ephemeral: true });
  }
}
