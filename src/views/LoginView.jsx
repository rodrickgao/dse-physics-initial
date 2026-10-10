import { LoginSupport } from './SupportView';
import { BrandLogo } from '../components/BrandLogo';
import { rememberedAccounts, forgetAccount } from '../lib/remembered-accounts';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronDown } from "lucide-react";
import { Button } from '../components/ui/button';
import { api } from '../lib/api';

export function LoginView({ language, setLanguage, onLogin, mailMode }) {
  const [accounts, setAccounts] = useState(rememberedAccounts);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const emailField = useRef(null);
  const passwordField = useRef(null);
  const codeField = useRef(null);
  const [allAccounts, setAllAccounts] = useState(false);
  function chooseAccount(item) {
    setEmail(item); setSentEmail(''); setPassword(''); setCode(''); setPreview(''); setMessage(''); setError(''); setAccountsOpen(false);
    requestAnimationFrame(() => (mode === 'password' ? passwordField : codeField).current?.focus());
  }
  const [mode, setMode] = useState('code'); const [password, setPassword] = useState('');
  const [email, setEmail] = useState(''); const [code, setCode] = useState('');
  const [sentEmail, setSentEmail] = useState(''); const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [seconds, setSeconds] = useState(0);
  const matchingAccounts = allAccounts ? accounts : accounts.filter(item => item.toLowerCase().includes(email.trim().toLowerCase()));
  const showAccounts = accountsOpen && matchingAccounts.length > 0;
  useEffect(() => { if (!seconds) return; const timer = setTimeout(() => setSeconds(seconds - 1), 1000); return () => clearTimeout(timer); }, [seconds]);
  async function send() {
    setBusy(true); setError(''); setPreview(''); setMessage('');
    try { const result = await api('auth/code', { email }); setSentEmail(email.trim().toLowerCase()); setMessage(result.message); setPreview(result.developmentCode || ''); setSeconds(60); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { const result = await api(mode === 'password' ? 'auth/password' : 'auth/verify', mode === 'password' ? { email, password } : { email, code }); await onLogin(result.user); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <main className="auth-page login-page"><section className="login-brand-stage"><h1 className="login-brand-name">高多多物理 · ddphysics</h1><div className="login-brand-logos" aria-hidden="true"><div className="login-logo-chinese"><BrandLogo language="chn"/></div><div className="login-logo-english"><BrandLogo language="eng"/></div></div><ul className="login-brand-highlights"><li>由神科 BBA（IBGM）学霸打造。</li><li>纯干货，不卖焦虑，一个网站给你物理 5** 所需要的全部资料。</li><li>2400道题，281个知识点，不漏每一个细节。</li><li>错题自动整理到错题本，随时练习。</li></ul></section><section className="auth-card"><div className="login-form-heading"><h2>欢迎来到 ddphysics</h2><p>登录你的物理自习室</p></div><form onSubmit={submit}>{<><div className="login-methods"><button type="button" aria-pressed={mode === 'password'} onClick={() => { setMode('password'); setError(''); }}>密码登录</button><button type="button" aria-pressed={mode === 'code'} onClick={() => { setMode('code'); setPassword(''); setError(''); }}>验证码登录 / 注册</button></div></>}{<><div className="login-email-field" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setAccountsOpen(false); }} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); emailField.current?.focus(); setAccountsOpen(false); } }}>
<label htmlFor="login-email">邮箱地址</label>
<div className="login-email-input"><input ref={emailField} id="login-email" type="email" autoComplete="email" placeholder="you@example.com" required value={email} aria-expanded={showAccounts} aria-controls={showAccounts ? 'login-account-suggestions' : undefined} onFocus={() => setAccountsOpen(true)} onClick={() => setAccountsOpen(true)} onKeyDown={event => { if(event.key === 'ArrowDown' && showAccounts) { event.preventDefault(); event.currentTarget.closest('.login-email-field').querySelector('.remembered-email')?.focus(); } }} onChange={e => { setEmail(e.target.value); setPreview(''); setMessage(''); setAllAccounts(false); setAccountsOpen(true); }} />{accounts.length > 0 && <button type="button" className="login-accounts-toggle" aria-label={language === 'eng' ? 'Choose a saved email' : '选择之前登录的邮箱'} aria-expanded={showAccounts} aria-controls={showAccounts ? 'login-account-suggestions' : undefined} onPointerDown={event => event.preventDefault()} onClick={() => { emailField.current?.focus(); setAllAccounts(true); setAccountsOpen(!showAccounts); }}><ChevronDown aria-hidden="true" /></button>}</div>
{showAccounts && <div id="login-account-suggestions" className="login-account-suggestions" onPointerDown={event => { if (event.target.closest('button')) event.preventDefault(); }} role="group" aria-label="之前登录的账号">{matchingAccounts.map(item => <div key={item}><button type="button" className="remembered-email" onClick={() => chooseAccount(item)}>{item}</button><button type="button" className="forget-account" aria-label={'移除记录 ' + item} onClick={() => { setAccounts(forgetAccount(item)); emailField.current?.focus(); }}>×</button></div>)}</div>}
</div>{mode === 'password' ? <label>登录密码<input ref={passwordField} type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={e => setPassword(e.target.value)} /></label> : <label>六位数验证码<div className="auth-code"><input ref={codeField} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="000000" required value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} /><Button type="button" variant="outline" disabled={busy || seconds > 0 || !email} onClick={send}>{seconds ? `${seconds} 秒后重发` : '获取验证码'}</Button></div></label>}</>}{message && <p role="status">{message}</p>}{preview && <div className="local-code">本机验证码 <strong>{preview}</strong><small>仅供本机测试，没有寄出邮箱。</small></div>}{error && <p className="account-error" role="alert">{error}</p>}<Button className="auth-submit" type="submit" disabled={busy || (mode === 'code' && (!sentEmail || sentEmail !== email.trim().toLowerCase()))}>{busy ? '处理中…' : mode === 'password' ? '使用密码登录' : '注册 / 登录'}<ArrowRight /></Button></form><LoginSupport language={language}/>{mode === 'password' && <button className="auth-switch" type="button" onClick={() => { setMode('code'); setPassword(''); setError(''); }}>忘记密码或尚未设定？使用邮箱验证码登录</button>}{mailMode === 'local' && <p className="auth-note">目前为本机测试模式 · 邮箱尚未启用</p>}</section></main>;
}
