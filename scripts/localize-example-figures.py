"""Localize PDF text in complete source artwork; leave graph paths and images intact.

Run after the reviewed region inventory has been refreshed. Original English
assets are immutable. Every Chinese replacement is recorded with source hashes,
crop coordinates and translations; publication applies this separate manifest.
"""
from pathlib import Path
import sys,json,hashlib,math,re
ROOT=Path(__file__).resolve().parents[2];SITE=ROOT/'dse-physics-past-papers'
sys.path.insert(0,str(ROOT/'tmp/lecture-pdf-runtime'))
import pymupdf as fitz
from PIL import Image,ImageChops,ImageDraw
sys.stdout.reconfigure(encoding='utf8')
RUN=ROOT/'output/pdf/chinese-illustrations-20261010';DEST=SITE/'assets/textbook-examples/figures-chn';DEST.mkdir(exist_ok=True)
translations=dict(l.split('|',1)for l in (SITE/'scripts/chinese-example-figure-labels.tsv').read_text(encoding='utf8').splitlines()if '|'in l)
regions=json.loads((RUN/'label-regions.json').read_text(encoding='utf8'))
paragraphs=json.loads((SITE/'scripts/chinese-example-figure-paragraphs.json').read_text(encoding='utf8'))
contexts=json.loads((SITE/'scripts/chinese-example-figure-contexts.json').read_text(encoding='utf8'))
fontPath='C:/Windows/Fonts/msyh.ttc'
previous=json.loads((SITE/'scripts/chinese-example-figures.json').read_text(encoding='utf8'))if '--refine' in sys.argv else {}
manifest={};font=fitz.Font(fontfile=fontPath);changed=[];docs={}
for f in regions:
 selected=[l for l in f['labels']if l['text']in translations]
 if not selected:continue
 key=f['src']
 if key in manifest:continue
 only=next((a.split('=',1)[1].split(',')for a in sys.argv if a.startswith('--only-src=')),None)
 if only and Path(key).stem not in only:
  if key in previous:manifest[key]=previous[key];changed.append((SITE/previous[key]['src'],key,f['code'],f['example']))
  continue
 if key in previous and not only and not any(len(l['text'])>15 or l['text'].startswith(('①','②'))for l in selected):
  manifest[key]=previous[key];changed.append((SITE/previous[key]['src'],key,f['code'],f['example']));continue
 source=f['actualSource']
 if source not in docs:docs[source]=fitz.open(source)
 sourcepage=docs[source][f['page']-1];clip=fitz.Rect(f['rect'])
 paragraphsForFigure=paragraphs.get(key,[])
 selected=[l for l in selected if not any(fitz.Rect([l['bbox'][0]-clip.x0,l['bbox'][1]-clip.y0,l['bbox'][2]-clip.x0,l['bbox'][3]-clip.y0]).intersects(fitz.Rect(p['box']))for p in paragraphsForFigure)]
 # Work on the actual PDF objects, not a raster or recreated diagram.
 doc=fitz.open();pg=doc.new_page(width=clip.width,height=clip.height)
 pg.show_pdf_page(pg.rect,docs[source],f['page']-1,clip=clip)
 before=pg.get_pixmap(matrix=fitz.Matrix(3,3),alpha=False).pil_image()
 pathContent=lambda paths:[{k:v for k,v in p.items()if k not in ('seqno',)}for p in paths]
 originalDrawings=pathContent(pg.get_drawings());originalImages=pg.get_images(full=True)
 changes=[]
 for p in paragraphsForFigure:pg.add_redact_annot(fitz.Rect(p['box']),fill=False,cross_out=False)
 for line in selected:
  # Redact individual text spans so independent mathematical labels survive.
  for span in line['spans']:
   box=fitz.Rect(span['bbox']);box.x0-=clip.x0;box.x1-=clip.x0;box.y0-=clip.y0;box.y1-=clip.y0
   if abs(line.get('direction',[1,0])[1])<.5:
    center=span['origin'][1]-clip.y0-span['size']*.35
    box.y0=center-span['size']*.1;box.y1=center+span['size']*.1
   else:
    center=(box.x0+box.x1)/2;box.x0=center-span['size']*.1;box.x1=center+span['size']*.1
   pg.add_redact_annot(box,fill=False,cross_out=False)
 pg.apply_redactions(images=0,graphics=0,text=0)
 # Existing paths and embedded photos must be byte-for-byte identical.
 afterErase=pg.get_pixmap(matrix=fitz.Matrix(3,3),alpha=False).pil_image()
 mask=Image.new('L',before.size,255);md=ImageDraw.Draw(mask)
 for p in paragraphsForFigure:md.rectangle(tuple(v*3 for v in p['box']),fill=0)
 for line in selected:
  for span in line['spans']:
   b=span['bbox'];md.rectangle(((b[0]-clip.x0)*3-3,(b[1]-clip.y0)*3-3,(b[2]-clip.x0)*3+3,(b[3]-clip.y0)*3+3),fill=0)
 difference=ImageChops.difference(before,afterErase).convert('L');difference=ImageChops.multiply(difference,mask)
 if difference.getbbox():
  before.save(RUN/'pixel-before.png');afterErase.save(RUN/'pixel-after.png');difference.save(RUN/'pixel-diff.png')
  raise AssertionError('Artwork changed outside text: '+key)
 for line in selected:
  text=contexts.get(key,{}).get(line['text'],translations[line['text']]);b=fitz.Rect(line['bbox']);b.x0-=clip.x0;b.x1-=clip.x0;b.y0-=clip.y0;b.y1-=clip.y0
  size=max(7,min(10,max(s['size']for s in line['spans'])))
  direction=line.get('direction',[1,0]);rotate=90 if direction[1]<-.5 else 270 if direction[1]>.5 else 0
  length=font.text_length(text,fontsize=size)
  maxLength=clip.height-4 if rotate else clip.width-4
  if len(line['text'])>15 or line['text'].startswith(('①','②')):
   maxLength=min(maxLength,b.height if rotate else b.width)
  if length>maxLength:size*=maxLength/length;length=maxLength
  color=line['spans'][0].get('color',0);rgb=tuple(((color>>shift)&255)/255 for shift in (16,8,0))
  if rotate==0:
   x=max(1,min(clip.width-length-1,(b.x0+b.x1-length)/2));y=min(clip.height-size*.35-1,b.y0+size)
  elif rotate==90:
   x=min(clip.width-1,b.x0+size);y=max(length+1,min(clip.height-1,(b.y0+b.y1+length)/2))
  else:
   x=max(1,b.x1-size);y=max(1,min(clip.height-length-1,(b.y0+b.y1-length)/2))
  pg.insert_text((x,y),text,fontsize=size,fontname='ChineseLabels',fontfile=fontPath,color=rgb,rotate=rotate)
  changes.append(dict(english=line['text'],chinese=text,bbox=list(b),fontsize=size,rotation=rotate))
 for p in paragraphsForFigure:
  b=fitz.Rect(p['box']) & fitz.Rect(1,1,clip.width-2,clip.height-2);size=min(8.5,min((b.width-1)/font.text_length(text,fontsize=1)for text in p['lines']))
  assert len(p['lines'])*size*1.2<b.height,(key,p)
  for i,text in enumerate(p['lines']):pg.insert_text((b.x0,b.y0+size+i*size*1.2),text,fontsize=size,fontname='ChineseLabels',fontfile=fontPath,color=(0,.68,.95))
  changes.append({'english':'Reviewed complete explanatory paragraph','chinese':'\n'.join(p['lines']),'bbox':p['box'],'fontsize':size,'rotation':0})
 # Chinese PDF labels are searchable and checked before rasterizing the figure.
 actual=pg.get_text()
 for c in changes:
  assert re.sub(r'\s+','',c['chinese'])in re.sub(r'\s+','',actual),(key,c,actual)
 name=Path(key).name;target=DEST/name
 pg.get_pixmap(matrix=fitz.Matrix(3,3),alpha=False).save(target)
 manifest[key]={'src':str(target.relative_to(SITE)).replace('\\','/'),'originalSha256':hashlib.sha256((SITE/key).read_bytes()).hexdigest(),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'source':f['source'],'sourceSha256':hashlib.sha256(Path(f['source']).read_bytes()).hexdigest(),'page':f['page'],'bbox':f['bbox'],'translations':changes,'pathsPreserved':True,'embeddedImagesPreserved':True}
 changed.append((target,key,f['code'],f['example']))
 doc.close()
for key,entry in previous.items():
 if key not in manifest:manifest[key]=entry
(SITE/'scripts/chinese-example-figures.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
cols=4;rows=6
for start in range(0,len(changed),cols*rows):
 group=changed[start:start+cols*rows];sheet=Image.new('RGB',(1600,360*math.ceil(len(group)/cols)),'white');d=ImageDraw.Draw(sheet)
 for i,(p,key,code,n)in enumerate(group):
  x=i%cols*400;y=i//cols*360;im=Image.open(p).convert('RGB');im.thumbnail((390,325));sheet.paste(im,(x+(400-im.width)//2,y+28));d.text((x+5,y+4),f'{start+i}: {code}/{n} {p.stem[:9]}',fill='black')
 sheet.save(RUN/f'localized-{start//(cols*rows)+1:02}.png')
print(json.dumps({'localizedFigures':len(manifest),'translatedLabels':sum(len(f['translations'])for f in manifest.values()),'codes':sorted(set(f[2]for f in changed))},ensure_ascii=False))
