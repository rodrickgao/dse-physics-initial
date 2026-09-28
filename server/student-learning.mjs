import { questions, pointInfo } from './catalog.mjs';
import { profileReview } from '../src/lib/profile-review.js';

const entries = [...questions.values()].map(q => ({...q, network: {links: q.points.map(sequence => ({sequence}))}}));
export function studentLearning(active, mastered, archive, batch = 0) {
  const saved = Object.fromEntries(active.map(q => [q.question_key, true]));
  const review = profileReview(entries, saved, 'chn', batch);
  const record = q => ({...questions.get(q.question_key), markedAt: q.marked_at,
    knowledge: (questions.get(q.question_key)?.points || []).map(pointInfo)});
  return {
    counts: {active: active.length, mastered: mastered.length,
      trash: archive.filter(q => q.status === 'trash').length,
      deleted: archive.filter(q => q.status === 'deleted').length},
    active: active.map(record), mastered: mastered.map(record),
    review: {candidateCount: review.candidateCount, questions: review.questions.map(q => ({
      key: q.key, label: q.label, labelEn: q.labelEn, knowledge: q.recommendation.sequences.map(pointInfo)
    }))}
  };
}
