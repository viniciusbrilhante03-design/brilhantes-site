/* Brilhante's Imóveis — ajustes do site próprio: acesso dos corretores por e-mail + CPF, botão Sair. */
"use strict";
async function acessoAPI(body){
  const t = await window.__bri.token();
  const r = await fetch("/api/acesso", {method: "POST", headers: {"Content-Type": "application/json", Authorization: "Bearer " + t}, body: JSON.stringify(body)}).catch(() => null);
  if (!r) throw new Error("Sem conexão com o site.");
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.message || "Não foi possível concluir (" + r.status + ").");
  return j;
}
const semAcesso = () => [...st.usuarios.values()].filter(u => !u.deleted_at && u.active !== false && u.role === "corretor" && !u.claude_id && /\S+@\S+\.\S+/.test(u.email || "") && onlyDigits(u.cpf || "").length === 11);
function liberar(u, r, email){
  const cur = st.usuarios.get(u.id) || u;
  saveDoc("usuarios", {...cur, claude_id: r.id, portal_email: email, portal_desde: nowISO()});
}
openLink = async function(t){
  const u = st.usuarios.get(t.doc.id) || t.doc, email0 = (u.portal_email || u.email || "").trim().toLowerCase(), cpf0 = onlyDigits(u.cpf || "");
  const lote = semAcesso().filter(x => x.id !== u.id);
  modal(`<div class="dlg" style="max-width:540px"><div class="dh"><div style="flex:1"><h2>Acesso de ${esc(t.name)}</h2><p>O corretor entra em <b>${esc(location.host)}</b> com o e-mail e o CPF (só números) como senha. Ele vê só as vendas e comissões dele, o ranking e os loteamentos.</p></div><button class="btn icon" data-x aria-label="Fechar">✕</button></div>
    <div class="db">
      ${u.claude_id ? `<div class="alert w">Acesso ativo desde ${dBR(u.portal_desde)}${u.portal_email ? " · " + esc(u.portal_email) : ""}.</div>` : ""}
      <label class="f">E-mail de login<input type="email" id="acEmail" value="${esc(email0)}" ${u.claude_id ? "readonly" : ""}></label>
      <label class="f">CPF (é a senha)<input type="text" id="acCpf" inputmode="numeric" value="${esc(cpf0)}"></label>
      <div id="acMsg"></div>
      <div class="toolbar" style="display:flex;gap:8px;flex-wrap:wrap">${u.claude_id
        ? `<button class="btn pri" data-ac="senha">Redefinir a senha para este CPF</button><button class="btn danger" data-ac="remover">Remover acesso</button>`
        : `<button class="btn pri" data-ac="criar">Criar acesso</button>`}</div>
      ${lote.length ? `<div class="fs" style="border-top:1px solid var(--border);padding-top:12px;margin-top:4px"><p style="margin:0 0 8px;color:var(--mfg)">Outros <b>${lote.length}</b> corretores ativos já têm e-mail e CPF cadastrados e ainda não têm acesso.</p><button class="btn" data-ac="lote">Criar acesso para todos eles</button></div>` : ""}
    </div></div>`);
  const msg = (h, k) => { $("#acMsg").innerHTML = `<div class="alert ${k || "w"}">${h}</div>`; };
  const busy = on => $$("#dlg [data-ac]").forEach(b => b.disabled = on);
  $("#dlg").onclick = async e => {
    if (e.target.closest("[data-x]")) return $("#dlg").close();
    const b = e.target.closest("[data-ac]"); if (!b) return;
    const ac = b.dataset.ac, email = $("#acEmail").value.trim().toLowerCase(), cpf = onlyDigits($("#acCpf").value);
    if (ac !== "lote" && ac !== "remover"){
      if (!/\S+@\S+\.\S+/.test(email)) return msg("Informe um e-mail válido.", "e");
      if (cpf.length !== 11) return msg("O CPF precisa ter 11 números.", "e");
    }
    busy(true);
    try {
      if (ac === "criar"){
        msg("Criando acesso…");
        const r = await acessoAPI({acao: "criar", email, senha: cpf, nome: t.name, usuario_id: u.id});
        liberar(u, r, email); schedulePortals(); setTimeout(syncPortals, 300);
        $("#dlg").close(); toast(r.existia ? `Acesso de ${t.name} religado (senha = CPF)` : `Acesso criado para ${t.name}`);
      } else if (ac === "senha"){
        await acessoAPI({acao: "senha", uid: u.claude_id, senha: cpf});
        msg(`Senha redefinida. ${esc(t.name)} entra com <b>${esc(u.portal_email || email)}</b> e o CPF.`); busy(false);
      } else if (ac === "remover"){
        if (!confirm(`Remover o acesso de ${t.name}? Ele deixa de conseguir entrar.`)){ busy(false); return; }
        await acessoAPI({acao: "remover", uid: u.claude_id});
        const d = {...(st.usuarios.get(u.id) || u)}; const old = d.claude_id; delete d.claude_id; delete d.portal_desde;
        saveDoc("usuarios", d); lastPortal.delete("portal/" + old);
        $("#dlg").close(); toast("Acesso removido");
      } else if (ac === "lote"){
        let ok = 0, er = [];
        for (const x of lote){
          msg(`Criando ${ok + er.length + 1} de ${lote.length}: ${esc(x.war_name || x.name)}…`);
          try { const em = x.email.trim().toLowerCase(); const r = await acessoAPI({acao: "criar", email: em, senha: onlyDigits(x.cpf), nome: (x.war_name || x.name || "").trim(), usuario_id: x.id}); liberar(x, r, em); ok++; }
          catch (err){ er.push(`${esc(x.war_name || x.name)}: ${esc(err.message)}`); }
        }
        schedulePortals(); setTimeout(syncPortals, 300);
        msg(`<b>${ok}</b> acessos criados.${er.length ? "<br>Não foi possível:<br>" + er.join("<br>") : ""}`, er.length ? "w" : "w"); busy(false);
      }
    } catch (err){ msg(esc(err.message), "e"); busy(false); }
  };
};
waitingScreen = function(){
  $("#main").innerHTML = `<div class="card" style="max-width:560px;margin:20px auto;padding:24px;display:flex;flex-direction:column;gap:12px"><h1 style="font-size:22px">Bem-vindo à Brilhante's Imóveis</h1>
    <p style="margin:0;color:var(--mfg)">Seu painel está sendo preparado. Ele aparece aqui sozinho assim que o gestor atualizar o sistema. Se demorar, avise o gestor.</p></div>`;
};
/* botão Sair no cabeçalho */
(function(){
  const add = () => {
    const p = document.querySelector("header .period"); if (!p || document.getElementById("btnSair")) return;
    const b = document.createElement("button"); b.className = "btn icon"; b.id = "btnSair"; b.title = "Sair (" + (window.__bri.email() || "") + ")"; b.setAttribute("aria-label", "Sair");
    b.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>`;
    b.onclick = () => { if (confirm("Sair do sistema?")) window.__bri.logout(); };
    p.appendChild(b);
  };
  window.claude.use("user").then(add, () => {});
})();

/* ---------- Mapa com Google Maps (usa GOOGLE_MAPS_API_KEY da Vercel; sem chave, fica o mapa simples) ---------- */
let gmPromise = null, gmFailed = false;
window.gm_authFailure = () => { gmFailed = true; document.querySelectorAll("[data-gmap]").forEach(el => { el.innerHTML = `<div class="empty" style="padding:24px"><b>Mapa do Google não autorizado</b>A chave do Google Maps não aceita o endereço ${esc(location.host)}. No Google Cloud, adicione este domínio na restrição da chave.</div>`; }); };
function loadGmaps(){
  const key = (window.__bri.cfg() || {}).gmaps;
  if (!key || gmFailed) return Promise.resolve(null);
  if (window.google && google.maps && google.maps.Map) return Promise.resolve(google.maps);
  if (!gmPromise) gmPromise = new Promise(res => {
    window.__gmReady = () => res(google.maps);
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&language=pt-BR&region=BR&callback=__gmReady`;
    s.async = true; s.onerror = () => { gmFailed = true; res(null); };
    document.head.appendChild(s);
    setTimeout(() => res(window.google && google.maps && google.maps.Map ? google.maps : null), 15000);
  });
  return gmPromise;
}
const gmPin = (gm, color, big) => ({path: "M12 0C6.5 0 2 4.4 2 9.9 2 17.3 12 28 12 28s10-10.7 10-18.1C22 4.4 17.5 0 12 0z", fillColor: color, fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2, scale: big ? 1.35 : 1.05, anchor: new gm.Point(12, 28), labelOrigin: new gm.Point(12, 10)});
function gmInfo(l){
  return `<div style="width:230px;font-family:var(--f-body,system-ui);color:#13201c">${l.cover ? `<img src="${esc(l.cover)}" alt="" style="width:100%;height:110px;object-fit:cover;border-radius:8px;margin-bottom:6px;display:block">` : ""}<b style="display:block;font-size:14px">${esc(l.name)}</b><span style="display:block;color:#5c6b66;font-size:12px">${esc([l.cidade, l.estado].filter(Boolean).join(" - ") || "Sem cidade/estado")} · ${esc(PHASES[l.phase] || "Em vendas")}${l.tipo ? " · " + (l.tipo === "fechado" ? "fechado" : "aberto") : ""}</span>${l.valor ? `<span style="display:block;font-size:12px;margin-top:2px">a partir de ${esc(money(l.valor))}</span>` : ""}
    <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><button class="btn sm pri" data-open="${esc(l.id)}">Ver detalhes</button><a class="btn sm gold" href="${esc(routeUrl(l.c))}" target="_blank" rel="noopener">Traçar rota</a></div></div>`;
}
const _mountGeneralMapSimples = mountGeneralMap;
mountGeneralMap = function(root, lotsArr, onOpen, large){
  _mountGeneralMapSimples(root, lotsArr, onOpen, large);            // monta filtros, lista e o mapa simples
  loadGmaps().then(gm => {
    if (!gm || !root.isConnected) return;
    const old = $("#mgMap", root); if (!old) return;
    const box = old.cloneNode(false); box.removeAttribute("style"); box.dataset.gmap = "1";
    box.style.cssText = `border:1px solid var(--border);border-radius:12px;overflow:hidden;height:${large ? "min(72vh,640px)" : "min(60vh,520px)"}`;
    old.replaceWith(box);
    const ctr = box.parentElement.querySelector(".toolbar[style*='position:absolute']"); if (ctr) ctr.remove();
    const pop = $("#mgPop", root); if (pop) pop.remove();
    const S = ui.mg, all = mapLots(lotsArr);
    const map = new gm.Map(box, {center: {lat: -3.75, lng: -38.6}, zoom: 9, mapTypeControl: true, streetViewControl: false, fullscreenControl: true, gestureHandling: "greedy", clickableIcons: false});
    const iw = new gm.InfoWindow(); let marks = [];
    const filt = () => { const q = norm(S.q); return all.filter(l => (!S.lot || l.id === S.lot) && (!q || norm(l.name + " " + l.cidade).includes(q)) && (!S.tipo || l.tipo === S.tipo) && (!S.city || l.cidade === S.city)); };
    const draw = fitIt => {
      marks.forEach(m => m.setMap(null)); marks = [];
      const L = filt(), pts = L.filter(l => l.c), bounds = new gm.LatLngBounds();
      const cnt = $("#mgCount", root); if (cnt) cnt.textContent = `${pts.length} de ${all.length} no mapa`;
      for (const l of pts){
        const pos = {lat: l.c[0], lng: l.c[1]}, sel = l.id === S.sel;
        const m = new gm.Marker({position: pos, map, title: l.name, icon: gmPin(gm, pinColor(l), sel), zIndex: sel ? 999 : 1, label: map.getZoom() >= 11 || sel ? {text: l.name, color: "#13201c", fontSize: "11px", fontWeight: "700", className: "gm-lbl"} : null});
        m.addListener("click", () => { S.sel = l.id; iw.setContent(gmInfo(l)); iw.open({anchor: m, map}); });
        marks.push(m); bounds.extend(pos);
      }
      if (fitIt && pts.length){ if (pts.length === 1){ map.setCenter(bounds.getCenter()); map.setZoom(14); } else map.fitBounds(bounds, 40); }
    };
    if (!document.getElementById("gmCss")) document.head.appendChild(Object.assign(document.createElement("style"), {id: "gmCss", textContent: ".gm-lbl{transform:translateY(-30px);text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 3px #fff}.gm-style .gm-style-iw-c{padding:10px!important}"}));
    let lastZ = 0; map.addListener("zoom_changed", () => { const z = map.getZoom() >= 11; if (z !== lastZ){ lastZ = z; draw(false); } });
    draw(true);
    const refit = () => draw(true);
    $("#mgQ", root).addEventListener("input", refit);
    ["mgLot","mgTipo","mgCity"].forEach(id => $("#" + id, root).addEventListener("change", refit));
    const fitB = $("#mgFit", root); if (fitB) fitB.onclick = () => { S.sel = null; iw.close(); refit(); };
    root.addEventListener("click", e => {
      const li = e.target.closest("[data-li]"); if (!li) return;
      e.stopImmediatePropagation();
      const l = all.find(x => x.id === li.dataset.li); if (!l) return;
      if (!l.c) return onOpen(l.id);
      S.sel = l.id; draw(false); map.panTo({lat: l.c[0], lng: l.c[1]}); if (map.getZoom() < 14) map.setZoom(14);
      const m = marks.find(x => x.getTitle() === l.name); if (m){ iw.setContent(gmInfo(l)); iw.open({anchor: m, map}); }
    }, true);
  });
};
/* mapa pequeno da aba "Mapa" do loteamento */
const _mapSVGSimples = mapSVG;
mapSVG = function(L, focus){
  if (!(window.__bri.cfg() || {}).gmaps || gmFailed) return _mapSVGSimples(L, focus);
  const id = "gmMini" + Math.random().toString(36).slice(2, 8);
  setTimeout(() => loadGmaps().then(gm => {
    const el = document.getElementById(id); if (!el) return;
    if (!gm){ el.outerHTML = _mapSVGSimples(L, focus); return; }
    const all = mapLots(L).filter(l => l.c), f = all.find(l => l.id === focus);
    const map = new gm.Map(el, {center: f ? {lat: f.c[0], lng: f.c[1]} : {lat: -3.75, lng: -38.6}, zoom: f ? 15 : 9, mapTypeId: "hybrid", mapTypeControl: true, streetViewControl: false, gestureHandling: "cooperative", clickableIcons: false});
    for (const l of all){ const sel = l.id === focus; new gm.Marker({position: {lat: l.c[0], lng: l.c[1]}, map, title: l.name, icon: gmPin(gm, sel ? "#D4AF37" : pinColor(l), sel), zIndex: sel ? 999 : 1}); }
  }), 0);
  return `<div id="${id}" data-gmap="1" style="height:min(55vh,420px);border:1px solid var(--border);border-radius:12px;overflow:hidden;background:var(--muted)"></div>`;
};

/* ---------- Google Agenda: conectar e sincronizar (compromissos, aniversários e vencimentos) ---------- */
const GA = {st: null, busy: false};
const gaKeys = { get(){ try { return JSON.parse(store.get("bri.gaKeys") || "[]"); } catch { return []; } }, set(a){ store.set("bri.gaKeys", JSON.stringify(a)); } };
async function gaAPI(acao, extra){
  const t = await window.__bri.token();
  const r = await fetch("/api/google-agenda", {method: "POST", headers: {"Content-Type": "application/json", Authorization: "Bearer " + t}, body: JSON.stringify({acao, ...(extra || {})})}).catch(() => null);
  if (!r) throw new Error("Sem conexão com o site.");
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.message || "Erro " + r.status);
  return j;
}
function gaEventos(){
  const ev = [], ini = addMonths(T, -1), fim = addMonths(T, 12);
  for (const a of st.agenda.values()){ if (a.deleted_at || a.done || !a.when) continue; const w = String(a.when).slice(0, 16);
    ev.push(w.length > 10 ? {key: "appt" + a.id, titulo: `[Brilhante] ${a.title}`, descricao: [ATYPE[a.type] || a.type, a.client_name ? "Cliente: " + a.client_name : "", a.notes || ""].filter(Boolean).join("\n"), inicio: w}
      : {key: "appt" + a.id, titulo: `[Brilhante] ${a.title}`, descricao: a.notes || "", dia: w.slice(0, 10)}); }
  const Y = +T.slice(0, 4);
  for (const p of birthdayPeople(clientIndex())){ if (!p.m || !p.d) continue;
    ev.push({key: "bday" + norm(p.name) + p.kind, titulo: `🎂 Aniversário de ${p.name}`, descricao: `${p.kind} · Brilhante's Imóveis${p.phone ? "\nTelefone: " + fmtPhone(p.phone) : ""}`, dia: `${Y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`, anual: true}); }
  if (isAdmin) for (const s of allSales()){ if (!isActive(s)) continue;
    for (const q of planOf(s)){ if (q.recebida || q.avista || !q.venc || q.venc < ini || q.venc > fim) continue; const x = partsOf(q, s), falta = Math.max(x.liq - (q.pago || 0), 0); if (falta < 0.01) continue;
      ev.push({key: `venc${s.id}-${q.n}`, titulo: `💰 Comissão: ${s.property_name} Q${s.quadra || "–"} L${s.lote || "–"} · parc. ${q.n} (${brl(falta)})`, descricao: `Cliente: ${s.client_name || "—"}\nCorretor: ${brokersOf(s).map(b => b.name).join(" + ") || "—"}\nCorretor recebe: ${brl(x.corretor)} · Imobiliária: ${brl(x.imob)}`, dia: q.venc}); } }
  return ev;
}
async function gaSincronizar(silencioso){
  if (GA.busy) return; GA.busy = true; gaPaint();
  try {
    const ev = gaEventos(), prev = new Set(gaKeys.get()), now = new Set(ev.map(e => e.key)), remover = [...prev].filter(k => !now.has(k));
    let tot = {ok: 0, falhas: 0, removidos: 0};
    for (let i = 0; i < ev.length || (i === 0 && remover.length); i += 250){
      const r = await gaAPI("sincronizar", {eventos: ev.slice(i, i + 250), remover: i === 0 ? remover : []});
      tot.ok += r.ok; tot.falhas += r.falhas; tot.removidos += r.removidos;
    }
    gaKeys.set([...now]); store.set("bri.gaDia", T);
    const n = c => ev.filter(e => e.key.startsWith(c)).length;
    if (!silencioso) toast(`Google Agenda atualizada: ${n("appt")} compromissos, ${n("bday")} aniversários, ${n("venc")} vencimentos${tot.falhas ? ` · ${tot.falhas} com erro` : ""}`);
  } catch (e){ if (!silencioso) toast(e.message); }
  GA.busy = false; gaPaint();
}
function gaCard(){
  const s = GA.st;
  if (!s) return `<section class="card" id="gaCard" style="margin-bottom:12px"><div class="bd" style="color:var(--mfg)">Verificando Google Agenda…</div></section>`;
  const icon = `<span class="pill p-gold" style="font-size:14px">📅</span>`;
  if (!s.configured) return `<section class="card" id="gaCard" style="margin-bottom:12px"><div class="bd toolbar" style="justify-content:space-between">${icon}<div style="flex:1;min-width:200px"><b>Google Agenda</b><span style="display:block;color:var(--mfg);font-size:13px">A sincronização ainda não foi configurada no site (falta o ID do cliente do Google na Vercel).</span></div></div></section>`;
  return `<section class="card" id="gaCard" style="margin-bottom:12px"><div class="bd toolbar" style="justify-content:space-between;gap:10px">${icon}<div style="flex:1;min-width:200px"><b>Google Agenda</b><span style="display:block;color:var(--mfg);font-size:13px">${s.connected ? `Conectada${s.email ? " a " + esc(s.email) : ""} · envia compromissos, aniversários e vencimentos de comissão${store.get("bri.gaDia") ? " · última sincronização " + dBR(store.get("bri.gaDia")) : ""}` : "Conecte sua conta Google para ver compromissos, aniversários e vencimentos no celular."}</span></div>
    <span class="toolbar">${s.connected ? `<button class="btn pri sm" data-ga="sync" ${GA.busy ? "disabled" : ""}>${GA.busy ? "Sincronizando…" : "Sincronizar agora"}</button><button class="btn sm" data-ga="off">Desconectar</button>` : `<button class="btn pri sm" data-ga="on">Conectar Google Agenda</button>`}</span></div></section>`;
}
function gaPaint(){ const c = document.getElementById("gaCard"); if (c) c.outerHTML = gaCard(); }
async function gaStatus(){ try { GA.st = await gaAPI("status"); } catch { GA.st = {configured: false, connected: false}; } gaPaint(); return GA.st; }
(function(){
  if (typeof Agenda === "undefined") return;
  const h = Agenda.html, b = Agenda.bind;
  Agenda.html = () => { const x = h(); const i = x.indexOf('<section class="card">'); return i >= 0 ? x.slice(0, i) + gaCard() + x.slice(i) : gaCard() + x; };
  Agenda.bind = function(){ b.apply(this, arguments); if (!GA.st) gaStatus(); };
  document.addEventListener("click", async e => {
    const btn = e.target.closest("[data-ga]"); if (!btn) return;
    const a = btn.dataset.ga;
    if (a === "sync") return gaSincronizar(false);
    if (a === "on"){ try { const r = await gaAPI("login"); location.href = r.url; } catch (err){ toast(err.message); } return; }
    if (a === "off"){ if (!confirm("Desconectar o Google Agenda? Os eventos já enviados continuam na sua agenda do Google.")) return; try { await gaAPI("desconectar"); gaKeys.set([]); await gaStatus(); toast("Google Agenda desconectada"); } catch (err){ toast(err.message); } }
  });
  // volta do Google após conectar
  const q = new URLSearchParams(location.search).get("agenda");
  window.claude.use("user").then(async () => {
    if (q){ history.replaceState(null, "", location.pathname); setTimeout(async () => { toast(q === "conectada" ? "Google Agenda conectada! Enviando eventos…" : "Não foi possível conectar o Google Agenda."); if (q === "conectada"){ await gaStatus(); gaSincronizar(false); } }, 2500); return; }
    // sincroniza sozinho uma vez por dia, quando o sistema abre
    setTimeout(async () => { if (store.get("bri.gaDia") === T) return; const s = await gaStatus(); if (s.connected) gaSincronizar(true); }, 8000);
  }, () => {});
})();
