import { DataTable as Table } from '../components/DataTable';
import { statuses, actions, pages } from '../lib/admin-labels';
import { AdminInsights } from './AdminInsights';
import { AdminCharts } from '../components/AdminCharts';
import { BrandLogo } from '../components/BrandLogo';
import {AdminQdnaOverview} from './AdminQdna';
import { useAdminLocation } from '../lib/use-admin-location';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { AdminLearning } from './AdminLearning';
import { getUiLanguage, setUiLanguage, translate } from '../lib/ui-translations';
import { AdminTutoring } from './AdminTutoring';
import { useEffect, useRef, useState } from 'react';
import { adminApi as api } from '../lib/admin-api';
import { AdminOrders } from './AdminOrders';

const date = value => value ? new Date(value).toLocaleString(getUiLanguage()==='eng'?'en-HK':'zh-CN', { timeZone: 'Asia/Hong_Kong' }) : '—';
function Badge({ member }) { return <span className={`badge ${member.status}`}>{statuses[member.status]}</span>; }
export function AdminWorkspace() {
  const [language,setLanguage] = useState(getUiLanguage);
  setUiLanguage(language);
  useEffect(()=>{ document.documentElement.lang=language==='eng'?'en':'zh-CN';localStorage.setItem('dse-physics-language-v1',language); },[language]);
  const withLanguage = content => <><LanguageSwitch language={language} setLanguage={setLanguage}/>{content}</>;
  const [authenticated, setAuthenticated] = useState(false), [ready, setReady] = useState(false), [key, setKey] = useState('');
  const [route, updateRoute] = useAdminLocation();
  const {tab,query,filter,selectedId,page,actionFilter} = route;
  const setTab = tab => updateRoute({tab,selectedId:null,page:1,actionFilter:''});
  const setQuery = query => updateRoute({query},true);
  const setFilter = filter => updateRoute({filter},true);
  const setSelectedId = selectedId => updateRoute({selectedId,learningTab:'active'});
  const setPage = value => updateRoute({page:typeof value==='function'?value(page):value});
  const setActionFilter = actionFilter => updateRoute({actionFilter},true);
  const [refreshVersion,setRefreshVersion] = useState(0);
  const [actorId,setActorId] = useState(null);
  const [data, setData] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const [detail, setDetail] = useState(null);
  const [logs, setLogs] = useState({ rows: [], total: 0 }), [history, setHistory] = useState([]);
  const [days, setDays] = useState('30'), [reason, setReason] = useState(''), [confirm, setConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [reviewBatch, setReviewBatch] = useState(0);
  const detailPanel = useRef(null);
  useEffect(() => { setDetail(null); setConfirm(null); setReason(''); }, [selectedId]);
  useEffect(() => { if (selectedId) detailPanel.current?.scrollIntoView({behavior:'smooth',block:'start'}); }, [selectedId]);
  const sequence = useRef(0);
  const selected = data?.students.find(s => s.id === selectedId);
  async function refresh() { setBusy(true); try { const result = await api('admin/overview'); setData(result); setError(''); } catch(e) { setError(e.message); if ([401,403].includes(e.status)) setAuthenticated(false); } finally { setBusy(false); } }
  useEffect(() => { api('admin/session').then(result => { setActorId(result.user.id); setAuthenticated(true); }).catch(e => { if (![401,403].includes(e.status)) setError(e.message); }).finally(() => setReady(true)); }, []);
  useEffect(() => { if (!authenticated) return; void refresh(); const timer = setInterval(refresh, 15000); return () => clearInterval(timer); }, [authenticated]);
  useEffect(() => {
    if (!authenticated) return;
    const version = ++sequence.current;
    async function load() {
      try {
        const [activity, audit, student] = await Promise.all([api(`admin/activity?page=${page}&action=${encodeURIComponent(actionFilter)}&userId=${selectedId || 0}`), api(`admin/membership-history?userId=${selectedId || 0}`), selectedId ? api(`admin/student?id=${selectedId}&batch=${reviewBatch}&language=${language}`) : Promise.resolve(null)]);
        if (version === sequence.current) { setLogs(activity); setHistory(audit.rows); setDetail(student); }
      } catch(e) { if (version === sequence.current) setError(e.message); }
    }
    void load(); const timer = setInterval(load, 15000); return () => { sequence.current++; clearInterval(timer); };
  }, [authenticated, selectedId, page, actionFilter, reviewBatch, data?.generatedAt, refreshVersion, language]);
  async function login(e) { e.preventDefault(); setBusy(true); setError(''); try { const result = await api('admin/login', { key }); setActorId(result.user.id); setKey(''); setAuthenticated(true); } catch(e) { setError(e.message); } finally { setBusy(false); } }
  async function logout() { try { await api('admin/logout', {}); setAuthenticated(false); setData(null); setDetail(null); setSelectedId(null); setHistory([]); setLogs({rows:[],total:0}); } catch(e) { setError(e.message); } }
  function choose(s) { setReviewBatch(0); updateRoute({selectedId:s.id,actionFilter:'',page:1,learningTab:'active'}); setDetail(null); setReason(''); setConfirm(null); setNotice(''); }
  function prepare(action) {
    setError(''); setNotice('');
    if (!reason.trim()) { setError('请填写操作原因。'); return; }
    if (action === 'extend' && (!Number.isInteger(Number(days)) || Number(days) < 1 || Number(days) > 3650)) { setError('会员天数须为 1–3650 的整数。'); return; }
    setConfirm({ userId: selected.id, email: selected.email, action, days: Number(days), reason: reason.trim(), revision: selected.membership.revision, requestId: crypto.randomUUID() });
  }
  async function save() {
    setSaving(true); setError('');
    try { await api('admin/membership', confirm); setNotice('会员资料已保存。'); setConfirm(null); setReason(''); await refresh(); }
    catch(e) { setError(e.message); if (e.status === 409) { setConfirm(null); await refresh(); } }
    finally { setSaving(false); }
  }
  async function exportAll() { setBusy(true); try { const result = await api('admin/export'); const url = URL.createObjectURL(new Blob([Uint8Array.from(atob(result.base64), c => c.charCodeAt(0))])); const a = document.createElement('a'); a.href = url; a.download = result.filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); } catch(e) { setError(e.message); } finally { setBusy(false); } }
  const members = data?.students.filter(s => `${s.nickname || ''} ${s.email} ${s.id}`.toLowerCase().includes(query.toLowerCase()) && (filter === 'all' || (filter === 'expiring' ? s.membership.active && s.membership.endsAt <= data.generatedAt + 7*86400000 : s.membership.status === filter))) || [];
  const activityTable = <><div className="toolbar"><label>操作类型<select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1); }}><option value="">全部操作</option>{Object.entries(actions).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label><span>{logs.total} 条记录 · 香港时间</span></div><Table labelFor={translate} headings={['时间','学生','操作','内容']} rows={logs.rows.map(r => [date(r.at), <><strong>{r.nickname || '未填昵称'}</strong><small>{r.email}</small></>, actions[r.action] || r.action, r.content ? <a href={r.content.href} target="_blank" rel="noreferrer">{language==='eng' ? r.content.labelEn : r.content.label} ↗</a> : pages[r.label] || r.label || '—'])}/><div className="pagination"><button disabled={page <= 1} onClick={() => setPage(p => p-1)}>上一页</button><span>第 {page} 页</span><button disabled={page*50 >= logs.total} onClick={() => setPage(p => p+1)}>下一页</button></div></>;
  const auditTable = <><Table labelFor={translate} headings={['时间','学生','操作','变更前到期','变更后到期','原因','管理员']} rows={history.map(r => [date(r.at),r.email,r.action === 'extend' ? `开通／延长 ${r.days} 天` : '暂停会员',date(r.before_end),date(r.after_end),r.reason,`#${r.actor_id}`])}/></>;
  if (!ready) return withLanguage(<div className="admin-loading">正在加载管理后台…</div>);
  if (!authenticated) return withLanguage(<main className="admin-login"><div><BrandLogo language={language}/><h1>管理你的物理自习室</h1></div><form onSubmit={login}><h2>管理员登录</h2><label>管理密钥<input type="password" autoComplete="current-password" required value={key} onChange={e => setKey(e.target.value)}/></label>{error && <p role="alert" className="error">{error}</p>}<button className="primary" disabled={busy}>{busy ? '验证中…' : '进入管理后台'}</button><a href="/" target="_blank" rel="noreferrer">开启学生网站 ↗</a></form></main>);
  return withLanguage(<div className="management-shell"><aside><a className="admin-brand" href="/admin.html"><BrandLogo language={language}/></a><nav>{[['overview','总览'],['tutoring','答疑'],['users','学生资料'],['questions','逐题统计'],['visits','停留超过一分钟'],['payments','付款申请'],['activity','操作记录'],['audit','会员变更']].map(([id,label]) => <button key={id} className={tab === id ? 'active' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => { setTab(id); setConfirm(null); setNotice(''); }}>{label}</button>)}</nav><div className="sidebar-bottom"><a href="/" target="_blank" rel="noreferrer">学生网站 ↗</a><button onClick={logout}>退出登录后台</button></div></aside><main><header><div><h1>{{tutoring:'答疑',payments:'付款申请',overview:'营运总览',users:'学生资料',questions:'逐题统计',visits:'停留超过一分钟',activity:'操作记录',audit:'会员变更记录'}[tab]}</h1></div><button disabled={busy} onClick={() => {setRefreshVersion(v=>v+1);void refresh();}}>{busy ? '更新中…' : '刷新'}</button></header>{error && <p className="error" role="alert">{error}</p>}{notice && <p className="success" role="status">{notice}</p>}{tab === 'tutoring' && <AdminTutoring actorId={actorId} refreshVersion={refreshVersion} filter={route.tutoringFilter} setFilter={tutoringFilter=>updateRoute({tutoringFilter},true)}/>}<AdminOrders refreshVersion={refreshVersion} active={tab === 'payments'} onOpen={() => setTab('payments')} onChanged={refresh}/>{!data ? <section className="panel">正在读取资料…</section> : <>{tab === 'overview' && <><div className="metrics">{[['注册学生',data.summary.students],['有效会员',data.summary.members],['7 日活跃学生',data.summary.active],['24 小时操作',data.summary.operations],['7 日内到期',data.summary.expiring],['累计专注分钟',data.summary.focusMinutes]].map(([label,n]) => <div key={label}><span>{label}</span><strong>{n}</strong></div>)}</div><section className="admin-shortcuts"><button onClick={() => setTab('users')}>学生学习 →</button><button onClick={() => setTab('tutoring')}>答疑 →</button><button onClick={() => setTab('payments')}>付款申请 →</button></section><AdminCharts data={data} language={language}/><details className="panel"><summary>题目与知识点统计</summary><AdminQdnaOverview language={language} revision={refreshVersion}/></details><section className="panel"><details><summary>近 30 天学习动态明细</summary><Table labelFor={translate} headings={['日期','活跃学生','操作次数']} rows={data.daily.map(d => [d.day,d.students,d.operations])}/></details></section></>}{['questions','visits'].includes(tab) && <AdminInsights key={tab} mode={tab} revision={refreshVersion} language={language} onStudent={id=>updateRoute({tab:'users',selectedId:id,learningTab:'active'})}/>} {tab === 'users' && <section className="panel"><div className="toolbar"><label className="grow">搜索学生<input type="search" placeholder="昵称、邮箱或用户编号" value={query} onChange={e => setQuery(e.target.value)}/></label><label>会员状态<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">全部状态</option>{Object.entries(statuses).map(([id,label]) => <option key={id} value={id}>{label}</option>)}<option value="expiring">7 日内到期</option></select></label><button disabled={busy} onClick={exportAll}>导出全部学生 Excel</button></div><Table labelFor={translate} headings={['用户名','邮箱','会员状态','到期日','最近活动','标记错题数','已掌握错题数','专注分钟','学生详情']} rows={members.map(s => [<><strong>{s.nickname || '待完善资料'}</strong><small>#{s.id}</small></>,s.email,<Badge member={s.membership}/>,date(s.membership.endsAt),date(s.lastActivity),s.activeMistakes ?? '—',s.mastered ?? '—',s.focusMinutes,<button onClick={() => choose(s)}>查看 Profile</button>])}/></section>}{tab === 'activity' && <section className="panel">{activityTable}</section>}{tab === 'audit' && <section className="panel">{auditTable}</section>}{selected && tab === 'users' && <section className="panel detail" ref={detailPanel}><div className="toolbar"><div className="grow"><span className="student-id">#{selected.id}</span><h2>{selected.nickname || selected.email}</h2><p>{selected.email} · {selected.grade || '年级未填'}</p></div><button onClick={() => { setSelectedId(null); setConfirm(null); }}>关闭详情</button></div><details className="admin-membership"><summary>会员管理</summary><div className="membership-form"><div><Badge member={selected.membership}/><p>目前到期日：{date(selected.membership.endsAt)}</p></div><div><label>开通／延长天数<select value={days} onChange={e => setDays(e.target.value)}>{[7,30,90,180,365].map(d => <option key={d} value={d}>{d} 天</option>)}</select></label><label>操作原因<input maxLength={300} value={reason} onChange={e => setReason(e.target.value)} /></label><div className="toolbar"><button className="primary" onClick={() => prepare('extend')}>开通／延长会员</button><button className="danger" disabled={!selected.membership.active} onClick={() => prepare('revoke')}>暂停会员</button></div></div></div></details>{detail ? <AdminLearning key={selected.id} detail={detail} tab={route.learningTab} setTab={learningTab=>updateRoute({learningTab})} nextBatch={() => setReviewBatch(n => n + 1)} language={language}/> : <p role="status">加载中…</p>}<AdminInsights key={`visits-${selected.id}`} mode="visits" userId={selected.id} revision={refreshVersion} language={language}/><details className="admin-history"><summary>此学生的操作记录</summary>{activityTable}</details><details className="admin-history"><summary>此学生的会员变更</summary>{auditTable}</details></section>}</>}{confirm && <div className="modal-backdrop"><section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title"><h2 id="confirm-title">确认会员变更</h2><p>{confirm.email}</p><p>{confirm.action === 'extend' ? `开通／延长 ${confirm.days} 天` : '立即暂停会员权限'}</p><p>原因：{confirm.reason}</p><div className="toolbar"><button disabled={saving} onClick={() => setConfirm(null)}>返回修改</button><button className="primary" disabled={saving} onClick={save}>{saving ? '保存中…' : '确认保存'}</button></div>{error && <p className="error" role="alert">{error}</p>}</section></div>}</main></div>);
}
