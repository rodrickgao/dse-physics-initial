"""Build bilingual, chapter-scoped exercise links with inspectable matching evidence.

Overrides are reviewed associations keyed by stable exercise ID. Only the local
exercise index is changed; past-paper links and frequency statistics are separate.
"""
from pathlib import Path
from collections import Counter
import json, re, math, html

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/textbook-exercises'
raw=(ROOT/'textbook-data.js').read_text(encoding='utf8')
KNOWLEDGE=json.JSONDecoder().raw_decode(raw[raw.index('{'):])[0]['languages']
STOP=set('a an the of and or to in on at for is are be as by with from that this these those it its which what when how why can may will would should does do did has have had not only than into if so also same following correct statement statements shown figure fig diagram answer solution marks mark one two three four much many state explain calculate find determine given show using use used'.split())
def plain(value):return re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]+>',' ',value))).strip()
def tokens(value):
 words=re.findall(r'[a-z]{3,}',value.lower().replace('−','-'))
 return [w[:-1] if w.endswith('s') and not w.endswith(('ss','us')) else w for w in words if w not in STOP]
def point_text(p):return ' '.join(str(p.get(f,'')) for f in ['card_title','card_summary','content','card_formula_notes'])
points=KNOWLEDGE['eng']
df=Counter(t for p in points for t in set(tokens(point_text(p))))
idf={t:math.log(1+len(points)/(1+n)) for t,n in df.items()}
vectors={p['sequence']:Counter(tokens(point_text(p))) for p in points}
titles={p['sequence']:set(tokens(p.get('card_title',''))) for p in points}

def rank(record,candidates):
 q=Counter(tokens(plain(record['question'])+' '+plain(record['answer'])+' '+plain(record['reasoning'])))
 ranked=[]
 for p in candidates:
  seq=p['sequence'];v=vectors[seq];common=set(q)&set(v)
  score=sum(idf.get(t,1)**2 * (1+math.log(q[t])) * (1+math.log(v[t])) * (3 if t in titles[seq] else 1) for t in common)
  norm=math.sqrt(sum((idf.get(t,1)*(1+math.log(n)))**2 for t,n in v.items()))
  ranked.append((score/(norm or 1),seq,sorted(common,key=lambda t:-idf.get(t,1))))
 return sorted(ranked,reverse=True)

def main():
 overrides_path=ROOT/'scripts/textbook-exercise-links.json'
 overrides=json.loads(overrides_path.read_text(encoding='utf8')) if overrides_path.exists() else {}
 records={lang:{} for lang in ['eng','chn']}
 for lang in records:
  for file in (OUT/lang).glob('*.json'):records[lang].update(json.loads(file.read_text(encoding='utf8')))
 assert set(records['eng'])==set(records['chn'])
 associations={};audit=[]
 for key,record in records['eng'].items():
  candidates=[p for p in points if p['code']==record['chapter']]
  ranked=rank(record,candidates)
  selected=overrides.get(key,[ranked[0][1]])
  book_key=candidates[0]['book_key']
  assert selected and all(any(p['sequence']==seq and p['book_key']==book_key for p in points) for seq in selected),(key,selected)
  associations[key]=selected
  audit.append({'id':key,'links':selected,'method':'reviewed' if key in overrides else 'chapter-scoped text match','score':round(ranked[0][0],2),'evidenceTerms':ranked[0][2][:12], 'candidates':[[s,round(n,2)] for n,s,_ in ranked[:3]],'question':plain(record['question'])[:360]})
 for lang in records:
  by_seq={p['sequence']:p for p in KNOWLEDGE[lang]}
  books=[]
  for book_key in [f'compulsory-{i}' for i in range(1,6)]+[f'elective-{i}' for i in range(1,5)]:
   book_points=[p for p in KNOWLEDGE[lang] if p['book_key']==book_key]
   chapter_codes=list(dict.fromkeys(p['code'] for p in book_points))
   chapters=[]
   for code in chapter_codes:
    cp=[p for p in book_points if p['code']==code]
    exercise_rows=[r for r in records[lang].values() if r['chapter']==code]
    sections=[]
    # Equal-title cards represent a single browsing topic even when the existing
    # knowledge library retains separate formula/definition sequence identities.
    principal={associations[r['id']][0] for r in exercise_rows}
    section_points=sorted([by_seq[n] for n in principal],key=lambda p:(p.get('textbook_order',{}).get('chapter',0),p.get('textbook_order',{}).get('page',0),p.get('textbook_order',{}).get('y',0)))
    topic_groups={}
    for p in section_points:
     topic_groups.setdefault(p.get('card_title') or p['chapter'],[]).append(p['sequence'])
    for title,sequences in topic_groups.items():
     ids=[r['id'] for r in exercise_rows if associations[r['id']][0] in sequences]
     sections.append({'id':str(sequences[0]),'title':title,'questionIds':sorted(ids,key=lambda key:int(records[lang][key]['number']))})
     for key in ids:records[lang][key]['section']=str(sequences[0])
    chapters.append({'id':code,'title':cp[0]['chapter'],'sections':sections,'count':len(exercise_rows)})
   books.append({'id':book_key,'title':book_points[0]['book'],'chapters':chapters,'count':sum(c['count'] for c in chapters)})
  summaries=[]
  for key,r in records[lang].items():
   summaries.append({'id':key,'chapter':r['chapter'],'number':r['number'],'kind':r['kind'],'knowledge':associations[key],'section':r['section'],'preview':plain(r['question'])[:150]})
  (OUT/f'index-{lang}.json').write_text(json.dumps({'version':1,'books':books,'questions':summaries},ensure_ascii=False,separators=(',',':')),encoding='utf8')
 (ROOT/'scripts/textbook-exercise-link-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding='utf8')
 print('Indexed',len(associations),'questions;',len(books),'books;',sum(len(c['sections']) for b in books for c in b['chapters']),'topic sections')
if __name__=='__main__':main()
