import { clearExerciseCache } from '../lib/textbook-exercises';
import { getUiLanguage } from '../lib/ui-translations';
import { clearSearchIndexes } from '../lib/question-search-loader';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { replaceKnowledgeNetwork } from '../lib/data';
import { clearStudyCache } from '../lib/study-content';
import { membershipFailure } from '../lib/membership-state';

const Context = createContext({ active: false, revision: 0, loading: true });
export const useMembership = () => useContext(Context);
export function MembershipProvider({ userId, children }) {
  const [value, setValue] = useState({ active: false, revision: 0, loading: true });
  const retry = useRef(() => {});
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    let alive = true, busy = false, signature = null;
    replaceKnowledgeNetwork({}); clearStudyCache(); clearExerciseCache(); clearSearchIndexes(); setValue({ active: false, revision: 0, loading: true });
    async function refresh() {
      if (!userId || busy) return;
      busy = true; setChecking(true);
      try {
        const { membership } = await api('membership');
        const next = JSON.stringify(membership);
        if (next !== signature) {
          const network = {};
          if (!alive) return;
          replaceKnowledgeNetwork(network); clearStudyCache(); clearExerciseCache(); clearSearchIndexes(); signature = next;
          setValue({ ...membership, userId, revision: Date.now(), loading: false, error: false });
        }
        else if (alive) setValue(v => ({...v, loading: false, error: false}));
      } catch (error) {
        if (alive) {
          if ([401,403].includes(error.status)) {
            replaceKnowledgeNetwork({}); clearStudyCache(); clearExerciseCache(); clearSearchIndexes(); signature = null;
          }
          setValue(v => membershipFailure(v, error.status, userId));
        }
      } finally { busy = false; if (alive) setChecking(false); }
    }
    retry.current = refresh;
    void refresh(); const timer = setInterval(refresh, 15000); window.addEventListener('focus', refresh);
    return () => { alive = false; clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [userId]);
  const en = getUiLanguage() === 'eng';
  const unresolved = !value.status || value.userId !== userId;
  return <Context.Provider value={value}>
    {value.error && <div className="membership-sync-notice" role="alert"><span>{en ? 'Could not refresh membership. Please check your connection and retry.' : '会员状态暂时无法更新，请检查网络后重试。'}</span><button disabled={checking} onClick={() => retry.current()}>{en ? (checking?'Retrying…':'Retry') : (checking?'正在重试…':'重试')}</button></div>}
    {unresolved ? (!value.error && <p className="account-loading" role="status">{en?'Loading membership status…':'正在加载会员状态…'}</p>) : children}
  </Context.Provider>;
}
export function MembershipStatus() {
  const membership = useMembership();
  const en = getUiLanguage() === 'eng';
  const labels = en ? {revoked:'Membership paused',expired:'Membership expired',none:'Not subscribed'} : {revoked:'会员已暂停',expired:'会员已到期',none:'未开通会员'};
  return <span className="membership-status">{membership.active ? `会员至 ${new Date(membership.endsAt).toLocaleDateString(en ? 'en-HK' : 'zh-HK')}` : labels[membership.status]}</span>;
}
export function MemberNotice({ children }) {
  return <div className="member-notice">{children || '会员专享 · 知识点关联'}</div>;
}
