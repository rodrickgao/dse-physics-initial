import {createHash} from 'node:crypto';
import {points,questions,pointInfo} from './catalog.mjs';
import {calculateKnowledgeWeakness,weaknessConfiguration} from './knowledge-weakness.mjs';
import {getRecommendedQuestions,questionUrl} from './qdna-recommendations.mjs';

export function createQdnaLearning({db,clock,statusStore,config=weaknessConfiguration(),canonicalLanguage=process.env.DSE_QDNA_CANONICAL_LANGUAGE||'chn'}) {
 if(!['chn','eng'].includes(canonicalLanguage))throw new Error('Invalid canonical QDNA language');
 // One effective QDNA version for shared bilingual marks; do not change source annotations.
 const source=db.prepare('SELECT language,id,body FROM protected_dna ORDER BY CASE language WHEN ? THEN 0 ELSE 1 END,id').all(canonicalLanguage);
 const parsed=source.map(row=>({...row,record:JSON.parse(row.body)}));
 const signatures=new Map(parsed.map(row=>[`${row.language}:${row.id}`,JSON.stringify((row.record.knowledge_weights||[]).map(w=>[String(w.knowledge_id),w.weight]).sort((a,b)=>a[0].localeCompare(b[0])))]));
 const languageDifferences=parsed.filter(row=>row.language==='chn'&&signatures.has(`eng:${row.id}`)&&signatures.get(`chn:${row.id}`)!==signatures.get(`eng:${row.id}`)).length;
 const dna=new Map(),byKnowledge=new Map();let ignoredWeights=0;
 for(const row of parsed){if(dna.has(row.id))continue;const record=row.record,seen=new Set();const weights=[];
  for(const w of record.knowledge_weights||[]){const id=String(w.knowledge_id);if(!points.has(Number(id))||seen.has(id)||!Number.isFinite(w.weight)||w.weight<=0||w.weight>1){ignoredWeights++;continue;}seen.add(id);weights.push({knowledge_id:id,weight:w.weight});}
  dna.set(row.id,weights);for(const w of weights){if(!byKnowledge.has(w.knowledge_id))byKnowledge.set(w.knowledge_id,[]);byKnowledge.get(w.knowledge_id).push({question_id:row.id,weight:w.weight});}
 }
 const version='qdna-'+createHash('sha256').update(JSON.stringify({canonicalLanguage,source})).digest('hex').slice(0,16);
 const info=(id,language)=>{const p=pointInfo(Number(id));return {knowledge_id:String(id),name:language==='eng'?p.titleEn||p.title:p.title,number:p.number,chapter:language==='eng'?p.chapterEn:p.chapter};};
 const compare=(a,b)=>Number(b.sufficient_data)-Number(a.sufficient_data)||(b.weakness_signal??-1)-(a.weakness_signal??-1)||Number(a.knowledge_id)-Number(b.knowledge_id);
 function snapshot(studentId,language='chn',limit=8) {
  const states=statusStore.snapshot(studentId),signals=calculateKnowledgeWeakness(states,dna,points,config);
  const recommendations=getRecommendedQuestions({states,dna,signals,catalog:questions,knowledgeInfo:info,language,limit});
  return {generated_at:clock(),qdna_version:version,counts:{marked:states.size,wrong:[...states.values()].filter(r=>r.status==='WRONG').length,mastered:[...states.values()].filter(r=>r.status==='MASTERED').length},
   highlights:Object.fromEntries(['NEEDS_REVIEW','STRONG'].map(status=>[status,signals.rows.filter(r=>r.status===status).sort((a,b)=>status==='STRONG'?a.weakness_signal-b.weakness_signal:compare(a,b)).slice(0,3).map(r=>({...r,...info(r.knowledge_id,language)}))])),
   signals:{...signals,rows:signals.rows.map(r=>({...r,...info(r.knowledge_id,language)})).sort(compare)},recommendations};
 }
 function dashboard(studentId,{language='chn',offset=0,limit=20,recommendationLimit=8}={}) {
  const result=snapshot(studentId,language,recommendationLimit);return {...result,signals:{...result.signals,total:result.signals.rows.length,rows:result.signals.rows.slice(offset,offset+limit)}};
 }
 function knowledge(studentId,id,{language='chn',status='ALL',offset=0,limit=20}={}) {
  if(!points.has(Number(id)))return null;id=String(Number(id));const states=statusStore.snapshot(studentId),signals=calculateKnowledgeWeakness(states,dna,points,config);
  const all=(byKnowledge.get(String(id))||[]).filter(r=>questions.has(r.question_id)).map(r=>{const q=questions.get(r.question_id);return {...r,status:states.get(r.question_id)?.status||'UNMARKED',question_title:language==='eng'?q.labelEn||q.label:q.label,question_url:questionUrl(r.question_id)};}).sort((a,b)=>a.question_id.localeCompare(b.question_id,'en',{numeric:true}));
  const rows=all.filter(r=>status==='ALL'||r.status===status);
  return {knowledge:info(id,language),signal:signals.rows.find(r=>r.knowledge_id===String(id)),counts:Object.fromEntries(['MASTERED','WRONG','UNMARKED'].map(s=>[s,all.filter(r=>r.status===s).length])),rows:rows.slice(offset,offset+limit),total:rows.length,qdna_version:version,recommendations:getRecommendedQuestions({states,dna,signals,catalog:questions,knowledgeInfo:info,language,limit:3,knowledgeId:id})};
 }
 function adminOverview({language='chn',type='questions',offset=0,limit=20}={}) {
  const statuses=db.prepare("SELECT m.user_id,m.question_key,m.marked_at,'WRONG' status FROM mistakes m JOIN users u ON u.id=m.user_id WHERE u.role='student' UNION ALL SELECT m.user_id,m.question_key,m.marked_at,'MASTERED' FROM mastered m JOIN users u ON u.id=m.user_id WHERE u.role='student'").all();
  const studentStates=new Map(),qCounts=new Map(),kCounts=new Map();
  for(const row of statuses){if(!studentStates.has(row.user_id))studentStates.set(row.user_id,new Map());const state=studentStates.get(row.user_id),previous=state.get(row.question_key);if(!previous||row.marked_at>previous.updated_at)state.set(row.question_key,{status:row.status,updated_at:row.marked_at});}
  for(const state of studentStates.values()) {
   for(const [id,row] of state){if(!qCounts.has(id))qCounts.set(id,{wrong:0,mastered:0});qCounts.get(id)[row.status==='WRONG'?'wrong':'mastered']++;}
   for(const row of calculateKnowledgeWeakness(state,dna,points,config).rows){if(!kCounts.has(row.knowledge_id))kCounts.set(row.knowledge_id,{wrong_students:0,mastered_students:0,needs_review_students:0});const k=kCounts.get(row.knowledge_id);if(row.wrong_question_count)k.wrong_students++;if(row.mastered_question_count)k.mastered_students++;if(row.status==='NEEDS_REVIEW')k.needs_review_students++;}
  }
  const rows=type==='questions'?[...questions].map(([id,q])=>{const count=qCounts.get(id)||{wrong:0,mastered:0};return {question_id:id,question_title:language==='eng'?q.labelEn||q.label:q.label,question_url:questionUrl(id),wrong_students:count.wrong,mastered_students:count.mastered,marked_students:count.wrong+count.mastered,qdna:dna.get(id)||[]};}).sort((a,b)=>b.marked_students-a.marked_students||a.question_id.localeCompare(b.question_id)):
    [...points.keys()].map(id=>({...info(id,language),question_count:byKnowledge.get(String(id))?.length||0,wrong_students:0,mastered_students:0,needs_review_students:0,...kCounts.get(String(id))})).sort((a,b)=>(b.needs_review_students||0)-(a.needs_review_students||0)||Number(a.knowledge_id)-Number(b.knowledge_id));
  return {rows:rows.slice(offset,offset+limit),total:rows.length,qdna_version:version,canonical_language:canonicalLanguage,language_weight_mismatches:languageDifferences,ignored_weights:ignoredWeights};
 }
 function weekly(studentId,{start,end=clock(),language='chn'}={}) {
  start??=end-7*86400000;const current=snapshot(studentId,language,8),user=db.prepare('SELECT nickname FROM users WHERE id=?').get(studentId);
  const counts=db.prepare("SELECT to_status,COUNT(DISTINCT question_id) n FROM question_status_events WHERE user_id=? AND at>=? AND at<? AND to_status IN ('MASTERED','WRONG') GROUP BY to_status").all(studentId,start,end);
  return {kind:'qdna-weekly',name:user?.nickname|| (language==='eng'?'Student':'同学'),language,start,end,generated_at:current.generated_at,qdna_version:version,history_since:statusStore.historySince,partial_history:start<statusStore.historySince,
   activity:{newly_mastered:counts.find(r=>r.to_status==='MASTERED')?.n||0,newly_wrong:counts.find(r=>r.to_status==='WRONG')?.n||0},focus_areas:current.signals.rows.filter(r=>r.status==='NEEDS_REVIEW').slice(0,3),recommended_questions:current.recommendations.new_questions.slice(0,3),continue_url:'/#mistakes',personalized:current.recommendations.personalized};
 }
 return {snapshot,dashboard,knowledge,adminOverview,weekly,version};
}

// Student responses expose only actionable learning guidance, never analysis internals.
export function studentLearningView(result, {recommendationAccess=false}={}) {
 const point=p=>({knowledge_id:p.knowledge_id,name:p.name,number:p.number,chapter:p.chapter});
 const question=q=>({question_id:q.question_id,question_title:q.question_title,question_url:q.question_url,chapter:q.chapter,primary_knowledge:point(q.primary_knowledge),recommendation_reason:q.recommendation_reason});
 const recommendations=result.recommendations;
 return {...(result.knowledge?{knowledge:point(result.knowledge)}:{weak_points:[...new Map([...(result.highlights?.NEEDS_REVIEW||[]),...(result.recommendations.focus_points||[])].map(p=>[p.number || p.knowledge_id,point(p)])).values()].slice(0,3)}),recommendations:recommendationAccess?{personalized:recommendations.personalized,new_questions:recommendations.new_questions.map(question),wrong_review:recommendations.wrong_review.map(question)}:{locked:true}};
}

// Recheck entitlement when sending a queued report, including retries after expiry.
export function memberWeeklyReport(report, active) {
 return active?report:{...report,recommendations_locked:true,recommended_questions:[],personalized:false};
}
