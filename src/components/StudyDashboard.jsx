import {useMemo} from 'react';
import {ArrowRight} from 'lucide-react';
import {readSaved} from '../lib/study-state';
import {questionLabelFromKey} from '../lib/data';
import {QdnaProfile} from './QdnaProfile';

export function StudyDashboard({userId,language,mistakes,mastered,openQuestion,navigate}) {
 const en=language==='eng',last=readSaved(`dse-last-study-${userId}`,null);
 // Parent updates these only after the server has committed a status change.
 const revision=useMemo(()=>({userId,mistakes,mastered}),[userId,mistakes,mastered]);
 return <section className="study-dashboard"><div className="continue-study"><div><h2>{last?.key?(en?'Continue learning':'继续上次学习'):(en?'Start learning':'开始学习')}</h2><p>{last?.key?questionLabelFromKey(last.key):(en?'Choose a question to begin.':'从一道题开始。')}</p></div><button onClick={()=>last?.key?openQuestion(last.key):navigate('bank')}>{last?.key?(en?'Continue':'继续学习'):(en?'Open question bank':'进入题库')}<ArrowRight/></button></div><QdnaProfile showRecommendations={false} key={userId} language={language} revision={revision} openQuestion={openQuestion}/></section>;
}
