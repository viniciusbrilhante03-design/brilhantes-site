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
