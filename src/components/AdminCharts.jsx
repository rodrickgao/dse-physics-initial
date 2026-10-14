import {REGIONS, REGION_IDS, regionLabel} from '../lib/region-catalog';
const day = n => new Date(n).toLocaleDateString('en-CA',{timeZone:'Asia/Hong_Kong'});
const bars=(rows,total)=>rows.map(r=><div className="admin-bar" key={r.label}><span>{r.label}</span><div><i style={{width:`${total?r.count/total*100:0}%`}}/></div><strong>{r.count}</strong></div>);

export function AdminMembershipChart({data,language}) {
 const en=language==='eng',students=data.students||[];
 const labels=en?{active:'Active',expired:'Expired',revoked:'Suspended',none:'Not subscribed'}:{active:'有效会员',expired:'已到期',revoked:'已暂停',none:'未开通'};
 const memberships=Object.entries(labels).map(([key,label])=>({label,count:students.filter(s=>s.membership.status===key).length}));
 return <article className="panel admin-membership-chart"><h3>{en?'Membership distribution':'会员状态分布'}</h3>{bars(memberships,students.length)}</article>;
}

export function AdminCharts({data,language}) {
 const en=language==='eng',students=data.students||[],daily=new Map((data.dailyUsage||[]).map(r=>[r.day,r]));
 const days=Array.from({length:7},(_,i)=>{const key=day(data.generatedAt-(6-i)*86400000);return {day:key,durationMs:daily.get(key)?.durationMs||0,recorded:Boolean(data.usageSince && key>=day(data.usageSince))};});
 const value=r=>r.recorded ? String(Math.round(r.durationMs/6000)/10) : '—';
 const max=Math.max(1,...days.map(r=>r.durationMs));
 const grades=[...new Set(students.map(s=>s.grade|| (en?'Not set':'未填写')))].sort().map(label=>({label,count:students.filter(s=>(s.grade||(en?'Not set':'未填写'))===label).length}));
 const regions=REGIONS.map(r=>({label:regionLabel(r.value,language),count:students.filter(s=>s.region===r.value).length})).filter(r=>r.count);
 const unspecified=students.filter(s=>!REGION_IDS.has(s.region)).length;
 if(unspecified)regions.push({label:en?'Not set':'未填写',count:unspecified});
 return <section className="admin-charts"><article className="panel admin-trend"><h2>{en?'Usage · Last 7 days (min)':'近 7 天使用时长（分钟）'}</h2><div className="usage-week" role="img" aria-label={days.map(r=>r.day+': '+(r.recorded?value(r)+(en?' minutes':'分钟'):(en?'Not recorded':'未采集'))).join('; ')}>{days.map(r=><div className="usage-day" key={r.day} title={r.day+' · '+(r.recorded?value(r)+(en?' min':' 分钟'):(en?'Not recorded':'未采集'))}><div className="usage-column"><div className="usage-fill" style={{height:(r.durationMs/max*100)+'%'}}><strong>{value(r)}</strong></div></div><span>{r.day.slice(5).replace('-','/')}</span></div>)}</div></article><article className="panel"><h2>{en?'Student grades':'学生年级分布'}</h2>{grades.length?bars(grades,students.length):<p className="muted">{en?'No students yet':'暂无学生'}</p>}</article><article className="panel admin-regions"><h2>{en?'Student regions':'学生地区分布'}</h2>{regions.length?bars(regions,students.length):<p className="muted">{en?'No students yet':'暂无学生'}</p>}</article></section>;
}
export function StudentStatusChart({counts,language}) {const en=language==='eng';const rows=[['active',en?'Current mistakes':'当前错题'],['mastered',en?'Mastered':'已掌握'],['trash',en?'Recycle bin':'回收站'],['deleted',en?'Deleted':'已删除']];const max=Math.max(1,...rows.map(([k])=>counts[k]||0));return <section className="panel"><h2>{en?'Learning records':'学习记录分布'}</h2>{rows.map(([key,label])=><div key={key} className={`admin-bar status-${key}`}><span>{label}</span><div><i style={{width:`${(counts[key]||0)/max*100}%`}}/></div><strong>{counts[key]||0}</strong></div>)}</section>;}
