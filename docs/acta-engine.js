/* Acta · motor de análise no navegador.
 *
 * É a mesma lógica do programa em Python (pasta acta/ do repositório), reescrita
 * para rodar dentro da página. Os documentos são lidos aqui mesmo, no navegador:
 * no modo padrão nada é enviado para fora.
 */
(function (global) {
  "use strict";

  // ---------- leitura dos arquivos ----------
  const PAGE_MARK = n => `⟦p. ${n}⟧`;

  async function readPdf(buffer) {
    const pdf = await global.pdfjsLib.getDocument({ data: buffer }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      // Junta os pedaços de texto em linhas, pela posição vertical.
      const lines = [];
      let current = "", lastY = null;
      for (const item of content.items) {
        const y = Math.round(item.transform[5]);
        if (lastY !== null && Math.abs(y - lastY) > 2 && current.trim()) {
          lines.push(current.trim()); current = "";
        }
        current += item.str;
        if (item.hasEOL) { if (current.trim()) lines.push(current.trim()); current = ""; }
        lastY = y;
      }
      if (current.trim()) lines.push(current.trim());
      pages.push(lines.join("\n"));
    }
    return pages;
  }

  async function readFile(file) {
    const name = file.name || "documento";
    const ext = name.toLowerCase().split(".").pop();
    const buffer = await file.arrayBuffer();
    let pages;
    if (ext === "pdf") pages = await readPdf(buffer);
    else if (ext === "docx") pages = [(await global.mammoth.extractRawText({ arrayBuffer: buffer })).value];
    else if (["txt", "md"].includes(ext)) {
      let t = new TextDecoder("utf-8").decode(buffer);
      if (t.includes("\ufffd")) t = new TextDecoder("windows-1252").decode(buffer); // arquivo salvo no Windows
      pages = [t];
    }
    else throw new Error(`Formato não suportado: ${name}. Use PDF, DOCX, TXT ou MD.`);
    pages = pages.map(p => p.split(/\r?\n/).map(l => l.trim()).filter(Boolean).join("\n"));
    if (!pages.some(Boolean)) throw new Error(ext === "pdf" ? `Não há texto em ${name}: parece um PDF digitalizado (imagem). Ele precisa passar por OCR antes.` : `O arquivo ${name} está vazio.`);
    const text = pages.map((p, i) => p ? `${PAGE_MARK(i + 1)}\n${p}` : "").filter(Boolean).join("\n");
    return { name, text, pages: pages.length };
  }

  // ---------- texto ----------
  const PAGE_RE = /^⟦p\. (\d+)⟧$/;
  const PAGE_WORD_RE = /^p[áa]gina\s+\d+(\s+de\s+\d+)?$/i;
  const END_PUNCT = [".", ":", ";", ",", "!", "?", ")", "”", '"'];
  const ABBR = ["Ltda.", "S.A.", "S/A.", "Sr.", "Sra.", "Dr.", "Dra.", "art.", "arts.", "Art.", "p.", "fls.", "nº.", "n.", "Exmo.", "Exma.", "inc.", "Min.", "Rel.", "Des."];
  const PROTECT = "";

  const normalize = v => v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const squash = v => v.replace(/\s+/g, " ").trim();
  const endsPunct = l => END_PUNCT.some(p => l.endsWith(p));
  const plain = t => t.split("\n").filter(l => !PAGE_RE.test(l)).join("\n");

  function boilerplateLines(docs) {
    if (docs.length < 2) return new Set();
    const counts = new Map();
    for (const d of docs) for (const l of new Set(d.text.split("\n"))) if (!PAGE_RE.test(l)) counts.set(l, (counts.get(l) || 0) + 1);
    const min = docs.length <= 4 ? 2 : Math.max(3, Math.ceil(docs.length * 0.25));
    return new Set([...counts].filter(([, n]) => n >= min).map(([l]) => l));
  }
  const isHeading = l => l.length <= 60 && !endsPunct(l) && l.split(/\s+/).length <= 6;
  const PJE_NUM = /Num\.\s*(\d{5,})\s*-\s*P[áa]g\.\s*(\d+)/;
  const PJE_SIGN = /Assinado eletronicamente por:\s*(.+?)\s*-\s*(\d{2}\/\d{2}\/\d{4})/;
  const PJE_NOISE = /via Token|^por [A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ ]{5,},?$|Para verificar a(?: (?:assinatura|autenticidade))?|^assinatura acesse|^Chave$|^[0-9a-f]{8}(?:\.[0-9a-f]{8}){2,}|^Chave [0-9a-f]{6,}|^Documento assinado|^digitalmente$|transparencia\.mpf|validacaodocumento|^\d{8,}$|Num\.\s*\d{5,}\s*-\s*P[áa]g\.|Assinado eletronicamente|consultaPublica|ConsultaDocumento|validar este documento|Número do documento:|documento foi gerado pelo usu[áa]rio|^https?:\/\//i;
  function isNoise(l, bp) {
    if (bp.has(l) || PAGE_WORD_RE.test(l) || PJE_NOISE.test(l)) return true;
    if (l.includes("·") && !endsPunct(l)) return true;
    return l.length <= 2;
  }
  function paragraphs(text, bp) {
    const out = []; let buf = [], page = 1, start = 1, section = "";
    const open = () => buf.length && !/[.!?:;)”"]$/.test(buf[buf.length - 1]);
    const flush = () => { if (buf.length) { out.push({ text: squash(buf.join(" ")), page: start, section }); buf = []; } };
    for (const line of text.split("\n")) {
      const m = line.match(PAGE_RE);
      if (m) { page = +m[1]; if (!open()) flush(); continue; }
      if (isNoise(line, bp)) continue;
      // Linha curta sem ponto só é título quando o parágrafo anterior terminou.
      if (isHeading(line) && !open() && /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9IVX]/.test(line)) { flush(); section = line; continue; }
      if (!buf.length) start = page;
      buf.push(line);
      if (/[.!?:]$/.test(line) && line.length < 70) flush();
    }
    flush();
    return out;
  }
  // Frase utilizável num resultado: começa com maiúscula, termina com ponto
  // e não parece texto de OCR com erros (palavras impossíveis em português).
  const V = "aeiouáéíóúâêôãõàü", ONSETS = new Set(["bl", "br", "cl", "cr", "dr", "fl", "fr", "gl", "gr", "pl", "pr", "tr", "vr", "ch", "lh", "nh", "ps", "pn", "gn", "qu"]);
  function oddWord(w) {
    if (![...w].some(c => V.includes(c))) return true;
    let i = 0; while (i < w.length && !V.includes(w[i])) i++;
    if (i >= 3 || (i === 2 && !ONSETS.has(w.slice(0, 2)))) return true;
    if (/[^cln]h/.test(w)) return true;
    let j = w.length; while (j > 0 && !V.includes(w[j - 1])) j--;
    const tail = w.slice(j);
    if (tail.length >= 2 && !["ns", "rs", "ls", "ms", "zs"].includes(tail)) return true;
    if (tail.length === 1 && !"lmnrszx".includes(tail)) return true;
    return false;
  }
  function cleanSentence(t) {
    if (!/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ"“(]/.test(t) || !/[.!?)”"]$/.test(t) || t.length < 50 || t.length > 600) return false;
    const words = t.toLowerCase().match(/[a-záéíóúâêôãõàç]{3,}/g) || [];
    const odd = words.filter(w => oddWord(w) && !/^(?:www|http|ltda|cpf|cnpj|cnj|oab|cep|art|arts|cpc|clt|stj|stf|tjpe|tjsp|pje|ltda)$/.test(w));
    return odd.length <= Math.max(1, Math.floor(words.length * 0.03));
  }
  function splitSentences(p) {
    let s = p;
    for (const a of ABBR) s = s.split(a).join(a.replace(/\./g, PROTECT));
    return s.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9“"(])/).map(x => x.split(PROTECT).join(".").trim()).filter(Boolean);
  }
  // Pedaços de assinatura digital que o PDF mistura no meio do texto.
  const SIGFRAG = /(?:Documento assinado\s+)?via\s+Token(?:\s+digitalmente)?\s+por\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ ]+,?\s*(?:em\s+)?\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}:\d{2})?\.?|(?:Documento assinado\s+)?digitalmente\s+por\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ ]+,?\s*(?:em\s+)?\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}:\d{2})?\.?/g;
  function sentences(text, bp) {
    const out = [];
    for (const p of paragraphs(text, bp)) for (let s of splitSentences(p.text)) {
      s = s.replace(SIGFRAG, " ").replace(/\s+/g, " ").trim();
      if (s.length >= 20) out.push({ text: s, page: p.page, section: p.section });
    }
    return out;
  }
  function title(text, bp) {
    const lines = text.split("\n");
    for (let i = 0; i < Math.min(lines.length, 13); i++) {
      const l = lines[i];
      if (PAGE_RE.test(l) || isNoise(l, bp)) continue;
      if (PJE_NOISE.test(l) || /^poder judici|^tribunal de justi|^estado d[eo] |^ju[ií]zo d|^vara /i.test(l)) continue;
      if (isHeading(l) && (l.split(/\s+/).length >= 2 || (l.length >= 5 && l === l.toUpperCase()))) return l;
    }
    return "";
  }

  // ---------- análise ----------
  const MONTHS = { janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };
  const MONTH_NAMES = "janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro";
  const DATE_NUM = () => /\b([0-3]?\d)([\/.-])([01]?\d)\2((?:19|20)\d{2})\b/g;
  const DATE_TEXT = () => /\b([0-3]?\d)º?\s+de\s+([a-zç]+)\s+de\s+((?:19|20)\d{2})\b/gi;
  const DATE_RANGE = () => /\b(?:entre|de)\s+([0-3]?\d)\s+(?:e|a)\s+([0-3]?\d)\s+de\s+([a-zç]+)(?:\s+de\s+((?:19|20)\d{2}))?/gi;
  const DATE_NOYEAR = () => new RegExp(`\\b([0-3]?\\d)º?\\s+de\\s+(${MONTH_NAMES})\\b(?!\\s+de\\s+(?:19|20)\\d{2})`, "gi");
  const DEADLINE = () => /\b(?:em|no prazo de|prazo de|prazo (?:[a-zà-ú]+ ){0,4}(?:é|será) de)\s+(\d{1,3})\s+(dias(?:\s+úteis|\s+corridos)?|horas)\b/gi;
  const MONEY = () => /R\$\s*\d{1,3}(?:\.\d{3})*(?:,\d{2})?/g;
  const CNJ = /\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/;
  const CITED_DOCS = /documentos? (?:citados?|anexos?|juntados?)\s*:\s*((?:\b(?:Sr|Sra|Dr|Dra)\.|[^.])+)/i;
  const FACT_NAMES = { pag: "o pagamento", entreg: "a entrega", notific: "a notificação", comunic: "a comunicação", dispens: "a dispensa", admit: "a admissão", assin: "a assinatura", celebr: "a celebração do contrato", rescind: "a rescisão", receb: "o recebimento" };
  const FACT_STEMS = ["pag", "entreg", "notific", "comunic", "dispens", "admit", "assin", "celebr", "rescind", "receb"];
  const DOC_TYPES = [["ata de audiencia", "Ata de audiência"], ["ata-audiencia", "Ata de audiência"], ["sentenca", "Sentença"], ["decisao", "Decisão"], ["despacho", "Despacho"], ["acordao", "Acórdão"], ["replica", "Réplica"], ["impugnacao a contestacao", "Réplica"], ["contestacao", "Defesa"], ["defesa", "Defesa"], ["reclamacao", "Petição inicial"], ["peticao inicial", "Petição inicial"], ["inicial", "Petição inicial"], ["recurso", "Recurso"], ["apelacao", "Recurso"], ["embargos", "Recurso"], ["termo de audiencia", "Ata de audiência"], ["ato ordinatorio", "Ato ordinatório"], ["certidao", "Certidão"], ["intimacao", "Intimação"], ["notificacao", "Intimação"], ["carta de citacao", "Intimação"], ["mandado", "Mandado"], ["procuracao", "Procuração"], ["contrato", "Contrato"], ["peticao", "Petição"], ["manifestacao", "Petição"]];
  const CLAIM_WORDS = ["afirma", "sustenta", "alega", "pede", "pedido", "condenacao", "prejuizo", "celebraram", "ocorreu", "atraso", "requer"];
  const DEFENSE_WORDS = ["reconhece", "sustenta", "invoca", "afirma", "contesta", "alega", "improcedencia", "reducao", "nega", "impugna"];
  const ORDER_WORDS = ["designo", "fixo", "determino", "defiro", "indefiro", "deverao", "julgo", "condeno", "intimem"];
  const COURT = ["Decisão", "Despacho", "Sentença", "Acórdão", "Ata de audiência", "Intimação", "Ato ordinatório", "Certidão", "Mandado"];
  const BOILER = /^(?:O\(?A?\)?\s+)?(?:MM\.?\s*)?Ju[íi]z\(?[íi]?z?a?\)?\s+Federal,|Segue,? (?:em anexo,? )?(?:a )?peti[çc][ãa]o|demais usu[áa]rios|ficar[áa]\(?[ãa]?o?\)? dispon[íi]ve|ID da Reuni[ãa]o|Senha:|^(?:autora?|r[ée]u?|reclamante|reclamad[ao]|requerente|requerid[ao]|processo)\s*(?:n[º°o.]*)?\s*:|j[áa] qualificad|inscrit[oa] no (?:cpf|cnpj)|vem,? (?:respeitosamente,? )?(?:a presença|perante|por (?:seu|sua|meio)|tempestivamente|propor|apresentar|interpor)|nestes termos|pede deferimento|termos em que|^excelent[íi]ssim|^vistos/i;
  const SIGNLINE = /digitalmente por|assinad[oa] (?:eletronicamente|digitalmente)|verificar a autenticidade|login e? ?senha|n[úu]mero do documento|chave de acesso/i;
  const DATELINE = /^[A-ZÀ-Ú][\wÀ-ú'\/ -]{2,40},\s*\d{1,2}º?\s+de\s+[a-zç]+\s+de\s+\d{4}/i;
  const CITATION = /\bDJ[Ee]?\b|\bRel\.|\bREsp\b|\bAgRg\b|\bAgInt\b|\bRE\s+\d|Turma|Ministr[oa] |Desembargador|Acesso em|in https?:|dispon[íi]vel em|Jurisprud[êe]ncia em teses|Informativo n/;
  const sentenceCase = t => t && t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase() : t;
  const pad = n => String(n).padStart(2, "0");
  const fmt = (d, m, y) => `${pad(d)}/${pad(m)}/${y}`;
  const short = (t, n = 230) => { t = squash(t); return t.length <= n ? t : t.slice(0, n - 1).trimEnd() + "…"; };
  const validDate = (d, m, y) => { const dt = new Date(y, m - 1, d); return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d; };

  function classify(name, text) {
    const heads = text.split("\n").slice(0, 20).filter(l => !PAGE_RE.test(l) && !PJE_NOISE.test(l) && isHeading(l)).map(normalize);
    for (const c of [normalize(name), ...heads, normalize(text.slice(0, 600))])
      for (const [k, label] of DOC_TYPES) if (c.includes(k)) return label;
    return "Documento geral";
  }
  // Capa da cópia integral do PJe: dados do processo e o índice oficial das peças
  // (Id, data, nome do documento e tipo). Quando existe, ele manda nos tipos e nomes.
  const PJE_TYPES = ["Certidão de Intimação (Outros)", "Manifestação do Ministério Público", "Embargos de Declaração", "Agravo de Instrumento", "Documento Comprobatório", "Documento de Identificação", "Petição intercorrente", "Petição (outras)", "Petição inicial", "Emenda à inicial", "Ata de Audiência", "Termo de Audiência", "Ato Ordinatório", "Laudo Pericial", "Recurso Inominado", "Contrarrazões", "Substabelecimento", "Contestação", "Impugnação", "Procuração", "Outras peças", "Diligência", "Comunicação", "Informação", "Sentença", "Acórdão", "Apelação", "Decisão", "Despacho", "Certidão", "Mandado", "Intimação", "Citação", "Ciência", "Réplica", "Parecer", "Ofício", "Recurso", "Laudo", "Edital", "Alvará", "Petição"];
  const PJE_MAP = { "petição inicial": "Petição inicial", "emenda à inicial": "Petição inicial", "contestação": "Defesa", "réplica": "Réplica", "impugnação": "Réplica", "sentença": "Sentença", "acórdão": "Acórdão", "decisão": "Decisão", "despacho": "Despacho", "ato ordinatório": "Ato ordinatório", "ata de audiência": "Ata de audiência", "termo de audiência": "Ata de audiência", "certidão": "Certidão", "certidão de intimação (outros)": "Certidão", "diligência": "Certidão", "mandado": "Mandado", "intimação": "Intimação", "citação": "Intimação", "comunicação": "Intimação", "apelação": "Recurso", "recurso": "Recurso", "recurso inominado": "Recurso", "embargos de declaração": "Recurso", "agravo de instrumento": "Recurso", "contrarrazões": "Petição", "procuração": "Procuração", "substabelecimento": "Procuração", "documento comprobatório": "Documento", "documento de identificação": "Documento", "laudo": "Documento", "laudo pericial": "Documento", "ofício": "Documento", "edital": "Documento", "alvará": "Documento", "outras peças": "Documento" };
  function pjeCover(text) {
    if (!/\bId\.\s+Data\s+Documento\s+Tipo\b/.test(text)) return null;
    const head = text.split(/\bDocumentos\s*\n\s*Id\./)[0], g = re => { const m = head.match(re); return m ? squash(m[1]) : null; };
    const meta = { number: g(/Número:\s*([\d.-]+)/), cls: g(/Classe:\s*(.+)/), court: g(/Órgão julgador:\s*(.+)/), value: g(/Valor da causa:\s*(R\$\s*[\d.,]+)/), subject: g(/Assuntos:\s*(.+)/),
      parties: [...head.matchAll(/^(.+?)\s*\((AUTORA?|R[ÉE]U?|R[ÉE]|REQUERENTE|REQUERID[OA]|EXEQUENTE|EXECUTAD[OA]|IMPETRANTE|IMPETRAD[OA]|RECLAMANTE|RECLAMAD[OA]|APELANTE|APELAD[OA])\)\s*$/gm)].map(m => ({ name: squash(m[1]), role: m[2] })) };
    const index = {}, lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^(\d{6,})\s+(\d{2}\/\d{2}\/\d{4})$/); if (!m) continue;
      let j = i + 1; if (/^\d{2}:\d{2}$/.test(lines[j] || "")) j++;
      let desc = "";
      while (j < lines.length && !/^\d{6,}\s+\d{2}\/\d{2}\/\d{4}$/.test(lines[j]) && !PAGE_RE.test(lines[j]) && desc.length < 200) { desc = desc.endsWith("-") ? desc + lines[j] : (desc ? desc + " " : "") + lines[j]; j++; }
      desc = squash(desc);
      const type = PJE_TYPES.find(t => desc.toLowerCase().endsWith(t.toLowerCase())) || "";
      const name = squash(type ? desc.slice(0, desc.length - type.length) : desc) || type;
      index[m[1]] = { id: m[1], date: m[2], name, official: type || name };
    }
    return Object.keys(index).length ? { meta, index } : null;
  }

  // Cópia integral do PJe: um PDF só com todas as peças. Cada página traz
  // "Num. <id> - Pág. <n>"; quando o id muda, começa outra peça.
  function splitPje(doc) {
    const parts = doc.text.split(/(?=⟦p\. \d+⟧)/).filter(p => PAGE_RE.test(p.split("\n")[0]));
    const pieces = []; let cur = null;
    for (const part of parts) {
      const num = part.match(PJE_NUM), id = num ? num[1] : null;
      if (!cur || (id && id !== cur.id && (cur.id || +num[2] === 1))) { cur = { id, pages: [], sign: null }; pieces.push(cur); }
      if (!cur.id && id) cur.id = id;
      cur.pages.push(part);
      if (!cur.sign) { const sg = part.match(PJE_SIGN); if (sg) cur.sign = { by: squash(sg[1]), date: sg[2] }; }
    }
    if (new Set(pieces.map(p => p.id).filter(Boolean)).size < 2) return [doc];
    const cover = pjeCover(doc.text.split(/⟦p\. \d+⟧/).slice(0, 4).join("\n⟦p. 0⟧\n"));
    return pieces.map(p => {
      const text = p.pages.join("\n");
      if (!p.id && cover && /\bId\.\s+Data\s+Documento\s+Tipo\b/.test(text)) return { name: `${doc.name} · capa`, file: doc.name, text, pjeId: null, cover: true, coverMeta: cover.meta, pages: p.pages.length };
      const ix = cover && p.id ? cover.index[p.id] : null;
      return { name: `${doc.name} · ID ${p.id || "s/n"}`, file: doc.name, text, pjeId: p.id, signed: p.sign || (ix ? { by: "", date: ix.date } : null), indexed: ix, pages: p.pages.length };
    });
  }
  function prepare(docs) {
    docs = docs.flatMap(splitPje);
    const bp = boilerplateLines(docs);
    return docs.map(d => {
      if (d.cover) return { ...d, type: "Capa do processo", title: "Capa e índice do PJe", sentences: [] };
      let type = classify(d.pjeId ? "" : d.name, d.text), ttl = title(d.text, bp);
      if (d.indexed) {
        const off = d.indexed.official.toLowerCase();
        type = /\binicial\b/i.test(d.indexed.name) && /peti/i.test(off) ? "Petição inicial" : PJE_MAP[off] || (/peti|manifesta|ciência/.test(off) ? "Petição" : type);
        ttl = d.indexed.name && d.indexed.name.toLowerCase() !== off ? d.indexed.name : d.indexed.official;
      }
      return { ...d, type, title: ttl, official: d.indexed ? d.indexed.official : null, sentences: sentences(d.text, bp) };
    });
  }
  function mainYear(doc) {
    const c = {};
    for (const s of doc.sentences) {
      for (const m of s.text.matchAll(DATE_TEXT())) c[m[3]] = (c[m[3]] || 0) + 1;
      for (const m of s.text.matchAll(DATE_NUM())) c[m[4]] = (c[m[4]] || 0) + 1;
    }
    const best = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
    return best ? +best[0] : null;
  }
  function timeline(prepared) {
    const events = [], deadlines = [], seen = new Set(), seenDl = new Set();
    const hasCourt = prepared.some(d => COURT.includes(d.type));
    for (const doc of prepared) {
      if (doc.cover || doc.type === "Documento") continue; // capa e anexos (provas, pesquisas) não entram na cronologia
      const year = mainYear(doc);
      for (const s of doc.sentences) {
        const t = s.text, found = [];
        if (DATELINE.test(t) || SIGNLINE.test(t) || CITATION.test(t) || !/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9"“(…]/.test(t)) continue;
        for (const m of t.matchAll(DATE_NUM())) found.push([+m[1], +m[3], +m[4], {}]);
        for (const m of t.matchAll(DATE_TEXT())) { const mo = MONTHS[normalize(m[2])]; if (mo) found.push([+m[1], mo, +m[3], {}]); }
        const ranges = [];
        for (const m of t.matchAll(DATE_RANGE())) {
          ranges.push([m.index, m.index + m[0].length]);
          const mo = MONTHS[normalize(m[3])]; if (!mo || (!m[4] && !year)) continue;
          const y = m[4] ? +m[4] : year;
          const extra = { end_date: fmt(+m[2], mo, y) };
          if (!m[4]) extra.note = "ano não escrito no trecho; inferido pelas outras datas do documento";
          found.push([+m[1], mo, y, extra]);
        }
        for (const m of t.matchAll(DATE_NOYEAR())) {
          if (!year || ranges.some(([a, b]) => m.index >= a && m.index < b)) continue;
          found.push([+m[1], MONTHS[normalize(m[2])], year, { note: "ano não escrito no trecho; inferido pelas outras datas do documento" }]);
        }
        for (const [d, mo, y, extra] of found) {
          if (!validDate(d, mo, y)) continue;
          const key = `${y}-${mo}-${d}|${doc.name}|${t.slice(0, 80)}`;
          if (seen.has(key)) continue; seen.add(key);
          events.push({ date: fmt(d, mo, y), iso: `${y}-${pad(mo)}-${pad(d)}`, event: short(t), source: doc.name, page: s.page, doc_type: doc.type, ...extra });
        }
        if (!hasCourt || COURT.includes(doc.type)) for (const m of t.matchAll(DEADLINE()))
          if (!seenDl.has(doc.name + normalize(t)) && seenDl.add(doc.name + normalize(t))) deadlines.push({ deadline: `${m[1]} ${m[2]}`, event: short(t), source: doc.name, page: s.page, note: "o documento não diz a partir de quando o prazo corre; conferir a intimação" });
      }
    }
    for (const doc of prepared) if (doc.signed) {
      const [d, mo, y] = doc.signed.date.split("/").map(Number);
      const first = doc.sentences[0];
      events.push({ date: doc.signed.date, iso: `${y}-${pad(mo)}-${pad(d)}`, event: `Juntada: ${doc.official ? (doc.title && normalize(doc.title) !== normalize(doc.official) ? `${sentenceCase(doc.title)} (${doc.official})` : doc.official) : doc.title && normalize(doc.title) !== normalize(doc.type) ? sentenceCase(doc.title) : doc.type}.`, source: doc.name, page: first ? first.page : +(doc.text.match(/⟦p\. (\d+)⟧/) || [0, 1])[1], doc_type: doc.type, kind: "juntada" });
    }
    events.sort((a, b) => a.iso.localeCompare(b.iso) || (a.kind === "juntada" ? -1 : 0) - (b.kind === "juntada" ? -1 : 0) || a.source.localeCompare(b.source));
    // Vários anexos juntados no mesmo dia viram uma linha só.
    for (let i = events.length - 1; i > 0; i--) {
      const a = events[i - 1], b = events[i];
      if (a.kind === "juntada" && b.kind === "juntada" && a.date === b.date && a.doc_type === "Documento" && b.doc_type === "Documento") {
        a.count = (a.count || 1) + (b.count || 1); a.event = `Juntada de ${a.count} documentos (anexos), a partir da p. ${a.page}.`; events.splice(i, 1);
      }
    }
    return { events, deadlines };
  }
  function factDates(doc) {
    const out = {};
    for (const s of doc.sentences) {
      const t = normalize(s.text);
      for (const stem of FACT_STEMS) for (const v of t.matchAll(new RegExp(`\\b${stem}\\w*`, "g"))) {
        const w = t.slice(v.index + v[0].length, v.index + v[0].length + 40);
        let m = DATE_TEXT().exec(w), mo, yr;
        if (m) { mo = MONTHS[m[2]]; yr = m[3]; } else { m = DATE_NUM().exec(w); if (m) { mo = +m[3]; yr = m[4]; } }
        if (m && mo) (out[stem] = out[stem] || new Set()).add(fmt(+m[1], mo, yr));
      }
    }
    return out;
  }
  function divergences(prepared) {
    const pet = prepared.find(d => d.type === "Petição inicial"), def = prepared.find(d => d.type === "Defesa");
    if (!pet || !def) return [];
    const a = factDates(pet), b = factDates(def), out = [];
    for (const s of FACT_STEMS) if (a[s] && b[s] && ![...a[s]].some(x => b[s].has(x)))
      out.push(`Datas diferentes para ${FACT_NAMES[s]}: a inicial diz ${[...a[s]].sort().join(", ")} e a defesa diz ${[...b[s]].sort().join(", ")}. Conferir a prova.`);
    return out;
  }
  function pendingFrom(events, deadlines, prepared) {
    const pending = divergences(prepared), byDate = {};
    for (const e of events) if (e.kind !== "juntada") (byDate[e.date] = byDate[e.date] || new Set()).add(e.doc_type);
    const both = Object.entries(byDate).filter(([, t]) => t.has("Petição inicial") && t.has("Defesa")).map(([d]) => d);
    if (both.length) pending.push(both.length === 1 ? `A data ${both[0]} aparece na inicial e na defesa: ver se as partes concordam sobre esse fato.` : `As datas ${both.slice(0, 6).join(", ")}${both.length > 6 ? " e outras" : ""} aparecem na inicial e na defesa: ver se as partes concordam sobre esses fatos.`);
    const inferred = events.filter(e => e.note);
    if (inferred.length > 3) pending.push(`${inferred.length} datas foram escritas sem o ano (ex.: "16 de maio"); a Acta deduziu o ano pelo resto da peça. Na cronologia elas aparecem com a etiqueta "ano inferido".`);
    else for (const e of inferred) pending.push(`${e.date} (${e.source.includes(" · ") ? "peça " + e.source.split(" · ").pop() : e.source}, p. ${e.page}): o texto não diz o ano; a Acta deduziu pelo resto da peça.`);
    if (deadlines.length > 3) pending.push(`${deadlines.length} menções a prazo no processo, nenhuma com a data em que o prazo começa. Os prazos das decisões mais recentes estão no mapa de riscos; conferir a data da intimação no PJe.`);
    else for (const d of deadlines) pending.push(`Prazo de ${d.deadline} (${d.source.includes(" · ") ? "peça " + d.source.split(" · ").pop() : d.source}, p. ${d.page}): o texto não diz quando o prazo começa; conferir a intimação.`);
    const cited = new Set();
    for (const doc of prepared) for (const s of doc.sentences) { const m = s.text.match(CITED_DOCS); if (m && cited.size < 3) cited.add(`${doc.name} cita documentos que não foram enviados: ${short(m[1], 140)}.`); }
    return pending.concat([...cited]);
  }
  const pick = (doc, words, n) => doc ? doc.sentences.filter(s => cleanSentence(s.text) && !BOILER.test(s.text) && words.some(w => normalize(s.text).includes(w))).slice(0, n) : [];
  function controverted(prepared) {
    for (const d of prepared) for (const s of d.sentences) {
      const m = s.text.match(/pontos controvertidos\s*:\s*(.+)/i);
      if (m) return m[1].replace(/\.$/, "").split(/,\s*(?:e\s+)?|\s+e\s+(?=a |o |as |os )/).map(x => x.trim()).filter(x => x.length > 3);
    }
    return [];
  }
  function amounts(prepared) {
    const f = [];
    for (const d of prepared) for (const s of d.sentences) for (const m of s.text.matchAll(MONEY())) f.push(squash(m[0]).replace(/R\$\s*/, "R$ "));
    return [...new Set(f)];
  }
  const ACT_WORDS = ["julgo", "defiro", "indefiro", "determino", "designo", "fixo", "condeno", "homologo", "cite-se", "intime", "especifiquem", "certifico", "nao houve acordo", "ficam as partes", "concedo", "recebo"];
  function docSummary(d) {
    if (d.cover) { const m = d.coverMeta || {}; return { name: d.name, type: "Capa do processo", title: "Capa e índice do PJe", id: null, signed: null, summary: [m.number && `Processo ${m.number}`, m.cls, m.court, m.subject && `Assunto: ${m.subject}`, m.value && `Valor da causa: ${m.value}`, (m.parties || []).length && `Partes: ${m.parties.map(p => `${p.name} (${p.role.toLowerCase()})`).join("; ")}`].filter(Boolean).join(" · "), process: m.number, pages: (d.text.match(/⟦p\. /g) || []).length, first: 1, last: (d.text.match(/⟦p\. /g) || []).length }; }
    const ok = d.sentences.filter(s => cleanSentence(s.text) && !BOILER.test(s.text));
    const keys = COURT.includes(d.type) ? ACT_WORDS : CLAIM_WORDS.concat(DEFENSE_WORDS, ["contrato"]);
    const chosen = ok.find(s => keys.some(k => normalize(s.text).includes(k))) || ok[0];
    const p = d.text.match(CNJ), pages = [...d.text.matchAll(/⟦p\. (\d+)⟧/g)].map(m => +m[1]);
    return { name: d.name, type: d.type, title: d.title && normalize(d.title) !== normalize(d.type) ? sentenceCase(d.title) : "", id: d.pjeId || null, signed: d.signed ? d.signed.date : null,
      summary: chosen ? short(chosen.text) : (d.sentences.length ? "Texto com muitos erros de leitura (provavelmente digitalizado). Abra o original." : "Sem texto legível. Abra o original."),
      official: d.official || null, process: p ? p[0] : null, pages: pages.length || 1, first: pages[0] || 1, last: pages[pages.length - 1] || 1 };
  }

  const TASKS = {
    cronologia: "Cronologia processual", relatorio: "Relatório ao cliente", comparacao: "Comparação das alegações",
    organizacao: "Organização dos documentos", riscos: "Mapa de riscos",
  };

  const toIso = d => d.split("/").reverse().join("");
  function dateIn(t) {
    let m = DATE_NUM().exec(t); if (m && validDate(+m[1], +m[3], +m[4])) return fmt(+m[1], +m[3], +m[4]);
    m = DATE_TEXT().exec(t); if (m && MONTHS[normalize(m[2])]) return fmt(+m[1], MONTHS[normalize(m[2])], +m[3]);
    return null;
  }
  // Audiência designada: procura nos atos do juízo a frase que marca a audiência e a data.
  function hearingFrom(core, ordered) {
    const found = [], RANK = { "Ato ordinatório": 3, "Decisão": 3, "Despacho": 3, "Ata de audiência": 3, "Sentença": 3, "Intimação": 1, "Certidão": 1, "Mandado": 0 };
    for (const d of core) if (COURT.includes(d.type)) for (const s of d.sentences) {
      if (!/audi[êe]ncia/i.test(s.text) || !/design|redesign|marcad|para o dia|realiza/i.test(s.text)) continue;
      const date = dateIn(s.text); if (date) found.push({ date, s, d });
    }
    if (!found.length) return null;
    const h = found.sort((a, b) => toIso(a.date).localeCompare(toIso(b.date)) || (RANK[a.d.type] || 0) - (RANK[b.d.type] || 0) || (/design/i.test(a.s.text) ? 1 : 0) - (/design/i.test(b.s.text) ? 1 : 0)).pop();
    const lastPiece = ordered.filter(d => d.signed).map(d => d.signed.date).sort((a, b) => toIso(a).localeCompare(toIso(b))).pop();
    const future = !lastPiece || toIso(h.date) >= toIso(lastPiece);
    return { risk: future ? `Audiência marcada para ${h.date}` : `Audiência de ${h.date}`, level: future ? "alto" : "médio", action: future ? "Preparar a audiência: confirmar data, hora, forma (presencial ou virtual) e quem vai comparecer." : "A data já passou em relação à última peça do arquivo: conferir se houve ata e o que foi decidido.", quote: short(h.s.text, 320), source: h.d.name, page: h.s.page, date: h.date };
  }
  // Citação ou intimação que não deu certo (réu não localizado etc.).
  function citationFrom(ordered) {
    const NEG = /n[ãa]o (?:foi |fora |restou )?(?:localizad|encontrad)|deixei de (?:citar|intimar)|(?:cita[çc][ãa]o|dilig[êe]ncia|mandado)[^.]{0,40}(?:infrut[íi]fer|negativ|sem [êe]xito)|n[ãa]o reside|mudou-se|endere[çc]o (?:incorreto|inexistente)|n[ãa]o ter sido poss[íi]vel (?:citar|localizar)/i;
    let last = null;
    for (const d of ordered) if (!d.cover && d.type !== "Documento") for (const s of d.sentences) if (NEG.test(s.text) && /cit|intim|mandado|r[ée]u|requerid/i.test(s.text)) last = { d, s };
    if (!last) return null;
    return { risk: "Citação ou intimação sem sucesso", level: "alto", action: "Conferir se a parte já foi citada. Enquanto não for, o processo não anda: ver os novos endereços pedidos e o resultado das diligências.", quote: short(last.s.text, 320), source: last.d.name, page: last.s.page };
  }

  function analyze(docs, task) {
    const prepared = prepare(docs);
    const { events, deadlines } = timeline(prepared);
    const pending = pendingFrom(events, deadlines, prepared);
    const core = prepared.filter(d => !d.cover && d.type !== "Documento");
    const coverMeta = (prepared.find(d => d.cover) || {}).coverMeta || null;
    const contr = controverted(core);
    const procs = [...new Set(docs.map(d => (d.text.match(CNJ) || [])[0]).filter(Boolean))];
    if (procs.length > 1) pending.unshift(`Atenção: os arquivos parecem ser de processos diferentes (${procs.join(" e ")}). Os resultados abaixo misturam os dois. Rode um processo de cada vez.`);
    const out = { task, title: TASKS[task], mode: "local", sources: docs.map(d => d.name), pieces: prepared.length, pending, processes: procs };
    if (task === "cronologia") out.result = { events, deadlines };
    else if (task === "comparacao") {
      const pets = prepared.filter(d => ["Petição inicial", "Réplica"].includes(d.type)), defs = prepared.filter(d => d.type === "Defesa");
      const left = pets, right = defs;
      const label = d => d.pjeId ? `${d.type}, ID ${d.pjeId}` : d.type, head = d => d.pjeId ? label(d) : `${d.type} (${d.name})`;
      const f = (docs, words) => { const out = [], seen = new Set(); for (const d of docs) for (const s of pick(d, words, 40).concat(d.sentences.filter(x => cleanSentence(x.text) && !BOILER.test(x.text)).slice(0, 12))) { const k = normalize(s.text).slice(0, 60); if (!seen.has(k) && out.length < 12) { seen.add(k); out.push({ text: short(s.text, 320), source: d.name, piece: label(d), page: s.page, order: docs.indexOf(d) * 1e6 + d.sentences.indexOf(s) }); } } return out.sort((a, b) => a.order - b.order); };
      out.result = { columns: ["O que diz o autor", "O que diz o réu"], sources: [left.map(head).join("; ") || "Nenhuma petição inicial entre os arquivos.", right.map(head).join("; ") || "Nenhuma contestação entre os arquivos."], left: f(left, CLAIM_WORDS), right: f(right, DEFENSE_WORDS), controverted: contr };
    } else if (task === "organizacao") out.result = { documents: prepared.map(docSummary) };
    else if (task === "riscos") {
      const items = contr.map(p => ({ risk: `Ponto controvertido: ${p}`, level: "alto", action: "Fixado pelo juízo: separar as provas que sustentam a versão do cliente sobre este ponto." }));
      const ORDERS = ["Decisão", "Despacho", "Sentença", "Acórdão", "Ata de audiência", "Intimação", "Ato ordinatório", "Certidão", "Mandado"];
      const ordered = prepared.map((d, i) => ({ d, i, k: d.signed ? d.signed.date.split("/").reverse().join("") : "" })).sort((a, b) => (a.k || "").localeCompare(b.k || "") || a.i - b.i).map(x => x.d);
      const lastDecision = [...ordered].reverse().find(d => ["Decisão", "Sentença", "Acórdão"].includes(d.type));
      if (lastDecision) {
        const o = pick(lastDecision, ORDER_WORDS, 2);
        if (o.length) items.push({ risk: `Última ${lastDecision.type.toLowerCase()} do processo`, level: "alto", action: `Cumprir ou recorrer: conferir o que foi determinado e o prazo.${lastDecision.signed ? ` Assinada em ${lastDecision.signed.date}.` : ""}`, quote: short(o.map(s => s.text).join(" "), 320), source: lastDecision.name, page: o[0].page });
      }
      const recentDocs = ordered.filter(d => ORDERS.includes(d.type) && deadlines.some(x => x.source === d.name)).slice(-1).map(d => d.name);
      if (lastDecision) { const after = ordered.slice(ordered.indexOf(lastDecision) + 1).filter(d => d.type === "Recurso"); for (const r of after) { const o = r.sentences.find(x => cleanSentence(x.text) && !BOILER.test(x.text)) || r.sentences[0]; items.push({ risk: `Recurso contra a ${lastDecision.type.toLowerCase()}: ${sentenceCase(r.title) || r.type}`, level: "alto", action: `Interposto${r.signed ? ` em ${r.signed.date}` : ""}, depois da ${lastDecision.type.toLowerCase()}. Conferir o prazo de contrarrazões e os pontos atacados.`, quote: o ? short(o.text) : "", source: r.name, page: o ? o.page : null }); } }
      const recent = deadlines.filter(d => recentDocs.includes(d.source)).slice(-4);
      for (const d of recent) items.push({ risk: `Prazo de ${d.deadline}`, level: "alto", action: "O texto não diz quando o prazo começa: conferir a data da intimação ou da ciência no PJe e anotar o vencimento.", quote: d.event, source: d.source, page: d.page });
      if (deadlines.length > recent.length) items.push({ risk: recent.length ? "Outros prazos citados no processo" : "Prazos citados no processo", level: recent.length ? "médio" : "alto", action: `${deadlines.length - recent.length === 1 ? "Há mais 1 prazo em peça anterior" : `Há mais ${deadlines.length - recent.length} prazos em peças anteriores`}, provavelmente já vencidos. A lista completa está na cronologia.` });
      const exc = (() => { for (const d of core) for (const s of d.sentences) { const n = normalize(s.text); if (n.includes("forca maior") || n.includes("caso fortuito")) return { d, s }; } return null; })();
      if (exc) items.push({ risk: "Excludente de responsabilidade alegada", level: "alto", action: "Força maior ou caso fortuito aparece no processo: avaliar a prova do evento e da sua inevitabilidade.", quote: short(exc.s.text), source: exc.d.name, page: exc.s.page });
      const hearing = hearingFrom(core, ordered);
      const cit = citationFrom(ordered);
      if (cit) items.unshift(cit);
      if (hearing) items.unshift(hearing);
      const money = []; for (const d of core) for (const s of d.sentences.filter(x => /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9"“(]/.test(x.text))) for (const m of s.text.matchAll(MONEY())) { const v = squash(m[0]).replace(/R\$\s*/, "R$ "); if (!money.some(x => x.v === v)) money.push({ v, d, s }); }
      if (money.length) { const top = money.slice().sort((a, b) => parseFloat(b.v.replace(/[^\d,]/g, "").replace(",", ".")) - parseFloat(a.v.replace(/[^\d,]/g, "").replace(",", "."))).slice(0, 3);
        items.push({ risk: "Valores em discussão", level: "médio", action: `${money.length} valor(es) diferentes no processo. Os maiores: ${top.map(x => `${x.v} (p. ${x.s.page})`).join(", ")}. Validar cálculos e comprovantes.`, quote: short(top[0].s.text), source: top[0].d.name, page: top[0].s.page }); }
      if (!items.length) items.push({ risk: "Nenhum risco identificado automaticamente", level: "médio", action: "A Acta não achou decisão, prazo, excludente ou valor no texto. Revise o processo ou use a IA." });
      out.result = { items };
    } else {
      const byDate = prepared.map((d, i) => ({ d, i, k: d.signed ? d.signed.date.split("/").reverse().join("") : "" })).sort((a, b) => a.k.localeCompare(b.k) || a.i - b.i).map(x => x.d);
      const STATUS_WORDS = ORDER_WORDS.concat(["cite-se", "intime-se", "designo", "diligencie", "redesigno"]);
      const statusDoc = byDate.reverse().find(d => ["Decisão", "Sentença", "Acórdão", "Ata de audiência", "Despacho", "Ato ordinatório"].includes(d.type) && pick(d, STATUS_WORDS, 1).length);
      const orders = pick(statusDoc, STATUS_WORDS, 3);
      const types = {}; prepared.forEach(d => types[d.type] = (types[d.type] || 0) + 1);
      out.result = {
        summary: (() => {
          const signed = byDate.filter(d => d.signed).reverse(), first = signed[0], last = signed[signed.length - 1];
          const head = coverMeta ? `${coverMeta.cls ? sentenceCase(coverMeta.cls) : "Processo"}${coverMeta.court ? ` na ${coverMeta.court}` : ""}, com ${core.length + prepared.filter(d => d.type === "Documento").length} peças.` : prepared.length > docs.length ? `O processo tem ${prepared.length} peças.` : `Foram lidos ${prepared.length} documento(s): ${Object.entries(types).map(([t, n]) => `${n > 1 ? n + " " : ""}${t.toLowerCase()}`).join(", ")}.`;
          const span = first && last && first !== last ? ` A primeira é ${first.type.toLowerCase()} de ${first.signed.date}; a mais recente é ${(sentenceCase(last.title) || last.type).toLowerCase()} de ${last.signed.date}.` : "";
          const after = statusDoc ? byDate.slice().reverse().slice(byDate.slice().reverse().indexOf(statusDoc) + 1).filter(d => !["Certidão", "Intimação"].includes(d.type)) : [];
          return head + span + (after.length ? ` Depois ${statusDoc.type === "Ata de audiência" ? "da última ata de audiência" : `do último ato do juízo (${statusDoc.type.toLowerCase()})`}, veio: ${after.slice(0, 6).map(d => (d.official || sentenceCase(d.title) || d.type).toLowerCase() + (d.signed ? ` (${d.signed.date})` : "")).join(", ")}${after.length > 6 ? ` e mais ${after.length - 6}` : ""}.` : "");
        })(),
        case_info: coverMeta, hearing: hearingFrom(core, byDate.slice().reverse()),
        status: orders.length ? short(orders.map(s => s.text).join(" "), 420) : "Nenhuma decisão entre os documentos enviados.",
        status_source: orders.length ? `${statusDoc.name}, p. ${orders[0].page}` : null,
        amounts: amounts(core), amount_list: (() => { const l = []; for (const d of core) for (const s of d.sentences.filter(x => /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9"“(]/.test(x.text))) for (const m of s.text.matchAll(MONEY())) { const v = squash(m[0]).replace(/R\$\s*/, "R$ "); if (!l.some(x => x.value === v) && l.length < 8) l.push({ value: v, text: short(s.text, 200), source: d.name, page: s.page }); } return l; })(), pieces: prepared.length, last_event: events[events.length - 1] || null, controverted: contr,
        documents: prepared.map(docSummary),
      };
    }
    return out;
  }

  // ---------- trava de sigilo ----------
  const UP = "A-ZÁÉÍÓÚÂÊÔÃÕÇ", WORD = `[${UP}][\\wÀ-ÿ&'-]+`, CONNECT = "(?:\\s+(?:da|de|do|das|dos|e)\\s+|\\s+)";
  const PATTERNS = [
    ["CPF", /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g], ["CNPJ", /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g],
    ["EMAIL", /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g], ["TELEFONE", /(?<!\d)\(?\d{2}\)?\s?9?\d{4}-\d{4}\b/g],
    ["OAB", /\bOAB\/?[A-Z]{2}\s*n?º?\s*[\d.]+\b/g], ["PROCESSO", /\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/g],
  ];
  const COMPANY = new RegExp(`\\b(${WORD}(?:\\s+${WORD}){0,5})\\s+(Ltda\\.?|S\\.A\\.?|S\\/A|EIRELI|EPP|ME)(?=[\\s,.;)]|$)`, "g");
  const ROLE = new RegExp(`\\b(?:Autora?|Réu?|Ré|Requerente|Requerid[oa]|Reclamante|Reclamad[oa]|Exequente|Executad[oa]|Apelante|Apelad[oa]|Agravante|Agravad[oa]|Testemunha|Cliente|Advogad[oa])\\s*:\\s*(${WORD}(?:${CONNECT}${WORD}){0,5})`, "g");
  const TITLE = new RegExp(`\\b(?:Sr\\.|Sra\\.|Dr\\.|Dra\\.|senhora?)\\s+(${WORD}(?:${CONNECT}${WORD}){0,4})`, "g");
  const CAPW = "[A-ZÁÉÍÓÚÂÊÔÃÕÇÀÜ][A-ZÁÉÍÓÚÂÊÔÃÕÇÀÜ'-]+", CAPNAME = `${CAPW}(?:\\s+(?:DA|DE|DO|DAS|DOS|E)?\\s*${CAPW}){1,5}`;
  const PJE_PARTY = new RegExp(`^(${CAPNAME})(?:\\s*-\\s*[A-Z]{2,6})?\\s*\\((?:AUTORA?|R[ÉE]U?|R[ÉE]|REQUERENTE|REQUERID[OA]|EXEQUENTE|EXECUTAD[OA]|IMPETRANTE|IMPETRAD[OA]|RECLAMANTE|RECLAMAD[OA]|APELANTE|APELAD[OA]|TERCEIRO[^)]*|ADVOGAD[OA]|INTERESSAD[OA])\\)`, "gm");
  const AGAINST = new RegExp(`(?:em face d[eoa]s?|contra|requerid[oa]|investigad[oa]|denunciad[oa])\\s+(${CAPNAME})`, "g");
  const SIGNER = new RegExp(`(?:[Aa]ssinad[oa] (?:eletronicamente|digitalmente) por|[Dd]igitalmente por|[Pp]rotocolado por|[Ll]ogin e? ?senha por|[Ss]ervidor(?:a)?|[Pp]rocurador(?:a)? da República)\\s*:?\\s*\\(?(${CAPNAME})`, "g");
  const INSTITUTION = /\b(MINIST[ÉE]RIO|P[ÚU]BLICO|UNI[ÃA]O|ESTADO|MUNIC[ÍI]PIO|INSTITUTO|UNIVERSIDADE|FAZENDA|DEFENSORIA|ADVOCACIA|PROCURADORIA|JUSTI[ÇC]A|TRIBUNAL|SE[ÇC][ÃA]O|VARA|FEDERAL|CAIXA|BANCO|RECEITA|PODER|JUDICI[ÁA]RIO|CONSELHO|SECRETARIA|GOVERNO|EMPRESA|COMPANHIA)\b/;
  const GENERIC = new Set("tecnologia logística logistica comércio comercio serviços servicos indústria industria banco companhia empresa sociedade grupo brasil brasileira transportes construtora engenharia educacional participações participacoes holding consultoria administradora seguros telecom energia saúde saude distribuidora alimentos nacional geral digital solutions soluções solucoes global padaria".split(" "));
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  function anonymize(texts) {
    const joined = texts.join("\n"), repl = new Map(), found = [], counters = {};
    const codeFor = (kind, value, aliases) => {
      value = value.trim();
      if (repl.has(value)) return repl.get(value);
      counters[kind] = (counters[kind] || 0) + 1;
      const code = `[${kind}_${counters[kind]}]`;
      for (const a of aliases || [value]) if (!repl.has(a.trim())) repl.set(a.trim(), code);
      found.push({ code, kind, value });
      return code;
    };
    for (const [k, re] of PATTERNS) for (const m of joined.matchAll(re)) codeFor(k, m[0]);
    for (const m of joined.matchAll(COMPANY)) {
      const base = m[1], toks = base.split(/\s+/).filter(t => !GENERIC.has(t.toLowerCase()) && t.length >= 4);
      codeFor("PARTE", m[0], [m[0], base, ...toks]);
    }
    const covered = n => [...repl.keys()].some(k => k.length >= 4 && (n.includes(k) || k.includes(n)));
    const lowerWords = new Set((joined.match(/(?<![A-Za-zÀ-ÿ])[a-záéíóúâêôãõçàü]{3,}(?![A-Za-zÀ-ÿ])/g) || []));
    // Variantes do mesmo nome: em maiúsculas, com iniciais maiúsculas e só primeiro + último nome.
    const titleCase = n => n.toLowerCase().replace(/(^|\s)(\S)/g, (a, b, c) => b + c.toUpperCase()).replace(/\s(Da|De|Do|Das|Dos|E)\s/g, w => w.toLowerCase());
    const person = name => {
      name = name.trim().replace(/\s+/g, " ");
      if (name.split(" ").length < 2 || INSTITUTION.test(name.toUpperCase()) || covered(name)) return;
      const parts = name.split(" ").filter(w => !/^(da|de|do|das|dos|e)$/i.test(w));
      const short = parts.length > 2 ? `${parts[0]} ${parts[parts.length - 1]}` : null;
      const al = [name, name.toUpperCase(), titleCase(name)];
      if (short) al.push(short, short.toUpperCase(), titleCase(short));
      // Primeiro nome e sobrenomes raros também viram código (o nome pode aparecer quebrado ou colado em outra palavra).
      for (const w of parts) if (w.length >= 4 && !lowerWords.has(w.toLowerCase())) al.push(w.toUpperCase(), titleCase(w));
      codeFor("PESSOA", name.toUpperCase() === name ? titleCase(name) : name, al);
    };
    for (const m of joined.matchAll(/\b\d{5}-?\d{3}\b(?!\d)/g)) if (/CEP|cep/.test(joined.slice(Math.max(0, m.index - 12), m.index)) || /^\d{5}-\d{3}$/.test(m[0])) codeFor("CEP", m[0]);
    for (const m of joined.matchAll(/\b(?:RUA|AVENIDA|AV\.?|TRAVESSA|ESTRADA|RODOVIA|Rua|Avenida|Av\.|Travessa|Estrada)\s+[^,\n]{3,60},?\s*(?:n[º°o]\.?\s*)?\d{1,5}/g)) codeFor("ENDERECO", m[0]);
    for (const re of [ROLE, TITLE]) for (const m of joined.matchAll(re)) person(m[1]);
    for (const re of [PJE_PARTY, AGAINST, SIGNER]) for (const m of joined.matchAll(re)) person(m[1]);
    // Nome em maiúsculas solto no texto: só conta se nenhuma das palavras aparece em minúsculas no
    // próprio processo (palavras comuns como VALOR ou CAUSA aparecem; nomes próprios não).
    for (const m of joined.matchAll(new RegExp(`(?<![\\wÀ-ÿ])(${CAPNAME})(?![\\wÀ-ÿ])`, "g"))) {
      const toks = m[1].split(/\s+/).filter(w => !/^(DA|DE|DO|DAS|DOS|E)$/.test(w));
      if (toks.length >= 2 && !/^(RUA|AVENIDA|AV|TRAVESSA|ESTRADA|RODOVIA|PRA[ÇC]A|EDIF[ÍI]CIO|BAIRRO)$/.test(toks[0]) && toks.every(w => w.length >= 3 && !lowerWords.has(w.toLowerCase()))) person(m[1]);
    }
    const ordered = [...repl.keys()].sort((a, b) => b.length - a.length);
    const pattern = v => {
      if (!/^[A-Za-zÀ-ÿ]/.test(v)) return new RegExp(esc(v).replace(/\s+/g, "\\s+"), "g");
      const body = esc(v).replace(/\s+/g, "\\s+"), caps = v === v.toUpperCase();
      return new RegExp(`(?<![A-Za-zÀ-ÿ])${body}${caps ? "(?![a-zà-ÿ])" : "(?![A-Za-zÀ-ÿ])"}`, "g");
    };
    const out = texts.map(t => {
      for (const v of ordered) {
        const re = pattern(v);
        t = t.replace(re, repl.get(v));
      }
      return t;
    });
    const mapping = {};
    for (const f of found) mapping[f.code] = f.value;
    for (const f of found) f.occurrences = out.reduce((n, t) => n + t.split(f.code).length - 1, 0);
    const restore = v => {
      if (typeof v === "string") { for (const c of Object.keys(mapping).sort((a, b) => b.length - a.length)) v = v.split(c).join(mapping[c]); return v; }
      if (Array.isArray(v)) return v.map(restore);
      if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, restore(x)]));
      return v;
    };
    return { texts: out, found, mapping, restore };
  }

  // ---------- conferência dos trechos citados pela IA ----------
  const forMatch = v => normalize(v).replace(/[“”"'«»]/g, "").replace(/\s+/g, " ").replace(/^[ .;,:]+|[ .;,:]+$/g, "");
  function dateInQuote(date, quote) {
    const m = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if (!m) return false;
    const d = +m[1], mo = +m[2], q = normalize(quote);
    const month = Object.keys(MONTHS).find(k => MONTHS[k] === mo);
    if ([date, `${d}/${mo}/${m[3]}`, `${m[1]}/${m[2]}`, `${d} de ${month}`, `${m[1]} de ${month}`, `${d}º de ${month}`].some(p => q.includes(p))) return true;
    return !!(month && q.includes(month) && new RegExp(`(?<!\\d)${d}(?!\\d)`).test(q));
  }
  function verify(items, docsByName) {
    const corpus = Object.fromEntries(Object.entries(docsByName).map(([n, t]) => [n, forMatch(plain(t))]));
    return items.map(it => {
      const quote = String(it.quote || "").trim(); let source = String(it.source || "").trim(), status = "sem trecho";
      if (quote) {
        const needle = forMatch(quote);
        if (corpus[source] && corpus[source].includes(needle)) status = "conferido";
        else { const other = Object.keys(corpus).find(n => corpus[n].includes(needle)); if (other) { status = other.startsWith(source) || other.split(" · ")[0] === source.split(" · ")[0] ? "conferido" : "outro arquivo"; source = other; } else status = "não localizado"; }
      }
      const date = String(it.date || "").trim();
      return { ...it, source, date, status, date_in_quote: date && ["conferido", "outro arquivo"].includes(status) ? dateInQuote(date, quote) : null };
    });
  }

  global.ActaEngine = { cleanSentence, readFile, analyze, anonymize, verify, plain, TASKS, prepare, timeline };
})(window);
