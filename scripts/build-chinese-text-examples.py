"""Extract Chinese example prose, formulae and separate diagrams into reviewable HTML.

Uses original Chinese PDFs and preserves the existing bilingual example identities.
Extraction is staged separately; the publishing step validates the complete corpus.
"""
from pathlib import Path
import importlib.util,json,re,html,sys,concurrent.futures
import pdfplumber,pypdfium2 as pdfium
SITE=Path(__file__).resolve().parents[1];ROOT=SITE.parent
OUT=ROOT/'tmp/chinese-text-examples';OUT.mkdir(exist_ok=True)
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,Path(__file__).parent/file)
 m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
GLYPHS=module('chinese_glyphs','chinese-example-glyphs.py')
X=module('chinese_layout','chinese-example-layout.py')
X.normal=lambda c:any(f in c.get('fontname','') for f in ['MSung','Guardi','AdobeMing']) and c.get('size',0)<18
def text(s):
 s=s.replace('\t',' ').replace('\u2009',' ')
 s=re.sub(r'(?<=[\u3400-\u9fff]) +(?=[\u3400-\u9fff，。；：？、])','',s)
 s=re.sub(r'(?<=[，。；：？、]) +(?=[\u3400-\u9fff])','',s)
 return s.strip()
def htmltext(s):
 s=text(s)
 s=re.sub(r'\$([^$]+)\$((?:[_^]\{[^{}]*\})+)',r'$\1\2$',s)
 # Inline mathematical runs are rendered to MathML by the publication step.
 chunks=re.split(r'(\$[^$]+\$)',s)
 def plain(x):
  x=html.escape(x)
  x=re.sub(r'_\{([^{}]*)\}',r'<sub>\1</sub>',x)
  return re.sub(r'\^\{([^{}]*)\}',r'<sup>\1</sup>',x)
 return ''.join('<span data-math="'+html.escape(x[1:-1],quote=True)+'"></span>' if x.startswith('$') and x.endswith('$') else plain(x) for x in chunks)
def extract_segment(pg,seg,doc,identity,index,figure_limit):
 frame=seg['box'];offsetX=pg.cropbox[0];offsetY=pg.cropbox[1]
 chars=[dict(c) for c in pg.chars]
 objects=[dict(o) for o in pg.lines+pg.rects+pg.curves+pg.images]
 for c in chars+objects:
  c['x0']-=offsetX;c['x1']-=offsetX;c['top']-=offsetY;c['bottom']-=offsetY
 chars=[c for c in chars if X.inside(c,frame,1) and c.get('upright',True)]
 for c in chars:
  glyph=c.get('glyph','');m=re.match('uni([0-9A-Fa-f]{4})',glyph)
  if m:c['text']=chr(int(m[1],16))
  elif glyph=='space':c['text']=' '
 objects=[o for o in objects if X.inside(o,frame,1)]
 headings=[g for g in X.lines(chars) if re.search(r'想.*一.*想',X.textline(g))]
 if headings:
  limit=min(g['bbox'][1] for g in headings)
  chars=[c for c in chars if c['bottom']<limit+1];objects=[o for o in objects if o['bottom']<limit+1]
 # Remove the source's example heading; the website supplies the shared heading.
 if seg['kind']=='question':
  heads=[c for c in chars if 'CHei2' in c['fontname'] and c['size']>=12]
  if heads:
   bottom=max(c['bottom'] for c in heads)
   chars=[c for c in chars if c['top']>bottom-1]
   objects=[o for o in objects if o['top']>bottom]
 grids=X.tables(chars,objects)
 chars=[c for c in chars if not any(X.inside(c,t['bbox'],1) for t in grids)]
 objects=[o for o in objects if not any(X.inside(o,t['bbox'],1) for t in grids)]
 pics=X.figure_boxes({},frame,chars,objects) if seg['kind']!='tips' else []
 pics=[b for b in pics if b[2]-b[0]>35 and b[3]-b[1]>25]
 pics=sorted(pics,key=lambda b:(b[1],b[0]))  # All subfigures must mask their labels, including composite English images.
 # Include nearby diagram lettering, but never adjacent body prose.
 for i,b in enumerate(pics):
  labels=[X.box(c) for c in chars if any(f in c['fontname'] for f in ['Helvetica','MHei','Myriad']) and X.touch(X.box(c),b,25)]
  if labels:pics[i]=X.union([b]+labels)
 body=[c for c in chars if not any(X.inside(c,b,1) for b in pics)]
 body,bars=X.fractionate(body,objects)
 for c in body:
  if c.get('math'):
   nearby=[v for v in body if not v.get('math') and v['text'].strip() and min(abs(c['x0']-v['x1']),abs(c['x1']-v['x0']))<18 and abs(c['top']-v['top'])<13 and v.get('size',0)>=9]
   if nearby:c['top']=min(nearby,key=lambda v:abs(c['top']-v['top']))['top'];c['bottom']=c['top']+10
 rows=[{'type':'text','bbox':g['bbox'],'text':text(X.textline(g))} for g in X.lines(body) if text(X.textline(g))]
 rows+=grids
 # The bilingual publisher reuses complete English master artwork, never partial PDF crops.
 rows.sort(key=lambda r:(r['bbox'][1],r['bbox'][0]))
 result=[];paragraph='';last=None
 def flush():
  nonlocal paragraph
  if paragraph:result.append('<p>'+htmltext(paragraph)+'</p>');paragraph=''
 for r in rows:
  if r['type']=='text':
   s=r['text']
   if re.fullmatch(r'題\s*解',s):continue
   if re.search(r'想\s*一\s*想',s):flush();break
   if last and (r['bbox'][1]-last['bbox'][3]>10 or re.match(r'^\(?[a-dａ-ｄivx]+\)|^[（(][一二三四]',s) or (not re.search('[\u3400-\u9fff]',s) and '=' in s) or paragraph.endswith(('。','？','：','；'))):flush()
   paragraph+=(' ' if paragraph and not re.search(r'[\u3400-\u9fff，。；：？、]$',paragraph) else '')+s
   last=r
  else:
   flush();last=None
   if r['type']=='figure':result.append(f'<p class="study-figure"><img src="{r["src"]}" alt="例題插圖" style="width:{(r["bbox"][2]-r["bbox"][0])*1.33:.1f}px"/></p>')
   else:result.append('<div class="study-table-wrap"><table><tbody>'+''.join('<tr>'+''.join('<td><p>'+htmltext(c)+'</p></td>' for c in row)+'</tr>' for row in r['cells'])+'</tbody></table></div>')
 flush()
 return ''.join(result),rows
def build(code):
 path=SITE/f'assets/textbook-examples/chn/{code}.json';records=json.loads(path.read_text(encoding='utf8'))
 source=json.loads((ROOT/f'tmp/chinese-examples/{code}.json').read_text(encoding='utf8'))['source'];audit=[]
 english=json.loads((SITE/f'assets/textbook-examples/eng/{code}.json').read_text(encoding='utf8'))
 with pdfplumber.open(source) as pdf:
  doc=pdfium.PdfDocument(source)
  for record in records.values():
   fields={x:[] for x in ['question','answer','tips']}
   for i,seg in enumerate(record['source']['segments']):
    figure_limit=len(re.findall('<img ',english[record['id']][seg['kind']]))
    content,rows=extract_segment(pdf.pages[seg['page']-1],seg,doc,record['id'],i,figure_limit)
    fields[seg['kind']].append(content);audit.append({'id':record['id'],'kind':seg['kind'],'page':seg['page'],'rows':rows})
   for field,content in fields.items():record[field]=''.join(content)
   record['format']='editable-text'
  doc.close()
 (OUT/f'{code}.json').write_text(json.dumps(records,ensure_ascii=False),encoding='utf8')
 (OUT/f'{code}-audit.json').write_text(json.dumps(audit,ensure_ascii=False),encoding='utf8')
 return code
if __name__=='__main__':
 codes=sys.argv[1:] or [p.stem for p in (SITE/'assets/textbook-examples/chn').glob('*.json')]
 with concurrent.futures.ProcessPoolExecutor(max_workers=4) as pool:
  for code in pool.map(build,codes):print(code,flush=True)
