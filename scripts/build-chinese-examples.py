"""Publish original Chinese example crops with source coordinates and local HTML copies."""
from pathlib import Path
import json,re,hashlib,html,sys,shutil
import pypdfium2 as pdfium
ROOT=Path(__file__).resolve().parents[2];SITE=ROOT/'dse-physics-past-papers'
SCAN=ROOT/'tmp/chinese-examples';OUT=SITE/'assets/textbook-examples/chn'
LOCAL=ROOT/'output/中文版课本例题'

def chars_in(chars,box):
 x,y,r,b=box
 return [c for c in chars if x-1<=(c['box'][0]+c['box'][2])/2<=r+1 and y-1<=(c['box'][1]+c['box'][3])/2<=b+1]
def joined(chars):
 text='';positions=[]
 for c in chars:
  text+=c['t'];positions.extend([c['box']]*len(c['t']))
 return text,positions

def records_for(data):
 records=[];current=None
 doc=pdfium.PdfDocument(data['source'])
 for page in data['pages']:
  source_page=doc[page['page']-1]
  left,bottom,right,top=source_page.get_cropbox()
  crop_top=page['height']-top
  for c in page['chars']:
   x,y,r,b=c['box'];c['box']=[x-left,y+bottom,r-left,b+bottom]
  page['frames']=[[x-left,y-crop_top,r-left,b-crop_top] for x,y,r,b in page['frames']]
  source_page.close()
  for frame in page['frames']:
   text,positions=joined(chars_in(page['chars'],frame))
   heading=re.search(r'例\s*題\s*(\d+)\s*([^\r\n]*)',text)
   # Other blue frames are unit exercises, fact boxes and writing practice.
   # These two pages are the only unlabelled continuations of an example solution.
   continuation=(data['code'],page['page']) in {('205',18),('E103',31)}
   if not heading and not re.search(r'題\s*解|想\s*一\s*想',text) and not continuation:continue
   if heading:
    current={'number':int(heading[1]),'title':heading[2].strip(),'segments':[]}
    if data['code']=='3A03' and current['number']==12:current['title']='1/v 對 1/u 的關係線圖'
    records.append(current)
   if current is None:
    if data['code']=='E301' and page['page']==4:continue # Visually reviewed "知多一點" energy-efficiency sidebar.
    raise ValueError(('Orphan frame',data['code'],page['page'],text[:100]))
   answer=re.search(r'題\s*解',text)
   if answer:
    split=positions[answer.start()][1]-2
    if split>frame[1]+25:
     current['segments'].append({'page':page['page'],'kind':'question','box':[frame[0]-4,frame[1]-4,frame[2]+4,split],'text':text[:answer.start()]})
    current['segments'].append({'page':page['page'],'kind':'answer','box':[frame[0]-4,split,frame[2]+4,frame[3]+4],'text':text[answer.start():]})
   else:
    kind='answer' if any(s['kind']=='answer' for s in current['segments']) else 'question'
    current['segments'].append({'page':page['page'],'kind':kind,'box':[frame[0]-4,frame[1]-4,frame[2]+4,frame[3]+4],'text':text})
   margin=([40,frame[1]-8,frame[0]-8,frame[3]+4] if frame[0]>160 else [frame[2]+8,frame[1]-8,right-left-40,frame[3]+4])
   side_text,_=joined(chars_in(page['chars'],margin))
   if re.search(r'提\s*提\s*你|技\s*巧\s*分\s*析|想\s*一\s*想',side_text) and margin[2]-margin[0]>40:
    current['segments'].append({'page':page['page'],'kind':'tips','box':margin,'text':side_text})
 doc.close()
 return records

def main():
 OUT.mkdir(parents=True,exist_ok=True);LOCAL.mkdir(parents=True,exist_ok=True)
 index=json.loads((SITE/'assets/textbook-examples/index-chn.json').read_text(encoding='utf8'))
 en=json.loads((SITE/'assets/textbook-examples/index-eng.json').read_text(encoding='utf8'))
 questions=[];audit=[];errors=[]
 for book in index['books']:
  for chapter in book['chapters']:
   code=chapter['id'];path=SCAN/(code+'.json')
   if not path.exists():errors.append((code,'not scanned'));continue
   data=json.loads(path.read_text(encoding='utf8'))
   try: records=records_for(data)
   except ValueError as e:errors.append(str(e));continue
   expected=[q['number'] for q in en['questions'] if q['chapter']==code]
   if [r['number'] for r in records]!=expected:errors.append((code,'numbers',[r['number'] for r in records],expected));continue
   for r in records:
    if not all(any(s['kind']==kind for s in r['segments']) for kind in ['question','answer']):errors.append((code,r['number'],'missing question/answer'))
   audit.append({'code':code,'source':data['source'],'records':records})
 (SCAN/'crop-plan.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding='utf8')
 print(json.dumps(errors,ensure_ascii=False),flush=True)
 if '--check' in sys.argv or errors:return
 for chapter in audit:
  code=chapter['code'];doc=pdfium.PdfDocument(chapter['source']);cache={}
  sha=hashlib.sha256(Path(chapter['source']).read_bytes()).hexdigest();items={}
  media=OUT/code;media.mkdir(exist_ok=True)
  for raw in chapter['records']:
   key=f'ex-{code}-{raw["number"]}'
   record={'id':key,'chapter':code,'number':raw['number'],'title':raw['title'],'question':'','answer':'','tips':'','think':'','thinkAnswer':'','source':{'file':Path(chapter['source']).name,'sha256':sha,'segments':raw['segments']},'language':'chn'}
   for i,s in enumerate(raw['segments']):
    if s['page'] not in cache:cache[s['page']]=doc[s['page']-1].render(scale=2.5).to_pil().convert('RGB')
    box=s['box'];im=cache[s['page']].crop(tuple(round(v*2.5) for v in box));name=f'{key}-{s["kind"]}-{i+1}.jpg'
    im.save(media/name,quality=91,subsampling=0)
    record[s['kind']]+=f'<p><img src="assets/textbook-examples/chn/{code}/{name}" alt="例題 {raw["number"]} {dict(question="題目",answer="解答",tips="課本旁註")[s["kind"]]}" style="width:{round(2*(box[2]-box[0]))}px"/></p>'
   text=' '.join(s['text'] for s in raw['segments'] if s['kind']=='question')
   text=re.sub(r'\s+',' ',text).strip()
   questions.append({'id':key,'chapter':code,'number':raw['number'],'title':raw['title'],'preview':text[:200],'searchText':text})
   items[key]=record
  (OUT/(code+'.json')).write_text(json.dumps(items,ensure_ascii=False,separators=(',',':')),encoding='utf8')
  content=''.join(f'<article><h2>例題 {r["number"]} · {html.escape(r["title"])}</h2>{r["question"]}<h3>題解</h3>{r["answer"]}'+(f'<details><summary>課本旁註</summary>{r["tips"]}</details>' if r['tips'] else '')+'</article>' for r in items.values())
  # Relative paths keep these copies usable without the preview server.
  shutil.copytree(media,LOCAL/'图片'/code,dirs_exist_ok=True)
  content=content.replace('src="assets/textbook-examples/chn/', 'src="图片/')
  (LOCAL/(code+'.html')).write_text('<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>'+code+' 中文課本例題</title><style>body{max-width:850px;margin:32px auto;padding:20px;font-family:system-ui}img{max-width:100%;height:auto}article{border-bottom:1px solid #ddd;padding:24px 0}h2{color:#145f96}</style>'+content+'</html>',encoding='utf8')
  doc.close();print(code,len(items),flush=True)
 index.update(contentLanguage='chn',questions=questions,count=len(questions))
 (SITE/'assets/textbook-examples/index-chn.json').write_text(json.dumps(index,ensure_ascii=False,separators=(',',':')),encoding='utf8')
 (LOCAL/'来源与裁切记录.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding='utf8')
 (LOCAL/'index.html').write_text('<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>中文版課本例題</title><h1>中文版課本例題</h1>'+''.join('<h2>'+html.escape(b['title'])+'</h2><ul>'+''.join(f'<li><a href="{c["id"]}.html">{c["id"]} · {html.escape(c["title"])}（{c["count"]} 道）</a></li>' for c in b['chapters'])+'</ul>' for b in index['books'])+'</html>',encoding='utf8')

if __name__=='__main__':main()
