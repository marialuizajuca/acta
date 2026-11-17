# Relatório de uso de IA (fase 2)

## O que a gente queria fazer

Na fase 1 vendemos a Acta como um assistente em que o advogado descreve uma tarefa, aprova um plano e recebe uma ferramenta pronta, com a fonte de cada informação. Na fase 2 o desafio era fazer isso funcionar de verdade e entregar num repositório público, com README, licença e este relatório.

## Que ferramentas usamos e por quê

**Codex.** A primeira versão do código saiu do Codex. Pedimos a estrutura do projeto, o servidor, a tela e os testes, e ele entregou uma aplicação que abria no navegador, lia PDF e Word e tinha as cinco skills que mostramos no pitch.

**Claude.** Já tínhamos usado o Claude na fase 1, quando ele percebeu que o Codex tinha entendido o enunciado errado: a primeira versão da proposta virou uma plataforma fechada de análise de contratos, e o professor pedia uma ferramenta em que o próprio advogado constrói o que precisa. Mudamos a proposta por causa disso.

Na fase 2 voltamos ao Claude para revisar a versão do Codex antes da entrega. Ele rodou a aplicação com as três peças do caso Aurora × Delta e encontrou problemas que a gente não tinha visto:

- alguns eventos da cronologia apareciam cortados no meio da frase, como "eletrônicos até 31 de janeiro de 2026.";
- as enchentes de 22 a 29 de janeiro, que são o principal argumento da defesa, não apareciam;
- a decisão era classificada como "Defesa", porque o texto dela fala da contestação;
- na comparação de alegações, o cabeçalho do PDF aparecia como se fosse uma alegação.

O curioso é que os quatro testes da primeira versão passavam. Eles usavam frases curtas inventadas, e não os PDFs que a banca ia ver. Hoje são 21 testes, todos rodando em cima dos PDFs de exemplo.

**Uma decisão importante: usar IA dentro do produto.** A versão do Codex não chamava nenhum modelo de linguagem. Era tudo regra fixa sobre o texto. Isso protege o sigilo, mas não era o que tínhamos prometido. Decidimos manter as regras como modo padrão, que funciona sem internet, e pedimos ao Claude para criar um modo com IA que só liga com a permissão do advogado. Antes de qualquer envio, os nomes, CPFs e o número do processo viram códigos. Depois da resposta, o sistema procura cada trecho citado no documento original.

O Claude também escreveu o segundo caso fictício (trabalhista), o rascunho do gabarito e o script que mede o acerto. Conferimos tudo rodando a aplicação e os testes e comparando com os PDFs.

## O que deu errado e o que fizemos

| O que tentamos | O que aconteceu | O que decidimos |
|---|---|---|
| Montar a cronologia linha por linha do PDF | O PDF quebra a frase no fim da linha e os eventos saíam cortados | Reconstruir os parágrafos antes de procurar as datas e ignorar os cabeçalhos repetidos |
| Classificar o documento pela primeira palavra-chave | A decisão falava da contestação e virava "Defesa" | Olhar primeiro o nome do arquivo e o título |
| Confiar só nos testes automáticos | Os testes passavam, mas a demonstração tinha erros | Montar um gabarito com as datas certas de dois casos e medir: a versão antiga achava 9 de 12 eventos, a nova acha 12 de 12 |
| Testar com um caso diferente do nosso | No caso trabalhista, a versão antiga chamou a reclamação de "Contrato" e a ata de "Documento geral" | Incluir esses tipos e manter o caso trabalhista como segundo exemplo |
| Conferir o caso trabalhista no site | A Acta apagava o símbolo §: "art. 477, § 8º" saía como "art. 477, . 8º" | Corrigimos o código (o § era usado internamente como marcador) e criamos um teste para isso |

Uma ressalva honesta: as regras foram ajustadas depois de olharmos para esses dois casos. O 12 de 12 mostra que corrigimos o que estava errado, não que a Acta acerta em qualquer processo. O próximo passo seria testar com uma decisão real e pública.

## O que mudamos por causa do feedback da fase 1

Lemos o feedback da banca e da turma sobre a Acta e usamos os pontos mais repetidos como lista de tarefas:

- **"Não ficou claro em que tarefa do advogado a ferramenta atua" e "a proposta ficou genérica".** Delimitamos o público: advogado de contencioso que acabou de receber um processo. O site agora começa por essa situação.
- **"O que é o plano? É uma tese? É um agente?"** O site e o README explicam o plano com o exemplo real da cronologia, passo a passo.
- **"Faltou ver o produto em uso, e em outros casos."** O produto agora funciona de verdade, e o site mostra o resultado real em dois casos (cível e trabalhista).
- **"Qual a diferença para o ChatGPT e o Claude?"** Fizemos o teste lado a lado em vez de apenas afirmar uma diferença.
- **"A Acta protocola? Mexe em sistemas externos?"** Deixamos claro que não: ela não entra no PJe nem em sites de tribunal.
- **"Faltou falar de limites e de sigilo."** O site tem uma seção de limites e outra que mostra o texto exato que sairia para a IA.
- **"O site começa num login e não explica o produto."** Virou uma página de apresentação, com a demonstração aberta.

## O site

O site da fase 1 foi feito no ChatGPT. Quando fomos revisá-lo para a fase 2, comparando com o feedback geral da banca, apareceram dois problemas.

O primeiro: o site abria numa tela de e-mail e senha. O feedback criticou exatamente isso em outros grupos, e o enunciado pedia um site que abrisse sem login. Trocamos a tela de login por uma página de apresentação, com um botão que entra direto na demonstração.

O segundo foi mais sério. O ChatGPT tinha preenchido a demonstração com informações que não existem nos PDFs do caso: uma decisão datada de 20/05/2026 (a decisão não tem data), um relatório "atualizado em 22/05/2026", eventos de um processo que nem existe na tela de resultado ("distribuição em 12/03", "juntada do AR") e frases como "a defesa apresentou e-mails sobre as enchentes", quando a contestação só diz que a ré avisou por e-mail. A cronologia também deixava de fora as enchentes, que são o principal argumento da defesa. Foi o Claude que comparou cada tela com os PDFs e apontou essas diferenças.

Trocamos tudo pelos resultados que a Acta realmente produz para os três PDFs e refizemos o PDF do relatório ao cliente. É a mesma lição da cronologia, só que no site: uma IA que escreve bem também inventa com naturalidade, e o único jeito de pegar isso é conferir na fonte. O site novo está em https://marialuizajuca.github.io/acta/.

## O teste contra o ChatGPT

Fizemos a mesma tarefa no ChatGPT comum, com os mesmos PDFs e o mesmo pedido. A gente esperava que ele errasse datas. Não errou. Achou todos os eventos nos dois casos, indicou página, copiou os trechos certos, viu que as partes discordam sobre a data do pagamento (24/08 ou 28/08) e ainda calculou o vencimento dos prazos. No caso trabalhista, respondeu certo de primeira. Em acerto, empatou com a Acta. Na riqueza da resposta, foi melhor.

Isso mudou o nosso argumento. Paramos de dizer que a Acta "acerta mais" e passamos a falar do que ela garante e o ChatGPT não:

- o nome das partes, o CPF e o número do processo não saem do escritório, ou saem só como códigos;
- quem confere se cada trecho existe é o sistema, e não o advogado relendo tudo;
- a resposta usa só os documentos do caso. No teste, o ChatGPT justificou um feriado de 2026 com uma portaria de 2025 que achou na internet, e esse é o tipo de detalhe que passa batido;
- o mesmo pedido vira uma skill e roda igual da próxima vez.

Os números estão em `avaliacao/comparacao-chatgpt.md`.

## Onde preferimos não usar IA

- **A cronologia no modo padrão.** As datas e os prazos estão escritos nos documentos, e uma regra que os encontra dá para conferir linha por linha. Assim o advogado consegue usar a Acta sem mandar nada para fora, que é uma exigência comum em escritório.
- **A conferência dos trechos.** Quem confere se a IA citou certo não é outra IA, é uma busca do trecho exato no documento. Um revisor que pode errar do mesmo jeito que o redator não dá segurança.
- **A referência do gabarito.** O rascunho veio do Claude, mas a referência são as datas escritas nos PDFs. O ChatGPT, testado separadamente, encontrou exatamente as mesmas datas.

## Custo e limite de uso

Não gastamos nada com API. O modo com IA foi testado com respostas simuladas, porque ninguém do grupo tinha uma chave, e o modo padrão não usa IA. Pelas nossas contas, cada execução no modo IA manda uns 3 mil caracteres, o que custaria centavos.

## O que faríamos diferente

1. **Testar com o material da demonstração desde o começo.** Nossos primeiros testes usavam frases inventadas e não pegaram nenhum dos erros que a banca ia ver.
2. **Testar o concorrente antes de construir.** Só descobrimos na véspera que o ChatGPT acerta a cronologia tão bem quanto a Acta. Se tivéssemos feito esse teste na fase 1, teríamos focado em sigilo e conferência desde o início.
3. **Medir antes de afirmar.** O gabarito foi o que nos deu um número para defender ("de 9 para 12 eventos"). Teria sido melhor começar por ele.
4. **Conferir o site com o mesmo cuidado do produto.** Revisamos o código com gabarito e testes, mas o site da fase 1 ficou com dados inventados até a véspera da fase 2.
5. **Registrar versões aos poucos.** A primeira versão entrou em três commits no mesmo minuto e perdemos o histórico de como chegamos nela.
