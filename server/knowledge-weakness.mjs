export function weaknessConfiguration(env=process.env) {
 const config={alpha:Number(env.DSE_QDNA_ALPHA??0.5),beta:Number(env.DSE_QDNA_BETA??1),minimum:Number(env.DSE_QDNA_MIN_MARKED??3),needsReview:0.6,strongBelow:0.3};
 if(!Number.isFinite(config.alpha)||!Number.isFinite(config.beta)||config.alpha<0||config.beta<=0||config.alpha>config.beta||!Number.isInteger(config.minimum)||config.minimum<1)throw new Error('Invalid QDNA smoothing configuration');
 return Object.freeze(config);
}
export function calculateKnowledgeWeakness(states,dna,knowledge,config=weaknessConfiguration()) {
 const rows=new Map([...knowledge.keys()].map(id=>[String(id),{knowledge_id:String(id),wrong_weight:0,mastered_weight:0,marked_question_count:0,wrong_question_count:0,mastered_question_count:0,total_marked_weight:0}]));
 let missingDnaCount=0;
 for(const [id,{status}] of states) {
  if(!['MASTERED','WRONG'].includes(status))continue;
  const weights=dna.get(id);if(!weights?.length){missingDnaCount++;continue;}
  for(const {knowledge_id,weight} of weights){const row=rows.get(String(knowledge_id));if(!row)continue;
   row.marked_question_count++;row[status==='WRONG'?'wrong_question_count':'mastered_question_count']++;
   row[status==='WRONG'?'wrong_weight':'mastered_weight']+=weight;
  }
 }
 for(const row of rows.values()) {
  row.total_marked_weight=row.wrong_weight+row.mastered_weight;
  row.sufficient_data=row.marked_question_count>=config.minimum&&row.total_marked_weight>0;
  row.raw_weakness=row.total_marked_weight?row.wrong_weight/row.total_marked_weight:null;
  row.adjusted_weakness=row.sufficient_data?(row.wrong_weight+config.alpha)/(row.total_marked_weight+config.beta):null;
  row.weakness_signal=row.adjusted_weakness;
  row.status=!row.sufficient_data?'INSUFFICIENT_DATA':row.weakness_signal>=config.needsReview?'NEEDS_REVIEW':row.weakness_signal<config.strongBelow?'STRONG':'DEVELOPING';
  row.data_confidence=row.sufficient_data?'SUFFICIENT_MARKED_QUESTIONS':'INSUFFICIENT_DATA';
 }
 return {rows:[...rows.values()],missing_dna_count:missingDnaCount,minimum_marked_questions:config.minimum};
}
