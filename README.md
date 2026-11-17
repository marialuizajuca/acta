# acta.

A Acta é para o advogado de contencioso que acabou de receber um processo. Ela transforma as peças em algo que ele consegue usar e conferir: uma cronologia, um relatório para o cliente, uma comparação entre as alegações das partes. Ele escreve o que precisa em português, vê o plano antes de qualquer coisa acontecer e recebe cada informação com o documento e a página de onde ela saiu. No fim, a Acta lista o que ainda precisa ser conferido. A tarefa pode ser salva como skill e usada de novo no próximo caso.

- **Site (funciona de verdade):** [marialuizajuca.github.io/acta](https://marialuizajuca.github.io/acta/)
- **Mesmo site com IA do Claude, sem chave:** [claude.ai/artifact/Sqad48sNr27gpyXKH8EfaA](https://claude.ai/artifact/Sqad48sNr27gpyXKH8EfaA) (pede login no Claude)
- Projeto acadêmico do grupo Actio para a APS de Ciência de Dados Aplicada ao Direito I (Insper, 2026/2). Todos os documentos da pasta `samples/` são fictícios.

## Um exemplo

Mandamos para a Acta a petição inicial, a contestação e a decisão do caso fictício *Aurora Tecnologia × Logística Delta* e pedimos: "Monte a cronologia do caso". Este é um trecho do que voltou:

| Data | Evento | Fonte |
|---|---|---|
| 10/01/2026 | Em 10 de janeiro de 2026, as partes celebraram contrato para transporte e entrega de 120 equipamentos… | 01-peticao-inicial, p. 1 |
| 22/01/2026 a 29/01/2026 *(ano inferido)* | …o atraso decorreu de enchentes que interromperam a rota entre 22 e 29 de janeiro. | 02-contestacao, p. 1 |
| 18/02/2026 | A entrega ocorreu apenas em 18 de fevereiro de 2026. | 01-peticao-inicial, p. 1 |
| 15/06/2026 | Designo audiência de conciliação para 15 de junho de 2026, às 14h. | 03-decisao, p. 1 |

Embaixo da tabela vem a lista do que conferir. Neste caso:

- a data de 18/02/2026 aparece na inicial e na defesa, então vale ver se o fato é incontroverso;
- o prazo de 15 dias para indicar provas não diz quando começa a correr;
- a inicial cita contrato, comprovante e nota de débito que não foram enviados.

No caso trabalhista de exemplo, a Acta mostra que a reclamante diz ter recebido as verbas rescisórias em 28/08/2026 e a empresa diz que pagou em 24/08/2026. É justamente essa diferença que decide se cabe a multa do art. 477 da CLT.

## Perguntas que a banca e a turma fizeram na fase 1

**O que é o "plano"?** Não é uma tese nem um robô agindo sozinho. É a lista do que a Acta vai fazer com os arquivos (ler, limpar o texto, achar datas e prazos, montar a cronologia, listar o que conferir), escrita em português para o advogado aprovar, corrigir ou recusar antes de qualquer execução.

**A Acta protocola ou entra no PJe?** Não. Ela trabalha só com os arquivos enviados. Não acessa sites de tribunal, não envia e-mail e não altera os originais.

**Acompanha prazos?** Encontra os prazos escritos nos documentos e avisa quando falta o termo inicial. Não consulta tribunais nem calcula o vencimento, que depende da intimação.

**E quando depende de interpretação?** Mostra as duas versões, cada uma com a sua fonte, e marca o ponto para conferência. Não escolhe a tese.

**Por que não o ChatGPT, o Claude ou o Harvey?** Testamos o ChatGPT e ele acertou tanto quanto a Acta (veja "Quanto ela acerta"). A diferença está nos dados, que não saem do escritório ou saem com códigos, e na conferência automática das citações. Não testamos o Harvey.

**Por que só contencioso?** A banca sugeriu delimitar o escopo. Começamos pela rotina de entender um processo novo e explicar ao cliente onde ele está.

## O site

O site não é uma maquete. Ele lê os PDFs, DOCX ou TXT que você escolher (ou os casos de exemplo) e processa tudo no próprio navegador, com uma versão em JavaScript do mesmo motor da Acta (`docs/acta-engine.js`). Nada sai do computador no modo padrão.

- **Construir:** escolha os arquivos (PDF, DOCX ou TXT, ou a cópia integral do PJe num PDF só, que a Acta separa peça por peça), a tarefa (cronologia, relatório, comparação, organização, riscos ou uma tarefa livre), responda três perguntas, revise o plano, aprove e veja o resultado com documento e página em cada linha. Baixe em Markdown ou em planilha (.csv), ou copie. Se os arquivos forem de processos diferentes, a Acta avisa.
- **IA de verdade (`docs/acta-ai.js`):** aberto dentro do Claude, o site usa o próprio Claude, sem chave. No GitHub Pages, cole uma chave da Anthropic ou da OpenAI em Configurações; ela fica só no navegador. Antes de enviar, o site mostra a tabela de anonimização e o texto exato que vai sair. Na volta, cada trecho citado pela IA é procurado no documento: o que não for achado aparece como "não localizado".
- **Skills:** salve o resultado como skill. Na próxima vez, clique nela, escolha os arquivos do novo processo e ela roda com o plano já aprovado.
- **Histórico:** registra cada execução feita naquele navegador e o que foi enviado para fora.

## Como funciona

```text
Pedido em português ──► Plano (passos, permissões, critérios de conferência, dúvidas)
                                │  o advogado aprova
                                ▼
        ┌─────────── modo local (padrão) ──────────┐   ┌──────────── modo IA (opcional) ────────────┐
        │ Lê o PDF/DOCX no próprio computador       │   │ 1. Trava de sigilo: nomes, CPF, CNPJ,      │
        │ Reconstrói frases, remove cabeçalhos      │   │    e-mail e nº do processo viram códigos   │
        │ Acha datas, prazos, valores, divergências │   │ 2. Só o texto com códigos vai à IA         │
        │ Nada sai do computador                    │   │ 3. Cada afirmação é conferida no original  │
        └───────────────────────────────────────────┘   │ 4. Os nomes reais voltam no resultado      │
                                │                       └────────────────────────────────────────────┘
                                ▼
         Resultado com fonte e página ─► O que conferir ─► Baixar ─► Salvar como skill
```

### As peças do produto

| Peça | Na Acta | Onde está no código |
|---|---|---|
| Instruções de sistema | Regras fixas: só usar os documentos, citar trecho literal, não inventar lei nem jurisprudência, não decidir pelo advogado. O escritório acrescenta preferências, mas não desliga as regras. | `acta/prompts.py` |
| Skills | Cinco prontas (relatório ao cliente, cronologia, comparação, organização, riscos) e as que o advogado salva. | `acta/skills.py`, `skills/` |
| Modo de planejamento | Nada roda antes da aprovação. No modo IA, o plano pode trazer perguntas ao advogado. | `acta/assistant.py` (`plan`), `acta/analyze.py` (`build_plan`) |
| Permissões | Ler: sim, se autorizado. Editar originais, protocolar, enviar e-mail: nunca. Enviar à IA: só com a caixa marcada, e só texto anonimizado. | `app.py` (`/api/analyze`) |
| Verificações automáticas | Anonimização antes de todo envio; conferência de cada trecho citado; alerta de data fora do trecho. | `acta/anonymize.py`, `acta/assistant.py` (`verify`) |

## Quanto ela acerta

Comparamos a cronologia com um gabarito montado a partir da leitura das peças (`avaliacao/gabarito.json`), em dois casos fictícios: um cível e um trabalhista. Para reproduzir: `python avaliacao/avaliar.py`.

| | Versão anterior (3 commits iniciais) | Versão atual, modo local |
|---|---|---|
| Eventos do gabarito encontrados | 9 de 12 | **12 de 12** |
| Eventos cortados no meio da frase | 4 de 15 | **0** |
| Documentos classificados errado | 3 de 6 | **0** |
| Divergência de datas do pagamento (caso trabalhista) | não detectada | **detectada** |

Uma ressalva: são dois casos pequenos, e ajustamos as regras depois de olhar para eles. O resultado mostra que corrigimos os erros que encontramos, não que a Acta acerta em qualquer processo. O próximo passo é testar com uma decisão real e pública.

**E o ChatGPT?** Testamos. Com os mesmos PDFs e o mesmo pedido, ele também achou todos os eventos dos dois casos e viu a divergência de datas. Em acerto, empata. O que a Acta oferece de diferente é outra coisa: o nome do cliente, o CPF e o número do processo não saem do escritório (ou saem só como códigos), o próprio sistema confere se cada trecho citado existe, nada entra de fora dos autos e a tarefa fica salva como skill. Os números estão em [`avaliacao/comparacao-chatgpt.md`](avaliacao/comparacao-chatgpt.md).

Quando houver uma chave de API, o modo IA pode ser medido do mesmo jeito, com `python avaliacao/avaliar.py --ia`.

## Como instalar e rodar

Requisitos: Python 3.11 ou mais recente e Git.

```bash
git clone https://github.com/marialuizajuca/acta.git
cd acta
python -m venv .venv
```

No Windows:

```bash
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --reload
```

No macOS ou Linux:

```bash
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload
```

Abra `http://127.0.0.1:8000`. Funciona assim, no **modo local**, sem nenhuma chave.

### Ligar o modo IA (opcional)

1. Copie `.env.example` para `.env`.
2. Preencha **uma** das chaves: `OPENAI_API_KEY` ou `ANTHROPIC_API_KEY`.
3. Reinicie o servidor. O selo no alto da tela muda para "IA conectada".

O `.env` está no `.gitignore` e nunca vai para o GitHub. Uma execução nos casos de exemplo envia cerca de 3 mil caracteres e custa centavos.

## Demonstração (3 minutos)

1. Clique em **Cronologia processual** e depois em **Usar o caso de exemplo (Aurora × Delta)**.
2. **Gerar plano** → mostre os passos e as permissões. Com IA, marque "Enviar à IA" e mostre a tabela **O que sai do computador**.
3. **Aprovar e executar** → mostre a fonte com página, o intervalo das enchentes e a lista **O que você ainda precisa conferir**.
4. **Salvar como skill** → ela aparece em "Minhas skills".
5. Clique na skill **Preparação para audiência**, selecione os arquivos `04`, `05` e `06` da pasta `samples` e rode. A lista do que conferir mostra a divergência sobre a data do pagamento.

## Testes

```bash
python -m pytest -q
```

São 21 testes. Eles cobrem as correções no caso de exemplo, a trava de sigilo, a conferência de trechos (com a IA substituída por uma resposta fixa, sem custo), as permissões e as skills salvas.

## Estrutura

```text
acta/
├── acta/
│   ├── extract.py      # PDF, DOCX, TXT e MD → texto, com marcador de página
│   ├── text.py         # remove cabeçalhos repetidos e reconstrói frases quebradas
│   ├── analyze.py      # modo local: datas, prazos, valores, divergências, cinco skills
│   ├── anonymize.py    # trava de sigilo antes de qualquer envio
│   ├── prompts.py      # instruções de sistema da Acta
│   ├── llm.py          # conexão com OpenAI ou Anthropic (biblioteca padrão, sem SDK)
│   ├── assistant.py    # modo IA: plano, execução e conferência dos trechos
│   └── skills.py       # salvar e reaproveitar skills
├── skills/             # skills salvas (JSON legível)
├── static/             # interface web
├── samples/            # dois casos fictícios, três peças cada
├── avaliacao/          # gabarito, script de avaliação e teste contra o ChatGPT
├── docs/               # site do produto (GitHub Pages)
├── tests/
├── app.py              # servidor FastAPI
├── relatorio-uso-ia.md
├── AGENTS.md           # instruções para os assistentes de código usados no projeto
└── LICENSE
```

## O que a Acta não faz, de propósito

- **Não protocola, não envia e-mail e não altera os originais.** Quem age é o advogado.
- **Não dá parecer nem escolhe tese.** Organiza o que está nos autos e aponta o que conferir.
- **Não busca jurisprudência.** Uma fonte de fora sem conferência é justamente o erro que queremos evitar. Isso fica para uma versão ligada a uma base oficial.

## Limitações conhecidas

- O modo IA ainda não foi testado com uma chave de verdade, só com respostas simuladas nos testes automáticos.
- PDFs digitalizados como imagem precisam de OCR, que ainda não existe.
- O modo local usa regras: uma data escrita de forma incomum (por exemplo, "no quinto dia útil do mês seguinte") não é encontrada.
- A anonimização reconhece padrões (CPF, CNPJ, e-mail, telefone, empresas com Ltda./S.A., nomes depois de "Autor:", "Ré:", "Sr." etc.). Um nome solto no texto, sem nenhum desses sinais, pode escapar. Por isso o advogado vê a lista do que será trocado e o texto exato que será enviado, antes de aprovar.
- Não há login, banco de dados nem separação por escritório. As skills ficam em arquivos na pasta `skills/`.

## Segurança

- **Modo local:** os arquivos são lidos na memória durante a requisição, não são gravados e não saem do computador.
- **Modo IA:** antes do envio, os dados identificáveis viram códigos. A tabela que liga cada código ao dado real fica só na memória do servidor local. O provedor de IA recebe apenas o texto com códigos.
- **Para uso profissional, ainda faltam:** login, registro de auditoria de quem enviou o quê, política de retenção e um contrato com o provedor de IA que proíba o uso dos dados para treino.

## Licença

Código proprietário para fins acadêmicos. Consulte o arquivo `LICENSE`.
