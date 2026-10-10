import { BrandLogo } from '../components/BrandLogo';
import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Camera, Upload, UserRound, Settings, LogOut } from "lucide-react";
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { AVATARS, PHYSICISTS, GRADES, TARGETS } from '../lib/avatar-catalog';

export function ProfileView({ embedded = false, logoutError, user, onSaved, onLogout, onCancel, mistakes = {}, language = 'chn', openPaper, openKnowledge }) {
  const [showAvatars, setShowAvatars] = useState(!user.profileComplete);
  const picker = useRef(null); const camera = useRef(null);
  function togglePicker() { setShowAvatars(true); requestAnimationFrame(() => { picker.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); picker.current?.focus({ preventScroll: true }); }); }
  function closePicker() { setShowAvatars(false); camera.current?.focus(); }
  const [password, setPassword] = useState(''); const [confirmPassword, setConfirmPassword] = useState('');
  const [nickname, setNickname] = useState(user.nickname || '');
  const [grade, setGrade] = useState(user.grade || '');
  const [targetMajor, setTargetMajor] = useState(user.targetMajor || '');
  const [target, setTarget] = useState(user.target || '');
  const [avatar, setAvatar] = useState(user.avatar || '');
  const [person, setPerson] = useState(AVATARS.find(a => a.id === user.avatar)?.person || 'newton');
  const [mode, setMode] = useState(user.avatar === 'upload' ? 'upload' : 'physicists');
  const [image, setImage] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [processing, setProcessing] = useState(false);
  const uploadVersion = useRef(0); const fileInput = useRef(null);
  const selected = AVATARS.find(a => a.id === avatar);
  const preview = avatar === 'upload' ? image || user.avatarUrl : selected?.url;
  function choose(item) { uploadVersion.current++; setProcessing(false); setAvatar(item.id); setImage(''); setError(''); }
  async function upload(event) {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    const version = ++uploadVersion.current; setError(''); setProcessing(true);
    try {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) throw new Error('请选择 2 MB 以内的 JPG、PNG 或 WebP 图片。');
      const bitmap = await createImageBitmap(file);
      if (bitmap.width * bitmap.height > 16000000) { bitmap.close(); throw new Error('图片尺寸过大，请缩小后再上传。'); }
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 384;
      const size = Math.min(bitmap.width, bitmap.height);
      canvas.getContext('2d').drawImage(bitmap, (bitmap.width - size) / 2, (bitmap.height - size) / 2, size, size, 0, 0, 384, 384); bitmap.close();
      if (version !== uploadVersion.current) return;
      setImage(canvas.toDataURL('image/webp', 0.9)); setAvatar('upload');
    } catch (e) { if (version === uploadVersion.current) setError(e.message || '无法读取图片，请换一张再试。'); }
    finally { if (version === uploadVersion.current) setProcessing(false); }
  }
  async function submit(event) {
    event.preventDefault(); if (busy || processing) return;
    if (!user.hasPassword && (!user.profileComplete || password || confirmPassword) && (password.length < 8 || password !== confirmPassword)) { setError(password !== confirmPassword ? '两次输入的密码不一致。' : '密码至少需要 8 个字符。'); return; } setBusy(true); setError('');
    try { const result = await api('profile', { nickname, grade, target, targetMajor, avatar, ...(!user.hasPassword && (password || confirmPassword) ? { password, confirmPassword } : {}), ...(image && avatar === 'upload' ? { image } : {}) }, 'PUT'); onSaved(result.user); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <section className={`profile-page page-enter${embedded ? ' profile-embedded' : ''}`}>
    <header className="profile-header">{onCancel && <Button variant="ghost" onClick={onCancel}><ArrowLeft/>{language==='eng'?'Back':'返回'}</Button>}{!embedded && (onCancel ? <button type="button" className="auth-brand profile-home" aria-label="DSE Physics，返回主页" disabled={busy} onClick={onCancel}><BrandLogo language={language}/></button> : <span className="auth-brand"><BrandLogo language={language}/></span>)}</header>
    <div className="profile-welcome"><h1><Settings aria-hidden="true" />{user.profileComplete ? '个人设置' : '建立你的物理学习档案'}</h1>{!user.profileComplete && <ol className="profile-steps"><li><Check /> 邮箱已验证</li><li aria-current="step"><span>2</span> 完善个人资料</li></ol>}</div>
    <form className={`profile-layout ${user.profileComplete ? "profile-existing" : ""}`} onSubmit={submit}>
      <section className="profile-details"><div className="profile-preview">{preview ? <img src={preview} alt="你的头像预览" /> : <UserRound aria-label="尚未选择头像" />}<button ref={camera} className="profile-camera" type="button" aria-label="更换头像" aria-expanded={showAvatars} aria-controls="avatar-picker" disabled={busy} onClick={togglePicker}><Camera /></button></div>
        <p className="profile-email">{user.email}</p>
        <label className="profile-label" htmlFor="profile-nickname">你的昵称 <small>{[...nickname].length}/24</small></label><input id="profile-nickname" autoComplete="nickname" placeholder="大家可以怎样称呼你？" value={nickname} onChange={e => setNickname(e.target.value)} required maxLength={48} disabled={busy} />
        <fieldset disabled={busy}><legend>就读年级</legend><div className="profile-choices">{GRADES.map(value => <label key={value} className={grade === value ? 'chosen' : ''}><input type="radio" name="grade" value={value} checked={grade === value} onChange={() => setGrade(value)} required /><span>{value}</span></label>)}</div></fieldset>
        <fieldset disabled={busy}><legend>目标等级</legend><div className="profile-choices">{TARGETS.map(value => <label key={value} className={target === value ? 'chosen' : ''}><input type="radio" name="target" value={value} checked={target === value} onChange={() => setTarget(value)} required /><span>{value}</span></label>)}</div></fieldset>
        <label className="profile-label" htmlFor="profile-major">我的目标专业是：</label><input id="profile-major" placeholder="例如：物理学、工程学、医学（选填）" value={targetMajor} onChange={e => setTargetMajor(e.target.value)} maxLength={100} disabled={busy} />
        {!user.hasPassword && <div className="profile-password"><h3>设定登录密码</h3><p>{user.profileComplete ? '选填 · ' : ''}至少 8 个字符</p><label>新密码<input type="password" autoComplete="new-password" minLength={8} maxLength={128} required={!user.profileComplete} disabled={busy} value={password} onChange={e => setPassword(e.target.value)} /></label><label>确认新密码<input type="password" autoComplete="new-password" minLength={8} maxLength={128} required={!user.profileComplete || Boolean(password)} disabled={busy} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /></label></div>}
        {error && <p className="account-error" role="alert">{error}</p>}
        <Button className="profile-submit" disabled={busy || processing || !avatar || !nickname.trim() || !grade || !target || [...nickname.trim()].length > 24} type="submit">{busy ? '正在保存…' : user.profileComplete ? '保存个人资料' : '完成注册，开始学习'}<ArrowRight /></Button>
      </section>
      <section hidden={!showAvatars} id="avatar-picker" ref={picker} tabIndex={-1} className="profile-avatar-panel">{user.profileComplete && <button type="button" className="profile-picker-close" onClick={closePicker}>完成选择，返回个人设置</button>}<div className="profile-panel-heading"><div><h2>选择你的头像</h2></div><span>10 位物理学家 · 50 个造型</span></div>
        <div className="avatar-mode"><button type="button" aria-pressed={mode === 'physicists'} onClick={() => setMode('physicists')}>物理学家</button><button type="button" aria-pressed={mode === 'upload'} onClick={() => setMode('upload')}>上传我的图片</button></div>
        {mode === 'physicists' ? <><div className="physicist-tabs" aria-label="选择物理学家">{PHYSICISTS.map(p => <button disabled={busy} type="button" key={p.id} aria-pressed={person === p.id} onClick={() => setPerson(p.id)}>{p.name}</button>)}</div><div className="physicist-title"><h3>{PHYSICISTS.find(p => p.id === person)?.name}</h3><span>{PHYSICISTS.find(p => p.id === person)?.en}</span></div><div className="avatar-options" role="group" aria-label="选择头像姿势">{AVATARS.filter(a => a.person === person).map(a => <button disabled={busy} type="button" key={a.id} className={avatar === a.id ? 'selected' : ''} aria-pressed={avatar === a.id} aria-label={a.name} onClick={() => choose(a)}><img src={a.url} alt={a.name} loading="lazy" /><span>{a.name.split(' · ')[1]}</span>{avatar === a.id && <i><Check /></i>}</button>)}</div></> : <div className="avatar-upload"><div className="upload-preview">{preview && avatar === 'upload' ? <img src={preview} alt="上传图片预览" /> : <Upload />}</div><h3>让大家认识你</h3><input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" aria-label="上传自订头像" onChange={upload} disabled={busy || processing} /><Button variant="outline" type="button" disabled={busy || processing} onClick={() => fileInput.current?.click()}>{processing ? '正在处理…' : '选择图片'}</Button><small>JPG、PNG、WebP · 最大 2 MB</small></div>}
      </section>

    </form>
    <footer className="profile-footer">{logoutError && <p className="account-error" role="alert">{logoutError}</p>}<Button className="profile-logout" variant="outline" type="button" disabled={busy || processing} onClick={onLogout}><LogOut aria-hidden="true" />退出登录</Button></footer>
  </section>;
}
