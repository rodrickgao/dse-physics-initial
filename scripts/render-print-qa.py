from pathlib import Path
import sys
import pypdfium2 as pdfium
root=Path(sys.argv[1])
for path in sorted(root.glob('*.pdf')):
 doc=pdfium.PdfDocument(path)
 print(path.name, 'pages',len(doc))
 for i,page in enumerate(doc):
  page.render(scale=1.1).to_pil().save(root/f'{path.stem}-{i+1}.png')
  value=page.get_textpage().get_text_range()
  assert len(value.strip())>5, f'Blank page {path.name} {i+1}'
  if 'questions' in path.stem:assert 'Detailed reasoning' not in value
