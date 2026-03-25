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
import { buttonRoles } from "../../db/index.js";
import { and, eq } from "drizzle-orm";
import { successEmbed, errorEmbed, BLOOD_RED } from "../../lib/embed.js";

const STYLE_MAP: Record<string, ButtonStyle> = {
  azul: ButtonStyle.Primary,
  cinza: ButtonStyle.Secondary,
  verde: ButtonStyle.Success,
  vermelho: ButtonStyle.Danger,
};

export const data = new SlashCommandBuilder()
  .setName("buttonrole")
  .setDescription("Configurar cargo por botão")
  .addSubcommand((s) =>
    s.setName("adicionar")
      .setDescription("Adicionar botão de cargo a uma mensagem existente")
      .addStringOption((o) => o.setName("mensagem_id").setDescription("ID da mensagem onde o botão será adicionado").setRequired(true))
      .addRoleOption((o) => o.setName("cargo").setDescription("Cargo a atribuir/remover com o botão").setRequired(true))
      .addStringOption((o) => o.setName("label").setDescription("Texto do botão").setRequired(true))
      .addStringOption((o) =>
        o.setName("cor").setDescription("Cor do botão").setRequired(false)
          .addChoices(
            { name: "🔵 Azul", value: "azul" },
            { name: "⚫ Cinza", value: "cinza" },
            { name: "🟢 Verde", value: "verde" },
            { name: "🔴 Vermelho", value: "vermelho" },
          )
      )
  )
  .addSubcommand((s) =>
    s.setName("criar")
      .setDescription("Criar nova mensagem embed com botão de cargo")
      .addRoleOption((o) => o.setName("cargo").setDescription("Cargo a atribuir/remover").setRequired(true))
      .addStringOption((o) => o.setName("label").setDescription("Texto do botão").setRequired(true))
      .addStringOption((o) =>
        o.setName("cor").setDescription("Cor do botão").setRequired(false)
          .addChoices(
            { name: "🔵 Azul", value: "azul" },
            { name: "⚫ Cinza", value: "cinza" },
            { name: "🟢 Verde", value: "verde" },
            { name: "🔴 Vermelho", value: "vermelho" },
          )
      )
      .addStringOption((o) => o.setName("descricao").setDescription("Descrição da mensagem embed").setRequired(false))
  )
  .addSubcommand((s) =>
    s.setName("remove")
      .setDescription("Remover button role de uma mensagem")
      .addStringOption((o) => o.setName("mensagem_id").setDescription("ID da mensagem").setRequired(true))
      .addStringOption((o) => o.setName("label").setDescription("Label do botão a remover (deixe vazio para remover todos)").setRequired(false))
  )
  .addSubcommand((s) =>
    s.setName("lista")
      .setDescription("Listar button roles configurados neste servidor")
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild || !interaction.channel) return;
  const sub = interaction.options.getSubcommand();

  if (sub === "adicionar") {
    const messageId = interaction.options.getString("mensagem_id", true);
    const role = interaction.options.getRole("cargo", true);
    const label = interaction.options.getString("label", true);
    const cor = interaction.options.getString("cor") ?? "azul";
    const style = STYLE_MAP[cor] ?? ButtonStyle.Primary;

    await interaction.deferReply({ ephemeral: true });

    const msg = await (interaction.channel as any).messages.fetch(messageId).catch(() => null);
    if (!msg) return interaction.editReply({ embeds: [errorEmbed("Mensagem não encontrada neste canal.")] });

    const customId = `buttonrole_${role.id}_${Date.now()}`;

    const existingRows = msg.components as any[];
    let targetRow: ActionRowBuilder<ButtonBuilder> | null = null;

    const updatedRows: ActionRowBuilder<ButtonBuilder>[] = existingRows.map((row: any) => {
      const newRow = new ActionRowBuilder<ButtonBuilder>();
      const btns = row.components.map((c: any) =>
        new ButtonBuilder()
          .setCustomId(c.customId ?? `btn_${Date.now()}`)
          .setLabel(c.label ?? "Botão")
          .setStyle(c.style ?? ButtonStyle.Primary)
          .setDisabled(c.disabled ?? false)
      );
      if (btns.length < 5 && !targetRow) {
        btns.push(new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(style));
        targetRow = newRow;
      }
      newRow.addComponents(btns);
      return newRow;
    });

    if (!targetRow) {
      if (updatedRows.length >= 5) {
        return interaction.editReply({ embeds: [errorEmbed("A mensagem já tem o máximo de componentes (25 botões).")] });
      }
      updatedRows.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(style)
        )
      );
    }

    await msg.edit({ components: updatedRows });

    await db.insert(buttonRoles).values({
      guildId: interaction.guild.id,
      channelId: interaction.channel.id,
      messageId,
      customId,
      label,
      roleId: role.id,
    });

    await interaction.editReply({ embeds: [successEmbed("✅ Botão Adicionado!", `Botão **${label}** adicionado à mensagem para o cargo ${role}!`)] });
  }

  else if (sub === "criar") {
    const role = interaction.options.getRole("cargo", true);
    const label = interaction.options.getString("label", true);
    const cor = interaction.options.getString("cor") ?? "azul";
    const style = STYLE_MAP[cor] ?? ButtonStyle.Primary;
    const desc = interaction.options.getString("descricao") ?? `Clique no botão abaixo para receber o cargo **${role.name}**!`;
    const customId = `buttonrole_${role.id}_${Date.now()}`;

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(style)
    );

    const embed = new EmbedBuilder().setColor(BLOOD_RED).setDescription(desc);
    const msg = await (interaction.channel as any).send({ embeds: [embed], components: [row] });

    await db.insert(buttonRoles).values({
      guildId: interaction.guild.id,
      channelId: interaction.channel.id,
      messageId: msg.id,
      customId,
      label,
      roleId: role.id,
    });

    await interaction.reply({ embeds: [successEmbed("✅ Button Role Criado", `Mensagem criada com botão **${label}** para o cargo ${role}!`)], ephemeral: true });
  }

  else if (sub === "remove") {
    const messageId = interaction.options.getString("mensagem_id", true);
    const labelFilter = interaction.options.getString("label");

    await interaction.deferReply({ ephemeral: true });

    const msg = await (interaction.channel as any).messages.fetch(messageId).catch(() => null);

    if (labelFilter) {
      const rows = await db.select().from(buttonRoles).where(
        and(eq(buttonRoles.guildId, interaction.guild.id), eq(buttonRoles.messageId, messageId), eq(buttonRoles.label, labelFilter))
      );
      const toRemove = rows.map((r) => r.customId);

      await db.delete(buttonRoles).where(
        and(eq(buttonRoles.guildId, interaction.guild.id), eq(buttonRoles.messageId, messageId), eq(buttonRoles.label, labelFilter))
      );

      if (msg) {
        const updatedRows = msg.components.map((row: any) => {
          const newRow = new ActionRowBuilder<ButtonBuilder>();
          const btns = row.components
            .filter((c: any) => !toRemove.includes(c.customId))
            .map((c: any) =>
              new ButtonBuilder().setCustomId(c.customId).setLabel(c.label ?? "").setStyle(c.style).setDisabled(c.disabled ?? false)
            );
          newRow.addComponents(btns);
          return newRow;
        }).filter((r: any) => r.components.length > 0);

        await msg.edit({ components: updatedRows }).catch(() => {});
      }
      await interaction.editReply({ embeds: [successEmbed("🗑️ Botão Removido", `Botão **${labelFilter}** removido da mensagem.`)] });
    } else {
      await db.delete(buttonRoles).where(
        and(eq(buttonRoles.guildId, interaction.guild.id), eq(buttonRoles.messageId, messageId))
      );
      if (msg) await msg.edit({ components: [] }).catch(() => {});
      await interaction.editReply({ embeds: [successEmbed("🗑️ Button Roles Removidos", `Todos os botões da mensagem \`${messageId}\` foram removidos.`)] });
    }
  }

  else if (sub === "lista") {
    const rows = await db.select().from(buttonRoles).where(eq(buttonRoles.guildId, interaction.guild.id));
    if (!rows.length) return interaction.reply({ embeds: [errorEmbed("Nenhum button role configurado neste servidor.")], ephemeral: true });
    const list = rows.map((r) => `**Msg:** \`${r.messageId}\` | **Botão:** ${r.label} | **Cargo:** <@&${r.roleId}>`).join("\n");
    await interaction.reply({ embeds: [successEmbed("📋 Button Roles", list)] });
  }
}
