"""Build static, escaped study blocks from immutable verified Word editions.

Run locally with --workspace PATH. Outputs contain no local paths or executable
document content. GitHub builds consume the committed result, not local Word.
"""
from pathlib import Path
import argparse, hashlib, json, re, zipfile, html
from lxml import etree as E

NS={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main','m':'http://schemas.openxmlformats.org/officeDocument/2006/math','a':'http://schemas.openxmlformats.org/drawingml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships','wp':'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing'}
esc=lambda s:html.escape(str(s),quote=True)
def text(n):return ''.join(n.xpath('.//w:t/text()|.//m:t/text()',namespaces=NS))
def tag(n):return E.QName(n).localname
def math(n):
 t=tag(n); children=[c for c in n if not tag(c).endswith('Pr')]
 inner=lambda v:''.join(math(c) for c in v)
 if t=='t':return '<mtext>'+esc(n.text or '')+'</mtext>'
 if t in ('r','e','num','den','sub','sup','deg','oMath','oMathPara'):return '<mrow>'+inner(children)+'</mrow>'
 def part(name):return '<mrow>'+''.join(math(c) for c in n if tag(c)==name)+'</mrow>'
 if t=='f':return '<mfrac>'+part('num')+part('den')+'</mfrac>'
 if t=='sSup':return '<msup>'+part('e')+part('sup')+'</msup>'
 if t=='sSub':return '<msub>'+part('e')+part('sub')+'</msub>'
 if t=='sSubSup':return '<msubsup>'+part('e')+part('sub')+part('sup')+'</msubsup>'
 if t=='sPre':return '<mmultiscripts>'+part('e')+'<mprescripts/>'+part('sub')+part('sup')+'</mmultiscripts>'
 if t=='rad':return '<msqrt>'+part('e')+'</msqrt>' if not n.xpath('./m:deg//m:t/text()',namespaces=NS) else '<mroot>'+part('e')+part('deg')+'</mroot>'
 if t=='d':return '<mrow><mo>(</mo>'+part('e')+'<mo>)</mo></mrow>'
 return inner(children)

def convert(path,assets):
 with zipfile.ZipFile(path) as z:
  root=E.fromstring(z.read('word/document.xml'))
  relroot=E.fromstring(z.read('word/_rels/document.xml.rels'))
  rels={n.get('Id'):n.get('Target') for n in relroot if n.get('Type','').endswith('/image') and n.get('TargetMode')!='External'}
  styles=E.fromstring(z.read('word/styles.xml'))
  names={n.get('{'+NS['w']+'}styleId'):n.find('w:name',NS).get('{'+NS['w']+'}val') for n in styles if n.find('w:name',NS) is not None}
  def inline(n):
   t=tag(n)
   if t=='t':return esc(n.text or '')
   if t=='tab':return ' '
   if t in ('br','cr'):return '<br/>'
   if t in ('oMath','oMathPara'):return '<math xmlns="http://www.w3.org/1998/Math/MathML">'+math(n)+'</math>'
   if t in ('drawing','pict'):
    images=[]
    for rid in n.xpath('.//a:blip/@r:embed',namespaces=NS):
     target=rels.get(rid,'')
     if not target:continue
     name='word/'+target.lstrip('/') if not target.startswith('/') else target.lstrip('/')
     blob=z.read(name);ext=Path(target).suffix.lower();dest=assets/(hashlib.sha256(blob).hexdigest()[:24]+ext)
     if not dest.exists():dest.write_bytes(blob)
     widths=n.xpath('.//wp:extent/@cx',namespaces=NS)
     width=min(652,float(widths[0])/914400*96) if widths else 600
     images.append(f'<img src="text-papers/media/{dest.name}" alt="" style="width:{width:.1f}px"/>')
    return ''.join(images)
   if t.endswith('Pr'):return ''
   s=''.join(inline(c) for c in n)
   if t=='r':
    v=n.xpath('./w:rPr/w:vertAlign/@w:val',namespaces=NS)
    if v and v[0] in ('subscript','superscript'):s=('<sub>' if v[0]=='subscript' else '<sup>')+s+('</sub>' if v[0]=='subscript' else '</sup>')
   return s
  def block(n):
   if tag(n)=='tbl':
    rows=[]
    for tr in n.findall('w:tr',NS):
     cells=[]
     for tc in tr.findall('w:tc',NS):
      spans=tc.xpath('./w:tcPr/w:gridSpan/@w:val',namespaces=NS)
      span=f' colspan="{int(spans[0])}"' if spans else ''
      cells.append('<td'+span+'>'+''.join(block(c) for c in tc if tag(c) in ('p','tbl'))+'</td>')
     rows.append('<tr>'+''.join(cells)+'</tr>')
    widths=[int(x) for x in n.xpath('./w:tblGrid/w:gridCol/@w:w',namespaces=NS)]
    total=sum(widths)
    labelcols={i for i,tc in enumerate(n.xpath('./w:tr[1]/w:tc',namespaces=NS)) if re.fullmatch(r'\s*[ABCD]\s*[.．]\s*',text(tc))}
    colwidths=['2.5em' if i in labelcols else ('auto' if labelcols else f'{100*w/total:.3f}%') for i,w in enumerate(widths)] if total else []
    cols='<colgroup>'+''.join(f'<col style="width:{width}"/>' for width in colwidths)+'</colgroup>' if colwidths else ''
    return '<div class="study-table-wrap"><table>'+cols+'<tbody>'+''.join(rows)+'</tbody></table></div>'
   content=inline(n)
   if not content.strip():return ''
   return '<p'+(' class="study-figure"' if '<img ' in content and not text(n).strip() else '')+'>'+content+'</p>'
  result={};current=None;stage='question';section=1
  for n in root.find('w:body',NS):
   value=text(n).strip();style=n.xpath('./w:pPr/w:pStyle/@w:val',namespaces=NS);style=names.get(style[0],style[0]) if style else ''
   heading=value.replace('*','').strip()
   sm=re.match(r'^Section\s+([A-D])\b|^([A-D])\s*部',heading)
   if sm:section=ord(sm[1] or sm[2])-64
   if sm and 'structured' in heading.lower():heading=f'Question {section} Structured question'
   if 'multiple-choice questions' in heading.lower() or heading=='多項選擇題':current=None;continue
   m=re.match(r'^(?:Question\s+|第\s*|Q\.?\s*)([1-9][0-9]*(?:\.[1-8])?)(?=\s|題|:|：|—|$)',heading,re.I)
   bare=re.match(r'^([1-4]\.[1-8])(?:\s|$)',heading) if 'heading' in style.lower() else None
   if heading.lower()=='structured question':heading=f'Question {section} Structured question';m=re.match(r'Question (\d)',heading)
   m=m or bare
   if m:
    identity=m[1]+('.S' if re.search(r'structured|結構',heading,re.I) else '')
    if '.' in identity:section=int(identity.split('.')[0])
    current={'question':[],'official':[],'reasoning':[]};result[identity]=current;stage='question'
    if bare and len(heading)>len(bare[0]):current['question'].append(block(n))
    continue
   if current is None:continue
   # Section-level headings and instructions are not part of the prior question.
   if re.match(r'^(?:Section [A-D]|[A-D] 部：|Q\.[1-4]:)',value):current=None;continue
   if value.startswith(('Official answer:','官方答案：')):
    stage='official';current['official'].append('<p>'+esc(value)+'</p>');continue
   if value.startswith(('Official marking scheme','官方評分參考','答案要點（')):
    stage='official';continue
   if 'reasoning' in style.lower():stage='reasoning'
   if stage=='question' and value.startswith(('Original question','Official answers are placed')):continue
   current[stage].append(block(n))
  result={k:v for k,v in result.items() if any(v['question'])}
  for item in result.values():
   for k in ('question','official','reasoning'):item[k]=''.join(item[k])
   # Split adjacent subpart sentences without flattening superscripts or maths.
   item['reasoning']=re.sub(r'(?<=[.!?。;；])\s*(?=\((?:[a-h]|i{1,3}|iv|v|vi{0,3})\))','</p><p>',item['reasoning'])
   item['source']={'type':'verified-word','name':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
  return result

def main():
 raise SystemExit('Use the workspace tools/update_expert_database.py then tools/export_website_database.py. Independent Word imports would discard canonical corrections and newly verified records.')
 ap=argparse.ArgumentParser();ap.add_argument('--workspace',type=Path,required=True);a=ap.parse_args()
 repo=Path(__file__).resolve().parents[1];out=repo/'text-papers';assets=out/'media';assets.mkdir(parents=True,exist_ok=True)
 bank=json.loads((a.workspace/'真题库/records.json').read_text(encoding='utf8'))['records']
 records={(r['year'],r['language'],r['paper_id'],str(r['question_number'])):r for r in bank}
 desktop=Path.home()/'Desktop';summary=[]
 for year in range(2012,2025):
  for language,folder,banklang in [('eng','真题word','en'),('chn','真题word（中文版）','zh-Hant')]:
   data={}
   for part,paper in [('1A','paper-1a'),('1B','paper-1b'),('2','paper-2')]:
    path=desktop/folder/str(year)/f'{year}_HKDSE_Physics_Paper_{part}_Verified_{"English" if language=="eng" else "Chinese"}_Solutions.docx'
    if path.exists():
     for identity,item in convert(path,assets).items():
      key=f'{year}|{paper}|{identity}';data[key]=item
      item['status']='word-transcribed'
      # Official scan images stay authoritative; do not silently bless OCR maths.
      item['officialFormat']='scan' if '<img ' in item['official'] else 'text'
      item['reasoningStatus']='detailed' if item['reasoning'] else 'pending'
    else:
     for (yr,lang,pid,qid),r in records.items():
      if (yr,lang,pid)!=(year,banklang,paper):continue
      # Paper 2 bank records cover an entire section; cannot attach to split MC.
      if paper=='paper-2':continue
      question=r.get('question_text_override') or r.get('question_text','')
      question=re.sub(r'\[Refer to the source image[^\]]*\]','',question)
      verified=r.get('transcription_status')=='human_verified'
      official=r.get('answer_text') or ''
      data[f'{year}|{paper}|{qid}']={'question':'<p>'+esc(question).replace('\n','<br/>')+'</p>' if verified else '',
        'official':'<p>'+esc(official)+'</p>' if official else '', 'reasoning':'','status':'bank-verified' if verified else 'pending',
        'officialFormat':'text' if official else 'scan','reasoningStatus':'pending',
        'source':{'type':'question-bank','name':r['id'],'review':r.get('transcription_status')}}
   (out/f'{year}-{language}.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf8')
   summary.append({'year':year,'language':language,'records':len(data),'textQuestions':sum(bool(x['question']) for x in data.values()),'detailedSolutions':sum(bool(x['reasoning']) for x in data.values()),'officialText':sum(x['officialFormat']=='text' for x in data.values())})
 (out/'coverage.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf8')
 print(json.dumps(summary,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
