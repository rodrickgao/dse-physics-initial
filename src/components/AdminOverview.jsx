import { MEMBERSHIP_ENABLED } from '../lib/access-policy';
import {AdminCharts, AdminMembershipChart} from './AdminCharts';

export function AdminOverview({data,language,onNavigate}) {
 const en=language==='eng';
 const metrics=rows=>rows.map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>);
 return <>
  <section className="admin-overview-students" aria-labelledby="student-overview-title">
   <h2 id="student-overview-title">{en?'Students and learning':'学生与学习'}</h2>
   <div className="metrics">{metrics([
    ['注册学生',data.summary.students],['近 7 天注册',data.summary.newStudents],
    ['7 日活跃学生',data.summary.active],['24 小时操作',data.summary.operations],
    ['当前错题',data.summary.mistakes],['累计专注分钟',data.summary.focusMinutes]
   ])}</div>
   <div className="admin-shortcuts"><button onClick={()=>onNavigate('users')}>学生学习 →</button><button onClick={()=>onNavigate('tutoring')}>答疑 →</button></div>
  </section>
  {MEMBERSHIP_ENABLED && <section className="admin-overview-membership" aria-labelledby="membership-overview-title">
   <h2 id="membership-overview-title">{en?'Membership overview':'会员概况'}</h2>
   <div className="admin-membership-grid">
    <div className="metrics">{metrics([['有效会员',data.summary.members],['7 日内到期',data.summary.expiring]])}</div>
    <AdminMembershipChart data={data} language={language}/>
   </div>
   <div className="admin-shortcuts"><button onClick={()=>onNavigate('payments')}>付款申请 →</button></div>
  </section>}
  <AdminCharts data={data} language={language}/>
 </>;
}
