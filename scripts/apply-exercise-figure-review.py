"""Apply reviewed, source-verified exercise diagram repairs after importing Word.

The diagrams are complete source PDF renders: labels cannot detach from artwork.
Exact before/after guards prevent silently applying a repair to changed content.
"""
from pathlib import Path
import hashlib,json

def apply(root=None):
 root=Path(root) if root else Path(__file__).resolve().parents[1]
 review=json.loads((root/'scripts/exercise-figure-review.json').read_text(encoding='utf8'))
 pending={}
 for item in review:
  chapter=item['id'].split('-')[1]
  target=root/f"assets/textbook-exercises/{item['language']}/{chapter}.json"
  if target not in pending:
   pending[target]=json.loads(target.read_text(encoding='utf8'))
  record=pending[target][item['id']]
  current=record[item['field']]
  if current not in (item['original'],item['replacement']):
   raise ValueError(f"Source content changed: {item['language']} {item['id']}; re-review the diagram")
  image=root/item['image']
  if hashlib.sha256(image.read_bytes()).hexdigest()!=item['imageSha256']:
   raise ValueError(f"Reviewed diagram changed: {item['image']}")
  record[item['field']]=item['replacement']
 # Validate every record and image before writing anything.
 for target,data in pending.items():
  content=json.dumps(data,ensure_ascii=False,separators=(',',':'))
  if target.read_text(encoding='utf8')!=content:
   target.write_text(content,encoding='utf8')
 return len(review)

if __name__=='__main__':
 print(f'Applied {apply()} reviewed exercise diagram repairs')
