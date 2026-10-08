import { Check, Star } from 'lucide-react';
import { Button } from './ui/button';

export function QuestionMarks({ language, questionKey, mastered, mistakes, saving, setProgress, setMistake }) {
  const en = language === 'eng';
  const done = !!mastered[questionKey], saved = !!mistakes[questionKey];
  const mastery = done ? (en ? 'Mastered' : '已掌握') : (en ? 'Mark as mastered' : '标为已掌握');
  const mistake = saved ? (en ? 'Added to mistakes' : '已加入错题') : (en ? 'Add to mistakes' : '加入错题');
  return <>
    <Button data-tour="mark-mastered" data-mark-kind="mastered" className="question-mark" size="icon" variant="outline" disabled={saving} aria-label={mastery} title={mastery} aria-pressed={done} onClick={() => setProgress([questionKey], done ? 'clear' : 'mastered')}><Check aria-hidden="true"/></Button>
    <Button data-tour="mark-mistake" data-mark-kind="mistake" className="question-mark" size="icon" variant="outline" disabled={saving} aria-label={mistake} title={mistake} aria-pressed={saved} onClick={() => setMistake(questionKey, !saved)}><Star aria-hidden="true" className={saved ? 'fill-current' : ''}/></Button>
  </>;
}
