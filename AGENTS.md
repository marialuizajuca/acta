# Instruções para assistentes de código (Codex, Claude Code e outros)

Leia este arquivo antes de alterar o projeto. Responda e escreva comentários em português.

## O produto
A Acta ajuda advogados a transformar documentos de um caso em um resultado conferível
(cronologia, relatório ao cliente, comparação, organização, riscos), com plano aprovado
antes da execução, fonte com página para cada informação e skills reutilizáveis.

## Regras do produto, que nenhuma mudança pode quebrar
- Nada é executado antes da aprovação do plano.
- Nenhum texto sai do computador sem a permissão "Enviar à IA" marcada.
- Todo envio à IA passa antes por `acta/anonymize.py`. Nunca chame `llm.complete_json`
  com texto que não passou pela anonimização.
- Toda afirmação do resultado indica arquivo e página. No modo IA, toda afirmação passa
  por `assistant.verify` antes de chegar ao advogado.
- A Acta não edita os originais, não protocola e não envia e-mail.
- O modo local deve continuar funcionando sem internet e sem chave.

## Regras do repositório
- Nunca adicione chaves, credenciais (`.env`) ou documentos jurídicos reais. Use só os
  casos fictícios de `samples/`.
- Rode `python -m pytest -q` antes de registrar uma versão. Toda correção ganha um teste.
- Se mudar a análise, rode `python avaliacao/avaliar.py` e atualize a tabela do README
  com o número novo, mesmo que ele piore.
- Mensagens de commit em português, no imperativo, dizendo o que mudou
  ("Corrige frases cortadas na cronologia").
- Preserve a identidade visual minimalista da Acta.
