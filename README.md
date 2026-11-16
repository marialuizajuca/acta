# acta.

Assistente configurável para advogados construírem saídas jurídicas a partir de documentos, sem programar.

## O que funciona nesta versão

1. Upload de arquivos PDF, DOCX, TXT e Markdown.
2. Extração real do texto dos documentos.
3. Plano de execução apresentado antes da análise.
4. Controle das permissões de leitura e envio externo.
5. Cinco skills: relatório ao cliente, cronologia, comparação de alegações, organização documental e mapa de riscos.
6. Identificação das fontes utilizadas.
7. Download do resultado em Markdown.

O processamento é local e determinístico. Nenhum arquivo é enviado a uma API externa. A ferramenta não substitui a revisão do advogado.

## Como instalar

Requisitos: Python 3.11 ou mais recente e Git.

```bash
git clone https://github.com/Mluiza25/acta.git
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

Abra `http://127.0.0.1:8000` no navegador.

## Demonstração recomendada

1. Abra a Acta.
2. Selecione **Relatório ao cliente**.
3. Envie os três PDFs da pasta `samples/`.
4. Gere e aprove o plano.
5. Execute a análise e baixe o resultado.
6. Repita com **Cronologia processual** e **Comparar alegações**.

## Estrutura

```text
acta/
├── acta/                 # extração e análise dos documentos
├── static/               # interface web
├── samples/              # documentos fictícios para a banca
├── tests/                # testes automatizados
├── app.py                # servidor FastAPI
├── relatorio-uso-ia.md   # registro do uso de IA
├── requirements.txt
└── LICENSE
```

## Limitações

- PDFs digitalizados como imagem precisam de OCR, ainda não implementado.
- A análise atual utiliza regras locais e não formula parecer jurídico.
- Informações, datas e valores devem ser conferidos nos documentos originais.
- Não há autenticação, banco de dados ou armazenamento permanente.

## Segurança

Os arquivos são processados em memória durante a requisição, não são gravados pelo servidor e não são enviados para serviços externos. Para uso profissional, ainda seriam necessários autenticação, criptografia, auditoria e política de retenção.

## Licença

Código proprietário para fins acadêmicos. Consulte o arquivo `LICENSE`.

