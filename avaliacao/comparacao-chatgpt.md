# Teste lado a lado: Acta × ChatGPT

O objetivo é responder à pergunta da banca: "por que não usar o ChatGPT?". O teste usa a
mesma tarefa, os mesmos documentos e o gabarito de `gabarito.json`.

## Como fazer (20 minutos)

1. Abra o ChatGPT comum, numa conversa nova.
2. Envie os três PDFs do caso (`samples/01…`, `02…`, `03…`) e cole o pedido abaixo.
3. Conte, comparando com o gabarito:
   - quantos dos eventos do gabarito apareceram;
   - quantas datas erradas ou inventadas apareceram;
   - quantas informações vieram sem indicar documento e página;
   - quantas vezes foi preciso pedir de novo ("reformule", "faltou X").
4. Repita com o caso trabalhista (`04…`, `05…`, `06…`).
5. Faça o mesmo na Acta e preencha a tabela.

## Pedido usado nas duas ferramentas

> Monte a cronologia deste processo com todas as datas e prazos. Para cada item, indique o
> documento e a página de onde veio e copie o trecho que comprova. Ao final, liste o que eu
> ainda preciso conferir.

## Resultado

| Caso | Ferramenta | Eventos do gabarito encontrados | Datas erradas ou inventadas | Itens sem fonte | Pedidos repetidos | Viu a divergência de datas do pagamento? |
|---|---|---|---|---|---|---|
| Aurora × Delta | ChatGPT | 5/5 | 0 | 0 | 0 | — |
| Aurora × Delta | Acta (local) | 5/5 | 0 | 0 | 0 | — |
| Marina × Pão Dourado | ChatGPT | 7/7 | 0 | 0 | 0 | sim |
| Marina × Pão Dourado | Acta (local) | 7/7 | 0 | 0 | 0 | sim |

Teste feito em 16/11/2026, com o ChatGPT comum, uma conversa nova para cada caso, os três PDFs
anexados e o pedido acima. Ele respondeu de primeira nos dois casos.

## O que observamos

- **Empate em acerto.** O ChatGPT encontrou todos os eventos dos dois gabaritos, não inventou
  datas, indicou página e copiou os trechos corretamente.
- **O ChatGPT foi além da Acta** em três pontos: separou alegação de fato comprovado, escreveu
  pendências mais completas e, no caso trabalhista, calculou os vencimentos dos prazos (art. 477
  e oito dias úteis), deixando claro que eram cálculos condicionais.
- **Um ponto a conferir no ChatGPT:** para justificar um feriado de outubro de 2026 no TRT-2, ele
  citou uma portaria de 2025, buscada na internet. A conclusão pode até estar certa, mas a fonte
  é de outro ano, e só um advogado atento percebe. Na Acta, nenhuma informação vem de fora dos
  documentos enviados.
- **O que a tabela não mostra:** o ChatGPT recebeu os nomes das partes, o CPF e o e-mail da
  reclamante e o número do processo, como estavam. A conferência de que cada trecho existe
  ficou por conta de quem leu a resposta.

Outra diferença, que não aparece na tabela: no ChatGPT, os nomes das partes e o número do
processo vão para fora do escritório como estão. Na Acta, ou nada sai (modo local), ou sai só
o texto com os dados trocados por códigos (modo IA).
