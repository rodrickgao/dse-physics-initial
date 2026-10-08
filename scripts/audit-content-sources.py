"""Verify source fingerprints and flag bilingual answer differences for review."""
import json,hashlib,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT.parent/'output/full-audit-20261009'
sources=[]
for row in json.loads((ROOT/'scripts/textbook-exercise-sources.json').read_text(encoding='utf-8')):
    p=Path(row['source'])
    status='missing' if not p.exists() else 'matching' if hashlib.sha256(p.read_bytes()).hexdigest()==row['sha256'] else 'changed'
    sources.append({'language':row['language'],'chapter':row['chapter'],'status':status,'file':str(p)})
differences=[]
for p in (ROOT/'assets/textbook-exercises/chn').glob('*.json'):
    zh=json.loads(p.read_text(encoding='utf-8'));en=json.loads((p.parents[1]/'eng'/p.name).read_text(encoding='utf-8'))
    for key,q in zh.items():
        if key not in en: differences.append({'id':key,'issue':'missing_english'});continue
        if q.get('kind')!='multiple-choice':continue
        a=re.sub('<[^>]+>','',q['answer']).strip();b=re.sub('<[^>]+>','',en[key]['answer']).strip()
        if a!=b:differences.append({'id':key,'chn':a,'eng':b,'review':'compare_option_order_before_changing'})
result={'sources':sources,'answer_differences':differences}
(OUT/'source-check.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'sources':len(sources),'not_matching':[r for r in sources if r['status']!='matching'],'answer_differences':differences},ensure_ascii=False))
