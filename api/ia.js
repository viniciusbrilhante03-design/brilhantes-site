// Assistente de IA: repassa o pedido para a API da Anthropic. Só o gestor pode usar.
const {caller, body} = require("./_lib");
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({error: {code: "method"}});
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(503).json({error: {code: "sampling_disabled", message: "Falta a chave ANTHROPIC_API_KEY na Vercel"}});
  const who = await caller(req).catch(() => null);
  if (!who) return res.status(401).json({error: {code: "session_expired"}});
  if (who.role !== "admin") return res.status(403).json({error: {code: "not_granted"}});
  const b = body(req);
  if (!Array.isArray(b.messages) || !b.messages.length) return res.status(400).json({error: {code: "empty_completion"}});
  const model = b.tier === "quick" ? (process.env.ANTHROPIC_MODEL_RAPIDO || "claude-haiku-5-5") : (process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5");
  const payload = {model, max_tokens: Math.max(256, Math.min(+b.max_tokens || 4096, 32000)), messages: b.messages};
  if (b.system) payload.system = String(b.system);
  if (Array.isArray(b.tools) && b.tools.length) payload.tools = b.tools.slice(0, 20);
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {method: "POST", headers: {"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"}, body: JSON.stringify(payload)});
    const j = await r.json().catch(() => ({}));
    if (!r.ok){
      const m = (j.error && j.error.message) || "";
      const code = r.status === 429 || r.status === 529 ? "rate_limited" : r.status === 413 || /too long|too large|exceed/i.test(m) ? "prompt_too_large" : r.status === 401 || r.status === 403 ? "sampling_disabled" : /credit|billing/i.test(m) ? "sampling_disabled" : "ai_error";
      return res.status(r.status === 401 || r.status === 403 ? 503 : r.status).json({error: {code, message: m}});
    }
    res.status(200).json(j);
  } catch (e){
    res.status(502).json({error: {code: "ai_error", message: String(e && e.message || e)}});
  }
};
