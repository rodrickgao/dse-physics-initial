"""Check pixel data and source hashes; prepare manual-crop review sheets."""
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

SITE = Path(__file__).resolve().parents[1]
ROOT = SITE.parent
QA = ROOT / 'tmp/textbook-review'
manifest = json.loads((SITE / 'scripts/textbook-source-manifest.json').read_text(encoding='utf-8'))
for filename, digest in manifest['sources'].items():
    assert hashlib.sha256(Path(filename).read_bytes()).hexdigest() == digest, filename
paths = list((SITE / 'assets/textbook').rglob('*.png'))
assert len(paths) == 776
for filename in paths:
    with Image.open(filename) as img:
        img.load()
        gray = np.asarray(img.convert('L'))
        assert gray.std() > 5, f'Blank image: {filename}'
        assert (gray < 120).sum() > 100, f'No ink: {filename}'
zh = json.loads((ROOT / 'output/黃色框重點/黃色框重點資料庫.json').read_text(encoding='utf-8'))
manual = [p['sequence'] for p in zh if not p.get('bbox')]
for start in range(0, len(manual), 8):
    sheet = Image.new('RGB', (1500, 1600), 'white')
    draw = ImageDraw.Draw(sheet)
    for i, seq in enumerate(manual[start:start+8]):
        source = manifest['languages']['chn'][str(seq)]
        with Image.open(SITE / source['src']) as img:
            img.thumbnail((730, 365))
            x, y = i % 2 * 750, i // 2 * 400
            draw.text((x+10,y+5), f'chn #{seq} PDF {source["page"]}', fill='black')
            sheet.paste(img, (x+10,y+28))
    sheet.save(QA / f'manual-chinese-{start:02d}.jpg', quality=92)
result = {'sourcePdfHashesUnchanged': len(manifest['sources']), 'nonblankPngs': len(paths), 'manualCropSequences': manual}
(QA / 'image-verification.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps(result))
