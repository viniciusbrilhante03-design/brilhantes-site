// Funções compartilhadas das rotas /api (arquivo com "_" não vira rota na Vercel).
const URL_ = () => (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const ANON = () => process.env.SUPABASE_ANON_KEY || "";
const SERVICE = () => process.env.SUPABASE_SERVICE_ROLE_KEY || "";
// Chaves antigas (JWT "eyJ...") vão também no Authorization; as novas (sb_secret_...) só no apikey.
const svcHeaders = (extra = {}) => { const k = SERVICE(); return {apikey: k, ...(k.startsWith("eyJ") ? {Authorization: "Bearer " + k} : {}), ...extra}; };

async function caller(req){
  const h = req.headers.authorization || "";
  const tok = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!tok || !URL_()) return null;
  const r = await fetch(URL_() + "/auth/v1/user", {headers: {apikey: ANON() || SERVICE(), Authorization: "Bearer " + tok}});
  if (!r.ok) return null;
  const u = await r.json();
  const p = await fetch(URL_() + `/rest/v1/profiles?select=role&id=eq.${encodeURIComponent(u.id)}`, {headers: svcHeaders()});
  const rows = p.ok ? await p.json() : [];
  return {id: u.id, email: u.email, role: (rows[0] && rows[0].role) || "corretor"};
}
function body(req){
  if (req.body && typeof req.body === "object") return req.body;
  try { return JSON.parse(req.body || "{}"); } catch { return {}; }
}
module.exports = {URL_, ANON, SERVICE, svcHeaders, caller, body};
