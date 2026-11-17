const $=(s,r=document)=>r.querySelector(s);const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const stages=['startStage','clarifyStage','planStage','buildStage','resultStage'];
function toast(message){const t=$('#toast');t.textContent=message;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),2600)}
function showView(id){$$('.view').forEach(v=>v.classList.toggle('is-active',v.id===id));$$('.nav-item').forEach(b=>b.classList.toggle('is-active',b.dataset.view===id));$('.sidebar').classList.remove('open');window.scrollTo({top:0,behavior:'smooth'})}
function showStage(id){stages.forEach(s=>$('#'+s).classList.toggle('is-active',s===id));const idx=stages.indexOf(id);$$('#stepper li').forEach((li,i)=>{li.classList.toggle('on',i===idx);li.classList.toggle('done',i<idx)});window.scrollTo({top:0,behavior:'smooth'})}
$('#loginButton').addEventListener('click',()=>{$('#loginView').classList.add('is-hidden');$('#appView').classList.remove('is-hidden');showView('builder')});
$$('.nav-item').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));$('#mobileMenu').addEventListener('click',()=>$('.sidebar').classList.toggle('open'));

$$('.nav-examples').forEach(b=>b.addEventListener('click',()=>showView('examples')));
$$('.use-example').forEach(b=>b.addEventListener('click',()=>{$('#requestText').value=b.dataset.prompt;showView('builder');showStage('startStage');$('#requestText').focus();toast('Exemplo carregado. Agora você pode adaptar o pedido.')}));
const demoTitles={'client-report':'Relatório ao cliente','case-timeline':'Cronologia processual','claims-compare':'Comparação das alegações','doc-organizer':'Organização dos documentos','risk-map':'Mapa de riscos e provas'};
function showDemoResult(id){$$('.demo-result').forEach(el=>el.classList.toggle('is-hidden',el.id!==id));$$('.demo-action').forEach(b=>b.classList.toggle('is-active',b.dataset.demoOutput===id));$('#demoOutputTitle').textContent=demoTitles[id];$('#demoReady').textContent='Resultado pronto'}
$$('.demo-action').forEach(b=>b.addEventListener('click',()=>showDemoResult(b.dataset.demoOutput)));
$('#runFullDemo').addEventListener('click',()=>{const button=$('#runFullDemo'),progress=$('#demoProgress'),steps=['Identificando fatos e pedidos','Relacionando informações às fontes','Gerando cronologia e mapa de riscos','Escrevendo relatório ao cliente'];button.disabled=true;progress.classList.remove('is-hidden');$$('.demo-result').forEach(el=>el.classList.add('is-hidden'));$('#demoReady').textContent='Processando';let i=0;$('#demoProgressText').textContent=steps[0];const timer=setInterval(()=>{i++;if(i<steps.length){$('#demoProgressText').textContent=steps[i]}else{clearInterval(timer);progress.classList.add('is-hidden');button.disabled=false;showDemoResult('client-report');toast('Análise concluída: 5 resultados disponíveis.')}},420)});
$('#requestForm').addEventListener('submit',e=>{e.preventDefault();const value=$('#requestText').value.trim();if(!value)return toast('Escolha uma tarefa ou escreva o pedido.');$('#userRequestPreview').textContent=value;setTask(detectTask(value));showStage('clarifyStage')});
$('#requestText').addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter')$('#requestForm').requestSubmit()});
$$('[data-back]').forEach(b=>b.addEventListener('click',()=>showStage(b.dataset.back)));
$('#contextForm').addEventListener('submit',e=>{e.preventDefault();showStage('planStage')});
$('#editPlan').addEventListener('click',()=>{showStage('clarifyStage');toast('Contexto reaberto para ajustes.')});
$('#approvePlan').addEventListener('click',()=>{showStage('buildStage');runBuild()});
function runBuild(){const statuses=['Validando permissões...','Lendo a estrutura dos documentos...','Construindo o extrator de eventos...','Gerando a tabela cronológica...','Executando os testes...'];const steps=$$('#buildSteps li');let value=0;steps.forEach(s=>s.classList.remove('done'));$('#progressBar').style.width='0%';$('#progressValue').textContent='0%';const timer=setInterval(()=>{value+=4;$('#progressBar').style.width=value+'%';$('#progressValue').textContent=value+'%';const current=Math.min(statuses.length-1,Math.floor(value/21));$('#buildStatus').textContent=statuses[current];steps.forEach((s,i)=>s.classList.toggle('done',i<Math.ceil(value/20)));if(value>=100){clearInterval(timer);$('#buildStatus').textContent='Ferramenta construída e testada.';setTimeout(()=>showStage('resultStage'),550)}},90)}
$('#rerunTest').addEventListener('click',()=>{toast('Critérios conferidos de novo: 3 de 3 atendidos.')});
$('#saveSkill').addEventListener('click',()=>{const t=TASKS[currentTask];$('#savedName').textContent=$('#skillName').value||t.name;$('#savedDesc').textContent=t.saved;$('#savedIcon').textContent=t.icon;$('#savedSkillCard').classList.remove('is-hidden');toast('Skill salva na biblioteca.');setTimeout(()=>showView('skills'),700)});
$$('.nav-build').forEach(b=>b.addEventListener('click',()=>{showView('builder');showStage('startStage')}));$$('.nav-skills').forEach(b=>b.addEventListener('click',()=>showView('skills')));
$$('.axis-card .text-button:not(.nav-skills)').forEach(b=>b.addEventListener('click',()=>toast('Configuração disponível no protótipo demonstrativo.')));

function enterApp(view){$('#loginView').classList.add('is-hidden');$('#appView').classList.remove('is-hidden');showView(view);}
$('#openCase').addEventListener('click',()=>enterApp('case-demo'));
$('#backHome').addEventListener('click',()=>{$('#appView').classList.add('is-hidden');$('#loginView').classList.remove('is-hidden');window.scrollTo({top:0})});

document.querySelectorAll('.l-tab').forEach(t=>t.addEventListener('click',()=>{document.querySelectorAll('.l-tab').forEach(x=>x.classList.toggle('on',x===t));document.querySelectorAll('.l-case').forEach(c=>c.classList.toggle('is-hidden',c.id!=='case-'+t.dataset.case));}));

const TASKS={
 cronologia:{name:'Cronologia processual',icon:'C',meta:'3 documentos · 6 eventos · 1 prazo · 4 pontos a conferir',step5:'Gerar a tabela',step5p:'Criar colunas de data, evento, fonte e observação.',desc:'Organiza os eventos do processo por data, com documento, página e alertas de incerteza.',saved:'Eventos, datas, fontes e alertas.'},
 relatorio:{name:'Relatório ao cliente',icon:'R',meta:'3 documentos · situação atual, pontos favoráveis, atenção e próximos passos',step5:'Escrever o relatório',step5p:'Explicar a situação em linguagem simples, com os próximos passos.',desc:'Resume o processo para o cliente em linguagem simples, com pontos de atenção e próximos passos.',saved:'Situação do caso em linguagem simples.'},
 comparacao:{name:'Comparação das alegações',icon:'A',meta:'3 documentos · 4 temas comparados · pontos controvertidos',step5:'Montar a comparação',step5p:'Colocar lado a lado o que cada parte diz, tema por tema.',desc:'Compara o que autora e ré dizem sobre cada tema e indica o que conferir.',saved:'Autora × ré, tema por tema.'},
 organizacao:{name:'Organização dos documentos',icon:'D',meta:'3 documentos classificados por tipo',step5:'Gerar o índice',step5p:'Classificar cada peça por tipo e criar o índice.',desc:'Classifica as peças por tipo e gera um índice do caso.',saved:'Classificação e índice das peças.'},
 riscos:{name:'Mapa de riscos',icon:'!',meta:'3 documentos · 3 riscos com as provas necessárias',step5:'Montar o mapa de riscos',step5p:'Indicar cada risco, o nível e a prova necessária.',desc:'Aponta os riscos do caso, o nível de cada um e as provas necessárias.',saved:'Riscos, provas e pontos de atenção.'}
};
let currentTask='cronologia';
function detectTask(text){const t=text.toLowerCase();if(/relat[oó]rio|cliente/.test(t))return 'relatorio';if(/compar|alega/.test(t))return 'comparacao';if(/organiz|[ií]ndice|classifi/.test(t))return 'organizacao';if(/risco|prova/.test(t))return 'riscos';if(/cronolog|data|linha do tempo|prazo|evento/.test(t))return 'cronologia';return 'outro'}
function setTask(k){
  const note=$('#taskNote');
  if(k==='outro'){note.textContent='Nesta demonstração, a Acta tem resultados prontos para cronologia, relatório ao cliente, comparação das alegações, organização dos documentos e mapa de riscos. Vamos seguir com a cronologia. Pedidos diferentes desses ficam para o modo com IA da Acta instalada (veja o GitHub).';note.classList.remove('is-hidden');k='cronologia'}else{note.classList.add('is-hidden')}
  currentTask=k;const t=TASKS[k];
  $('#planTitle').textContent='Skill de '+t.name.toLowerCase();$('#buildTitle').textContent='Skill de '+t.name.toLowerCase();
  $('#planStep5').textContent=t.step5;$('#planStep5p').textContent=t.step5p;
  $('#toolTitle').textContent=t.name;$('#toolMeta').textContent=t.meta;$('#toolIcon').textContent=t.icon;
  $('#skillName').value=t.name;$('#outFile').textContent={cronologia:'cronologia-processual.md',relatorio:'relatorio-ao-cliente.md',comparacao:'comparacao-alegacoes.md',organizacao:'indice-documentos.md',riscos:'mapa-de-riscos.md'}[k];$('#skillDesc').value=t.desc;
  $$('.res').forEach(r=>r.classList.toggle('is-hidden',r.id!=='res-'+k));
  $$('.task-card').forEach(c=>c.classList.toggle('on',c.dataset.task===k));
}
$$('.task-card').forEach(c=>c.addEventListener('click',()=>{$('#requestText').value=c.dataset.prompt;setTask(c.dataset.task);toast('Pedido preenchido. Agora clique em "Ver o plano".')}));
