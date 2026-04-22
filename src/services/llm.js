let openaiClientPromise = null;

class LlmError extends Error {
  constructor(message, { code, status, cause } = {}) {
    super(message);
    this.name = "LlmError";
    this.code = code;
    this.status = status;
    if (cause) this.cause = cause;
  }
}

function getLlmProvider() {
  const raw = String(process.env.LLM_PROVIDER || "").trim().toLowerCase();
  if (raw === "openai" || raw === "ollama") return raw;

  // Auto: prefer OpenAI when configured, otherwise local Ollama.
  return process.env.OPENAI_API_KEY ? "openai" : "ollama";
}

async function getOpenAIClient() {
  if (openaiClientPromise) return openaiClientPromise;

  openaiClientPromise = import("openai").then(({ default: OpenAI }) => {
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  });

  return openaiClientPromise;
}

function openAiModelName() {
  return process.env.OPENAI_MODEL || "gpt-5";
}

function ollamaBaseUrl() {
  return process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
}

function ollamaModelName() {
  return process.env.OLLAMA_MODEL || "";
}

function ollamaTimeoutMs() {
  const raw = Number(process.env.OLLAMA_TIMEOUT_MS || 60000);
  if (!Number.isFinite(raw)) return 60000;
  return Math.max(1000, Math.min(raw, 5 * 60 * 1000));
}

async function callOpenAI(prompt) {
  try {
    const client = await getOpenAIClient();
    const response = await client.responses.create({
      model: openAiModelName(),
      input: prompt,
    });
    return String(response.output_text || "").trim();
  } catch (err) {
    const status = Number(err && (err.status || (err.response && err.response.status)));
    const safeStatus =
      Number.isFinite(status) && status >= 400 && status < 600 ? status : 502;
    const code = err && (err.code || (err.error && err.error.code));

    throw new LlmError(err && err.message ? String(err.message) : "OpenAI request failed.", {
      code: code || "openai_error",
      status: safeStatus,
      cause: err,
    });
  }
}

async function safeReadBodyText(res) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

async function callOllama(prompt, { options, stop } = {}) {
  const model = ollamaModelName();
  if (!model) {
    throw new LlmError("OLLAMA_MODEL must be set when using Ollama.", {
      code: "ollama_not_configured",
      status: 500,
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ollamaTimeoutMs());

  try {
    const mergedOptions = {
      temperature: 0,
      ...(options && typeof options === "object" ? options : {}),
    };

    const payload = {
      model,
      prompt,
      stream: false,
      options: mergedOptions,
    };

    if (Array.isArray(stop) && stop.length) {
      payload.stop = stop;
    }

    const res = await fetch(`${ollamaBaseUrl()}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await safeReadBodyText(res);
      const msg = text || `Ollama request failed with HTTP ${res.status}`;
      throw new LlmError(msg, {
        code: res.status === 404 ? "ollama_model_not_found" : "ollama_error",
        status: res.status,
      });
    }

    const data = await res.json();
    const out = data && (data.response || data.output || "");
    return String(out || "").trim();
  } catch (err) {
    if (err && err.name === "AbortError") {
      throw new LlmError("Ollama request timed out.", {
        code: "ollama_timeout",
        status: 504,
        cause: err,
      });
    }

    if (err instanceof LlmError) throw err;

    throw new LlmError(
      "Unable to reach Ollama. Is it running on OLLAMA_BASE_URL?",
      { code: "ollama_unreachable", status: 502, cause: err }
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function callLlm(prompt, opts) {
  const provider = getLlmProvider();
  if (provider === "openai") {
    if (!process.env.OPENAI_API_KEY) {
      throw new LlmError("OPENAI_API_KEY must be set when using OpenAI.", {
        code: "openai_not_configured",
        status: 500,
      });
    }
    return callOpenAI(prompt);
  }

  return callOllama(prompt, opts);
}

async function generateSelectSql({ schema, question, outputHint, history }) {
  const prompt = [
    "You generate a single PostgreSQL SQL query for analytics questions.",
    "",
    "Rules:",
    "- Output SQL only (no Markdown, no explanations).",
    "- Only read-only SELECT queries (no INSERT/UPDATE/DELETE/DDL).",
    "- Use only the provided tables/columns.",
    "- Prefer simple queries.",
    "- Include a LIMIT clause (<= 200) for multi-row queries.",
    "- Always use snake_case column aliases.",
    "- For UUID columns, cast to text in outputs (e.g. id::text AS id).",
    "- For numeric aggregates (SUM/AVG/etc), cast to double precision for JSON-friendly numbers (e.g. SUM(amount)::double precision).",
    "- If you include LIMIT on row-returning queries, include a deterministic ORDER BY.",
    "- If the user doesn't specify business filters (e.g. what counts as 'payments' or 'sales'), follow the Business definitions in the schema text.",
    "",
    history ? String(history) : "",
    "",
    schema,
    outputHint ? `\n${outputHint}` : "",
    "",
    `Question: ${question}`,
    "",
    "SQL:",
  ].join("\n");

  return callLlm(prompt, { options: { num_predict: 256 } });
}

async function summarizeRows({ question, sql, rows, history }) {
  const preview = Array.isArray(rows) ? rows.slice(0, 50) : [];

  const prompt = [
    "You are an analytics assistant.",
    "Write a short, plain-English summary of the SQL query results.",
    "",
    "Guidelines:",
    "- Be concise (2-6 sentences).",
    "- Mention key numbers or trends you see.",
    "- If there are no rows, say that clearly and suggest a next query.",
    "",
    history ? String(history) : "",
    "",
    `Question: ${question}`,
    "",
    `SQL: ${sql}`,
    "",
    "Rows (JSON, preview):",
    JSON.stringify(preview),
    "",
    "Summary:",
  ].join("\n");

  return callLlm(prompt, { options: { num_predict: 256 } });
}

async function answerQuestion({ question, history }) {
  const q = String(question || "").trim();
  const prompt = [
    "You are InsightCopilot, a helpful assistant.",
    "Answer the user's message conversationally.",
    "",
    "Guidelines:",
    "- Be concise (1-6 sentences).",
    "- If the user is just acknowledging or saying thanks, respond politely and do not summarize prior analytics unless they explicitly ask.",
    "- If the user is asking for analytics, suggest how to ask it as a concrete question (e.g., totals, breakdowns, date ranges).",
    "- If the user is not asking for analytics, answer normally.",
    "- Do not output SQL.",
    "",
    history ? String(history) : "",
    "",
    `User: ${q}`,
    "",
    "Assistant:",
  ].join("\n");

  // Keep chat responses snappy; analytics paths use separate SQL+summary prompts.
  return callLlm(prompt, { options: { num_predict: 96 } });
}

async function repairSelectSql({ schema, question, sql, dbError, outputHint, history }) {
  const prompt = [
    "You are fixing a PostgreSQL SELECT query that failed at execution.",
    "Return a corrected SQL query only (no Markdown, no explanations).",
    "",
    "Rules:",
    "- Only read-only SELECT queries (no INSERT/UPDATE/DELETE/DDL).",
    "- Use only the provided tables/columns.",
    "- Keep it simple and correct.",
    "- Always use snake_case column aliases.",
    "- For UUID columns, cast to text in outputs (e.g. id::text AS id).",
    "- For numeric aggregates (SUM/AVG/etc), cast to double precision for JSON-friendly numbers.",
    "- Include a LIMIT clause (<= 200) for multi-row queries.",
    "- If you include LIMIT, include a deterministic ORDER BY.",
    "",
    history ? String(history) : "",
    "",
    schema,
    outputHint ? `\n${outputHint}` : "",
    "",
    `Question: ${question}`,
    "",
    "Failed SQL:",
    sql,
    "",
    "Database error:",
    String(dbError || "").trim(),
    "",
    "Corrected SQL:",
  ].join("\n");

  return callLlm(prompt, { options: { num_predict: 256 } });
}

async function prewarmLlm() {
  const provider = getLlmProvider();
  if (provider !== "ollama") return { ok: false, provider };

  try {
    // Trigger a tiny generation so Ollama loads the model into memory.
    await callOllama("Say 'ready'.", { options: { num_predict: 1 } });
    return { ok: true, provider };
  } catch (err) {
    return { ok: false, provider, error: err };
  }
}

module.exports = {
  getLlmProvider,
  generateSelectSql,
  summarizeRows,
  answerQuestion,
  repairSelectSql,
  prewarmLlm,
};
