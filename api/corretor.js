// Ações do corretor que gravam dados (com validação no servidor):
// agenda/tarefas, vendas (criar e editar as próprias até 60 dias após o cadastro), baixa da própria comissão e clientes próprios.
const {URL_, svcHeaders, caller, body} = require("./_lib");
const J = {"Content-Type": "application/json"};
const PRAZO_DIAS = 60;
async function db(path, opt = {}){
  const r = await fetch(URL_() + path, {...opt, headers: svcHeaders({...J, ...(opt.headers || {})})});
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch {}
  return {ok: r.ok, status: r.status, j};
}
const getDoc = async (col, id) => { const r = await db(`/rest/v1/docs?select=data&collection=eq.${col}&id=eq.${encodeURIComponent(id)}`); return r.ok && r.j && r.j[0] ? r.j[0].data : null; };
const putDocs = rows => db(`/rest/v1/docs?on_conflict=collection,id`, {method: "POST", headers: {Prefer: "resolution=merge-duplicates,return=minimal"}, body: JSON.stringify(rows)});
const N = v => { const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", ".")); return isFinite(n) ? n : 0; };
const S = (v, n = 200) => String(v ?? "").trim().slice(0, n);
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const z = s => norm(s).replace(/^0+/, "");
const rid = p => p + "_" + require("crypto").randomBytes(6).toString("hex");
const now = () => new Date().toISOString();
const dataOk = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
const TIPOS = new Set(["visita", "plantao", "ligacao", "outro"]);
const prazoVencido = s => { const c = Date.parse(s && s.created_at); return isFinite(c) && Date.now() - c > PRAZO_DIAS * 864e5; };
// participa pelo id ou pelo nome (vendas antigas muitas vezes só têm o nome do corretor)
const participa = (s, uid, nomes) => { if (!s) return false; const N2 = new Set((nomes || []).map(norm).filter(Boolean));
  return s.owner_id === uid || (s.broker_ids || []).includes(uid) || (s.brokers || []).some(b => b.owner_id === uid || N2.has(norm(b.name))) || (!(s.brokers || []).length && N2.has(norm(s.broker_name))); };
const nomesDe = u => [u && u.war_name, u && u.name];
const ORIGENS = new Set(["acao", "lead", "carteira", "stand", "indicacao", "outro"]);

async function appendItem(col, ym, item, max){
  const cur = await getDoc(col, ym); const itens = [...((cur && cur.itens) || []), item];
  await putDocs([{collection: col, id: ym, data: {...(cur || {}), id: ym, itens: max ? itens.slice(-max) : itens, updated_at: now()}}]);
}
async function usuarios(){
  const r = await db(`/rest/v1/docs?select=data&collection=eq.usuarios`);
  return (r.ok && r.j ? r.j.map(x => x.data) : []).filter(u => u && !u.deleted_at);
}
// espelho simplificado no painel dos corretores envolvidos (o gestor recalcula tudo ao abrir o sistema)
async function espelhar(s, US){
  const sp = N(s.broker_split) || 60, tot = (s.brokers || []).reduce((a, b) => a + N(b.split_pct), 0) || 100;
  for (const b of s.brokers || []){
    const u = US.find(x => x.id === b.owner_id) || US.find(x => x.role === "corretor" && nomesDe(x).some(n => norm(n) && norm(n) === norm(b.name))); if (!u || !u.claude_id) continue;
    const share = N(b.split_pct) / tot, p = await getDoc("portal", u.claude_id); if (!p) continue;
    const old = (p.vendas || []).find(v => v.id === s.id) || {};
    const fator = sp / 100 * share, liq = N(s.commission_net || s.commission_value);
    const its = (s.installments || []).length ? s.installments.map(i => ({number: i.number, due_date: i.due_date, total: N(i.value), value: +(N(i.value) * fator).toFixed(2), received: !!i.received, received_date: i.received_date || null, parcial: 0}))
      : [{number: 1, due_date: s.sale_date, total: liq, value: +(liq * fator).toFixed(2), received: !!s.commission_received, received_date: s.commission_received ? (s.commission_received_at || "").slice(0, 10) : null, parcial: 0, avista: true}];
    const v = {...old, id: s.id, sale_date: s.sale_date, created_at: s.created_at, property_name: s.property_name, quadra: s.quadra, lote: s.lote, client_name: s.client_name, client_phone: s.client_phone || "",
      sale_value: N(s.sale_value), share, pct: +(sp * share).toFixed(2), partners: (s.brokers || []).map(x => x.name).join(" + "), comm_total: liq, comm: +(liq * fator).toFixed(2),
      rec: its.length ? +its.reduce((a, i) => a + (i.received ? i.value : 0), 0).toFixed(2) : (s.commission_received ? +(liq * fator).toFixed(2) : 0),
      venc: +its.reduce((a, i) => a + (!i.received && !i.avista && (i.due_date || "") < now().slice(0, 10) ? i.value : 0), 0).toFixed(2), cancelled: s.status === "cancelled", installments: its, commission_received: !!s.commission_received, pendente_gestor: true};
    const vendas = [...(p.vendas || []).filter(x => x.id !== s.id), v];
    await putDocs([{collection: "portal", id: u.claude_id, data: {...p, vendas, updated_at: now()}}]);
  }
}

// guarda cônjuge, origem e observação no cadastro do cliente (carteira do corretor)
async function clienteDaVenda(s, uid, prof){
  const name = S(s.client_name, 120); if (!name || !(s.client_has_spouse || s.client_origin || s.client_notes)) return;
  const cpf = String(s.client_cpf || "").replace(/\D/g, "");
  const r = await db(`/rest/v1/docs?select=data&collection=eq.clientes&data->>name_key=eq.${encodeURIComponent(norm(name))}`);
  let L = (r.ok && r.j ? r.j.map(x => x.data) : []).filter(c => !c.deleted_at);
  if (cpf.length === 11){ const r2 = await db(`/rest/v1/docs?select=data&collection=eq.clientes&data->>cpf_key=eq.${cpf}`); L = [...L, ...(r2.ok && r2.j ? r2.j.map(x => x.data) : [])].filter(c => !c.deleted_at); }
  const cur = L.find(c => c.owner_id === uid) || L.find(c => !c.owner_id) || null;
  if (!cur && L.length) return; // cliente já cadastrado por outro corretor: não mexe
  const doc = {...(cur || {id: rid("client"), created_at: now(), origem_cadastro: "corretor", owner_id: uid, broker_name: prof.nome || ""}), name: cur ? cur.name : name, name_key: norm(cur ? cur.name : name),
    phone: (cur && cur.phone) || s.client_phone || "", email: (cur && cur.email) || s.client_email || "", cpf: (cur && cur.cpf) || s.client_cpf || "", cpf_key: (cur && cur.cpf_key) || cpf, birthdate: (cur && cur.birthdate) || s.client_birthdate || "",
    has_spouse: !!s.client_has_spouse, spouse: s.client_has_spouse ? s.client_spouse : null, origin: s.client_origin || (cur && cur.origin) || "", notes: s.client_notes || (cur && cur.notes) || "", updated_at: now()};
  await putDocs([{collection: "clientes", id: doc.id, data: doc}]);
}

async function salvarVenda(b, prof, res){
  const d = b.venda || {}, uid = prof.usuario_id;
  const US = await usuarios(), eu = US.find(u => u.id === uid) || {};
  const meuNome = S(eu.war_name || eu.name || prof.nome || "Corretor", 80);
  let old = null;
  if (d.id){
    old = await getDoc("vendas", S(d.id, 60));
    if (!old || old.deleted_at) return res.status(404).json({message: "Venda não encontrada."});
    if (!participa(old, uid, [...nomesDe(eu), prof.nome])) return res.status(403).json({message: "Essa venda não é sua."});
    if (prazoVencido(old)) return res.status(403).json({message: `Essa venda foi cadastrada há mais de ${PRAZO_DIAS} dias. Só o gestor pode alterar.`});
  }
  const s = {
    property_name: S(d.property_name, 120), quadra: S(d.quadra, 20), lote: S(d.lote, 20),
    client_name: S(d.client_name, 120), client_phone: S(d.client_phone, 40), client_email: S(d.client_email, 120), client_cpf: S(d.client_cpf, 20), client_birthdate: S(d.client_birthdate, 10),
    sale_date: S(d.sale_date, 10), sale_value: N(d.sale_value), financed_value: N(d.financed_value), entrada: N(d.entrada),
    commission_base: d.commission_base === "financed" ? "financed" : "sale", commission_rate: N(d.commission_rate), broker_split: Math.min(Math.max(N(d.broker_split), 0), 100),
    discounts: (Array.isArray(d.discounts) ? d.discounts : []).filter(x => N(x.value) > 0).slice(0, 20).map(x => ({type: S(x.type, 30), value: N(x.value), reason: S(x.reason, 200)})),
    parcelado: !!d.parcelado, notes: S(d.notes, 2000),
    client_has_spouse: !!d.client_has_spouse, client_spouse: d.client_has_spouse ? {name: S((d.client_spouse || {}).name, 120), phone: S((d.client_spouse || {}).phone, 40), email: S((d.client_spouse || {}).email, 120), cpf: S((d.client_spouse || {}).cpf, 20), birthdate: S((d.client_spouse || {}).birthdate, 10)} : null,
    client_origin: ORIGENS.has(d.client_origin) ? d.client_origin : "", client_notes: S(d.client_notes, 2000)};
  const err = [];
  if (!s.property_name) err.push("Informe o loteamento.");
  if (!dataOk(s.sale_date)) err.push("Informe a data da venda.");
  if (!(s.sale_value > 0)) err.push("Informe o valor da venda.");
  if (s.financed_value > s.sale_value) err.push("O valor financiado não pode ser maior que o valor da venda.");
  if (err.length) return res.status(400).json({message: err.join(" ")});
  const base = s.commission_base === "financed" ? s.financed_value : s.sale_value;
  const cv = s.commission_rate > 0 ? +(base * s.commission_rate / 100).toFixed(2) : N(d.commission_value);
  const disc = s.discounts.reduce((a, x) => a + x.value, 0);
  Object.assign(s, {commission_value: cv, commission_gross: cv, commission_net: +(cv - disc).toFixed(2), broker_commission: +(cv * s.broker_split / 100).toFixed(2), agency_commission: +(cv - cv * s.broker_split / 100).toFixed(2)});
  // corretores: na edição não mudam; no cadastro o próprio corretor sempre entra
  if (old) Object.assign(s, {brokers: old.brokers, broker_ids: old.broker_ids, broker_name: old.broker_name, owner_id: old.owner_id, owner_name: old.owner_name});
  else {
    let L = (Array.isArray(d.brokers) ? d.brokers : []).filter(x => S(x.name)).slice(0, 4).map(x => ({name: S(x.name, 80), split_pct: N(x.split_pct)}));
    const meus = new Set([norm(eu.war_name), norm(eu.name), norm(prof.nome)].filter(Boolean));
    let i = L.findIndex(x => meus.has(norm(x.name)));
    if (i < 0){ L.unshift({name: meuNome, split_pct: L.length ? 0 : 100}); i = 0; }
    if (L.length === 1) L[0].split_pct = 100;
    if (Math.abs(L.reduce((a, x) => a + x.split_pct, 0) - 100) > 0.01) return res.status(400).json({message: "A divisão entre os corretores deve somar 100%."});
    const brokers = L.map((x, k) => { const u = k === i ? eu : US.find(u => u.role === "corretor" && [u.war_name, u.name].some(n => norm(n) === norm(x.name))); return {name: k === i ? meuNome : x.name, split_pct: x.split_pct, owner_id: k === i ? uid : (u ? u.id : null)}; });
    Object.assign(s, {brokers, broker_ids: brokers.map(x => x.owner_id).filter(Boolean), broker_name: brokers.map(x => x.name).join(" + "), owner_id: brokers[0].owner_id || uid, owner_name: brokers[0].name});
  }
  // parcelas: o corretor define vencimento e valor, mas nunca marca como recebida
  const oldInst = new Map(((old && old.installments) || []).map(x => [x.number, x]));
  s.installments = s.parcelado ? (Array.isArray(d.installments) ? d.installments : []).slice(0, 60).map((x, k) => { const o = oldInst.get(k + 1) || {}; return {...o, number: k + 1, due_date: S(x.due_date, 10), value: N(x.value), received: !!o.received, received_date: o.received_date || null}; }) : [];
  if (s.parcelado && !s.installments.length) return res.status(400).json({message: "Gere as parcelas da comissão."});
  s.commission_received = s.parcelado ? false : !!d.commission_received;
  if (!s.parcelado && s.commission_received && !(old && old.commission_received)) s.commission_received_at = now();
  if (!b.confirmar){
    const r = await db(`/rest/v1/docs?select=id,p:data->>property_name,q:data->>quadra,l:data->>lote,c:data->>client_name,dt:data->>sale_date,b:data->>broker_name,del:data->>deleted_at,st:data->>status&collection=eq.vendas&data->>lote=not.is.null`);
    const L = (r.ok && r.j ? r.j : []).filter(x => x.id !== (old && old.id) && !x.del && x.st !== "cancelled" && norm(x.p) === norm(s.property_name));
    const w = [];
    const dup = L.find(x => x.dt === s.sale_date && z(x.q) === z(s.quadra) && z(x.l) === z(s.lote) && norm(x.c) === norm(s.client_name));
    if (dup) w.push(`Já existe uma venda igual (mesma data, loteamento, quadra, lote e cliente) de ${dup.b}.`);
    else if (s.quadra && s.lote){ const sold = L.find(x => z(x.q) === z(s.quadra) && z(x.l) === z(s.lote)); if (sold) w.push(`A quadra ${s.quadra}, lote ${s.lote} de ${s.property_name} já tem venda registrada (${sold.c || "—"}, ${sold.b}).`); }
    if (w.length) return res.status(409).json({message: w.join(" "), confirmar: true});
  }
  const doc = old ? {...old, ...s, updated_at: now(), editado_por_corretor: now()} : {...s, id: rid("sale"), created_at: now(), user_id: uid, origem: "corretor", updated_at: now()};
  const w = await putDocs([{collection: "vendas", id: doc.id, data: doc}]);
  if (!w.ok) return res.status(500).json({message: "Não foi possível salvar a venda."});
  const ym = now().slice(0, 7);
  await appendItem("auditoria", ym, {id: rid("aud"), action: old ? "update" : "create", sale_id: doc.id, property_name: doc.property_name, quadra: doc.quadra, lote: doc.lote, client_name: doc.client_name, broker_name: doc.broker_name, sale_value: doc.sale_value, detail: old ? "Venda editada pelo corretor" : "Venda cadastrada pelo corretor", by: meuNome, by_id: uid, at: now()}).catch(() => {});
  await appendItem("avisos", ym, {id: rid("ntf"), type: "venda", message: `${meuNome} ${old ? "editou" : "cadastrou"} a venda de ${doc.client_name || "cliente"} · ${doc.property_name} Q${doc.quadra || "-"} L${doc.lote || "-"}`, to: "gestor", meta: {sale_id: doc.id}, at: now()}, 1500).catch(() => {});
  await espelhar(doc, US).catch(() => {});
  await clienteDaVenda(doc, uid, prof).catch(() => {});
  return res.status(200).json({venda: doc});
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({message: "Método inválido"});
  const who = await caller(req).catch(() => null);
  if (!who) return res.status(401).json({message: "Sessão expirada. Entre de novo."});
  const p = await db(`/rest/v1/profiles?select=usuario_id,nome,role&id=eq.${who.id}`);
  const prof = p.ok && p.j && p.j[0] ? p.j[0] : null;
  if (!prof || !prof.usuario_id) return res.status(403).json({message: "Seu acesso ainda não está vinculado a um corretor. Fale com o gestor."});
  const b = body(req), uid = prof.usuario_id;
  try {
    if (b.acao === "agenda"){
      const d = b.doc || {};
      const id = String(d.id || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60);
      if (!id) return res.status(400).json({message: "Tarefa inválida."});
      const old = await getDoc("agenda", id);
      if (old && old.owner_id !== uid) return res.status(403).json({message: "Essa tarefa é de outra pessoa."});
      const when = String(d.when || "").slice(0, 16);
      if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(when)) return res.status(400).json({message: "Data inválida."});
      const doc = {...(old || {}), id, title: S(d.title), type: TIPOS.has(d.type) ? d.type : "outro", when, client_name: S(d.client_name, 120),
        lot: S(d.lot, 120), notes: S(d.notes, 2000), done: !!d.done, done_at: d.done ? (d.done_at || now()) : null,
        owner_id: uid, owner_name: prof.nome || "", created_at: (old && old.created_at) || now(), updated_at: now()};
      if (d.deleted_at) doc.deleted_at = now(); else delete doc.deleted_at;
      if (!doc.title) return res.status(400).json({message: "Informe o título."});
      const w = await putDocs([{collection: "agenda", id, data: doc}]);
      if (!w.ok) return res.status(500).json({message: "Não foi possível salvar."});
      return res.status(200).json({doc});
    }
    if (b.acao === "venda") return await salvarVenda(b, prof, res);
    if (b.acao === "receber"){
      const s = await getDoc("vendas", S(b.id, 60));
      const eu0 = (await usuarios()).find(u => u.id === uid);
      if (!s || s.deleted_at || !participa(s, uid, [...nomesDe(eu0), prof.nome])) return res.status(404).json({message: "Venda não encontrada."});
      const ok = !!b.recebida, n = Math.floor(N(b.parcela)), hoje = now().slice(0, 10);
      let det;
      if (n > 0 && (s.installments || []).length){
        const its = [...(s.installments || [])], i = its.findIndex(x => x.number === n);
        if (i < 0) return res.status(404).json({message: "Parcela não encontrada."});
        its[i] = {...its[i], received: ok, received_date: ok ? (its[i].received_date || hoje) : null, status: ok ? "pago" : ((its[i].due_date || "") < hoje ? "vencida" : "pendente"), marcado_por_corretor: ok ? now() : null};
        s.installments = its; s.commission_received = its.every(x => x.received); det = `Parcela ${n} ${ok ? "marcada como recebida" : "desmarcada"} pelo corretor`;
      } else { s.commission_received = ok; s.commission_received_at = ok ? now() : null; det = `Comissão ${ok ? "marcada como recebida" : "desmarcada"} pelo corretor`; }
      s.updated_at = now();
      const w = await putDocs([{collection: "vendas", id: s.id, data: s}]);
      if (!w.ok) return res.status(500).json({message: "Não foi possível salvar."});
      const US = await usuarios(), eu = US.find(u => u.id === uid) || {}, nome = S(eu.war_name || eu.name || prof.nome || "Corretor", 80), ym = now().slice(0, 7);
      await appendItem("auditoria", ym, {id: rid("aud"), action: "update", sale_id: s.id, property_name: s.property_name, quadra: s.quadra, lote: s.lote, client_name: s.client_name, broker_name: s.broker_name, sale_value: s.sale_value, detail: det, by: nome, by_id: uid, at: now()}).catch(() => {});
      await appendItem("avisos", ym, {id: rid("ntf"), type: "comissao", message: `${nome}: ${det.replace(" pelo corretor", "")} · ${s.client_name || "cliente"} · ${s.property_name} Q${s.quadra || "-"} L${s.lote || "-"}`, to: "gestor", meta: {sale_id: s.id}, at: now()}, 1500).catch(() => {});
      await espelhar(s, US).catch(() => {});
      return res.status(200).json({ok: true});
    }
    if (b.acao === "venda_ler"){
      const s = await getDoc("vendas", S(b.id, 60));
      const eu0 = (await usuarios()).find(u => u.id === uid);
      if (!s || s.deleted_at || !participa(s, uid, [...nomesDe(eu0), prof.nome])) return res.status(404).json({message: "Venda não encontrada."});
      return res.status(200).json({venda: s, pode_editar: !prazoVencido(s), prazo_dias: PRAZO_DIAS});
    }
    if (b.acao === "clientes"){
      const r = await db(`/rest/v1/docs?select=data&collection=eq.clientes&data->>owner_id=eq.${encodeURIComponent(uid)}`);
      return res.status(200).json({clientes: (r.ok && r.j ? r.j.map(x => x.data) : []).filter(c => !c.deleted_at)});
    }
    if (b.acao === "cliente"){
      const c = b.cliente || {}, id = String(c.id || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60);
      const old = id ? await getDoc("clientes", id) : null;
      if (id && !old) return res.status(404).json({message: "Cliente não encontrado."});
      if (old && old.owner_id !== uid) return res.status(403).json({message: "Esse cliente é de outro corretor. Fale com o gestor."});
      const name = S(c.name, 120); if (!name) return res.status(400).json({message: "Informe o nome."});
      const cpf = String(c.cpf || "").replace(/\D/g, "").slice(0, 14);
      const hs = !!c.has_spouse, sp = c.spouse || {};
      const doc = {...(old || {id: rid("client"), created_at: now(), origem_cadastro: "corretor"}), name, name_key: norm(name), cpf: S(c.cpf, 20), cpf_key: cpf, phone: S(c.phone, 40), email: S(c.email, 120), birthdate: S(c.birthdate, 10),
        origin: S(c.origin, 20), origin_other: S(c.origin_other, 120), has_spouse: hs, spouse: hs ? {name: S(sp.name, 120), phone: S(sp.phone, 40), email: S(sp.email, 120), cpf: S(sp.cpf, 20), birthdate: S(sp.birthdate, 10)} : null, notes: S(c.notes, 2000),
        owner_id: uid, broker_name: prof.nome || "", updated_at: now()};
      if (c.deleted_at && old) doc.deleted_at = now();
      const w = await putDocs([{collection: "clientes", id: doc.id, data: doc}]);
      if (!w.ok) return res.status(500).json({message: "Não foi possível salvar o cliente."});
      return res.status(200).json({cliente: doc});
    }
    return res.status(400).json({message: "Ação inválida."});
  } catch (e){ return res.status(500).json({message: "Erro no servidor: " + (e && e.message || e)}); }
};
