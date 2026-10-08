export const questionUrl=id=>`/#${id.startsWith('tb-')?'exercises':id.startsWith('ex-')?'examples':'papers'}?question=${encodeURIComponent(id)}`;
const stable=(a,b)=>b.recommendation_score-a.recommendation_score||(a.question_id<b.question_id?-1:a.question_id>b.question_id?1:0);
export function getRecommendedQuestions({states,dna,signals,catalog,knowledgeInfo,language='chn',limit=8,knowledgeId}) {
 const enough=new Map(signals.rows.filter(r=>r.sufficient_data).map(r=>[String(r.knowledge_id),r]));
 // Recommendations start with the first mistake. Statistical confidence remains separate.
 // Existing topic links are a recommendation fallback, never a fabricated QDNA annotation.
 const weightsFor=id=>dna.get(id)?.length?dna.get(id):(catalog.get(id)?.points||[]).map(id=>({knowledge_id:String(id),weight:1}));
 const wrongTopics=new Set();
 for(const [id,state] of states)if(state.status==='WRONG')for(const w of weightsFor(id)){
  const key=String(w.knowledge_id);wrongTopics.add(key);
  if(!enough.has(key)){const row=signals.rows.find(r=>String(r.knowledge_id)===key);enough.set(key,{knowledge_id:key,adjusted_weakness:((row?.wrong_weight||1)+.5)/((row?.total_marked_weight||1)+1),status:'NEEDS_REVIEW'});}
 }

 if(!enough.size)return {new_questions:[],wrong_review:[],personalized:false,reason:'INSUFFICIENT_DATA'};
 const candidates=[];
 for(const id of catalog.keys()) {
  const weights=weightsFor(id);
  const question=catalog.get(id);if(!question||states.get(id)?.status==='MASTERED')continue;
  if(knowledgeId&&!weights.some(w=>String(w.knowledge_id)===String(knowledgeId)))continue;
  const contributions=weights.filter(w=>enough.has(String(w.knowledge_id))).map(w=>({id:String(w.knowledge_id),value:w.weight*enough.get(String(w.knowledge_id)).adjusted_weakness})).sort((a,b)=>b.value-a.value||a.id.localeCompare(b.id,'en',{numeric:true}));
  const score=contributions.reduce((sum,row)=>sum+row.value,0);if(score<=0)continue;
  const primary=knowledgeInfo(contributions[0].id,language),weak=enough.get(primary.knowledge_id).status==='NEEDS_REVIEW';
  candidates.push({question_id:id,question_title:language==='eng'?question.labelEn||question.label:question.label,chapter:primary.chapter,
   primary_knowledge:primary,recommendation_score:Number(score.toFixed(12)),
   recommendation_reason:language==='eng'?(weak?`Practise ${primary.name}, a topic flagged for review by your own marks.`:`Continue practising ${primary.name} based on your own marks.`):(weak?`练习「${primary.name}」；你的自主标记提示该知识点需要复习。`:`根据你的自主标记，继续练习「${primary.name}」。`),
   question_url:questionUrl(id),status:states.get(id)?.status||'UNMARKED'});
 }
 candidates.sort(stable);
 // Never backfill beyond three recommendations for any primary knowledge point.
 function diverse(rows,size){const selected=[],counts=new Map();for(const row of rows){const id=String(row.primary_knowledge.knowledge_id);if((counts.get(id)||0)>=3)continue;selected.push(row);counts.set(id,(counts.get(id)||0)+1);if(selected.length>=size)break;}return selected;}
 return {new_questions:diverse(candidates.filter(q=>q.status==='UNMARKED'),limit),wrong_review:diverse(candidates.filter(q=>q.status==='WRONG'),Math.min(3,limit)),personalized:true,reason:null,focus_points:[...wrongTopics].slice(0,3).map(id=>knowledgeInfo(id,language))};
}
