import { getUiLanguage } from '../lib/ui-translations';
import { useEffect, useRef, useState } from 'react';
import { adminApi as api } from '../lib/admin-api';

const date = value => new Date(value).toLocaleString(getUiLanguage()==='eng'?'en-HK':'zh-CN');
export function AdminOrders({ active, onOpen, onChanged }) {
  const [data, setData] = useState({pending: [], recent: []}), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(null), [reason, setReason] = useState('');
  const [dismissed, setDismissed] = useState('');
  const generation = useRef(0);
  useEffect(() => {
    let live = true, timer;
    async function poll() { const version = ++generation.current; try { const result = await api('admin/orders'); if (live && version === generation.current) { setData(result); setError(''); } } catch(e) { if (live && version === generation.current) setError(e.message); } finally { if (live) timer = setTimeout(poll, 3000); } }
    void poll(); return () => { live = false; generation.current++; clearTimeout(timer); };
  }, []);
  async function review(orderId, action) {
    setBusy(true); setError(''); generation.current++;
    try { await api('admin/orders/review', {orderId, action, reason}); const result = await api('admin/orders'); generation.current++; setData(result); setRejecting(null); setReason(''); onChanged(); }
    catch(e) { setError(e.message); } finally { setBusy(false); }
  }
  const signature = data.pending.map(o => o.id).join(',');
  return <>{!active && signature && signature !== dismissed && <div className="panel order-alert" role="alert"><strong>{data.pending.length} 条付款申请待处理</strong><button className="primary" onClick={onOpen}>查看申请</button><button onClick={() => setDismissed(signature)}>关闭提示</button></div>}{error && <p className="error" role="alert">付款申请：{error}</p>}{active && <>{rejecting && <section className="panel"><h2>确认不通过并暂停会员</h2><label htmlFor="rejection-reason">不通过理由</label><textarea id="rejection-reason" maxLength={300} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} /><div className="toolbar"><button disabled={busy || !reason.trim()} onClick={() => review(rejecting,'reject')}>确认不通过</button><button disabled={busy} onClick={() => setRejecting(null)}>取消</button></div></section>}{[['待处理',data.pending],['已处理',data.recent]].map(([title, orders]) => <section className="panel" key={title}><h2>{title}{title === '待处理' ? `（${orders.length}）` : ''}</h2><div className="table-scroll"><table><thead><tr>{['学生','金额 / 时长','提交时间','付款截图','状态 / 操作'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{orders.length ? orders.map(order => <tr key={order.id}><td><strong>{order.nickname || '学生'}</strong><small>{order.email}</small></td><td>¥{order.amount_fen / 100} / {order.days} 天</td><td>{date(order.created_at)}</td><td>{order.hasReceipt ? <a className="receipt-link" href={'/api/admin/orders/receipt?id=' + encodeURIComponent(order.id)} target="_blank" rel="noreferrer">查看截图 ↗</a> : '未提供截图'}</td><td>{order.status === 'pending' ? <div className="toolbar"><button className="primary" disabled={busy} onClick={() => review(order.id,'approve')}>确认通过</button><button disabled={busy} onClick={() => {setRejecting(order.id); setReason('');}}>不通过</button></div> : <>{order.status === 'approved' ? '已通过' : '未通过'}<small>{date(order.reviewed_at)}</small>{order.rejection_reason && <p>暂停理由：{order.rejection_reason}</p>}</>}</td></tr>) : <tr><td colSpan={5} className="empty">暂无申请</td></tr>}</tbody></table></div></section>)}</>}</>;
}

