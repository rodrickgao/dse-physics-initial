"""Render source evidence without reconstructing textbook artwork."""
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

import pypdfium2 as pdfium
import numpy as np
from PIL import Image, ImageDraw

SITE = Path(__file__).resolve().parents[1]
ROOT = SITE.parent
OUT = SITE / "assets" / "textbook"
QA = ROOT / "tmp" / "textbook-review"

# Visually reviewed MediaBox bounds isolate boxes from adjacent yellow artwork.
CHINESE_CROP_OVERRIDES = {
    67: [302.853032430013, 330.8533528645833, 526.1863657633464, 466.52001953125],
    86: [422.5196990966797, 251.18668619791666, 515.853032430013, 302.18668619791666],
    140: [304, 496.3333333333333, 444.3333333333333, 545.3333333333334],
    186: [200, 118.66666666666667, 548.3333333333334, 170.66666666666666],
    249: [297, 404, 441, 455],
    288: [283, 310.6666666666667, 358.3333333333333, 357.3333333333333],
}


def english_boxes():
    spec = importlib.util.spec_from_file_location("builder", ROOT / "tmp/pdfs/build_english_yellow_box_outputs.py")
    builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
    candidates = json.loads((ROOT / "tmp/pdfs/english_yellow_box_candidates.json").read_text(encoding="utf-8"))
    chapters = {chapter["code"]: chapter for chapter in candidates}
    records = []
    for code in builder.CODE_ORDER:
        chapter = chapters[code]
        boxes = [b for b in chapter["boxes"] if builder.selected(code, b)]
        for box in builder.manual_english_additions(code, chapter["boxes"]):
            if box not in boxes:
                boxes.append(box)
        for box in sorted(boxes, key=lambda b: (b["pdf_page"], b["bbox"][1])):
            records.append({**box, "sequence": len(records) + 1, "code": code, "path": chapter["file"]})
    return records


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    QA.mkdir(parents=True, exist_ok=True)
    zh = json.loads((ROOT / "output/黃色框重點/黃色框重點資料庫.json").read_text(encoding="utf-8"))
    spec = importlib.util.spec_from_file_location("zh_builder", ROOT / "tmp/pdfs/build_yellow_box_outputs.py")
    zh_builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(zh_builder)
    manual = zh_builder.MANUAL_ADDITIONS
    missing_sequences = {r["sequence"] for r in zh if not r.get("bbox")}
    for record in zh:
        record["path"] = str(Path("C:/Users/rodri/Desktop/dse/phy/物理教材") / record["source_file"])
    languages = {"eng": english_boxes(), "chn": zh}
    only = {int(value) for value in sys.argv[1].split(',')} if len(sys.argv)>1 else None
    manifest_path = SITE / "scripts/textbook-source-manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if only else {"languages": {}, "sources": {}}
    review_pages = {31, 36, 50, 51, 53, 67, 69, 96, 109, 110, 111, 118, 120, 123, 126, 128, 142, 144, 145, 148, 150, 152, 162, 165, 187, 197, 198, 199, 200, 201, 205, 208, 209, 211, 214, 215, 217, 222, 232, 237, 252, 253, 262, 270, 280, 286, 307, 314, 323, 324, 327, 334, 335, 338, 339, 340, 346, 349, 350, 353, 360}
    for language, records in languages.items():
        assert len(records) == 365
        manifest["languages"].setdefault(language, {})
        directory = OUT / language
        directory.mkdir(exist_ok=True)
        docs = {}
        cached_key = None
        for record in records:
            if only and (language != "chn" or record["sequence"] not in only):
                continue
            source = record["path"]
            if source not in docs:
                docs[source] = pdfium.PdfDocument(source)
                manifest["sources"][source] = hashlib.sha256(Path(source).read_bytes()).hexdigest()
            doc = docs[source]
            page_number = record["pdf_page"]
            assert 1 <= page_number <= len(doc)
            key = (source, page_number)
            if key != cached_key:
                rendered = doc[page_number - 1].render(scale=3).to_pil().convert("RGB")
                cached_key = key
            page = doc[page_number - 1]
            media = page.get_mediabox()
            visible = page.get_cropbox()
            # pdfplumber coordinates refer to MediaBox; PDFium renders CropBox.
            dx, dy = visible[0] - media[0], media[3] - visible[3]
            if language == 'chn' and record['sequence'] in CHINESE_CROP_OVERRIDES:
                record['bbox'] = CHINESE_CROP_OVERRIDES[record['sequence']]
            if not record.get("bbox"):
                additions = [a for a in manual if a["code"] == record["code"] and a["pdf_page"] == page_number]
                peers = [r for r in records if r["code"] == record["code"] and r["pdf_page"] == page_number and r["sequence"] in missing_sequences]
                target = additions[peers.index(record)]["top"]
                rgb = np.asarray(rendered).astype(np.int16)
                mask = (rgb[:,:,0] > 228) & (rgb[:,:,1] > 215) & (rgb[:,:,2] < 239) & (rgb[:,:,0]-rgb[:,:,2] > 18)
                mask[:, :max(0, int((170-dx)*3))] = False
                rows = np.where(mask.sum(axis=1) > 90)[0]
                groups = np.split(rows, np.where(np.diff(rows) > 9)[0]+1)
                groups = [g for g in groups if len(g)>12]
                assert groups, f"No yellow source found for {record['sequence']}"
                group = min(groups, key=lambda g: abs((g[0]/3+dy)-target))
                yy0, yy1 = int(group[0]), int(group[-1])+1
                cols = np.where(mask[yy0:yy1].sum(axis=0)>5)[0]
                record["bbox"] = [float(cols[0])/3+dx, yy0/3+dy, float(cols[-1]+1)/3+dx, yy1/3+dy]
                record["crop_method"] = "yellow_region_nearest_reviewed_position"
            x0, y0, x1, y1 = record["bbox"]
            x0, x1, y0, y1 = x0-dx, x1-dx, y0-dy, y1-dy
            rect = (max(0, int(x0*3)-9), max(0, int(y0*3)-9), min(rendered.width, int(x1*3)+9), min(rendered.height, int(y1*3)+9))
            assert rect[2] > rect[0] and rect[3] > rect[1]
            name = f"{record['sequence']:03d}.png"
            crop = rendered.crop(rect)
            crop.save(directory / name, optimize=True)
            manifest["languages"][language][str(record["sequence"])] = {
                "src": f"assets/textbook/{language}/{name}", "source": Path(source).name,
                "page": page_number, "bbox": record["bbox"], "width": crop.width, "height": crop.height,
            }
            if language == "eng" and record["sequence"] in review_pages:
                small = rendered.copy()
                small.thumbnail((850, 1200))
                small.save(QA / f"page-{record['sequence']:03d}.png")
        for doc in docs.values():
            doc.close()
        print(f"{language}: {len(records)} original source crops", flush=True)
    (SITE / "scripts/textbook-source-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    # Sheets retain every source box, with stable sequence identifiers for review.
    for language in languages:
        for start in range(1, 366, 12):
            sheet = Image.new("RGB", (1500, 1800), "white")
            draw = ImageDraw.Draw(sheet)
            for offset, sequence in enumerate(range(start, min(start+12, 366))):
                crop = Image.open(OUT / language / f"{sequence:03d}.png")
                crop.thumbnail((730, 265))
                x, y = (offset % 2)*750, (offset//2)*300
                draw.text((x+10, y+5), f"{language} #{sequence:03d}", fill="black")
                sheet.paste(crop, (x+10, y+28))
            sheet.save(QA / f"boxes-{language}-{start:03d}.jpg", quality=92)


if __name__ == "__main__":
    main()
