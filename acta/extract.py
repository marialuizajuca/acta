from io import BytesIO
from pathlib import Path

from docx import Document
from pypdf import PdfReader


SUPPORTED = {".pdf", ".docx", ".txt", ".md"}

# Marcador de página inserido entre as páginas do PDF. Permite que a cronologia
# e a conferência de fontes indiquem "p. 2", e não só o nome do arquivo.
PAGE_MARK = "⟦p. {n}⟧"


def extract_pages(filename: str, content: bytes) -> list[str]:
    """Devolve o texto de cada página do documento, já sem linhas vazias."""
    suffix = Path(filename).suffix.lower()
    if suffix not in SUPPORTED:
        raise ValueError(f"Formato não suportado: {suffix or 'sem extensão'}. Use PDF, DOCX, TXT ou MD.")

    if suffix == ".pdf":
        reader = PdfReader(BytesIO(content))
        pages = [(page.extract_text() or "") for page in reader.pages]
    elif suffix == ".docx":
        doc = Document(BytesIO(content))
        pages = ["\n".join(p.text for p in doc.paragraphs)]
    else:
        pages = [content.decode("utf-8", errors="replace")]

    cleaned = ["\n".join(line.strip() for line in page.splitlines() if line.strip()) for page in pages]
    if not any(cleaned):
        raise ValueError(
            f"Não foi possível extrair texto de {filename}. Se for um PDF digitalizado (imagem), ele precisa de OCR."
        )
    return cleaned


def extract_upload(filename: str, content: bytes) -> str:
    """Texto do documento inteiro, com um marcador no início de cada página."""
    pages = extract_pages(filename, content)
    return "\n".join(f"{PAGE_MARK.format(n=i)}\n{text}" for i, text in enumerate(pages, start=1) if text)
