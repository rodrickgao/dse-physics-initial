"""Apply authored teaching explanations separately from original source answers.

Question/answer/source hashes guard against applying a solution to changed content.
Run after importing textbook exercises. This command is idempotent.
"""
import hashlib,html,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def read(path): return json.loads(path.read_text(encoding='utf-8'))
def digest(value): return hashlib.sha256(value.encode('utf-8')).hexdigest()
def apply():
    additions=read(ROOT/'scripts/exercise-reasoning-supplements.json')
    baseline=read(ROOT/'scripts/exercise-reasoning-baseline.json')
    figure=read(ROOT/'scripts/exercise-202-5-figure-fix.json')
    pending={}; changed=[]
    for key,translations in additions.items():
        chapter=key.split('-')[1]
        for lang in ['chn','eng']:
            path=ROOT/f'assets/textbook-exercises/{lang}/{chapter}.json'
            if path not in pending:pending[path]=read(path)
            q=pending[path][key];original=baseline[key][lang]
            allowed_questions={original['question_sha256']}
            if key=='tb-202-5':allowed_questions.add(digest(figure[lang]['replacement']))
            assert digest(q['question']) in allowed_questions,(key,lang,'question changed')
            assert digest(q['answer'])==original['answer_sha256'],(key,lang,'answer changed')
            assert q['source']['sha256']==original['source_sha256'],(key,lang,'source changed')
            reasoning=''.join('<p>'+html.escape(p,quote=False)+'</p>' for p in translations[lang])
            assert q['reasoning'] in ['',original['original_reasoning'],reasoning],(key,lang,'preserve other explanation edits')
            q['reasoning']=reasoning
            if key=='tb-202-5':q['question']=figure[lang]['replacement']
            changed.append({'id':key,'language':lang,'kind':'new_teaching_derivation','original_answer_preserved':True})
    # Validate every record before writing any chapter.
    for path,records in pending.items():path.write_text(json.dumps(records,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    out=ROOT.parent/'output/exercise-completion-20261009';out.mkdir(parents=True,exist_ok=True)
    (out/'changes.json').write_text(json.dumps(changed,ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'Applied {len(changed)} bilingual teaching explanations; original answers preserved.')
if __name__=='__main__':apply()
