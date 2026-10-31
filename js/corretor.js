/* Brilhante's Imóveis — recursos de equipe:
   corretor cadastra e edita as próprias vendas (até 60 dias), cadastra clientes, vê o próprio financeiro e pesquisa loteamentos;
   gestor: duplas misturadas no ranking e aba "Duplicados" para mesclar cadastros repetidos. */
"use strict";
(function(){
const PRAZO = 60;
try { if (window.HTMLDialogElement && !HTMLDialogElement.prototype.showModal){ HTMLDialogElement.prototype.showModal = function(){ this.setAttribute("open", ""); }; HTMLDialogElement.prototype.close = function(){ this.removeAttribute("open"); this.dispatchEvent(new Event("close")); }; } } catch {}
const COR = {clientes: null, eq: null, finFiltro: "abertas", cliQ: "", lotQ: ""};
async function corAPI(body){
  const t = await window.__bri.token();
  const r = await fetch("/api/corretor", {method: "POST", headers: {"Content-Type": "application/json", Authorization: "Bearer " + t}, body: JSON.stringify(body)}).catch(() => null);
  if (!r) throw Object.assign(new Error("Sem conexão com o site."), {status: 0});
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.message || "Não foi possível concluir (" + r.status + ")."), {status: r.status, j});
  return j;
}
const diasDesde = iso => { const t = Date.parse(iso || ""); return isFinite(t) ? Math.floor((Date.now() - t) / 864e5) : null; };
const podeEditar = v => { const d = diasDesde(v && v.created_at); return d == null || d <= PRAZO; };

(function(){ const st2 = document.createElement("style"); st2.textContent = `
.rank li.duo{grid-template-columns:26px 50px minmax(0,1fr) auto}
.av.duo{position:relative;width:50px;overflow:visible;background:none}
.av.duo i{position:absolute;top:1px;width:32px;height:32px;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:var(--goldbg);color:var(--gold);font-style:normal;font-size:11px;font-weight:700;border:2px solid var(--card)}
.av.duo i:first-child{left:0;z-index:1}.av.duo i:last-child{left:17px}
.av.duo img{width:100%;height:100%;object-fit:cover}
.chips-o{display:flex;flex-wrap:wrap;gap:6px}
.chips-o button{border:1px solid var(--border);background:var(--card);color:var(--fg);border-radius:999px;padding:6px 12px;font:inherit;font-size:13px;cursor:pointer}
.chips-o button.on{background:var(--primary);color:var(--pfg);border-color:var(--primary)}
.cx-lbl{font-size:13px;font-weight:600}
dialog[open]{display:block}
.gm-style .gm-style-iw-c{padding-top:10px!important}
.gm-style button.gm-ui-hover-effect{opacity:1!important;width:36px!important;height:36px!important;margin:4px!important;background:#1a4636!important;border-radius:50%!important;box-shadow:0 2px 6px rgba(0,0,0,.35)!important;display:grid!important;place-items:center!important}
.gm-style button.gm-ui-hover-effect>span{background-color:#fff!important;width:18px!important;height:18px!important;margin:0!important}
.gm-style button.gm-ui-hover-effect img{filter:invert(1) brightness(2)!important;width:18px!important;height:18px!important;margin:0!important}
.vh-file{position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;overflow:hidden!important;clip:rect(0 0 0 0)!important;pointer-events:none!important}
@media (max-width:760px), (pointer:coarse) and (max-width:1366px){
  dialog#dlg{position:fixed;inset:0;margin:0;width:100vw!important;max-width:100vw!important;height:100vh;height:100dvh;max-height:none;border-radius:0}
  dialog#dlg>.dlg,dialog#dlg>form.dlg{height:100%;max-height:100%;max-width:none!important;width:100%}
  dialog#dlg>.dlg>.db{-webkit-overflow-scrolling:touch;min-height:0}
}`; document.head.appendChild(st2); })();
const ORIGEM = [["acao", "🎯 Ação"], ["lead", "📣 Lead anúncio"], ["carteira", "📋 Carteira"], ["stand", "🏢 Stand"], ["indicacao", "🤝 Indicação"], ["outro", "✏️ Outro"]];
function blocoExtrasCliente(v, pre){
  const sp = v.spouse || {};
  return `<div class="cx" style="display:flex;flex-direction:column;gap:10px;margin-top:8px">
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span class="cx-lbl">Possui cônjuge/companheiro?</span><span class="chips-o" data-cxsp><button type="button" data-v="0" class="${v.has_spouse ? "" : "on"}">Não</button><button type="button" data-v="1" class="${v.has_spouse ? "on" : ""}">Sim</button></span></div>
    <div class="g" data-cxspf ${v.has_spouse ? "" : "hidden"}>
      <label class="f">Nome do cônjuge<input type="text" data-cxk="name" value="${esc(sp.name || "")}"></label><label class="f">Telefone<input type="tel" data-cxk="phone" value="${esc(sp.phone || "")}"></label>
      <label class="f">E-mail<input type="email" data-cxk="email" value="${esc(sp.email || "")}"></label><label class="f">CPF<input type="text" data-cxk="cpf" value="${esc(sp.cpf || "")}"></label><label class="f">Nascimento<input type="date" data-cxk="birthdate" value="${esc(sp.birthdate || "")}"></label></div>
    <div style="display:flex;flex-direction:column;gap:6px"><span class="cx-lbl">Origem <span style="color:var(--mfg);font-weight:400">(opcional)</span></span><span class="chips-o" data-cxor>${ORIGEM.map(([k, l]) => `<button type="button" data-v="${k}" class="${v.origin === k ? "on" : ""}">${l}</button>`).join("")}</span></div>
    <label class="f">Observação do cliente <span style="color:var(--mfg);font-weight:400">(opcional)</span><textarea data-cxnotes rows="2" placeholder="Fica no cadastro do cliente">${esc(v.notes || "")}</textarea></label></div>`;
}
// liga os botões do bloco; onChange recebe {has_spouse, spouse, origin, notes}
function ligarExtras(root, val, onChange){
  const up = () => onChange(val);
  root.querySelector("[data-cxsp]").onclick = e => { const b = e.target.closest("button"); if (!b) return; val.has_spouse = b.dataset.v === "1"; root.querySelectorAll("[data-cxsp] button").forEach(x => x.classList.toggle("on", x === b)); root.querySelector("[data-cxspf]").hidden = !val.has_spouse; up(); };
  root.querySelector("[data-cxor]").onclick = e => { const b = e.target.closest("button"); if (!b) return; val.origin = val.origin === b.dataset.v ? "" : b.dataset.v; root.querySelectorAll("[data-cxor] button").forEach(x => x.classList.toggle("on", x.dataset.v === val.origin)); up(); };
  root.querySelectorAll("[data-cxk]").forEach(i => i.oninput = () => { val.spouse = {...(val.spouse || {}), [i.dataset.cxk]: i.value}; up(); });
  root.querySelector("[data-cxnotes]").oninput = e => { val.notes = e.target.value; up(); };
}
const iniciais = n => String(n || "").trim().split(/\s+/).slice(0, 2).map(x => x[0] || "").join("").toUpperCase();
function avatarDupla(li, membros, foto){
  const av = li.querySelector(".av"); if (!av || av.classList.contains("duo")) return;
  li.classList.add("duo"); av.classList.add("duo");
  av.innerHTML = membros.slice(0, 2).map(n => { const f = foto(n); return `<i>${f ? `<img alt="" src="${esc(f)}">` : esc(iniciais(n))}</i>`; }).join("");
}
// iPhone/iPad: campo de arquivo com "hidden" às vezes não abre o seletor; troca por um campo invisível mas presente
function arrumarArquivos(root){ (root || document).querySelectorAll('input[type="file"][hidden]').forEach(i => { i.hidden = false; i.classList.add("vh-file"); const lb = i.closest("label"); if (lb && getComputedStyle(lb).position === "static") lb.style.position = "relative"; }); }
let _faT = 0; new MutationObserver(() => { cancelAnimationFrame(_faT); _faT = requestAnimationFrame(() => arrumarArquivos()); }).observe(document.documentElement, {childList: true, subtree: true});
// gestor: duas fotos nas duplas do ranking do Painel (e de qualquer lista de ranking)
let _rkT = 0;
new MutationObserver(() => { cancelAnimationFrame(_rkT); _rkT = requestAnimationFrame(() => {
  if (typeof isAdmin === "undefined" || !isAdmin) return;
  $$("ol.rank li").forEach(li => { const meta = li.querySelector(".meta"); if (!meta) return; const m = meta.textContent.split(" & ").map(x => x.trim()).filter(Boolean); if (m.length >= 2) avatarDupla(li, m, n => photoFor(n)); });
}); }).observe(document.documentElement, {childList: true, subtree: true});

/* =================== RANKING: duplas cadastradas entram como uma linha só =================== */
if (typeof ranking === "function"){
  const _ranking = ranking;
  ranking = function(list, kind){
    const r = _ranking(list, kind);
    if (kind !== "corretores") return r;
    const gi = groupIndex(); if (!gi.size) return r;
    const out = new Map();
    for (const e of r){
      const g = gi.get(norm(e.label)) || [...(e.names || [])].map(n => gi.get(norm(n))).find(Boolean);
      if (!g){ out.set(e.key, e); continue; }
      const k = "g:" + g.id, o = out.get(k) || {key: k, label: g.name || (g.members || []).join(" + "), members: g.members || [], qtd: 0, vgv: 0, comm: 0, corr: 0, names: new Set(), dupla: true};
      o.qtd += e.qtd; o.vgv += e.vgv; o.comm += e.comm; o.corr += e.corr; (e.names || []).forEach(n => o.names.add(n)); out.set(k, o);
    }
    const by = ui.rankBy === "vgv" ? "vgv" : ui.rankBy === "comm" ? "comm" : "qtd";
    return [...out.values()].sort((a, b) => b[by] - a[by] || b.vgv - a.vgv);
  };
}

/* =================== GESTOR: dados públicos extras para o formulário do corretor =================== */
if (typeof portalFor === "function"){
  const _pf = portalFor;
  portalFor = function(u){ const p = _pf.apply(this, arguments); const by = new Map(allSales().map(s => [s.id, s])); for (const v of p.vendas || []){ const s = by.get(v.id); if (s) v.created_at = s.created_at || null; } return p; };
}
if (typeof syncPortals === "function"){
  const _sync = syncPortals;
  syncPortals = async function(){
    const r = await _sync.apply(this, arguments);
    if (!isAdmin) return r;
    try {
      const nomes = [...st.usuarios.values()].filter(u => u.role === "corretor" && u.active !== false && !u.deleted_at).map(u => (u.war_name || u.name || "").trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR"));
      const regras = {}; for (const [k, v] of Object.entries((rulesDoc() || {}).itens || {})) if (v && v.pct != null) regras[k] = {pct: v.pct};
      const data = {id: "equipe", itens: nomes.map(nome => ({nome})), regras}, key = JSON.stringify(data);
      publicarFotos();
      if (lastPortal.get("publico/equipe") !== key){ wq = wq.then(() => db.doc("publico/equipe").set({...data, updated_at: nowISO()})).then(() => lastPortal.set("publico/equipe", key)).catch(() => {}); }
    } catch (e){ console.warn("equipe", e); }
    return r;
  };
}

const THUMB = new Map();
function miniatura(src){
  if (THUMB.has(src)) return THUMB.get(src);
  const p = new Promise(ok => { const im = new Image(); im.onload = () => { try { const c = document.createElement("canvas"), z = 96, r = Math.max(z / im.width, z / im.height), w = im.width * r, h = im.height * r; c.width = c.height = z; c.getContext("2d").drawImage(im, (z - w) / 2, (z - h) / 2, w, h); ok(c.toDataURL("image/jpeg", .75)); } catch { ok(null); } }; im.onerror = () => ok(null); im.src = src; });
  THUMB.set(src, p); return p;
}
async function publicarFotos(){
  const itens = {};
  for (const u of st.usuarios.values()){ if (u.deleted_at || !u.picture || !String(u.picture).startsWith("data:")) continue; const t = await miniatura(u.picture); if (t) for (const n of [u.war_name, u.name]) if (norm(n)) itens[norm(n)] = t; }
  for (const b of st.corretores.values()){ if (b.deleted_at || !b.photo || !String(b.photo).startsWith("data:")) continue; const t = await miniatura(b.photo); if (t) for (const n of [b.war_name, b.full_name]) if (norm(n) && !itens[norm(n)]) itens[norm(n)] = t; }
  const key = JSON.stringify(itens); if (lastPortal.get("publico/fotos") === key) return;
  wq = wq.then(() => db.doc("publico/fotos").set({id: "fotos", itens, updated_at: nowISO()})).then(() => lastPortal.set("publico/fotos", key)).catch(() => {});
}

/* =================== COPYS: ordem Geral → Infraestrutura → Localização → Valores, e reordenar (gestor) =================== */
const ORDEM_COPY = ["Geral", "Infraestrutura", "Localização", "Valores"];
if (typeof COPYCAT !== "undefined"){ const extra = COPYCAT.filter(c => !ORDEM_COPY.includes(c)); COPYCAT.splice(0, COPYCAT.length, ...ORDEM_COPY, ...extra); }
function copiasOrdenadas(l){
  const L = (l && l.copies) || []; if (l && l.copies_manual) return L.slice();
  const pos = c => { const i = COPYCAT.indexOf(c.category); return i < 0 ? 99 : i; };
  return L.map((c, i) => [c, i]).sort((a, b) => pos(a[0]) - pos(b[0]) || a[1] - b[1]).map(x => x[0]);
}
if (typeof LOTTAB !== "undefined" && LOTTAB.copys){
  const _h = LOTTAB.copys, _b = LOTBIND.copys;
  LOTTAB.copys = function(l){ return _h.call(this, {...l, copies: copiasOrdenadas(l)}); };
  LOTBIND.copys = function(l){
    const r = _b ? _b.apply(this, arguments) : undefined;
    if (!canWrite) return r;
    const body = $("#ltBody"); if (!body) return r;
    const cards = [...body.querySelectorAll(".card")].filter(c => c.querySelector('[data-act="editcopy"]'));
    cards.forEach((card, k) => {
      const id = card.querySelector('[data-act="editcopy"]').dataset.id; card.dataset.cpid = id; card.draggable = true; card.style.cursor = "grab";
      const tb = card.querySelector(".toolbar");
      if (tb) tb.insertAdjacentHTML("afterbegin", `<button type="button" class="btn sm" data-cpmv="-1" title="Subir" aria-label="Subir" ${k === 0 ? "disabled" : ""}>▲</button><button type="button" class="btn sm" data-cpmv="1" title="Descer" aria-label="Descer" ${k === cards.length - 1 ? "disabled" : ""}>▼</button>`);
    });
    if (cards.length > 1){ const seg = $("#cpF"); if (seg && !body.querySelector("[data-cphint]")) seg.insertAdjacentHTML("afterend", `<p data-cphint style="margin:0;color:var(--mfg);font-size:12px">Arraste as copys ou use ▲▼ para mudar a ordem. ${l.copies_manual ? `<button type="button" class="btn sm" data-cpreset>Voltar à ordem padrão (Geral, Infraestrutura, Localização, Valores)</button>` : "Ordem padrão: Geral, Infraestrutura, Localização, Valores."}</p>`); }
    const salvar = ordem => { const d = st.loteamentos.get(l.id); saveDoc("loteamentos", {...d, copies: ordem, copies_manual: true}); renderLot(); };
    const mover = (id, alvoId) => { const full = copiasOrdenadas(st.loteamentos.get(l.id)), i = full.findIndex(c => c.id === id), j = full.findIndex(c => c.id === alvoId); if (i < 0 || j < 0 || i === j) return; const [x] = full.splice(i, 1); full.splice(j, 0, x); salvar(full); };
    body.addEventListener("click", e => {
      const mv = e.target.closest("[data-cpmv]"); if (mv){ const card = mv.closest("[data-cpid]"), k = cards.indexOf(card), viz = cards[k + +mv.dataset.cpmv]; if (viz) mover(card.dataset.cpid, viz.dataset.cpid); return; }
      if (e.target.closest("[data-cpreset]")){ const d = st.loteamentos.get(l.id); const n = {...d}; delete n.copies_manual; n.copies = copiasOrdenadas(n); saveDoc("loteamentos", n); renderLot(); }
    });
    let arr = null;
    cards.forEach(card => {
      card.addEventListener("dragstart", e => { arr = card.dataset.cpid; card.style.opacity = ".5"; try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", arr); } catch {} });
      card.addEventListener("dragend", () => { card.style.opacity = ""; });
      card.addEventListener("dragover", e => { if (arr && arr !== card.dataset.cpid){ e.preventDefault(); card.style.outline = "2px dashed var(--gold)"; } });
      card.addEventListener("dragleave", () => { card.style.outline = ""; });
      card.addEventListener("drop", e => { e.preventDefault(); card.style.outline = ""; if (arr) mover(arr, card.dataset.cpid); arr = null; });
    });
    return r;
  };
}
// corretor recebe as copys já na ordem certa
if (typeof slimLots === "function"){
  const _slim = slimLots;
  slimLots = function(){ return _slim.apply(this, arguments).map(x => { const l = st.loteamentos.get(x.id); return l ? {...x, copies: copiasOrdenadas(l)} : x; }); };
}
// corretor: na ficha do loteamento, primeiro as informações; as fotos vêm depois (ou pelo botão "Fotos")
if (typeof openLotC === "function"){
  const _olc = openLotC;
  openLotC = function(l){
    const r = _olc.apply(this, arguments);
    try {
      if (!l) return r; const db2 = $("#sheet .db"); if (!db2) return r;
      const grid = [...db2.children].find(x => x.tagName === "DIV" && /grid-template-columns/.test(x.getAttribute("style") || "") && x.querySelector("img"));
      if (!grid) return r;
      const med = (l.media || []), fotos = med.filter(m => ["foto", "arte"].includes(m.kind)), plantas = med.filter(m => m.kind === "planta"), n = fotos.length;
      const cel = m => /pdf/i.test(m.content_type || "") ? `<a class="btn sm" href="${esc(blobUrl(m))}" target="_blank" rel="noopener" style="justify-content:flex-start">📄 ${esc(m.title || m.caption || "Planta (PDF)")}</a>` : `<a href="${esc(blobUrl(m))}" target="_blank" rel="noopener"><img src="${esc(blobUrl(m))}" alt="" loading="lazy" style="aspect-ratio:4/3;width:100%;object-fit:cover;border-radius:8px"></a>`;
      const g = arr => `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px">${arr.map(cel).join("")}</div>`;
      grid.remove();
      const bloco = document.createElement("div"); bloco.className = "fs"; bloco.id = "lotFotos"; bloco.innerHTML = `<h3>Fotos (${n})</h3>${n ? g(fotos) : `<p style="margin:0;color:var(--mfg)">Sem fotos.</p>`}${plantas.length ? `<h3 style="margin-top:14px">Plantas (${plantas.length})</h3>${g(plantas)}` : ""}`;
      const ancora = [...db2.children].find(x => x.classList.contains("fs") && /Documentos|Vídeos|Copys|Pergunte/.test((x.querySelector("h3") || {}).textContent || ""));
      if (ancora) db2.insertBefore(bloco, ancora); else db2.appendChild(bloco);
      db2.insertAdjacentHTML("afterbegin", `<div class="toolbar"><button type="button" class="btn sm" data-irfotos>📷 Ver fotos (${n})${plantas.length ? " e plantas" : ""}</button></div>`);
      db2.querySelector("[data-irfotos]").onclick = () => bloco.scrollIntoView({behavior: "smooth", block: "start"});
    } catch (e){ console.warn("ficha", e); }
    return r;
  };
}

/* =================== FICHA (gestor): Fotos e Plantas separadas =================== */
if (typeof LOTBIND !== "undefined"){
  const _mb = LOTBIND.midia;
  LOTBIND.midia = function(l){
    const r = _mb ? _mb.apply(this, arguments) : undefined;
    try {
      const body = $("#ltBody"); const fs = body && [...body.querySelectorAll(".fs")].find(x => /^Fotos e plantas/i.test(((x.querySelector("h3") || {}).textContent || "").trim())); if (!fs) return r;
      const grid = fs.querySelector("div[style*='grid-template-columns']"), figs = grid ? [...grid.querySelectorAll("figure")] : [];
      const plantas = figs.filter(f => [...f.querySelectorAll(".pill")].some(p => /planta/i.test(p.textContent)));
      fs.querySelector("h3").textContent = `Fotos (${figs.length - plantas.length})`;
      const box = document.createElement("div"); box.className = "fs"; box.innerHTML = `<h3>Plantas (${plantas.length})</h3>`;
      if (plantas.length){ const g2 = grid.cloneNode(false); plantas.forEach(f => g2.appendChild(f)); box.appendChild(g2); } else box.insertAdjacentHTML("beforeend", `<p style="margin:0;color:var(--mfg)">Nenhuma planta ainda. Use “+ Planta” (imagem ou PDF).</p>`);
      if (grid && !grid.children.length) grid.outerHTML = `<p style="margin:0;color:var(--mfg)">Nenhuma foto ainda.</p>`;
      fs.after(box);
    } catch (e){ console.warn("plantas", e); }
    return r;
  };
}

/* =================== LOTEAMENTOS: prioridade (Organizar) com botão "Topo" =================== */
if (typeof Loteamentos !== "undefined" && typeof saveOrder === "function"){
  const _lu = Loteamentos.update;
  Loteamentos.update = function(){
    const r = _lu.apply(this, arguments);
    if (ui.lMode !== "ordem") return r;
    $$("#ordList li").forEach((li, i) => { if (li.querySelector("[data-topo]")) return; const ref = li.querySelector("[data-mv]"); const btn = `<button type="button" class="btn sm" data-topo title="Mover para o topo" ${i === 0 ? "disabled" : ""}>⤒ Topo</button>`; if (ref) ref.insertAdjacentHTML("beforebegin", btn); else li.insertAdjacentHTML("beforeend", btn); });
    const ol = $("#ordList"); if (ol && !ol.dataset.topo){ ol.dataset.topo = "1"; ol.addEventListener("click", e => { const b = e.target.closest("[data-topo]"); if (!b) return; e.stopPropagation(); const id = b.closest("li").dataset.oid, ids = lotList().map(l => l.id).filter(x => x !== id); saveOrder([id, ...ids]); toast("Movido para o topo"); }, true); }
    return r;
  };
}

/* =================== GESTOR: prazo de edição do corretor (só o gestor vê) =================== */
if (typeof openSale === "function"){
  const _os = openSale;
  openSale = function(id){
    const r = _os.apply(this, arguments);
    try { if (!isAdmin) return r; const s = st.vendas.get(id), db2 = $("#sheet .db"); if (!s || !db2 || !s.created_at || db2.querySelector("[data-prazo]")) return r;
      const fim = new Date(Date.parse(s.created_at) + PRAZO * 864e5).toISOString().slice(0, 10), aberto = fim >= T;
      db2.insertAdjacentHTML("afterbegin", `<div data-prazo style="font-size:12.5px;color:var(--mfg)"><span class="pill ${aberto ? "p-gold" : "p-mut"}">${aberto ? `Corretor pode editar até ${dBR(fim)}` : `Edição do corretor encerrada em ${dBR(fim)}`}</span>${s.origem === "corretor" ? ` <span class="pill p-mut">cadastrada pelo corretor</span>` : ""} <button class="btn sm" data-dupadm>Duplicar (outro lote)</button></div>`);
      const bd = db2.querySelector("[data-dupadm]"); if (bd) bd.onclick = () => { $("#sheet").close(); openSaleForm(copiaVenda(s, "")); toast("Venda duplicada: preencha a quadra e o lote do novo lote"); };
    } catch {}
    return r;
  };
}

/* =================== GESTOR: aba Duplicados =================== */
const lev = (a, b) => { if (a === b) return 0; const m = a.length, n = b.length; if (!m || !n) return m || n; let p = Array.from({length: n + 1}, (_, j) => j); for (let i = 1; i <= m; i++){ const c = [i]; for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; } return p[n]; };
const parecido = (a, b) => { const x = lotKey(a), y = lotKey(b); if (!x || !y) return false; if (x === y) return true; if ((x.match(/\d+/g) || []).join(",") !== (y.match(/\d+/g) || []).join(",")) return false; return Math.min(x.length, y.length) >= 6 && lev(x, y) <= (Math.max(x.length, y.length) >= 14 ? 2 : 1); };
function grupos(itens, liga){ const pai = itens.map((_, i) => i), f = i => pai[i] === i ? i : (pai[i] = f(pai[i])); for (let i = 0; i < itens.length; i++) for (let j = i + 1; j < itens.length; j++) if (liga(itens[i], itens[j])) pai[f(i)] = f(j); const G = new Map(); itens.forEach((x, i) => { const r = f(i); G.set(r, [...(G.get(r) || []), x]); }); return [...G.values()].filter(g => g.length > 1); }
const DUP = {sel: {}};
function dupLots(){ return grupos(lotList(), (a, b) => parecido(a.name, b.name)); }
function dupClientes(){
  const L = [...st.clientes.values()].filter(c => !c.deleted_at), dig = s => onlyDigits(s);
  return grupos(L, (a, b) => { const ca = dig(a.cpf), cb = dig(b.cpf); if (ca.length === 11 && ca === cb) return true; const pa = dig(a.phone).slice(-9), pb = dig(b.phone).slice(-9); if (pa.length >= 8 && pa === pb && norm(a.name).split(" ")[0] === norm(b.name).split(" ")[0]) return true; return norm(a.name) && norm(a.name) === norm(b.name); });
}
function lotesSemCadastro(){
  const lots = lotList(), cont = new Map();
  for (const s of allSales()) if (isActive(s) && s.property_name && !lots.some(l => norm(l.name) === norm(s.property_name))){ const k = norm(s.property_name); const e = cont.get(k) || {nome: s.property_name.trim(), qtd: 0}; e.qtd++; cont.set(k, e); }
  return [...cont.values()].map(e => ({...e, sugestao: lots.find(l => parecido(l.name, e.nome)) || null})).sort((a, b) => b.qtd - a.qtd);
}
function corretoresSemCadastro(){
  const us = [...st.usuarios.values()].filter(u => !u.deleted_at), cont = new Map();
  for (const s of allSales()) if (isActive(s)) for (const b of brokersOf(s)){ if (!b.name || b.name === "—") continue; if (us.some(u => [u.war_name, u.name].some(x => norm(x) === norm(b.name)))) continue; const k = norm(b.name); const e = cont.get(k) || {nome: b.name, qtd: 0}; e.qtd++; cont.set(k, e); }
  return [...cont.values()].map(e => ({...e, sugestao: us.find(u => u.role === "corretor" && [u.war_name, u.name].some(x => x && (norm(x).startsWith(norm(e.nome)) || norm(e.nome).startsWith(norm(x)) || parecido(x, e.nome))))})).sort((a, b) => b.qtd - a.qtd);
}
function vazio(v){ return v == null || v === "" || (typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length) || (Array.isArray(v) && !v.length); }
function completar(a, b){ const o = {...a}; for (const [k, v] of Object.entries(b || {})){ if (["id", "created_at", "updated_at", "deleted_at", "name", "name_lower", "order"].includes(k)) continue; if (vazio(o[k])) o[k] = v; else if (o[k] && typeof o[k] === "object" && !Array.isArray(o[k]) && v && typeof v === "object" && !Array.isArray(v)) o[k] = completar(o[k], v); } return o; }
function mesclarLots(keep, drops){
  let nv = 0, nm = 0;
  for (const d of drops){
    for (const s of allSales()) if (norm(s.property_name) === norm(d.name) && s.property_name !== keep.name){ const n = {...s, property_name: keep.name}; saveDoc("vendas", n); nv++; }
    for (const m of st.lot_media.values()) if (m.lot_id === d.id && !m.deleted_at){ saveDoc("lot_media", {...m, lot_id: keep.id}); nm++; }
    for (const a of st.agenda.values()) if (a.lot && norm(a.lot) === norm(d.name)) saveDoc("agenda", {...a, lot: keep.name});
    const rd = rulesDoc(), it = {...(rd.itens || {})}; if (it[lotKey(d.name)] && !it[lotKey(keep.name)]){ it[lotKey(keep.name)] = it[lotKey(d.name)]; saveRules(it); }
    keep = completar(keep, d);
    saveDoc("loteamentos", {...d, deleted_at: nowISO(), mesclado_em: keep.id});
  }
  saveDoc("loteamentos", keep);
  return {nv, nm};
}
function mesclarClientes(keep, drops){
  let nv = 0;
  for (const d of drops){
    for (const s of allSales()) if (norm(s.client_name) === norm(d.name) && norm(d.name) !== norm(keep.name)){ saveDoc("vendas", {...s, client_name: keep.name, client_phone: s.client_phone || keep.phone || "", client_cpf: s.client_cpf || keep.cpf || ""}); nv++; }
    keep = completar(keep, d);
    saveDoc("clientes", {...d, deleted_at: nowISO(), mesclado_em: keep.id});
  }
  saveDoc("clientes", {...keep, name_key: norm(keep.name), cpf_key: onlyDigits(keep.cpf)});
  return nv;
}
function renomearLoteVendas(nome, lot){ let n = 0; for (const s of allSales()) if (norm(s.property_name) === norm(nome)){ saveDoc("vendas", {...s, property_name: lot.name}); n++; } return n; }
function renomearCorretorVendas(nome, u){
  const novo = (u.war_name || u.name).trim(); let n = 0;
  for (const s of allSales()){
    const bs = (s.brokers && s.brokers.length) ? s.brokers : [{name: s.broker_name, split_pct: 100, owner_id: s.owner_id}];
    if (!bs.some(b => norm(b.name) === norm(nome))) continue;
    const nb = bs.map(b => norm(b.name) === norm(nome) ? {...b, name: novo, owner_id: u.id} : b);
    saveDoc("vendas", {...s, brokers: nb, broker_ids: nb.map(b => b.owner_id).filter(Boolean), broker_name: nb.map(b => b.name).join(" + "), owner_id: nb[0].owner_id, owner_name: nb[0].name}); n++;
  }
  return n;
}
function dupHTML(){
  const lots = dupLots(), cls = dupClientes(), semLot = lotesSemCadastro(), semCor = corretoresSemCadastro();
  const lotLine = l => `${esc(l.name)} <span style="color:var(--mfg);font-size:12px">· ${lotSales(l).length} vendas · ${lotMedia(l.id).length} arquivos${l.created_at ? " · criado " + dBR(l.created_at) : ""}</span>`;
  const cliLine = c => `${esc(c.name)} <span style="color:var(--mfg);font-size:12px">· ${esc(fmtPhone(c.phone) || "sem telefone")}${c.cpf ? " · CPF " + esc(c.cpf) : ""} · ${allSales().filter(s => isActive(s) && norm(s.client_name) === norm(c.name)).length} compras</span>`;
  const grupo = (tipo, g, i, line) => { const k = tipo + i, sel = DUP.sel[k] || g[0].id; return `<div class="card" style="padding:12px;box-shadow:none;display:flex;flex-direction:column;gap:8px">${g.map(x => `<label style="display:flex;gap:10px;align-items:center;cursor:pointer"><input type="radio" name="${k}" value="${esc(x.id)}" data-dsel="${k}" ${x.id === sel ? "checked" : ""}><span>${line(x)}</span></label>`).join("")}<div><button class="btn sm pri" data-mesclar="${tipo}" data-i="${i}">Mesclar no marcado</button></div></div>`; };
  const sec = (t, n, body, vaz) => `<section class="card"><div class="hd"><h2>${t} <span class="pill ${n ? "p-warn" : "p-ok"}">${n}</span></h2></div><div class="bd" style="display:flex;flex-direction:column;gap:10px">${n ? body : `<div class="empty" style="padding:16px">${vaz}</div>`}</div></section>`;
  return `<div class="pagehead"><div><h1>Duplicados</h1><p>Mesclar não apaga histórico: as vendas, fotos e documentos passam para o cadastro marcado, e o outro fica guardado como “mesclado”.</p></div></div>
    <div style="display:flex;flex-direction:column;gap:14px">
    ${sec("Loteamentos repetidos", lots.length, lots.map((g, i) => grupo("lot", g, i, lotLine)).join(""), "Nenhum loteamento duplicado.")}
    ${sec("Clientes repetidos", cls.length, cls.map((g, i) => grupo("cli", g, i, cliLine)).join(""), "Nenhum cliente duplicado.")}
    ${sec("Vendas com loteamento sem cadastro", semLot.length, semLot.map((e, i) => `<div class="card" style="padding:12px;box-shadow:none;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><div style="flex:1 1 220px"><b>${esc(e.nome)}</b> <span style="color:var(--mfg);font-size:12px">· ${e.qtd} vendas</span></div><select data-semlot="${i}" style="flex:0 1 260px"><option value="">Corrigir para…</option>${lotList().map(l => `<option value="${esc(l.id)}" ${e.sugestao && e.sugestao.id === l.id ? "selected" : ""}>${esc(l.name)}</option>`).join("")}</select><button class="btn sm pri" data-fixlot="${i}">Corrigir vendas</button></div>`).join(""), "Todas as vendas apontam para um loteamento cadastrado.")}
    ${sec("Corretores nas vendas sem cadastro", semCor.length, semCor.map((e, i) => `<div class="card" style="padding:12px;box-shadow:none;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><div style="flex:1 1 220px"><b>${esc(e.nome)}</b> <span style="color:var(--mfg);font-size:12px">· ${e.qtd} vendas</span></div><select data-semcor="${i}" style="flex:0 1 260px"><option value="">Corrigir para…</option>${[...st.usuarios.values()].filter(u => !u.deleted_at && u.role === "corretor").sort((a, b) => (a.war_name || a.name || "").localeCompare(b.war_name || b.name || "", "pt-BR")).map(u => `<option value="${esc(u.id)}" ${e.sugestao && e.sugestao.id === u.id ? "selected" : ""}>${esc(u.war_name || u.name)}</option>`).join("")}</select><button class="btn sm pri" data-fixcor="${i}">Corrigir vendas</button></div>`).join(""), "Todos os corretores das vendas estão cadastrados.")}
    </div>`;
}
const Duplicados = {
  html: () => `<div id="dupRoot"></div>`,
  bind(){
    $("#main").onchange = e => { const r = e.target.closest("[data-dsel]"); if (r) DUP.sel[r.dataset.dsel] = r.value; };
    $("#main").onclick = e => {
      const b = e.target.closest("[data-mesclar]");
      if (b){ const tipo = b.dataset.mesclar, i = +b.dataset.i, G = tipo === "lot" ? dupLots() : dupClientes(), g = G[i]; if (!g) return; const keepId = DUP.sel[tipo + i] || g[0].id, keep = g.find(x => x.id === keepId), drops = g.filter(x => x.id !== keepId);
        if (b.dataset.ok !== "1"){ b.dataset.ok = "1"; b.textContent = `Confirmar: manter “${keep.name}”`; b.classList.add("danger"); return; }
        if (tipo === "lot"){ const r = mesclarLots(keep, drops); toast(`Loteamentos mesclados · ${r.nv} vendas e ${r.nm} arquivos movidos`); }
        else { const n = mesclarClientes(keep, drops); toast(`Clientes mesclados${n ? ` · ${n} vendas atualizadas` : ""}`); }
        delete DUP.sel[tipo + i]; return Duplicados.update(); }
      const fl = e.target.closest("[data-fixlot]"); if (fl){ const i = +fl.dataset.fixlot, e2 = lotesSemCadastro()[i], id = $(`[data-semlot="${i}"]`).value, lot = lotList().find(l => l.id === id); if (!e2 || !lot) return toast("Escolha o loteamento correto."); const n = renomearLoteVendas(e2.nome, lot); toast(`${n} vendas corrigidas para ${lot.name}`); return Duplicados.update(); }
      const fc = e.target.closest("[data-fixcor]"); if (fc){ const i = +fc.dataset.fixcor, e2 = corretoresSemCadastro()[i], id = $(`[data-semcor="${i}"]`).value, u = st.usuarios.get(id); if (!e2 || !u) return toast("Escolha o corretor correto."); const n = renomearCorretorVendas(e2.nome, u); toast(`${n} vendas corrigidas para ${u.war_name || u.name}`); return Duplicados.update(); }
    };
  },
  update(){ const r = $("#dupRoot"); if (r) r.innerHTML = dupHTML(); }
};
if (typeof TABS !== "undefined" && typeof VIEWS !== "undefined"){
  const i = TABS.findIndex(t => t[0] === "auditoria");
  TABS.splice(i >= 0 ? i + 1 : TABS.length, 0, ["duplicados", "Duplicados"]);
  VIEWS.duplicados = Duplicados;
}

/* =================== REGRAS DE COMISSÃO POR LOTEAMENTO =================== */
// chave = nome do loteamento só com letras e números (minúsculas, sem acento)
const REGRAS_COM = {
  goldenvilleguaiuba: {base: "financed", taxa: 4, nota: "Golden Ville Guaiúba: comissão de 4% sobre o valor financiado (valor do lote − entrada)."}
};
const regraCom = nome => { const k = lotKey(nome || ""); if (!k) return null; if (REGRAS_COM[k]) return REGRAS_COM[k]; const hit = Object.keys(REGRAS_COM).find(x => k.startsWith(x)); return hit ? REGRAS_COM[hit] : null; };
const moeda = v => N(v) ? N(v).toLocaleString("pt-BR", {minimumFractionDigits: 2, maximumFractionDigits: 2}) : "";
function aplicarRegraCom(forcar){
  if (!F || (F.id && !forcar)) return;
  const r = regraCom(F.property_name), box = $("#sfRegra");
  if (!r){ if (box) box.remove(); return; }
  F.commission_base = r.base; F.commission_rate = r.taxa; F._manualComm = false;
  if (r.base === "financed" && !N(F.financed_value) && N(F.sale_value)){ F.financed_value = +(N(F.sale_value) - N(F.entrada)).toFixed(2); F._finAuto = true; }
  const set = (id, v) => { const el = $(id); if (el) el.value = v; };
  set("#sf_commission_base", r.base); set("#sf_commission_rate", String(r.taxa).replace(".", ",")); set("#sf_financed_value", moeda(F.financed_value));
  const im = $("#sf_quadra") && $("#sf_quadra").closest(".fs");
  if (im && !box) im.insertAdjacentHTML("beforeend", `<div id="sfRegra" class="alert w" style="margin-top:8px">${esc(r.nota)}</div>`);
  try { calc(); } catch {}
}
function recalcFinanciado(){
  if (!F || !F._finAuto) return; const r = regraCom(F.property_name); if (!r || r.base !== "financed") return;
  F.financed_value = +(N(F.sale_value) - N(F.entrada)).toFixed(2); const el = $("#sf_financed_value"); if (el) el.value = moeda(F.financed_value); try { calc(); } catch {}
}

/* =================== VENDA: cônjuge, origem e observação do cliente =================== */
function registroCliente(nome, cpf){
  const k = norm(nome), c = onlyDigits(cpf), L = isAdmin ? [...st.clientes.values()] : (COR.clientes || []);
  return L.find(x => !x.deleted_at && ((c.length === 11 && onlyDigits(x.cpf) === c) || (k && norm(x.name) === k))) || null;
}
if (typeof openSaleForm === "function"){
  const _osf = openSaleForm;
  openSaleForm = function(init){
    const r = _osf.apply(this, arguments);
    try {
      const anchor = $("#sf_client_birthdate"); if (!anchor || !F) return r;
      const fs = anchor.closest(".fs"); if (!fs || fs.querySelector(".cx")) return r;
      const reg = registroCliente(F.client_name, F.client_cpf) || {};
      const val = {has_spouse: F.client_has_spouse ?? !!reg.has_spouse, spouse: F.client_spouse || reg.spouse || null, origin: F.client_origin ?? (reg.origin || ""), notes: F.client_notes ?? (reg.notes || "")};
      const aplica = v => { F.client_has_spouse = !!v.has_spouse; F.client_spouse = v.has_spouse ? (v.spouse || {}) : null; F.client_origin = v.origin || ""; F.client_notes = v.notes || ""; };
      aplica(val);
      fs.insertAdjacentHTML("beforeend", blocoExtrasCliente(val));
      ligarExtras(fs.querySelector(".cx"), val, aplica);
      const pn = $("#sf_property_name"); if (pn){ const ap = () => setTimeout(() => aplicarRegraCom(false), 0); pn.addEventListener("change", ap); pn.addEventListener("input", ap); }
      ["#sf_sale_value", "#sf_entrada"].forEach(id => { const el = $(id); if (el) el.addEventListener("input", () => setTimeout(recalcFinanciado, 0)); });
      const fin = $("#sf_financed_value"); if (fin) fin.addEventListener("input", () => { F._finAuto = false; });
      setTimeout(() => aplicarRegraCom(false), 0);
      const nm = $("#sf_client_name"); if (nm) nm.addEventListener("change", () => { const rg = registroCliente(nm.value, $("#sf_client_cpf") && $("#sf_client_cpf").value); if (!rg) return; const v2 = {has_spouse: !!rg.has_spouse, spouse: rg.spouse || null, origin: rg.origin || "", notes: rg.notes || ""}; aplica(v2); const cx = fs.querySelector(".cx"); cx.outerHTML = blocoExtrasCliente(v2); ligarExtras(fs.querySelector(".cx"), v2, aplica); });
    } catch (e){ console.warn("extras cliente", e); }
    return r;
  };
}
// gestor: ao salvar a venda, guarda cônjuge/origem/observação no cadastro do cliente
function salvarClienteDaVenda(V){
  const name = String(V.client_name || "").trim(); if (!name || !(V.client_has_spouse || V.client_origin || V.client_notes)) return;
  const cur = registroCliente(name, V.client_cpf);
  const doc = {...(cur || {id: rid("client"), created_at: nowISO()}), name: cur ? cur.name : name, name_key: norm(cur ? cur.name : name),
    phone: (cur && cur.phone) || V.client_phone || "", email: (cur && cur.email) || V.client_email || "", cpf: (cur && cur.cpf) || V.client_cpf || "", cpf_key: onlyDigits((cur && cur.cpf) || V.client_cpf), birthdate: (cur && cur.birthdate) || V.client_birthdate || "",
    has_spouse: !!V.client_has_spouse, spouse: V.client_has_spouse ? (V.client_spouse || {}) : null, origin: V.client_origin || "", notes: V.client_notes || ""};
  if (cur && JSON.stringify({...cur, updated_at: 0}) === JSON.stringify({...doc, updated_at: 0})) return;
  saveDoc("clientes", doc);
}

/* =================== CORRETOR =================== */
function prepararDadosCorretor(){
  for (const l of (PUB.lots || [])) if (!st.loteamentos.has(l.id)) st.loteamentos.set(l.id, {id: l.id, name: l.name});
  const eq = COR.eq || {};
  for (const x of eq.itens || []) st.corretores.set("eq:" + norm(x.nome), {id: "eq:" + norm(x.nome), war_name: x.nome});
  const it = {}; for (const [k, v] of Object.entries(eq.regras || {})) it[k] = v;
  st.config.set("regras_lot", {id: "regras_lot", itens: it});
  for (const c of COR.clientes || []) st.clientes.set(c.id, c);
}
async function carregarClientes(){ try { COR.clientes = (await corAPI({acao: "clientes"})).clientes || []; } catch { COR.clientes = COR.clientes || []; } return COR.clientes; }
function meusClientes(){
  const m = new Map();
  for (const c of COR.clientes || []) m.set(norm(c.name), {nome: c.name, fone: c.phone, email: c.email, reg: c, compras: []});
  for (const v of (PORTAL && PORTAL.vendas) || []){ const n = (v.client_name || "").trim(); if (!n) continue; const k = norm(n), e = m.get(k) || {nome: n, fone: v.client_phone || "", compras: []}; if (!e.fone) e.fone = v.client_phone || ""; e.compras.push(v); m.set(k, e); }
  return [...m.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
async function abrirFormVenda(init){
  prepararDadosCorretor();
  const eu = (PORTAL && PORTAL.nome) || "";
  const base = init || {property_name: "", quadra: "", lote: "", client_name: "", client_phone: "", client_email: "", client_cpf: "", client_birthdate: "", sale_date: T, sale_value: 0, financed_value: 0, commission_base: "sale", commission_rate: 0, commission_value: 0, broker_split: 60, brokers: [{name: eu, split_pct: 100}], discounts: [], entrada: 0, parcelado: false, installments: [], commission_received: false, notes: ""};
  canWrite = true; try { openSaleForm(base); } finally { canWrite = false; }
  const f = $("#saleForm"); if (!f) return; f.dataset.cor = "1";
  const dl = $("#dlClients"); if (dl) dl.innerHTML = meusClientes().map(c => `<option value="${esc(c.nome)}">`).join("");
  const editando = !!(init && init.id);
  const p = f.querySelector(".dh p"); if (p) p.textContent = editando ? "Confira as alterações antes de salvar. Os corretores da venda só o gestor muda." : "Confira os dados antes de salvar.";
  if (editando){ $$("#brList input").forEach(i => i.disabled = true); const a = $("#addBr"); if (a) a.hidden = true; $$("#brList [data-rmb]").forEach(b => b.remove()); }
  else { const first = $('#brList [data-bi="0"][data-k="name"]'); if (first){ first.readOnly = true; first.title = "Você é sempre um dos corretores da venda."; } }
}
// "Preencher com IA" também para o corretor: lê proposta, contrato ou print e abre o formulário já preenchido
if (typeof openSaleAI === "function"){
  const _osai = openSaleAI;
  openSaleAI = function(){
    aiFileModal({title: "Preencher venda com IA", sub: "Envie a proposta, o contrato ou um print da conversa. O formulário é preenchido para você conferir antes de salvar.", run: async file => {
      const {data} = await aiFromFile(file, `Extraia os dados de UMA venda de lote deste arquivo (proposta, contrato ou print) e devolva SOMENTE um JSON neste formato (use "" ou 0 quando não houver):\n${SALE_JSON.replace('"entrada": 0,', '"entrada": 0, "financed_value": 0,')}\nDatas em AAAA-MM-DD. Valores em reais como número (ex.: 20405.5). sale_value é o VALOR DO LOTE (valor total da proposta). financed_value é o valor financiado/parcelado (valor do lote menos a entrada), se aparecer. commission_rate é o percentual de comissão, se houver.`, {modelTier: "default"});
      const raw = Array.isArray(data) ? data[0] || {} : data || {}, x = normAISale(raw), fin = parseMoney(String(raw.financed_value ?? "")) || 0;
      $("#dlg").close();
      await (isAdmin ? (o => openSaleForm(o)) : abrirFormVenda)({property_name: x.property_name, quadra: x.quadra, lote: x.lote, client_name: x.client_name, client_phone: x.client_phone, client_email: x.client_email, client_cpf: x.client_cpf, client_birthdate: x.client_birthdate, sale_date: x.sale_date || T, sale_value: x.sale_value, financed_value: fin, commission_base: "sale", commission_rate: x.commission_rate, commission_value: x.commission_value, broker_split: 60, brokers: [{name: isAdmin ? x.broker_name : ((PORTAL && PORTAL.nome) || ""), split_pct: 100}], discounts: [], entrada: x.entrada, parcelado: false, installments: [], commission_received: false, notes: x.notes});
      toast("Confira os dados preenchidos pela IA antes de salvar");
    }});
  };
}
if (typeof fillClient === "function"){
  const _fill = fillClient;
  fillClient = function(name){
    if (isAdmin) return _fill.apply(this, arguments);
    const k = norm(name); if (!k) return; const c = meusClientes().find(x => norm(x.nome) === k); if (!c) return;
    const r = c.reg || {}, v = (c.compras || [])[0] || {};
    const pick = (fs, fc) => F[fs] || r[fc] || v[fs] || "";
    F.client_phone = pick("client_phone", "phone"); F.client_email = pick("client_email", "email"); F.client_cpf = pick("client_cpf", "cpf"); F.client_birthdate = pick("client_birthdate", "birthdate");
    for (const f of ["client_phone", "client_email", "client_cpf", "client_birthdate"]){ const el = $("#sf_" + f); if (el) el.value = F[f] || ""; }
  };
}
if (typeof submitSale === "function"){
  const _submit = submitSale;
  submitSale = async function(editing){
    if (isAdmin || !$("#saleForm") || !$("#saleForm").dataset.cor){ const V = F, r = _submit.apply(this, arguments); try { if (isAdmin && !$("#dlg").open) salvarClienteDaVenda(V); } catch (e){ console.warn(e); } return r; }
    const err = [], warn = h => { $("#warn").innerHTML = h; $("#warn").scrollIntoView({block: "nearest"}); };
    if (!String(F.property_name || "").trim()) err.push("Informe o loteamento.");
    if (!F.sale_date) err.push("Informe a data da venda.");
    if (!(N(F.sale_value) > 0)) err.push("Informe o valor da venda.");
    const brokers = F.brokers.filter(b => String(b.name || "").trim());
    if (!editing && brokers.length > 1 && Math.abs(brokers.reduce((a, b) => a + N(b.split_pct), 0) - 100) > 0.01) err.push("A divisão entre os corretores deve somar 100%.");
    if (F.commission_base === "financed" && !(N(F.financed_value) > 0)) err.push("Preencha o valor financiado.");
    if (F.parcelado && !F.installments.length) err.push("Gere as parcelas da comissão.");
    const ano = +String(F.sale_date || "").slice(0, 4), hoje = +T.slice(0, 4);
    if (ano && (ano < hoje - 1 || ano > hoje)) err.push(`Confira a data da venda (ano ${ano}).`);
    if (err.length) return warn(`<div class="alert e">${err.map(esc).join("<br>")}</div>`);
    const btn = $("#sfSave"); btn.disabled = true; const lbl = btn.textContent; btn.textContent = "Salvando…";
    try {
      const venda = {...F, brokers}; delete venda._manualComm; delete venda._force;
      const r = await corAPI({acao: "venda", venda, confirmar: !!F._force});
      $("#dlg").close(); toast(editing ? "Venda atualizada" : "Venda cadastrada! O gestor foi avisado.");
      if (!editing && typeof openCelebration === "function") setTimeout(() => { try { openCelebration(r.venda); } catch {} }, 250);
    } catch (e){
      btn.disabled = false; btn.textContent = lbl;
      if (e.status === 409 && e.j && e.j.confirmar){ F._force = true; btn.textContent = "Salvar mesmo assim"; return warn(`<div class="alert w">${esc(e.message)}<br><b>Clique em salvar de novo para confirmar mesmo assim.</b></div>`); }
      warn(`<div class="alert e">${esc(e.message)}</div>`);
    }
  };
}
function formCliente(c){
  c = c || {name: "", phone: "", email: "", cpf: "", birthdate: "", origin: "", notes: ""};
  const EXT = {has_spouse: !!c.has_spouse, spouse: c.spouse || null, origin: c.origin || "", notes: c.notes || ""};
  setTimeout(() => { const cx = $("#dlg .cx"); if (cx) ligarExtras(cx, EXT, () => {}); }, 0);
  modal(`<form class="dlg" novalidate style="max-width:560px"><div class="dh"><div style="flex:1"><h2>${c.id ? "Editar cliente" : "Novo cliente"}</h2><p>Fica na sua carteira. O gestor também vê.</p></div><button type="button" class="btn icon" data-x aria-label="Fechar">✕</button></div>
    <div class="db"><div class="g">
      <label class="f" style="grid-column:1/-1">Nome *<input type="text" name="name" value="${esc(c.name)}" required></label>
      <label class="f">Telefone<input type="tel" name="phone" value="${esc(c.phone)}"></label>
      <label class="f">E-mail<input type="email" name="email" value="${esc(c.email)}"></label>
      <label class="f">CPF<input type="text" name="cpf" value="${esc(c.cpf)}"></label>
      <label class="f">Nascimento<input type="date" name="birthdate" value="${esc(String(c.birthdate || "").slice(0, 10))}"></label>
</div>
      ${blocoExtrasCliente(c)}<div id="cfWarn"></div></div>
    <div class="df"><button type="button" class="btn" data-x>Cancelar</button><button class="btn pri">Salvar</button></div></form>`, async (fd, f) => {
      const name = fv(fd, "name"); if (!name) return $("#cfWarn").innerHTML = `<div class="alert e">Informe o nome.</div>`;
      const cpf = onlyDigits(fv(fd, "cpf"));
      if (!c.id){ const ex = meusClientes().find(x => norm(x.nome) === norm(name) || (cpf.length === 11 && x.reg && onlyDigits(x.reg.cpf) === cpf)); if (ex && ex.reg) return $("#cfWarn").innerHTML = `<div class="alert w">Você já tem o cliente <b>${esc(ex.nome)}</b> com este nome ou CPF.</div>`; }
      const b = f.querySelector("button.pri"); b.disabled = true;
      try { await corAPI({acao: "cliente", cliente: {...c, name, phone: fv(fd, "phone"), email: fv(fd, "email"), cpf: fv(fd, "cpf"), birthdate: fv(fd, "birthdate"), has_spouse: !!EXT.has_spouse, spouse: EXT.has_spouse ? (EXT.spouse || {}) : null, origin: EXT.origin || "", notes: EXT.notes || ""}}); $("#dlg").close(); toast("Cliente salvo"); await carregarClientes(); if (ui.tab === "clientesC") renderCorretor(); }
      catch (e){ b.disabled = false; $("#cfWarn").innerHTML = `<div class="alert e">${esc(e.message)}</div>`; }
    });
}
function telaClientes(){
  const L = meusClientes().filter(c => !COR.cliQ || norm(c.nome + " " + (c.fone || "")).includes(norm(COR.cliQ)));
  return `<div class="pagehead"><div><h1>Meus clientes</h1><p>${L.length} clientes · das suas vendas e da sua carteira</p></div><button class="btn pri" data-novocli>+ Novo cliente</button></div>
    <section class="card"><div class="bd"><input type="search" id="cliQ" placeholder="Buscar por nome ou telefone" value="${esc(COR.cliQ)}" style="width:100%;margin-bottom:10px">
    ${L.length ? `<div class="tablewrap"><table><thead><tr><th>Cliente</th><th>Telefone</th><th>Compras</th><th></th></tr></thead><tbody>${L.map(c => `<tr><td><b>${esc(c.nome)}</b>${c.reg ? "" : `<span class="s">só nas vendas</span>`}</td><td>${esc(fmtPhone(c.fone) || "—")}</td><td>${c.compras.length ? c.compras.slice(0, 3).map(v => esc(`${v.property_name} Q${v.quadra || "-"} L${v.lote || "-"}`)).join("<br>") : "—"}</td><td class="r" style="white-space:nowrap">${waLink(c.fone) ? `<a class="btn sm" href="${esc(waLink(c.fone))}" target="_blank" rel="noopener">WhatsApp</a> ` : ""}${c.reg ? `<button class="btn sm" data-editcli="${esc(c.reg.id)}">Editar</button>` : `<button class="btn sm" data-addcli="${esc(c.nome)}">Cadastrar</button>`}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">Nenhum cliente ainda. Cadastre o primeiro.</div>`}</div></section>`;
}
function statusParcela(i, v){ if (i.received) return ["Recebida", "p-ok"]; if (i.parcial > 0) return ["Parcial", "p-warn"]; if (!i.avista && N(v.venc) > 0 && (i.due_date || "") < T) return ["Vencida", "p-bad"]; return ["A receber", "p-gold"]; }
async function marcarRecebida(b){
  const ok = b.dataset.ok === "1";
  if (!b.dataset.conf){ b.dataset.conf = "1"; b.textContent = ok ? "Confirmar recebimento" : "Confirmar desmarcar"; b.classList.add(ok ? "pri" : "danger"); return; }
  b.disabled = true; b.textContent = "Salvando…";
  try {
    await corAPI({acao: "receber", id: b.dataset.receber, parcela: +b.dataset.parc || 0, recebida: ok});
    const v = ((PORTAL && PORTAL.vendas) || []).find(x => x.id === b.dataset.receber);
    if (v){ const n = +b.dataset.parc; if (n && v.installments){ const i = v.installments.find(x => x.number === n); if (i){ i.received = ok; i.received_date = ok ? T : null; } v.rec = v.installments.reduce((a, x) => a + (x.received ? N(x.value) : 0), 0); } else { v.commission_received = ok; v.rec = ok ? v.comm : 0; } }
    toast(ok ? "Marcado como recebido. O gestor foi avisado." : "Recebimento desmarcado."); renderCorretor();
  } catch (e){ toast(e.message); b.disabled = false; b.textContent = ok ? "Recebi" : "Desmarcar"; delete b.dataset.conf; }
}
function telaFinanceiro(){
  const V = ((PORTAL && PORTAL.vendas) || []).filter(v => !v.cancelled), rows = [];
  for (const v of V){
    if (v.installments && v.installments.length) v.installments.forEach(i => rows.push({v, num: i.number, due: i.due_date, valor: N(i.value), pago: i.received ? N(i.value) : N(i.parcial), st: statusParcela(i, v), n: v.installments.length === 1 && i.due_date === v.sale_date ? "à vista" : `${i.number}/${v.installments.length}`}));
    else rows.push({v, due: v.sale_date, valor: N(v.comm), pago: v.commission_received ? N(v.comm) : N(v.rec), st: (v.commission_received || (v.rec >= v.comm - .01 && v.comm)) ? ["Recebida", "p-ok"] : v.rec > 0 ? ["Parcial", "p-warn"] : ["A receber", "p-gold"], n: "à vista"});
  }
  const m = ui.month, y = ui.year, noPer = r => (!y || String(r.due || "").startsWith(String(y))) && (!m || +String(r.due || "").slice(5, 7) === m);
  const P = rows.filter(r => noPer(r) && (r.valor > 0.005 || r.pago > 0.005)), f = COR.finFiltro;
  const L = P.filter(r => f === "todas" || (f === "abertas" && r.st[0] !== "Recebida") || (f === "vencidas" && r.st[0] === "Vencida") || (f === "recebidas" && r.st[0] === "Recebida")).sort((a, b) => (a.due || "").localeCompare(b.due || ""));
  const tot = P.reduce((a, r) => ({total: a.total + r.valor, rec: a.rec + r.pago, venc: a.venc + (r.st[0] === "Vencida" ? r.valor - r.pago : 0)}), {total: 0, rec: 0, venc: 0});
  return `<div class="pagehead"><div><h1>Meu financeiro</h1><p>${esc(periodLabel())} · parcelas da sua comissão pelo vencimento</p></div></div>
    <section class="kpis">${[["Minha comissão no período", brl(tot.total), "var(--gold)"], ["Já recebi", brl(tot.rec), "var(--ok)"], ["Falta receber", brl(tot.total - tot.rec), "var(--warn)"], ["Vencido", brl(tot.venc), "var(--bad)"]].map(([l, v, c]) => `<div class="card kpi" style="--c:${c}"><span class="lbl"><i class="dot"></i>${l}</span><span class="val num">${v}</span></div>`).join("")}</section>
    <section class="card"><div class="bd"><div class="toolbar" style="margin-bottom:10px">${[["abertas", "A receber"], ["vencidas", "Vencidas"], ["recebidas", "Recebidas"], ["todas", "Todas"]].map(([k, l]) => `<button class="btn sm ${f === k ? "pri" : ""}" data-fin="${k}">${l}</button>`).join("")}</div>
    ${L.length ? `<div class="tablewrap"><table><thead><tr><th>Vencimento</th><th>Venda</th><th>Parcela</th><th class="r">Minha parte</th><th class="r">Recebido</th><th>Status</th><th></th></tr></thead><tbody>${L.map(r => `<tr data-v="${esc(r.v.id)}" style="cursor:pointer"><td class="num">${dBR(r.due)}</td><td><b>${esc(r.v.property_name)}</b><span class="s">Q ${esc(r.v.quadra) || "–"} · L ${esc(r.v.lote) || "–"} · ${esc(r.v.client_name) || "—"}</span></td><td>${esc(r.n)}</td><td class="r num">${brl(r.valor)}</td><td class="r num">${brl(r.pago)}</td><td><span class="pill ${r.st[1]}">${r.st[0]}</span></td><td class="r">${r.v.avulsa ? "" : `<button class="btn sm ${r.st[0] === "Recebida" ? "" : "pri"}" data-receber="${esc(r.v.id)}" data-parc="${r.num || 0}" data-ok="${r.st[0] === "Recebida" ? 0 : 1}">${r.st[0] === "Recebida" ? "Desmarcar" : "Recebi"}</button>`}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">Nada neste filtro e período.</div>`}
    <p style="color:var(--mfg);font-size:12px;margin:10px 0 0">Ao marcar “Recebi”, o gestor é avisado e a baixa fica registrada na Auditoria. Vendas recém-cadastradas aparecem com valores estimados até o gestor abrir o sistema.</p></div></section>`;
}
/* ---------- Minha agenda (corretor) ---------- */
const AG = () => (window.BIA && BIA.D) ? BIA.D : null;
async function agendaCarregar(forcar){ const D2 = AG(); if (!D2) return []; if (forcar) BIA.agendaLoaded = false; await D2.loadAgenda(); return D2.agendaItems(); }
const agItens = () => { const D2 = AG(); return D2 ? D2.agendaItems() : []; };
function formTarefa(a){
  a = a || {title: "", type: "visita", when: T + "T09:00", client_name: "", lot: "", notes: ""};
  const dt = String(a.when || "").slice(0, 10), hr = String(a.when || "").slice(11, 16) || "09:00";
  modal(`<form class="dlg" novalidate style="max-width:520px"><div class="dh"><div style="flex:1"><h2>${a.id ? "Editar tarefa" : "Nova tarefa"}</h2></div><button type="button" class="btn icon" data-x aria-label="Fechar">✕</button></div>
    <div class="db"><div class="g">
      <label class="f" style="grid-column:1/-1">Título *<input type="text" name="title" value="${esc(a.title)}" placeholder="ex.: Visita com João no Golden Ville" required></label>
      <label class="f">Tipo<select name="type">${Object.entries(ATYPE).map(([k, l]) => `<option value="${k}" ${a.type === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="f">Data *<input type="date" name="d" value="${esc(dt)}" required></label>
      <label class="f">Hora<input type="time" name="h" value="${esc(hr)}"></label>
      <label class="f">Cliente<input type="text" name="client_name" list="dlAgCli" value="${esc(a.client_name || "")}"></label>
      <label class="f" style="grid-column:1/-1">Loteamento<input type="text" name="lot" list="dlAgLot" value="${esc(a.lot || "")}"></label></div>
      <label class="f">Observações<textarea name="notes" rows="3">${esc(a.notes || "")}</textarea></label><div id="agWarn"></div>
      <datalist id="dlAgCli">${meusClientes().map(c => `<option value="${esc(c.nome)}">`).join("")}</datalist><datalist id="dlAgLot">${(PUB.lots || []).map(l => `<option value="${esc(l.name)}">`).join("")}</datalist></div>
    <div class="df">${a.id ? `<button type="button" class="btn danger" data-agdel style="margin-right:auto">Excluir</button>` : ""}<button type="button" class="btn" data-x>Cancelar</button><button class="btn pri">Salvar</button></div></form>`, async (fd, f) => {
      const title = fv(fd, "title"), d = fv(fd, "d"); if (!title || !d) return $("#agWarn").innerHTML = `<div class="alert e">Informe o título e a data.</div>`;
      const b = f.querySelector("button.pri"); b.disabled = true;
      try { await AG().salvarAgenda({...(a.id ? a : {id: rid("appt"), created_at: nowISO(), done: false}), title, type: fv(fd, "type"), when: d + "T" + (fv(fd, "h") || "09:00"), client_name: fv(fd, "client_name"), lot: fv(fd, "lot"), notes: fv(fd, "notes")}); $("#dlg").close(); toast("Tarefa salva"); if (ui.tab === "agendaC") renderCorretor(); agSyncSilencioso(); }
      catch (e){ b.disabled = false; $("#agWarn").innerHTML = `<div class="alert e">${esc(e.message)}</div>`; }
    });
  const del = $("#dlg [data-agdel]"); if (del) del.onclick = async () => { if (!del.dataset.ok){ del.dataset.ok = "1"; del.textContent = "Confirmar exclusão"; return; } try { await AG().salvarAgenda({...a, deleted_at: nowISO()}); $("#dlg").close(); toast("Tarefa excluída"); renderCorretor(); agSyncSilencioso(); } catch (e){ toast(e.message); } };
}
function agSyncSilencioso(){ try { if (GA.st && GA.st.connected) setTimeout(() => gaSincronizar(true), 800); } catch {} }
function telaAgenda(){
  const L = agItens().slice().sort((x, y) => (x.when || "").localeCompare(y.when || "")), hoje = T;
  const atras = L.filter(a => !a.done && (a.when || "").slice(0, 10) < hoje), hj = L.filter(a => !a.done && (a.when || "").slice(0, 10) === hoje), prox = L.filter(a => !a.done && (a.when || "").slice(0, 10) > hoje), feitas = L.filter(a => a.done).reverse().slice(0, 15);
  const fone = n => { const c = meusClientes().find(x => norm(x.nome) === norm(n)); return c && c.fone; };
  const item = a => `<div class="card" style="padding:10px 12px;box-shadow:none;display:flex;gap:10px;align-items:flex-start">
    <input type="checkbox" class="chk" data-agdone="${esc(a.id)}" ${a.done ? "checked" : ""} aria-label="Concluída" style="margin-top:3px">
    <div style="flex:1;min-width:0;${a.done ? "opacity:.6;text-decoration:line-through" : ""}"><b>${esc(a.title)}</b><span style="display:block;color:var(--mfg);font-size:12.5px">${dBR(a.when)}${String(a.when || "").length > 10 ? " · " + String(a.when).slice(11, 16) : ""} · ${esc(ATYPE[a.type] || "Outro")}${a.client_name ? " · " + esc(a.client_name) : ""}${a.lot ? " · " + esc(a.lot) : ""}</span>${a.notes ? `<span style="display:block;font-size:12.5px">${esc(a.notes)}</span>` : ""}</div>
    <span class="toolbar" style="flex:none">${a.client_name && waLink(fone(a.client_name)) ? `<a class="btn sm" href="${esc(waLink(fone(a.client_name)))}" target="_blank" rel="noopener">WhatsApp</a>` : ""}<button class="btn sm" data-agedit="${esc(a.id)}">Editar</button></span></div>`;
  const bloco = (t, arr, cor) => arr.length ? `<section class="card"><div class="hd"><h2>${t} <span class="pill ${cor}">${arr.length}</span></h2></div><div class="bd" style="display:flex;flex-direction:column;gap:8px">${arr.map(item).join("")}</div></section>` : "";
  return `<div class="pagehead"><div><h1>Minha agenda</h1><p>Visitas, retornos e tarefas · ${L.filter(a => !a.done).length} em aberto</p></div><button class="btn pri" data-agnova>+ Nova tarefa</button></div>
    ${typeof gaCard === "function" ? gaCard() : ""}
    <div style="display:flex;flex-direction:column;gap:12px">${bloco("Atrasadas", atras, "p-bad")}${bloco("Hoje", hj, "p-gold")}${bloco("Próximas", prox, "p-mut")}${!atras.length && !hj.length && !prox.length ? `<div class="empty"><b>Nenhuma tarefa em aberto</b>Toque em “+ Nova tarefa” para agendar uma visita ou retorno.</div>` : ""}${bloco("Concluídas recentemente", feitas, "p-ok")}</div>`;
}
// Google Agenda do corretor: as tarefas dele, os vencimentos da comissão dele e os aniversários dos clientes dele
if (typeof gaEventos === "function"){
  const _gaEv = gaEventos;
  gaEventos = function(){
    if (isAdmin) return _gaEv.apply(this, arguments);
    const ev = [];
    for (const a of agItens()){ if (a.deleted_at || a.done || !a.when) continue; const w = String(a.when).slice(0, 16);
      ev.push(w.length > 10 ? {key: "appt" + a.id, titulo: `[Brilhante] ${a.title}`, descricao: [ATYPE[a.type] || a.type, a.client_name ? "Cliente: " + a.client_name : "", a.lot ? "Loteamento: " + a.lot : "", a.notes || ""].filter(Boolean).join("\n"), inicio: w} : {key: "appt" + a.id, titulo: `[Brilhante] ${a.title}`, descricao: a.notes || "", dia: w.slice(0, 10)}); }
    for (const v of ((PORTAL && PORTAL.vendas) || [])){ if (v.cancelled) continue; for (const i of v.installments || []){ if (i.received || i.avista || !i.due_date || i.due_date < T || (v.installments.length === 1 && i.due_date === v.sale_date)) continue;
      ev.push({key: `venc${v.id}-${i.number}`, titulo: `💰 Minha comissão: ${v.property_name} Q${v.quadra || "–"} L${v.lote || "–"} (${brl(i.value)})`, descricao: `Cliente: ${v.client_name || "—"}`, dia: i.due_date}); } }
    const Y = +T.slice(0, 4);
    for (const c of COR.clientes || []){ const b = String(c.birthdate || ""); if (!/^\d{4}-\d{2}-\d{2}/.test(b)) continue; ev.push({key: "bday" + norm(c.name), titulo: `🎂 Aniversário de ${c.name}`, descricao: `Cliente · Brilhante's Imóveis${c.phone ? "\nTelefone: " + fmtPhone(c.phone) : ""}`, dia: `${Y}-${b.slice(5, 10)}`, anual: true}); }
    return ev;
  };
}
if (typeof gaSincronizar === "function"){
  const _gaS = gaSincronizar;
  gaSincronizar = async function(){ if (!isAdmin){ try { await agendaCarregar(false); if (!COR.clientes) await carregarClientes(); } catch {} } return _gaS.apply(this, arguments); };
}

if (typeof bootCorretor === "function"){
  const _boot = bootCorretor, _render = renderCorretor, _openV = openVendaC;
  bootCorretor = async function(){
    const r = await _boot.apply(this, arguments);
    const tabs = $("#tabs");
    if (tabs && !tabs.querySelector('[data-tab="clientesC"]')){ const ref = tabs.querySelector('[data-tab="vendasC"]'); (ref || tabs.lastElementChild).insertAdjacentHTML("afterend", `<button role="tab" data-tab="agendaC" aria-selected="false">Minha agenda</button><button role="tab" data-tab="clientesC" aria-selected="false">Meus clientes</button><button role="tab" data-tab="finC" aria-selected="false">Meu financeiro</button>`); }
    try { db.doc("publico/equipe").onSnapshot(s => { COR.eq = s.exists ? s.data() : null; }, () => {}); } catch {}
    try { db.doc("publico/fotos").onSnapshot(s => { COR.fotos = s.exists ? (s.data().itens || {}) : {}; if (ui.tab === "rankC" || ui.tab === "meu") renderCorretor(); }, () => {}); } catch {}
    carregarClientes();
    return r;
  };
  renderCorretor = function(){
    if (!PORTAL || (ui.tab !== "clientesC" && ui.tab !== "finC" && ui.tab !== "agendaC")){
      const r = _render.apply(this, arguments);
      if (PORTAL) decorar();
      return r;
    }
    if (ui.tab === "agendaC" && !(window.BIA && BIA.agendaLoaded)){ $("#main").innerHTML = `<div class="empty"><b>Carregando sua agenda…</b></div>`; agendaCarregar(false).then(() => { if (ui.tab === "agendaC") renderCorretor(); }); if (!GA.st) gaStatus(); return; }
    $("#main").innerHTML = ui.tab === "clientesC" ? telaClientes() : ui.tab === "finC" ? telaFinanceiro() : telaAgenda();
    if (ui.tab === "agendaC" && !GA.st) gaStatus();
    const q = $("#cliQ"); if (q){ q.oninput = () => { COR.cliQ = q.value; const pos = q.selectionStart; renderCorretor(); const n = $("#cliQ"); if (n){ n.focus(); n.setSelectionRange(pos, pos); } }; }
    $("#main").onclick = e => {
      if (e.target.closest("[data-novocli]")) return formCliente();
      if (e.target.closest("[data-agnova]")) return formTarefa();
      const ae = e.target.closest("[data-agedit]"); if (ae) return formTarefa(agItens().find(a => a.id === ae.dataset.agedit));
      const ad2 = e.target.closest("[data-agdone]"); if (ad2){ const a = agItens().find(x => x.id === ad2.dataset.agdone); if (a) AG().salvarAgenda({...a, done: ad2.checked, done_at: ad2.checked ? nowISO() : null}).then(() => { toast(ad2.checked ? "Tarefa concluída" : "Tarefa reaberta"); renderCorretor(); agSyncSilencioso(); }).catch(err => { toast(err.message); ad2.checked = !ad2.checked; }); return; }
      const ed = e.target.closest("[data-editcli]"); if (ed) return formCliente((COR.clientes || []).find(c => c.id === ed.dataset.editcli));
      const ad = e.target.closest("[data-addcli]"); if (ad){ const c = meusClientes().find(x => x.nome === ad.dataset.addcli) || {}; return formCliente({name: ad.dataset.addcli, phone: c.fone || "", email: "", cpf: "", birthdate: "", origin: "", notes: ""}); }
      const fb = e.target.closest("[data-fin]"); if (fb){ COR.finFiltro = fb.dataset.fin; return renderCorretor(); }
      const rb = e.target.closest("[data-receber]"); if (rb){ e.stopPropagation(); return marcarRecebida(rb); }
      const tr = e.target.closest("tr[data-v]"); if (tr) return openVendaC(((PORTAL && PORTAL.vendas) || []).find(v => v.id === tr.dataset.v));
    };
  };
  function fotoDe(nome){ const F2 = COR.fotos || {}; return F2[norm(nome)] || null; }
  function decorar(){
    if ((ui.tab === "rankC" || ui.tab === "meu") && COR.fotos){
      $$("#main ol.rank li").forEach(li => { const av = li.querySelector(".av"), nm = li.querySelector(".nm"), meta = li.querySelector(".meta"); if (!av || !nm || av.querySelector("img")) return;
        const label = nm.textContent.replace(/\s*\(você\)\s*$/, ""), membros = meta ? meta.textContent.split(" & ") : [];
        if (membros.length >= 2) avatarDupla(li, membros, fotoDe); else { const f = fotoDe(label); if (f) av.innerHTML = `<img alt="" src="${esc(f)}">`; }
        if (PORTAL && membros.some(m => norm(m) === norm(PORTAL.nome)) && !/\(você\)/.test(nm.textContent)){ nm.insertAdjacentText("beforeend", " (você)"); li.style.background = "var(--goldbg)"; li.style.borderRadius = "8px"; } });
    }
    const head = $("#main .pagehead");
    if (ui.tab === "meu" && head && COR.fotos && !head.querySelector(".av")){ const f = fotoDe(PORTAL.nome); if (f){ head.style.alignItems = "center"; head.insertAdjacentHTML("afterbegin", `<span class="av" style="width:56px;height:56px;flex:none"><img alt="" src="${esc(f)}"></span>`); } }
    if ((ui.tab === "vendasC" || ui.tab === "meu") && head && !head.querySelector("[data-novavenda]")){ head.insertAdjacentHTML("beforeend", `<button class="btn pri" data-novavenda>+ Nova venda</button>`); head.querySelector("[data-novavenda]").onclick = async () => { try { await abrirFormVenda(); if (!$("#saleForm")) throw new Error("o formulário não carregou"); } catch (e){ console.error(e); toast("Não consegui abrir o formulário: " + (e && e.message || e) + ". Atualize a página e tente de novo."); } }; }
    if (ui.tab === "lotsC" && head && !$("#lotQ")){
      head.insertAdjacentHTML("afterend", `<input type="search" id="lotQ" placeholder="Pesquisar loteamento, cidade ou bairro" value="${esc(COR.lotQ)}" style="width:100%;margin:0 0 12px">`);
      const filtrar = () => { const q = norm(COR.lotQ); let n = 0; $$("#main [data-lc]").forEach(b => { const l = (PUB.lots || []).find(x => x.id === b.dataset.lc) || {}, loc = ((l.specs || {}).localizacao) || {}; const ok = !q || norm([l.name, loc.cidade, loc.bairro].join(" ")).includes(q); b.hidden = !ok; if (ok) n++; }); const p = $("#main .pagehead p"); if (p) p.textContent = q ? `${n} de ${(PUB.lots || []).length} loteamentos` : `${(PUB.lots || []).length} loteamentos · fichas, fotos, documentos e copys`; };
      $("#lotQ").oninput = e => { COR.lotQ = e.target.value; filtrar(); }; filtrar();
    }
  }
  openVendaC = function(v){
    const r = _openV.apply(this, arguments);
    if (!v || isAdmin) return r;
    const db2 = $("#sheet .db"); if (!db2) return r;
    if (v.avulsa) return r;
    const ok = podeEditar(v);
    db2.insertAdjacentHTML("afterbegin", `<div class="toolbar" data-acoesv>${ok ? `<button class="btn pri sm" data-editarvenda>Editar venda</button>` : ""}<button class="btn sm" data-duplicar>Duplicar (outro lote)</button>${ok ? `<button class="btn sm danger" data-excluirv>Excluir venda</button>` : ""}</div>`);
    db2.insertAdjacentHTML("beforeend", `<div class="fs" data-anexos><h3>Anexos</h3><p style="margin:0;color:var(--mfg)">Carregando…</p></div>`);
    const ler = () => corAPI({acao: "venda_ler", id: v.id});
    const b = db2.querySelector("[data-editarvenda]");
    if (b) b.onclick = async () => { b.disabled = true; b.textContent = "Abrindo…"; try { const j = await ler(); if (!j.pode_editar){ toast("Esta venda não pode mais ser editada. Fale com o gestor."); return; } $("#sheet").close(); abrirFormVenda(j.venda); } catch (e){ toast(e.message); } finally { b.disabled = false; b.textContent = "Editar venda"; } };
    const du = db2.querySelector("[data-duplicar]");
    du.onclick = async () => { du.disabled = true; try { const j = await ler(); $("#sheet").close(); await abrirFormVenda(copiaVenda(j.venda, (PORTAL && PORTAL.nome) || "")); toast("Venda duplicada: preencha a quadra e o lote do novo lote"); setTimeout(() => { const q = $("#sf_quadra"); if (q) q.focus(); }, 300); } catch (e){ toast(e.message); } finally { du.disabled = false; } };
    const ex = db2.querySelector("[data-excluirv]");
    if (ex) ex.onclick = async () => { if (!ex.dataset.ok){ ex.dataset.ok = "1"; ex.textContent = "Confirmar exclusão"; return; } ex.disabled = true; try { await corAPI({acao: "venda_excluir", id: v.id}); if (PORTAL) PORTAL.vendas = (PORTAL.vendas || []).filter(x => x.id !== v.id); $("#sheet").close(); toast("Venda excluída. O gestor foi avisado."); renderCorretor(); } catch (e){ ex.disabled = false; toast(e.message); } };
    ler().then(j => pintarAnexos(db2.querySelector("[data-anexos]"), j.venda, j.eu)).catch(() => { const a = db2.querySelector("[data-anexos] p"); if (a) a.textContent = "Não foi possível carregar os anexos."; });
    return r;
  };
}
function copiaVenda(s, eu){
  const c = {}; for (const k of ["property_name", "client_name", "client_phone", "client_email", "client_cpf", "client_birthdate", "client_has_spouse", "client_spouse", "client_origin", "client_notes", "sale_date", "sale_value", "financed_value", "entrada", "commission_base", "commission_rate", "commission_value", "broker_split", "discounts", "notes"]) c[k] = structuredClone(s[k] ?? (k === "discounts" ? [] : ""));
  const bs = (s.brokers && s.brokers.length ? s.brokers : [{name: eu || s.broker_name, split_pct: 100}]).map(b => ({name: b.name, split_pct: N(b.split_pct)}));
  return {...c, quadra: "", lote: "", brokers: isAdmin ? bs : (bs.some(b => norm(b.name) === norm(eu)) ? bs : [{name: eu, split_pct: 100}]), parcelado: !!(s.installments || []).length, installments: (s.installments || []).map(i => ({number: i.number, due_date: i.due_date, value: i.value, received: false, received_date: null})), commission_received: false};
}
const KIND_ANEXO = {contrato: "Contrato", proposta: "Proposta", comprovante: "Comprovante", documento: "Documento do cliente", outro: "Outro"};
function pintarAnexos(box, s, eu){
  if (!box) return; const L = (s.attachments || []).filter(a => !a.deleted_at);
  box.innerHTML = `<h3>Anexos (${L.length})</h3>${L.map(a => `<div class="inst" style="grid-template-columns:minmax(0,1fr) auto"><div><b>${esc(a.name)}</b><span class="s" style="display:block;color:var(--mfg);font-size:12px">${esc(KIND_ANEXO[a.kind] || "Arquivo")} · ${dBR(a.at)}${a.by ? " · " + esc(a.by) : ""}</span></div><span class="toolbar"><a class="btn sm" href="/_blob/${esc(a.asset_id)}" target="_blank" rel="noopener">Abrir</a>${a.by_id && a.by_id === eu ? `<button class="btn sm danger" data-rmanexo="${esc(a.id)}">Remover</button>` : ""}</span></div>`).join("") || `<p style="margin:0;color:var(--mfg)">Nenhum anexo ainda.</p>`}
    <div class="toolbar" style="margin-top:6px"><select data-anexokind aria-label="Tipo de anexo">${Object.entries(KIND_ANEXO).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select><label class="btn sm pri">Anexar arquivo<input type="file" data-anexofile accept="application/pdf,image/*,.xlsx,.xls,.csv,.txt,.doc,.docx" hidden></label><span data-anexomsg style="color:var(--mfg);font-size:12px">PDF, foto ou planilha</span></div>`;
  box.querySelector("[data-anexofile]").onchange = async e => { const f = e.target.files[0]; if (!f) return; const msg = box.querySelector("[data-anexomsg]");
    try { msg.textContent = "Enviando…"; await enviarAnexo(s.id, f, box.querySelector("[data-anexokind]").value); toast("Arquivo anexado. O gestor foi avisado."); const j = await corAPI({acao: "venda_ler", id: s.id}); pintarAnexos(box, j.venda, j.eu); }
    catch (err){ msg.textContent = err.message; } };
  box.querySelectorAll("[data-rmanexo]").forEach(b => b.onclick = async () => { if (!b.dataset.ok){ b.dataset.ok = "1"; b.textContent = "Confirmar"; return; } try { await corAPI({acao: "anexo_rm", id: s.id, anexo: b.dataset.rmanexo}); const j = await corAPI({acao: "venda_ler", id: s.id}); pintarAnexos(box, j.venda, j.eu); } catch (e){ toast(e.message); } });
}
async function reduzirImagem(file){
  if (!/^image\/(jpeg|png|webp|heic)/i.test(file.type) || file.size < 1.5e6) return file;
  try { const bmp = await createImageBitmap(file), z = Math.min(1, 2000 / Math.max(bmp.width, bmp.height)), c = document.createElement("canvas"); c.width = Math.round(bmp.width * z); c.height = Math.round(bmp.height * z); c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(ok => c.toBlob(ok, "image/jpeg", .82)); return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", {type: "image/jpeg"}) : file; } catch { return file; }
}
async function enviarAnexo(id, file, kind){
  file = await reduzirImagem(file);
  const ext = (file.name.split(".").pop() || "").toLowerCase(), type = file.type || ({pdf: "application/pdf", csv: "text/csv", txt: "text/plain"})[ext] || "application/octet-stream";
  try {
    const u = await corAPI({acao: "anexo_url", id});
    const r = await fetch(u.upload_url, {method: "PUT", headers: {"Content-Type": type, "x-upsert": "false"}, body: file});
    if (!r.ok) throw Object.assign(new Error("upload " + r.status), {via: true});
    await corAPI({acao: "anexo_ok", id, asset_id: u.asset_id, nome: file.name, kind, content_type: type, size: file.size});
  } catch (e){
    if (!(e.via || e.status === 502 || e.status === 0 || /upload/.test(e.message))) throw e;
    if (file.size > 3.2e6) throw new Error("Não consegui enviar este arquivo grande agora. Tente um arquivo de até 3 MB ou peça ao gestor para anexar.");
    const b64 = await new Promise((ok, no) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(",")[1] || ""); fr.onerror = () => no(new Error("Não foi possível ler o arquivo.")); fr.readAsDataURL(file); });
    await corAPI({acao: "anexo_b64", id, nome: file.name, kind, content_type: type, b64});
  }
}
})();
