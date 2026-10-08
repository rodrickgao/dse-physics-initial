"""Rebuild visually reviewed 202 example screenshots; never reconstruct source artwork."""
import hashlib
import json
from pathlib import Path
import pypdfium2 as pdfium

SITE = Path(__file__).resolve().parents[1]
manifest = json.loads((SITE / 'scripts/textbook-example-crops.json').read_text(encoding='utf-8'))
source = Path(manifest['source'])
doc = pdfium.PdfDocument(source)
out = SITE / 'assets/textbook-examples/eng/202'
out.mkdir(parents=True, exist_ok=True)
cache = {}
records = []
for item in manifest['examples']:
    record = {k: item[k] for k in ['number', 'title', 'pages']}
    record['id'] = f"ex-202-{item['number']}"
    for kind in ['question', 'answer']:
        record[kind] = []
        for i, segment in enumerate(item[kind]):
            page, box = segment['page'], segment['crop']
            if page not in cache:
                cache[page] = doc[page - 1].render(scale=3).to_pil().convert('RGB')
            im = cache[page].crop(tuple(round(v * 3) for v in box))
            name = f"example-{item['number']:02}-{kind}-{i+1}.jpg"
            im.save(out / name, quality=90, subsampling=0)
            record[kind].append({'src': f'assets/textbook-examples/eng/202/{name}', 'width': im.width, 'height': im.height, 'page': page})
    records.append(record)
result = {'chapter': '202', 'title': 'Straight-line Motion', 'language': 'eng', 'source': source.name, 'sha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'examples': records}
(out / 'index.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'Imported {len(records)} complete examples, including solutions and side notes.')
