"""Render reviewed Chinese paragraphs in the unchanged English HTML structure.

The alignment file is private editorial source, not a browser asset. Hash checks
require a fresh review when the English master changes. Math and full artwork
are immutable placeholders; translations cannot silently drop either.
"""
import collections
import hashlib
import html as escape_html
import json
import re
from pathlib import Path
from lxml import etree, html

SITE = Path(__file__).resolve().parents[1]
alignment = json.loads((SITE / 'scripts/example-parity-alignment.json').read_text(encoding='utf-8'))
translations = {}
for line in (SITE / 'scripts/example-parity-translations.tsv').read_text(encoding='utf-8-sig').splitlines():
    key, value = line.split('|', 1)
    assert key not in translations, f'Duplicate translation: {key}'
    translations[key] = value
result = {}
for question_id, fields in alignment.items():
    code = question_id.split('-')[1]
    original = json.loads((SITE / f'assets/textbook-examples/eng/{code}.json').read_text(encoding='utf-8'))[question_id]
    result[question_id] = {}
    for field, reviewed in fields.items():
        source = original[field]
        assert hashlib.sha256(source.encode()).hexdigest() == reviewed['sourceSha256'], f'Stale translation: {question_id}/{field}'
        tree = html.fragment_fromstring(source or '<p></p>', create_parent='div')
        paragraphs = tree.xpath('.//p')
        assert len(paragraphs) == len(reviewed['paragraphs']), (question_id, field)
        for paragraph, translated in zip(paragraphs, reviewed['paragraphs']):
            key = f"{question_id}/{field}/{translated['index']}"
            text, tokens = translations.get(key, translated['text']), translated['tokens']
            assert collections.Counter(re.findall(r'\{\d+\}', text)) == collections.Counter(tokens.keys()), (question_id, field, translated['index'])
            content = ''.join(tokens.get(piece, escape_html.escape(piece)) for piece in re.split(r'(\{\d+\})', text))
            # Keep paragraph attributes, tables and image placement from English.
            for child in list(paragraph):
                paragraph.remove(child)
            paragraph.text = None
            for fragment in html.fragments_fromstring(content):
                if isinstance(fragment, str):
                    if len(paragraph):
                        paragraph[-1].tail = (paragraph[-1].tail or '') + fragment
                    else:
                        paragraph.text = (paragraph.text or '') + fragment
                else:
                    paragraph.append(fragment)
        translated_html = ''.join(etree.tostring(child, encoding='unicode', method='html') for child in tree) if source else ''
        # Word sometimes stores prose labels inside MathML. Translate labels,
        # retaining the equation's operators, variables and numeric structure.
        for label, chinese in {'total displacement':'總位移', 'total time of travel':'總移動時間', 'change in mass number':'質量數的改變', 'mass number of α particle':'α 粒子的質量數'}.items():
            translated_html = translated_html.replace('>'+label+'<', '>'+chinese+'<')
        if question_id == 'ex-204-6' and field == 'answer':
            translated_html = re.sub(r'<math\b[^>]*>.*?</math>', '：', translated_html)
        result[question_id][field] = {'sourceSha256': reviewed['sourceSha256'], 'html': translated_html}
(SITE / 'scripts/example-parity-overrides.json').write_text(json.dumps(result, ensure_ascii=False), encoding='utf-8')
print(f'Rendered {sum(map(len, result.values()))} English-aligned fields')
