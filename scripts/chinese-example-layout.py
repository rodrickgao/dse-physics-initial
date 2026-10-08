from pathlib import Path
import json,math,re,statistics
BASE=Path(__file__).resolve().parent

def box(a):return [a['x0'],a['top'],a['x1'],a['bottom']]
def union(xs):return [min(x[0] for x in xs),min(x[1] for x in xs),max(x[2] for x in xs),max(x[3] for x in xs)]
def inside(c,b,pad=0):return c['x0']>=b[0]-pad and c['x1']<=b[2]+pad and c['top']>=b[1]-pad and c['bottom']<=b[3]+pad
def touch(a,b,p=0):return a[0]<=b[2]+p and a[2]>=b[0]-p and a[1]<=b[3]+p and a[3]>=b[1]-p
def normal(c):return any(v in c.get('fontname','') for v in ['Guardi','Frutiger','Cronos']) and c['size']<18

def lines(chars):
 # Preserve text and attach smaller sub/superscript glyphs to their parent baseline.
 big=[c for c in chars if c.get('size',10)>=8.7 or c.get('math')]
 small=[c for c in chars if c not in big]
 groups=[]
 for c in sorted(big,key=lambda c:(c['top'],c['x0'])):
  ys=[abs(g['y']-c['top']) for g in groups]
  if ys and min(ys)<2.1:groups[ys.index(min(ys))]['chars'].append(c)
  else:groups.append({'y':c['top'],'chars':[c]})
 for c in small:
  near=[]
  for j,g in enumerate(groups):
   if g['y']-7<c['top']<g['y']+9:
    dx=min(abs(c['x0']-v['x1']) for v in g['chars']);near.append((dx+abs(g['y']-c['top'])*.3,j))
  if near and min(near)[0]<15:groups[min(near)[1]]['chars'].append(c)
  else:groups.append({'y':c['top'],'chars':[c]})
 merged=[]
 for g in sorted(groups,key=lambda g:g['y']):
  if merged and abs(g['y']-merged[-1]['y'])<2.1:merged[-1]['chars']+=g['chars']
  else:merged.append(g)
 groups=merged
 for g in groups:
  g['chars'].sort(key=lambda c:c['x0']);g['bbox']=union([box(c) for c in g['chars']])
 return sorted(groups,key=lambda g:g['y'])

def textline(g):
 out='';prev=None;base=g['y'];smallmode=None
 for c in g['chars']:
  t=c.get('math') or c['text']
  if prev and c['x0']-prev['x1']>1.5 and not out.endswith(' ') and not t.startswith(' '):out+=' '
  if c.get('size',10)<max(v.get('size',10) for v in g['chars'])*.8 and max(v.get('size',10) for v in g['chars'])>=7 and not c.get('math') and t.strip():
   t=('_{' if c['top']>base+2 else '^{')+t+'}'
  if 'Italic' in c.get('fontname','') and not c.get('math') and c.get('size',10)>=8 and t.strip(): t='$'+t+'$'
  out+=t;prev=c
 out=out.replace('$$','').strip()
 out=re.sub(r'\}([_^])\{',lambda m:'' if m[1] in out else m[0],out) if False else out
 while re.search(r'([_^])\{([^{}]*)\}\1\{([^{}]*)\}',out):out=re.sub(r'([_^])\{([^{}]*)\}\1\{([^{}]*)\}',r'\1{\2\3}',out)
 return re.sub(' +',' ',out)

def fractionate(chars,objects):
 chars=[dict(c) for c in chars]
 brackets=[c for c in chars if c['text'] in '()[]' and 'LucidaMath' in c.get('fontname','')]
 for c in brackets:
  bs=[o for o in objects if o['object_type']=='line' and o['height']<.3 and 3<o['width']<220 and min(abs(c['x1']-o['x0']),abs(c['x0']-o['x1']))<12 and abs(c['top']-o['top'])<30]
  if bs:
   bar=min(bs,key=lambda o:abs(c['top']-o['top'])+min(abs(c['x1']-o['x0']),abs(c['x0']-o['x1']))*.7);c['top']=bar['top']-4.5;c['bottom']=c['top']+10
  c['fontname']='Guardi';c['size']=10
 brackets=[]
 bars=[o for o in objects if o['object_type']=='line' and abs(o['bottom']-o['top'])<.3 and 3<o['width']<230 and (o.get('linewidth') or 0)<1.2]
 used=[]
 roots=[c for c in chars if 'LucidaMath' in c.get('fontname','') and c['text']=='√']
 for root in roots:
  possible=[o for o in bars if abs(o['x0']-root['x1'])<3 and root['top']-32<o['top']<root['top']+1]
  if not possible:continue
  bar=min(possible,key=lambda o:abs(o['x0']-root['x1']))
  inner=[c for c in chars if c is not root and 'LucidaMath' not in c.get('fontname','') and c['x0']>=bar['x0']-1 and c['x1']<=bar['x1']+1 and c['top']>=bar['top']-1 and c['bottom']<=root['bottom']+3]
  if not inner:continue
  nested=[o for o in objects if o is not bar and o['x0']>=bar['x0']-1 and o['x1']<=bar['x1']+1 and o['top']>bar['top']+1 and o['bottom']<=root['bottom']+3]
  parsed,_=fractionate(inner,nested)
  expr=' '.join(textline(g) for g in lines(parsed)).replace('$','')
  chars=[c for c in chars if c not in inner and c is not root]
  ty=min((c['top'] for c in parsed if c.get('math') or (c['text'].strip() and c.get('size',10)>=8)),default=root['top'])
  eqs=[c for c in chars if c['text']=='=' and abs(c['top']-ty)<18 and min(abs(c['x1']-root['x0']),abs(c['x0']-bar['x1']))<16]
  if root['size']>=8 and eqs:ty=min(eqs,key=lambda c:abs(c['top']-ty))['top']
  chars.append({'text':'','math':'$\\sqrt{'+expr+'}$','x0':root['x0'],'x1':bar['x1'],'top':ty,'bottom':ty+10,'size':10,'fontname':'Math'})
  used.append(bar)
 chars=[c for c in chars if 'LucidaMath' not in c.get('fontname','')]
 for b in sorted([b for b in bars if b not in used],key=lambda o:o['width']):
  above=[c for c in chars if c['x0']>=b['x0']-1.5 and c['x1']<=b['x1']+1.5 and b['top']-16<c['top']<b['top']-1 and c['bottom']<=b['top']+2]
  below=[c for c in chars if c['x0']>=b['x0']-1.5 and c['x1']<=b['x1']+1.5 and b['top']-1<c['top']<b['top']+12]
  above=[c for c in above if c['text'].strip() or c.get('math')];below=[c for c in below if c['text'].strip() or c.get('math')]
  if not above:above=[c for c in chars if c.get('math') and c['x0']>=b['x0'] and c['x1']<=b['x1'] and c['x1']-c['x0']<b['width']-2 and b['top']-35<c['top']<b['top']-1]
  if not below:below=[c for c in chars if c.get('math') and c['x0']>=b['x0'] and c['x1']<=b['x1'] and c['x1']-c['x0']<b['width']-2 and b['top']-1<c['top']<b['top']+28]
  if not above or not below:continue

  # Table/grid lines and graphical rules are not fraction bars.
  if any(len(c['text'])>1 and not c.get('math') for c in above+below):continue
  a=union([box(c) for c in above]);d=union([box(c) for c in below])
  if max(a[2]-a[0],d[2]-d[0])<b['width']*.45:continue
  num=' '.join(textline(g) for g in lines(above)).replace('$','');den=' '.join(textline(g) for g in lines(below)).replace('$','')
  if re.fullmatch(r'[A-Za-z][A-Za-z ]{7,}',num) or num in ('time','volume','area','mass'):num='\\text{'+num+'}'
  if re.fullmatch(r'[A-Za-z][A-Za-z ]{7,}',den) or den in ('time','volume','area','mass'):den='\\text{'+den+'}'
  chars=[c for c in chars if c not in above+below]
  chars.append({'text':'','math':'$\\frac{'+num+'}{'+den+'}$','x0':b['x0'],'x1':b['x1'],'top':b['top']-4.5,'bottom':b['top']+5.5,'size':10,'fontname':'Math'})
  used.append(b)
 for c in brackets:
  possible=[v for v in chars if v.get('math') and min(abs(c['x1']-v['x0']),abs(c['x0']-v['x1']))<15 and abs(c['top']-v['top'])<25]
  c['fontname']='Guardi';c['size']=10
  if possible:c['top']=min(possible,key=lambda v:min(abs(c['x1']-v['x0']),abs(c['x0']-v['x1'])))['top'];c['bottom']=c['top']+10
  chars.append(c)
 return chars,used

def figure_boxes(pg,frame,chars,objects):
 # Diagram lettering is a separate font family in these PDFs.
 diag=[c for c in chars if any(v in c['fontname'] for v in ['Helvetica','Arial','Myriad']) and c['size']<11]
 body=[c for c in chars if normal(c)]
 seeds=[box(c) for c in diag if c['text'].strip()]
 for o in objects:
  if not inside(o,frame,1):continue
  b=box(o);w=o['width'];h=o['height'];lw=o.get('linewidth') or 0
  if w>frame[2]-frame[0]-8 or h>frame[3]-frame[1]-8:continue
  if o['object_type']=='image':seeds.append(b);continue
  if o['object_type']=='curve' and o.get('fill') and not o.get('stroke') and (o.get('non_stroking_color') in ([0,0,0],[0,0,0,1]) or w*h>500):continue
  if any(touch(b,box(c),2) for c in chars if 'Avant' in c['fontname']):continue
  if h<1 and w>3:
   # Exclude fraction bars, chapter rules and simple table horizontal rules.
   if any(c['x0']>=b[0]-2 and c['x1']<=b[2]+2 and b[1]-16<c['top']<b[1] for c in body):continue
  if o['object_type']=='rect' and h<1:continue
  if w*h>100000:continue
  if o.get('non_stroking_color') in ([0,0,0,0],[1,1,1]) and w>100 and h>100:continue
  if w>1 or h>1:seeds.append(b)
 groups=[]
 for b in sorted(seeds,key=lambda b:(b[1],b[0])):
  matches=[i for i,g in enumerate(groups) if touch(g,b,4)]
  if matches:
   new=union([b]+[groups[i] for i in matches]);groups=[g for i,g in enumerate(groups) if i not in matches];groups.append(new)
  else:groups.append(b)
 # Repeated merging closes connected graph grids.
 changed=True
 while changed:
  changed=False
  for i in range(len(groups)):
   m=next((j for j in range(i+1,len(groups)) if touch(groups[i],groups[j],4)),None)
   if m is not None:groups[i]=union([groups[i],groups[m]]);groups.pop(m);changed=True;break
 final=[]
 for b in groups:
  if b[2]-b[0]<12 or b[3]-b[1]<8:continue
  # Reject region if it actually contains body prose or a text table.
  bc=[c for c in body if touch(box(c),b,1) and c['text'].strip()]
  if len(bc)>=3 or any(inside(c,b,2) for c in chars if 'Avant' in c['fontname']):continue
  final.append([max(frame[0]+5,b[0]-3),max(frame[1]+5,b[1]-3),min(frame[2]-5,b[2]+3),min(frame[3]-5,b[3]+3)])
 changed=True
 while changed:
  changed=False
  for i in range(len(final)):
   j=next((j for j in range(i+1,len(final)) if (touch(final[i],final[j],8) or (touch(final[i],final[j],65) and min(final[i][3],final[j][3])-max(final[i][1],final[j][1])>min(final[i][3]-final[i][1],final[j][3]-final[j][1])*.65)) and sum(inside(c,union([final[i],final[j]]),2) for c in body)<3),None)
   if j is not None:final[i]=union([final[i],final[j]]);final.pop(j);changed=True;break
 for i,b in enumerate(final):
  extra=[box(c) for c in chars if any(s in c['fontname'] for s in ['Symbol','MathematicalPi','LucidaMath']) and touch(box(c),b,6) and c['top']>=b[1]-3 and c['bottom']<=b[3]+3]
  if extra:final[i]=union([b]+extra)
 return sorted(final,key=lambda b:(b[1],b[0]))

def tables(chars,objects):
 objects=list(objects)
 for o in list(objects):
  if o['object_type']=='rect' and o['width']>8 and o['height']>8 and .1<(o.get('linewidth') or 0)<1.1 and o.get('stroke'):
   for x0,y0,x1,y1 in [(o['x0'],o['top'],o['x1'],o['top']),(o['x0'],o['bottom'],o['x1'],o['bottom']),(o['x0'],o['top'],o['x0'],o['bottom']),(o['x1'],o['top'],o['x1'],o['bottom'])]:
    objects.append(dict(o,object_type='line',x0=x0,x1=x1,top=y0,bottom=y1,width=x1-x0,height=y1-y0))
 segments=[o for o in objects if o['object_type']=='line' and (o['width']<.5 or o['height']<.5) and max(o['width'],o['height'])>8 and .1<(o.get('linewidth') or 0)<1.1]
 groups=[]
 for o in segments:
  b=box(o);match=[i for i,g in enumerate(groups) if any(touch(box(v),b,1) for v in g)]
  if match:
   group=[o]+[v for i in match for v in groups[i]];groups=[g for i,g in enumerate(groups) if i not in match];groups.append(group)
  else:groups.append([o])
 result=[]
 def unique(vs):
  out=[]
  for v in sorted(vs):
   if not out or v-out[-1]>1:out.append(v)
  return out
 for g in groups:
  xs=unique([o['x0'] for o in g if o['width']<.5]);ys=unique([o['top'] for o in g if o['height']<.5])
  if not(3<=len(xs)<=12 and 3<=len(ys)<=20):continue
  b=[xs[0],ys[0],xs[-1],ys[-1]]
  cc=[c for c in chars if inside(c,b,1)]
  if sum(normal(c) for c in cc)<10:continue
  rows=[]
  for y0,y1 in zip(ys,ys[1:]):
   row=[]
   for x0,x1 in zip(xs,xs[1:]):
    cell=[c for c in cc if inside(c,[x0,y0,x1,y1],1)]
    row.append(' '.join(textline(l) for l in lines(cell)))
   rows.append(row)
  result.append({'type':'table','bbox':b,'cells':rows,'widths':[x1-x0 for x0,x1 in zip(xs,xs[1:])]})
 return result

def extract(code):
 data=json.loads((BASE/(code+'.json')).read_text(encoding='utf-8')); examples=[];current=None
 for p in data['pages']:
  frames=[]
  for f in p['frames']:
   if not any(max(abs(x-y) for x,y in zip(f,g))<2 for g in frames):frames.append(f)
  for f in sorted(frames,key=lambda f:f[1]):
   cc=[c for c in p['chars'] if inside(c,f,1) and c['upright'] and c['size']<25]
   hh=[c for c in cc if 'Avant' in c['fontname'] and c['size']>13]
   htext=' '.join(textline(g) for g in lines(hh))
   new=re.search(r'Example\s*(\d+)',htext)
   if new:
    hy=min(x['top'] for x in hh);hx=max(x['x1'] for x in hh)
    rules=[o for o in p['objects'] if o['object_type']=='line' and o['width']>220 and hy+10<o['top']<hy+45 and inside(o,f,1)]
    ty=min(o['top'] for o in rules)-1 if rules else hy+25
    titlechars=[c for c in cc if c['x0']>hx+4 and hy-14<c['top'] and c['bottom']<ty and c['size']<14]
    titlechars,_=fractionate(titlechars,[o for o in p['objects'] if o['x0']>hx+4 and hy-14<o['top'] and o['bottom']<ty])
    title=' '.join(textline(g) for g in lines(titlechars))
    current={'n':int(new[1]),'title':title,'parts':[]};examples.append(current)
   elif not current:continue
   # Opening frame starts a fresh example; top-of-page curves continue the last.
   elif not new and not (current['parts'] and ((current['parts'][-1]['page']==p['n'] and 0<=f[1]-current['parts'][-1]['frame'][3]<15) or (current['parts'][-1]['page']==p['n']-1 and f[1]<180))):continue
   objects=[o for o in p['objects'] if inside(o,f,1)]
   if new:
    objects=[dict(o,top=max(o['top'],ty+2),height=o['bottom']-max(o['top'],ty+2)) if o['object_type']=='image' else o for o in objects if o['top']>ty+1 or (o['object_type']=='image' and o['bottom']>ty+10)]
   grids=tables(cc,objects)
   cc=[c for c in cc if not any(inside(c,t['bbox'],1) for t in grids)]
   objects=[o for o in objects if not any(inside(o,t['bbox'],1) for t in grids)]
   pics=figure_boxes(p,f,cc,objects)
   cc=[c for c in cc if not ('Avant' in c['fontname'] and c['top']<f[1]+65 and new)]
   body=[c for c in cc if not any(inside(c,b,1) for b in pics) and any(font in c['fontname'] for font in ['Guardi','Symbol','Avant','LucidaMath','MathematicalPi'])]
   body,bars=fractionate(body,objects)
   bodylines=lines(body)
   rows=[{'type':'text','bbox':g['bbox'],'text':textline(g)} for g in bodylines if textline(g)]
   rows.extend(grids)
   rows.extend({'type':'figure','bbox':b} for b in pics)
   rows.sort(key=lambda r:(r['bbox'][3] if r['type']=='figure' else r['bbox'][1],r['bbox'][0]))
   # Keep only labelled Tip and Skill blocks in the adjacent margin.
   nextframes=[x[1] for x in frames if x[1]>f[3]+5]
   endy=p['height']-40
   margin=[c for c in p['chars'] if c['x1']<max(f[0]-6,180) and c['upright'] and c['size']<16 and f[1]-18<c['top']<endy]
   tips=[];active=False;selected=[];lasty=None;activeEnd=endy
   for g in lines(margin):
    tx=textline(g)
    if (lasty is not None and g['y']-lasty>30 and activeEnd==endy) or g['y']>activeEnd:active=False
    if re.match(r'^(Tip|Skill|SSkkiillll)\b',tx) and g['y']<f[3]+12:
     active=True;activeEnd=endy
     rules=[o for o in p['objects'] if o['width']<3 and o['height']>15 and abs(o['x0']-g['bbox'][0])<12 and abs(o['top']-g['y'])<12]
     if rules:activeEnd=max(o['bottom'] for o in rules)+3
    if re.search(r'OUP|STSE|Teaching notes|QR|Video|Checkpoint|Concept check',tx,re.I):active=False
    if active:selected+=g['chars']
    lasty=g['y']
   if selected:
    mb=union([box(c) for c in selected]);mb=[max(0,mb[0]-5),mb[1]-5,max(f[0]-8,mb[2]+3),min(endy,mb[3]+5)]
    tpics=[]
    tc=[c for c in selected if not any(inside(c,b,1) for b in tpics)]
    tc,_=fractionate(tc,[o for o in p['objects'] if inside(o,mb)])
    tips=[{'type':'text','bbox':g['bbox'],'text':textline(g)} for g in lines(tc) if textline(g)]
    tips.extend({'type':'figure','bbox':b} for b in tpics);tips.sort(key=lambda r:r['bbox'][1])
   current['parts'].append({'page':p['n'],'frame':f,'rows':rows,'tips':tips})
 (BASE/(code+'-content.json')).write_text(json.dumps(examples,ensure_ascii=False,indent=2),encoding='utf-8')
 out=[]
 for ex in examples:
  out.append('\n@EXAMPLE '+str(ex['n']))
  for part in ex['parts']:
   out.append('PAGE '+str(part['page']))
   for r in part['rows']:out.append(r.get('text',('TABLE '+str(r['cells'])) if r['type']=='table' else 'FIGURE '+str([round(v,1) for v in r['bbox']])))
   if part['tips']:out.append('TIPS');out.extend(r.get('text',('TABLE '+str(r['cells'])) if r['type']=='table' else 'FIGURE '+str([round(v,1) for v in r['bbox']])) for r in part['tips'])
 (BASE/(code+'-draft.txt')).write_text('\n'.join(out),encoding='utf-8')
 return examples
if __name__=='__main__':
 import sys
 for c in sys.argv[1:]:extract(c)
