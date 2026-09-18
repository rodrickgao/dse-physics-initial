"""Publish question papers only; preserve source bytes or verified source page ranges."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import shutil
from pypdf import PdfReader, PdfWriter

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('folder', type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    source = args.folder.resolve()
    old = json.loads((root / 'downloads/catalog.json').read_text(encoding='utf-8'))
    files = []
    folders = {'eng': source / '物理Physics（英）-2012-2026', 'chn': source / '物理Physics（中）-2012-2024'}
    plans = []
    unavailable = []
    for lang in ['eng', 'chn']:
        for year in range(2012, 2026):
            for paper, short in [('paper-1a', 'p1a'), ('paper-1b', 'p1b'), ('paper-2', 'p2')]:
                pages = None
                if lang == 'chn' and year == 2025:
                    unavailable.append(dict(language=lang, year=year, paper=paper, reason='english-only'))
                    continue
                if lang == 'chn' and year == 2024:
                    path = folders[lang] / '2024物理真题.pdf'
                    # Physical PDF pages; page 58 begins the marking scheme.
                    pages = {'paper-1a': (6, 21), 'paper-1b': (22, 40), 'paper-2': (41, 57)}[paper]
                    assert len(PdfReader(path).pages) == 81
                elif lang == 'eng' and year == 2025:
                    path = folders[lang] / '2025' / ('2025 P2.pdf' if paper == 'paper-2' else '2025 P1.pdf')
                    if paper != 'paper-2':
                        pages = (1, 16) if paper == 'paper-1a' else (17, 36)
                        assert len(PdfReader(path).pages) == 36
                else:
                    candidates = sorted(p for p in folders[lang].rglob('*.pdf')
                        if re.fullmatch(rf'(?:{year}\s*)?{short}(?: \(1\))?\.pdf', p.name, re.I)
                        and (p.name.startswith(str(year)) or p.parent.name == str(year)))
                    if not candidates:
                        unavailable.append(dict(language=lang, year=year, paper=paper, reason='source-missing'))
                        continue
                    assert len({digest(p) for p in candidates}) == 1, candidates
                    path = candidates[0]
                assert path.exists(), path
                plans.append((lang, year, paper, path, pages))
    assert len(plans) == 78, f'Unexpected source coverage: {len(plans)}'
    # Archive only the old published worked-paper copies, outside the public tree.
    archive = root / '.local/retired-worked-papers'
    for file in old['files']:
        if file['kind'] != 'paper' or file.get('edition') == 'original':
            continue
        path = (root / file['url']).resolve()
        assert path.is_relative_to((root / 'downloads').resolve())
        if path.exists():
            target = archive / path.relative_to(root / 'downloads')
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, target)
            assert digest(path) == digest(target)
            path.unlink()
    for lang, year, paper, path, pages in plans:
        target = root / 'downloads/originals' / lang / f'{year}-{paper}.pdf'
        target.parent.mkdir(parents=True, exist_ok=True)
        if pages:
            reader = PdfReader(path)
            writer = PdfWriter()
            for i in range(pages[0] - 1, pages[1]):
                writer.add_page(reader.pages[i])
            with target.open('wb') as output:
                writer.write(output)
        else:
            shutil.copyfile(path, target)
            assert digest(path) == digest(target)
        count = len(PdfReader(target).pages)
        if pages:
            assert count == pages[1] - pages[0] + 1
        files.append(dict(kind='paper', edition='original', language=lang, year=year, paper=paper,
            name=f'{year}_HKDSE_Physics_{paper}_{lang}_Original.pdf', url=target.relative_to(root).as_posix(),
            sha256=digest(target), source=path.relative_to(source).as_posix(), sourceSha256=digest(path),
            sourcePages=list(pages) if pages else None, pageCount=count))
    (root / 'downloads/catalog.json').write_text(json.dumps(dict(version='2026-09-16-originals', files=files,
        unavailable=unavailable), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Published {len(plans)} original papers; {len(unavailable)} unavailable editions; no 2026 papers.')

if __name__ == '__main__':
    main()
