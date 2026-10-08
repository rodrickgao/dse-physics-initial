"""Import the user's bilingual editable textbook exercises without changing sources.

Question identities retain chapter and original number; source hashes and block
counts make every imported question auditable. No answer text is generated.
"""
from pathlib import Path
from zipfile import ZipFile
from lxml import etree as E
import argparse, hashlib, html, json, re, sys, io
from PIL import Image
from reportlab.pdfbase._fontdata_enc_symbol import SymbolEncoding
from reportlab.pdfbase._glyphlist import _glyphname2unicode

ROOT = Path(__file__).resolve().parents[1]

NS = {'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
      'm':'http://schemas.openxmlformats.org/officeDocument/2006/math',
      'a':'http://schemas.openxmlformats.org/drawingml/2006/main',
      'r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
      'wp':'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
      'v':'urn:schemas-microsoft-com:vml'}
def text(n): return ''.join(n.xpath('.//w:t/text()|.//m:t/text()', namespaces=NS))
def tag(n): return E.QName(n).localname
def esc(s): return html.escape(str(s), quote=True)

def symbol(character):
 code=int(character,16) & 255
 name=SymbolEncoding[code]
 if not name or name not in _glyphname2unicode:raise ValueError(f'Unknown Word Symbol glyph {character}')
 return chr(_glyphname2unicode[name])

def run_text(n):
 value=n.text or ''
 parent=n.getparent()
 font=parent.xpath('./w:rPr/w:rFonts/@w:ascii',namespaces=NS)
 if font==['Symbol']:
  value=''.join(symbol(f'{ord(c):04X}') if ord(c)<256 or 0xf000<=ord(c)<=0xf0ff else c for c in value)
 return value

def render_math(n):
 t=tag(n)
 if t=='t':return '<mtext>'+esc(run_text(n))+'</mtext>'
 if t=='sym':return '<mo>'+esc(symbol(n.get('{'+NS['w']+'}char')))+'</mo>'
 children=[c for c in n if not tag(c).endswith('Pr')]
 def part(name):return '<mrow>'+''.join(render_math(c) for c in n if tag(c)==name)+'</mrow>'
 def prop(name,default):
  values=n.xpath('./m:'+t+'Pr/m:'+name+'/@m:val',namespaces=NS)
  return values[0] if values else default
 inner=''.join(render_math(c) for c in children)
 if t=='f':return '<mfrac'+(' linethickness="0"' if prop('type','')=='noBar' else '')+'>'+part('num')+part('den')+'</mfrac>'
 if t=='sSup':return '<msup>'+part('e')+part('sup')+'</msup>'
 if t=='sSub':return '<msub>'+part('e')+part('sub')+'</msub>'
 if t=='sSubSup':return '<msubsup>'+part('e')+part('sub')+part('sup')+'</msubsup>'
 if t=='sPre':return '<mmultiscripts>'+part('e')+'<mprescripts/>'+part('sub')+part('sup')+'</mmultiscripts>'
 if t=='rad':return '<msqrt>'+part('e')+'</msqrt>' if prop('degHide','0')=='1' or not text(n.find('m:deg',NS)) else '<mroot>'+part('e')+part('deg')+'</mroot>'
 if t=='d':return '<mrow><mo>'+esc(prop('begChr','('))+'</mo>'+part('e')+'<mo>'+esc(prop('endChr',')'))+'</mo></mrow>'
 if t=='acc':return '<mover accent="true">'+part('e')+'<mo>'+esc(prop('chr','̂'))+'</mo></mover>'
 if t=='bar':
  element='munder' if prop('pos','top')=='bot' else 'mover'
  return '<'+element+'>'+part('e')+'<mo>¯</mo></'+element+'>'
 if t=='limUpp':return '<mover>'+part('e')+part('lim')+'</mover>'
 if t=='r':
  align=n.xpath('./w:rPr/w:vertAlign/@w:val',namespaces=NS)
  if align and align[0] in ('subscript','superscript'):
   element='msub' if align[0]=='subscript' else 'msup';return '<'+element+'><mrow/><mrow>'+inner+'</mrow></'+element+'>'
 return '<mrow>'+inner+'</mrow>'

def convert(path, media, *, examples=False, media_url="assets/textbook-exercises/media"):
 with ZipFile(path) as z:
  root=E.fromstring(z.read('word/document.xml'))
  rels={n.get('Id'):n.get('Target') for n in E.fromstring(z.read('word/_rels/document.xml.rels')) if n.get('Type','').endswith('/image') and n.get('TargetMode')!='External'}
  def inline(n):
   t=tag(n)
   if t=='AlternateContent':
    choice=next((c for c in n if tag(c)=='Choice'),None)
    if choice is not None:return ''.join(inline(c) for c in choice)
    return ''.join(inline(c) for c in n if tag(c)=='Fallback')
   if t=='t':return esc(run_text(n))
   if t=='sym':return esc(symbol(n.get('{'+NS['w']+'}char')))
   if t=='tab':return ' '
   if t in ('br','cr'):return '<br/>'
   if t in ('oMath','oMathPara'):return '<math xmlns="http://www.w3.org/1998/Math/MathML">'+render_math(n)+'</math>'
   if t in ('drawing','pict'):
    result=[]
    ids=n.xpath('.//a:blip/@r:embed|.//v:imagedata/@r:id',namespaces=NS)
    for rid in ids:
     target=rels[rid]; blob=z.read('word/'+target if not target.startswith('/') else target[1:])
     ext=Path(target).suffix.lower()
     if ext in ('.wmf','.emf'):
      image=Image.open(io.BytesIO(blob));image.load();buffer=io.BytesIO();image.convert('RGB').save(buffer,format='PNG');blob=buffer.getvalue();ext='.png'
     if ext not in ['.png','.jpg','.jpeg','.gif','.svg']:raise ValueError(f'Unsupported image {path}: {ext}')
     name=hashlib.sha256(blob).hexdigest()[:24]+ext
     if not (media/name).exists():(media/name).write_bytes(blob)
     widths=n.xpath('.//wp:extent/@cx',namespaces=NS)
     width=min(652,float(widths[0])/914400*96) if widths else 500
     result.append(f'<img src="{media_url}/{name}" alt="" style="width:{width:.1f}px"/>')
    return ''.join(result)
   if t.endswith('Pr'):return ''
   s=''.join(inline(c) for c in n)
   if t=='r':
    align=n.xpath('./w:rPr/w:vertAlign/@w:val',namespaces=NS)
    if align and align[0] in ('subscript','superscript'):
     el='sub' if align[0]=='subscript' else 'sup';s=f'<{el}>{s}</{el}>'
    if n.find('w:rPr/w:b',NS) is not None:s='<b>'+s+'</b>'
    if n.find('w:rPr/w:i',NS) is not None:s='<i>'+s+'</i>'
   return s
  def block(n):
   if tag(n)=='tbl':
    rows=[]
    for tr in n.findall('w:tr',NS):
     cells=[]
     for tc in tr.findall('w:tc',NS):
      spans=tc.xpath('./w:tcPr/w:gridSpan/@w:val',namespaces=NS)
      attr=f' colspan="{int(spans[0])}"' if spans else ''
      cells.append('<td'+attr+'>'+''.join(block(c) for c in tc if tag(c) in ('p','tbl'))+'</td>')
     rows.append('<tr>'+''.join(cells)+'</tr>')
    return '<div class="study-table-wrap"><table><tbody>'+''.join(rows)+'</tbody></table></div>'
   s=inline(n)
   if not s.strip():return ''
   return '<p'+(' class="study-figure"' if '<img ' in s and not text(n).strip() else '')+'>'+s+'</p>'
  records={};current=None;stage='question';headings=0
  for index,n in enumerate(root.find('w:body',NS)):
   value=text(n).strip()
   style=n.xpath('./w:pPr/w:pStyle/@w:val',namespaces=NS)
   if examples:
    match=re.fullmatch(r'Example (\d+)\s*(.*)',value) if style==['Heading2'] else None
    if match:
     number=match[1]
     if number in records:
      if current is records[number] and match[2].endswith('continued'):continue
      raise ValueError(f'Duplicate example {path}: {number}')
     current={'number':number,'title':match[2],'question':[],'answer':[],'tips':[],'think':[],'thinkAnswer':[],'sourceBlock':index}
     records[number]=current;stage='question';headings+=1;continue
    if current is None:continue
    if value.startswith('Book ') and ' | ' in value:current['location']=value;continue
    boundaries={'Textbook solution':'answer','Tips and skills':'tips','Tips and side notes':'tips','Think about':'think','Supplementary answer':'thinkAnswer'}
    if value in boundaries:stage=boundaries[value];continue
    if value=='Editorial check':stage='tips'
    current[stage].append(block(n));continue
   if style==['Heading1']:
    match=re.fullmatch(r'(?:Question\s+|第\s*)(\d+)\s*(?:題|题)?',value,re.I)
    if not match:raise ValueError(f'Unknown question heading {path}: {value}')
    number=match[1]
    if number in records:raise ValueError(f'Duplicate question {path}: {number}')
    current={'number':number,'question':[],'answer':[],'reasoning':[], 'sourceBlock':index}
    records[number]=current;stage='question';headings+=1;continue
   if current is None:continue
   choice=re.fullmatch(r'(?:Official answer:|答案[：:])\s*(.+)',value)
   if choice:
    current['kind']='multiple-choice';current['answer']=['<p>'+esc(choice[1])+'</p>'];stage='reasoning';continue
   if value in ('Official answer and worked solution','答案及解題過程','答案及解题过程'):
    current['kind']='structured';stage='answer';continue
   if re.match(r'^(?:Official answer|答案及)',value):raise ValueError(f'Unexpected answer boundary {path}: {value}')
   current[stage].append(block(n))
  for record in records.values():
   for field in (['question','answer','tips','think','thinkAnswer'] if examples else ['question','answer','reasoning']):record[field]=''.join(record[field])
   if not record['question'] or not record['answer']:raise ValueError(f'Missing content {path} Q{record["number"]}')
   record['source']={'name':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'block':record.pop('sourceBlock')}
  assert len(records)==headings
  return records

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--source',type=Path,required=True);args=ap.parse_args()
 out=ROOT/'assets/textbook-exercises';media=out/'media';media.mkdir(parents=True,exist_ok=True)
 report=[]
 for language,folder in [('eng','英文版/课本word英文'),('chn','中文版/课本word中文')]:
  paths=sorted(p for p in (args.source/folder).rglob('*.docx') if not p.name.startswith('~$'))
  assert len(paths)==46,(language,len(paths))
  for path in paths:
   chapter=path.name.split()[0];print(language,chapter,flush=True)
   records=convert(path,media)
   for record in records.values():record.update(id=f'tb-{chapter}-{record["number"]}',chapter=chapter)
   target=out/language;target.mkdir(exist_ok=True)
   (target/f'{chapter}.json').write_text(json.dumps({r['id']:r for r in records.values()},ensure_ascii=False,separators=(',',':')),encoding='utf8')
   report.append({'language':language,'chapter':chapter,'questions':len(records),'source':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
 (ROOT/'scripts/textbook-exercise-sources.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
 print('Imported',sum(r['questions'] for r in report),'bilingual question editions',flush=True)
 # Keep authored explanations as a source-checked layer, not as purported Word text.
 import runpy
 runpy.run_path(str(ROOT/'scripts/apply-exercise-reasoning.py'))['apply']()
if __name__=='__main__':main()
