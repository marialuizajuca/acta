"""Trava de sigilo: troca dados identificáveis por códigos antes do envio à IA.

Roda sempre, automaticamente, antes de qualquer texto sair do computador. O
advogado não precisa lembrar de acioná-la. A tabela que liga cada código ao
dado real fica só na memória do servidor local e serve para devolver os
nomes verdadeiros no resultado.

Limite conhecido: a detecção é por padrões (CPF, CNPJ, e-mail, telefone,
empresas com Ltda./S.A., nomes depois de "Autor:", "Ré:", "Sr." etc.). Um
nome solto no meio do texto, sem nenhum desses sinais, pode escapar. Por isso
o advogado vê a lista do que foi trocado e uma prévia do que será enviado.
"""

import re
from dataclasses import dataclass, field

UPPER = "A-ZÁÉÍÓÚÂÊÔÃÕÇ"
WORD = rf"[{UPPER}][\wÀ-ÿ&'-]+"
CONNECT = r"(?:\s+(?:da|de|do|das|dos|e)\s+|\s+)"

PATTERNS = [
    ("CPF", re.compile(r"\b\d{3}\.\d{3}\.\d{3}-\d{2}\b")),
    ("CNPJ", re.compile(r"\b\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}\b")),
    ("EMAIL", re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")),
    ("TELEFONE", re.compile(r"(?<!\d)\(?\d{2}\)?\s?9?\d{4}-\d{4}\b")),
    ("OAB", re.compile(r"\bOAB/?[A-Z]{2}\s*n?º?\s*[\d.]+\b")),
    ("PROCESSO", re.compile(r"\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b")),
]

COMPANY = re.compile(rf"\b({WORD}(?:\s+{WORD}){{0,5}})\s+(Ltda\.?|S\.A\.?|S/A|EIRELI|EPP|ME)(?=[\s,.;)]|$)")
ROLE = re.compile(
    rf"\b(?:Autora?|Réu?|Ré|Requerente|Requerid[oa]|Reclamante|Reclamad[oa]|Exequente|Executad[oa]|"
    rf"Apelante|Apelad[oa]|Agravante|Agravad[oa]|Testemunha|Cliente|Advogad[oa])\s*:\s*({WORD}(?:{CONNECT}{WORD}){{0,5}})"
)
TITLE = re.compile(rf"\b(?:Sr\.|Sra\.|Dr\.|Dra\.|senhora?)\s+({WORD}(?:{CONNECT}{WORD}){{0,4}})")

# Palavras genéricas que não identificam ninguém sozinhas: "Logística" não
# deve virar código, mas "Delta" sim.
GENERIC = {
    "tecnologia", "logística", "logistica", "comércio", "comercio", "serviços", "servicos", "indústria",
    "industria", "banco", "companhia", "empresa", "sociedade", "grupo", "brasil", "brasileira", "transportes",
    "construtora", "engenharia", "educacional", "participações", "participacoes", "holding", "consultoria",
    "administradora", "seguros", "telecom", "energia", "saúde", "saude", "distribuidora", "alimentos",
    "the", "and", "nacional", "geral", "digital", "solutions", "soluções", "solucoes", "global",
}


@dataclass
class Anonymized:
    texts: list[str]
    mapping: dict[str, str] = field(default_factory=dict)   # código -> dado real
    found: list[dict] = field(default_factory=list)          # para mostrar ao advogado

    def restore(self, value):
        """Devolve os dados reais em qualquer estrutura (texto, lista, dicionário)."""
        if isinstance(value, str):
            for code in sorted(self.mapping, key=len, reverse=True):
                value = value.replace(code, self.mapping[code])
            return value
        if isinstance(value, list):
            return [self.restore(v) for v in value]
        if isinstance(value, dict):
            return {k: self.restore(v) for k, v in value.items()}
        return value


def _company_aliases(full: str, base: str) -> list[str]:
    aliases = [full, base]
    tokens = [t for t in base.split() if t.lower() not in GENERIC and len(t) >= 4]
    aliases += tokens
    return aliases


def anonymize(texts: list[str]) -> Anonymized:
    joined = "\n".join(texts)
    replacements: dict[str, str] = {}   # dado real -> código
    found: list[dict] = []
    counters: dict[str, int] = {}

    def code_for(kind: str, value: str, aliases: list[str] | None = None) -> str:
        value = value.strip()
        if value in replacements:
            return replacements[value]
        counters[kind] = counters.get(kind, 0) + 1
        code = f"[{kind}_{counters[kind]}]"
        for alias in aliases or [value]:
            replacements.setdefault(alias.strip(), code)
        found.append({"code": code, "kind": kind, "value": value})
        return code

    for kind, pattern in PATTERNS:
        for m in pattern.finditer(joined):
            code_for(kind, m.group(0))
    for m in COMPANY.finditer(joined):
        full, base = m.group(0), m.group(1)
        code_for("PARTE", full, _company_aliases(full, base))
    def already_covered(name: str) -> bool:
        return any(name in known or known in name for known in replacements if len(known) >= 4)

    for pattern in (ROLE, TITLE):
        for m in pattern.finditer(joined):
            name = m.group(1)
            if not already_covered(name):
                code_for("PESSOA", name)

    # Troca o mais longo primeiro: "Aurora Tecnologia Ltda." antes de "Aurora".
    ordered = sorted(replacements, key=len, reverse=True)
    out = []
    for text in texts:
        for value in ordered:
            if re.match(r"\w", value):
                text = re.sub(rf"(?<![\w]){re.escape(value)}(?![\w])", replacements[value], text)
            else:
                text = text.replace(value, replacements[value])
        out.append(text)

    mapping = {}
    for value, code in replacements.items():
        # O dado devolvido no resultado é sempre a forma completa.
        mapping.setdefault(code, next(f["value"] for f in found if f["code"] == code))
    for item in found:
        item["occurrences"] = sum(t.count(item["code"]) for t in out)
    return Anonymized(texts=out, mapping=mapping, found=found)
