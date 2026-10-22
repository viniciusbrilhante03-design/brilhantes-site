// Voz natural da Brilhante's IA: transforma o texto da resposta em áudio (OpenAI). Qualquer usuário logado.
const {caller, body} = require("./_lib");
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({message: "Método inválido"});
  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(503).json({message: "Voz natural indisponível (falta OPENAI_API_KEY)."});
  const who = await caller(req).catch(() => null);
  if (!who) return res.status(401).json({message: "Sessão expirada."});
  const texto = String(body(req).texto || "").slice(0, 1200).trim();
  if (!texto) return res.status(400).json({message: "Sem texto."});
  const voice = process.env.OPENAI_TTS_VOICE || "onyx";
  const tentar = async model => fetch("https://api.openai.com/v1/audio/speech", {method: "POST", headers: {Authorization: "Bearer " + key, "Content-Type": "application/json"},
    body: JSON.stringify({model, voice, input: texto, response_format: "mp3", ...(/tts-1/.test(model) ? {} : {instructions: "Fale em português do Brasil, com sotaque brasileiro natural, tom calmo, confiante e sofisticado, como um assistente de inteligência artificial premium. Ritmo ágil e claro."})})});
  try {
    let r = await tentar(process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts");
    if (!r.ok && (r.status === 400 || r.status === 404)) r = await tentar("tts-1");
    if (!r.ok){ const t = await r.text(); return res.status(502).json({message: "Falha na voz: " + t.slice(0, 200)}); }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg"); res.setHeader("Cache-Control", "no-store");
    res.status(200).send(buf);
  } catch (e){ res.status(502).json({message: String(e && e.message || e)}); }
};
