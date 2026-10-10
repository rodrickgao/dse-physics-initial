import {points,questions} from './catalog.mjs';

const trialChapters=new Set([...points.values()].filter(p=>p.book_key==='compulsory-1').map(p=>p.code));
export const isTrialKnowledge=id=>points.get(Number(id))?.book_key==='compulsory-1';
export function isTrialPractice(id) {
 const q=questions.get(id);
 return Boolean(q&&([...(q.points||[]),...(q.relatedPoints||[])].some(isTrialKnowledge)||(/^(?:ex|tb)-/.test(id)&&trialChapters.has(id.split('-')[1]))));
}
export const isTrialRecommendation=q=>isTrialPractice(q.question_id)&&isTrialKnowledge(q.primary_knowledge?.knowledge_id);
export function trialRecommendations(recommendations) {
 const new_questions=recommendations.new_questions.filter(isTrialRecommendation),wrong_review=recommendations.wrong_review.filter(isTrialRecommendation);
 return {...recommendations,trialOnly:true,new_questions,wrong_review,personalized:recommendations.personalized&&(new_questions.length>0||wrong_review.length>0),focus_points:(recommendations.focus_points||[]).filter(p=>isTrialKnowledge(p.knowledge_id))};
}
