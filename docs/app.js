/* Acta · interface. Tudo o que aparece aqui é calculado de verdade:
 * os arquivos são lidos pelo motor (acta-engine.js) e, com IA conectada e
 * permissão marcada, enviados anonimizados ao provedor (acta-ai.js). */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const E = window.ActaEngine, AI = window.ActaAI;
const stages = ["startStage", "clarifyStage", "planStage", "buildStage", "resultStage"];
const SAMPLES = {
  civel: ["01-peticao-inicial-ficticia.pdf", "02-contestacao-ficticia.pdf", "03-decisao-ficticia.pdf"],
  trabalhista: ["04-reclamacao-trabalhista-ficticia.pdf", "05-contestacao-trabalhista-ficticia.pdf", "06-ata-audiencia-trabalhista-ficticia.pdf"],
};
const TASK_INFO = {
  cronologia: { name: "Cronologia processual", icon: "C", file: "cronologia-processual.md", desc: "Eventos do processo por data, com documento, página e alertas." },
  relatorio: { name: "Relatório ao cliente", icon: "R", file: "relatorio-ao-cliente.md", desc: "Situação do caso, valores, decisão e pontos de atenção." },
  comparacao: { name: "Comparação das alegações", icon: "A", file: "comparacao-alegacoes.md", desc: "O que autora e ré dizem, lado a lado, e os pontos controvertidos." },
  organizacao: { name: "Organização dos documentos", icon: "D", file: "indice-documentos.md", desc: "Tipo, título, processo e resumo de cada peça." },
  riscos: { name: "Mapa de riscos", icon: "!", file: "mapa-de-riscos.md", desc: "Riscos, provas necessárias e o que conferir." },
  outro: { name: "Tarefa personalizada", icon: "+", file: "resultado.md", desc: "Tarefa descrita pelo advogado, feita com IA." },
};
const LOCAL_PLAN = {
  cronologia: ["Achar todas as datas, inclusive intervalos e datas sem ano", "Achar os prazos e avisar quando falta o termo inicial", "Montar a cronologia em ordem de data"],
  relatorio: ["Identificar a situação atual pela decisão mais recente", "Reunir valores, pontos controvertidos e o último evento", "Escrever o relatório"],
  comparacao: ["Separar o que diz a inicial e o que diz a defesa", "Colocar as alegações lado a lado", "Listar os pontos controvertidos fixados pelo juízo"],
  organizacao: ["Identificar o tipo e o título de cada peça", "Achar o número do processo e resumir cada documento", "Montar o índice"],
  riscos: ["Partir dos pontos controvertidos fixados pelo juízo", "Marcar prazos, excludentes alegadas e valores", "Montar o mapa de riscos com a prova necessária"],
};

const CLAUDE_URL = "https://claude.ai/artifact/Sqad48sNr27gpyXKH8EfaA";
const state = { files: [], docs: null, task: "cronologia", plan: null, result: null, skill: null, sample: null };

// ---------- utilidades ----------
function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 3000); }
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sem armazenamento */ } },
};
function showView(id) { $$(".view").forEach(v => v.classList.toggle("is-active", v.id === id)); $$(".nav-item").forEach(b => b.classList.toggle("is-active", b.dataset.view === id)); $(".sidebar").classList.remove("open"); scrollTo({ top: 0, behavior: "smooth" }); if (id === "skills") renderSkills(); if (id === "history") renderHistory(); if (id === "settings") renderAiPanel(); if (id === "case-demo") runCaseDemo(); }
function showStage(id) { stages.forEach(s => $("#" + s).classList.toggle("is-active", s === id)); const i = stages.indexOf(id); $$("#stepper li").forEach((li, k) => { li.classList.toggle("on", k === i); li.classList.toggle("done", k < i); }); scrollTo({ top: 0, behavior: "smooth" }); }
function enterApp(view) { $("#loginView").classList.add("is-hidden"); $("#appView").classList.remove("is-hidden"); showView(view); }

// ---------- entrada e navegação ----------
$("#loginButton").addEventListener("click", () => enterApp("builder"));
$("#openCase").addEventListener("click", () => enterApp("case-demo"));
$("#backHome").addEventListener("click", () => { $("#appView").classList.add("is-hidden"); $("#loginView").classList.remove("is-hidden"); scrollTo({ top: 0 }); });
$$(".nav-item").forEach(b => b.addEventListener("click", () => showView(b.dataset.view)));
$("#mobileMenu").addEventListener("click", () => $(".sidebar").classList.toggle("open"));
$$(".nav-build").forEach(b => b.addEventListener("click", () => { clearSkill(); showView("builder"); showStage("startStage"); }));
$$(".nav-examples").forEach(b => b.addEventListener("click", () => showView("examples")));
$$("[data-back]").forEach(b => b.addEventListener("click", () => showStage(b.dataset.back)));
$$(".l-tab").forEach(t => t.addEventListener("click", () => { $$(".l-tab").forEach(x => x.classList.toggle("on", x === t)); $$(".l-case").forEach(c => c.classList.toggle("is-hidden", c.id !== "case-" + t.dataset.case)); }));
$$(".use-example").forEach(b => b.addEventListener("click", () => { clearSkill(); showView("builder"); showStage("startStage"); $("#requestText").value = b.dataset.prompt; setTask(detectTask(b.dataset.prompt)); toast("Exemplo carregado. Escolha os arquivos e clique em Ver o plano."); }));
$("#editOffice").addEventListener("click", () => { $("#officePrompt").scrollIntoView({ behavior: "smooth", block: "center" }); $("#officePrompt").focus(); });
const prefs = () => ({ approve: true, tests: true, blockAi: false, ...store.get("acta.prefs", {}) });
function renderPrefs() { const p = prefs(); $("#prefApprove").checked = p.approve; $("#prefTests").checked = p.tests; $("#prefBlockAi").checked = p.blockAi; $(".criteria-card").classList.toggle("is-hidden", !p.tests); }
[["#prefApprove", "approve"], ["#prefTests", "tests"], ["#prefBlockAi", "blockAi"]].forEach(([id, k]) => $(id).addEventListener("change", () => { store.set("acta.prefs", { ...prefs(), [k]: $(id).checked }); renderPrefs(); refreshAi(); toast("Configuração salva."); }));
renderPrefs();
$$(".nav-skills").forEach(b => b.addEventListener("click", () => showView("skills")));

// ---------- arquivos ----------
function renderFiles() {
  const box = $("#fileChips");
  if (!state.files.length) { box.innerHTML = '<span class="hint-text">Nenhum arquivo escolhido ainda.</span>'; return; }
  box.innerHTML = state.files.map((f, i) => `<span class="chip">📄 ${esc(f.name)} <button data-rm="${i}" title="Remover">×</button></span>`).join("");
  $$("[data-rm]", box).forEach(b => b.addEventListener("click", () => { state.files.splice(+b.dataset.rm, 1); state.docs = null; state.sample = null; renderFiles(); }));
}
async function loadSample(kind) {
  state.files = [];
  for (const n of SAMPLES[kind]) { const blob = await (await fetch("demo/" + n)).blob(); state.files.push(new File([blob], n, { type: "application/pdf" })); }
  state.docs = null; state.sample = kind; renderFiles();
}
$("#pickFiles").addEventListener("click", () => $("#fileInput").click());
$("#fileInput").addEventListener("change", e => { state.files = [...e.target.files]; state.docs = null; state.sample = null; renderFiles(); e.target.value = ""; });
$$(".sample-btn").forEach(b => b.addEventListener("click", async () => { await loadSample(b.dataset.case); toast("Caso de exemplo carregado."); }));
async function readDocs() {
  if (state.docs) return state.docs;
  state.docs = [];
  for (const f of state.files) state.docs.push(await E.readFile(f));
  return state.docs;
}

// ---------- tarefa ----------
function detectTask(text) {
  const t = text.toLowerCase();
  if (/relat[oó]rio|cliente/.test(t)) return "relatorio";
  if (/compar|alega/.test(t)) return "comparacao";
  if (/organiz|[ií]ndice|classifi/.test(t)) return "organizacao";
  if (/risco|prova/.test(t)) return "riscos";
  if (/cronolog|linha do tempo|datas|prazos/.test(t)) return "cronologia";
  return "outro";
}
function setTask(k) { state.task = k; $$(".task-card").forEach(c => c.classList.toggle("on", c.dataset.task === k)); }
$$(".task-card").forEach(c => c.addEventListener("click", () => {
  setTask(c.dataset.task);
  if (c.dataset.task === "outro") { $("#requestText").value = ""; $("#requestText").placeholder = "Escreva o que precisa. Ex.: liste todos os pedidos da inicial e diga quais a defesa contestou."; $("#requestText").focus(); if (!aiAvailable) toast("Tarefas livres precisam de IA. Conecte em Configurações."); else $("#useAi").checked = true; }
  else $("#requestText").value = c.dataset.prompt;
}));
$("#requestText").addEventListener("input", () => { const k = detectTask($("#requestText").value); if (k !== "outro" || $(".task-card.on")?.dataset.task !== "outro") setTask(k); });

// ---------- IA ----------
let aiAvailable = false;
async function refreshAi() {
  const st = await AI.status(); aiAvailable = st.available && !prefs().blockAi;
  if (st.available && prefs().blockAi) { st.available = false; st.label = "IA bloqueada em Configurações (sigilo total)"; }
  $("#useAi").disabled = !st.available; if (!st.available) $("#useAi").checked = false;
  $("#aiLabel").textContent = st.available ? "Usar IA (texto anonimizado)" : "IA desligada";
  $("#aiStatusLine").innerHTML = st.available ? `IA conectada: ${esc(st.label)}.` : prefs().blockAi ? "IA bloqueada em Configurações (sigilo total): nada sai do computador." : `Sem IA: a Acta funciona no modo local, copiando trechos do processo. Para resultados em linguagem simples, <a href="${CLAUDE_URL}" target="_blank">abra a Acta dentro do Claude</a> (IA sem chave) ou <a href="#" id="goSettings">conecte uma chave</a>.`;
  const g = $("#goSettings"); if (g) g.addEventListener("click", e => { e.preventDefault(); showView("settings"); });
  return st;
}
async function renderAiPanel() {
  const st = await refreshAi(), s = AI.settings();
  $("#aiPanelStatus").innerHTML = `<b>${st.available ? "● Conectada" : "○ Não conectada"}</b> · ${esc(st.label)}`;
  $("#aiProvider").value = s.provider || "anthropic"; $("#aiModel").value = s.model || ""; $("#aiKey").value = s.key ? "••••••••" : "";
  $("#officePrompt").value = store.get("acta.officePrompt", "");
}
$("#aiSave").addEventListener("click", async () => {
  const s = AI.settings(), key = $("#aiKey").value.trim();
  const next = { provider: $("#aiProvider").value, model: $("#aiModel").value.trim(), key: key && !key.startsWith("•") ? key : s.key };
  if (!next.key) return toast("Cole a chave de API.");
  AI.saveSettings(next); await renderAiPanel(); toast("IA conectada. Ela só é usada quando você marcar a permissão.");
});
$("#aiRemove").addEventListener("click", async () => { AI.saveSettings({}); await renderAiPanel(); toast("Chave removida deste navegador."); });
$("#officePrompt").addEventListener("change", () => store.set("acta.officePrompt", $("#officePrompt").value));

// ---------- pedido → perguntas → plano ----------
const context = () => `Objetivo: ${$("#ctxGoal").value}. Atenção a: ${$("#ctxFocus").value}. Público: ${$("#ctxAudience").value}.`;
$("#requestForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (!state.files.length) return toast("Escolha os arquivos ou use um caso de exemplo.");
  const text = $("#requestText").value.trim();
  if (!text) return toast("Escolha uma tarefa ou escreva o pedido.");
  if (state.task === "outro" && !(aiAvailable && $("#useAi").checked)) return toast("Tarefas livres precisam de IA: conecte em Configurações e marque Usar IA.");
  if (state.skill) return runSkill();
  $("#userRequestPreview").textContent = text;
  $("#taskNote").classList.add("is-hidden");
  showStage("clarifyStage");
});
$("#requestText").addEventListener("keydown", e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") $("#requestForm").requestSubmit(); });

$("#contextForm").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = $("#contextForm button"); btn.disabled = true; btn.textContent = "Montando o plano...";
  try { await buildPlan(); if (prefs().approve) showStage("planStage"); else execute({ fromSkill: null }); }
  catch (err) { toast(err.message); }
  finally { btn.disabled = false; btn.textContent = "Gerar plano →"; }
});
async function buildPlan() {
  const docs = await readDocs(), info = TASK_INFO[state.task], useAi = aiAvailable && $("#useAi").checked;
  let plan, warning = "";
  if (useAi) {
    try { plan = await AI.plan($("#requestText").value, info.name, docs.map(d => d.name), context(), store.get("acta.officePrompt", "")); }
    catch (err) { warning = `${err.message} O plano abaixo é o do modo local.`; }
  }
  if (!plan) {
    if (state.task === "outro") throw new Error(warning || "Tarefa livre precisa de IA.");
    plan = { title: info.name, objective: $("#requestText").value, mode: "local", questions: [],
      steps: ["Ler só os arquivos autorizados", "Tirar cabeçalhos repetidos e juntar as frases que o PDF quebrou", "Identificar o tipo de cada peça", ...LOCAL_PLAN[state.task], "Ligar cada informação ao documento e à página", "Listar o que você ainda precisa conferir"],
      tests: ["Toda informação indica documento e página", "Datas incertas e prazos sem termo inicial aparecem como alerta", "Nenhum arquivo original é alterado"] };
  }
  state.plan = plan;
  renderPlan(plan, warning, useAi);
}
function renderPlan(plan, warning, useAi) {
  const docs = state.docs || [];
  $("#planMode").textContent = plan.mode === "ia" ? "PLANO PROPOSTO PELA IA" : "PLANO DO MODO LOCAL (SEM IA)";
  $("#planTitle").textContent = plan.title; $("#planObjective").textContent = plan.objective;
  $("#planList").innerHTML = plan.steps.map((s, i) => `<li><span>${i + 1}</span><div><b>${esc(s)}</b></div></li>`).join("");
  $("#planTests").innerHTML = plan.tests.map(t => `<li>${esc(t)}</li>`).join("");
  const q = plan.questions || [];
  $("#planQuestions").classList.toggle("is-hidden", !q.length);
  $("#planQuestions").innerHTML = q.length ? `<b>A IA quer confirmar antes:</b><ul>${q.map(x => `<li>${esc(x)}</li>`).join("")}</ul><small>Responda ajustando o pedido (Editar pedido) ou aprove assim mesmo.</small>` : "";
  $("#planWarning").textContent = warning; $("#planWarning").classList.toggle("is-hidden", !warning);
  $("#permFiles").textContent = docs.map(d => d.name).join(", ") || "0 arquivos";
  $("#outFile").textContent = TASK_INFO[state.task].file;
  $("#allowExternal").disabled = !aiAvailable; $("#allowExternal").checked = !!(useAi && plan.mode === "ia");
  $("#extHint").textContent = aiAvailable ? "Nomes, CPF, CNPJ e nº do processo viram códigos" : "Sem IA conectada";
  renderAnon();
}
function renderAnon() {
  const card = $("#anonCard");
  if (!$("#allowExternal").checked || !state.docs) { card.classList.add("is-hidden"); return; }
  const { anon, body, chosen, total: pieces } = AI.prepareSend(state.docs, state.task);
  const total = anon.found.reduce((n, f) => n + f.occurrences, 0);
  $("#anonSummary").textContent = `${pieces > chosen.length ? `O processo tem ${pieces} peças; vão as ${chosen.length} mais importantes para esta tarefa. ` : ""}${anon.found.length} dado(s) identificável(is), em ${total} ocorrência(s), viram códigos. A tabela abaixo fica só aqui.`;
  $("#anonTable").innerHTML = anon.found.map(f => `<tr><td>${esc(f.value)}</td><td><code>${esc(f.code)}</code></td></tr>`).join("") || "<tr><td>Nenhum dado identificável encontrado.</td></tr>";
  $("#anonPreview").textContent = body.slice(0, 2500);
  card.classList.remove("is-hidden");
}
$("#allowExternal").addEventListener("change", renderAnon);

// ---------- execução ----------
$("#approvePlan").addEventListener("click", () => {
  if (!$("#allowRead").checked) return toast("Autorize a leitura dos arquivos para continuar.");
  execute({ fromSkill: null });
});
function progress(p, text) { $("#progressBar").style.width = p + "%"; $("#progressValue").textContent = p + "%"; if (text) $("#buildStatus").textContent = text; }
async function execute({ fromSkill }) {
  showStage("buildStage");
  const info = TASK_INFO[state.task], useAi = aiAvailable && $("#allowExternal").checked;
  $("#buildTitle").textContent = fromSkill ? `Skill "${fromSkill.name}"` : info.name;
  try {
    progress(10, "Lendo os arquivos...");
    const docs = await readDocs();
    progress(35, "Limpando o texto e identificando as peças...");
    await new Promise(r => setTimeout(r, 250));
    let out;
    if (useAi) {
      progress(55, "Trocando nomes e documentos por códigos e enviando à IA...");
      try { out = await AI.run(docs, $("#requestText").value, { ...state.plan, task: state.task }, context(), store.get("acta.officePrompt", "")); out.task = state.task; out.sources = docs.map(d => d.name); }
      catch (err) { if (state.task === "outro") throw err; toast(`${err.message} Usando o modo local.`); }
      progress(85, "Conferindo cada trecho citado no documento original...");
    }
    if (!out) { progress(70, "Montando o resultado..."); out = E.analyze(docs, state.task); }
    progress(100, "Pronto.");
    state.result = out;
    logHistory(out, fromSkill, useAi);
    await new Promise(r => setTimeout(r, 300));
    renderResult(out, fromSkill);
    showStage("resultStage");
  } catch (err) {
    toast(err.message); showStage(fromSkill ? "startStage" : "planStage");
  }
}
$("#rerun").addEventListener("click", () => execute({ fromSkill: state.skill }));

// ---------- resultado ----------
const src = (n, p) => `${esc(String(n || "").includes(" · ID") ? "Peça " + String(n).split(" · ").pop() : n)}${p ? `, p. ${p}` : ""}`;
function renderBody(out) {
  const r = out.result;
  if (out.mode === "ia" && out.task === "comparacao" && out.items.some(i => i.topic)) {
    const v = out.verification, topics = [...new Set(out.items.map(i => i.topic || "Outros"))];
    const cell = i => i ? `${esc(i.text)}<q>${esc(i.quote || "")}</q><small class="r-src">${src(i.source, i.page)}</small> <span class="r-badge ${i.status === "conferido" ? "ok" : "bad"}">${esc(i.status)}</span>` : '<span class="r-src">Não tratou deste tema.</span>';
    const side = (t, re) => out.items.filter(i => (i.topic || "Outros") === t && re.test(i.label || ""));
    return `${out.summary ? `<p class="r-summary">${esc(out.summary)}</p>` : ""}<div class="r-metrics"><div><span>Temas</span><b>${topics.length}</b></div><div><span>Trechos conferidos no processo</span><b>${v.confirmed} de ${v.total}</b></div><div><span>Sem trecho localizado</span><b class="${v.not_found ? "bad-text" : ""}">${v.not_found}</b></div></div>
      <table class="r-table"><thead><tr><th>Tema</th><th>O que diz o autor</th><th>O que diz o réu</th></tr></thead><tbody>${topics.map(t => { const A = side(t, /autor|pedido|fato/i), R = side(t, /r[ée]u|defesa/i); return `<tr><td><b>${esc(t)}</b></td><td>${A.map(cell).join("<hr>") || cell()}</td><td>${R.map(cell).join("<hr>") || cell()}</td></tr>`; }).join("")}</tbody></table>`;
  }
  if (out.mode === "ia") {
    const v = out.verification, cls = { "conferido": "ok", "outro arquivo": "warn", "não localizado": "bad", "sem trecho": "bad" };
    return `${out.summary ? `<p class="r-summary">${esc(out.summary)}</p>` : ""}<div class="r-metrics"><div><span>Afirmações</span><b>${v.total}</b></div><div><span>Conferidas no arquivo citado</span><b>${v.confirmed}</b></div><div><span>Sem trecho localizado</span><b class="${v.not_found ? "bad-text" : ""}">${v.not_found}</b></div></div>
      <table class="r-table"><thead><tr><th>Data</th><th>Informação</th><th>Fonte</th><th>Conferência</th></tr></thead><tbody>${out.items.map(i => `<tr><td class="nowrap">${esc(i.date || "—")}</td><td><b class="r-label">${esc(i.label || "")}</b> ${esc(i.text)}${i.quote ? `<q>${esc(i.quote)}</q>` : ""}</td><td class="r-src">${src(i.source, i.page)}</td><td><span class="r-badge ${cls[i.status] || "warn"}">${esc(i.status)}</span>${i.date_in_quote === false ? '<span class="r-badge bad">data fora do trecho</span>' : ""}</td></tr>`).join("") || '<tr><td colspan="4">A IA não devolveu itens.</td></tr>'}</tbody></table>
      <details class="r-anon"><summary>O que saiu do computador (${out.anonymization.sent_characters} caracteres, ${out.anonymization.replaced.length} dados trocados por código)</summary><p>${out.anonymization.replaced.map(x => `<code>${esc(x.code)}</code> ×${x.occurrences}`).join(" · ") || "Nenhum dado identificável."}</p><pre>${esc(out.anonymization.sent_preview)}</pre></details>`;
  }
  if (out.task === "cronologia") return `<table class="r-table"><thead><tr><th>Data</th><th>Evento, como está no documento</th><th>Fonte</th></tr></thead><tbody>${r.events.map(e => `<tr><td class="nowrap"><b>${e.date}${e.end_date ? ` a ${e.end_date}` : ""}</b>${e.note ? '<br><span class="r-badge warn">ano inferido</span>' : ""}${e.kind === "juntada" ? '<br><span class="r-badge ok">movimentação</span>' : ""}</td><td>${esc(e.event)}</td><td class="r-src">${src(e.source, e.page)}</td></tr>`).join("") || '<tr><td colspan="3">Nenhuma data encontrada.</td></tr>'}${r.deadlines.map(d => `<tr><td class="nowrap"><b>Prazo: ${esc(d.deadline)}</b></td><td>${esc(d.event)}</td><td class="r-src">${src(d.source, d.page)}</td></tr>`).join("")}</tbody></table>`;
  if (out.task === "comparacao") { const col = xs => `<ul>${xs.map(x => `<li>“${esc(x.text)}” <small class="r-src">(${esc(x.piece || "")}, p. ${x.page})</small></li>`).join("") || "<li>Nenhum trecho legível encontrado.</li>"}</ul>`; return `<div class="r-two"><div><h3>${esc(r.columns[0])}</h3><small class="r-src">${esc((r.sources || [])[0] || "")}</small>${col(r.left)}</div><div><h3>${esc(r.columns[1])}</h3><small class="r-src">${esc((r.sources || [])[1] || "")}</small>${col(r.right)}</div></div>${r.controverted.length ? `<div class="r-block"><h3>Pontos controvertidos fixados pelo juízo</h3><ul>${r.controverted.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}`; }
  if (out.task === "organizacao") return `<p class="r-summary">${r.documents.length} peça(s), na ordem em que aparecem.</p><div class="r-docs">${r.documents.map(d => `<article><span>${esc(d.type)}${d.signed ? ` · ${esc(d.signed)}` : ""}</span>${d.title ? `<h3>${esc(d.title)}</h3>` : ""}<p>${esc(d.summary)}</p><small class="r-src">${d.id ? `ID ${esc(d.id)} · ` : `${esc(d.name)} · `}${d.first === d.last ? `p. ${d.first}` : `p. ${d.first} a ${d.last}`}</small></article>`).join("")}</div>`;
  if (out.task === "riscos") return `<div class="r-risks">${r.items.map(x => `<article><span class="r-badge ${x.level === "alto" ? "bad" : "warn"}">${esc(x.level.toUpperCase())}</span><h3>${esc(x.risk)}</h3><p>${esc(x.action)}</p>${x.quote ? `<q class="r-quote">${esc(x.quote)}</q>` : ""}${x.source ? `<small class="r-src">${src(x.source, x.page)}</small>` : ""}</article>`).join("")}</div>`;
  return `<div class="r-metrics"><div><span>${r.pieces > out.sources.length ? "Peças lidas" : "Documentos lidos"}</span><b>${r.documents.length}</b></div><div><span>Valores diferentes no processo</span><b>${r.amounts.length || "Nenhum"}</b></div><div><span>Peça mais recente</span><b>${(() => { const s = r.documents.filter(d => d.signed); return s.length ? esc(s[s.length - 1].signed) : (r.last_event ? esc(r.last_event.date) : "—"); })()}</b></div></div>
    <div class="r-block"><h3>Resumo</h3><p>${esc(r.summary)}</p><h3>Situação atual</h3><p>${esc(r.status)}${r.status_source ? ` <small class="r-src">(${esc(r.status_source.replace(/^.* · (ID \d+)/, "Peça $1"))})</small>` : ""}</p>${r.controverted.length ? `<h3>Pontos controvertidos fixados pelo juízo</h3><ul>${r.controverted.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}${(r.amount_list || []).length ? `<h3>Valores que aparecem no processo</h3><table class="r-table"><tbody>${r.amount_list.map(x => `<tr><td class="nowrap"><b>${esc(x.value)}</b></td><td>${esc(x.text)}</td><td class="r-src">${src(x.source, x.page)}</td></tr>`).join("")}</tbody></table>` : ""}<h3>Antes de enviar ao cliente</h3><ul><li>Validar valores, datas e prazos nos originais.</li><li>Revisar as conclusões jurídicas: a Acta não substitui o advogado.</li></ul></div>`;
}
function renderPending(box, list) {
  box.classList.toggle("is-hidden", !list.length);
  const li = x => `<li>${esc(x)}</li>`;
  $("ul", box).innerHTML = list.slice(0, 8).map(li).join("") + (list.length > 8 ? `<li class="more"><details><summary>Ver mais ${list.length - 8}</summary><ul>${list.slice(8).map(li).join("")}</ul></details></li>` : "");
}
function renderResult(out, fromSkill) {
  const info = TASK_INFO[out.task];
  $("#toolIcon").textContent = info.icon; $("#toolTitle").textContent = out.mode === "ia" ? (out.title || info.name) : info.name;
  $("#toolMeta").textContent = `${out.sources.length} arquivo(s)${out.pieces > out.sources.length ? `, ${out.pieces} peças do PJe` : ""} · ${out.mode === "ia" ? "feito com IA, trechos conferidos" : "modo local, nada enviado para fora"}`;
  $("#resultBody").innerHTML = renderBody(out);
  renderPending($("#resultPending"), out.pending || []);
  $("#resultChecks").innerHTML = ["Arquivos lidos: " + out.sources.length, out.mode === "ia" ? `Trechos conferidos: ${out.verification.confirmed} de ${out.verification.total}` : "Fonte com página em cada linha", "Originais alterados: nenhum", out.mode === "ia" ? "Enviado à IA só texto anonimizado" : "Nada enviado para fora"].map(x => `<span>✓ ${esc(x)}</span>`).join("");
  $("#saveCard").classList.toggle("is-hidden", !!fromSkill);
  $("#resEyebrow").textContent = fromSkill ? "Skill executada" : "Resultado";
  $("#resTitle").textContent = fromSkill ? "Pronto, sem refazer nada." : "Confira na fonte.";
  $("#resSub").textContent = fromSkill ? "Mesmo pedido, mesmo plano, arquivos novos." : "Cada linha mostra de onde veio. Se estiver bom, salve como skill.";
  $("#resPill").textContent = out.mode === "ia" ? "Feito com IA" : "Modo local";
  const note = $("#resultNote");
  const localNote = out.mode !== "ia" ? `Modo local: a Acta copia os trechos do processo como estão, sem reescrever (erros de digitação do original aparecem aqui). ${aiAvailable ? '<a href="#" id="redoAi">Refazer com IA em linguagem simples →</a>' : `Para um resultado escrito em linguagem simples, use a IA: <a href="${CLAUDE_URL}" target="_blank">abra a Acta dentro do Claude</a> ou conecte uma chave em Configurações.`}` : "";
  note.innerHTML = (fromSkill ? `Resultado da skill "<b>${esc(fromSkill.name)}</b>", com o plano aprovado quando ela foi salva. ` : "") + localNote;
  note.classList.toggle("is-hidden", !note.innerHTML);
  const redo = $("#redoAi"); if (redo) redo.addEventListener("click", async e => { e.preventDefault(); $("#useAi").checked = true; $("#allowExternal").checked = true; if (!state.plan || state.plan.mode !== "ia") { try { await buildPlan(); } catch (err) { return toast(err.message); } $("#allowExternal").checked = true; } execute({ fromSkill: state.skill }); });
  $("#skillName").value = state.task === "outro" ? ($("#requestText").value.slice(0, 50)) : info.name;
  $("#skillDesc").value = state.task === "outro" ? $("#requestText").value : info.desc;
}

// ---------- download ----------
function resultMarkdown() {
  const out = state.result; if (!out) return "";
  const lines = [`# ${$("#toolTitle").textContent}`, "", `Pedido: ${$("#requestText").value}`, `Arquivos: ${out.sources.join(", ")}`, `Modo: ${out.mode === "ia" ? "IA, texto anonimizado, trechos conferidos" : "local, sem envio de dados"}`, ""];
  const tmp = document.createElement("div"); tmp.innerHTML = renderBody(out);
  $$("table", tmp).forEach(t => { const rows = $$("tr", t).map(tr => "| " + $$("th,td", tr).map(c => c.innerText.replace(/\s+/g, " ").replace(/\|/g, "/")).join(" | ") + " |"); if (rows.length) rows.splice(1, 0, "|" + " --- |".repeat($$("th", t).length || 1)); lines.push(...rows, ""); t.remove(); });
  const rest = tmp.innerText.trim(); if (rest) lines.push(rest, "");
  if ((out.pending || []).length) lines.push("## O que conferir", ...out.pending.map(x => `- [ ] ${x}`), "");
  lines.push("> Gerado pela Acta para conferência humana. Não substitui o advogado.");
  return lines.join("\n");
}
$("#download").addEventListener("click", () => {
  const out = state.result; if (!out) return;
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([resultMarkdown()], { type: "text/markdown" })); a.download = TASK_INFO[out.task].file; a.click(); URL.revokeObjectURL(a.href);
});

$("#copyMd").addEventListener("click", async () => { try { await navigator.clipboard.writeText(resultMarkdown()); toast("Resultado copiado. Cole no Word ou no e-mail."); } catch (e) { toast("O navegador bloqueou a cópia."); } });

// ---------- skills ----------
const skills = () => store.get("acta.skills", []);
$("#saveSkill").addEventListener("click", () => {
  const name = $("#skillName").value.trim(); if (!name) return toast("Dê um nome à skill.");
  const list = skills().filter(s => s.name !== name);
  list.unshift({ id: Date.now(), name, desc: $("#skillDesc").value, task: state.task, prompt: $("#requestText").value, plan: state.plan, context: context(), useAi: $("#allowExternal").checked, created: new Date().toLocaleString("pt-BR") });
  store.set("acta.skills", list); toast(`Skill "${name}" salva.`); showView("skills");
});
function renderSkills() {
  const mine = skills(), grid = $("#skillGrid");
  const models = Object.entries(TASK_INFO).filter(([k]) => k !== "outro" && !mine.some(s => s.task === k && s.name === TASK_INFO[k].name));
  grid.innerHTML = mine.map(s => `<article class="skill-card use-skill featured" data-id="${s.id}"><span class="skill-icon">${esc(TASK_INFO[s.task].icon)}</span><div><b>${esc(s.name)}</b><p>${esc(s.desc || TASK_INFO[s.task].desc)}</p><small class="r-src">Salva em ${esc(s.created)}${s.useAi ? " · com IA" : ""}</small></div><span class="status-pill green">Usar →</span><button class="skill-del" data-del="${s.id}" title="Apagar">×</button></article>`).join("")
    + models.map(([k, t]) => `<article class="skill-card use-model" data-task="${k}"><span class="skill-icon">${t.icon}</span><div><b>${t.name}</b><p>${t.desc}</p></div><span class="status-pill neutral">Modelo · Usar →</span></article>`).join("");
  $$(".use-skill", grid).forEach(c => c.addEventListener("click", e => { if (e.target.dataset.del) return; startSkill(mine.find(s => String(s.id) === c.dataset.id)); }));
  $$("[data-del]", grid).forEach(b => b.addEventListener("click", () => { store.set("acta.skills", skills().filter(s => String(s.id) !== b.dataset.del)); renderSkills(); toast("Skill apagada."); }));
  $$(".use-model", grid).forEach(c => c.addEventListener("click", () => { clearSkill(); showView("builder"); showStage("startStage"); const card = $(`.task-card[data-task="${c.dataset.task}"]`); card.click(); toast("Escolha os arquivos e clique em Ver o plano."); }));
}
function startSkill(s) {
  state.skill = s; showView("builder"); showStage("startStage");
  setTask(s.task); $("#requestText").value = s.prompt; state.plan = s.plan;
  $("#skillBanner").innerHTML = `Usando a skill <b>${esc(s.name)}</b>: o pedido e o plano já estão prontos. Escolha os arquivos deste processo e clique em <b>Rodar skill</b>. <a href="#" id="cancelSkill">Cancelar</a>`;
  $("#skillBanner").classList.remove("is-hidden"); $("#goButton").textContent = "Rodar skill →";
  $("#cancelSkill").addEventListener("click", e => { e.preventDefault(); clearSkill(); });
  if (s.useAi && aiAvailable) $("#useAi").checked = true;
}
function clearSkill() { state.skill = null; $("#skillBanner").classList.add("is-hidden"); $("#goButton").textContent = "Ver o plano →"; }
async function runSkill() {
  const s = state.skill;
  await readDocs();
  $("#allowExternal").checked = !!(s.useAi && aiAvailable && $("#useAi").checked);
  state.plan = s.plan; await execute({ fromSkill: s });
}

// ---------- histórico ----------
function logHistory(out, fromSkill, useAi) {
  const h = store.get("acta.history", []);
  h.unshift({ when: new Date().toLocaleString("pt-BR"), task: TASK_INFO[out.task].name, skill: fromSkill ? fromSkill.name : null, files: out.sources, mode: useAi && out.mode === "ia" ? "IA (texto anonimizado)" : "local", sent: out.mode === "ia" ? `${out.anonymization.sent_characters} caracteres anonimizados` : "nada" });
  store.set("acta.history", h.slice(0, 50));
}
function renderHistory() {
  const h = store.get("acta.history", []);
  $("#historyList").innerHTML = h.length ? h.map(x => `<div><time>${esc(x.when)}</time><b>${esc(x.skill ? `Skill "${x.skill}"` : x.task)}</b><span>${esc(x.files.join(", "))} · modo ${esc(x.mode)} · enviado para fora: ${esc(x.sent)} · originais não alterados</span></div>`).join("") : '<div><b>Nenhuma execução ainda.</b><span>Rode uma tarefa em Construir e ela aparece aqui.</span></div>';
}
$("#clearHistory").addEventListener("click", () => { store.set("acta.history", []); renderHistory(); });

// ---------- caso demonstrativo (calculado de verdade) ----------
let caseDocs = null;
async function runCaseDemo(task) {
  task = task || $(".demo-action.is-active").dataset.task;
  $$(".demo-action").forEach(b => b.classList.toggle("is-active", b.dataset.task === task));
  $("#demoOutputTitle").textContent = TASK_INFO[task].name; $("#demoReady").textContent = "Lendo...";
  try {
    if (!caseDocs) { caseDocs = []; for (const n of SAMPLES.civel) { const blob = await (await fetch("demo/" + n)).blob(); caseDocs.push(await E.readFile(new File([blob], n))); } }
    const out = E.analyze(caseDocs, task);
    $("#demoResultBody").innerHTML = renderBody(out); renderPending($("#demoPending"), out.pending);
    $("#demoReady").textContent = "Pronto";
  } catch (err) { $("#demoResultBody").innerHTML = `<p class="hint-text">${esc(err.message)}</p>`; }
}
$$(".demo-action").forEach(b => b.addEventListener("click", () => runCaseDemo(b.dataset.task)));
$("#caseToBuilder").addEventListener("click", async () => { clearSkill(); showView("builder"); showStage("startStage"); await loadSample("civel"); toast("Caso carregado em Construir. Escolha a tarefa e clique em Ver o plano."); });

// ---------- início ----------
refreshAi();
