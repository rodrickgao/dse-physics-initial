import { Languages } from 'lucide-react';
import { createPortal } from 'react-dom';

export function LanguageSwitch({ language, setLanguage }) {
  const english = language === 'eng';
  return createPortal(<button type="button" className="language-switch" translate="no" aria-label={english ? 'Switch to Chinese' : '切换为英文'} title={english ? 'Switch to Chinese' : '切换为英文'} onClick={() => setLanguage(english ? 'chn' : 'eng')}><Languages aria-hidden="true" strokeWidth={1.75}/></button>, document.body);
}
