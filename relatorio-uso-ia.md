# Relatório de uso de IA e outras ferramentas

## 1. Visão geral

A Acta foi desenvolvida na fase 2 como um produto funcional. O advogado envia documentos, escolhe uma skill, revisa um plano e autoriza a execução. A aplicação extrai o texto dos arquivos e produz resultados que podem ser conferidos e baixados.

## 2. Ferramentas utilizadas

### ChatGPT com Codex

Foi utilizado para interpretar o enunciado, estruturar o repositório, escrever o código, criar os testes, produzir a documentação e revisar o funcionamento. Na fase 1, a primeira interpretação transformou a Acta em uma plataforma fechada de análise de contratos, o que estava incorreto.

### Claude

Foi utilizado para revisar o conceito da fase 1. O Claude identificou com mais clareza que o enunciado exigia um assistente configurável, capaz de permitir que o advogado criasse ferramentas, e não apenas um analisador de contratos pronto.

### FastAPI, pypdf e python-docx

FastAPI fornece o servidor web. `pypdf` extrai texto de PDFs e `python-docx` extrai texto de documentos Word. A interface foi construída com HTML, CSS e JavaScript.

## 3. Comparação observada

O Claude foi preferido na auditoria conceitual porque identificou o desalinhamento da primeira proposta. O Codex foi preferido na implementação, pois produziu e revisou o código, os arquivos do repositório e a interface funcional. A decisão final sobre o que manter continuou com o grupo.

## 4. Exemplos de solicitações feitas à IA

- Revisar se o produto atende ao conceito de assistente de programação por IA.
- Criar um fluxo com prompt de sistema, skills, planejamento e permissões.
- Implementar extração de texto de PDF e DOCX.
- Identificar datas e relacionar eventos aos arquivos de origem.
- Produzir um README que permita instalar e rodar o projeto.
- Criar testes para as funções de análise.

## 5. Participação humana

O grupo definiu o problema, aprovou a reformulação, escolheu as funções da versão mínima e conferiu os resultados. A IA escreveu partes do código e da documentação, mas o grupo permaneceu responsável pelas decisões, pela demonstração e pela validação final.

## 6. Limitações e transparência

A aplicação não formula parecer jurídico e não substitui o advogado. A análise utiliza regras locais de classificação, busca de datas, valores e trechos relevantes. PDFs digitalizados como imagem não são processados sem OCR. Todos os resultados exigem conferência humana.

## 7. Próximos passos

- Integrar um modelo de linguagem com credenciais protegidas.
- Implementar OCR para documentos digitalizados.
- Criar autenticação e espaços separados por escritório.
- Salvar, editar e versionar skills.
- Adicionar logs de auditoria e políticas de retenção.
- Avaliar precisão com documentos jurídicos anonimizados.

