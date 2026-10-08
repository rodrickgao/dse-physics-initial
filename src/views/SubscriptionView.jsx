import { getUiLanguage } from '../lib/ui-translations';
import { MEMBER_FEATURES } from '../lib/membership-benefits';
import { Check, Crown, ArrowLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { useMembership } from '../components/Membership';
import './subscription.css';

const freeFeatures = ['真题与课本习题标答', '课本例题、课本解答与思考题解答', '课本知识内容', '必修一题目与知识点双向关联', '错题库与回收站', '原卷下载与专注计时'];
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
  const en = getUiLanguage() === 'eng';
  const [paymentMethod, setPaymentMethod] = useState(null);
  const paymentCodes = {
    wechat: { logo: '/assets/payments/wechat-pay-logo.svg', name: en ? 'WeChat Pay' : '微信支付', image: '/assets/payments/wechat-receive-20260929.jpg', width: 750, height: 1020 },
    alipay: { logo: '/assets/payments/alipay-logo.svg', name: en ? 'Alipay' : '支付宝', image: '/assets/payments/alipay-receive-20260929.jpg', width: 1182, height: 1772 },
  };
  const selectedPayment = paymentCodes[paymentMethod];
  const [order, setOrder] = useState(null), [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const requestId = useRef(crypto.randomUUID());
  useEffect(() => { if (uploadPage) navigate('payment'); }, [uploadPage, navigate]);
  useEffect(() => { let live = true; api('orders').then(result => { if (live) { setOrder(result.order); setReady(true); } }).catch(e => { if (live) setError(e.message); }); return () => { live = false; }; }, []);
  useEffect(() => {
    if (order?.status !== 'pending') return;
    let live = true, timer;
    async function poll() { try { const result = await api('orders'); if (live) { setOrder(result.order); setError(''); if (result.order?.status === 'approved') window.dispatchEvent(new Event('focus')); } } catch(e) { if (live) setError(e.message); } finally { if (live) timer = setTimeout(poll, 3000); } }
    timer = setTimeout(poll, 3000); return () => { live = false; clearTimeout(timer); };
  }, [order?.status]);
  const submitting = useRef(false);
  async function submit() {
    if (membership.active || !paymentMethod || submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      const result = await api('orders', { requestId: requestId.current, paymentMethod });
      setOrder(result.order);
      window.dispatchEvent(new Event('focus'));
      navigate('activating');
    } catch(e) { setError(e.message); }
    finally { submitting.current = false; setBusy(false); }
  }

  return <div className="subscription-view payment-view page-enter"><Button variant="ghost" onClick={() => navigate('membership')}><ArrowLeft/>返回会员方案</Button><div className="view-heading"><h1>{'开通会员'}</h1></div>
    <section className="payment-card">{<div className="payment-summary"><span className="plan-tag">会员版 · 30 天</span><div className="plan-price"><span>¥</span><strong>59</strong><span>/ 30 天</span></div><Features items={MEMBER_FEATURES}/><div className="payment-account"><span>会员账号</span><strong>{user.email}</strong></div></div>}
      <div className="payment-code-panel"><h2>{selectedPayment ? selectedPayment.name : (en ? 'Choose a payment method' : '选择支付方式')}</h2>{(!selectedPayment ? <div className="payment-methods" role="group" aria-label={en ? 'Payment method' : '支付方式'}>{Object.entries(paymentCodes).map(([method, details]) => <button type="button" key={method} className={`payment-method payment-method-${method}`} onClick={() => setPaymentMethod(method)}><span className="payment-method-label"><img className="payment-method-logo" src={details.logo} width="36" height="36" alt="" aria-hidden="true"/><span>{details.name}</span></span><span aria-hidden="true">→</span></button>)}</div> : <><Button className="payment-change-method" variant="ghost" onClick={() => setPaymentMethod(null)}>{en ? 'Change payment method' : '更换支付方式'}</Button><a className="payment-code-image" href={selectedPayment.image} target="_blank" rel="noopener noreferrer"><img src={selectedPayment.image} width={selectedPayment.width} height={selectedPayment.height} alt={en ? `${selectedPayment.name} collection code` : `${selectedPayment.name}收款码`}/><span>{en ? 'Open full-size code · Long press to save on mobile' : '点击查看原图 · 手机可长按保存'}</span></a></>)}{selectedPayment && <><p role="status">{membership.active ? '会员已开通' : order?.status === 'rejected' ? '会员已暂停：' + (order.rejection_reason || '付款申请未通过') : (en ? 'After paying, click below to activate your membership.' : '付款后点击下方按钮，即可开通会员。')}</p><Button disabled={!ready || busy || membership.active} onClick={submit}>{membership.active ? '会员已开通' : busy ? (en ? 'Activating…' : '正在开通…') : '我已付款'}</Button></>}{error && <p role="alert">{error}</p>}{!ready && error && <Button variant="outline" onClick={() => window.location.reload()}>重新加载</Button>}</div>
    </section>
  </div>;
}


export function MemberWelcome({ navigate, activating = false }) {
  const [state,setState] = useState(null), [error,setError] = useState('');
  const [order,setOrder] = useState(null);
  const [waiting, setWaiting] = useState(activating);
  const [loadingStep, setLoadingStep] = useState(0);
  useEffect(() => {
    setWaiting(activating);
    setLoadingStep(0);
    if (!activating) return;
    const stepTwo = setTimeout(() => setLoadingStep(1), 2500);
    const stepThree = setTimeout(() => setLoadingStep(2), 5000);
    const timer = setTimeout(() => setWaiting(false), 7000);
    return () => { clearTimeout(timer); clearTimeout(stepTwo); clearTimeout(stepThree); };
  }, [activating]);
  useEffect(() => {
    if (activating && !waiting && state?.active && !error) navigate('member-success');
  }, [activating, waiting, state?.active, error, navigate]);
  useEffect(() => {
    let live=true;
    const refresh=async()=>{try { const [result,orders]=await Promise.all([api('membership'),api('orders')]); if(live){setState(result.membership);setOrder(orders.order);setError('');if(result.membership.active)window.dispatchEvent(new Event('focus'));} }catch(e){if(live)setError(e.message);} };
    void refresh(); const timer=setInterval(refresh,3000);return()=>{live=false;clearInterval(timer);};
  },[activating,navigate]);
  return <section className="member-welcome page-enter">
    {error ? <p role="alert">{error}</p> : waiting || !state ? <div className="member-loading" role="status" aria-live="polite"><h1>{getUiLanguage() === 'eng' ? 'Please wait' : '请稍等'}</h1><p className="member-loading-message">{(getUiLanguage() === 'eng' ? ['Checking…', 'Activating your account…', 'Almost there…'] : ['正在核对......', '正在开通账号......', '马上......'])[loadingStep]}</p><div className="member-loading-dots" aria-hidden="true"><i/><i/><i/></div></div> : state.active ? <MemberCelebration navigate={navigate}/> : order?.status==='pending' ? <><h1 aria-live="polite">已提交，等待审核</h1><p>审核通过后，会员权益会自动开通。</p><Button onClick={()=>navigate('bank')}>继续学习</Button></> : <><h1>{order?.status==='rejected'?'付款申请未通过':'会员暂不可用'}</h1>{order?.rejection_reason&&<p>{order.rejection_reason}</p>}<Button onClick={()=>navigate('payment')}>查看详情</Button></>}
  </section>;
}

function MemberCelebration({ navigate }) {
  const [celebrating, setCelebrating] = useState(true);
  useEffect(() => { const timer = setTimeout(() => setCelebrating(false), 12000); return () => clearTimeout(timer); }, []);
  return <>
    {celebrating && <div className="member-confetti" aria-hidden="true">{Array.from({length:56}, (_,i) => <i key={i} style={{'--origin': i % 2 ? '82%' : '18%', '--drift': ((i * 73 % 360) - 180) + 'px', '--rise': -(100 + i * 31 % 160) + 'px', '--turn': (i % 2 ? 540 : -540) + 'deg', '--delay': (0.1 + i % 8 * 0.09) + 's', '--duration': (8 + i % 6 * 0.45) + 's', '--sway-duration': (1.6 + i % 5 * 0.23) + 's', '--sway': (12 + i % 4 * 5) + 'px', '--confetti-color': ['#f6bd3a','#377df5','#ef739c','#62c8ac','#a78bea'][i % 5]}}><span><b/></span></i>)}</div>}
    <div className="member-success-content"><Crown className="welcome-crown"/><h1>恭喜，你已开通会员，体验专属功能：</h1><Features items={MEMBER_FEATURES}/><Button onClick={()=>navigate('bank')}>开始体验</Button></div>
  </>;
}
