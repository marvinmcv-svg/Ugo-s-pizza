/* HermosIA — Ugo's Pizza ordering assistant.
 * POST { messages, state, channel: "text"|"voice" } → NDJSON event stream.
 * The model proposes tool calls; api/_tools.js executes them deterministically.
 */
"use strict";
const T = require("./_tools.js");
const P = require("./_prompt.js");
const persona = require("./_persona.js");

const MAX_ROUNDS = 6;
const MAX_MSGS = 16;
const MAX_CHARS = 1200;
const RATE = { windowMs: 60000, max: 15 };
const hits = new Map();

function provider() {
  const forced = (process.env.HERMOSIA_PROVIDER || "").toLowerCase();
  if (forced === "nvidia") return process.env.NVIDIA_API_KEY ? "nvidia" : null;
  if (forced === "anthropic") return process.env.ANTHROPIC_API_KEY ? "anthropic" : null;
  if (process.env.NVIDIA_API_KEY) return "nvidia";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

function rateLimited(ip) {
  const now = Date.now(); const arr = (hits.get(ip) || []).filter((t) => now - t < RATE.windowMs);
  arr.push(now); hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > RATE.max;
}

function cleanMessages(raw) {
  const msgs = (Array.isArray(raw) ? raw : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }))
    .slice(-MAX_MSGS);
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  // merge consecutive same-role turns
  const out = [];
  for (const m of msgs) { const last = out[out.length - 1]; if (last && last.role === m.role) last.content += "\n" + m.content; else out.push({ ...m }); }
  return out;
}

const endsSentence = (s) => /[.!?…)\]"»:]\s*$|\p{Extended_Pictographic}\s*$/u.test(s);

/* ---------- one assistant turn (provider-agnostic) ---------- */
async function runAgent({ messages, state: rawState, channel }, emit, deps = {}) {
  const now = deps.now ? deps.now() : new Date();
  const log = deps.log || ((o) => console.log(JSON.stringify(o)));
  const msgs = cleanMessages(messages);
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") { emit({ type: "error", kind: "bad_request" }); return; }
  const state = T.sanitizeState(rawState, now);
  const voice = channel === "voice";
  const lastUser = msgs[msgs.length - 1].content;
  const tokenAtStart = state.stage === "awaiting_confirmation" ? state.token : null;
  const lastIsYes = T.isYes(lastUser);
  const ctx = { state, now, events: [], log, tokenAtStart, lastIsYes, channel, serverPlacing: false, orderEmitted: false };
  const flush = () => { for (const e of ctx.events.splice(0)) emit(e); };

  // Guard 1: the server — not the model — places the order on a clear "yes".
  let placedNow = null;
  if (tokenAtStart && lastIsYes && T.currentToken(state) === tokenAtStart) {
    ctx.serverPlacing = true;
    const r = T.runTool("place_order", { token: tokenAtStart }, ctx);
    ctx.serverPlacing = false;
    if (r.enviado) placedNow = { id: r.id, branch: r.destino };
    flush();
  }

  // Persona line for this turn (rotated, never repeated in a session).
  let tag = null;
  const L = require("../js/data.js").localParts(now);
  if (placedNow) tag = "order_confirmed";
  else if (msgs.length === 1) tag = voice ? "voice_listening" : "greeting";
  else if (L.h >= 23 || L.h < 1) tag = "late_night";
  else if (Object.values(state.cart).reduce((a, b) => a + b, 0) >= 5) tag = "big_order";
  const line = tag ? persona.pick(tag, state.lines) : null;
  if (line) state.lines.push(line[0]);

  const live = P.liveContext({ state, now, channel, placedNow, personaLine: line ? line[1] : null, tokenAtStart });
  let emitted = "";
  const text = (t) => { if (!t) return; emitted += t; emit({ type: "text", text: t }); };
  let roundHasText = false;
  const roundBreak = () => { if (emitted && endsSentence(emitted)) { emitted += "\n\n"; emit({ type: "text", text: "\n\n" }); } };
  const exec = (name, input) => { const r = T.runTool(name, input, ctx); flush(); return r; };

  const prov = deps.provider || provider();
  if (prov === "anthropic") await loopAnthropic({ msgs, live, voice, exec, text, roundBreak, deps, log });
  else await loopOpenAI({ msgs, live, voice, exec, text, roundBreak, deps, log });
  void roundHasText;
  emit({ type: "state", state });
}

/* ---------- Claude (Anthropic SDK) ---------- */
async function loopAnthropic({ msgs, live, voice, exec, text, roundBreak, deps, log }) {
  const Anthropic = deps.Anthropic || require("@anthropic-ai/sdk");
  const client = deps.client || new Anthropic();
  const model = voice ? (process.env.HERMOSIA_VOICE_MODEL || "claude-haiku-5-5") : (process.env.HERMOSIA_MODEL || "claude-sonnet-5-5");
  const tools = T.anthropicTools();
  const system = [
    { type: "text", text: P.STATIC, cache_control: { type: "ephemeral" } },
    { type: "text", text: live },
  ];
  const messages = msgs.map((m) => ({ role: m.role, content: m.content }));
  const useFallback = model === "claude-sonnet-5-5";
  for (let round = 0; round < MAX_ROUNDS; round++) {
    if (round > 0) roundBreak();
    const params = { model, max_tokens: 8000, system, tools, messages, output_config: { effort: voice ? "low" : "medium" } };
    const stream = useFallback
      ? client.beta.messages.stream({ ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" })
      : client.messages.stream(params);
    stream.on("text", (d) => text(d));
    let message;
    try { message = await stream.finalMessage(); }
    catch (e) {
      if (e instanceof Anthropic.APIError) throw e;
      log({ evt: "hermosia_stream_retry", msg: String(e && e.message).slice(0, 120) });
      if (round + 1 >= MAX_ROUNDS) throw e;
      continue;
    }
    if (message.stop_reason === "refusal") { text("Eso no te lo puedo responder, pero sí te ayudo con tu pizza 🍕"); return; }
    const uses = message.content.filter((b) => b.type === "tool_use");
    if (!uses.length || message.stop_reason === "end_turn") return;
    if (message.stop_reason === "max_tokens") return;
    messages.push({ role: "assistant", content: message.content });
    const results = uses.map((u) => {
      const r = exec(u.name, u.input);
      return { type: "tool_result", tool_use_id: u.id, content: JSON.stringify(r), is_error: !!r.error || undefined };
    });
    messages.push({ role: "user", content: results });
  }
}

/* ---------- NVIDIA NIM (OpenAI-compatible) ---------- */
async function loopOpenAI({ msgs, live, voice, exec, text, roundBreak, deps }) {
  const OpenAI = deps.OpenAI || require("openai");
  const client = deps.client || new OpenAI({ apiKey: process.env.NVIDIA_API_KEY, baseURL: "https://integrate.api.nvidia.com/v1" });
  const model = process.env.HERMOSIA_NVIDIA_MODEL || "nvidia/nemotron-3-ultra-550b-a55b";
  const tools = T.openaiTools();
  const messages = [{ role: "system", content: P.STATIC + "\n\n" + live }, ...msgs.map((m) => ({ role: m.role, content: m.content }))];
  for (let round = 0; round < MAX_ROUNDS; round++) {
    if (round > 0) roundBreak();
    const stream = await client.chat.completions.create({ model, messages, tools, stream: true, temperature: 0.3, max_tokens: voice ? 400 : 900 });
    let content = ""; const calls = [];
    for await (const chunk of stream) {
      const d = chunk.choices && chunk.choices[0] && chunk.choices[0].delta; if (!d) continue;
      if (d.content) { content += d.content; text(d.content); }
      for (const tc of d.tool_calls || []) {
        const i = tc.index ?? calls.length;
        calls[i] = calls[i] || { id: "", name: "", args: "" };
        if (tc.id) calls[i].id = tc.id;
        if (tc.function && tc.function.name) calls[i].name += tc.function.name;
        if (tc.function && tc.function.arguments) calls[i].args += tc.function.arguments;
      }
    }
    const done = calls.filter(Boolean);
    if (!done.length) return;
    messages.push({ role: "assistant", content: content || null, tool_calls: done.map((c, i) => ({ id: c.id || "call_" + round + "_" + i, type: "function", function: { name: c.name, arguments: c.args || "{}" } })) });
    done.forEach((c, i) => {
      let input; try { input = JSON.parse(c.args || "{}"); } catch { input = null; }
      const r = input ? exec(c.name, input) : { error: "INVALID_JSON: reenviá los argumentos." };
      messages.push({ role: "tool", tool_call_id: c.id || "call_" + round + "_" + i, content: JSON.stringify(r) });
    });
  }
}

/* ---------- Vercel handler ---------- */
module.exports = async function handler(req, res) {
  if (req.method !== "POST") { res.statusCode = 405; res.setHeader("Allow", "POST"); res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ error: "method_not_allowed" })); return; }
  // The site's chat asks for NDJSON: it gets these conditions as an event on a 200 stream,
  // so a missing key never shows up as a browser console error. Other clients get the status code.
  const wantsStream = /application\/x-ndjson/.test(String(req.headers.accept || ""));
  const fail = (status, kind) => {
    if (wantsStream) { res.statusCode = 200; res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8"); res.end(JSON.stringify({ type: "error", kind }) + "\n"); }
    else { res.statusCode = status; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ error: kind })); }
  };
  if (!provider()) { fail(503, "not_configured"); return; }
  const ip = String(req.headers["x-forwarded-for"] || (req.socket && req.socket.remoteAddress) || "?").split(",")[0].trim();
  if (rateLimited(ip)) { fail(429, "rate_limited"); return; }
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body || typeof body !== "object") { res.statusCode = 400; res.end(JSON.stringify({ error: "bad_request" })); return; }
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Accel-Buffering", "no");
  const emit = (e) => { res.write(JSON.stringify(e) + "\n"); };
  try { await runAgent(body, emit); }
  catch (e) {
    console.log(JSON.stringify({ evt: "hermosia_error", status: e && e.status, msg: String(e && e.message).slice(0, 200) }));
    emit({ type: "error", kind: e && e.status === 429 ? "rate_limited" : "upstream" });
  }
  res.end();
};
module.exports.runAgent = runAgent;
module.exports.cleanMessages = cleanMessages;
module.exports.provider = provider;
