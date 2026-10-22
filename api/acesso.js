// Cria, redefine ou remove o login (e-mail + CPF) de um corretor. Só o gestor pode usar.
const {URL_, svcHeaders, caller, body} = require("./_lib");
const J = {"Content-Type": "application/json"};
async function call(path, opt = {}){
  const r = await fetch(URL_() + path, {...opt, headers: svcHeaders({...J, ...(opt.headers || {})})});
  const t = await r.text(); let j = {}; try { j = t ? JSON.parse(t) : {}; } catch {}
  return {ok: r.ok, status: r.status, j};
}
async function porEmail(email){
  for (let page = 1; page <= 20; page++){
    const r = await call(`/auth/v1/admin/users?page=${page}&per_page=200`);
    const L = (r.j && r.j.users) || [];
    const u = L.find(x => (x.email || "").toLowerCase() === email);
    if (u || L.length < 200) return u || null;
  }
  return null;
}
async function papel(uid){
  const r = await call(`/rest/v1/profiles?select=role&id=eq.${encodeURIComponent(uid)}`);
  return r.ok && r.j[0] ? r.j[0].role : null;
}
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({message: "Método inválido"});
  if (!URL_() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(503).json({message: "Falta configurar SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY na Vercel."});
  const who = await caller(req).catch(() => null);
  if (!who) return res.status(401).json({message: "Sessão expirada. Entre de novo."});
  if (who.role !== "admin") return res.status(403).json({message: "Só o gestor pode mexer em acessos."});
  const b = body(req), acao = b.acao;
  const senha = String(b.senha || "").replace(/\D/g, "");
  try {
    if (acao === "criar"){
      const email = String(b.email || "").trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({message: "E-mail inválido."});
      if (senha.length !== 11) return res.status(400).json({message: "O CPF precisa ter 11 números."});
      let r = await call(`/auth/v1/admin/users`, {method: "POST", body: JSON.stringify({email, password: senha, email_confirm: true, user_metadata: {nome: b.nome || "", usuario_id: b.usuario_id || ""}})});
      let id = r.ok ? r.j.id : null, existia = false;
      if (!r.ok){
        const ex = (r.status === 422 || r.status === 400) ? await porEmail(email) : null;
        if (!ex) return res.status(400).json({message: (r.j && (r.j.msg || r.j.message)) || "Não foi possível criar o acesso."});
        if (await papel(ex.id) === "admin") return res.status(400).json({message: "Esse e-mail é de um gestor."});
        const u = await call(`/auth/v1/admin/users/${ex.id}`, {method: "PUT", body: JSON.stringify({password: senha, email_confirm: true})});
        if (!u.ok) return res.status(400).json({message: "O e-mail já existia e não foi possível redefinir a senha."});
        id = ex.id; existia = true;
      }
      await call(`/rest/v1/profiles?on_conflict=id`, {method: "POST", headers: {Prefer: "resolution=merge-duplicates,return=minimal"}, body: JSON.stringify([{id, email, role: "corretor", nome: String(b.nome || "").slice(0, 80), usuario_id: String(b.usuario_id || "")}])});
      return res.status(200).json({id, existia});
    }
    const uid = String(b.uid || "");
    if (!/^[0-9a-f-]{36}$/i.test(uid)) return res.status(400).json({message: "Acesso não encontrado."});
    if (await papel(uid) === "admin") return res.status(400).json({message: "Não é possível alterar o acesso de um gestor por aqui."});
    if (acao === "senha"){
      if (senha.length !== 11) return res.status(400).json({message: "O CPF precisa ter 11 números."});
      const r = await call(`/auth/v1/admin/users/${uid}`, {method: "PUT", body: JSON.stringify({password: senha})});
      return r.ok ? res.status(200).json({ok: true}) : res.status(400).json({message: "Não foi possível redefinir a senha."});
    }
    if (acao === "remover"){
      const r = await call(`/auth/v1/admin/users/${uid}`, {method: "DELETE"});
      await call(`/rest/v1/docs?collection=eq.portal&id=eq.${uid}`, {method: "DELETE"});
      return r.ok || r.status === 404 ? res.status(200).json({ok: true}) : res.status(400).json({message: "Não foi possível remover o acesso."});
    }
    return res.status(400).json({message: "Ação inválida."});
  } catch (e){
    return res.status(500).json({message: "Erro no servidor: " + (e && e.message || e)});
  }
};
