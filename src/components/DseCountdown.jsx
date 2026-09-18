import { useEffect, useState } from 'react';
import { getDseCountdown } from '../lib/dse-countdown';
import './dse-countdown.css';

export function DseCountdown({ language }) {
  const [countdown, setCountdown] = useState(() => getDseCountdown());
  useEffect(() => {
    let timer;
    const refresh = () => {
      const now = Date.now();
      setCountdown(getDseCountdown(new Date(now)));
      clearTimeout(timer);
      // Hong Kong midnight is 16:00 UTC; update even if the page stays open.
      timer = setTimeout(refresh, 86400000 - ((now + 8 * 3600000) % 86400000));
    };
    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  const english = language === 'eng';
  return <div className="dse-countdown" role="status" aria-live="polite" aria-atomic="true">
    {countdown.examMonth
      ? <span className="dse-countdown-cheer">{'考试加油，你一定行！'}</span>
      : <><span>{'距离 DSE 还有'}</span><strong>{countdown.days}</strong><span>{'天'}</span></>}
  </div>;
}
