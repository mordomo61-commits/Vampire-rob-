import { AttachmentBuilder, type TextChannel } from "discord.js";

export async function generateTranscript(
  channel: TextChannel,
  ticketOwnerTag: string,
  closedByTag: string,
  reason?: string | null
): Promise<AttachmentBuilder | null> {
  try {
    const messages: any[] = [];
    let lastId: string | undefined;

    for (let i = 0; i < 10; i++) {
      const fetched = await channel.messages.fetch({ limit: 100, ...(lastId ? { before: lastId } : {}) });
      if (!fetched.size) break;
      messages.push(...fetched.values());
      lastId = fetched.last()?.id;
      if (fetched.size < 100) break;
    }

    messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    const guildName = channel.guild.name;
    const channelName = channel.name;
    const closedAt = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const totalMessages = messages.length;

    const messagesHtml = messages.map((msg) => {
      const time = new Date(msg.createdTimestamp).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const author = msg.author ?? { displayName: "Desconhecido", tag: "unknown#0000", bot: false };
      const avatarUrl = author.displayAvatarURL?.({ size: 32, extension: "png" }) ?? `https://cdn.discordapp.com/embed/avatars/0.png`;
      const isBot = author.bot;

      const content = escapeHtml(msg.content || "");
      const embeds = msg.embeds?.map((e: any) => {
        const parts: string[] = [];
        if (e.title) parts.push(`<div class="embed-title">${escapeHtml(e.title)}</div>`);
        if (e.description) parts.push(`<div class="embed-desc">${escapeHtml(e.description).replace(/\n/g, "<br>")}</div>`);
        return `<div class="embed" style="border-left:4px solid ${e.color ? `#${e.color.toString(16).padStart(6, "0")}` : "#8B0000"}">${parts.join("")}</div>`;
      }).join("") ?? "";

      const attachments = msg.attachments?.map((a: any) => {
        if (a.contentType?.startsWith("image/")) {
          return `<img src="${a.url}" alt="attachment" style="max-width:300px;max-height:200px;border-radius:4px;display:block;margin-top:6px;" />`;
        }
        return `<a href="${a.url}" class="attachment-link">📎 ${escapeHtml(a.name ?? "arquivo")}</a>`;
      }).join("") ?? "";

      const replyHtml = msg.reference?.messageId
        ? `<div class="reply-indicator">↩ Respondendo a uma mensagem</div>`
        : "";

      return `
        <div class="message ${isBot ? "bot-message" : ""}">
          <img class="avatar" src="${avatarUrl}" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'" alt="avatar" />
          <div class="msg-body">
            ${replyHtml}
            <div class="msg-header">
              <span class="username ${isBot ? "bot-name" : ""}">${escapeHtml(author.displayName ?? author.tag)}</span>
              ${isBot ? '<span class="bot-badge">BOT</span>' : ""}
              <span class="timestamp">${time}</span>
            </div>
            ${content ? `<div class="msg-content">${content.replace(/\n/g, "<br>")}</div>` : ""}
            ${embeds}
            ${attachments}
          </div>
        </div>
      `;
    }).join("");

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Transcript — ${escapeHtml(channelName)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #0f0205; color: #dcddde; }
    .header { background: linear-gradient(135deg, #1a0505, #2a0808); border-bottom: 3px solid #8B0000; padding: 24px 32px; display: flex; align-items: center; gap: 20px; }
    .header-icon { font-size: 48px; }
    .header-info h1 { color: #ff4444; font-size: 22px; margin-bottom: 6px; }
    .header-meta { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 12px; }
    .meta-badge { background: rgba(139,0,0,0.2); border: 1px solid rgba(139,0,0,0.4); border-radius: 8px; padding: 6px 14px; font-size: 12px; color: #c09090; }
    .meta-badge strong { color: #ff8888; }
    .messages { max-width: 860px; margin: 0 auto; padding: 24px 20px; }
    .message { display: flex; gap: 14px; padding: 8px 4px; border-radius: 6px; }
    .message:hover { background: rgba(255,255,255,0.03); }
    .bot-message { background: rgba(139,0,0,0.05); }
    .avatar { width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0; margin-top: 2px; object-fit: cover; }
    .msg-body { flex: 1; min-width: 0; }
    .msg-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap; }
    .username { color: #ffffff; font-weight: 600; font-size: 14px; }
    .bot-name { color: #5865f2; }
    .bot-badge { background: #5865f2; color: white; font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 3px; }
    .timestamp { color: #72767d; font-size: 11px; }
    .msg-content { font-size: 14px; line-height: 1.6; color: #dcddde; word-break: break-word; }
    .embed { margin-top: 6px; background: rgba(47,49,54,0.6); border-radius: 4px; padding: 10px 14px; max-width: 520px; }
    .embed-title { color: #ffffff; font-weight: 600; font-size: 14px; margin-bottom: 4px; }
    .embed-desc { color: #b9bbbe; font-size: 13px; line-height: 1.55; }
    .attachment-link { display: inline-block; margin-top: 6px; color: #00b0f4; text-decoration: none; font-size: 13px; }
    .reply-indicator { color: #72767d; font-size: 12px; margin-bottom: 4px; font-style: italic; }
    .footer { text-align: center; padding: 24px; color: #5a3a3a; font-size: 12px; border-top: 1px solid rgba(139,0,0,0.2); margin-top: 32px; }
    .footer span { color: #8B0000; font-weight: 600; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-icon">🎫</div>
    <div class="header-info">
      <h1>#${escapeHtml(channelName)}</h1>
      <div style="color:#a08080;font-size:13px;">${escapeHtml(guildName)} • Transcript do Ticket</div>
      <div class="header-meta">
        <div class="meta-badge">👤 Usuário: <strong>${escapeHtml(ticketOwnerTag)}</strong></div>
        <div class="meta-badge">🔒 Fechado por: <strong>${escapeHtml(closedByTag)}</strong></div>
        ${reason ? `<div class="meta-badge">📝 Motivo: <strong>${escapeHtml(reason)}</strong></div>` : ""}
        <div class="meta-badge">📅 Data: <strong>${escapeHtml(closedAt)}</strong></div>
        <div class="meta-badge">💬 Mensagens: <strong>${totalMessages}</strong></div>
      </div>
    </div>
  </div>
  <div class="messages">
    ${messagesHtml || '<p style="color:#72767d;text-align:center;padding:40px">Nenhuma mensagem encontrada.</p>'}
  </div>
  <div class="footer">Gerado por <span>Vampire Bot</span> • ${escapeHtml(closedAt)}</div>
</body>
</html>`;

    const buffer = Buffer.from(html, "utf-8");
    const safeName = channelName.replace(/[^a-z0-9-]/gi, "_").slice(0, 40);
    return new AttachmentBuilder(buffer, {
      name: `transcript-${safeName}-${Date.now()}.html`,
      description: `Transcript do ticket ${channelName}`,
    });
  } catch (err) {
    console.error("Transcript generation error:", err);
    return null;
  }
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
