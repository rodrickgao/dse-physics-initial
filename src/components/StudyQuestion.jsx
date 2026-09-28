import { useMembership, MemberNotice } from './Membership';
import { track } from '../lib/activity';
import { useEffect, useState } from "react";
import { loadStudyPaper, officialAnswerHtml, STUDY_CSS } from "../lib/study-content";
import { Button } from "./ui/button";

export function StudyQuestion({ year, language, questionKey, question, ScanImages }) {
  const membership = useMembership();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [stage, setStage] = useState(1);
  const en = language === "eng";
  useEffect(() => {
    let cancelled = false;setRecord(null);setStage(1);setLoading(true);setError(false);
    loadStudyPaper(year.year, language).then((data) => {if (!cancelled) setRecord(data[questionKey] || null);}).catch(() => {if (!cancelled) setError(true);}).finally(() => {if (!cancelled) setLoading(false);});
    return () => {cancelled = true;};
  }, [year.year, language, questionKey, revision, membership.revision]);
  const rich = (value, type) => <div className={`study-content ${type}-content`} dangerouslySetInnerHTML={{ __html: value }} />;
  return <div className="study-flow" data-question={questionKey} aria-busy={loading}>
    <style>{STUDY_CSS}</style>

    <section className="study-stage"><h3><span>1</span>{"题目"}</h3>
      {loading ? <p role="status">{"正在加载文字版…"}</p> : record?.question ? rich(record.question, "question") : <><p className="study-source-note">{"原题扫描"}</p><ScanImages yearId={year.id} paths={question.question} label={question.label}/></>}
      {error && <p role="alert">{"未能加载文字版。"}<Button variant="outline" onClick={() => setRevision(revision + 1)}>{"重新加载"}</Button></p>}
    </section>
    <Button className="stage-toggle" disabled={loading || error} aria-expanded={stage >= 2} aria-controls="official-stage" onClick={() => { if (stage < 2) track('answer_view', questionKey); setStage(stage >= 2 ? 1 : 2); }}>{stage >= 2 ? ("收起标答") : ("查看标答")}</Button>
    {stage >= 2 && <section className="study-stage" id="official-stage"><h3><span>2</span>{"标答／评分参考"}</h3>
      
      {rich(officialAnswerHtml(record, question, year.id), "official")}
      {!membership.active && <MemberNotice>会员专享 · 详解</MemberNotice>}<Button disabled={!membership.active} className="stage-toggle" variant="outline" aria-expanded={stage >= 3} aria-controls="reasoning-stage" onClick={() => { if (stage < 3) track('reasoning_view', questionKey); setStage(stage >= 3 ? 2 : 3); }}>{stage >= 3 ? ("收起详解") : ("查看详解")}</Button>
    </section>}
    {membership.active && stage >= 3 && <section className="study-stage" id="reasoning-stage"><h3><span>3</span>{"详解"}</h3>{record?.reasoning ? rich(record.reasoning, "reasoning") : <p className="study-source-note">{"详细思路尚待核验。"}</p>}</section>}
  </div>;
}
