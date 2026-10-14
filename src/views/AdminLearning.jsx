import { StudentStatusChart } from '../components/AdminCharts';
import {QdnaProfile} from '../components/QdnaProfile';
import {AdminWeeklyPreview} from './AdminQdna';
import { pageHash } from '../lib/study-state';
import { useRef } from 'react';
import { useContentMotion } from '../lib/use-content-motion';

const questionUrl = q => '/' + pageHash(q.key?.startsWith('tb-') ? 'exercises' : q.key?.startsWith('ex-') ? 'examples' : 'papers', q.key);
export function AdminLearning({ detail, nextBatch, language, tab, setTab }) {
  const en = language === 'eng';
  const learning = detail.learning;
  const contentRef = useRef(null);
  useContentMotion(contentRef, `${tab}:${language}`, '', { ready: Boolean(learning) });
  if (!learning) return <p role="status">{en ? 'Learning data unavailable' : '学习数据暂不可用'}</p>;
  const labels = {active: en?'Current mistakes':'当前错题', mastered:en?'Mastered':'已掌握',trash:en?'Recycle bin':'回收站',deleted:en?'Deleted':'已删除'};
  const records = tab === 'active' || tab === 'mastered' ? learning[tab] : detail.mistakes.filter(q=>q.status === tab);
  const pointLinks = points => <div className="admin-point-links">{[...new Map(points.map(p=>[p.number,p])).values()].map(p=><a key={p.sequence} href={`/#textbook?knowledge=${p.sequence}`} target="_blank" rel="noreferrer">{p.number} · {en ? p.titleEn || p.title : p.title}</a>)}</div>;
  return <div className="admin-learning"><StudentStatusChart counts={learning.counts} language={language}/>
    <div className="learning-tabs" role="tablist" aria-label={en?'Learning status':'学习状态'}>{Object.entries(labels).map(([id,label])=><button key={id} role="tab" aria-selected={tab===id} aria-controls="learning-records" id={`learning-tab-${id}`} onClick={()=>setTab(id)}>{label}<strong>{learning.counts[id]}</strong></button>)}</div>
    <section ref={contentRef} id="learning-records" role="tabpanel" aria-labelledby={`learning-tab-${tab}`}>
      <h3>{labels[tab]}</h3>
      <div className="admin-question-list">{records.map(q=><article key={q.key}>
        <div><a className="question-link" href={questionUrl(q)} target="_blank" rel="noreferrer">{en ? q.labelEn || q.label : q.label} ↗</a><small className="question-identifier">{q.key}</small>{pointLinks(q.knowledge || [])}</div>
        <time>{new Date(tab==='trash'?q.trashedAt:tab==='deleted'?q.deletedAt:q.markedAt).toLocaleString(en?'en-HK':'zh-CN',{timeZone:'Asia/Hong_Kong'})}</time>
      </article>)}</div>
      {!records.length&&<p role="status">{en?'No records':'暂无记录'}</p>}
    </section>
    <details><summary>{en ? "Learning analysis and weekly report" : "学习分析与周报"}</summary>    <QdnaProfile language={language} studentId={detail.student.id} initialData={detail.analytics} revision={detail.analytics?.generated_at}/>
    <AdminWeeklyPreview studentId={detail.student.id} language={language}/>
</details>
  </div>;
}
