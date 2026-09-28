import { getUiLanguage } from '../lib/ui-translations';
import { MEMBER_FEATURES } from '../lib/membership-benefits';
import { Check, Crown, ArrowLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { useMembership } from '../components/Membership';
import './subscription.css';

const freeFeatures = ['真题与课本习题标答', '课本知识内容', '错题库与回收站', '原卷下载与专注计时'];
function Features({ items }) { return <ul className="plan-features">{items.map(item => <li key={item}><Check aria-hidden="true"/>{item}</li>)}</ul>; }
export function SubscriptionView({ navigate }) {
  const membership = useMembership();
  return <div className="subscription-view page-enter"><div className="view-heading"><h1>{membership.active ? '我的会员' : '开通会员'}</h1></div>
    <div className="subscription-plans">
      <section className="subscription-plan"><span className="plan-tag">注册邮箱即可使用</span><h2>免费版</h2><div className="plan-price"><span>¥</span><strong>0</strong></div><Features items={freeFeatures}/><Button variant="outline" disabled>{membership.active ? '已包含在会员权益中' : '当前版本'}</Button></section>
      <section className="subscription-plan featured"><span className="plan-tag"><Crown aria-hidden="true"/>会员版</span><h2>学懂每一道题</h2><div className="plan-price"><span>¥</span><strong>59</strong><span>/ 30 天</span></div><Features items={['免费版全部功能', ...MEMBER_FEATURES]}/>{membership.active && <p className="plan-status">会员有效至 {new Date(membership.endsAt).toLocaleDateString(getUiLanguage() === 'eng' ? 'en-HK' : 'zh-CN')}</p>}<Button size="lg" disabled={membership.active} onClick={() => navigate('payment')}>{membership.active ? '会员已开通' : '开通 30 天会员'}</Button></section>
    </div>
  </div>;
}
export function PaymentView({ navigate, user, uploadPage = false }) {
  const membership = useMembership();
  const [order, setOrder] = useState(null), [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const requestId = useRef(crypto.randomUUID());
  const [receipt, setReceipt] = useState(''), [reading, setReading] = useState(false);
  async function chooseReceipt(event) {
    const file = event.target.files?.[0]; if (!file) return;
    setReceipt(''); setError('');
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setError('请选择不超过 5MB 的 JPG、PNG 或 WebP 图片。'); return; }
    setReading(true);
    try { const data = await new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }); setReceipt(data); }
    catch { setError('截图读取失败，请重新选择。'); } finally { setReading(false); }
  }
  useEffect(() => { let live = true; api('orders').then(result => { if (live) { setOrder(result.order); setReady(true); } }).catch(e => { if (live) setError(e.message); }); return () => { live = false; }; }, []);
  useEffect(() => {
    if (order?.status !== 'pending') return;
    let live = true, timer;
    async function poll() { try { const result = await api('orders'); if (live) { setOrder(result.order); setError(''); if (result.order?.status === 'approved') window.dispatchEvent(new Event('focus')); } } catch(e) { if (live) setError(e.message); } finally { if (live) timer = setTimeout(poll, 3000); } }
    timer = setTimeout(poll, 3000); return () => { live = false; clearTimeout(timer); };
  }, [order?.status]);
  async function submit() { if (membership.active || !receipt || busy) return; setBusy(true); setError(''); try { const result = await api('orders', {requestId: requestId.current, receipt}); setOrder(result.order); requestId.current = crypto.randomUUID(); setReceipt(''); window.dispatchEvent(new Event('focus')); navigate('activating'); } catch(e) { setError(e.message); } finally { setBusy(false); } }

  return <div className="subscription-view payment-view page-enter"><Button variant="ghost" onClick={() => navigate('membership')}><ArrowLeft/>返回会员方案</Button><div className="view-heading"><h1>{uploadPage ? '上传付款截图' : '开通会员'}</h1></div>
    <section className={uploadPage ? "payment-card receipt-card" : "payment-card"}>{!uploadPage && <div className="payment-summary"><span className="plan-tag">会员版 · 30 天</span><div className="plan-price"><span>¥</span><strong>59</strong><span>/ 30 天</span></div><Features items={MEMBER_FEATURES}/><div className="payment-account"><span>开通账号</span><strong>{user.email}</strong></div></div>}
      <div className="payment-code-panel"><h2>{uploadPage ? '付款成功截图' : '扫码支付 · 30 天会员'}</h2>{!uploadPage && <a className="payment-code-image" href="/assets/payments/wechat-receive-20260922.jpg" target="_blank" rel="noopener noreferrer"><img src="/assets/payments/wechat-receive-20260922.jpg" width="828" height="1124" alt={getUiLanguage() === 'eng' ? 'WeChat Pay collection code for Gao Duoduo' : '高多多微信收款码'}/><span>{getUiLanguage() === 'eng' ? 'Open full-size code · Long press to save on mobile' : '点击查看原图 · 手机可长按保存'}</span></a>}<p role="status">{membership.active ? '会员已开通' : order?.status === 'pending' ? '已提交，等待管理员确认' : order?.status === 'rejected' ? '会员已暂停：' + (order.rejection_reason || '付款申请未通过') : '付款后上传截图，提交管理员审核'}</p>{(!uploadPage || membership.active) && <Button disabled={!ready || busy || membership.active} onClick={() => navigate('receipt')}>{membership.active ? '会员已开通' : '我已付款'}</Button>}{uploadPage && ready && !membership.active && order?.status !== 'pending' && <div className="receipt-upload"><label htmlFor="payment-receipt">付款成功截图</label><input id="payment-receipt" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || reading} onChange={chooseReceipt}/>{receipt && <img src={receipt} alt="付款截图预览"/>}<Button disabled={!receipt || busy || reading} onClick={submit}>{busy ? '提交中…' : reading ? '读取中…' : '提交审核'}</Button><Button variant="ghost" disabled={busy || reading} onClick={() => navigate('membership')}>取消</Button></div>}{error && <p role="alert">{error}</p>}{!ready && error && <Button variant="outline" onClick={() => window.location.reload()}>重新加载</Button>}</div>
    </section>
  </div>;
}


export function MemberWelcome({ navigate, activating = false }) {
  const [state,setState] = useState(null), [error,setError] = useState('');
  const [order,setOrder] = useState(null);
  useEffect(() => {
    let live=true;
    const refresh=async()=>{try { const [result,orders]=await Promise.all([api('membership'),api('orders')]); if(live){setState(result.membership);setOrder(orders.order);setError('');if(result.membership.active)window.dispatchEvent(new Event('focus'));} }catch(e){if(live)setError(e.message);} };
    void refresh(); const timer=setInterval(refresh,3000);return()=>{live=false;clearInterval(timer);};
  },[activating,navigate]);
  return <section className="member-welcome page-enter">
    {error ? <p role="alert">{error}</p> : !state ? <p role="status">正在加载会员状态…</p> : state.active ? <MemberCelebration navigate={navigate}/> : order?.status==='pending' ? <><h1 aria-live="polite">已提交，等待审核</h1><p>审核通过后，会员权益会自动开通。</p><Button onClick={()=>navigate('bank')}>继续学习</Button></> : <><h1>{order?.status==='rejected'?'付款申请未通过':'会员暂不可用'}</h1>{order?.rejection_reason&&<p>{order.rejection_reason}</p>}<Button onClick={()=>navigate('receipt')}>查看详情</Button></>}
  </section>;
}

function MemberCelebration({ navigate }) {
  const [celebrating, setCelebrating] = useState(true);
  useEffect(() => { const timer = setTimeout(() => setCelebrating(false), 5500); return () => clearTimeout(timer); }, []);
  return <>
    {celebrating && <div className="member-confetti" aria-hidden="true">{Array.from({length:56}, (_,i) => <i key={i} style={{'--origin': i % 2 ? '82%' : '18%', '--drift': ((i * 73 % 460) - 230) + 'px', '--rise': -(90 + i * 31 % 170) + 'px', '--turn': (i % 2 ? 720 : -720) + 'deg', '--delay': (0.15 + i % 7 * 0.075) + 's', '--duration': (3.3 + i % 5 * 0.25) + 's', backgroundColor: ['#f6bd3a','#377df5','#ef739c','#62c8ac','#a78bea'][i % 5]}} />)}</div>}
    <div className="member-success-content"><Crown className="welcome-crown"/><h1>恭喜，你已开通会员，体验专属功能：</h1><Features items={MEMBER_FEATURES}/><Button onClick={()=>navigate('bank')}>开始体验</Button></div>
  </>;
}
