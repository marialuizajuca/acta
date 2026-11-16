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
| Aurora × Delta | ChatGPT | _/5 | | | | — |
| Aurora × Delta | Acta (local) | 5/5 | 0 | 0 | 0 | — |
| Marina × Pão Dourado | ChatGPT | _/7 | | | | |
| Marina × Pão Dourado | Acta (local) | 7/7 | 0 | 0 | 0 | sim |

Preencha as linhas do ChatGPT com o que vocês observarem. Não ajuste os números: se o
ChatGPT for melhor em algo, isso entra no relatório como aprendizado.

Outra diferença, que não aparece na tabela: no ChatGPT, os nomes das partes e o número do
processo vão para fora do escritório como estão. Na Acta, ou nada sai (modo local), ou sai só
o texto com os dados trocados por códigos (modo IA).
