/* Brilhante's IA — central de inteligência dos corretores (texto + voz, núcleo animado, cards interativos).
   Usa somente dados reais do sistema: loteamentos (públicos), vendas/comissões do próprio corretor, agenda e clientes dele. */
"use strict";
(function(){
const BIA = window.BIA = {msgs: [], hist: [], state: "pronto", mounted: false, view: null, lotPick: null, as: null, agenda: null, agendaLoaded: false, busy: false,
  set: {voz: true, natural: true, visual: "nucleo", conversa: false}};
try { Object.assign(BIA.set, JSON.parse(localStorage.getItem("bia.set") || "{}")); } catch {}
const saveSet = () => { try { localStorage.setItem("bia.set", JSON.stringify(BIA.set)); } catch {} };
const E = s => esc(s == null ? "" : String(s));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const EAGLE = "/aguia.webp";
const eagleImg = new Image(); eagleImg.src = EAGLE;

/* ================= estilos ================= */
const CSS = `
.bia{--g:#E9C46A;--g2:#B8892B;--r:#E1251B;--r2:#8E120C;--bg:#07090A;--glass:rgba(16,18,20,.72);--line:rgba(233,196,106,.22);--txt:#F3EBDD;--mut:#A79F92;
  position:relative;color:var(--txt);background:radial-gradient(1200px 600px at 50% -10%,rgba(225,37,27,.18),transparent 60%),radial-gradient(900px 500px at 50% 110%,rgba(233,196,106,.10),transparent 60%),var(--bg);
  border:1px solid var(--line);border-radius:18px;overflow:hidden;font-family:var(--f-body)}
.bia *{box-sizing:border-box}
.bia button{font:inherit;color:inherit}
.bia-grid{display:grid;grid-template-columns:210px minmax(0,1fr) minmax(0,430px);height:clamp(680px,calc(100vh - 150px),1000px)}
.bia-menu{border-right:1px solid var(--line);padding:16px 12px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;background:linear-gradient(180deg,rgba(255,255,255,.02),transparent)}
.bia-brand{display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px 0 14px;border-bottom:1px solid var(--line);margin-bottom:8px}
.bia-brand img{width:96px;filter:drop-shadow(0 0 14px rgba(233,196,106,.45))}
.bia-brand b{font-family:Georgia,"Times New Roman",serif;letter-spacing:.08em;font-size:17px;background:linear-gradient(180deg,#FFF1C2,#E9C46A 45%,#9E7424);-webkit-background-clip:text;background-clip:text;color:transparent}
.bia-brand small{font-size:10px;letter-spacing:.28em;color:var(--mut)}
.bia-mi{display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:10px 11px;border-radius:12px;border:1px solid transparent;background:none;cursor:pointer;font-size:13.5px;font-weight:600;transition:.2s}
.bia-mi svg{flex:0 0 auto;color:var(--g)}
.bia-mi:hover{background:rgba(233,196,106,.07);border-color:var(--line)}
.bia-mi.on{background:linear-gradient(90deg,rgba(225,37,27,.35),rgba(225,37,27,.08));border-color:rgba(225,37,27,.7);box-shadow:0 0 18px rgba(225,37,27,.35),inset 0 0 12px rgba(225,37,27,.2)}
.bia-me{margin-top:auto;border:1px solid var(--line);border-radius:12px;padding:10px;font-size:12.5px;display:flex;flex-direction:column;gap:6px}
.bia-me select{width:100%;background:#0d0f10;color:var(--txt);border:1px solid var(--line);border-radius:8px;padding:6px;font-size:12.5px}
.bia-center{position:relative;display:flex;flex-direction:column;min-width:0;min-height:0;overflow-y:auto}
.bia-head{text-align:center;padding:18px 12px 0}
.bia-title{margin:0;font-family:Georgia,"Times New Roman",serif;font-size:clamp(26px,3.4vw,44px);letter-spacing:.06em;line-height:1;background:linear-gradient(180deg,#FFF6D8 0%,#F0CF79 40%,#B8892B 75%,#E9C46A 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 2px 10px rgba(233,196,106,.25))}
.bia-title span{background:linear-gradient(180deg,#FF6B5E,#E1251B 60%,#8E120C);-webkit-background-clip:text;background-clip:text}
.bia-sub{margin:8px 0 0;letter-spacing:.22em;font-size:11.5px;color:#E8DDC8}
.bia-stage{position:relative;flex:0 0 auto;height:clamp(380px,54vh,580px);display:grid;place-items:center}
.bia-stage canvas{width:100%;height:100%;position:absolute;inset:0}
.bia-float{position:absolute;z-index:2;width:clamp(150px,15vw,205px);padding:11px 13px;border-radius:14px;border:1px solid rgba(225,37,27,.55);background:linear-gradient(135deg,rgba(30,8,8,.78),rgba(10,10,10,.6));box-shadow:0 0 16px rgba(225,37,27,.35),inset 0 0 14px rgba(225,37,27,.12);cursor:pointer;text-align:left;display:flex;gap:10px;align-items:flex-start;transition:transform .25s,box-shadow .25s;animation:biaHover 6s ease-in-out infinite}
.bia-float:hover{transform:scale(1.05);box-shadow:0 0 28px rgba(225,37,27,.6),inset 0 0 14px rgba(225,37,27,.2)}
.bia-float b{display:block;font-size:12.5px;letter-spacing:.04em;text-transform:uppercase;color:#FFF}
.bia-float small{display:block;font-size:11px;color:var(--mut);margin-top:2px;line-height:1.3}
.bia-float svg{color:var(--g);flex:0 0 auto;margin-top:2px}
@keyframes biaHover{0%,100%{translate:0 0}50%{translate:0 -6px}}
.bia-status{position:absolute;bottom:16px;left:0;right:0;text-align:center;z-index:2;pointer-events:none}
.bia-status b{display:inline-flex;gap:12px;align-items:center;letter-spacing:.16em;font-size:14px;color:var(--g);text-shadow:0 0 12px rgba(233,196,106,.5)}
.bia-status b i{display:inline-flex;gap:2px;align-items:center;height:18px}
.bia-status b i u{display:block;width:3px;background:var(--r);border-radius:2px;height:30%;text-decoration:none;animation:biaBar 1s ease-in-out infinite}
@keyframes biaBar{0%,100%{height:25%}50%{height:100%}}
.bia-status small{display:block;color:var(--mut);font-size:12.5px;margin-top:4px}
.bia-widgets{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:12px}
.bia-w{border:1px solid var(--line);border-radius:14px;background:var(--glass);padding:12px;min-width:0}
.bia-w h4{margin:0 0 8px;font-size:13.5px;display:flex;justify-content:space-between;align-items:center;gap:8px}
.bia-w h4 button{border:1px solid var(--line);background:none;border-radius:8px;padding:3px 8px;font-size:11px;cursor:pointer;color:var(--mut)}
.bia-tile{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:9px 11px;border-radius:10px;margin-top:6px;font-size:12.5px;border:1px solid}
.bia-tile b{font-size:16px;font-variant-numeric:tabular-nums}
.t-ok{border-color:rgba(46,204,113,.45);background:rgba(46,204,113,.08)} .t-ok b{color:#5BE39A}
.t-wait{border-color:rgba(233,196,106,.45);background:rgba(233,196,106,.08)} .t-wait b{color:var(--g)}
.t-run{border-color:rgba(80,140,255,.45);background:rgba(80,140,255,.08)} .t-run b{color:#8DB4FF}
.bia-li{display:flex;gap:9px;align-items:center;padding:7px 4px;border-bottom:1px solid rgba(255,255,255,.05);font-size:12.5px;cursor:pointer;border-radius:8px}
.bia-li:hover{background:rgba(255,255,255,.04)}
.bia-av{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#1c1f22;border:1px solid var(--line);font-size:11px;font-weight:700;flex:0 0 auto}
.bia-chat{border-left:1px solid var(--line);display:flex;flex-direction:column;min-width:0;min-height:0;background:linear-gradient(180deg,rgba(255,255,255,.015),transparent);position:relative}
.bia-ch{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--line)}
.bia-ch img{width:40px;height:40px;object-fit:contain;border-radius:50%;background:radial-gradient(circle,#2a0a08,#0a0a0a);border:1px solid var(--line);padding:4px}
.bia-ch b{font-size:15px} .bia-ch small{display:block;color:var(--mut);font-size:11.5px}
.bia-ch .dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#2ECC71;box-shadow:0 0 8px #2ECC71;margin-left:6px}
.bia-ib{width:32px;height:32px;border-radius:9px;border:1px solid var(--line);background:none;cursor:pointer;display:grid;place-items:center;color:var(--mut)}
.bia-ib.on{color:var(--g);border-color:var(--g)}
.bia-msgs{flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:12px;scroll-behavior:smooth}
.bia-m{display:flex;gap:8px;align-items:flex-start;animation:biaIn .35s ease both}
.bia-m.me{justify-content:flex-end}
.bia-m .av{width:30px;height:30px;flex:0 0 auto;object-fit:contain;filter:drop-shadow(0 0 6px rgba(233,196,106,.4))}
.bia-b{max-width:100%;padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.07);font-size:13.5px;line-height:1.5;overflow-wrap:anywhere;min-width:0}
.bia-m.me .bia-b{background:linear-gradient(135deg,#C8221A,#8E120C);border-color:transparent;color:#fff;max-width:85%}
.bia-body{display:flex;flex-direction:column;gap:8px;min-width:0;flex:1}
@keyframes biaIn{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}
.bia-rev{animation:biaIn .45s ease both}
.bia-chips{display:flex;flex-wrap:wrap;gap:6px}
.bia-chip{border:1px solid var(--line);background:rgba(255,255,255,.03);border-radius:999px;padding:6px 11px;font-size:12px;cursor:pointer;transition:.15s;white-space:nowrap}
.bia-chip:hover{border-color:var(--g);color:var(--g);box-shadow:0 0 10px rgba(233,196,106,.25)}
.bia-chip.red{background:linear-gradient(135deg,#C8221A,#8E120C);border-color:transparent;color:#fff}
.bia-cards{display:flex;gap:10px;overflow-x:auto;padding:2px 2px 8px;scroll-snap-type:x mandatory}
.bia-card{flex:0 0 190px;scroll-snap-align:start;border:1px solid var(--line);border-radius:14px;overflow:hidden;background:#0d0f10;cursor:pointer;transition:.2s;display:flex;flex-direction:column}
.bia-card:hover,.bia-card.sel{border-color:var(--r);box-shadow:0 0 18px rgba(225,37,27,.45);transform:translateY(-2px)}
.bia-card .ph{aspect-ratio:16/10;background:linear-gradient(135deg,#2a0a08,#141414) center/cover}
.bia-card .bd{padding:9px 10px;display:flex;flex-direction:column;gap:3px;flex:1;font-size:11.5px;color:var(--mut)}
.bia-card .bd b{color:#fff;font-size:13px}
.bia-card .bd i{font-style:normal;display:flex;gap:6px;align-items:baseline}
.bia-card .bd i:before{content:"◆";color:var(--g);font-size:8px}
.bia-card .go{margin:6px 10px 10px;border:0;border-radius:9px;padding:7px;font-size:12px;font-weight:700;background:linear-gradient(180deg,#F5D27A,#C99A35);color:#1a1205;cursor:pointer}
.bia-tbl{width:100%;border-collapse:collapse;font-size:12.5px}
.bia-tbl td,.bia-tbl th{padding:7px 8px;border-bottom:1px solid rgba(255,255,255,.06);text-align:left;vertical-align:top}
.bia-tbl th{color:var(--mut);font-weight:600;font-size:11.5px}
.bia-tbl td.v{font-weight:600;color:#fff;font-variant-numeric:tabular-nums}
.bia-box{border:1px solid var(--line);border-radius:14px;background:rgba(10,10,10,.55);padding:12px}
.bia-box h5{margin:0 0 8px;font-size:12px;letter-spacing:.12em;color:var(--g);text-transform:uppercase}
.bia-kv{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.bia-kv div{border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:8px 9px;background:rgba(255,255,255,.02)}
.bia-kv span{display:block;font-size:10.5px;color:var(--mut);text-transform:uppercase;letter-spacing:.06em}
.bia-kv b{font-size:13.5px;color:#fff;font-weight:650}
.bia-pill{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:3px 9px;font-size:11.5px;margin:0 4px 4px 0;background:rgba(233,196,106,.06)}
.bia-task{display:flex;gap:9px;align-items:center;padding:8px;border-radius:10px;border:1px solid rgba(255,255,255,.06);margin-bottom:6px;background:rgba(255,255,255,.02)}
.bia-task input{width:18px;height:18px;accent-color:#E1251B}
.bia-task.done b{text-decoration:line-through;color:var(--mut)}
.bia-task time{font-variant-numeric:tabular-nums;color:var(--g);font-size:12px;min-width:44px}
.bia-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.bia-form label{display:flex;flex-direction:column;gap:4px;font-size:11.5px;color:var(--mut)}
.bia-form input,.bia-form select,.bia-form textarea{background:#0b0d0e;border:1px solid var(--line);color:var(--txt);border-radius:9px;padding:8px;font:inherit;font-size:13px}
.bia-form .full{grid-column:1/-1}
.bia-btn{border:1px solid var(--line);background:rgba(255,255,255,.04);border-radius:10px;padding:8px 12px;font-size:12.5px;font-weight:650;cursor:pointer}
.bia-btn.gold{background:linear-gradient(180deg,#F5D27A,#C99A35);color:#1a1205;border:0}
.bia-btn.red{background:linear-gradient(135deg,#C8221A,#8E120C);color:#fff;border:0}
.bia-input{display:flex;gap:8px;align-items:center;padding:10px 12px;border-top:1px solid var(--line)}
.bia-input input{flex:1;min-width:0;background:#0b0d0e;border:1px solid var(--line);border-radius:12px;padding:12px 13px;color:var(--txt);font:inherit;font-size:14px}
.bia-input input:focus{outline:none;border-color:var(--g);box-shadow:0 0 0 3px rgba(233,196,106,.15)}
.bia-mic{width:46px;height:46px;border-radius:50%;border:2px solid var(--r);background:radial-gradient(circle,#3a0906,#140404);cursor:pointer;display:grid;place-items:center;color:#fff;flex:0 0 auto;box-shadow:0 0 14px rgba(225,37,27,.5)}
.bia-mic.live{animation:biaMic 1.1s infinite;background:var(--r)}
@keyframes biaMic{0%{box-shadow:0 0 0 0 rgba(225,37,27,.7)}100%{box-shadow:0 0 0 18px rgba(225,37,27,0)}}
.bia-send{width:42px;height:42px;border-radius:12px;border:1px solid var(--line);background:none;cursor:pointer;display:grid;place-items:center;color:var(--g)}
.bia-typing{display:inline-flex;gap:4px;align-items:center;color:var(--g);font-size:12.5px;letter-spacing:.12em}
.bia-typing i{width:6px;height:6px;border-radius:50%;background:var(--g);animation:biaDot 1s infinite}
.bia-typing i:nth-child(2){animation-delay:.15s}.bia-typing i:nth-child(3){animation-delay:.3s}
@keyframes biaDot{0%,100%{opacity:.25;transform:translateY(0)}50%{opacity:1;transform:translateY(-3px)}}
.bia-panel{position:absolute;inset:0;z-index:20;background:#07090A;display:flex;flex-direction:column;transform:translateX(100%);visibility:hidden;transition:transform .38s cubic-bezier(.2,.8,.2,1)}
.bia-panel.open{transform:none;visibility:visible}
.bia-panel .hero{position:relative;height:200px;background:#141414 center/cover;flex:0 0 auto}
.bia-panel .hero:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.1),rgba(7,9,10,.95))}
.bia-panel .hero div{position:absolute;left:16px;bottom:12px;right:16px;z-index:1}
.bia-panel .hero b{display:block;margin-bottom:4px;font-size:20px;font-family:Georgia,serif;letter-spacing:.03em;color:#FFF3D6}
.bia-panel .close{position:absolute;top:10px;right:10px;z-index:2;background:rgba(0,0,0,.6);border:1px solid var(--line);border-radius:10px;width:34px;height:34px;cursor:pointer;color:#fff}
.bia-ptabs{display:flex;gap:4px;overflow-x:auto;padding:8px 12px;border-bottom:1px solid var(--line);flex:0 0 auto}
.bia-ptabs button{border:1px solid transparent;background:none;border-radius:9px;padding:7px 10px;font-size:12.5px;cursor:pointer;white-space:nowrap;color:var(--mut)}
.bia-ptabs button.on{color:#fff;border-color:var(--r);background:rgba(225,37,27,.15)}
.bia-pbody{flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:12px}
.bia-gal{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.bia-gal img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px;cursor:zoom-in;border:1px solid rgba(255,255,255,.06)}
.bia-lb{position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.92);display:grid;place-items:center;padding:20px;cursor:zoom-out}
.bia-lb img{max-width:100%;max-height:90vh;border-radius:10px}
.bia-pill2{position:fixed;right:16px;bottom:16px;z-index:60;display:none;align-items:center;gap:10px;background:rgba(10,10,10,.95);border:1px solid var(--line);border-radius:999px;padding:6px 14px 6px 6px;box-shadow:0 10px 30px #000a}
.bia-pill2 canvas{width:110px;height:34px}
.bia-pill2 img{width:38px;height:38px;object-fit:contain;border-radius:50%;background:#1a0505}
.bia.compact .bia-stage,.bia.compact .bia-floats{display:none}
.bia.compact .bia-grid{grid-template-columns:210px minmax(0,1fr) minmax(0,430px)}
.bia-set{position:absolute;right:12px;top:58px;z-index:25;width:250px;border:1px solid var(--line);border-radius:12px;background:#0d0f10;padding:12px;display:flex;flex-direction:column;gap:10px;font-size:12.5px;box-shadow:0 12px 30px #000c}
.bia-set label{display:flex;justify-content:space-between;align-items:center;gap:8px}
.bia-seg{display:inline-flex;border:1px solid var(--line);border-radius:9px;overflow:hidden}
.bia-seg button{border:0;background:none;padding:5px 9px;font-size:11.5px;cursor:pointer;color:var(--mut)}
.bia-seg button.on{background:rgba(233,196,106,.15);color:var(--g)}
.bia-cmp th{min-width:110px}
@media (max-width:1200px){.bia-grid{grid-template-columns:minmax(0,1fr) minmax(0,420px)}.bia-menu{display:none}.bia-mobmenu{display:flex!important}}
@media (max-width:860px){.bia-grid{grid-template-columns:minmax(0,1fr);height:auto}.bia-center{overflow:visible}.bia-chat{border-left:0;border-top:1px solid var(--line);height:82vh}.bia-float{display:none}.bia-stage{height:320px}.bia-widgets{grid-template-columns:minmax(0,1fr)}}
.bia-mobmenu{display:none;gap:6px;overflow-x:auto;padding:10px 12px 0}
.bia-mobmenu .bia-chip{flex:0 0 auto}
@media (prefers-reduced-motion:reduce){.bia *{animation:none!important;transition:none!important}}
`;
function addCSS(){ if (!document.getElementById("bia-css")) document.head.appendChild(Object.assign(document.createElement("style"), {id: "bia-css", textContent: CSS})); }

/* ================= ícones ================= */
const I = {
  lot: '<path d="M3 11 12 4l9 7M5 10v10h14V10M10 20v-6h4v6"/>',
  preco: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
  com: '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .9-3 2s1.3 1.7 3 2 3 .9 3 2-1.3 2-3 2c-1.4 0-2.5-.6-3-1.5M12 6v2M12 16v2"/>',
  ag: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M8 14h2M14 14h2M8 17h2"/>',
  duv: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M9.5 9.5a2.5 2.5 0 0 1 4.8 1c0 1.6-2.3 2-2.3 3.5M12 17h.01"/>',
  cli: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5c2 .7 3.2 2.6 3.5 5.5"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  send: '<path d="M4 12 20 4l-6 16-3-7-7-1z"/>',
  som: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  mudo: '<path d="M4 9v6h4l5 4V5L8 9H4zM17 9l5 5M22 9l-5 5"/>',
  cfg: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  pin: '<path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  wa: '<path d="M20.5 3.5A11 11 0 0 0 3.2 17L2 22l5.2-1.4A11 11 0 0 0 20.5 3.5z"/><path d="M8.5 7.5c.3-.6.6-.6 1-.6h.6c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .6l-.5.7c-.1.2-.2.3 0 .6.7 1.2 1.7 2.2 2.9 2.8.3.2.5.1.6 0l.7-.8c.2-.2.4-.2.6-.1l1.9.9c.3.1.4.3.4.5 0 .5-.2 1.4-1 1.9-.7.4-1.7.5-3.2-.1A11 11 0 0 1 7.3 11c-.6-1.2-.8-2.6 1.2-3.5z"/>'
};
const ic = (k, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[k]}</svg>`;
const MENU = [
  ["lot", "Informações de Loteamentos", "Detalhes, diferenciais, infraestrutura e localização.", "lotes"],
  ["preco", "Tabela de Preços", "Valores, condições e parcelas.", "precos"],
  ["com", "Comissões", "Acompanhe suas vendas e comissões.", "comissoes"],
  ["ag", "Agenda e Tarefas", "Visitas, retornos e tarefas do dia.", "agenda"],
  ["duv", "Tirar Dúvidas", "Pergunte sobre qualquer loteamento.", "duvidas"],
  ["cli", "Clientes", "Seus clientes e contatos.", "clientes"]
];

/* ================= dados (sempre do próprio sistema) ================= */
const D = {
  previewUser(){ if (!isAdmin) return null; const L = teamList().filter(t => t.active && t.src === "usuarios"); return L.find(t => t.id === BIA.as) || L[0] || null; },
  portal(){
    if (!isAdmin) return PORTAL || {vendas: [], metas: [], avisos: [], nome: (me && me.name) || "Corretor"};
    const t = D.previewUser(); if (!t) return {vendas: [], metas: [], avisos: [], nome: "Gestor"};
    if (!D._pc || D._pc.id !== t.id || D._pc.at < Date.now() - 4000) D._pc = {id: t.id, at: Date.now(), p: portalFor(t.doc)};
    return D._pc.p;
  },
  nome(){ const p = D.portal(); return (p.nome || "").trim() || "Corretor"; },
  lots(){
    if (D._lc && D._lc.at > Date.now() - 3000 && D._lc.src === (isAdmin ? "adm" : PUB.lots)) return D._lc.v;
    const L = isAdmin ? slimLots() : (PUB.lots || []);
    const out = L.map(l => { const s = l.specs || {}, loc = s.localizacao || {}, com = s.comercial || {}, tec = s.tecnicos || {}, med = l.media || [];
      const fotos = med.filter(m => ["foto","planta","arte"].includes(m.kind) && (m.asset_id || m.url));
      const cover = (med.find(m => m.cover && m.kind === "foto") || fotos.find(m => m.kind === "foto") || fotos[0]);
      return {...l, cidade: (loc.cidade || "").trim(), estado: (loc.estado || "").trim(), bairro: (loc.bairro || "").trim(), tipo: tec.tipo || "", com, tec, loc, obra: s.obra || {}, infra: infraList(s), fotos, cover: cover ? blobUrl(cover) : "", docs: med.filter(m => m.kind === "doc" && (m.asset_id || m.url)), videos: med.filter(m => (m.kind === "video" || m.kind === "video_link") && (m.asset_id || m.url)), c: lotCoords(l)}; });
    D._lc = {at: Date.now(), src: isAdmin ? "adm" : PUB.lots, v: out}; return out;
  },
  lot(q){ const k = norm(q); const L = D.lots(); return L.find(l => norm(l.name) === k) || L.find(l => norm(l.name).includes(k)) || L.find(l => k.includes(norm(l.name))) || null; },
  vendas(){ return (D.portal().vendas || []); },
  comissoes(m, y){
    const V = D.vendas().filter(v => !v.cancelled && (!y || inPeriod(v, +m || 0, +y)));
    const r = V.reduce((a, v) => ({pagas: a.pagas + N(v.rec), aReceber: a.aReceber + Math.max(N(v.comm) - N(v.rec), 0), vencido: a.vencido + N(v.venc), total: a.total + N(v.comm), vgv: a.vgv + N(v.sale_value) * (v.share || 1)}), {pagas: 0, aReceber: 0, vencido: 0, total: 0, vgv: 0});
    r.andamento = V.filter(v => N(v.comm) - N(v.rec) > 0.01).length; r.qtd = V.reduce((a, v) => a + (v.share || 1), 0); r.lista = V; return r;
  },
  clientes(){
    const m = new Map();
    for (const v of D.vendas()){ const n = (v.client_name || "").trim(); if (!n) continue; const k = norm(n), c = m.get(k) || {nome: n, fone: "", compras: [], ultima: ""}; if (!c.fone && v.client_phone) c.fone = v.client_phone; c.compras.push(v); if ((v.sale_date || "") > c.ultima) c.ultima = v.sale_date; m.set(k, c); }
    for (const a of D.agendaItems()){ const n = (a.client_name || "").trim(); if (!n) continue; const k = norm(n); if (!m.has(k)) m.set(k, {nome: n, fone: "", compras: [], ultima: (a.when || "").slice(0, 10), soAgenda: true}); }
    return [...m.values()].sort((a, b) => (b.ultima || "").localeCompare(a.ultima || ""));
  },
  agendaItems(){
    if (isAdmin){ const t = D.previewUser(); return [...st.agenda.values()].filter(a => !a.deleted_at && (!t || a.owner_id === t.id || norm(a.owner_name) === norm(t.name))); }
    return (BIA.agenda || []).filter(a => !a.deleted_at);
  },
  async loadAgenda(){
    if (isAdmin || BIA.agendaLoaded) return;
    try { const snap = await db.collection("agenda").where("id", ">", "").orderBy("id").limit(500).get(); BIA.agenda = snap.docs.map(d => d.data()); } catch { BIA.agenda = []; }
    BIA.agendaLoaded = true;
  },
  async salvarAgenda(doc){
    if (isAdmin){ const t = D.previewUser(); const d = {...doc, owner_id: doc.owner_id || (t ? t.id : "owner"), owner_name: doc.owner_name || (t ? t.name : "")}; saveDoc("agenda", d); return d; }
    const tk = await window.__bri.token();
    const r = await fetch("/api/corretor", {method: "POST", headers: {"Content-Type": "application/json", Authorization: "Bearer " + tk}, body: JSON.stringify({acao: "agenda", doc})});
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.message || "Não foi possível salvar.");
    BIA.agenda = [...(BIA.agenda || []).filter(a => a.id !== j.doc.id), j.doc];
    return j.doc;
  },
  ranking(){ const r = PUB.rank && PUB.rank.meses ? (PUB.rank.meses[+T.slice(5, 7)] || {}).corretores || [] : (isAdmin ? rankSnapshot().meses[+T.slice(5, 7)]?.corretores || [] : []); return r; }
};
BIA.D = D;
const iniciais = n => String(n || "?").trim().split(/\s+/).slice(0, 2).map(x => x[0]).join("").toUpperCase();
const hojeStr = () => T;
const hora = w => String(w || "").slice(11, 16);

/* ================= núcleo animado (orb) ================= */
const ORB = {cv: null, cx: null, raf: 0, level: 0, target: 0, t: 0, waves: [], parts: [], flash: 0, analyser: null, mic: null};
for (let i = 0; i < 170; i++) ORB.parts.push({a: Math.random() * 6.283, r: 0.75 + Math.random() * 0.95, sp: (0.0015 + Math.random() * 0.004) * (Math.random() < .5 ? -1 : 1), z: Math.random(), y: (Math.random() - .5) * 0.5, rise: Math.random() < 0.22});
const STC = {pronto: [233,196,106], ouvindo: [225,37,27], analisando: [245,197,66], respondendo: [255,214,120], finalizado: [120,230,160]};
function orbLevel(){
  if (ORB.analyser){ const a = ORB.analyser, d = new Uint8Array(a.frequencyBinCount); a.getByteFrequencyData(d); let s = 0; for (let i = 2; i < 48; i++) s += d[i]; return Math.min(1, s / 46 / 150); }
  return null;
}
function drawOrb(){
  const cv = ORB.cv; if (!cv || !cv.isConnected){ ORB.raf = 0; return; }
  const dpr = Math.min(devicePixelRatio || 1, 2), r = cv.getBoundingClientRect();
  if (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr)){ cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
  const c = ORB.cx, W = cv.width, H = cv.height, st = BIA.state, col = STC[st] || STC.pronto;
  ORB.t += 1 / 60; const t = ORB.t;
  const real = orbLevel();
  if (real != null) ORB.target = real;
  else if (st === "respondendo") ORB.target = Math.max(ORB.target * 0.93, 0.18 + Math.random() * 0.3);
  else if (st === "ouvindo") ORB.target = 0.22 + Math.abs(Math.sin(t * 3)) * 0.18;
  else if (st === "analisando") ORB.target = 0.25;
  else ORB.target = 0.06;
  ORB.level += (ORB.target - ORB.level) * 0.18; const L = ORB.level;
  const R = Math.min(W, H * 1.05) * 0.2, cxp = W / 2, cyp = H * 0.47;
  c.clearRect(0, 0, W, H); c.save(); c.translate(cxp, cyp);
  const rgba = (a, k = col) => `rgba(${k[0]},${k[1]},${k[2]},${a})`;
  // halo
  let g = c.createRadialGradient(0, 0, R * 0.3, 0, 0, R * 2.6); g.addColorStop(0, rgba(0.22 + L * 0.3)); g.addColorStop(0.5, `rgba(225,37,27,${0.08 + L * 0.12})`); g.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, R * 2.6, 0, 6.283); c.fill();
  // plataforma (perspectiva)
  c.save(); c.translate(0, R * 1.62); c.scale(1, 0.28);
  for (let i = 0; i < 4; i++){ c.beginPath(); c.arc(0, 0, R * (1.15 + i * 0.32), 0, 6.283); c.strokeStyle = i % 2 ? `rgba(225,37,27,${0.35 - i * 0.05})` : rgba(0.45 - i * 0.07, [233,196,106]); c.lineWidth = (i === 0 ? 5 : 2) * (W / 900); c.stroke(); }
  g = c.createRadialGradient(0, 0, 0, 0, 0, R * 1.2); g.addColorStop(0, `rgba(255,210,120,${0.45 + L * 0.4})`); g.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g; c.beginPath(); c.arc(0, 0, R * 1.2, 0, 6.283); c.fill();
  c.restore();
  // feixe de luz
  g = c.createLinearGradient(0, R * 1.6, 0, R * 0.3); g.addColorStop(0, `rgba(255,190,90,${0.35 + L * 0.3})`); g.addColorStop(1, "rgba(255,190,90,0)"); c.fillStyle = g; c.beginPath(); c.moveTo(-R * 0.22, R * 1.62); c.lineTo(R * 0.22, R * 1.62); c.lineTo(R * 0.06, R * 0.4); c.lineTo(-R * 0.06, R * 0.4); c.fill();
  // ondas de energia
  if ((st === "respondendo" && Math.random() < 0.08 + L * 0.25) || (st === "ouvindo" && Math.random() < 0.06)) ORB.waves.push({r: R * 1.02, a: 0.65, red: st === "ouvindo"});
  ORB.waves = ORB.waves.filter(w => { w.r += R * 0.022 * (1 + L); w.a *= 0.965; c.beginPath(); c.arc(0, 0, w.r, 0, 6.283); c.strokeStyle = w.red ? `rgba(225,37,27,${w.a})` : rgba(w.a, [245,200,110]); c.lineWidth = 2 * (W / 900); c.stroke(); return w.a > 0.03 && w.r < R * 2.6; });
  // anéis
  const spin = st === "analisando" ? 4 : st === "respondendo" ? 1.6 : 1;
  const ring = (rad, w, rot, dash, color) => { c.save(); c.rotate(rot); c.setLineDash(dash.map(v => v * R / 100)); c.lineWidth = w * (W / 900); c.strokeStyle = color; c.beginPath(); c.arc(0, 0, rad, 0, 6.283); c.stroke(); c.restore(); };
  ring(R * 1.18, 6, t * 0.25 * spin, [70, 10, 6, 10], rgba(0.85, [233,196,106]));
  ring(R * 1.3, 2, -t * 0.4 * spin, [3, 6], `rgba(225,37,27,0.8)`);
  ring(R * 1.45 + L * R * 0.08, 3, t * 0.15 * spin, [120, 30, 20, 30], rgba(0.55, [233,196,106]));
  ring(R * 1.62, 1.5, -t * 0.1, [2, 14], rgba(0.5, [233,196,106]));
  // marcas tipo mira
  c.save(); c.rotate(-t * 0.2 * spin); c.strokeStyle = "rgba(225,37,27,.85)"; c.lineWidth = 3 * (W / 900);
  for (let i = 0; i < 4; i++){ c.rotate(Math.PI / 2); c.beginPath(); c.arc(0, 0, R * 1.36, -0.25, 0.25); c.stroke(); }
  c.restore();
  // analisando: varredura
  if (st === "analisando"){ c.save(); c.rotate(t * 3.2); const sw = c.createLinearGradient(0, 0, R * 1.5, 0); sw.addColorStop(0, "rgba(255,210,120,.0)"); sw.addColorStop(1, "rgba(255,210,120,.35)"); c.fillStyle = sw; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R * 1.5, -0.35, 0); c.closePath(); c.fill(); c.lineWidth = 5 * (W / 900); c.strokeStyle = "rgba(255,220,140,.95)"; c.beginPath(); c.arc(0, 0, R * 1.24, 0, 1.1); c.stroke(); c.restore(); }
  // barras de áudio circulares
  const n = 72; c.save();
  for (let i = 0; i < n; i++){ const a = i / n * 6.283, v = (st === "respondendo" || st === "ouvindo") ? (0.15 + Math.abs(Math.sin(i * 0.9 + t * 8)) * 0.5 + Math.random() * 0.35) * L : 0.04; const r0 = R * 1.03, r1 = r0 + R * 0.35 * v + R * 0.02;
    c.strokeStyle = st === "ouvindo" ? `rgba(255,80,60,${0.5 + v})` : rgba(0.45 + v, [255,214,120]); c.lineWidth = 2.2 * (W / 900); c.beginPath(); c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); c.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); c.stroke(); }
  c.restore();
  // partículas
  for (const p of ORB.parts){ p.a += p.sp * (1 + L * 4) * spin; let x, y; if (p.rise){ p.y -= 0.004 + L * 0.01; if (p.y < -1.4) p.y = 0.9; x = Math.cos(p.a) * R * 0.5 * p.r; y = R * 1.5 * p.y; } else { x = Math.cos(p.a) * R * p.r * 1.25; y = Math.sin(p.a) * R * p.r * 0.95 + p.y * R * 0.2; }
    const s = (1 + p.z * 2.4) * (W / 900); c.fillStyle = p.z > 0.7 ? `rgba(225,60,40,${0.4 + p.z * 0.5})` : rgba(0.35 + p.z * 0.6, [255,215,130]); c.beginPath(); c.arc(x, y, s, 0, 6.283); c.fill(); }
  // núcleo de vidro
  g = c.createRadialGradient(-R * 0.3, -R * 0.35, R * 0.05, 0, 0, R); g.addColorStop(0, "rgba(255,240,210,.20)"); g.addColorStop(0.6, "rgba(60,10,8,.55)"); g.addColorStop(1, "rgba(10,4,4,.85)");
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, R * 0.98, 0, 6.283); c.fill();
  c.lineWidth = 3 * (W / 900); c.strokeStyle = rgba(0.75 + L * 0.25); c.stroke();
  // águia
  if (eagleImg.complete && eagleImg.naturalWidth){ const ew = R * 1.55, eh = ew * eagleImg.naturalHeight / eagleImg.naturalWidth, fy = Math.sin(t * 1.4) * R * 0.03;
    c.save(); c.shadowColor = st === "ouvindo" ? "rgba(255,60,40,.9)" : "rgba(255,200,90,.9)"; c.shadowBlur = (18 + L * 50) * (W / 900); c.globalAlpha = 0.92 + L * 0.08; c.drawImage(eagleImg, -ew / 2, -eh / 2 + fy - R * 0.05, ew, eh); c.restore(); }
  // brilho do vidro
  g = c.createLinearGradient(-R, -R, R * 0.2, R * 0.2); g.addColorStop(0, "rgba(255,255,255,.10)"); g.addColorStop(0.5, "rgba(255,255,255,0)"); c.fillStyle = g; c.beginPath(); c.arc(0, 0, R * 0.98, 0, 6.283); c.fill();
  // finalizado: flash
  if (ORB.flash > 0){ c.beginPath(); c.arc(0, 0, R * (1 + (1 - ORB.flash) * 1.4), 0, 6.283); c.strokeStyle = `rgba(150,240,180,${ORB.flash})`; c.lineWidth = 6 * (W / 900); c.stroke(); ORB.flash -= 0.02; }
  c.restore();
  drawPill();
  ORB.raf = requestAnimationFrame(drawOrb);
}
function drawPill(){
  const cv = document.getElementById("biaWave"); if (!cv) return; const c = cv.getContext("2d"), n = 26, bw = cv.width / n; c.clearRect(0, 0, cv.width, cv.height);
  for (let i = 0; i < n; i++){ const h = (0.12 + Math.abs(Math.sin(i * 0.7 + ORB.t * 9)) * (ORB.level * 1.1 + 0.04)) * cv.height; c.fillStyle = BIA.state === "ouvindo" ? "#E1251B" : "#E9C46A"; c.fillRect(i * bw + 2, (cv.height - h) / 2, bw - 4, h); }
}
function startOrb(cv){ ORB.cv = cv; ORB.cx = cv.getContext("2d"); if (!ORB.raf) ORB.raf = requestAnimationFrame(drawOrb); }
BIA.ORB = ORB;

/* ================= estado (PRONTO / OUVINDO / ANALISANDO / RESPONDENDO / FINALIZADO) ================= */
const STXT = {pronto: ["PRONTO PARA AJUDAR", "Clique em uma das opções ou fale sua pergunta."], ouvindo: ["OUVINDO…", "Pode falar, estou ouvindo."], analisando: ["ANALISANDO…", "Consultando os dados do sistema."], respondendo: ["RESPONDENDO…", ""], finalizado: ["FINALIZADO", "Pronto para a próxima pergunta."]};
function setState(s, sub){
  BIA.state = s; if (s === "finalizado"){ ORB.flash = 1; setTimeout(() => { if (BIA.state === "finalizado") setState("pronto"); }, 1600); }
  const el = document.getElementById("biaStatus"); if (el){ const [a, b] = STXT[s]; el.innerHTML = `<b><i>${"<u></u>".repeat(5)}</i>${a}<i>${"<u></u>".repeat(5)}</i></b><small>${E(sub != null ? sub : b)}</small>`; el.querySelectorAll("u").forEach((u, k) => { u.style.animationDelay = (k % 5) * 0.12 + "s"; u.style.animationPlayState = s === "pronto" || s === "finalizado" ? "paused" : "running"; }); }
  const m = document.getElementById("biaMic"); if (m) m.classList.toggle("live", s === "ouvindo");
  const pt = document.getElementById("biaPillTxt"); if (pt) pt.textContent = STXT[s][0];
}

/* ================= layout ================= */
function html(){
  const adminSel = isAdmin ? `<div class="bia-me"><span style="color:var(--mut)">Visualizando como (prévia do gestor)</span><select id="biaAs">${teamList().filter(t => t.active && t.src === "usuarios").map(t => `<option value="${E(t.id)}" ${D.previewUser() && D.previewUser().id === t.id ? "selected" : ""}>${E(t.name)}</option>`).join("")}</select></div>` : `<div class="bia-me"><b>${E(D.nome())}</b><span style="color:var(--mut)">Corretor</span></div>`;
  const floats = [[0, "8%", "6%"], [1, "36%", "3%"], [2, "64%", "6%"], [3, "8%", null], [4, "36%", null], [5, "64%", null]];
  return `<div class="bia ${BIA.set.visual === "compacto" ? "compact" : ""}" id="bia">
    <div class="bia-grid">
      <aside class="bia-menu"><div class="bia-brand"><img src="${EAGLE}" alt=""><b>BRILHANTE'S</b><small>ÁREA DO CORRETOR</small></div>
        ${MENU.map(([k, t, , a]) => `<button class="bia-mi" data-act="${a}">${ic(k)}<span>${t}</span></button>`).join("")}
        ${adminSel}</aside>
      <section class="bia-center">
        <div class="bia-head"><h2 class="bia-title">BRILHANTE'S <span>IA</span></h2><p class="bia-sub">SEU ASSISTENTE EXCLUSIVO PARA CORRETORES</p></div>
        <div class="bia-mobmenu">${MENU.map(([k, t, , a]) => `<button class="bia-chip" data-act="${a}">${t}</button>`).join("")}</div>
        <div class="bia-stage" id="biaStage"><canvas id="biaOrb" aria-hidden="true"></canvas>
          <div class="bia-floats">${floats.map(([i, top, left]) => { const [k, t, d, a] = MENU[i]; return `<button class="bia-float" data-act="${a}" style="top:${top};${left != null ? `left:${left}` : "right:6%"};animation-delay:${i * 0.7}s">${ic(k, 26)}<span><b>${t}</b><small>${d}</small></span></button>`; }).join("")}</div>
          <div class="bia-status" id="biaStatus"></div></div>
        <div class="bia-widgets" id="biaWidgets"></div>
      </section>
      <section class="bia-chat">
        <div class="bia-ch"><img src="${EAGLE}" alt=""><div style="flex:1;min-width:0"><b>Brilhante's IA</b><span class="dot"></span><small>Online · Exclusivo para corretores</small></div>
          <button class="bia-ib ${BIA.set.voz ? "on" : ""}" id="biaVoz" title="Responder por voz" aria-label="Responder por voz">${ic(BIA.set.voz ? "som" : "mudo")}</button>
          <button class="bia-ib" id="biaCfg" title="Ajustes" aria-label="Ajustes">${ic("cfg")}</button></div>
        <div class="bia-msgs" id="biaMsgs" aria-live="polite"></div>
        <div class="bia-input"><button class="bia-mic" id="biaMic" aria-label="Falar com a IA">${ic("mic", 20)}</button><input id="biaQ" placeholder="Digite sua pergunta para a Brilhante's IA…" autocomplete="off"><button class="bia-send" id="biaSend" aria-label="Enviar">${ic("send", 18)}</button></div>
        <div class="bia-panel" id="biaPanel" aria-hidden="true"></div>
      </section>
    </div></div>
    <div class="bia-pill2" id="biaPill"><img src="${EAGLE}" alt=""><canvas id="biaWave" width="220" height="68"></canvas><span id="biaPillTxt" style="font-size:11px;color:#A79F92;letter-spacing:.1em">PRONTO</span></div>`;
}

/* ================= widgets inferiores ================= */
function widgets(){
  const c = D.comissoes(), tasks = D.agendaItems().filter(a => !a.done && (a.when || "").slice(0, 10) === hojeStr()).sort((a, b) => (a.when || "").localeCompare(b.when || "")),
    cli = D.clientes().slice(0, 4), lots = D.lots().filter(l => l.cover).slice(0, 4);
  const el = document.getElementById("biaWidgets"); if (!el) return;
  el.innerHTML = `
    <div class="bia-w"><h4>Minhas comissões <button data-act="comissoes">Ver todas</button></h4>
      <div class="bia-tile t-ok"><span>🟢 Comissões pagas</span><b>${brl(c.pagas)}</b></div>
      <div class="bia-tile t-wait"><span>🟡 Comissões a receber</span><b>${brl(c.aReceber)}</b></div>
      <div class="bia-tile t-run"><span>🔵 Vendas em andamento</span><b>${c.andamento} ${c.andamento === 1 ? "venda" : "vendas"}</b></div></div>
    <div class="bia-w"><h4>Tarefas de hoje <button data-act="agenda">Ver agenda</button></h4>
      ${tasks.length ? tasks.slice(0, 5).map(a => `<div class="bia-li" data-task="${E(a.id)}"><span style="color:var(--g);min-width:40px">${hora(a.when) || "—"}</span><span style="flex:1;min-width:0">${E(a.title)}${a.client_name ? `<small style="display:block;color:var(--mut)">${E(a.client_name)}</small>` : ""}</span></div>`).join("") : `<p style="margin:0;color:var(--mut);font-size:12.5px">Nenhuma tarefa para hoje. <button class="bia-chip" data-act="novatarefa" style="margin-top:6px">+ Nova tarefa</button></p>`}</div>
    <div class="bia-w"><h4>Loteamentos em destaque <button data-act="lotes">Ver todos</button></h4>
      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px">${lots.map(l => `<button data-lot="${E(l.id)}" title="${E(l.name)}" style="border:1px solid var(--line);border-radius:10px;padding:0;overflow:hidden;cursor:pointer;background:#111;aspect-ratio:1;background:center/cover url('${E(l.cover)}')"></button>`).join("") || `<span style="color:var(--mut);font-size:12.5px">Sem fotos ainda.</span>`}</div></div>
    <div class="bia-w"><h4>Meus clientes <button data-act="clientes">Ver todos</button></h4>
      ${cli.length ? cli.map(c2 => `<div class="bia-li" data-cli="${E(c2.nome)}"><span class="bia-av">${E(iniciais(c2.nome))}</span><span style="flex:1;min-width:0"><b style="font-weight:600">${E(c2.nome)}</b><small style="display:block;color:var(--mut)">${c2.compras[0] ? E(c2.compras[0].property_name) : "agenda"}</small></span><small style="color:var(--mut)">${dBR(c2.ultima)}</small></div>`).join("") : `<p style="margin:0;color:var(--mut);font-size:12.5px">Seus clientes aparecem aqui conforme as vendas.</p>`}</div>`;
}

/* ================= chat ================= */
const md = t => E(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/^\s*[-•]\s+/gm, "• ").replace(/\n/g, "<br>");
function scrollDown(){ const m = document.getElementById("biaMsgs"); if (m) m.scrollTop = m.scrollHeight; }
function pushUser(t){ BIA.msgs.push({who: "me", text: t}); renderMsg(BIA.msgs[BIA.msgs.length - 1], true); }
function renderMsg(m, anim){
  const box = document.getElementById("biaMsgs"); if (!box) return null;
  const d = document.createElement("div"); d.className = "bia-m " + (m.who === "me" ? "me" : "ai");
  if (m.who === "me") d.innerHTML = `<div class="bia-b">${E(m.text)}</div>`;
  else { d.innerHTML = `<img class="av" src="${EAGLE}" alt=""><div class="bia-body"><div class="bia-b" ${m.text ? "" : "hidden"}></div><div class="bia-ui"></div></div>`; d.querySelector(".bia-b").innerHTML = md(m.text || ""); renderUI(d.querySelector(".bia-ui"), m.ui || [], !anim); }
  box.appendChild(d); scrollDown(); return d;
}
async function pushAI(text, ui, opts = {}){
  if (innerWidth < 860){ const ch = document.querySelector("#bia .bia-chat"); if (ch) ch.scrollIntoView({behavior: "smooth", block: "start"}); }
  const m = {who: "ai", text: "", ui: []}; BIA.msgs.push(m);
  const d = renderMsg(m, true); if (!d) return; const b = d.querySelector(".bia-b"), u = d.querySelector(".bia-ui");
  if (text){ b.hidden = false; const step = Math.max(2, Math.ceil(text.length / 70)); for (let i = 0; i <= text.length; i += step){ b.innerHTML = md(text.slice(0, i)); scrollDown(); await sleep(16); } b.innerHTML = md(text); }
  m.text = text; m.ui = ui || []; renderUI(u, m.ui, false); scrollDown();
  if (opts.speak !== false && text) falar(text);
  return d;
}
function thinking(){ const box = document.getElementById("biaMsgs"); if (!box) return () => {}; const d = document.createElement("div"); d.className = "bia-m ai"; d.innerHTML = `<img class="av" src="${EAGLE}" alt=""><div class="bia-b"><span class="bia-typing">ANALISANDO <i></i><i></i><i></i></span></div>`; box.appendChild(d); scrollDown(); return () => d.remove(); }

/* ---- blocos visuais dentro do chat ---- */
function renderUI(el, blocks, instant){
  el.innerHTML = ""; blocks.forEach((bl, i) => { const w = document.createElement("div"); w.className = instant ? "" : "bia-rev"; if (!instant) w.style.animationDelay = (0.12 + i * 0.12) + "s"; w.innerHTML = UIB[bl.t] ? UIB[bl.t](bl) : ""; el.appendChild(w); });
  el.style.display = blocks.length ? "flex" : "none"; el.style.flexDirection = "column"; el.style.gap = "8px";
}
const lotHighlights = l => [l.tec.metragem_min ? `Lotes a partir de ${E(l.tec.metragem_min)}m²` : "", l.com.valor_a_partir ? `A partir de ${E(money(l.com.valor_a_partir))}` : "", l.tipo ? (l.tipo === "fechado" ? "Loteamento fechado" : "Loteamento aberto") : "", l.infra.length ? `${l.infra.length} itens de infraestrutura` : "", l.com.max_parcelas ? `Até ${E(l.com.max_parcelas)} parcelas` : ""].filter(Boolean).slice(0, 3);
const lotCard = (l, sel) => `<div class="bia-card ${sel ? "sel" : ""}" data-lot="${E(l.id)}"><div class="ph" style="background-image:${l.cover ? `url('${E(l.cover)}')` : "none"}"></div><div class="bd"><b>${E(l.name)}</b><span>${E([l.cidade, l.estado].filter(Boolean).join(" - ") || "Localização a confirmar")}</span>${lotHighlights(l).map(h => `<i>${h}</i>`).join("")}</div><button class="go" data-lot="${E(l.id)}">Ver detalhes →</button></div>`;
const UIB = {
  chips: b => `<div class="bia-chips">${b.items.map(([t, q, red]) => `<button class="bia-chip ${red ? "red" : ""}" data-q="${E(q || t)}">${E(t)}</button>`).join("")}</div>`,
  acts: b => `<div class="bia-chips">${b.items.map(([t, a, arg]) => `<button class="bia-chip" data-act="${E(a)}" ${arg ? `data-arg="${E(arg)}"` : ""}>${E(t)}</button>`).join("")}</div>`,
  lots: b => { const L = b.ids.map(id => D.lots().find(l => l.id === id)).filter(Boolean); return L.length ? `<div class="bia-cards" ${b.tab ? `data-tab="${E(b.tab)}"` : ""}>${L.map(l => lotCard(l, b.sel && b.sel.includes(l.id))).join("")}</div>${b.pick ? `<div class="bia-chips"><button class="bia-chip red" data-act="comparar_ok">Comparar selecionados</button></div>` : ""}` : `<div class="bia-box" style="color:var(--mut)">Nenhum loteamento encontrado.</div>`; },
  lotResumo: b => { const l = D.lots().find(x => x.id === b.id); if (!l) return ""; return `<div class="bia-box"><div style="display:flex;gap:10px;align-items:center;margin-bottom:8px">${l.cover ? `<img src="${E(l.cover)}" alt="" style="width:74px;height:56px;object-fit:cover;border-radius:9px">` : ""}<div><b style="font-size:15px">${E(l.name)}</b><div style="color:var(--mut);font-size:12px">${ic("pin", 12)} ${E([l.bairro, l.cidade, l.estado].filter(Boolean).join(" · "))}</div></div></div>
      <div class="bia-kv">${[["Lotes", l.tec.metragem_min ? `${l.tec.metragem_min}${l.tec.metragem_max ? " a " + l.tec.metragem_max : ""} m²` : ""], ["A partir de", l.com.valor_a_partir ? money(l.com.valor_a_partir) : ""], ["Entrada", l.com.entrada_minima ? money(l.com.entrada_minima) : ""], ["Parcelas", l.com.max_parcelas ? "até " + l.com.max_parcelas + "x" : ""], ["Financiamento", l.com.financiamento || ""], ["Obra", OBRA[l.obra.status] || ""]].filter(x => x[1]).map(([k, v]) => `<div><span>${k}</span><b>${E(v)}</b></div>`).join("")}</div>
      <div class="bia-chips" style="margin-top:8px"><button class="bia-chip red" data-lot="${E(l.id)}">Ver ficha completa</button><button class="bia-chip" data-lot="${E(l.id)}" data-tab="precos">Tabela de preços</button><button class="bia-chip" data-lot="${E(l.id)}" data-tab="disp">Disponibilidade</button><button class="bia-chip" data-lot="${E(l.id)}" data-tab="visita">Agendar visita</button></div></div>`; },
  precos: b => { const l = D.lots().find(x => x.id === b.id); return l ? `<div class="bia-box"><h5>Tabela de preços · ${E(l.name)}</h5>${precoHTML(l)}</div>` : ""; },
  comissoes: b => { const c = D.comissoes(b.m, b.y); return `<div class="bia-box"><h5>Comissões${b.y ? " · " + (+b.m ? MESES[b.m - 1] + "/" : "") + b.y : ""}</h5>
      <div class="bia-tile t-ok"><span>🟢 Pagas</span><b>${brl(c.pagas)}</b></div><div class="bia-tile t-wait"><span>🟡 A receber</span><b>${brl(c.aReceber)}</b></div><div class="bia-tile t-run"><span>🔵 Em andamento</span><b>${c.andamento} vendas</b></div>${c.vencido > 0.01 ? `<div class="bia-tile" style="border-color:rgba(225,37,27,.5);background:rgba(225,37,27,.08)"><span>🔴 Vencido</span><b style="color:#FF7A6E">${brl(c.vencido)}</b></div>` : ""}
      <div style="margin-top:10px;display:flex;flex-direction:column;gap:6px">${c.lista.slice().sort((a, b2) => (b2.sale_date || "").localeCompare(a.sale_date || "")).slice(0, b.all ? 200 : 8).map(v => { const p = v.comm ? Math.min(100, Math.round(N(v.rec) / N(v.comm) * 100)) : 0; return `<div class="bia-li" data-venda="${E(v.id)}" style="flex-direction:column;align-items:stretch;gap:4px"><div style="display:flex;justify-content:space-between;gap:8px"><b style="font-weight:600">${E(v.property_name)} <small style="color:var(--mut)">Q${E(v.quadra || "–")} L${E(v.lote || "–")}</small></b><span style="color:var(--g);font-variant-numeric:tabular-nums">${brl(v.comm)}</span></div><div style="display:flex;justify-content:space-between;color:var(--mut);font-size:11.5px"><span>${E(v.client_name || "—")} · ${dBR(v.sale_date)} · ${fmtQ(v.pct)}%</span><span>${p}% recebido</span></div><div style="height:4px;border-radius:3px;background:#222"><i style="display:block;height:100%;width:${p}%;border-radius:3px;background:linear-gradient(90deg,#2ECC71,#E9C46A)"></i></div></div>`; }).join("") || `<span style="color:var(--mut)">Nenhuma venda neste período.</span>`}</div>
      ${!b.all && c.lista.length > 8 ? `<div class="bia-chips" style="margin-top:8px"><button class="bia-chip" data-act="comissoes_todas">Ver histórico completo (${c.lista.length})</button></div>` : ""}</div>`; },
  venda: b => { const v = D.vendas().find(x => x.id === b.id); if (!v) return ""; return `<div class="bia-box"><h5>${E(v.property_name)} · Q${E(v.quadra || "–")} L${E(v.lote || "–")}</h5><div class="bia-kv"><div><span>Cliente</span><b>${E(v.client_name || "—")}</b></div><div><span>Data</span><b>${dBR(v.sale_date)}</b></div><div><span>Valor da venda</span><b>${brl(v.sale_value)}</b></div><div><span>Seu percentual</span><b>${fmtQ(v.pct)}%${v.share < 1 ? " (parceria)" : ""}</b></div><div><span>Sua comissão</span><b style="color:var(--g)">${brl(v.comm)}</b></div><div><span>Já recebido</span><b style="color:#5BE39A">${brl(v.rec)}</b></div></div>
      <table class="bia-tbl" style="margin-top:8px"><tr><th>Parcela</th><th>Vencimento</th><th>Sua parte</th><th>Status</th></tr>${(v.installments || []).map(i => `<tr><td>${i.number}</td><td>${dBR(i.due_date)}</td><td class="v">${brl(i.value)}</td><td>${i.received ? "✅ recebida" : (i.due_date || "") < T ? "🔴 vencida" : "🟡 a receber"}</td></tr>`).join("")}</table></div>`; },
  tarefas: b => tarefasHTML(b),
  clientes: b => { const q = norm(b.q || ""); const L = D.clientes().filter(c => !q || norm(c.nome).includes(q)); return `<div class="bia-box"><h5>Clientes (${L.length})</h5>${L.slice(0, 30).map(c => { const w = waLink(c.fone, `Olá ${c.nome.split(" ")[0]}, tudo bem? Aqui é ${D.nome()}, da Brilhante's Imóveis.`); return `<div class="bia-li" style="cursor:default"><span class="bia-av">${E(iniciais(c.nome))}</span><span style="flex:1;min-width:0"><b style="font-weight:600">${E(c.nome)}</b><small style="display:block;color:var(--mut)">${c.fone ? E(fmtPhone(c.fone)) + " · " : ""}${c.compras.length ? E(c.compras.map(v => v.property_name).join(", ")) : "na agenda"}</small></span>${w ? `<a class="bia-ib" href="${E(w)}" target="_blank" rel="noopener" title="WhatsApp" style="color:#5BE39A">${ic("wa", 16)}</a>` : ""}<button class="bia-ib" data-act="retorno" data-arg="${E(c.nome)}" title="Agendar retorno">${ic("ag", 16)}</button></div>`; }).join("") || `<span style="color:var(--mut)">Nenhum cliente encontrado.</span>`}</div>`; },
  comparar: b => { const L = b.ids.map(id => D.lots().find(l => l.id === id)).filter(Boolean); if (L.length < 2) return ""; const rows = [["Cidade", l => [l.bairro, l.cidade].filter(Boolean).join(" · ")], ["Tipo", l => l.tipo === "fechado" ? "Fechado" : l.tipo === "aberto" ? "Aberto" : ""], ["Lotes (m²)", l => l.tec.metragem_min ? `${l.tec.metragem_min}${l.tec.metragem_max ? "–" + l.tec.metragem_max : ""}` : ""], ["A partir de", l => l.com.valor_a_partir ? money(l.com.valor_a_partir) : ""], ["Entrada", l => l.com.entrada_minima ? money(l.com.entrada_minima) : ""], ["Parcelas", l => l.com.max_parcelas ? l.com.max_parcelas + "x" : ""], ["Parcela inicial", l => l.com.valor_parcela_inicial ? money(l.com.valor_parcela_inicial) : ""], ["Juros", l => l.com.juros === "sem" ? "Sem juros" : l.com.juros === "com" ? "Com juros" : ""], ["Correção", l => ({ipca: "IPCA", igpm: "IGP-M", sem: "Sem correção"})[l.com.correcao] || ""], ["Obra", l => OBRA[l.obra.status] || ""], ["Entrega", l => l.obra.previsao || dBR(l.obra.data_entrega) || ""], ["Infraestrutura", l => l.infra.length ? l.infra.length + " itens" : ""], ["Vendidos no sistema", l => l.vendidos != null ? String(l.vendidos) : ""]];
      return `<div class="bia-box" style="overflow-x:auto"><h5>Comparativo</h5><table class="bia-tbl bia-cmp"><tr><th></th>${L.map(l => `<th style="color:#fff">${E(l.name)}</th>`).join("")}</tr>${rows.map(([k, f]) => `<tr><th>${k}</th>${L.map(l => `<td class="v">${E(f(l) || "—")}</td>`).join("")}</tr>`).join("")}</table></div>`; },
  ranking: () => { const r = D.ranking(); return `<div class="bia-box"><h5>Ranking de ${MESES[+T.slice(5, 7) - 1]}</h5>${r.slice(0, 10).map((x, i) => `<div class="bia-li" style="cursor:default"><span class="bia-av" style="${i < 3 ? "border-color:var(--g);color:var(--g)" : ""}">${i + 1}º</span><span style="flex:1">${E(x.label)}</span><b style="font-variant-numeric:tabular-nums">${fmtQ(x.qtd)} vendas</b></div>`).join("") || `<span style="color:var(--mut)">Ranking indisponível.</span>`}</div>`; },
  form: b => FORMS[b.f] ? FORMS[b.f](b) : ""
};
function precoHTML(l){
  const C = l.com, rows = [["Valor a partir de", C.valor_a_partir && money(C.valor_a_partir)], ["Valor de referência", C.valor_ref && money(C.valor_ref)], ["Tamanho dos lotes", l.tec.metragem_min && `${l.tec.metragem_min}${l.tec.metragem_max ? " a " + l.tec.metragem_max : ""} m²`], ["Entrada mínima", C.entrada_minima && money(C.entrada_minima)], ["Máximo de parcelas", C.max_parcelas && C.max_parcelas + "x"], ["Parcela inicial", C.valor_parcela_inicial && money(C.valor_parcela_inicial)], ["Financiamento", C.financiamento], ["Correção", ({ipca: "IPCA", igpm: "IGP-M", sem: "Sem correção", outro: C.correcao_outro || "Outro"})[C.correcao]], ["Juros", C.juros === "sem" ? "Sem juros" : C.juros === "com" ? `Com juros${C.juros_pct ? " (" + C.juros_pct + "%)" : ""}` : ""], ["Balões", C.balao === "possui" ? `${C.baloes_qtd ? C.baloes_qtd + " balões" : "Possui"}${C.baloes_valor ? " de " + money(C.baloes_valor) : ""}${C.baloes_periodicidade ? " · " + C.baloes_periodicidade : ""}` : C.balao === "nao" ? "Não" : ""], ["Disponibilidade", disponHTML(l, true)]].filter(r => r[1]);
  const tabs = l.docs.filter(m => m.category === "tabela_preco" || /tabela|pre[cç]o/i.test(m.title || ""));
  return `${rows.length ? `<div class="bia-kv">${rows.map(([k, v]) => `<div><span>${k}</span><b>${k === "Disponibilidade" ? v : E(v)}</b></div>`).join("")}</div>` : `<p style="color:var(--mut);margin:0">As condições comerciais deste loteamento ainda não foram cadastradas na ficha.</p>`}
    ${C.condicoes_especiais ? `<div style="margin-top:8px;font-size:12.5px"><b style="color:var(--g)">Condições especiais:</b> ${E(C.condicoes_especiais)}</div>` : ""}
    ${tabs.length ? `<div class="bia-chips" style="margin-top:10px">${tabs.map(m => `<a class="bia-chip red" href="${E(blobUrl(m))}" target="_blank" rel="noopener" style="text-decoration:none">📄 ${E(m.title || "Tabela de preços")}</a>`).join("")}</div>` : ""}`;
}
function disponHTML(l, curto){
  const tot = parseInt(String(l.tec.qtd_lotes || "").replace(/\D/g, "")) || 0, v = l.vendidos || 0;
  if (curto) return tot ? `${Math.max(tot - v, 0)} de ${tot} lotes` : (v ? `${v} vendidos pela Brilhante's` : "");
  return `<div class="bia-kv"><div><span>Total de lotes</span><b>${tot || "—"}</b></div><div><span>Vendidos pela Brilhante's</span><b>${v}</b></div></div>
    ${(l.vendidosQL || []).length ? `<div style="margin-top:8px"><span style="font-size:11.5px;color:var(--mut)">Quadras e lotes já vendidos pela equipe:</span><div style="margin-top:6px">${l.vendidosQL.slice(0, 120).map(([q, lt]) => `<span class="bia-pill">Q${E(q || "–")} L${E(lt || "–")}</span>`).join("")}</div></div>` : ""}
    <p style="font-size:11.5px;color:var(--mut);margin:8px 0 0">A disponibilidade exata (incluindo vendas de outras imobiliárias) deve ser confirmada na tabela da construtora ou com o gestor.</p>`;
}
function tarefasHTML(b){
  const all = D.agendaItems().sort((x, y) => (x.when || "").localeCompare(y.when || "")), now = T;
  const hoje = all.filter(a => (a.when || "").slice(0, 10) === now), prox = all.filter(a => (a.when || "").slice(0, 10) > now && !a.done).slice(0, 12), atras = all.filter(a => (a.when || "").slice(0, 10) < now && !a.done).slice(-8);
  const row = a => `<div class="bia-task ${a.done ? "done" : ""}"><input type="checkbox" data-done="${E(a.id)}" ${a.done ? "checked" : ""} aria-label="Concluída"><time>${(a.when || "").slice(0, 10) === now ? hora(a.when) || "—" : dBR((a.when || "").slice(0, 10)).slice(0, 5)}</time><span style="flex:1;min-width:0"><b style="font-weight:600">${E(a.title)}</b><small style="display:block;color:var(--mut)">${E([ATYPE[a.type] || a.type, a.client_name].filter(Boolean).join(" · "))}</small></span><button class="bia-ib" data-edit="${E(a.id)}" title="Editar">✎</button></div>`;
  return `<div class="bia-box"><h5>Agenda e tarefas</h5>${atras.length ? `<div style="font-size:11.5px;color:#FF7A6E;margin:2px 0 6px">ATRASADAS</div>${atras.map(row).join("")}` : ""}
    <div style="font-size:11.5px;color:var(--g);margin:6px 0">HOJE</div>${hoje.length ? hoje.map(row).join("") : `<p style="margin:0 0 6px;color:var(--mut);font-size:12.5px">Nada para hoje.</p>`}
    ${prox.length ? `<div style="font-size:11.5px;color:var(--mut);margin:8px 0 6px">PRÓXIMOS DIAS</div>${prox.map(row).join("")}` : ""}
    <div class="bia-chips" style="margin-top:8px"><button class="bia-chip red" data-act="novatarefa">+ Nova tarefa</button><button class="bia-chip" data-act="novatarefa" data-arg="visita">Agendar visita</button></div></div>`;
}
const FORMS = {
  tarefa: b => { const a = b.doc || {}; const lots = D.lots(); return `<div class="bia-box"><h5>${a.id ? "Editar tarefa" : b.tipo === "visita" ? "Agendar visita" : "Nova tarefa"}</h5><form class="bia-form" data-form="tarefa" data-id="${E(a.id || "")}">
      <label class="full">Título<input name="title" required value="${E(a.title || (b.tipo === "visita" && b.lot ? "Visita · " + b.lot : ""))}" placeholder="ex.: Visita no BS Parc com Roberta"></label>
      <label>Tipo<select name="type">${Object.entries(ATYPE).map(([k, v]) => `<option value="${k}" ${(a.type || b.tipo || "visita") === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      <label>Data e hora<input type="datetime-local" name="when" required value="${E((a.when || (T + "T09:00")).slice(0, 16))}"></label>
      <label>Cliente<input name="client_name" value="${E(a.client_name || b.cliente || "")}" list="biaCli"></label>
      <label>Loteamento<select name="lot"><option value="">—</option>${lots.map(l => `<option ${norm(l.name) === norm(a.lot || b.lot || "") ? "selected" : ""}>${E(l.name)}</option>`).join("")}</select></label>
      <label class="full">Observação<textarea name="notes" rows="2">${E(a.notes || "")}</textarea></label>
      <div class="full" style="display:flex;gap:8px;justify-content:flex-end">${a.id ? `<button type="button" class="bia-btn" data-del="${E(a.id)}">Excluir</button>` : ""}<button class="bia-btn gold">Salvar</button></div>
      <datalist id="biaCli">${D.clientes().map(c => `<option value="${E(c.nome)}">`).join("")}</datalist></form></div>`; }
};

/* ================= painel de detalhes do loteamento ================= */
const PTABS = [["geral", "Visão geral"], ["precos", "Tabela de preços"], ["disp", "Disponibilidade"], ["local", "Localização"], ["midia", "Fotos e vídeos"], ["visita", "Agendar visita"]];
function openLot(id, tab){
  const l = D.lots().find(x => x.id === id); const p = document.getElementById("biaPanel"); if (!l || !p) return;
  BIA.panel = {id, tab: tab || "geral"};
  p.innerHTML = `<button class="close" data-pclose aria-label="Fechar">✕</button><div class="hero" style="background-image:${l.cover ? `url('${E(l.cover)}')` : "linear-gradient(135deg,#3a0906,#111)"}"><div><b>${E(l.name)}</b><div style="color:#E8DDC8;font-size:12.5px">${ic("pin", 13)} ${E([l.bairro, l.cidade, l.estado].filter(Boolean).join(" · ") || "Localização a confirmar")}</div></div></div>
    <div class="bia-ptabs">${PTABS.map(([k, t]) => `<button data-ptab="${k}" class="${k === BIA.panel.tab ? "on" : ""}">${t}</button>`).join("")}</div><div class="bia-pbody" id="biaPBody"></div>`;
  p.classList.add("open"); p.setAttribute("aria-hidden", "false"); paintPanel();
}
function paintPanel(){
  const P = BIA.panel, l = P && D.lots().find(x => x.id === P.id), b = document.getElementById("biaPBody"); if (!l || !b) return;
  document.querySelectorAll("#biaPanel [data-ptab]").forEach(x => x.classList.toggle("on", x.dataset.ptab === P.tab));
  const kv = arr => `<div class="bia-kv">${arr.filter(x => x[1]).map(([k, v]) => `<div><span>${k}</span><b>${E(v)}</b></div>`).join("")}</div>`;
  let h = "";
  if (P.tab === "geral"){
    const dest = [l.tec.metragem_min && `🏠 Lotes a partir de ${l.tec.metragem_min}m²`, l.infra.length && `🏗 ${l.infra.length >= 8 ? "Infraestrutura completa" : "Infraestrutura: " + l.infra.slice(0, 3).join(", ")}`, l.com.financiamento && `💰 ${l.com.financiamento}`, l.com.valor_a_partir && `💲 A partir de ${money(l.com.valor_a_partir)}`, OBRA[l.obra.status] && `📅 Obra: ${OBRA[l.obra.status]}${l.obra.previsao ? " · entrega " + l.obra.previsao : ""}`].filter(Boolean);
    h = `${dest.length ? `<div class="bia-box">${dest.map(x => `<div style="padding:3px 0">${E(x)}</div>`).join("")}</div>` : ""}
      <div class="bia-box"><h5>Dados do loteamento</h5>${kv([["Tipo", l.tipo === "fechado" ? "Loteamento fechado" : l.tipo === "aberto" ? "Loteamento aberto" : ""], ["Tamanho dos lotes", l.tec.metragem_min && `${l.tec.metragem_min}${l.tec.metragem_max ? " a " + l.tec.metragem_max : ""} m²`], ["Quantidade de lotes", l.tec.qtd_lotes], ["Quadras", l.tec.qtd_quadras], ["Área total", l.tec.area_total && l.tec.area_total + " m²"], ["Liberação p/ construir", l.tec.liberacao_pct && l.tec.liberacao_pct + "%"], ["Obra", OBRA[l.obra.status]], ["Previsão de entrega", l.obra.previsao || dBR(l.obra.data_entrega)]])}
        ${l.tec.restricoes ? `<p style="font-size:12.5px;margin:8px 0 0"><b style="color:var(--g)">Restrições:</b> ${E(l.tec.restricoes)}</p>` : ""}</div>
      ${l.infra.length ? `<div class="bia-box"><h5>Infraestrutura e lazer</h5>${l.infra.map(i => `<span class="bia-pill">${E(i)}</span>`).join("")}</div>` : ""}
      ${l.resumo || l.ai_training ? `<div class="bia-box"><h5>Informações importantes</h5><div style="font-size:12.5px;white-space:pre-wrap;line-height:1.55">${md(l.resumo || l.ai_training)}</div></div>` : ""}
      <div class="bia-chips"><button class="bia-chip red" data-q="Me explique o ${E(l.name)} de forma resumida para eu passar ao cliente">Perguntar à IA</button><button class="bia-chip" data-copy="${E(l.id)}">Copiar resumo p/ WhatsApp</button><button class="bia-chip" data-ptab="visita">Agendar visita</button></div>`;
  } else if (P.tab === "precos") h = `<div class="bia-box"><h5>Tabela de preços</h5>${precoHTML(l)}</div>`;
  else if (P.tab === "disp") h = `<div class="bia-box"><h5>Disponibilidade</h5>${disponHTML(l)}</div>`;
  else if (P.tab === "local"){
    const c = l.c, raw = (isAdmin ? slimLots() : (PUB.lots || []));
    h = `<div class="bia-box"><h5>Localização</h5>${kv([["Endereço", l.loc.endereco], ["Bairro", l.bairro], ["Cidade", [l.cidade, l.estado].filter(Boolean).join(" - ")], ["Distância do centro", l.loc.dist_centro], ["Distância da praia", l.loc.dist_praia], ["Pontos de referência", l.loc.dist_pontos]])}
      ${l.loc.acessos ? `<p style="font-size:12.5px;margin:8px 0 0"><b style="color:var(--g)">Acessos:</b> ${E(l.loc.acessos)}</p>` : ""}
      ${c ? `<div class="bia-chips" style="margin-top:10px"><a class="bia-chip red" style="text-decoration:none" href="${E(routeUrl(c))}" target="_blank" rel="noopener">Traçar rota</a><a class="bia-chip" style="text-decoration:none" href="${E(gmaps(c))}" target="_blank" rel="noopener">Google Maps</a><a class="bia-chip" style="text-decoration:none" href="https://waze.com/ul?ll=${c[0]},${c[1]}&navigate=yes" target="_blank" rel="noopener">Waze</a></div>` : ""}</div>
      ${c ? `<div>${mapSVG(raw, l.id)}</div>` : `<p style="color:var(--mut)">Coordenadas ainda não cadastradas.</p>`}`;
  } else if (P.tab === "midia"){
    h = `${l.fotos.length ? `<div class="bia-box"><h5>Galeria (${l.fotos.length})</h5><div class="bia-gal">${l.fotos.map(m => `<img src="${E(blobUrl(m))}" alt="" loading="lazy" data-zoom="${E(blobUrl(m))}">`).join("")}</div></div>` : `<p style="color:var(--mut)">Sem fotos cadastradas.</p>`}
      ${l.videos.length ? `<div class="bia-box"><h5>Vídeos</h5><div class="bia-chips">${l.videos.map(m => `<a class="bia-chip" style="text-decoration:none" href="${E(blobUrl(m))}" target="_blank" rel="noopener">▶ ${E(m.title || "Vídeo")}</a>`).join("")}</div></div>` : ""}
      ${l.docs.length ? `<div class="bia-box"><h5>Materiais</h5><div class="bia-chips">${l.docs.map(m => `<a class="bia-chip" style="text-decoration:none" href="${E(blobUrl(m))}" target="_blank" rel="noopener">📄 ${E(m.title || "Documento")}</a>`).join("")}</div></div>` : ""}`;
  } else if (P.tab === "visita") h = FORMS.tarefa({tipo: "visita", lot: l.name});
  b.innerHTML = h; b.scrollTop = 0;
}
function closePanel(){ const p = document.getElementById("biaPanel"); if (p){ p.classList.remove("open"); p.setAttribute("aria-hidden", "true"); } BIA.panel = null; }
function resumoTexto(l){ return [`*${l.name}*`, `📍 ${[l.bairro, l.cidade, l.estado].filter(Boolean).join(" - ")}`, l.tec.metragem_min && `🏠 Lotes a partir de ${l.tec.metragem_min}m²`, l.com.valor_a_partir && `💰 A partir de ${money(l.com.valor_a_partir)}`, l.com.entrada_minima && `➡️ Entrada a partir de ${money(l.com.entrada_minima)}`, l.com.max_parcelas && `📆 Em até ${l.com.max_parcelas}x${l.com.juros === "sem" ? " sem juros" : ""}`, l.infra.length && `🏗 ${l.infra.slice(0, 8).join(", ")}`, l.obra.previsao && `🔑 Entrega prevista: ${l.obra.previsao}`, "", `Brilhante's Imóveis · ${D.nome()}`].filter(x => x !== false && x != null).join("\n"); }

/* ================= ações dos menus e botões ================= */
const FOLLOW = [["Loteamentos disponíveis", "Quais loteamentos temos disponíveis?"], ["Tabela de preços", "tabela"], ["Condições de pagamento", "Quais as condições de pagamento dos loteamentos?"], ["Comparar loteamentos", "comparar"], ["Agendar visita", "visita"], ["Tirar dúvidas", "duvidas"]];
const quick = () => ({t: "acts", items: [["Loteamentos disponíveis", "lotes"], ["Tabela de preços", "precos"], ["Comparar loteamentos", "comparar"], ["Agendar visita", "novatarefa", "visita"], ["Comissões", "comissoes"], ["Tirar dúvidas", "duvidas"]]});
async function act(a, arg){
  stopFala(); closeSet();
  document.querySelectorAll("#bia .bia-mi").forEach(x => x.classList.toggle("on", x.dataset.act === a));
  const lots = D.lots();
  if (a === "lotes"){ const cid = [...new Set(lots.map(l => l.cidade).filter(Boolean))].sort((x, y) => x.localeCompare(y, "pt-BR")); setState("respondendo");
    await pushAI(`Temos **${lots.length} loteamentos** cadastrados. Filtre por cidade ou toque em um card para ver os detalhes.`, [{t: "acts", items: cid.map(c => [c, "cidade", c])}, {t: "lots", ids: lots.map(l => l.id)}], {speak: false}); return setState("finalizado"); }
  if (a === "cidade"){ const L = lots.filter(l => norm(l.cidade) === norm(arg)); setState("respondendo"); await pushAI(`Encontrei **${L.length} ${L.length === 1 ? "loteamento" : "loteamentos"}** em ${arg}. Selecione um para visualizar os detalhes.`, [{t: "lots", ids: L.map(l => l.id)}]); return; }
  if (a === "precos"){ setState("respondendo"); await pushAI("Escolha o loteamento para ver a **tabela de preços**:", [{t: "lots", ids: lots.map(l => l.id), tab: "precos"}], {speak: false}); return setState("finalizado"); }
  if (a === "comissoes" || a === "comissoes_todas" || a === "comissoes_mes"){ const c = D.comissoes(); setState("respondendo"); const y = +T.slice(0, 4), m = +T.slice(5, 7);
    await pushAI(a === "comissoes_mes" ? `Suas comissões de **${MESES[m - 1]}**:` : `Você tem **${brl(c.pagas)}** em comissões pagas e **${brl(c.aReceber)}** a receber, com **${c.andamento}** ${c.andamento === 1 ? "venda" : "vendas"} em andamento.`, [a === "comissoes_mes" ? {t: "comissoes", m, y} : {t: "comissoes", all: a === "comissoes_todas"}, {t: "acts", items: [["Este mês", "comissoes_mes"], ["Histórico completo", "comissoes_todas"], ["Ranking do mês", "ranking"]]}], {speak: a === "comissoes"}); return; }
  if (a === "ranking"){ setState("respondendo"); await pushAI(`Ranking de **${MESES[+T.slice(5, 7) - 1]}**:`, [{t: "ranking"}], {speak: false}); return setState("finalizado"); }
  if (a === "agenda"){ await D.loadAgenda(); const hoje = D.agendaItems().filter(x => !x.done && (x.when || "").slice(0, 10) === T).length; setState("respondendo"); await pushAI(hoje ? `Você tem **${hoje} ${hoje === 1 ? "tarefa" : "tarefas"}** para hoje.` : "Você não tem tarefas pendentes para hoje.", [{t: "tarefas"}]); return; }
  if (a === "novatarefa"){ await pushAI(arg === "visita" ? "Vamos agendar a visita. Preencha os dados:" : "Nova tarefa:", [{t: "form", f: "tarefa", tipo: arg || "outro"}], {speak: false}); return; }
  if (a === "retorno"){ await pushAI(`Agendar retorno para **${arg}**:`, [{t: "form", f: "tarefa", tipo: "ligacao", cliente: arg}], {speak: false}); return; }
  if (a === "clientes"){ const n = D.clientes().length; setState("respondendo"); await pushAI(n ? `Você tem **${n} clientes** nas suas vendas e na agenda. Toque no WhatsApp para falar com eles ou agende um retorno.` : "Ainda não encontrei clientes nas suas vendas.", [{t: "clientes"}], {speak: false}); return setState("finalizado"); }
  if (a === "duvidas"){ setState("respondendo"); await pushAI("Pode perguntar o que quiser sobre os loteamentos. Eu respondo **somente com as informações cadastradas** no sistema. Exemplos:", [{t: "chips", items: [["Qual o tamanho dos lotes do BS Parc?"], ["Qual a entrada mínima do Vivenza?"], ["Quais loteamentos têm financiamento próprio?"], ["Qual a diferença entre o Vivenza e o BS Parc?"], ["Quais loteamentos são fechados?"]]}], {speak: false}); return setState("finalizado"); }
  if (a === "comparar"){ BIA.pick = []; setState("respondendo"); await pushAI("Toque em **2 ou 3 loteamentos** para selecionar e depois em *Comparar selecionados*.", [{t: "lots", ids: lots.map(l => l.id), pick: true}], {speak: false}); return setState("finalizado"); }
  if (a === "comparar_ok"){ const ids = BIA.pick || []; if (ids.length < 2) return toast("Selecione pelo menos 2 loteamentos."); BIA.pick = null; setState("respondendo"); await pushAI("Aqui está o comparativo lado a lado:", [{t: "comparar", ids: ids.slice(0, 3)}], {speak: false}); return setState("finalizado"); }
}

/* ================= IA (texto) ================= */
function sysPrompt(){
  const dia = new Date(T + "T12:00:00").toLocaleDateString("pt-BR", {weekday: "long"});
  return `Você é a Brilhante's IA, a assistente exclusiva dos corretores da Brilhante's Imóveis (imobiliária de loteamentos no Ceará). Está falando com o corretor ${D.nome()}. Hoje é ${dia}, ${dBR(T)}.
REGRAS:
- Use SOMENTE informações obtidas pelas ferramentas. Nunca invente preços, prazos, metragens, condições ou disponibilidade. Se algo não estiver cadastrado, diga claramente que essa informação não consta no sistema e sugira confirmar com o gestor.
- Sempre que a pergunta envolver loteamentos, preços, comissões, agenda ou clientes, chame a ferramenta adequada ANTES de responder. Os cards e tabelas aparecem automaticamente abaixo da sua resposta, então NÃO repita listas longas: responda em no máximo 5 linhas, de forma direta, como um assistente experiente.
- Para agendar visitas, ligações ou tarefas, use criar_tarefa com data e hora no formato AAAA-MM-DDTHH:MM (horário de Fortaleza). Se o corretor não disser a hora, use 09:00.
- Você só tem acesso às vendas e comissões do próprio corretor. Não fale de comissões de outras pessoas.
- Responda em português do Brasil, em tom profissional e cordial. Valores em reais no formato R$ 1.234,56.`;
}
function biaTools(UI){
  const resumoLot = l => ({nome: l.name, cidade: l.cidade, bairro: l.bairro, tipo: l.tipo, a_partir_de: l.com.valor_a_partir || "", metragem: l.tec.metragem_min ? `${l.tec.metragem_min}${l.tec.metragem_max ? "-" + l.tec.metragem_max : ""}` : "", entrada_minima: l.com.entrada_minima || "", parcelas: l.com.max_parcelas || "", financiamento: l.com.financiamento || "", obra: OBRA[l.obra.status] || "", fase: PHASES[l.phase] || ""});
  const findLot = n => { const l = D.lot(n || ""); if (!l) throw new Error("Loteamento não encontrado. Existentes: " + D.lots().map(x => x.name).join(", ")); return l; };
  return [
    {name: "listar_loteamentos", description: "Lista os loteamentos cadastrados, com filtros opcionais por cidade, tipo (aberto/fechado) ou texto. Mostra os cards ao corretor.", inputSchema: {type: "object", properties: {cidade: {type: "string"}, tipo: {type: "string", enum: ["aberto", "fechado"]}, busca: {type: "string"}}},
      execute: i => { let L = D.lots(); if (i.cidade) L = L.filter(l => norm(l.cidade + " " + l.bairro).includes(norm(i.cidade))); if (i.tipo) L = L.filter(l => l.tipo === i.tipo); if (i.busca) L = L.filter(l => norm(l.name + " " + l.cidade + " " + l.infra.join(" ")).includes(norm(i.busca))); UI.push({t: "lots", ids: L.map(l => l.id)}); return {total: L.length, loteamentos: L.map(resumoLot)}; }},
    {name: "detalhes_loteamento", description: "Ficha completa de um loteamento: dados técnicos, infraestrutura, obra, localização, condições, material do book e disponibilidade.", inputSchema: {type: "object", properties: {nome: {type: "string"}}, required: ["nome"]},
      execute: i => { const l = findLot(i.nome); UI.push({t: "lotResumo", id: l.id}); return lotText(l) + (l.resumo ? `\n\nMATERIAL DO BOOK:\n${l.resumo}` : "") + `\n\nDISPONIBILIDADE: ${disponHTML(l, true) || "não cadastrada"} (vendidos pela Brilhante's: ${l.vendidos || 0})`; }},
    {name: "tabela_precos", description: "Tabela de preços e condições de pagamento de um loteamento (valores, entrada, parcelas, juros, correção, balões).", inputSchema: {type: "object", properties: {nome: {type: "string"}}, required: ["nome"]},
      execute: i => { const l = findLot(i.nome); UI.push({t: "precos", id: l.id}); return {loteamento: l.name, ...l.com, metragem_min: l.tec.metragem_min, metragem_max: l.tec.metragem_max, tabelas_pdf: l.docs.filter(m => m.category === "tabela_preco").map(m => m.title)}; }},
    {name: "comparar_loteamentos", description: "Compara 2 ou 3 loteamentos lado a lado.", inputSchema: {type: "object", properties: {nomes: {type: "array", items: {type: "string"}}}, required: ["nomes"]},
      execute: i => { const L = (i.nomes || []).map(findLot).slice(0, 3); UI.push({t: "comparar", ids: L.map(l => l.id)}); return L.map(l => ({...resumoLot(l), juros: l.com.juros, correcao: l.com.correcao, infraestrutura: l.infra, entrega: l.obra.previsao || l.obra.data_entrega || ""})); }},
    {name: "minhas_comissoes", description: "Comissões e vendas do corretor: pagas, a receber, vencidas, vendas em andamento. mes=0 ou vazio para todo o período.", inputSchema: {type: "object", properties: {mes: {type: "integer"}, ano: {type: "integer"}}},
      execute: i => { const c = D.comissoes(i.ano ? i.mes || 0 : 0, i.ano || 0); UI.push({t: "comissoes", m: i.mes || 0, y: i.ano || 0}); return {pagas: +c.pagas.toFixed(2), a_receber: +c.aReceber.toFixed(2), vencido: +c.vencido.toFixed(2), vendas_em_andamento: c.andamento, vendas: +c.qtd.toFixed(2), vgv: Math.round(c.vgv), lista: c.lista.slice(0, 25).map(v => ({data: v.sale_date, loteamento: v.property_name, quadra: v.quadra, lote: v.lote, cliente: v.client_name, percentual: v.pct, comissao: v.comm, recebido: v.rec}))}; }},
    {name: "detalhe_venda", description: "Detalhes de uma venda do corretor (parcelas da comissão), buscando por cliente, loteamento ou quadra/lote.", inputSchema: {type: "object", properties: {busca: {type: "string"}}, required: ["busca"]},
      execute: i => { const q = norm(i.busca); const v = D.vendas().find(x => norm(`${x.client_name} ${x.property_name} q${x.quadra} l${x.lote}`).includes(q)); if (!v) throw new Error("Venda não encontrada entre as vendas do corretor."); UI.push({t: "venda", id: v.id}); return v; }},
    {name: "meus_clientes", description: "Clientes do corretor (das vendas e da agenda), com busca por nome.", inputSchema: {type: "object", properties: {busca: {type: "string"}}},
      execute: i => { UI.push({t: "clientes", q: i.busca || ""}); return D.clientes().filter(c => !i.busca || norm(c.nome).includes(norm(i.busca))).slice(0, 30).map(c => ({nome: c.nome, telefone: c.fone, compras: c.compras.map(v => `${v.property_name} Q${v.quadra} L${v.lote} (${v.sale_date})`), ultima: c.ultima})); }},
    {name: "minha_agenda", description: "Agenda e tarefas do corretor (visitas, ligações, reuniões), incluindo atrasadas e próximas.", inputSchema: {type: "object", properties: {}},
      execute: async () => { await D.loadAgenda(); UI.push({t: "tarefas"}); return D.agendaItems().filter(a => !a.done).sort((x, y) => (x.when || "").localeCompare(y.when || "")).slice(0, 40).map(a => ({quando: a.when, titulo: a.title, tipo: a.type, cliente: a.client_name, obs: a.notes})); }},
    {name: "criar_tarefa", description: "Cria um compromisso/tarefa na agenda do corretor (visita, ligação/retorno, plantão ou outro).", inputSchema: {type: "object", properties: {titulo: {type: "string"}, quando: {type: "string", description: "AAAA-MM-DDTHH:MM"}, tipo: {type: "string", enum: Object.keys(ATYPE)}, cliente: {type: "string"}, loteamento: {type: "string"}, obs: {type: "string"}}, required: ["titulo", "quando"]},
      execute: async i => { await D.loadAgenda(); const d = await D.salvarAgenda({id: rid("appt"), created_at: nowISO(), done: false, title: i.titulo, when: String(i.quando).slice(0, 16), type: i.tipo || "outro", client_name: i.cliente || "", lot: i.loteamento || "", notes: i.obs || ""}); UI.push({t: "tarefas"}); widgets(); return {ok: true, criado: d.when}; }},
    {name: "ranking_mes", description: "Ranking de vendas dos corretores no mês atual.", inputSchema: {type: "object", properties: {}},
      execute: () => { UI.push({t: "ranking"}); return D.ranking().slice(0, 10).map((r, k) => ({posicao: k + 1, nome: r.label, vendas: r.qtd})); }}
  ];
}
async function ask(q, opts = {}){
  q = String(q || "").trim(); if (!q || BIA.busy) return;
  stopFala(); closeSet(); const inp = document.getElementById("biaQ"); if (inp) inp.value = "";
  pushUser(q);
  if (!ai){ await pushAI("A IA ainda não está configurada neste site. Avise o gestor.", [], {speak: false}); return; }
  BIA.busy = true; setState("analisando"); const stopT = thinking(); const UI = [];
  try {
    const hist = [...BIA.hist.slice(-10), {role: "user", content: q}];
    const r = await ai(hist, {tools: biaTools(UI), system: sysPrompt(), modelTier: "default"});
    stopT(); BIA.hist.push({role: "user", content: q}, {role: "assistant", content: r.text});
    const seen = new Set(), ui = UI.filter(b => { const k = JSON.stringify(b); if (seen.has(k)) return false; seen.add(k); return true; });
    setState("respondendo"); BIA.busy = false;
    await pushAI(r.text, ui, {speak: opts.voz || BIA.set.voz});
    if (!(opts.voz || BIA.set.voz)) setState("finalizado");
  } catch (e){ stopT(); BIA.busy = false; setState("pronto"); await pushAI(aiMsg(e), [], {speak: false}); }
}

/* ================= voz: ouvir e falar ================= */
let REC = null, AUD = null, ACTX = null;
async function micLevel(on){
  if (!on){ if (ORB.mic){ ORB.mic.getTracks().forEach(t => t.stop()); ORB.mic = null; } if (ORB.analyser && ORB.analyser._mic) ORB.analyser = null; return; }
  try { ORB.mic = await navigator.mediaDevices.getUserMedia({audio: true}); ACTX = ACTX || new (window.AudioContext || window.webkitAudioContext)(); const src = ACTX.createMediaStreamSource(ORB.mic), an = ACTX.createAnalyser(); an.fftSize = 256; an._mic = true; src.connect(an); ORB.analyser = an; } catch {}
}
function ouvir(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return toast("Para falar com a IA, use o Google Chrome ou o Edge.");
  if (REC){ try { REC.stop(); } catch {} return; }
  stopFala(); closeSet();
  const r = REC = new SR(); r.lang = "pt-BR"; r.interimResults = true; r.continuous = false;
  let final = ""; setState("ouvindo"); micLevel(true);
  const inp = document.getElementById("biaQ");
  r.onresult = e => { let s = ""; for (const x of e.results){ s += x[0].transcript; if (x.isFinal) final = s; } if (inp) inp.value = s; };
  r.onerror = e => { if (e.error === "not-allowed") toast("Libere o microfone no navegador para falar com a IA."); };
  r.onend = () => { REC = null; micLevel(false); if (final.trim()) ask(final, {voz: true}); else { if (inp) inp.value = ""; setState("pronto"); } };
  try { r.start(); } catch { REC = null; setState("pronto"); }
}
const limpaFala = t => String(t || "").replace(/\*\*/g, "").replace(/[*_#`>]/g, "").replace(/^\s*[-•]\s+/gm, "").replace(/R\$\s?/g, "R$ ").replace(/\n+/g, ". ").replace(/\s+/g, " ").trim();
function fimFala(){ ORB.analyser = null; if (BIA.state === "respondendo") setState("finalizado"); if (BIA.set.conversa && document.getElementById("bia")) setTimeout(() => { if (BIA.state !== "analisando" && !REC) ouvir(); }, 700); }
function stopFala(){ try { speechSynthesis.cancel(); } catch {} if (AUD){ try { AUD.pause(); } catch {} AUD = null; } ORB.analyser = null; }
async function falar(text){
  if (!BIA.set.voz){ setState("finalizado"); return; }
  let t = limpaFala(text); if (t.length > 650){ const cut = t.slice(0, 650); t = cut.slice(0, Math.max(cut.lastIndexOf(". "), 300) + 1); }
  setState("respondendo");
  if (BIA.set.natural){
    try {
      const tk = await window.__bri.token();
      const r = await fetch("/api/voz", {method: "POST", headers: {"Content-Type": "application/json", Authorization: "Bearer " + tk}, body: JSON.stringify({texto: t})});
      if (!r.ok) throw new Error("voz");
      const url = URL.createObjectURL(await r.blob()); const a = AUD = new Audio(url); a.crossOrigin = "anonymous";
      try { ACTX = ACTX || new (window.AudioContext || window.webkitAudioContext)(); if (ACTX.state === "suspended") await ACTX.resume(); const src = ACTX.createMediaElementSource(a), an = ACTX.createAnalyser(); an.fftSize = 256; src.connect(an); an.connect(ACTX.destination); ORB.analyser = an; } catch {}
      a.onended = () => { URL.revokeObjectURL(url); if (AUD === a){ AUD = null; fimFala(); } };
      await a.play(); return;
    } catch { /* cai para a voz do navegador */ }
  }
  try {
    const u = new SpeechSynthesisUtterance(t); u.lang = "pt-BR"; const vs = speechSynthesis.getVoices().filter(v => /pt[-_]BR/i.test(v.lang)); u.voice = vs.find(v => /natural|online|neural/i.test(v.name)) || vs.find(v => /google/i.test(v.name)) || vs[0] || null; u.rate = 1.04; u.pitch = 0.92;
    u.onboundary = () => { ORB.target = 0.6 + Math.random() * 0.4; }; u.onend = fimFala; u.onerror = fimFala; speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch { fimFala(); }
}

/* ================= ajustes ================= */
function closeSet(){ const s = document.getElementById("biaSet"); if (s) s.remove(); }
function openSet(){
  if (document.getElementById("biaSet")) return closeSet();
  const ch = document.querySelector("#bia .bia-chat"); if (!ch) return;
  const seg = (k, opts) => `<span class="bia-seg">${opts.map(([v, t]) => `<button data-set="${k}" data-v="${v}" class="${String(BIA.set[k]) === String(v) ? "on" : ""}">${t}</button>`).join("")}</span>`;
  ch.insertAdjacentHTML("beforeend", `<div class="bia-set" id="biaSet"><label>Voz ${seg("natural", [["true", "Natural"], ["false", "Navegador"]])}</label><label>Visual ${seg("visual", [["nucleo", "Núcleo"], ["compacto", "Só voz"]])}</label><label>Responder falando ${seg("voz", [["true", "Sim"], ["false", "Não"]])}</label><label>Modo conversa ${seg("conversa", [["true", "Ligado"], ["false", "Desligado"]])}</label><small style="color:var(--mut)">No modo conversa, depois de responder a IA volta a ouvir sozinha.</small></div>`);
}
function applySet(){ saveSet(); const b = document.getElementById("bia"); if (b) b.classList.toggle("compact", BIA.set.visual === "compacto"); const p = document.getElementById("biaPill"); if (p) p.style.display = BIA.set.visual === "compacto" ? "flex" : "none"; const v = document.getElementById("biaVoz"); if (v){ v.classList.toggle("on", BIA.set.voz); v.innerHTML = ic(BIA.set.voz ? "som" : "mudo"); } }

/* ================= montagem e eventos ================= */
function bind(root){
  root.addEventListener("click", async e => {
    const t = e.target; const z = t.closest("[data-zoom]"); if (z){ const lb = document.createElement("div"); lb.className = "bia-lb"; lb.innerHTML = `<img src="${E(z.dataset.zoom)}" alt="">`; lb.onclick = () => lb.remove(); document.body.appendChild(lb); return; }
    if (t.closest("[data-pclose]")) return closePanel();
    const pt = t.closest("[data-ptab]"); if (pt && BIA.panel){ BIA.panel.tab = pt.dataset.ptab; return paintPanel(); }
    const cp = t.closest("[data-copy]"); if (cp){ const l = D.lots().find(x => x.id === cp.dataset.copy); if (l) copyText(resumoTexto(l)); return; }
    const st2 = t.closest("[data-set]"); if (st2){ const k = st2.dataset.set, v = st2.dataset.v; BIA.set[k] = v === "true" ? true : v === "false" ? false : v; applySet(); closeSet(); openSet(); return; }
    const lotB = t.closest("[data-lot]");
    if (lotB){ const id = lotB.dataset.lot, card = lotB.closest(".bia-card");
      if (BIA.pick && card && lotB.closest(".bia-ui") && !t.closest(".go")){ const i = BIA.pick.indexOf(id); if (i >= 0) BIA.pick.splice(i, 1); else if (BIA.pick.length < 3) BIA.pick.push(id); card.classList.toggle("sel", BIA.pick.includes(id)); return; }
      const blockTab = lotB.closest("[data-tab]") ? lotB.closest("[data-tab]").dataset.tab : null; return openLot(id, lotB.dataset.tab || blockTab); }
    const q = t.closest("[data-q]"); if (q){ const v = q.dataset.q; closePanel(); if (v === "tabela") return act("precos"); if (v === "comparar") return act("comparar"); if (v === "visita") return act("novatarefa", "visita"); if (v === "duvidas") return act("duvidas"); return ask(v); }
    const a = t.closest("[data-act]"); if (a) return act(a.dataset.act, a.dataset.arg);
    const vd = t.closest("[data-venda]"); if (vd){ return pushAI("", [{t: "venda", id: vd.dataset.venda}], {speak: false}); }
    const tk = t.closest("[data-task],[data-edit]"); if (tk){ const doc = D.agendaItems().find(x => x.id === (tk.dataset.task || tk.dataset.edit)); if (doc) return pushAI("", [{t: "form", f: "tarefa", doc}], {speak: false}); }
    const cl = t.closest("[data-cli]"); if (cl) return pushAI(`Cliente **${cl.dataset.cli}**:`, [{t: "clientes", q: cl.dataset.cli}], {speak: false});
    const del = t.closest("[data-del]"); if (del){ const doc = D.agendaItems().find(x => x.id === del.dataset.del); if (!doc || !confirm("Excluir esta tarefa?")) return; try { await D.salvarAgenda({...doc, deleted_at: nowISO()}); toast("Tarefa excluída"); del.closest(".bia-box").innerHTML = tarefasHTML({}); widgets(); } catch (err){ toast(err.message); } return; }
    if (t.closest("#biaMic")) return ouvir();
    if (t.closest("#biaSend")) return ask(document.getElementById("biaQ").value);
    if (t.closest("#biaVoz")){ BIA.set.voz = !BIA.set.voz; if (!BIA.set.voz) stopFala(); return applySet(); }
    if (t.closest("#biaCfg")) return openSet();
    if (!t.closest("#biaSet")) closeSet();
  });
  root.addEventListener("change", async e => {
    const d = e.target.closest("[data-done]"); if (d){ const doc = D.agendaItems().find(x => x.id === d.dataset.done); if (!doc) return; try { await D.salvarAgenda({...doc, done: d.checked, done_at: d.checked ? nowISO() : null}); d.closest(".bia-task").classList.toggle("done", d.checked); widgets(); toast(d.checked ? "Tarefa concluída ✓" : "Tarefa reaberta"); } catch (err){ d.checked = !d.checked; toast(err.message); } return; }
    if (e.target.id === "biaAs"){ BIA.as = e.target.value; BIA.msgs = []; BIA.hist = []; D._pc = null; mount(document.getElementById("biaRoot")); }
  });
  root.addEventListener("submit", async e => {
    const f = e.target.closest("[data-form=tarefa]"); if (!f) return; e.preventDefault();
    const fd = new FormData(f), id = f.dataset.id, old = id ? D.agendaItems().find(x => x.id === id) : null;
    const doc = {...(old || {id: rid("appt"), created_at: nowISO(), done: false}), title: String(fd.get("title") || "").trim(), type: fd.get("type"), when: String(fd.get("when") || "").slice(0, 16), client_name: String(fd.get("client_name") || "").trim(), lot: fd.get("lot") || "", notes: String(fd.get("notes") || "").trim()};
    if (!doc.title || !doc.when) return toast("Informe o título e a data.");
    const btn = f.querySelector("button.gold"); btn.disabled = true; btn.textContent = "Salvando…";
    try { await D.salvarAgenda(doc); widgets(); f.closest(".bia-box").outerHTML = tarefasHTML({}); toast(old ? "Tarefa atualizada" : "Tarefa agendada ✓"); if (BIA.panel) closePanel(); setState("finalizado"); }
    catch (err){ btn.disabled = false; btn.textContent = "Salvar"; toast(err.message); }
  });
  root.addEventListener("keydown", e => { if (e.target.id === "biaQ" && e.key === "Enter"){ e.preventDefault(); ask(e.target.value); } });
}
async function mount(root){
  if (!root) return; addCSS(); stopFala();
  root.innerHTML = html(); const b = document.getElementById("bia"); bind(root);
  startOrb(document.getElementById("biaOrb")); applySet(); setState(BIA.busy ? "analisando" : "pronto");
  await D.loadAgenda(); widgets();
  if (!BIA.msgs.length){ BIA.msgs.push({who: "ai", text: `Olá, ${D.nome().split(" ")[0]}! 👋\nSou a **Brilhante's IA**, sua assistente exclusiva. Posso te ajudar com loteamentos, tabelas de preços, comissões, agenda e clientes.\n\nO que você precisa agora?`, ui: [quick()]}); }
  BIA.msgs.forEach(m => renderMsg(m, false));
}
BIA.mount = mount; BIA.refresh = () => { if (document.getElementById("bia")) widgets(); }; BIA.ask = ask; BIA.act = act; BIA.openLot = openLot;

/* ================= integração com o sistema ================= */
// gestor: nova aba (com prévia "visualizando como" corretor)
if (typeof TABS !== "undefined" && typeof VIEWS !== "undefined"){
  TABS.splice(TABS.length, 0, ["bia", "Brilhante's IA"]);
  VIEWS.bia = {html: () => `<div id="biaRoot"></div>`, bind(){ mount(document.getElementById("biaRoot")); }, update(){ BIA.refresh(); }};
}
// corretor: vira a primeira aba ("Início")
if (typeof bootCorretor === "function"){
  const _boot = bootCorretor, _render = renderCorretor;
  renderCorretor = function(){
    if (ui.tab === "bia"){ if (document.getElementById("bia")) BIA.refresh(); else { const m = document.getElementById("main"); m.innerHTML = `<div id="biaRoot"></div>`; m.onclick = null; mount(document.getElementById("biaRoot")); } return; }
    return _render.apply(this, arguments);
  };
  bootCorretor = async function(){
    const r = await _boot.apply(this, arguments);
    const tabs = document.getElementById("tabs");
    if (tabs && !tabs.querySelector('[data-tab="bia"]')){ tabs.insertAdjacentHTML("afterbegin", `<button role="tab" data-tab="bia" aria-selected="true">Brilhante's IA</button>`); tabs.querySelectorAll("button").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === "bia")); }
    ui.tab = "bia"; const m = document.getElementById("main"); m.innerHTML = `<div id="biaRoot"></div>`; mount(document.getElementById("biaRoot"));
    return r;
  };
}
})();
