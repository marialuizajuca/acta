/* Acta · modo IA no navegador.
 *
 * Três jeitos de ter IA, nesta ordem:
 * 1. Página aberta dentro do Claude: usa o próprio Claude, sem chave.
 * 2. Chave de API da Anthropic ou da OpenAI, colada em Configurações. Ela fica
 *    só neste navegador e vai direto para o provedor, sem passar por servidor nosso.
 * 3. Sem nenhum dos dois: a Acta funciona no modo local, sem IA.
 *
 * Antes de qualquer envio, a trava de sigilo troca nomes, CPF, CNPJ, e-mail e
 * número do processo por códigos. Depois da resposta, cada trecho citado é
 * procurado no documento original.
 */
(function (global) {
  "use strict";
  const E = () => global.ActaEngine;
  const KEY = "acta.ai.settings";
  const DEFAULT_MODEL = { anthropic: "claude-haiku-5-5", openai: "gpt-5.4-mini" };

  const RULES = `Você é a Acta, assistente de advogados brasileiros. Você constrói, a partir dos documentos de um caso, o resultado que o advogado pediu.
Regras que nunca mudam:
1. Use somente o que está nos documentos enviados. Não use conhecimento externo sobre o caso.
2. Toda afirmação precisa de fonte: o nome exato do arquivo, a página e um trecho LITERAL, copiado sem alteração, de no máximo 30 palavras. Se não houver trecho, não afirme.
3. Nunca invente lei, súmula, jurisprudência, número de processo, data ou valor.
4. Nomes e dados pessoais chegam trocados por códigos como [PARTE_1], [PESSOA_1], [CPF_1]. Mantenha os códigos exatamente como estão.
5. Quando as partes divergem, mostre as duas versões. Quando algo depende de interpretação, diga isso em vez de escolher um lado.
6. Você não dá parecer conclusivo, não protocola, não envia nada a ninguém. Quem decide é o advogado.
7. Termine sempre com a lista do que o advogado ainda precisa conferir.
8. Responda em português do Brasil e somente com um objeto JSON válido, sem texto fora dele.`;

  const PLAN_FORMAT = `Devolva o PLANO, ainda sem executar nada, neste formato JSON:
{"title":"nome curto da tarefa","objective":"o que será entregue, em uma frase","steps":["passo 1","passo 2"],"tests":["critério que o advogado pode conferir nos documentos"],"questions":["dúvida que o advogado deveria responder antes, se houver"]}
Entre 4 e 7 passos curtos.`;

  const RUN_FORMAT = `Execute o plano aprovado e devolva neste formato JSON:
{"title":"título do resultado","summary":"resumo em até 4 frases","items":[{"date":"dd/mm/aaaa ou vazio","label":"rótulo curto (Fato, Pedido, Defesa, Prazo, Risco, Documento, Autor, Réu)","text":"a informação, escrita para o advogado","source":"nome exato do arquivo","page":1,"quote":"trecho literal do documento"}],"pending":["o que o advogado precisa conferir"]}
Se for cronologia, ordene por data. Se for comparação, use os rótulos Autor e Réu. Não inclua itens sem trecho literal. No máximo 15 itens.`;

  function settings() {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; }
  }
  function saveSettings(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch (e) { return false; }
  }

  let claudeSample = null, claudeChecked = false;
  async function detectClaude() {
    if (claudeChecked) return claudeSample;
    claudeChecked = true;
    try {
      if (global.claude && typeof global.claude.use === "function") claudeSample = await global.claude.use("sample");
    } catch (e) { claudeSample = null; }
    return claudeSample;
  }

  async function status() {
    const s = settings();
    if (await detectClaude()) return { available: true, provider: "claude", label: "IA do Claude (página aberta dentro do Claude)" };
    if (s.key && s.provider) return { available: true, provider: s.provider, label: `${s.provider === "openai" ? "OpenAI" : "Anthropic"} · ${s.model || DEFAULT_MODEL[s.provider]} (chave guardada só neste navegador)` };
    return { available: false, provider: null, label: "Sem IA conectada: a Acta funciona no modo local" };
  }

  function parseJson(text) {
    text = String(text || "").trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
    try { return JSON.parse(text); } catch (e) {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) { try { return JSON.parse(m[0]); } catch (e2) { /* segue */ } }
    }
    throw new Error("A IA não devolveu um resultado no formato esperado. Tente de novo ou use o modo local.");
  }

  async function complete(system, user, maxTokens) {
    const st = await status();
    if (!st.available) throw new Error("Nenhuma IA conectada. Veja Configurações.");
    if (st.provider === "claude") {
      const r = await claudeSample(`${system}\n\n${user}`, { modelTier: "default", cache: false });
      return parseJson(r.text);
    }
    const s = settings(), model = s.model || DEFAULT_MODEL[s.provider];
    let resp;
    if (s.provider === "anthropic") {
      resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": s.key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
      });
    } else {
      resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${s.key}` },
        body: JSON.stringify({ model, messages: [{ role: "system", content: system }, { role: "user", content: user }], response_format: { type: "json_object" } }),
      });
    }
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(`O provedor de IA recusou o pedido (${resp.status}): ${(data.error && (data.error.message || data.error.type)) || "erro desconhecido"}`);
    const text = s.provider === "anthropic" ? (data.content || []).map(b => b.text || "").join("") : (((data.choices || [])[0] || {}).message || {}).content;
    return parseJson(text);
  }

  const system = extra => extra && extra.trim() ? `${RULES}\n\nPreferências do escritório (valem desde que não contrariem as regras acima):\n${extra.trim()}` : RULES;

  async function plan(task, label, docNames, context, officePrompt) {
    const user = `Tarefa pedida pelo advogado: ${task}\nTipo de resultado: ${label}\nContexto informado: ${context || "nenhum"}\nArquivos: ${docNames.join(", ")}\n\n${PLAN_FORMAT}`;
    const d = await complete(system(officePrompt), user, 1500);
    return {
      title: String(d.title || label), objective: String(d.objective || task),
      steps: (d.steps || []).map(String).slice(0, 8), tests: (d.tests || []).map(String).slice(0, 6),
      questions: (d.questions || []).map(String).filter(Boolean).slice(0, 4), mode: "ia",
    };
  }

  function prepareSend(docs) {
    const texts = docs.map(d => E().plain(d.text).slice(0, 60000));
    const anon = E().anonymize(texts);
    const body = docs.map((d, i) => `===== ARQUIVO: ${d.name} =====\n${anon.texts[i]}`).join("\n\n");
    return { anon, body };
  }

  async function run(docs, task, approvedPlan, context, officePrompt) {
    const { anon, body } = prepareSend(docs);
    const planText = JSON.stringify({ title: approvedPlan.title, objective: approvedPlan.objective, steps: approvedPlan.steps, tests: approvedPlan.tests });
    const user = `Tarefa: ${task}\nContexto: ${context || "nenhum"}\nPlano aprovado: ${planText}\n\nDOCUMENTOS:\n${body}\n\n${RUN_FORMAT}`;
    const d = await complete(system(officePrompt), user, 6000);
    const items = (Array.isArray(d.items) ? d.items : []).filter(x => x && typeof x === "object");
    const byName = Object.fromEntries(docs.map((doc, i) => [doc.name, anon.texts[i]]));
    const checked = E().verify(items, byName);
    const pending = (d.pending || []).map(String).filter(Boolean);
    const bad = checked.filter(i => ["não localizado", "sem trecho"].includes(i.status)).length;
    if (bad) pending.unshift(`${bad} afirmação(ões) da IA sem trecho localizado nos documentos: revisar antes de usar.`);
    const wrongDates = checked.filter(i => i.date_in_quote === false).length;
    if (wrongDates) pending.unshift(`${wrongDates} data(s) não aparecem no trecho citado: conferir no original.`);
    return {
      mode: "ia", title: anon.restore(String(d.title || approvedPlan.title)), summary: anon.restore(String(d.summary || "")),
      items: anon.restore(checked), pending: anon.restore(pending),
      verification: { total: checked.length, confirmed: checked.filter(i => i.status === "conferido").length, not_found: bad },
      anonymization: { replaced: anon.found.map(f => ({ code: f.code, kind: f.kind, occurrences: f.occurrences })), sent_characters: body.length, sent_preview: body.slice(0, 2500) },
    };
  }

  global.ActaAI = { status, settings, saveSettings, plan, run, prepareSend, DEFAULT_MODEL, _setClaude: s => { claudeSample = s; claudeChecked = true; } };
})(window);
