// Ações do corretor que gravam dados (com validação no servidor). Por enquanto: agenda e tarefas do próprio corretor.
const {URL_, svcHeaders, caller, body} = require("./_lib");
const J = {"Content-Type": "application/json"};
async function db(path, opt = {}){
  const r = await fetch(URL_() + path, {...opt, headers: svcHeaders({...J, ...(opt.headers || {})})});
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch {}
  return {ok: r.ok, status: r.status, j};
}
const TIPOS = new Set(["visita", "plantao", "ligacao", "outro"]);
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({message: "Método inválido"});
  const who = await caller(req).catch(() => null);
  if (!who) return res.status(401).json({message: "Sessão expirada. Entre de novo."});
  const p = await db(`/rest/v1/profiles?select=usuario_id,nome,role&id=eq.${who.id}`);
  const prof = p.ok && p.j && p.j[0] ? p.j[0] : null;
  if (!prof || !prof.usuario_id) return res.status(403).json({message: "Seu acesso ainda não está vinculado a um corretor. Fale com o gestor."});
  const b = body(req);
  try {
    if (b.acao === "agenda"){
      const d = b.doc || {};
      const id = String(d.id || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60);
      if (!id) return res.status(400).json({message: "Tarefa inválida."});
      const cur = await db(`/rest/v1/docs?select=data&collection=eq.agenda&id=eq.${encodeURIComponent(id)}`);
      const old = cur.ok && cur.j && cur.j[0] ? cur.j[0].data : null;
      if (old && old.owner_id !== prof.usuario_id) return res.status(403).json({message: "Essa tarefa é de outra pessoa."});
      const when = String(d.when || "").slice(0, 16);
      if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(when)) return res.status(400).json({message: "Data inválida."});
      const doc = {...(old || {}), id, title: String(d.title || "").slice(0, 200), type: TIPOS.has(d.type) ? d.type : "outro", when, client_name: String(d.client_name || "").slice(0, 120),
        lot: String(d.lot || "").slice(0, 120), notes: String(d.notes || "").slice(0, 2000), done: !!d.done, done_at: d.done ? (d.done_at || new Date().toISOString()) : null,
        owner_id: prof.usuario_id, owner_name: prof.nome || "", created_at: (old && old.created_at) || new Date().toISOString(), updated_at: new Date().toISOString()};
      if (d.deleted_at) doc.deleted_at = new Date().toISOString(); else delete doc.deleted_at;
      if (!doc.title) return res.status(400).json({message: "Informe o título."});
      const w = await db(`/rest/v1/docs?on_conflict=collection,id`, {method: "POST", headers: {Prefer: "resolution=merge-duplicates,return=minimal"}, body: JSON.stringify([{collection: "agenda", id, data: doc}])});
      if (!w.ok) return res.status(500).json({message: "Não foi possível salvar."});
      return res.status(200).json({doc});
    }
    return res.status(400).json({message: "Ação inválida."});
  } catch (e){ return res.status(500).json({message: "Erro no servidor: " + (e && e.message || e)}); }
};
