const MAX_TURNS = Number(process.env.CONVERSATION_MAX_TURNS || 12);
const TTL_MS = Number(process.env.CONVERSATION_TTL_MS || 30 * 60 * 1000); // 30m

const store = new Map();

function nowMs() {
  return Date.now();
}

function normalizeId(value) {
  const id = typeof value === "string" ? value.trim() : "";
  if (!id) return "";
  if (id.length > 128) return id.slice(0, 128);
  return id;
}

function pruneExpired() {
  const cutoff = nowMs() - TTL_MS;
  for (const [id, convo] of store.entries()) {
    if (!convo || typeof convo.updatedAt !== "number" || convo.updatedAt < cutoff) {
      store.delete(id);
    }
  }
}

function getConversation(idRaw) {
  pruneExpired();
  const id = normalizeId(idRaw);
  if (!id) return null;
  return store.get(id) || { updatedAt: nowMs(), turns: [] };
}

function setConversation(id, convo) {
  store.set(id, convo);
}

function appendTurn(idRaw, turn) {
  const id = normalizeId(idRaw);
  if (!id) return;

  pruneExpired();
  const convo = store.get(id) || { updatedAt: nowMs(), turns: [] };
  convo.updatedAt = nowMs();
  convo.turns.push({
    at: new Date().toISOString(),
    user: String(turn && turn.user ? turn.user : ""),
    assistant: String(turn && turn.assistant ? turn.assistant : ""),
    sql: typeof (turn && turn.sql) === "string" ? turn.sql : "",
    rowsCount:
      typeof (turn && turn.rowsCount) === "number" ? turn.rowsCount : undefined,
  });

  const limit = Number.isFinite(MAX_TURNS) ? Math.max(0, MAX_TURNS) : 12;
  if (convo.turns.length > limit) {
    convo.turns = convo.turns.slice(convo.turns.length - limit);
  }

  setConversation(id, convo);
}

function historyText(idRaw) {
  const convo = getConversation(idRaw);
  if (!convo || !Array.isArray(convo.turns) || convo.turns.length === 0) return "";

  const turns = convo.turns.slice(-8);
  const lines = ["Conversation history (most recent last):"];

  for (const t of turns) {
    const user = (t && t.user ? String(t.user) : "").trim();
    const assistant = (t && t.assistant ? String(t.assistant) : "").trim();
    const sql = (t && t.sql ? String(t.sql) : "").trim();
    const rowsCount = t && typeof t.rowsCount === "number" ? t.rowsCount : null;

    if (user) lines.push(`- User: ${user}`);
    if (assistant) lines.push(`- Assistant: ${assistant}`);
    if (sql) lines.push(`- SQL: ${sql}`);
    if (rowsCount !== null) lines.push(`- Rows: ${rowsCount}`);
  }

  return lines.join("\n");
}

function lastTurn(idRaw) {
  const convo = getConversation(idRaw);
  if (!convo || !Array.isArray(convo.turns) || convo.turns.length === 0) return null;
  return convo.turns[convo.turns.length - 1] || null;
}

module.exports = {
  appendTurn,
  historyText,
  lastTurn,
};
