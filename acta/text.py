"""Limpeza e segmentação do texto extraído.

O PDF devolve o texto quebrado em linhas do tamanho da página. Sem tratamento,
uma frase como "contrato ... de 120 equipamentos / eletrônicos até 31 de janeiro"
vira duas, e o cabeçalho repetido em toda página aparece como se fosse conteúdo.
Este módulo reconstrói parágrafos e frases antes de qualquer análise.
"""

import re
import unicodedata
from collections import Counter

PAGE_RE = re.compile(r"^⟦p\. (\d+)⟧$")
PAGE_WORD_RE = re.compile(r"^p[áa]gina\s+\d+(\s+de\s+\d+)?$", re.I)
END_PUNCT = (".", ":", ";", ",", "!", "?", ")", "”", '"')

# Abreviações que terminam em ponto e não encerram a frase.
ABBREVIATIONS = ["Ltda.", "S.A.", "S/A.", "Sr.", "Sra.", "Dr.", "Dra.", "art.", "arts.", "Art.", "p.", "fls.", "nº.", "n.", "Exmo.", "Exma.", "inc.", "Min.", "Rel.", "Des."]
_PROTECT = "\ue000"  # caractere de uso privado: não aparece em texto jurídico (o § aparece)


def normalize(value: str) -> str:
    """Minúsculas e sem acento, para comparar palavras."""
    return "".join(c for c in unicodedata.normalize("NFD", value.lower()) if unicodedata.category(c) != "Mn")


def squash(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def boilerplate_lines(documents: list[dict]) -> set[str]:
    """Linhas que se repetem em dois ou mais documentos: cabeçalhos e rodapés."""
    if len(documents) < 2:
        return set()
    counts = Counter()
    for doc in documents:
        counts.update({line for line in doc["text"].splitlines() if not PAGE_RE.match(line)})
    return {line for line, n in counts.items() if n >= 2}


def is_heading(line: str) -> bool:
    """Título de seção: curto, sem pontuação final e com poucas palavras."""
    words = line.split()
    return len(line) <= 60 and not line.endswith(END_PUNCT) and len(words) <= 6


def is_noise(line: str, boilerplate: set[str]) -> bool:
    if line in boilerplate or PAGE_WORD_RE.match(line):
        return True
    # Cabeçalhos e avisos com separador, como "ACTA · CASO FICTÍCIO" ou
    # "Processo nº ... · 12ª Vara Cível": metadado, não conteúdo.
    if "·" in line and not line.endswith(END_PUNCT):
        return True
    return len(line) <= 2


def paragraphs(text: str, boilerplate: set[str] = frozenset()) -> list[dict]:
    """Parágrafos reconstruídos, cada um com a página e a seção em que aparece."""
    result, buffer, page, section = [], [], 1, ""

    def flush():
        if buffer:
            result.append({"text": squash(" ".join(buffer)), "page": page, "section": section})
            buffer.clear()

    for line in text.splitlines():
        mark = PAGE_RE.match(line)
        if mark:
            flush()
            page = int(mark.group(1))
            continue
        if is_noise(line, boilerplate):
            continue
        if is_heading(line):
            flush()
            section = line
            continue
        buffer.append(line)
        if line.endswith((".", "!", "?", ":")) and len(line) < 70:
            # Linha curta terminada em ponto costuma fechar o parágrafo.
            flush()
    flush()
    return result


def split_sentences(paragraph: str) -> list[str]:
    protected = paragraph
    for abbr in ABBREVIATIONS:
        protected = protected.replace(abbr, abbr.replace(".", _PROTECT))
    parts = re.split(r"(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9“\"(])", protected)
    return [p.replace(_PROTECT, ".").strip() for p in parts if p.strip()]


def sentences(text: str, boilerplate: set[str] = frozenset(), min_len: int = 20) -> list[dict]:
    """Frases completas com página e seção de origem."""
    out = []
    for par in paragraphs(text, boilerplate):
        for sentence in split_sentences(par["text"]):
            if len(sentence) >= min_len:
                out.append({"text": sentence, "page": par["page"], "section": par["section"]})
    return out


def title(text: str, boilerplate: set[str] = frozenset()) -> str:
    """Primeiro título do documento, como "PETIÇÃO INICIAL"."""
    for i, line in enumerate(text.splitlines()):
        if i > 12:
            break
        if PAGE_RE.match(line) or is_noise(line, boilerplate):
            continue
        if is_heading(line) and len(line.split()) >= 2:
            return line
    return ""


def plain(text: str) -> str:
    """Texto sem marcadores de página, para envio e busca de trechos."""
    return "\n".join(line for line in text.splitlines() if not PAGE_RE.match(line))
