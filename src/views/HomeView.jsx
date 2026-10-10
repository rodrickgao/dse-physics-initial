import { ArrowRight, BookOpen, CircleAlert, FileQuestion } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { StudyDashboard } from '../components/StudyDashboard';
import { statistics } from '../lib/data';
import { cn } from '../lib/utils';

export function HomeView({ language, navigate, mistakeCount, userId, mistakes, mastered, openQuestion, openKnowledge }) {
  const isEnglish = language === "eng";
  const sections = [
    { id: "bank", index: "01", title: "题库", metric: "", metricLabel: isEnglish ? "Past papers · Exercises · Examples" : "真题 · 课本习题 · 课本例题", icon: FileQuestion, tone: "blue" },
    { id: "textbook", index: "02", title: "课本知识库", metric: statistics.summary.knowledgePointCount, metricLabel: "个知识点", icon: BookOpen, tone: "amber" },
    { id: "mistakes", index: "03", title: "错题库", metric: mistakeCount, metricLabel: "道待复习", icon: CircleAlert, tone: "rose" },
  ];
  return <div className="home-view page-enter">
    <section className="welcome-row"><h1>{isEnglish ? "My study desk" : "我的学习"}</h1></section><StudyDashboard mastered={mastered} userId={userId} language={language} mistakes={mistakes} openQuestion={openQuestion} openKnowledge={openKnowledge} navigate={navigate}/>
    <section className="section-grid">{sections.map(({ id, index, title, metric, metricLabel, icon: Icon, tone }) =>
      <Card key={id} className={cn("library-card", `tone-${tone}`)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(id); } }} onClick={() => navigate(id)}>
        <CardHeader><div className="library-card-top"><span className="library-icon"><Icon /></span><span className="card-index">{index}</span></div><CardTitle>{title}</CardTitle></CardHeader>
        <CardContent><div className="metric"><strong>{metric}</strong><span>{metricLabel}</span></div><span className="open-link" aria-hidden="true"><ArrowRight /></span></CardContent>
      </Card>
    )}</section>
  </div>;
}
