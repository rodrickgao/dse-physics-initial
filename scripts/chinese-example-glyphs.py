from pathlib import Path
import json,pdfplumber,pdfminer.converter as cv,pdfminer.pdffont as pf,concurrent.futures,re
from pdfminer.pdftypes import resolve1
from pdfminer.psparser import PSLiteral
BASE=Path(__file__).resolve().parent
oldinit=pf.PDFType1Font.__init__
def init(self,rs,spec):
 oldinit(self,rs,spec);self.actualglyphs={}
 if 'Lucida' not in str(self.fontname):return
 enc=resolve1(spec.get('Encoding',{}))
 if not isinstance(enc,dict):return
 cid=0
 for v in resolve1(enc.get('Differences',[])):
  if isinstance(v,int):cid=v
  else:self.actualglyphs[cid]=v.name if isinstance(v,PSLiteral) else str(v);cid+=1
pf.PDFType1Font.__init__=init
original=cv.PDFLayoutAnalyzer.render_char
def render(self,*a,**kw):
 v=original(self,*a,**kw);font=a[1];cid=a[5];self.cur_item._objs[-1].glyph=getattr(font,'actualglyphs',{}).get(cid,'');return v
cv.PDFLayoutAnalyzer.render_char=render
pdfplumber.page.ALL_ATTRS.add('glyph')
def update(path):
 d=json.loads(path.read_text(encoding='utf-8'))
 if d.get('glyph_enriched'):return d['code']
 pp=[p for p in d['pages'] if any('LucidaMath' in c['fontname'] for c in p['chars'])]
 if pp:
  with pdfplumber.open(d['source']) as pdf:
   for p in pp:
    lookup={(round(c['x0'],3),round(c['top'],3),c['text']):c for c in pdf.pages[p['n']-1].chars if 'LucidaMath' in c['fontname']}
    for c in p['chars']:
     if 'LucidaMath' not in c['fontname']:continue
     raw=lookup.get((round(c['x0'],3),round(c['top'],3),c['text']))
     if raw:
      c['glyph']=raw['glyph'];match=re.match('uni([0-9A-Fa-f]{4})',raw['glyph']);c['original_text']=c['text']
      if match:c['text']=chr(int(match[1],16))
      elif raw['glyph']=='space':c['text']=' '
 d['glyph_enriched']=True;path.write_text(json.dumps(d,ensure_ascii=False),encoding='utf-8')
 return d['code']
if __name__=='__main__':
 inv=json.loads((BASE/'inventory.json').read_text(encoding='utf-8'))
 with concurrent.futures.ProcessPoolExecutor(max_workers=4) as pool:
  for r in pool.map(update,[BASE/(d['code']+'.json') for d in inv]):print(r,flush=True)
