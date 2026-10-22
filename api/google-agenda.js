// Google Agenda: conectar a conta Google de cada usuário e enviar compromissos, aniversários e vencimentos.
// Precisa de GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET na Vercel (ID do cliente OAuth do Google Cloud).
const crypto = require("crypto");
const {URL_, svcHeaders, caller, body} = require("./_lib");
const CID = () => process.env.GOOGLE_CLIENT_ID || "";
const CSEC = () => process.env.GOOGLE_CLIENT_SECRET || "";
const SCOPES = "https://www.googleapis.com/auth/calendar.events openid email";
const TZ = "America/Sao_Paulo";
const J = {"Content-Type": "application/json"};

const host = req => (req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
const redirectUri = req => `https://${host(req)}/api/google-agenda/callback`;
const sign = s => crypto.createHmac("sha256", (process.env.SUPABASE_SERVICE_ROLE_KEY || "x") + CSEC()).update(s).digest("base64url");
const makeState = uid => { const p = `${uid}.${Date.now()}`; return Buffer.from(`${p}.${sign(p)}`).toString("base64url"); };
function readState(st){
  try {
    const [uid, ts, sig] = Buffer.from(String(st), "base64url").toString().split(".");
    if (sign(`${uid}.${ts}`) !== sig || Date.now() - +ts > 15 * 60 * 1000) return null;
    return uid;
  } catch { return null; }
}
async function db(path, opt = {}){
  const r = await fetch(URL_() + path, {...opt, headers: svcHeaders({...J, ...(opt.headers || {})})});
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch {}
  return {ok: r.ok, status: r.status, j};
}
const getTok = async uid => { const r = await db(`/rest/v1/google_tokens?usuario=eq.${uid}&select=*`); return r.ok && r.j && r.j[0] ? r.j[0] : null; };
const saveTok = row => db(`/rest/v1/google_tokens?on_conflict=usuario`, {method: "POST", headers: {Prefer: "resolution=merge-duplicates,return=minimal"}, body: JSON.stringify([row])});

async function accessToken(uid){
  const t = await getTok(uid); if (!t || !t.refresh_token) return null;
  if (t.access_token && t.expires_at && new Date(t.expires_at).getTime() - 60000 > Date.now()) return t.access_token;
  const r = await fetch("https://oauth2.googleapis.com/token", {method: "POST", headers: {"Content-Type": "application/x-www-form-urlencoded"},
    body: new URLSearchParams({client_id: CID(), client_secret: CSEC(), refresh_token: t.refresh_token, grant_type: "refresh_token"})});
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) return null;
  await saveTok({usuario: uid, access_token: j.access_token, expires_at: new Date(Date.now() + (j.expires_in || 3600) * 1000).toISOString()});
  return j.access_token;
}
const evId = key => "brl" + crypto.createHash("md5").update(String(key)).digest("hex");
function toEvent(e){
  const ev = {id: evId(e.key), summary: String(e.titulo || "").slice(0, 250), description: String(e.descricao || "").slice(0, 4000),
    source: {title: "Brilhante's Imóveis", url: "https://www.brilhantesimoveis.com.br/"}};
  if (e.dia){
    const d = new Date(e.dia + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + 1);
    ev.start = {date: e.dia}; ev.end = {date: d.toISOString().slice(0, 10)};
  } else {
    const ini = String(e.inicio).slice(0, 16), fim = String(e.fim || "").slice(0, 16);
    let end = fim; if (!end){ const d = new Date(ini + ":00Z"); d.setUTCHours(d.getUTCHours() + 1); end = d.toISOString().slice(0, 16); }
    ev.start = {dateTime: ini + ":00", timeZone: TZ}; ev.end = {dateTime: end + ":00", timeZone: TZ};
  }
  if (e.anual) ev.recurrence = ["RRULE:FREQ=YEARLY"];
  if (e.lembrete === false) ev.reminders = {useDefault: false, overrides: []};
  return ev;
}
async function upsert(tok, ev){
  const base = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
  const H = {Authorization: "Bearer " + tok, "Content-Type": "application/json"};
  let r = await fetch(`${base}/${ev.id}`, {method: "PUT", headers: H, body: JSON.stringify({...ev, status: "confirmed"})});
  if (r.status === 404) r = await fetch(base, {method: "POST", headers: H, body: JSON.stringify(ev)});
  return r.ok;
}
async function remove(tok, key){
  const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${evId(key)}`, {method: "DELETE", headers: {Authorization: "Bearer " + tok}});
  return r.ok || r.status === 404 || r.status === 410;
}

module.exports = async (req, res) => {
  const acao = (req.query && req.query.acao) || body(req).acao || "";
  try {
    if (acao === "callback"){
      const q = req.query || {}, uid = readState(q.state), back = "/?agenda=";
      if (q.error || !q.code || !uid) return res.redirect(302, back + "erro");
      const r = await fetch("https://oauth2.googleapis.com/token", {method: "POST", headers: {"Content-Type": "application/x-www-form-urlencoded"},
        body: new URLSearchParams({code: q.code, client_id: CID(), client_secret: CSEC(), redirect_uri: redirectUri(req), grant_type: "authorization_code"})});
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.access_token) return res.redirect(302, back + "erro");
      let email = "";
      try { const p = JSON.parse(Buffer.from(String(j.id_token || "").split(".")[1] || "", "base64url").toString()); email = p.email || ""; } catch {}
      const prev = await getTok(uid);
      await saveTok({usuario: uid, email, access_token: j.access_token, refresh_token: j.refresh_token || (prev && prev.refresh_token) || null,
        expires_at: new Date(Date.now() + (j.expires_in || 3600) * 1000).toISOString(), connected_at: new Date().toISOString()});
      return res.redirect(302, back + "conectada");
    }
    if (req.method !== "POST") return res.status(405).json({message: "Método inválido"});
    const who = await caller(req).catch(() => null);
    if (!who) return res.status(401).json({message: "Sessão expirada. Entre de novo."});
    const configured = !!(CID() && CSEC());
    if (acao === "status"){
      const t = configured ? await getTok(who.id) : null;
      return res.status(200).json({configured, connected: !!(t && t.refresh_token), email: (t && t.email) || ""});
    }
    if (!configured) return res.status(400).json({message: "A integração com o Google Agenda ainda não foi configurada na Vercel (GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET)."});
    if (acao === "login"){
      const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      u.search = new URLSearchParams({client_id: CID(), redirect_uri: redirectUri(req), response_type: "code", scope: SCOPES, access_type: "offline", prompt: "consent", include_granted_scopes: "true", state: makeState(who.id), login_hint: who.email || ""}).toString();
      return res.status(200).json({url: u.toString()});
    }
    if (acao === "desconectar"){
      const t = await getTok(who.id);
      if (t && t.refresh_token) await fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(t.refresh_token), {method: "POST"}).catch(() => {});
      await db(`/rest/v1/google_tokens?usuario=eq.${who.id}`, {method: "DELETE"});
      return res.status(200).json({ok: true});
    }
    if (acao === "sincronizar"){
      const tok = await accessToken(who.id);
      if (!tok) return res.status(400).json({message: "Conecte sua conta Google de novo."});
      const b = body(req), evs = (Array.isArray(b.eventos) ? b.eventos : []).slice(0, 600), rem = (Array.isArray(b.remover) ? b.remover : []).slice(0, 300);
      let ok = 0, falhas = 0, removidos = 0; const t0 = Date.now();
      for (let i = 0; i < evs.length; i += 8){
        if (Date.now() - t0 > 50000) break;
        const rs = await Promise.all(evs.slice(i, i + 8).map(e => upsert(tok, toEvent(e)).catch(() => false)));
        rs.forEach(x => x ? ok++ : falhas++);
      }
      for (let i = 0; i < rem.length && Date.now() - t0 < 55000; i += 8){
        const rs = await Promise.all(rem.slice(i, i + 8).map(k => remove(tok, k).catch(() => false)));
        removidos += rs.filter(Boolean).length;
      }
      return res.status(200).json({ok, falhas, removidos, pendentes: Math.max(evs.length - ok - falhas, 0)});
    }
    return res.status(400).json({message: "Ação inválida."});
  } catch (e){
    return res.status(500).json({message: "Erro no servidor: " + (e && e.message || e)});
  }
};
