"""Split the approved watermarked knowledge summaries at actual chapter headings."""
import hashlib
import json
import re
import io
import copy
from pathlib import Path
import pymupdf as fitz
from pypdf import PdfReader, PdfWriter
from pypdf.generic import ContentStream, DecodedStreamObject, NameObject

def balanced_stream(data, reader):
    stream = DecodedStreamObject(); stream.set_data(data)
    parsed = ContentStream(stream, reader)
    operations, depth = [], 0
    for operands, operator in parsed.operations:
        if operator == b'q':
            depth += 1
        elif operator == b'Q':
            if not depth:
                continue
            depth -= 1
        operations.append((operands, operator))
    operations.extend(([], b'Q') for _ in range(depth))
    parsed.operations = operations
    return parsed

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / 'outputs/knowledge-summary-20260919/final'
CATALOG = ROOT / 'src/lib/textbook-downloads.json'
catalog = json.loads(CATALOG.read_text(encoding='utf-8'))
report = {}
for language, label in [('chn', '中文版'), ('eng', '英文版')]:
    source = SOURCE / f'知识点（{label}）.pdf'
    # Separate the existing watermark so it can be reapplied once per reflowed page.
    reader = PdfReader(source)
    clean_writer, stamp_writer = PdfWriter(), PdfWriter()
    for index, original in enumerate(reader.pages):
        data = original.get_contents().get_data()
        markers = list(re.finditer(rb'q\s+0\.0 0\.0 [\d.]+ [\d.]+ re\s+W\s+n\s+1 0 0 1 0 0 cm', data))
        assert len(markers) == 1
        boundary = markers[0].start()
        clean = copy.copy(original)
        clean[NameObject('/Contents')] = balanced_stream(data[:boundary], reader)
        clean_writer.add_page(clean)
        if index == 0:
            stamp = copy.copy(original)
            stamp[NameObject('/Contents')] = balanced_stream(data[boundary:], reader)
            stamp_writer.add_page(stamp)
    clean_buffer, stamp_buffer = io.BytesIO(), io.BytesIO()
    clean_writer.write(clean_buffer); stamp_writer.write(stamp_buffer)
    doc = fitz.open(stream=clean_buffer.getvalue(), filetype='pdf')
    watermark = fitz.open(stream=stamp_buffer.getvalue(), filetype='pdf')
    headings = []
    for index, page in enumerate(doc):
        lines = [(line['bbox'], ''.join(s['text'] for s in line['spans']).strip())
                 for block in page.get_text('dict')['blocks'] if 'lines' in block
                 for line in block['lines']]
        for bbox, text in lines:
            match = re.match(r'^(E[1-4]\d{2}|3[AB]\d{2}|[1245]\d{2})\s+\S', text)
            if match and match[1] in catalog[language]:
                headings.append((match[1], index, bbox[1] - 5))
    assert len(headings) == 46 and len({h[0] for h in headings}) == 46, headings
    report[language] = []
    for n, (code, first, top) in enumerate(headings):
        _, last, bottom = headings[n+1] if n+1 < len(headings) else ('', len(doc)-1, doc[-1].rect.height)
        # A new book heading belongs to the following chapter, not the current one.
        if n+1 < len(headings):
            for block in doc[last].get_text('blocks'):
                text = block[4].strip()
                if block[1] < bottom and re.match(r'^(必修第|選修|Compulsory Book|Elective)', text):
                    if block[1] > (top if last == first else 35):
                        bottom = min(bottom, block[1] - 5)
        out = fitz.open()
        expected_lines = []
        target = None
        cursor = 42
        for page_no in range(first, last+1):
            start = top if page_no == first else 36
            end = bottom if page_no == last else doc[page_no].rect.height - 42
            if end <= start + 5:
                continue
            source_page = doc[page_no]
            blocks = source_page.get_text('dict')['blocks']
            for block in blocks:
                for line in block.get('lines', []):
                    if line['bbox'][1] >= start and line['bbox'][3] <= min(end, source_page.rect.height-35):
                        expected_lines.append(''.join(s['text'] for s in line['spans']))
            card_starts = []
            for block in blocks:
                for line in block.get('lines', []):
                    text = ''.join(s['text'] for s in line['spans']).strip()
                    if start <= line['bbox'][1] < end and re.match(r'^(?:E)?\d+\.\d+\.\d+\s', text):
                        card_starts.append(line['bbox'][1] - 4)
            # Keep the chapter heading attached to its first card.
            cuts = [start] + [y for y in card_starts if y > start + 80] + [end]
            for lower, upper in zip(cuts, cuts[1:]):
                objects = []
                for block in blocks:
                    if block['type'] == 1:
                        objects.append(block['bbox'])
                    else:
                        objects.extend(line['bbox'] for line in block.get('lines', []))
                visible = [b for b in objects if b[1] >= lower and b[3] <= upper and b[1] > 35 and b[3] < source_page.rect.height - 35]
                if not visible:
                    continue
                lower = max(lower, min(b[1] for b in visible)-3)
                upper = min(upper, max(b[3] for b in visible)+3)
                height = upper-lower
                if target is None or cursor+height > source_page.rect.height-42:
                    target = out.new_page(width=source_page.rect.width, height=source_page.rect.height)
                    cursor = 42
                assert height <= source_page.rect.height-84, (code, page_no, height)
                piece = fitz.open()
                piece.insert_pdf(doc, from_page=page_no, to_page=page_no)
                page = piece[0]
                page.add_redact_annot(fitz.Rect(0, 0, page.rect.width, lower), fill=False)
                page.add_redact_annot(fitz.Rect(0, upper, page.rect.width, page.rect.height), fill=False)
                page.apply_redactions(images=2, graphics=1, text=0)
                clip = fitz.Rect(0, lower, page.rect.width, upper)
                target.show_pdf_page(fitz.Rect(0, cursor, page.rect.width, cursor+height), piece, 0, clip=clip)
                cursor += height+16
                piece.close()
        for page in out:
            page.show_pdf_page(page.rect, watermark, 0, overlay=True)
        path = ROOT / f'assets/textbook/pdfs/{language}/{code}.pdf'
        out.set_metadata({'title': f'{code} Knowledge summary', 'subject': 'Watermarked chapter knowledge points'})
        out.save(path, garbage=4, deflate=True)
        out.close()
        check = fitz.open(path)
        text = ''.join(p.get_text() for p in check)
        normalized = re.sub(r'\s+', '', text)
        missing = [line for line in expected_lines if re.sub(r'\s+', '', line) not in normalized]
        assert not missing, (language, code, 'Missing text', missing)
        assert re.search(rf'\b{code}\s', text), code
        assert ('高多多物理' if language == 'chn' else 'rodrickgao') in text, code
        other = [h[0] for h in headings if h[0] != code and re.search(rf'(?m)^{h[0]}\s+\S', text)]
        assert not other, (code, other)
        data = path.read_bytes()
        catalog[language][code] = {
            'url': path.relative_to(ROOT).as_posix(),
            'filename': f'{code}-{label}-知识点.pdf',
            'source': source.name, 'sourcePages': [first+1, last+1],
            'pages': len(check), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
        }
        report[language].append({'chapter': code, 'pages': len(check)})
        check.close()
    doc.close()
    watermark.close()
CATALOG.write_text(json.dumps(catalog, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))
