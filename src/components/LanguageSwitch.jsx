import { Languages } from 'lucide-react';

export function LanguageSwitch({ language, setLanguage }) {
  const english = language === 'eng';
  return <button type="button" className="language-switch" translate="no" aria-label={english ? 'Switch to Chinese' : '切换为英文'} title={english ? 'Switch to Chinese' : '切换为英文'} onClick={() => setLanguage(english ? 'chn' : 'eng')}><Languages aria-hidden="true"/><span translate="no">{english ? '中文' : 'EN'}</span></button>;
}
