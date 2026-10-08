"""Locate original Chinese example frames and readable PDFium text."""
from pathlib import Path
import concurrent.futures, json, re, sys
import pdfplumber
import pypdfium2 as pdfium
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'tmp/chinese-examples'
SOURCE=Path('C:/Users/rodri/Desktop/dse/phy/物理教材')

def scan(path):
 code=re.search(r'TE_(.*?)_TN',path.name)[1]
 target=OUT/(code+'.json')
 if target.exists() and json.loads(target.read_text(encoding='utf8'))['pages']: return code
 result={'code':code,'source':str(path),'pages':[]}
 doc=pdfium.PdfDocument(path)
 with pdfplumber.open(path) as pdf:
  for i,p in enumerate(pdf.pages):
   frames=[]
   for r in p.rects+p.curves:
    c=r.get('stroking_color')
    blue=isinstance(c,(tuple,list)) and ((len(c)==3 and all(abs(a-b)<.025 for a,b in zip(c,(.895,.954,.975)))) or (len(c)==4 and all(abs(a-b)<.015 for a,b in zip(c,(.13,0,.03,0)))))
    if blue and r.get('linewidth',0)>=3 and r['width']>260 and r['height']>30 and 0<=r['x0']<p.width and r['x1']<=p.width+1:
     box=[r['x0'],max(0,r['top']),r['x1'],min(p.height,r['bottom'])]
     if not any(abs(box[1]-b[1])<2 and abs(box[3]-b[3])<2 for b in frames):frames.append(box)
   if frames:
    page=doc[i];tp=page.get_textpage(); chars=[]
    for j in range(tp.count_chars()):
     l,b,r,t=tp.get_charbox(j)
     if 0<=l<page.get_width() and 0<=b<page.get_height():
      chars.append({'t':tp.get_text_range(j,1),'box':[l,page.get_height()-t,r,page.get_height()-b]})
    result['pages'].append({'page':i+1,'width':p.width,'height':p.height,'frames':sorted(frames,key=lambda b:b[1]),'chars':chars})
    tp.close();page.close()
   p.close()
 doc.close()
 target.write_text(json.dumps(result,ensure_ascii=False),encoding='utf8')
 return code

if __name__=='__main__':
 OUT.mkdir(parents=True,exist_ok=True)
 codes=[b['id'] for a in json.loads((ROOT/'dse-physics-past-papers/assets/textbook-examples/index-eng.json').read_text(encoding='utf8'))['books'] for b in a['chapters']]
 paths=[next(SOURCE.glob(f'DSEPHY_TE_{c}_TN_ce*.pdf')) for c in codes if not sys.argv[1:] or c in sys.argv[1:]]
 with concurrent.futures.ProcessPoolExecutor(max_workers=4) as pool:
  for code in pool.map(scan,paths):print(code,flush=True)
