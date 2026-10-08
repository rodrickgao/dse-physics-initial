"""Read-only per-edition inventory. Structural checks do not certify physics answers."""
import json, re, sqlite3, hashlib
from pathlib import Path
from collections import Counter
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parent / 'output/full-audit-20261009'
OUT.mkdir(parents=True, exist_ok=True)
rows, assets = [], {}
files = list((ROOT/'text-papers').glob('*-*.json'))
for folder in ['textbook-examples','textbook-exercises']:
    for lang in ['chn','eng']:
        files += list((ROOT/'assets'/folder/lang).glob('*.json'))
for file in files:
    lang = file.stem.split('-')[-1] if file.parent.name=='text-papers' else file.parent.name
    if lang not in ['chn','eng']: continue
    for key, q in json.loads(file.read_text(encoding='utf-8')).items():
        if not isinstance(q,dict): continue
        fields = ['question','official','reasoning'] if '|' in key else (['question','answer','tips','think','thinkAnswer'] if key.startswith('ex-') else ['question','answer','reasoning'])
        issues=[]; refs=[]
        for field in fields:
            html=q.get(field,'') or ''
            if field in ['question','answer','official'] and not html.strip(): issues.append('empty:'+field)
            if '\\"' in html: issues.append('escaped_attributes:'+field)
            normalized=html.replace('\\"','"')
            for src in re.findall(r'(?:src|href)=[\"\']([^\"\']+)',normalized):
                if not src.startswith(('assets/','text-papers/','/assets/')): continue
                path=ROOT/src.lstrip('/'); refs.append(src)
                if src not in assets:
                    status='ok' if path.is_file() else 'missing'
                    if status=='ok' and path.suffix.lower() in ['.png','.jpg','.jpeg','.gif','.webp']:
                        try:
                            with Image.open(path) as im: im.verify()
                        except Exception: status='invalid_image'
                    assets[src]=status
                if assets[src]!='ok': issues.append(assets[src]+':'+src)
        if bool(q.get('think')) != bool(q.get('thinkAnswer')): issues.append('think_pair_incomplete')
        notes=[]
        if key.startswith('tb-') and q.get('kind')=='multiple-choice' and not (q.get('reasoning') or '').strip():notes.append('answer_only_no_worked_explanation')
        rows.append(dict(id=key,language=lang,file=str(file.relative_to(ROOT)),issues=issues,notes=notes,assets=len(refs),semantic_review='not_independently_verified'))
db=ROOT.parent/'真题库/dse-physics.sqlite3'
canonical={}
if db.exists():
    con=sqlite3.connect(f'file:{db.as_posix()}?mode=ro',uri=True)
    for field in ['question_status','official_status','reasoning_status']:
        canonical[field]=dict(con.execute(f'SELECT {field},count(*) FROM editions GROUP BY {field}'))
    canonical['issues']=[dict(zip(['id','language','issue'],r)) for r in con.execute('SELECT question_key,language,issue FROM issues')]
    canonical['site_differences']=[]
    hashes={}
    def canonical_html(value):
        def asset(m):
            src=m[1]
            if src.startswith('asset://'):return 'src="'+src+'"'
            path=ROOT/src.lstrip('/')
            if path.is_file():
                if src not in hashes:hashes[src]=hashlib.sha256(path.read_bytes()).hexdigest()
                return 'src="asset://'+hashes[src]+'"'
            return m[0]
        normalized=re.sub(r'src="([^"]+)"',asset,(value or '').strip())
        return re.sub(r'(<p>)(?:Official answer:|(?:官方)?答案[：:])\s*(?=[ABCD]</p>)',r'\1',normalized)
    papers={}
    for key,lang,question,official,reasoning in con.execute('SELECT question_key,language,question_html,official_html,reasoning_html FROM editions'):
        lang={'en':'eng','zh-Hant':'chn'}.get(lang,lang)
        filename=f'{key.split("|")[0]}-{lang}.json'
        if filename not in papers:
            path=ROOT/'text-papers'/filename
            papers[filename]=json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}
        site=papers[filename].get(key,{})
        fields=[field for field,value in [('question',question),('official',official),('reasoning',reasoning)] if canonical_html(site.get(field))!=canonical_html(value)]
        if fields:canonical['site_differences'].append({'id':key,'language':lang,'fields':fields})
    con.close()
summary={'editions':len(rows),'unique_questions':len(set(r['id'] for r in rows)), 'by_source':dict(Counter('examples' if r['id'].startswith('ex-') else 'exercises' if r['id'].startswith('tb-') else 'papers' for r in rows)), 'flagged_editions':sum(bool(r['issues']) for r in rows),'issue_counts':dict(Counter(i.split(':')[0] for r in rows for i in r['issues'])),'unique_assets':len(assets),'bad_assets':{k:v for k,v in assets.items() if v!='ok'},'canonical_status':canonical}
(OUT/'content-ledger.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
(OUT/'answer-only-questions.json').write_text(json.dumps([r for r in rows if r['notes']],ensure_ascii=False,indent=2),encoding='utf-8')
(OUT/'content-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in summary.items() if k not in ['canonical_status','bad_assets']},ensure_ascii=False))
