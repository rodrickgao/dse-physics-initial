import { Check, Crown, ArrowLeft, QrCode } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { useMembership } from '../components/Membership';
import './subscription.css';

const freeFeatures = ['历年真题与官方答案', '课本知识内容', '错题库与回收站', '原卷下载与专注计时'];
function Features({ items }) { return <ul className="plan-features">{items.map(item => <li key={item}><Check aria-hidden="true"/>{item}</li>)}</ul>; }
export function SubscriptionView({ navigate }) {
  const membership = useMembership();
  return <div className="subscription-view page-enter"><div className="view-heading"><h1>开通会员</h1></div>
    <div className="subscription-plans">
      <section className="subscription-plan"><span className="plan-tag">注册邮箱即可使用</span><h2>免费版</h2><div className="plan-price"><span>¥</span><strong>0</strong></div><Features items={freeFeatures}/><Button variant="outline" disabled>{membership.active ? '已包含在会员权益中' : '当前版本'}</Button></section>
      <section className="subscription-plan featured"><span className="plan-tag"><Crown aria-hidden="true"/>会员版</span><h2>学懂每一道题</h2><div className="plan-price"><span>¥</span><strong>59</strong><span>/ 月</span></div><Features items={['免费版全部功能', '每道题的详细思路解答', '题目与知识点双向关联']}/>{membership.active && <p className="plan-status">会员有效至 {new Date(membership.endsAt).toLocaleDateString('zh-CN')}</p>}<Button size="lg" disabled={membership.active} onClick={() => navigate('payment')}>{membership.active ? '已订阅' : '订阅'}</Button></section>
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

  return <div className="subscription-view payment-view page-enter"><Button variant="ghost" onClick={() => navigate('membership')}><ArrowLeft/>返回会员方案</Button><div className="view-heading"><h1>{uploadPage ? '上传付款截图' : '订阅会员'}</h1></div>
    <section className={uploadPage ? "payment-card receipt-card" : "payment-card"}>{!uploadPage && <div className="payment-summary"><span className="plan-tag">会员版 · 月度订阅</span><div className="plan-price"><span>¥</span><strong>59</strong><span>/ 月</span></div><Features items={['每道题的详细思路解答', '题目与知识点双向关联']}/><div className="payment-account"><span>开通账号</span><strong>{user.email}</strong></div></div>}
      <div className="payment-code-panel"><h2>{uploadPage ? '付款成功截图' : '扫码支付 · 30 天会员'}</h2>{!uploadPage && <div className="payment-code-placeholder" aria-label="收款码待添加"><QrCode aria-hidden="true"/><strong>收款码待添加</strong></div>}<p role="status">{membership.active ? '会员已开通' : order?.status === 'pending' ? '已提交，等待管理员确认' : order?.status === 'rejected' ? '会员已暂停：' + (order.rejection_reason || '付款申请未通过') : '付款后上传截图，提交管理员审核'}</p>{(!uploadPage || membership.active) && <Button disabled={!ready || busy || membership.active} onClick={() => navigate('receipt')}>{membership.active ? '已订阅' : '我已付款'}</Button>}{uploadPage && ready && !membership.active && order?.status !== 'pending' && <div className="receipt-upload"><label htmlFor="payment-receipt">付款成功截图</label><input id="payment-receipt" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || reading} onChange={chooseReceipt}/>{receipt && <img src={receipt} alt="付款截图预览"/>}<Button disabled={!receipt || busy || reading} onClick={submit}>{busy ? '提交中…' : reading ? '读取中…' : '已上传'}</Button><Button variant="ghost" disabled={busy || reading} onClick={() => navigate('membership')}>取消</Button></div>}{error && <p role="alert">{error}</p>}{!ready && error && <Button variant="outline" onClick={() => window.location.reload()}>重新加载</Button>}</div>
    </section>
  </div>;
}


export function MemberWelcome({ navigate, activating = false }) {
  const [activationStep, setActivationStep] = useState(0);
  const [state,setState] = useState(null), [error,setError] = useState('');
  useEffect(() => {
    if (activating) { setActivationStep(0); const timers=[setTimeout(() => setActivationStep(1),1700),setTimeout(() => setActivationStep(2),3400),setTimeout(() => navigate('member-success'),5000)]; return () => timers.forEach(clearTimeout); }
    let live=true;
    const refresh=async()=>{try { const result=await api('membership'); if(live){setState(result.membership);setError('');window.dispatchEvent(new Event('focus'));} }catch(e){if(live)setError(e.message);} };
    void refresh(); const timer=setInterval(refresh,3000);return()=>{live=false;clearInterval(timer);};
  },[activating,navigate]);
  return <section className="member-welcome page-enter">
    {activating ? <><div className="member-spinner" aria-hidden="true"/><h1 role="status">{['正在开通...', '正在核实付款信息...', '马上开通...'][activationStep]}</h1><p>正在为你准备专属功能</p></> : error ? <p role="alert">{error}</p> : !state ? <p role="status">正在加载会员状态…</p> : state.active ? <MemberCelebration navigate={navigate}/> : <><h1>会员暂不可用</h1><p>请到会员页面查看申请状态。</p><Button onClick={()=>navigate('receipt')}>查看详情</Button></>}
  </section>;
}

function MemberCelebration({ navigate }) {
  const [celebrating, setCelebrating] = useState(true);
  useEffect(() => { const timer = setTimeout(() => setCelebrating(false), 5500); return () => clearTimeout(timer); }, []);
  return <>
    {celebrating && <div className="member-confetti" aria-hidden="true">{Array.from({length:56}, (_,i) => <i key={i} style={{'--origin': i % 2 ? '82%' : '18%', '--drift': ((i * 73 % 460) - 230) + 'px', '--rise': -(90 + i * 31 % 170) + 'px', '--turn': (i % 2 ? 720 : -720) + 'deg', '--delay': (0.15 + i % 7 * 0.075) + 's', '--duration': (3.3 + i % 5 * 0.25) + 's', backgroundColor: ['#f6bd3a','#377df5','#ef739c','#62c8ac','#a78bea'][i % 5]}} />)}</div>}
    <div className="member-success-content"><Crown className="welcome-crown"/><h1>恭喜，你已开通会员，体验专属功能：</h1><Features items={['每道题的详细思路解答','题目与知识点双向关联','含详细思路的错题 PDF 导出']}/><Button onClick={()=>navigate('papers')}>开始体验</Button></div>
  </>;
}
