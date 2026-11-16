# Relatório de uso de IA e de outras ferramentas: fase 2

> **Para o grupo, antes de entregar:** os trechos marcados com **[PREENCHER]** só vocês podem
> escrever, porque dependem do que vocês viveram. Apaguem esta caixa e as marcações no fim.
> O que já está escrito vem do registro do trabalho. Confiram se está correto.

## 1. O que queríamos fazer

A Acta é um assistente para o advogado transformar os documentos de um caso em um resultado
conferível, com plano aprovado antes da execução, fonte com página para cada informação e
tarefas que viram skills reutilizáveis. Na fase 2, o desafio era construir o produto que
vendemos na fase 1: código funcionando num repositório público, com README, licença e este
relatório.

## 2. Ferramentas: o que testamos e o que ficou

**Codex, para a primeira versão do código.** Pedimos ao Codex a estrutura do repositório, o
servidor, a interface e os testes. Ele entregou uma aplicação que abria no navegador, lia PDF
e DOCX e tinha as cinco skills do pitch. **[PREENCHER: por que o Codex (conta do Insper?
custo? facilidade?), o pedido inicial que vocês fizeram e o que precisaram corrigir à mão.]**

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
avaliação. **[PREENCHER: o que vocês revisaram, mudaram ou recusaram nessas entregas.]**

**[PREENCHER: outras ferramentas que vocês testaram e descartaram na fase 2, por exemplo
para a interface ou para os PDFs de exemplo, e o motivo.]**

## 3. O que deu errado e o que fizemos

| O que tentamos | O que aconteceu | O que decidimos |
|---|---|---|
| Cronologia por linha do PDF | O PDF quebra a frase no fim da linha, e a cronologia saía com eventos cortados | Reconstruir os parágrafos antes de procurar datas, removendo cabeçalhos repetidos entre os documentos |
| Classificar o documento pela primeira palavra-chave encontrada | A decisão citava a contestação e virava "Defesa" | Classificar pelo nome do arquivo e pelo título, com "decisão" antes de "contestação" |
| Medir o acerto só com os testes | Os testes passavam e a demonstração tinha erros | Criar um gabarito para dois casos e medir a cobertura: de 9 para 12 eventos, de 12 |
| Ver se a Acta funcionava fora do caso Aurora × Delta | Num caso trabalhista novo, a versão anterior classificou a reclamação como "Contrato" e a ata como "Documento geral" | Incluir esses tipos e manter o caso trabalhista como segundo exemplo e teste |

**O limite que assumimos:** as regras foram ajustadas depois de olharmos para os dois casos.
Os 12 de 12 provam que corrigimos os erros encontrados, e não que a Acta acerta em qualquer
processo. **[PREENCHER: o resultado do teste com uma decisão real e pública, se der tempo.]**

**Teste contra o ChatGPT.** **[PREENCHER com os números de `avaliacao/comparacao-chatgpt.md`:
quantos eventos o ChatGPT encontrou, se inventou alguma data, se indicou página, se viu a
divergência entre 24/08 e 28/08 no caso trabalhista.]**

## 4. Onde decidimos não usar IA

- **A cronologia no modo local.** Datas e prazos estão escritos nos documentos, e uma regra
  que os encontra é verificável linha por linha. Com isso, o advogado pode usar a Acta sem
  enviar nada para fora, que é a condição de muitos escritórios.
- **A conferência dos trechos.** Quem confere se a IA citou certo não é outra IA: é uma busca
  literal do trecho no documento original. Um revisor que pode errar da mesma forma que o
  redator não dá segurança ao advogado.
- **[PREENCHER: uma parte em que vocês decidiram fazer sem IA, e por quê. Um bom candidato é
  a conferência do gabarito: o rascunho veio do Claude, e quem confirmou cada data lendo as
  peças foram vocês. Se não fizeram essa conferência, façam antes de entregar.]**

## 5. Custo e limite de uso

**[PREENCHER só se afetou o trabalho: limite de mensagens do Codex ou do Claude, créditos de
API, ou "não houve custo".]** O modo IA, nos casos de exemplo, envia cerca de 3 mil caracteres
por execução, o que custa centavos.

## 6. O que faríamos diferente

1. **Testar com o material da demonstração desde o primeiro dia.** Os testes da primeira versão
   passavam com frases inventadas e não pegaram nenhum dos erros que a banca veria.
2. **Medir antes de afirmar.** O gabarito trouxe o único número que podemos defender
   ("de 9 para 12 eventos"). Teríamos começado por ele, antes de escrever código.
3. **Registrar versões a cada passo.** A primeira versão entrou em três commits no mesmo minuto,
   e perdemos o histórico de como chegamos a ela. **[PREENCHER: confirmar ou ajustar.]**
