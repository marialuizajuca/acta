const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const state = { skill: 'relatorio', savedSkill: null, plan: null, result: null, ai: { available: false } };

const SKILL_NAMES = {
  relatorio: 'Relatório ao cliente', cronologia: 'Cronologia processual', comparacao: 'Comparar alegações',
  organizacao: 'Organizar documentos', riscos: 'Mapear riscos',
};
const TASK_DEFAULTS = {
  relatorio: 'Leia os documentos e prepare um relatório claro para o cliente, com situação atual, valores identificados e pontos de atenção.',
  cronologia: 'Monte uma cronologia com datas, eventos, prazos e indicação do documento e da página utilizados como fonte.',
  comparacao: 'Compare as alegações das partes e destaque os pontos controvertidos que exigem prova.',
  organizacao: 'Organize os documentos por tipo e gere um índice com resumo de cada arquivo.',
  riscos: 'Identifique riscos, provas necessárias e pontos que precisam de revisão do advogado.',
};
const SAMPLE_FILES = ['01-peticao-inicial-ficticia.pdf', '02-contestacao-ficticia.pdf', '03-decisao-ficticia.pdf'];

// ---------- estado inicial: IA disponível? skills salvas ----------
async function loadStatus() {
  const res = await fetch('/api/status');
  const data = await res.json();
  state.ai = data.ai;
  const pill = $('#statusPill');
  const box = $('#privacyBox');
  if (data.ai.available) {
    pill.textContent = `● IA conectada · ${data.ai.provider} · ${data.ai.model}`;
    pill.className = 'status ai';
    box.innerHTML = '<b>IA com sigilo</b><span>Só sai texto anonimizado, e só quando você marca a permissão. Sem ela, tudo roda no computador.</span>';
  } else {
    pill.textContent = '● modo local · sem IA';
    pill.className = 'status';
    box.innerHTML = '<b>Modo local</b><span>Nenhum dado sai do computador. Para usar IA, configure uma chave no arquivo .env (veja o README).</span>';
    $('#useAi').disabled = true;
    $('#aiHint').textContent = 'Indisponível: nenhuma chave de IA configurada. A Acta funciona no modo local.';
    $('#aiToggleLabel').classList.add('disabled');
  }
  renderSaved(data.saved_skills);
}

function renderSaved(list) {
  const box = $('#savedSkills');
  if (!list.length) { box.innerHTML = '<span class="empty">Nenhuma ainda. Salve uma depois de executar.</span>'; return; }
  box.innerHTML = list.map(s => `<button class="skill saved" data-saved="${esc(s.id)}"><b>${esc(s.name)}</b><span>${esc(s.description || SKILL_NAMES[s.base])}</span></button>`).join('');
  $$('.skill.saved').forEach(btn => btn.addEventListener('click', () => selectSaved(list.find(s => s.id === btn.dataset.saved), btn)));
}

function selectSkill(skill, btn) {
  state.skill = skill; state.savedSkill = null;
  $$('.skill').forEach(b => b.classList.toggle('active', b === btn));
  $('#task').value = TASK_DEFAULTS[skill];
  $('#skillBadge').textContent = SKILL_NAMES[skill];
}

function selectSaved(saved, btn) {
  state.skill = saved.base; state.savedSkill = saved;
  $$('.skill').forEach(b => b.classList.toggle('active', b === btn));
  $('#task').value = saved.task || TASK_DEFAULTS[saved.base];
  if (saved.system_prompt) $('#systemPrompt').value = saved.system_prompt;
  $('#skillBadge').textContent = `Skill salva: ${saved.name}`;
}

$$('.skill[data-skill]').forEach(btn => btn.addEventListener('click', () => selectSkill(btn.dataset.skill, btn)));

// ---------- arquivos ----------
function listFiles() {
  $('#fileList').innerHTML = [...$('#files').files].map(f => `<span>📄 ${esc(f.name)} · ${Math.ceil(f.size / 1024)} KB</span>`).join('');
}
$('#files').addEventListener('change', listFiles);

$('#sampleBtn').addEventListener('click', async () => {
  const dt = new DataTransfer();
  for (const name of SAMPLE_FILES) {
    const blob = await (await fetch(`/samples/${name}`)).blob();
    dt.items.add(new File([blob], name, { type: 'application/pdf' }));
  }
  $('#files').files = dt.files;
  listFiles();
});

function show(id) {
  ['request', 'plan', 'running', 'output'].forEach(x => $('#' + x).classList.toggle('hidden', x !== id));
  scrollTo({ top: 0, behavior: 'smooth' });
}

function warn(sel, text) {
  $(sel).textContent = text || '';
  $(sel).classList.toggle('hidden', !text);
}

// ---------- passo 2: plano ----------
$('#planBtn').addEventListener('click', async () => {
  if (!$('#files').files.length) { alert('Selecione pelo menos um documento.'); return; }
  const btn = $('#planBtn');
  btn.disabled = true; btn.textContent = 'Gerando o plano…';
  try {
    const res = await fetch('/api/plan', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task: $('#task').value, skill: state.skill, saved_skill_id: state.savedSkill?.id || '',
        use_ai: $('#useAi').checked, system_prompt: $('#systemPrompt').value,
        doc_names: [...$('#files').files].map(f => f.name),
      }),
    });
    const p = await res.json();
    state.plan = p;
    warn('#planWarning', p.warning);
    $('#planMode').textContent = p.mode === 'ia' ? 'Plano proposto pela IA para esta tarefa' : 'Plano do modo local (sem IA)';
    $('#planTitle').textContent = p.title;
    $('#planObjective').textContent = p.objective;
    $('#planSteps').innerHTML = p.steps.map(x => `<li>${esc(x)}</li>`).join('');
    $('#planTests').innerHTML = p.tests.map(x => `<li>${esc(x)}</li>`).join('');
    const q = p.questions || [];
    $('#planQuestions').classList.toggle('hidden', !q.length);
    $('#planQuestions ul').innerHTML = q.map(x => `<li>${esc(x)}</li>`).join('');
    $('#allowExternal').checked = p.mode === 'ia';
    $('#allowExternal').disabled = !state.ai.available;
    await refreshAnon();
    show('plan');
  } finally {
    btn.disabled = false; btn.textContent = 'Gerar plano da ferramenta →';
  }
});

async function refreshAnon() {
  const box = $('#anonBox');
  if (!$('#allowExternal').checked) { box.classList.add('hidden'); return; }
  const form = new FormData();
  [...$('#files').files].forEach(f => form.append('files', f));
  const data = await (await fetch('/api/anonymize', { method: 'POST', body: form })).json();
  if (data.error) { box.classList.add('hidden'); return; }
  const total = data.replaced.reduce((n, r) => n + r.occurrences, 0);
  $('#anonSummary').textContent = `${data.replaced.length} dado(s) identificável(is), em ${total} ocorrência(s), serão trocados por códigos. A tabela abaixo não sai do computador.`;
  $('#anonTable').innerHTML = data.replaced.map(r => `<tr><td>${esc(r.value)}</td><td><code>${esc(r.code)}</code></td></tr>`).join('') || '<tr><td colspan="2">Nenhum dado identificável encontrado.</td></tr>';
  $('#anonPreview').textContent = data.preview;
  box.classList.remove('hidden');
}
$('#allowExternal').addEventListener('change', refreshAnon);

$('#backBtn').addEventListener('click', () => show('request'));
$('#restartBtn').addEventListener('click', () => show('request'));

// ---------- passo 3: execução ----------
$('#runBtn').addEventListener('click', async () => {
  if (!$('#allowRead').checked) { alert('Autorize a leitura dos arquivos para continuar.'); return; }
  show('running');
  const external = $('#allowExternal').checked;
  const texts = external
    ? ['Trocando nomes e documentos por códigos…', 'Enviando o texto anonimizado à IA…', 'Conferindo cada trecho citado no original…', 'Devolvendo os nomes reais ao resultado…']
    : ['Extraindo o texto dos documentos…', 'Reconstruindo frases e removendo cabeçalhos…', 'Construindo a saída aprovada…', 'Listando o que precisa de conferência…'];
  let i = 0;
  $('#runningText').textContent = texts[0];
  const timer = setInterval(() => { $('#runningText').textContent = texts[Math.min(++i, texts.length - 1)]; }, external ? 1800 : 520);
  const form = new FormData();
  [...$('#files').files].forEach(f => form.append('files', f));
  form.append('skill', state.skill);
  form.append('saved_skill_id', state.savedSkill?.id || '');
  form.append('task', $('#task').value);
  form.append('system_prompt', $('#systemPrompt').value);
  form.append('allow_read', $('#allowRead').checked);
  form.append('allow_external', external);
  form.append('plan', JSON.stringify(state.plan || {}));
  try {
    const res = await fetch('/api/analyze', { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Falha na análise');
    state.result = data;
    renderResult(data);
    clearInterval(timer);
    setTimeout(() => show('output'), 300);
  } catch (e) {
    clearInterval(timer);
    alert(e.message);
    show('plan');
  }
});

// ---------- renderização ----------
const src = (name, page) => `${esc(name)}${page ? `, p. ${page}` : ''}`;
const STATUS_CLASS = { 'conferido': 'ok', 'outro arquivo': 'mid', 'não localizado': 'bad', 'sem trecho': 'bad' };

function renderResult(data) {
  const r = data.result;
  warn('#outWarning', data.warning);
  $('#outBadge').textContent = data.mode === 'ia' ? 'Gerado com IA e conferido' : 'Gerado no modo local';
  let html = `<h2 class="result-title">${esc(r.title)}</h2><p class="sources">Fontes: ${data.sources.map(esc).join(' · ')}${data.saved_skill ? ` · skill: ${esc(data.saved_skill)}` : ''}</p>`;

  if (data.mode === 'ia') {
    const v = data.verification;
    html += `<div class="metric-grid"><div class="metric"><span>Afirmações</span><b>${v.total}</b></div><div class="metric"><span>Conferidas no arquivo citado</span><b>${v.confirmed}</b></div><div class="metric"><span>Sem trecho localizado</span><b class="${v.not_found ? 'bad-text' : ''}">${v.not_found}</b></div></div>`;
    if (r.summary) html += `<div class="result-block"><h3>Resumo</h3><p>${esc(r.summary)}</p></div>`;
    html += `<table class="timeline"><thead><tr><th>Data</th><th>Informação</th><th>Fonte</th><th>Conferência</th></tr></thead><tbody>${r.items.map(it => `<tr><td>${esc(it.date || '—')}</td><td><b class="label">${esc(it.label || '')}</b> ${esc(it.text)}${it.quote ? `<q>${esc(it.quote)}</q>` : ''}</td><td>${src(it.source, it.page)}</td><td><span class="badge ${STATUS_CLASS[it.status] || 'mid'}">${esc(it.status)}</span>${it.date_in_quote === false ? '<span class="badge bad">data fora do trecho</span>' : ''}</td></tr>`).join('') || '<tr><td colspan="4">Nenhum item.</td></tr>'}</tbody></table>`;
    const a = data.anonymization;
    html += `<details class="anon-out"><summary>O que saiu do computador (${a.sent_characters} caracteres, ${a.replaced.length} dados trocados por código)</summary><p>${a.replaced.map(x => `<code>${esc(x.code)}</code> ×${x.occurrences}`).join(' · ') || 'Nenhum dado identificável.'}</p><pre>${esc(a.sent_preview)}</pre></details>`;
  } else if (data.skill === 'relatorio') {
    html += `<div class="metric-grid"><div class="metric"><span>Documentos lidos</span><b>${data.document_count}</b></div><div class="metric"><span>Valores encontrados</span><b>${r.amounts.length ? r.amounts.join(' · ') : 'Nenhum'}</b></div><div class="metric"><span>Evento mais recente</span><b>${r.next_event ? r.next_event.date : 'Não identificado'}</b></div></div>`;
    html += `<div class="result-block"><h3>Resumo</h3><p>${esc(r.summary)}</p><h3>Situação atual</h3><p>${esc(r.current_status)}${r.status_source ? ` <small class="src">(${esc(r.status_source)})</small>` : ''}</p>`;
    if (r.controverted.length) html += `<h3>Pontos controvertidos fixados pelo juízo</h3><ul>${r.controverted.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
    html += `<h3>Pontos de atenção</h3><ul>${r.attention.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`;
  } else if (data.skill === 'cronologia') {
    html += `<table class="timeline"><thead><tr><th>Data</th><th>Evento</th><th>Fonte</th></tr></thead><tbody>${r.events.map(e => `<tr><td>${e.date}${e.end_date ? ` a ${e.end_date}` : ''}${e.note ? ' <span class="badge mid">ano inferido</span>' : ''}</td><td>${esc(e.event)}</td><td>${src(e.source, e.page)}</td></tr>`).join('') || '<tr><td colspan="3">Nenhuma data encontrada.</td></tr>'}</tbody></table>`;
    if (r.deadlines.length) html += `<div class="result-block"><h3>Prazos mencionados</h3><table class="timeline"><thead><tr><th>Prazo</th><th>Trecho</th><th>Fonte</th></tr></thead><tbody>${r.deadlines.map(d => `<tr><td>${esc(d.deadline)}</td><td>${esc(d.event)}</td><td>${src(d.source, d.page)}</td></tr>`).join('')}</tbody></table></div>`;
  } else if (data.skill === 'comparacao') {
    const col = items => `<ul>${items.map(x => `<li>${esc(x.text)} <small class="src">(p. ${x.page})</small></li>`).join('')}</ul>`;
    html += `<div class="plan-grid"><div><h3>${esc(r.columns[0])}</h3>${col(r.left)}</div><div><h3>${esc(r.columns[1])}</h3>${col(r.right)}</div></div>`;
    if (r.controverted.length) html += `<div class="result-block"><h3>Pontos controvertidos fixados pelo juízo</h3><ul>${r.controverted.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`;
  } else if (data.skill === 'organizacao') {
    html += `<div class="doc-grid">${r.documents.map(d => `<article class="doc-card"><span>${esc(d.type)}${d.process ? ` · ${esc(d.process)}` : ''}</span><h3>${esc(d.title || d.name)}</h3><p>${esc(d.summary)}</p><small class="src">${esc(d.name)} · ${d.pages} p.</small></article>`).join('')}</div>`;
  } else {
    html += `<div class="risk-grid">${r.items.map(x => `<article class="risk"><span class="level ${x.level === 'alto' ? 'high' : ''}">${esc(x.level.toUpperCase())}</span><h3>${esc(x.risk)}</h3><p>${esc(x.action)}</p></article>`).join('')}</div>`;
  }
  $('#result').innerHTML = html;

  const pending = data.pending || [];
  $('#pending').classList.toggle('hidden', !pending.length);
  $('#pending ul').innerHTML = pending.map(x => `<li>${esc(x)}</li>`).join('');
  $('#checks').innerHTML = '<b>Conferências automáticas</b>' + (data.checks || []).map(c => `<span>✓ ${esc(c)}</span>`).join('');
}

// ---------- salvar skill ----------
$('#saveSkillBtn').addEventListener('click', async () => {
  const name = prompt('Nome da skill (ex.: Cronologia para audiência):', state.savedSkill?.name || '');
  if (!name) return;
  const res = await fetch('/api/skills', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, base: state.skill, task: $('#task').value, system_prompt: $('#systemPrompt').value, plan: state.plan }),
  });
  const data = await res.json();
  if (!res.ok) { alert(data.error); return; }
  const status = await (await fetch('/api/status')).json();
  renderSaved(status.saved_skills);
  alert(`Skill "${data.name}" salva. Ela aparece em "Minhas skills" e reaproveita este pedido e este plano.`);
});

// ---------- download ----------
$('#downloadBtn').addEventListener('click', () => {
  if (!state.result) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([toMarkdown(state.result)], { type: 'text/markdown' }));
  a.download = `acta-${state.result.skill}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
});

function toMarkdown(d) {
  const r = d.result;
  const lines = [`# ${r.title}`, '', `**Tarefa:** ${d.task}`, '', `**Fontes:** ${d.sources.join(', ')}`, `**Modo:** ${d.mode === 'ia' ? 'IA, com texto anonimizado e conferência de trechos' : 'local, sem envio de dados'}`, ''];
  const row = cells => `| ${cells.map(c => String(c ?? '').replace(/\|/g, '/').replace(/\n/g, ' ')).join(' | ')} |`;
  if (d.mode === 'ia') {
    if (r.summary) lines.push(r.summary, '');
    lines.push(row(['Data', 'Informação', 'Trecho', 'Fonte', 'Conferência']), row(['---', '---', '---', '---', '---']));
    r.items.forEach(i => lines.push(row([i.date || '—', i.text, i.quote, `${i.source}, p. ${i.page || '?'}`, i.status])));
  } else if (d.skill === 'cronologia') {
    lines.push(row(['Data', 'Evento', 'Fonte']), row(['---', '---', '---']));
    r.events.forEach(e => lines.push(row([e.date + (e.end_date ? ` a ${e.end_date}` : ''), e.event, `${e.source}, p. ${e.page}`])));
    if (r.deadlines.length) { lines.push('', '## Prazos'); r.deadlines.forEach(x => lines.push(`- ${x.deadline}: ${x.event} (${x.source}, p. ${x.page})`)); }
  } else if (d.skill === 'comparacao') {
    lines.push(`## ${r.columns[0]}`, ...r.left.map(x => `- ${x.text} (p. ${x.page})`), '', `## ${r.columns[1]}`, ...r.right.map(x => `- ${x.text} (p. ${x.page})`));
    if (r.controverted.length) lines.push('', '## Pontos controvertidos', ...r.controverted.map(x => `- ${x}`));
  } else if (d.skill === 'organizacao') {
    r.documents.forEach(x => lines.push(`- **${x.title || x.name}** (${x.type}, ${x.name}): ${x.summary}`));
  } else if (d.skill === 'riscos') {
    r.items.forEach(x => lines.push(`- **[${x.level}] ${x.risk}**: ${x.action}`));
  } else {
    lines.push('## Resumo', r.summary, '', '## Situação atual', r.current_status, '', '## Valores', ...r.amounts.map(x => `- ${x}`));
    if (r.controverted.length) lines.push('', '## Pontos controvertidos', ...r.controverted.map(x => `- ${x}`));
  }
  if ((d.pending || []).length) lines.push('', '## O que conferir', ...d.pending.map(x => `- [ ] ${x}`));
  lines.push('', '> Resultado gerado pela Acta para conferência humana. Não substitui a revisão do advogado.', '');
  return lines.join('\n');
}

function esc(v) {
  return String(v ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

loadStatus();
