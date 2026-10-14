import json
import math
import re
import subprocess
from pathlib import Path

import pdfplumber
from PIL import Image, ImageDraw

root = Path('../output/pdf/site-debug-20261013').resolve()
rendered = root / 'rendered'
rendered.mkdir(parents=True, exist_ok=True)
poppler = Path('C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin/pdftoppm.exe')
report = {'files': [], 'issues': [], 'contacts': []}
for file in sorted(root.glob('*.pdf')):
    metadata = json.loads(Path(str(file) + '.json').read_text(encoding='utf-8'))
    with pdfplumber.open(file) as pdf:
        text = '\n'.join(page.extract_text() or '' for page in pdf.pages)
        compact = re.sub(r'\s', '', text)
        missing = [row['key'] for row in metadata if re.sub(r'\s', '', row['title']) not in compact]
        if missing:
            report['issues'].append({'file': file.name, 'missingQuestionTitles': missing})
        for index, page in enumerate(pdf.pages, 1):
            if abs(page.width - 595.28) > 1.2 or abs(page.height - 841.89) > 1.2:
                report['issues'].append({'file': file.name, 'page': index, 'issue': 'A4 size'})
            if 'ddphysics.com' not in (page.extract_text() or '') or len(page.images) < 3:
                report['issues'].append({'file': file.name, 'page': index, 'issue': 'Header or brand images missing'})
            outside = [char for char in page.chars if char['text'].strip() and char['top'] >= 100 and
                       (char['x0'] < 48 or char['x1'] > page.width - 48 or char['bottom'] > page.height - 48)]
            if outside:
                report['issues'].append({'file': file.name, 'page': index, 'issue': 'Text beyond content area', 'text': ''.join(char['text'] for char in outside)[:160]})
        report['files'].append({'file': file.name, 'pages': len(pdf.pages), 'questions': len(metadata), 'allTitlesPresent': not missing})
    prefix = rendered / file.stem
    subprocess.run([str(poppler), '-png', '-scale-to', '1000', str(file), str(prefix)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    pages = sorted(rendered.glob(file.stem + '-*.png'), key=lambda p: int(p.stem.rsplit('-', 1)[-1]))
    for offset in range(0, len(pages), 12):
        sheet = Image.new('RGB', (1530, 2210), '#d9dfe7')
        draw = ImageDraw.Draw(sheet)
        for i, page_file in enumerate(pages[offset:offset + 12]):
            image = Image.open(page_file).convert('RGB')
            image.thumbnail((495, 690))
            x, y = (i % 3) * 510 + 8, (i // 3) * 550 + 28
            image.thumbnail((495, 510))
            sheet.paste(image, (x, y))
            draw.text((x, y - 20), f'{file.stem}  page {offset + i + 1}', fill='black')
        contact = root / f'{file.stem}-contact-{offset // 12 + 1}.jpg'
        sheet.save(contact, quality=90)
        report['contacts'].append(str(contact))
report['pages'] = sum(row['pages'] for row in report['files'])
report['passed'] = not report['issues']
(root / 'pdf-check.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'pages': report['pages'], 'issues': report['issues'], 'passed': report['passed']}, ensure_ascii=False))
