/* Brilhante's Imóveis — conexão do sistema com o banco (Supabase), login e IA.
   O sistema chama window.claude.use("db" | "user" | "assets" | "downloads" | "sample" | "room");
   aqui cada um desses recursos é atendido pelo Supabase e pelas funções /api do site. */
(function(){
"use strict";
const LS = {
  get(k){ try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k){ try { localStorage.removeItem(k); } catch {} }
};
const fail = (code, message, extra) => Object.assign(new Error(message || code), {code}, extra || {});
const enc = encodeURIComponent;
let CFG = null, SES = LS.get("bri.sessao"), PROFILE = null;

/* ---------- configuração (vem das variáveis de ambiente da Vercel) ---------- */
async function config(){
  if (CFG) return CFG;
  const r = await fetch("/api/config", {cache: "no-store"}).catch(() => null);
  const j = r && r.ok ? await r.json().catch(() => null) : null;
  if (!j || !j.url || !j.anon) throw fail("config", "Configuração do banco ausente");
  CFG = {url: j.url.replace(/\/+$/, ""), anon: j.anon};
  return CFG;
}

/* ---------- autenticação ---------- */
async function authPost(path, body, tok){
  const c = await config();
  const r = await fetch(c.url + "/auth/v1/" + path, {method: "POST", headers: {apikey: c.anon, "Content-Type": "application/json", ...(tok ? {Authorization: "Bearer " + tok} : {})}, body: JSON.stringify(body || {})});
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw fail(j.error_code || j.error || "auth", j.msg || j.error_description || j.message || ("HTTP " + r.status), {status: r.status});
  return j;
}
function keep(j){
  SES = {access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at || Math.floor(Date.now()/1000) + (j.expires_in || 3600), user: {id: j.user.id, email: j.user.email}};
  LS.set("bri.sessao", SES);
}
let refreshing = null;
async function token(){
  if (!SES) throw fail("session_expired");
  if (SES.expires_at - 120 > Date.now()/1000) return SES.access_token;
  if (!refreshing) refreshing = authPost("token?grant_type=refresh_token", {refresh_token: SES.refresh_token})
    .then(keep)
    .catch(e => { if (e.status >= 400 && e.status < 500){ SES = null; LS.del("bri.sessao"); } throw fail("session_expired"); })
    .finally(() => { refreshing = null; });
  await refreshing;
  return SES.access_token;
}
async function logout(){
  try { if (SES) await authPost("logout", {}, SES.access_token); } catch {}
  SES = null; LS.del("bri.sessao"); location.reload();
}
async function api(path, {method = "GET", body, headers = {}, raw = false} = {}){
  const c = await config(), t = await token();
  const r = await fetch(c.url + path, {method, headers: {apikey: c.anon, Authorization: "Bearer " + t, ...(body !== undefined && !raw ? {"Content-Type": "application/json"} : {}), ...headers}, body: body === undefined ? undefined : raw ? body : JSON.stringify(body)});
  if (!r.ok){
    const j = await r.json().catch(() => ({}));
    if (r.status === 401){ SES = null; LS.del("bri.sessao"); sessionLost(); }
    throw fail(r.status === 401 ? "session_expired" : r.status === 403 ? "forbidden" : r.status === 413 ? "too_large" : "db_error", j.message || j.error || ("HTTP " + r.status), {status: r.status});
  }
  if (r.status === 204) return null;
  const tx = await r.text();
  return tx ? JSON.parse(tx) : null;
}
let lostShown = false;
function sessionLost(){
  if (lostShown) return; lostShown = true;
  const d = document.createElement("div");
  d.className = "bri-lost";
  d.innerHTML = `<b>Sua sessão expirou.</b> <button type="button">Entrar de novo</button>`;
  d.querySelector("button").onclick = () => location.reload();
  document.body.appendChild(d);
}

/* ---------- tela de login ---------- */
const CSS = `
.bri-login{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:16px;background:var(--bg,#f7f9f9);overflow:auto}
.bri-login form{width:100%;max-width:380px;background:var(--card,#fff);border:1px solid var(--border,#dde5e2);border-radius:16px;padding:28px 24px;display:flex;flex-direction:column;gap:14px;box-shadow:var(--shadow,0 4px 16px rgba(0,0,0,.06))}
.bri-login .lg{display:flex;align-items:center;gap:12px;margin-bottom:4px}
.bri-login .lg img{width:52px;height:52px;border-radius:12px}
.bri-login .lg b{display:block;font-family:var(--f-head,system-ui);font-size:19px;color:var(--fg,#13201c)}
.bri-login .lg small{color:var(--mfg,#5c6b66);font-size:12.5px}
.bri-login label{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600;color:var(--fg,#13201c)}
.bri-login input{font:inherit;font-size:16px;padding:11px 12px;border:1px solid var(--border,#dde5e2);border-radius:10px;background:var(--bg,#fff);color:var(--fg,#13201c)}
.bri-login input:focus{outline:2px solid var(--primary,#1a4a3a);outline-offset:1px}
.bri-login button{font:inherit;font-weight:700;padding:12px;border:0;border-radius:10px;background:var(--primary,#1a4a3a);color:var(--pfg,#fff);cursor:pointer}
.bri-login button[disabled]{opacity:.6;cursor:wait}
.bri-login .msg{min-height:18px;font-size:13px;color:var(--bad,#c62828)}
.bri-login .hint{font-size:12.5px;color:var(--mfg,#5c6b66);margin:0}
.bri-login .bar{height:8px;border-radius:6px;background:var(--muted,#eef3f1);overflow:hidden}
.bri-login .bar i{display:block;height:100%;width:0;background:var(--gold,#b38a2e);transition:width .2s}
.bri-lost{position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:120;background:var(--fg,#13201c);color:var(--bg,#fff);padding:10px 14px;border-radius:10px;font-size:14px;display:flex;gap:10px;align-items:center}
.bri-lost button{font:inherit;font-weight:700;border:0;border-radius:8px;padding:6px 10px;cursor:pointer}
`;
function addCSS(){ if (document.getElementById("bri-css")) return; const s = document.createElement("style"); s.id = "bri-css"; s.textContent = CSS; document.head.appendChild(s); }
function logoSrc(){ const i = document.querySelector("img.logo-l"); return i ? i.src : ""; }
function panel(inner){
  addCSS();
  const w = document.createElement("div"); w.className = "bri-login";
  w.innerHTML = `<form novalidate><div class="lg"><img alt="" src="${logoSrc()}"><div><b>Brilhante's Imóveis</b><small>Sistema de vendas · CRECI 19068J</small></div></div>${inner}</form>`;
  document.body.appendChild(w);
  return w;
}
const cleanPass = p => /^[\d.\-\s]+$/.test(p) && p.replace(/\D/g, "").length === 11 ? p.replace(/\D/g, "") : p;
function showLogin(msg){
  return new Promise(resolve => {
    const w = panel(`<label>E-mail<input type="email" name="email" autocomplete="username" required value="${(LS.get("bri.email") || "").replace(/"/g, "")}"></label>
      <label>Senha<input type="password" name="senha" autocomplete="current-password" required placeholder="Corretor: seu CPF, só números"></label>
      <div class="msg" role="alert">${msg || ""}</div><button type="submit">Entrar</button>
      <p class="hint">Esqueceu a senha? Fale com o gestor da Brilhante's Imóveis.</p>`);
    const f = w.querySelector("form"), b = f.querySelector("button"), m = f.querySelector(".msg");
    setTimeout(() => (f.email.value ? f.senha : f.email).focus(), 50);
    f.onsubmit = async e => {
      e.preventDefault();
      const email = f.email.value.trim().toLowerCase(), senha = cleanPass(f.senha.value.trim());
      if (!email || !senha){ m.textContent = "Preencha e-mail e senha."; return; }
      b.disabled = true; b.textContent = "Entrando…"; m.textContent = "";
      try {
        keep(await authPost("token?grant_type=password", {email, password: senha}));
        LS.set("bri.email", email);
        await loadProfile();
        w.remove(); resolve();
      } catch (err){
        m.textContent = err.code === "config" ? "O site ainda não está ligado ao banco de dados (falta configurar)." : err.status === 400 || err.code === "invalid_credentials" ? "E-mail ou senha incorretos." : "Não foi possível entrar agora. Verifique a internet e tente de novo.";
        b.disabled = false; b.textContent = "Entrar";
      }
    };
  });
}
async function loadProfile(){
  const r = await api(`/rest/v1/profiles?select=role,nome,email&id=eq.${enc(SES.user.id)}`);
  PROFILE = (r && r[0]) || {role: "corretor"};
}
const isAdm = () => !!PROFILE && PROFILE.role === "admin";

/* ---------- importação inicial (só gestor, banco vazio) ---------- */
async function bancoVazio(){
  const r = await api(`/rest/v1/docs?select=id&collection=eq.vendas&limit=1`);
  return !r || !r.length;
}
function b64ToBlob(b64, type){ const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], {type: type || "application/octet-stream"}); }
async function importar(json, prog){
  const cols = json.collections || json.colecoes || {};
  const rows = [];
  for (const [col, v] of Object.entries(cols)){
    const docs = Array.isArray(v) ? v : Object.values(v || {});
    for (const d of docs) if (d && d.id) rows.push({collection: col, id: String(d.id), data: d});
  }
  const arqs = Object.entries(json.arquivos || {});
  const total = rows.length + arqs.length; let feito = 0;
  for (let i = 0; i < rows.length; i += 150){
    const part = rows.slice(i, i + 150);
    await api(`/rest/v1/docs?on_conflict=collection,id`, {method: "POST", body: part, headers: {Prefer: "resolution=merge-duplicates,return=minimal"}});
    feito += part.length; prog(feito / total, `${feito} de ${total} registros`);
  }
  for (const [id, a] of arqs){
    try { await uploadBlob(id, b64ToBlob(a.b64, a.type), a.type, true); } catch (e){ console.warn("arquivo", id, e); }
    feito++; prog(feito / total, `${feito} de ${total} registros`);
  }
  return rows.length;
}
function telaImportar(){
  return new Promise(resolve => {
    const w = panel(`<b style="font-size:17px">Importar dados</b>
      <p class="hint">Escolha o <b>dados-iniciais.json</b> e, se tiver, os arquivos <b>arquivos-parte-1, 2, 3…</b> (pode selecionar todos juntos). Nada é duplicado se importar de novo.</p>
      <label>Arquivos<input type="file" name="arq" accept=".json,application/json" multiple></label>
      <div class="bar"><i></i></div><div class="msg" role="status" style="color:var(--mfg,#5c6b66)"></div>
      <button type="submit">Importar</button><button type="button" data-skip style="background:transparent;color:var(--mfg,#5c6b66)">Pular esta etapa</button>`);
    const f = w.querySelector("form"), m = f.querySelector(".msg"), bar = f.querySelector(".bar i"), b = f.querySelector("button[type=submit]");
    f.querySelector("[data-skip]").onclick = () => { w.remove(); resolve(); };
    f.onsubmit = async e => {
      e.preventDefault();
      const files = [...f.arq.files].sort((a, b) => (/dados/i.test(b.name) ? 1 : 0) - (/dados/i.test(a.name) ? 1 : 0)); if (!files.length){ m.textContent = "Escolha o arquivo."; return; }
      b.disabled = true;
      try {
        let n = 0;
        for (const [k, file] of files.entries()){
          m.textContent = `Lendo ${file.name}…`;
          n += await importar(JSON.parse(await file.text()), (p, t) => { bar.style.width = Math.round(p * 100) + "%"; m.textContent = `Arquivo ${k + 1} de ${files.length} (${file.name}): ${t}`; });
        }
        m.textContent = `Pronto: ${files.length} arquivo(s) importado(s). Abrindo o sistema…`;
        setTimeout(() => location.replace(location.pathname), 900);
      } catch (err){ console.error(err); m.style.color = ""; m.textContent = "Não foi possível importar: " + (err.message || err); b.disabled = false; }
    };
  });
}

let ready = null;
function ensureLogin(){
  if (!ready) ready = (async () => {
    try { await config(); } catch { await showLogin("O site ainda não está ligado ao banco de dados (falta configurar)."); }
    if (SES){ try { await token(); await loadProfile(); } catch { SES = null; LS.del("bri.sessao"); } }
    if (!SES) await showLogin();
    if (isAdm() && (/[?&]importar\b/.test(location.search) || await bancoVazio().catch(() => false))) await telaImportar();
  })();
  return ready;
}

/* ---------- banco: coleções e documentos (tabela "docs") ---------- */
const OPS = {">": "gt", ">=": "gte", "<": "lt", "<=": "lte", "==": "eq", "!=": "neq"};
const colName = f => f === "id" || f === "updated_at" ? f : "data->>" + f;
let cursor = "";                                  // maior updated_at visto (horário do servidor)
const seen = new Map();                           // "col/id" -> updated_at já entregue ao sistema
const note = (key, ts) => { if (!ts) return; seen.set(key, ts); if (ts > cursor) cursor = ts; };
const snap = (id, row) => ({id, exists: !!row, data: () => (row ? row.data : undefined)});
async function select(col, filters, ord, lim){
  let q = `/rest/v1/docs?select=id,data,updated_at&collection=eq.${enc(col)}`;
  for (const [f, op, v] of filters) q += `&${enc(colName(f))}=${OPS[op] || "eq"}.${enc(v)}`;
  if (ord) q += `&order=${enc(colName(ord[0]))}.${ord[1] === "desc" ? "desc" : "asc"}`;
  q += `&limit=${Math.min(lim || 1000, 1000)}`;
  return (await api(q)) || [];
}
function query(col, filters = [], ord = null, lim = null){
  return {
    where: (f, op, v) => query(col, [...filters, [f, op, v]], ord, lim),
    orderBy: (f, dir) => query(col, filters, [f, dir], lim),
    limit: n => query(col, filters, ord, n),
    doc: id => dref(col + "/" + id),
    async get(){
      const rows = await select(col, filters, ord, lim);
      rows.forEach(r => note(col + "/" + r.id, r.updated_at));
      const docs = rows.map(r => ({id: r.id, exists: true, data: () => r.data}));
      return {size: docs.length, empty: !docs.length, docs, forEach: fn => docs.forEach(fn)};
    },
    onSnapshot(cb, onErr){ const l = {col, cb, onErr}; colL.add(l); startPoll(); return () => colL.delete(l); }
  };
}
function dref(path){
  const i = path.indexOf("/"), col = path.slice(0, i), id = path.slice(i + 1);
  const where = `collection=eq.${enc(col)}&id=eq.${enc(id)}`;
  const ref = {
    id, path,
    async get(){ const r = await api(`/rest/v1/docs?select=id,data,updated_at&${where}`); const row = r && r[0]; if (row) note(path, row.updated_at); return snap(id, row); },
    async set(data){
      const r = await api(`/rest/v1/docs?on_conflict=collection,id&select=updated_at`, {method: "POST", body: [{collection: col, id, data}], headers: {Prefer: "resolution=merge-duplicates,return=representation"}});
      if (r && r[0]) note(path, r[0].updated_at);
    },
    async update(patch){ const cur = await ref.get(); return ref.set({...(cur.exists ? cur.data() : {}), ...patch}); },
    async delete(){ await api(`/rest/v1/docs?${where}`, {method: "DELETE"}); seen.delete(path); },
    onSnapshot(cb, onErr){
      const l = {path, cb, onErr}; docL.add(l);
      ref.get().then(s => { if (docL.has(l)) cb(s); }, e => onErr && onErr(e));
      startPoll(); return () => docL.delete(l);
    }
  };
  return ref;
}
const colL = new Set(), docL = new Set();
let pollT = null, polling = false;
function startPoll(){ if (pollT) return; pollT = setInterval(poll, 12000); document.addEventListener("visibilitychange", () => { if (!document.hidden) poll(); }); window.addEventListener("focus", () => poll()); }
async function poll(){
  if (polling || document.hidden || !SES || (!colL.size && !docL.size)) return;
  polling = true;
  try {
    let q = `/rest/v1/docs?select=collection,id,data,updated_at&order=updated_at.asc&limit=1000`;
    if (cursor) q += `&updated_at=gte.${enc(cursor)}`;
    const rows = (await api(q)) || [];
    const byCol = new Map();
    for (const r of rows){
      const key = r.collection + "/" + r.id;
      if (seen.get(key) === r.updated_at){ if (r.updated_at > cursor) cursor = r.updated_at; continue; }
      note(key, r.updated_at);
      if (!byCol.has(r.collection)) byCol.set(r.collection, []);
      byCol.get(r.collection).push(r);
      for (const l of docL) if (l.path === key) try { l.cb(snap(r.id, r)); } catch (e){ console.error(e); }
    }
    for (const l of colL){
      const L = byCol.get(l.col); if (!L) continue;
      const changes = L.map(r => ({type: "modified", doc: {id: r.id, exists: true, data: () => r.data}}));
      try { l.cb({size: changes.length, docs: changes.map(c => c.doc), docChanges: () => changes}); } catch (e){ console.error(e); }
    }
  } catch (e){
    if (e.code !== "session_expired") console.warn("sincronização", e.message || e);
  } finally { polling = false; }
}
const db = {collection: c => query(c), doc: p => dref(p)};

/* ---------- usuário ---------- */
const user = {
  async me(){ return {id: SES.user.id, email: SES.user.email, name: (PROFILE && PROFILE.nome) || SES.user.email, isOwner: isAdm(), canEdit: isAdm()}; },
  async can(){ return isAdm(); },
  async profiles(){ return {}; }
};

/* ---------- arquivos (Supabase Storage, pasta pública "arquivos") ---------- */
const hex32 = () => [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, "0")).join("");
async function uploadBlob(id, blob, type, upsert){
  return api(`/storage/v1/object/arquivos/${id}`, {method: "POST", body: blob, raw: true, headers: {"Content-Type": type || blob.type || "application/octet-stream", "x-upsert": upsert ? "true" : "false", "cache-control": "31536000"}});
}
const assets = {
  async upload(file, opts){
    if (file.size > 50 * 1024 * 1024) throw fail("too_large", "Arquivo maior que 50 MB");
    const id = hex32(), type = (opts && opts.type) || file.type || "application/octet-stream";
    await uploadBlob(id, file, type, false);
    return {id, url: "/_blob/" + id, sizeBytes: file.size, contentType: type};
  },
  async delete(id){ await api(`/storage/v1/object/arquivos`, {method: "DELETE", body: {prefixes: [id]}}); return {}; }
};

/* ---------- downloads ---------- */
const downloads = {
  async save({filename, data, type}){
    const blob = data instanceof Blob ? data : new Blob([data], {type: type || (typeof data === "string" ? "text/plain;charset=utf-8" : "application/octet-stream")});
    const a = document.createElement("a"), url = URL.createObjectURL(blob);
    a.href = url; a.download = filename || "arquivo"; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return {ok: true};
  }
};

/* ---------- IA (função /api/ia do próprio site) ---------- */
async function imgPart(blob){
  let b = blob, type = blob.type || "image/jpeg";
  const okType = /^image\/(jpeg|png|gif|webp)$/.test(type);
  let bmp = null; try { bmp = await createImageBitmap(blob); } catch {}
  if (bmp && (!okType || blob.size > 3.5e6 || Math.max(bmp.width, bmp.height) > 1600)){
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height)), cv = document.createElement("canvas");
    cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
    b = await new Promise(r => cv.toBlob(r, "image/jpeg", .85)); type = "image/jpeg";
  }
  const data = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(",")[1]); fr.onerror = rej; fr.readAsDataURL(b); });
  return {type: "image", source: {type: "base64", media_type: type, data}};
}
async function iaCall(body){
  let t; try { t = await token(); } catch { throw fail("session_expired"); }
  const r = await fetch("/api/ia", {method: "POST", headers: {"Content-Type": "application/json", Authorization: "Bearer " + t}, body: JSON.stringify(body)}).catch(() => null);
  if (!r) throw fail("network");
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw fail((j.error && j.error.code) || (r.status === 413 ? "prompt_too_large" : r.status === 429 ? "rate_limited" : "ai_error"), j.error && j.error.message);
  return j;
}
function normMsgs(input){
  let L = typeof input === "string" ? [{role: "user", content: input}] : (input || []).map(m => ({role: m.role === "assistant" ? "assistant" : "user", content: m.content}));
  L = L.filter(m => m.content && (typeof m.content !== "string" || m.content.trim()));
  while (L.length && L[0].role !== "user") L.shift();
  const out = [];
  for (const m of L){ const p = out[out.length - 1]; if (p && p.role === m.role && typeof p.content === "string" && typeof m.content === "string") p.content += "\n\n" + m.content; else out.push({...m}); }
  return out;
}
async function sampleRun(input, opts = {}){
  const msgs = normMsgs(input);
  if (!msgs.length) throw fail("empty_completion");
  if (opts.images && opts.images.length){
    const last = msgs[msgs.length - 1], parts = [];
    for (const im of opts.images.slice(0, 5)) parts.push(await imgPart(im));
    last.content = [...parts, {type: "text", text: typeof last.content === "string" ? last.content : ""}];
  }
  const tools = (opts.tools || []).slice(0, 20), byName = new Map(tools.map(t => [t.name, t]));
  const apiTools = tools.map(t => ({name: t.name, description: t.description || "", input_schema: t.inputSchema || {type: "object", properties: {}}}));
  let text = "", stop = "";
  for (let round = 0; round < 10; round++){
    const r = await iaCall({messages: msgs, tools: apiTools, tier: opts.modelTier === "quick" ? "quick" : "default", max_tokens: opts.maxTokens || (opts._json ? 16000 : 4096), system: opts.system});
    const blocks = r.content || []; stop = r.stop_reason;
    text = blocks.filter(b => b.type === "text").map(b => b.text).join("");
    if (stop === "refusal") throw fail("refused");
    if (stop !== "tool_use") break;
    msgs.push({role: "assistant", content: blocks});
    const results = [];
    for (const b of blocks.filter(x => x.type === "tool_use")){
      const t = byName.get(b.name);
      try {
        if (!t) throw new Error("Ferramenta desconhecida: " + b.name);
        let out = await t.execute(b.input || {});
        out = typeof out === "string" ? out : JSON.stringify(out);
        results.push({type: "tool_result", tool_use_id: b.id, content: (out || "").slice(0, 60000)});
      } catch (e){ results.push({type: "tool_result", tool_use_id: b.id, is_error: true, content: String((e && e.message) || e)}); }
    }
    msgs.push({role: "user", content: results});
    if (opts.onText && text) try { opts.onText({text}); } catch {}
  }
  if (!text.trim()) throw fail("empty_completion");
  if (opts.onText) try { opts.onText({text}); } catch {}
  return {text, truncated: stop === "max_tokens"};
}
function parseJSON(t){
  let s = String(t || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try { return JSON.parse(s); } catch {}
  const a = s.search(/[{[]/), z = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
  if (a >= 0 && z > a) try { return JSON.parse(s.slice(a, z + 1)); } catch {}
  throw fail("invalid_json");
}
const sample = Object.assign((input, opts) => sampleRun(input, opts), {
  async json(input, opts = {}){
    const ask = (typeof input === "string" ? input : "") + "\n\nResponda SOMENTE com JSON válido, sem nenhum texto antes ou depois e sem blocos de código.";
    const r = await sampleRun(typeof input === "string" ? ask : input, {...opts, tools: undefined, _json: true});
    return parseJSON(r.text);
  },
  async limits(){ return {maxPromptBytes: 400000, images: {maxCount: 5, maxBytes: 3500000}, tools: {maxCount: 20}}; }
});

/* ---------- ponto de entrada usado pelo sistema ---------- */
window.claude = {
  async use(name){
    await ensureLogin();
    switch (name){
      case "db": return db;
      case "user": return user;
      case "assets": return isAdm() ? assets : null;
      case "downloads": return downloads;
      case "sample": return isAdm() ? sample : null;
      default: return null;          // "room" e outros não existem no site próprio
    }
  }
};
window.__bri = {token, logout, api, isAdmin: isAdm, email: () => SES && SES.user.email};
})();
