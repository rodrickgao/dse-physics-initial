import { questions, pointInfo } from './catalog.mjs';

export function studentLearning(active, mastered, archive, recommendations = {new_questions:[]}) {
  const record = q => ({...questions.get(q.question_key), markedAt: q.marked_at,
    knowledge: (questions.get(q.question_key)?.points || []).map(pointInfo)});
  return {
    counts: {active: active.length, mastered: mastered.length,
      trash: archive.filter(q => q.status === 'trash').length,
      deleted: archive.filter(q => q.status === 'deleted').length},
    active: active.map(record), mastered: mastered.map(record),
    review: {questions: recommendations.new_questions.map(q=>({key:q.question_id,label:questions.get(q.question_id)?.label||q.question_title,labelEn:questions.get(q.question_id)?.labelEn||q.question_title,knowledge:[pointInfo(Number(q.primary_knowledge.knowledge_id))]}))}
  };
}
