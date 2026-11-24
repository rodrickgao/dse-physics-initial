import { useEffect, useRef, useState } from 'react';
import { adminApi as api } from '../lib/admin-api';

const emailStatuses = {
  disabled: ['本地预览', 'Local preview'],
  sent: ['已发送', 'Sent'],
  pending: ['等待发送', 'Queued'],
  retry: ['等待重试', 'Retry pending'],
  stopped: ['发送已停止', 'Delivery stopped']
};

export function AdminSecurity({ alertId, refreshVersion, language, onShowAll, onReviewed }) {
  const [rows, setRows] = useState(null);
  const [loadingError, setLoadingError] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [busy, setBusy] = useState(null);
  const reviewing = useRef(false);
  const version = useRef(0);
  const english = language === 'eng';
  const label = (zh, en) => english ? en : zh;
  const localDate = value => new Date(value).toLocaleString(english ? 'en-HK' : 'zh-CN', { timeZone: 'Asia/Hong_Kong' });

  useEffect(() => {
    async function load() {
      if (reviewing.current) return;
      const request = ++version.current;
      try {
        const result = await api('admin/security-alerts' + (alertId ? '?id=' + encodeURIComponent(alertId) : ''));
        if (request === version.current) { setRows(result.rows); setLoadingError(''); }
      } catch (error) {
        if (request === version.current) setLoadingError(error.message);
      }
    }
    void load();
    const timer = setInterval(load, 15000);
    return () => { version.current++; clearInterval(timer); };
  }, [alertId, refreshVersion]);

  async function review(id, action) {
    if (reviewing.current) return;
    reviewing.current = true;
    version.current++;
    setBusy(id);
    setReviewError('');
    try {
      const { alert } = await api('admin/security-alerts/review', { id, action });
      setRows(current => current.map(row => row.id === id ? alert : row));
      onReviewed();
    } catch (error) {
      setReviewError(error.message);
    } finally {
      reviewing.current = false;
      setBusy(null);
    }
  }

  return <section className="panel security-alerts">
    {alertId && <button onClick={onShowAll}>{label('查看全部告警', 'View all alerts')}</button>}
    {loadingError && <p className="error" role="alert">{loadingError}</p>}
    {reviewError && <p className="error" role="alert">{reviewError}</p>}
    {rows === null && !loadingError && <p role="status">{label('正在读取告警…', 'Loading alerts…')}</p>}
    {rows?.length === 0 && <p>{label('暂无安全告警。', 'No security alerts.')}</p>}
    {rows?.map(alert => {
      const { path, count, maximum, windowMs, retryAfter, ip, userAgent } = alert.latestEvidence;
      const subject = alert.email || (alert.scope === 'shared' ? label('同一 IP 的多账号流量', 'Multiple accounts on one IP') : label('未登录访客', 'Guest'));
      const rule = alert.reason === 'distinct'
        ? label(`${count} 次不同题目读取`, `${count} distinct question requests`)
        : label(`${count} 次请求`, `${count} requests`);
      const status = alert.banned_at !== null ? label('账号已封禁', 'Account banned')
        : alert.decision === 'dismissed' ? label('已忽略', 'Dismissed') : label('待审核', 'Pending review');
      return <article className="tutoring-thread" key={alert.id}>
        <div className="toolbar"><strong>{subject}{alert.user_id && ` · #${alert.user_id}`}</strong><strong role="status">{status}</strong></div>
        <p>{label(`${windowMs / 60000} 分钟内 ${rule}，限额 ${maximum} 次`, `${rule} in ${windowMs / 60000} min, limit ${maximum}`)} · HTTP 429
          {' · '}{label(`冷却 ${retryAfter} 秒`, `${retryAfter}s cooldown`)}</p>
        <dl className="security-alert-details">
          <dt>{label('首次触发（香港时间）', 'First seen (HKT)')}</dt><dd>{localDate(alert.created_at)}</dd>
          {alert.occurrences > 1 && <><dt>{label('最近触发', 'Last seen')}</dt><dd>{localDate(alert.last_at)} · {label(`记录 ${alert.occurrences} 次`, `${alert.occurrences} recorded`)}</dd></>}
          <dt>{label('涉及路径', 'Path')}</dt><dd><code>{path}</code></dd>
          <dt>{label('来源 IP', 'Source IP')}</dt><dd>{ip}</dd>
          <dt>{label('客户端标识', 'User agent')}</dt><dd>{userAgent || '—'}</dd>
          <dt>{label('告警邮件', 'Alert email')}</dt><dd>{label(...emailStatuses[alert.mailStatus])}</dd>
          {alert.reviewed_at !== null && <><dt>{label('审核记录', 'Review')}</dt><dd>{localDate(alert.reviewed_at)} · #{alert.reviewed_by}</dd></>}
        </dl>
        {alert.decision === 'pending' && <div className="toolbar">
          {alert.email && alert.banned_at === null && <button className="danger" disabled={busy !== null} onClick={() => review(alert.id, 'ban')}>{label('封号', 'Ban account')}</button>}
          <button disabled={busy !== null} onClick={() => review(alert.id, 'dismiss')}>{label('忽略告警', 'Dismiss alert')}</button>
        </div>}
      </article>;
    })}
  </section>;
}
