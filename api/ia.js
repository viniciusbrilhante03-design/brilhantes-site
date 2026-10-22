// Assistente de IA. Só o gestor pode usar.
// Funciona com a chave da Anthropic (ANTHROPIC_API_KEY) ou da OpenAI (OPENAI_API_KEY). Se houver as duas, usa a Anthropic.
// O navegador sempre fala no mesmo formato; quando a chave é da OpenAI, a conversa é traduzida aqui.
const {caller, body} = require("./_lib");

const codeFor = (status, m) => status === 429 || status === 529 ? "rate_limited"
  : status === 413 || /too long|too large|exceed|context length|maximum context/i.test(m) ? "prompt_too_large"
  : status === 401 || status === 403 || /credit|billing|quota|insufficient/i.test(m) ? "sampling_disabled" : "ai_error";

async function anthropic(b, key){
  const model = b.tier === "quick" ? (process.env.ANTHROPIC_MODEL_RAPIDO || "claude-haiku-5-5") : (process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5");
  const payload = {model, max_tokens: Math.max(256, Math.min(+b.max_tokens || 4096, 32000)), messages: b.messages};
  if (b.system) payload.system = String(b.system);
  if (Array.isArray(b.tools) && b.tools.length) payload.tools = b.tools.slice(0, 20);
  const r = await fetch("https://api.anthropic.com/v1/messages", {method: "POST", headers: {"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"}, body: JSON.stringify(payload)});
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return {status: r.status, error: (j.error && j.error.message) || ""};
  return {status: 200, data: j};
}

/* ---- OpenAI: tradução de ida e volta ---- */
function toOpenAI(b){
  const out = [];
  if (b.system) out.push({role: "system", content: String(b.system)});
  for (const m of b.messages){
    if (typeof m.content === "string"){ out.push({role: m.role, content: m.content}); continue; }
    const blocks = Array.isArray(m.content) ? m.content : [];
    if (m.role === "assistant"){
      const text = blocks.filter(x => x.type === "text").map(x => x.text).join("");
      const calls = blocks.filter(x => x.type === "tool_use").map(x => ({id: x.id, type: "function", function: {name: x.name, arguments: JSON.stringify(x.input || {})}}));
      out.push({role: "assistant", content: text || null, ...(calls.length ? {tool_calls: calls} : {})});
      continue;
    }
    for (const x of blocks.filter(x => x.type === "tool_result")) out.push({role: "tool", tool_call_id: x.tool_use_id, content: (x.is_error ? "ERRO: " : "") + (typeof x.content === "string" ? x.content : JSON.stringify(x.content))});
    const parts = [];
    for (const x of blocks){
      if (x.type === "text") parts.push({type: "text", text: x.text});
      else if (x.type === "image" && x.source) parts.push({type: "image_url", image_url: {url: `data:${x.source.media_type};base64,${x.source.data}`}});
    }
    if (parts.length) out.push({role: "user", content: parts});
  }
  return out;
}
async function openai(b, key){
  const model = b.tier === "quick" ? (process.env.OPENAI_MODEL_RAPIDO || "gpt-5.4-mini") : (process.env.OPENAI_MODEL || "gpt-5.5");
  const payload = {model, messages: toOpenAI(b), max_completion_tokens: Math.max(512, Math.min(+b.max_tokens || 4096, 32000))};
  if (Array.isArray(b.tools) && b.tools.length) payload.tools = b.tools.slice(0, 20).map(t => ({type: "function", function: {name: t.name, description: t.description || "", parameters: t.input_schema || {type: "object", properties: {}}}}));
  const r = await fetch("https://api.openai.com/v1/chat/completions", {method: "POST", headers: {Authorization: "Bearer " + key, "Content-Type": "application/json"}, body: JSON.stringify(payload)});
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return {status: r.status, error: (j.error && j.error.message) || ""};
  const ch = (j.choices || [])[0] || {}, msg = ch.message || {}, content = [];
  if (msg.content) content.push({type: "text", text: msg.content});
  for (const c of msg.tool_calls || []){ let input = {}; try { input = JSON.parse(c.function.arguments || "{}"); } catch {} content.push({type: "tool_use", id: c.id, name: c.function.name, input}); }
  const stop = (msg.tool_calls || []).length ? "tool_use" : ch.finish_reason === "length" ? "max_tokens" : msg.refusal ? "refusal" : "end_turn";
  return {status: 200, data: {content, stop_reason: stop, usage: j.usage}};
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({error: {code: "method"}});
  const ak = process.env.ANTHROPIC_API_KEY, ok = process.env.OPENAI_API_KEY;
  if (!ak && !ok) return res.status(503).json({error: {code: "sampling_disabled", message: "Falta a chave da IA na Vercel (ANTHROPIC_API_KEY ou OPENAI_API_KEY)"}});
  const who = await caller(req).catch(() => null);
  if (!who) return res.status(401).json({error: {code: "session_expired"}});
  if (who.role !== "admin") return res.status(403).json({error: {code: "not_granted"}});
  const b = body(req);
  if (!Array.isArray(b.messages) || !b.messages.length) return res.status(400).json({error: {code: "empty_completion"}});
  try {
    const r = ak ? await anthropic(b, ak) : await openai(b, ok);
    if (r.status !== 200){
      const code = codeFor(r.status, r.error);
      return res.status(r.status === 401 || r.status === 403 ? 503 : r.status).json({error: {code, message: r.error}});
    }
    res.status(200).json(r.data);
  } catch (e){
    res.status(502).json({error: {code: "ai_error", message: String(e && e.message || e)}});
  }
};
