"""Validate knowledge-document numbering without publishing knowledge PDFs.

Does not re-import the OCR sibling folders or overwrite canonical reviewed answers.
"""
from pathlib import Path
from collections import Counter
import argparse,json,re
from docx import Document

def main():
 ap=argparse.ArgumentParser();ap.add_argument('folder',type=Path);args=ap.parse_args()
 repo=Path(__file__).resolve().parents[1];out=repo/'downloads';out.mkdir(exist_ok=True)
 raw=(repo/'textbook-data.js').read_text(encoding='utf-8');data=json.JSONDecoder().raw_decode(raw[raw.index('{'):])[0]
 # Paper downloads are managed exclusively by sync-original-papers.py.
 existing=json.loads((out/'catalog.json').read_text(encoding='utf-8'))
 files=[f for f in existing['files'] if f.get('edition')=='original']
 for lang,label in [('eng','英文版'),('chn','中文版')]:
  folder=args.folder/label
  knowledge=list(folder.glob('*.docx'));knowledge=[p for p in knowledge if not p.name.startswith('~$')]
  assert len(knowledge)==1,knowledge
  doc=knowledge[0]
  headings=[p.text for p in Document(doc).paragraphs if p.style.name=='Heading 3']
  counts=Counter();expected=[]
  for point in data['languages'][lang]:
   code=point['code'];m=re.fullmatch(r'(E?)(\d)[AB]?(\d{2})',code);assert m
   counts[(point['book'],code)]+=1
   number=f'{m[1]}{m[2]}.{int(m[3])}.{counts[(point["book"],code)]}'
   expected.append(number);point['number']=number
  assert headings==expected and len(headings)==365
  # Knowledge PDFs are no longer public downloads. Validate numbering only.
 (out/'catalog.json').write_text(json.dumps(dict(version=existing['version'],files=files,unavailable=existing.get('unavailable',[])),ensure_ascii=False,indent=2),encoding='utf-8')
 (repo/'textbook-data.js').write_text('window.DSE_TEXTBOOK_DATA = '+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
 print('Synced',len(files),'PDFs; 365 matching knowledge numbers per language')
if __name__=='__main__':main()
