import { DataTable } from '../components/DataTable';
import {useEffect,useRef,useState} from 'react';
import {useContentMotion} from '../lib/use-content-motion';
import {adminApi} from '../lib/admin-api';
import {adminPageLabel,adminPageHref} from '../lib/admin-labels';

const link=q=>`/#${q.key.startsWith('tb-')?'exercises':q.key.startsWith('ex-')?'examples':'papers'}?question=${encodeURIComponent(q.key)}`;
export function AdminInsights({mode,userId=0,revision,language,onStudent}) {
 const [data,setData]=useState(null),[error,setError]=useState(''),[query,setQuery]=useState(''),[page,setPage]=useState(1),[sort,setSort]=useState('marked');
 const [exporting,setExporting]=useState(false),[exportError,setExportError]=useState('');
 const questions=mode==='questions', en=language==='eng';
 const contentRef=useRef(null);
 useContentMotion(contentRef,`${mode}:${page}:${sort}:${language}`,'',{initial:true,ready:Boolean(data)});
 async function exportQuestions(){
  setExporting(true);setExportError('');
  try{
   const result=await adminApi(`admin/question-stats/export?language=${language}`);
   const url=URL.createObjectURL(new Blob([Uint8Array.from(atob(result.base64),c=>c.charCodeAt(0))],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
   const anchor=document.createElement('a');anchor.href=url;anchor.download=result.filename;anchor.click();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){setExportError(e.message);}finally{setExporting(false);}
 }
 useEffect(()=>{let live=true;setData(null);setError('');adminApi(questions?'admin/question-stats':`admin/page-visits?userId=${userId}&page=${page}`).then(d=>{if(live)setData(d);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[mode,userId,revision,questions,questions?0:page]);
 const filtered=questions?(data?.rows||[]).filter(q=>`${q.key} ${q.label} ${q.labelEn||''}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>b[sort]-a[sort]||a.key.localeCompare(b.key)):data?.rows||[];
 const rows=questions?filtered.slice((page-1)*50,page*50):filtered;
 const total=questions?filtered.length:data?.total||0;
 const headings=questions?['唯一编号','题目','历史标记总人数','当前错题人数','已掌握总人数']:['学生','邮箱','页面 / 题目','前台停留时长','访问开始时间'];
 const visitContent=r=>{
  const label=<>{adminPageLabel(r.target,language)}{r.target.includes('?')&&adminPageHref(r.target)?' · '+(new URLSearchParams(r.target.split('?')[1]).get('question')||new URLSearchParams(r.target.split('?')[1]).get('knowledge')||''):''}</>;
  const href=adminPageHref(r.target);
  return href?<a href={href} target="_blank" rel="noreferrer">{label} ↗</a>:label;
 };
 const tableRows=rows.map(r=>questions?[<code>{r.key}</code>,<a href={link(r)} target="_blank" rel="noreferrer">{en?r.labelEn||r.label:r.label} ↗</a>,r.marked,r.active,r.mastered]:[onStudent?<button onClick={()=>onStudent(r.user_id)}>{r.nickname||'未填用户名'} · #{r.user_id}</button>:r.nickname||'未填用户名',r.email,visitContent(r),`${Math.floor(r.duration_ms/60000)} 分 ${Math.floor(r.duration_ms/1000)%60} 秒`,new Date(r.started_at).toLocaleString('zh-CN',{timeZone:'Asia/Hong_Kong'})]);
 return <section ref={contentRef} className="panel admin-insights"><h2>{questions?'题目统计':'停留超过 1 分钟'}</h2>{questions&&<div className="toolbar"><label className="grow">搜索题目<input type="search" value={query} placeholder="唯一编号或题目名称" onChange={e=>{setQuery(e.target.value);setPage(1);}}/></label><label>排序<select value={sort} onChange={e=>{setSort(e.target.value);setPage(1);}}><option value="marked">历史标记最多</option><option value="active">当前错题最多</option><option value="mastered">已掌握最多</option></select></label><button disabled={!data||exporting} onClick={exportQuestions}>{exporting?(en?'Exporting…':'导出中…'):(en?'Export Excel':'导出 Excel')}</button></div>}{exportError&&<p role="alert" className="error">{exportError}</p>}{error?<p role="alert" className="error">{error}</p>:!data?<p role="status">正在读取资料…</p>:<><p>共 {total} 条</p><DataTable headings={headings} rows={tableRows} rowKey={(_,i)=>questions?rows[i].key:rows[i].visit_id}/><div className="pagination"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)}>上一页</button><span>第 {page} / {Math.max(1,Math.ceil(total/50))} 页</span><button disabled={page*50>=total} onClick={()=>setPage(p=>p+1)}>下一页</button></div></>}</section>;
}
