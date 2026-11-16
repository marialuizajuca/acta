# Relatório de uso de IA e de outras ferramentas: fase 2

## 1. O que queríamos fazer

A Acta é um assistente para o advogado transformar os documentos de um caso em um resultado
conferível, com plano aprovado antes da execução, fonte com página para cada informação e
tarefas que viram skills reutilizáveis. Na fase 2, o desafio era construir o produto que
vendemos na fase 1: código funcionando num repositório público, com README, licença e este
relatório.

## 2. Ferramentas: o que testamos e o que ficou

**Codex, para a primeira versão do código.** Pedimos ao Codex a estrutura do repositório, o
servidor, a interface e os testes. Ele entregou uma aplicação que abria no navegador, lia PDF
e DOCX e tinha as cinco skills do pitch.

**Claude, para revisar o conceito e o código.** Já na fase 1, a primeira leitura do enunciado
feita pelo Codex transformou a Acta numa plataforma fechada de análise de contratos. O Claude
apontou que o enunciado pedia um assistente que permitisse ao advogado construir as próprias
ferramentas, e mudamos a proposta.

Na fase 2, pedimos ao Claude uma revisão da versão do Codex antes da entrega. Ele rodou a
aplicação com as três peças do caso Aurora × Delta e mostrou problemas que não tínhamos visto:

- a cronologia tinha eventos cortados no meio da frase ("eletrônicos até 31 de janeiro de 2026.");
- faltavam as enchentes de 22 a 29 de janeiro, o argumento central da defesa;
- a decisão era classificada como "Defesa", porque o texto dela menciona a contestação;
- a comparação de alegações mostrava o cabeçalho do PDF ("ACTA · CASO ACADÊMICO FICTÍCIO") como se fosse alegação.

Os quatro testes automáticos da primeira versão passavam. Eles usavam frases curtas
escritas à mão, e não os PDFs do caso. **A lição: o teste precisa usar o mesmo material
da demonstração.** Os testes novos (21) rodam sobre os PDFs de `samples/`.

**A decisão sobre IA no produto.** A primeira versão não usava nenhum modelo de linguagem:
eram regras fixas sobre o texto. Isso protegia o sigilo, mas não era o produto do pitch, em
que o advogado descreve a tarefa e a IA monta o plano. Mantivemos as regras como modo local,
que é o padrão e funciona sem internet, e pedimos ao Claude que implementasse o modo IA com
duas travas: a anonimização antes do envio e a conferência de cada trecho citado depois da
resposta. Sem chave, ou sem a permissão marcada, nada sai do computador. Também foi o Claude
que escreveu o segundo caso fictício (trabalhista), o rascunho do gabarito e o script de
avaliação. Conferimos essas entregas rodando a aplicação e os testes e comparando o resultado com os PDFs.

## 3. O que deu errado e o que fizemos

| O que tentamos | O que aconteceu | O que decidimos |
|---|---|---|
| Cronologia por linha do PDF | O PDF quebra a frase no fim da linha, e a cronologia saía com eventos cortados | Reconstruir os parágrafos antes de procurar datas, removendo cabeçalhos repetidos entre os documentos |
| Classificar o documento pela primeira palavra-chave encontrada | A decisão citava a contestação e virava "Defesa" | Classificar pelo nome do arquivo e pelo título, com "decisão" antes de "contestação" |
| Medir o acerto só com os testes | Os testes passavam e a demonstração tinha erros | Criar um gabarito para dois casos e medir a cobertura: de 9 para 12 eventos, de 12 |
| Ver se a Acta funcionava fora do caso Aurora × Delta | Num caso trabalhista novo, a versão anterior classificou a reclamação como "Contrato" e a ata como "Documento geral" | Incluir esses tipos e manter o caso trabalhista como segundo exemplo e teste |

**O limite que assumimos:** as regras foram ajustadas depois de olharmos para os dois casos.
Os 12 de 12 provam que corrigimos os erros encontrados, e não que a Acta acerta em qualquer
processo. O próximo passo é repetir a avaliação com uma decisão real e pública.

**Teste contra o ChatGPT.** Fizemos a mesma tarefa no ChatGPT comum, com os mesmos PDFs e o
mesmo gabarito. Esperávamos que ele errasse datas. Não errou: encontrou 5 de 5 e 7 de 7 eventos,
indicou página, copiou os trechos certos, viu a divergência entre 24/08 e 28/08 e ainda calculou
os vencimentos dos prazos, de primeira. Em acerto, empatou com a Acta. Em riqueza da resposta,
foi melhor.

Isso mudou o nosso argumento. Deixamos de dizer que a Acta "acerta mais" e passamos a dizer
o que ela garante e o ChatGPT não: (1) os nomes das partes, o CPF e o número do processo não
saem do escritório, ou saem só como códigos; (2) a conferência de que cada trecho existe é feita
pelo sistema, e não depende de o advogado reler tudo; (3) a resposta usa só os documentos. No
caso trabalhista, o ChatGPT justificou um feriado de 2026 com uma portaria de 2025 buscada na
internet: é o tipo de detalhe que passa despercebido. E o mesmo pedido vira uma skill, que roda
igual da próxima vez. Detalhes em `avaliacao/comparacao-chatgpt.md`.

## 4. Onde decidimos não usar IA

- **A cronologia no modo local.** Datas e prazos estão escritos nos documentos, e uma regra
  que os encontra é verificável linha por linha. Com isso, o advogado pode usar a Acta sem
  enviar nada para fora, que é a condição de muitos escritórios.
- **A conferência dos trechos.** Quem confere se a IA citou certo não é outra IA: é uma busca
  literal do trecho no documento original. Um revisor que pode errar da mesma forma que o
  redator não dá segurança ao advogado.
- **A confirmação do gabarito.** O gabarito foi rascunhado com o Claude. Para não medir a
  IA contra ela mesma, a referência final são as datas escritas nos PDFs, e o teste com o
  ChatGPT, feito de forma independente, encontrou exatamente as mesmas datas.

## 5. Custo e limite de uso

Não houve gasto com API: o modo IA foi testado com respostas simuladas, e o modo local não usa IA. O modo IA, nos casos de exemplo, envia cerca de 3 mil caracteres
por execução, o que custa centavos.

## 6. O que faríamos diferente

1. **Testar com o material da demonstração desde o primeiro dia.** Os testes da primeira versão
   passavam com frases inventadas e não pegaram nenhum dos erros que a banca veria.
2. **Medir antes de afirmar.** O gabarito trouxe o único número que podemos defender
   ("de 9 para 12 eventos"). Teríamos começado por ele, antes de escrever código.
3. **Testar o concorrente antes de construir.** Descobrimos na véspera que o ChatGPT acerta a
   cronologia tão bem quanto a Acta. Se tivéssemos feito esse teste na fase 1, teríamos focado
   desde o início em sigilo e conferência, que é onde o produto se diferencia.
4. **Registrar versões a cada passo.** A primeira versão entrou em três commits no mesmo minuto,
   e perdemos o histórico de como chegamos a ela.
