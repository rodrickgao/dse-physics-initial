"""Import verified editable Word examples, preserving original math and artwork."""
from pathlib import Path
import importlib.util,json,re,hashlib
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('exercise_import',ROOT/'scripts/import-textbook-exercises.py')
converter=importlib.util.module_from_spec(spec);spec.loader.exec_module(converter)
manifest=json.loads((ROOT.parent/'tmp/examples-all/delivery-manifest.json').read_text(encoding='utf8'))
out=ROOT/'assets/textbook-examples';media=out/'media';media.mkdir(parents=True,exist_ok=True)
questions=[];report=[];counts={}
for item in manifest:
 code=item['code'];path=Path(item['source'])
 records=converter.convert(path,media,examples=True,media_url='assets/textbook-examples/media')
 assert len(records)==item['examples']
 for r in records.values():
  r.update(id=f'ex-{code}-{r["number"]}',chapter=code)
  assert bool(r['think'])==bool(r['thinkAnswer']),r['id']
  plain=lambda s:re.sub(r'\s+',' ',re.sub('<[^>]+>',' ',s)).strip()
  questions.append({'id':r['id'],'chapter':code,'number':int(r['number']),'title':r['title'],'preview':plain(r['question'])[:200], 'searchText':plain(r['question'])})
 (out/'eng'/f'{code}.json').write_text(json.dumps({r['id']:r for r in records.values()},ensure_ascii=False,separators=(',',':')),encoding='utf8')
 counts[code]=len(records)
 report.append({'chapter':code,'count':len(records),'source':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'thinkCount':sum(bool(r['think']) for r in records.values())})
for lang in ['eng','chn']:
 exercise=json.loads((ROOT/f'assets/textbook-exercises/index-{lang}.json').read_text(encoding='utf8'))
 books=[]
 for b in exercise['books']:
  chapters=[{'id':c['id'],'title':c['title'],'count':counts[c['id']]} for c in b['chapters']]
  books.append({'id':b['id'],'title':b['title'],'chapters':chapters,'count':sum(c['count'] for c in chapters)})
 (out/f'index-{lang}.json').write_text(json.dumps({'contentLanguage':'eng','books':books,'questions':questions,'count':len(questions)},ensure_ascii=False,separators=(',',':')),encoding='utf8')
assert len(questions)==373 and len(counts)==46 and sum(r['thinkCount'] for r in report)==51
(ROOT/'scripts/textbook-example-sources.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print('Imported 373 examples / 46 chapters / 51 Think about blocks')
import subprocess
subprocess.run(['node',str(ROOT/'scripts/example-layout-review.mjs'),'eng'],check=True)
