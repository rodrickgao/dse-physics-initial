import json
from pathlib import Path

import pypdfium2 as pdfium
from PIL import Image, ImageDraw

SITE = Path(__file__).resolve().parents[1]
ROOT = SITE.parent
QA = ROOT / "tmp/textbook-review"
manifest = json.loads((SITE / "scripts/textbook-source-manifest.json").read_text(encoding="utf-8"))
specs = json.loads((QA / "figure-specs.json").read_text(encoding="utf-8"))
sources = {Path(p).name: p for p in manifest["sources"]}
directory = SITE / "assets/textbook/figures"
directory.mkdir(parents=True, exist_ok=True)
output = []
for spec in specs:
    source = manifest["languages"]["eng"][str(spec["sourceSequence"])]
    doc = pdfium.PdfDocument(sources[source["source"]])
    page = doc[source["page"]-1]
    rendered = page.render(scale=3).to_pil().convert("RGB")
    preview = Image.open(QA / f"page-{spec['sourceSequence']:03d}.png")
    sx, sy = rendered.width/preview.width, rendered.height/preview.height
    x0, y0, x1, y1 = spec["previewRect"]
    rect = [round(x0*sx), round(y0*sy), round(x1*sx), round(y1*sy)]
    assert 0 <= rect[0] < rect[2] <= rendered.width
    assert 0 <= rect[1] < rect[3] <= rendered.height
    crop = rendered.crop(rect)
    crop.save(directory / f"{spec['id']}.png", optimize=True)
    output.append({**spec, "src": f"assets/textbook/figures/{spec['id']}.png", "width": crop.width, "height": crop.height,
                   "source": source["source"], "page": source["page"], "language": "eng",
                   "crop_pixels": rect, "render_scale": 3})
    doc.close()
(SITE / "scripts/textbook-figure-manifest.json").write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
for start in range(0, len(output), 8):
    sheet = Image.new("RGB", (1500, 1600), "white")
    draw = ImageDraw.Draw(sheet)
    for i, spec in enumerate(output[start:start+8]):
        crop = Image.open(SITE / spec["src"])
        crop.thumbnail((730, 365))
        x, y = i%2*750, i//2*400
        draw.text((x+10, y+5), spec["id"], fill="black")
        sheet.paste(crop, (x+10,y+28))
    sheet.save(QA / f"figures-{start:02d}.jpg", quality=92)
print(f"Cropped {len(output)} original figures, with source page and bilingual captions.")
