import { exampleEntries } from '../lib/textbook-examples';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useMembership } from './Membership';
import { loadExerciseIndex, exerciseMistakeEntries } from '../lib/textbook-exercises';
import { entriesByLanguage, pointsByLanguage, questionLabelFromKey, sortKnowledge, knowledgeNumber, knowledgeTitle } from '../lib/data';
import { readSaved } from '../lib/study-state';
import { profileReview } from '../lib/profile-review';

export function StudyDashboard({userId, language, mistakes, openQuestion, openKnowledge, navigate}) {
  const en=language==='eng', membership=useMembership();
  const [exerciseState,setExerciseState]=useState({language:null,revision:null,entries:[],status:'loading'});
  const [batch,setBatch]=useState(0);
  const last=readSaved(`dse-last-study-${userId}`,null);
  useEffect(()=>{let live=true;setExerciseState({language,revision:membership.revision,entries:[],status:'loading'});
    loadExerciseIndex(language).then(index=>{if(live)setExerciseState({language,revision:membership.revision,entries:exerciseMistakeEntries(index,pointsByLanguage[language],language),status:'ready'});})
      .catch(()=>{if(live)setExerciseState({language,revision:membership.revision,entries:[],status:'error'});});return()=>{live=false;};
  },[language,membership.revision]);
  useEffect(()=>setBatch(0),[userId,language,mistakes,membership.revision]);
  const current=exerciseState.language===language&&exerciseState.revision===membership.revision;
  const status=current?exerciseState.status:'loading';
  const entries=useMemo(()=>[...entriesByLanguage[language],...exampleEntries(pointsByLanguage[language],language),...(current?exerciseState.entries:[])],[language,exerciseState,current]);
  const review=useMemo(()=>profileReview(entries,mistakes,language,batch),[entries,mistakes,language,batch]);
  const lastEntry=entries.find(e=>e.key===last?.key) || (/^ex-(?:[1-5]\d{2}|3[AB]\d{2}|E[1-4]\d{2})-\d+$/.test(last?.key||'') ? last : null);
  const count=Object.keys(mistakes).length;
  const questionName=key=>`${key.startsWith('tb-')?(en?'Textbook · ':'课本习题 · '):''}${questionLabelFromKey(key)}`;
  const empty=!count?(en?'Add mistakes to get textbook exercises linked to their knowledge points.':'加入错题后，将根据涉及的知识点推荐课本习题。')
    :status==='loading'?(en?'Matching knowledge points to textbook exercises…':'正在根据错题知识点匹配课本习题…')
    :status==='error'?(en?'Textbook exercises could not be loaded. Please try again later.':'课本习题暂时无法加载，请稍后重试。')
    :!review.linkedPointCount?(en?'These mistakes have no linked knowledge points yet.':'这些错题尚未关联知识点，暂时无法推荐课本习题。')
    :(en?'No additional textbook exercises match these knowledge points yet. You can review your saved mistakes.':'这些知识点暂时没有可推荐的新课本习题，可先复习已保存的错题。');
  return <section className="study-dashboard">
    <div className="continue-study"><div><h2>{en?'Continue learning':'继续上次学习'}</h2><p>{lastEntry?questionName(lastEntry.key):(en?'Choose a question to begin.':'从一道题开始。')}</p></div><button onClick={()=>lastEntry?openQuestion(lastEntry.key):navigate('bank')}>{lastEntry?(en?'Continue':'继续学习'):(en?'Open question bank':'进入题库')}<ArrowRight/></button></div>
    <div className="home-review">
      <div className="panel-title"><h2>{en?'Recommended textbook practice':'推荐课本习题'}</h2>{review.candidateCount>3&&<button onClick={()=>setBatch(v=>v+1)}>{en?'Next set':'换一批'}</button>}</div>
      {status==='ready'&&review.questions.length>0?<>
        <div className="home-review-questions">{review.questions.map(entry=><article className="home-practice-card" key={entry.key}>
          <button className="home-practice-open" onClick={()=>openQuestion(entry.key)}><strong>{questionName(entry.key)}</strong><ArrowRight/></button>
          <div className="home-practice-reason"><div>{sortKnowledge(entry.recommendation.sequences,language).map(sequence=><button key={sequence} onClick={()=>openKnowledge(sequence)}>{knowledgeNumber(sequence,language)} · {knowledgeTitle(sequence,language)}</button>)}</div></div>
        </article>)}</div>
      </>:<p className="review-empty" role="status">{empty}</p>}
    </div>
  </section>;
}
