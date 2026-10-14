import json
import re
import sys
from pathlib import Path
from pypdf import PdfReader
import pypdfium2 as pdfium
from PIL import Image, ImageDraw

root = Path('../output/print-subquestions-20261013')
report = json.loads((root / 'browser-report.json').read_text(encoding='utf-8'))
results = []
for sample in report['pdfs']:
    path = Path(sample['path'])
    reader = PdfReader(path)
    texts = [p.extract_text() for p in reader.pages]
    checked = 0
    for group in sample['metrics']:
        if not group['protect']:
            continue
        start, end = f"PART{group['id']}STARTMARK", f"PART{group['id']}ENDMARK"
        first = [i + 1 for i, text in enumerate(texts) if start in re.sub(r'\s+', '', text)]
        last = [i + 1 for i, text in enumerate(texts) if end in re.sub(r'\s+', '', text)]
        assert len(first) == len(last) == 1 and first == last, (path.name, group, first, last)
        checked += 1
    for p in reader.pages:
        assert abs(float(p.mediabox.width) - 595.28) < 1
        assert abs(float(p.mediabox.height) - 841.89) < 1
    if '--check-only' in sys.argv:
        results.append({'file':path.name,'pages':len(reader.pages),'protectedGroups':checked})
        print(path.name, len(reader.pages), 'pages;', checked, 'whole-page groups verified')
        continue
    doc = pdfium.PdfDocument(path)
    thumbnails = []
    for i, page in enumerate(doc):
        image = page.render(scale=0.65).to_pil().convert('RGB')
        thumb = Image.new('RGB', (410, 590), '#e5e7eb')
        thumb.paste(image, ((410 - image.width) // 2, 20))
        ImageDraw.Draw(thumb).text((10, 570), f'{path.stem} / {i+1}', fill='black')
        thumbnails.append(thumb)
        if sample['group'] == 'screenshot':
            page.render(scale=1.4).to_pil().save(root / f'{path.stem}-{i+1}.png')
    sheets = []
    for start in range(0, len(thumbnails), 12):
        batch = thumbnails[start:start+12]
        sheet = Image.new('RGB', (410 * 4, 590 * ((len(batch)+3)//4)), 'white')
        for j, thumb in enumerate(batch):
            sheet.paste(thumb, ((j%4)*410, (j//4)*590))
        target = root / f'{path.stem}-contact-{start//12+1}.jpg'
        sheet.save(target, quality=88)
        sheets.append(str(target.resolve()))
    results.append({'file':path.name,'pages':len(reader.pages),'protectedGroups':checked,'contactSheets':sheets})
    print(path.name, len(reader.pages), 'pages;', checked, 'whole-page groups verified')
assert len(results) == 8
output = {'passed':True,'pdfs':results,'pages':sum(r['pages'] for r in results),'protectedGroups':sum(r['protectedGroups'] for r in results)}
(root / ('pdf-markers.json' if '--check-only' in sys.argv else 'pdf-verification.json')).write_text(json.dumps(output,ensure_ascii=False,indent=2),encoding='utf-8')
