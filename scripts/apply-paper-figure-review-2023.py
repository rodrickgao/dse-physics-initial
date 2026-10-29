"""Apply source-reviewed figures without replacing other canonical content.

Copy the patch's ten media files into the checkout, then run this script with
--site-dir pointing to that checkout. Fails before writing if a target changed.
Run again after a canonical export only after reviewing any reported conflict.
"""
from pathlib import Path
import argparse, hashlib, json, re

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--site-dir', type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    root = args.site_dir.resolve()
    manifest = json.loads(Path(__file__).with_name('paper-figure-review-2023.json').read_text('utf8'))
    documents = {}
    changed = set()
    for review in manifest['reviews']:
        asset = root / review['asset']
        if not asset.is_file() or hashlib.sha256(asset.read_bytes()).hexdigest() != review['sha256']:
            raise SystemExit(f"Missing or changed reviewed asset: {review['asset']}")
        name = f"text-papers/2023-{review['language']}.json"
        if name not in documents:
            documents[name] = json.loads((root / name).read_text('utf8'))
        record = documents[name][review['key']]
        question = record['question']
        images = list(re.finditer(r'<img\b[^>]*>', question))
        index = review['index']
        if index >= len(images):
            raise SystemExit(f"Missing figure: {name} {review['key']} index {index}")
        match = images[index]
        if match.group() == review['newImageTag']:
            continue
        if match.group() != review['oldImageTag']:
            raise SystemExit(f"Figure changed; review before applying: {name} {review['key']} index {index}")
        record['question'] = question[:match.start()] + review['newImageTag'] + question[match.end():]
        changed.add(name)
    for name in sorted(changed):
        (root / name).write_text(json.dumps(documents[name], ensure_ascii=False, separators=(',', ':')), 'utf8')
    print(f"Verified {len(manifest['reviews'])} reviewed figures; updated {len(changed)} edition files.")

if __name__ == '__main__':
    main()
