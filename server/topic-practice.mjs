import {questionUrl} from './qdna-recommendations.mjs';

const order=new Intl.Collator('en',{numeric:true});
const textbookOrder=(a,b)=>order.compare(a.q.exerciseChapter||'',b.q.exerciseChapter||'')
 ||order.compare(a.q.label?.match(/Q(\d+)$/)?.[1]||a.id,b.q.label?.match(/Q(\d+)$/)?.[1]||b.id)||order.compare(a.id,b.id);
export function createTopicPractice({catalog,knowledgeIds,knowledgeInfo,isFreeTopic=()=>true,isFreeQuestion=()=>true}) {
 const cards=new Map(),cardFor=new Map();
 for(const value of knowledgeIds) {
  const id=String(value),point=knowledgeInfo(id,'chn'),key=point.number||id;
  if(!cards.has(key))cards.set(key,{ids:new Set(),exercises:[]});
  const card=cards.get(key);card.ids.add(id);cardFor.set(id,card);
 }
 // Use the reviewed exercise links, not a mixed global recommendation score.
 for(const [id,q] of catalog) {
  if(q.source!=='textbook'||!id.startsWith('tb-'))continue;
  const linked=[...new Set((q.points||[]).map(p=>cardFor.get(String(p))).filter(Boolean))];
  for(const card of linked)card.exercises.push({id,q,primary:card.ids.has(String(q.points?.[0]))});
 }
 for(const card of cards.values())card.exercises.sort((a,b)=>Number(b.primary)-Number(a.primary)
  ||(a.q.points?.length||0)-(b.q.points?.length||0)
  ||textbookOrder(a,b));
 return function groups({states,dna,language='chn',trialOnly=false,limit=3}) {
  const totals=new Map();
  for(const [questionId,state] of states) {
   if(!['WRONG','MASTERED'].includes(state.status))continue;
   const q=catalog.get(questionId);if(!q)continue;
   const weights=new Map((dna.get(questionId)||[]).map(w=>[String(w.knowledge_id),w.weight]));
   for(const id of q.points||[])if(!weights.has(String(id)))weights.set(String(id),1);
   const contributions=new Map();
   for(const [id,weight] of weights) {
    const card=cardFor.get(id);if(!card)continue;
    const previous=contributions.get(card)||{weight:0,ids:[]};
    previous.weight=Math.min(1,previous.weight+weight);previous.ids.push(id);contributions.set(card,previous);
   }
   for(const [card,{weight,ids}] of contributions) {
    if(!totals.has(card))totals.set(card,{card,wrong:0,mastered:0,wrongWeight:0,markedWeight:0,wrongIds:new Set()});
    const row=totals.get(card);row.markedWeight+=weight;
    if(state.status==='WRONG'){row.wrong++;row.wrongWeight+=weight;for(const id of ids)row.wrongIds.add(id);}
    else row.mastered++;
   }
  }
  return [...totals.values()].filter(row=>row.wrong>0).map(row=>{
   const id=[...row.wrongIds].sort((a,b)=>Number(a)-Number(b))[0],point=knowledgeInfo(id,language);
   const free=isFreeTopic(id),locked=trialOnly&&!free;
   const items=locked?[]:row.card.exercises.filter(({id})=>states.get(id)?.status!=='MASTERED'&&(!trialOnly||isFreeQuestion(id))).slice(0,limit).sort(textbookOrder).map(({id,q})=>({
    question_id:id,question_title:language==='eng'?q.labelEn||q.label:q.label,question_url:questionUrl(id),chapter:point.chapter,
    primary_knowledge:point,status:states.get(id)?.status||'UNMARKED'
   }));
   return {...point,wrong_question_count:row.wrong,weakness:(row.wrongWeight+.5)/(row.markedWeight+1),
    practice:{locked,trialAvailable:free,items}};
  }).sort((a,b)=>b.weakness-a.weakness||b.wrong_question_count-a.wrong_question_count
   ||order.compare(a.number,b.number)||Number(a.knowledge_id)-Number(b.knowledge_id));
 };
}
