import { getUiLanguage } from '../lib/ui-translations';
import { clearSearchIndexes } from '../lib/question-search-loader';
import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { replaceKnowledgeNetwork } from '../lib/data';
import { clearStudyCache } from '../lib/study-content';

const Context = createContext({ active: false, revision: 0 });
export const useMembership = () => useContext(Context);
export function MembershipProvider({ userId, children }) {
  const [value, setValue] = useState({ active: false, revision: 0 });
  useEffect(() => {
    let alive = true, busy = false, signature = null;
    replaceKnowledgeNetwork({}); clearStudyCache(); clearSearchIndexes(); setValue({ active: false, revision: 0 });
    async function refresh() {
      if (!userId || busy) return;
      busy = true;
      try {
        const { membership } = await api('membership');
        const next = JSON.stringify(membership);
        if (next !== signature) {
          const network = membership.active ? (await api('premium/network')).network : {};
          if (!alive) return;
          replaceKnowledgeNetwork(network); clearStudyCache(); clearSearchIndexes(); signature = next;
          setValue({ ...membership, revision: Date.now() });
        }
      } catch {
        if (alive) { replaceKnowledgeNetwork({}); clearStudyCache(); clearSearchIndexes(); signature = null; setValue(v => ({ active: false, revision: v.revision ? 0 : v.revision })); }
      } finally { busy = false; }
    }
    void refresh(); const timer = setInterval(refresh, 15000); window.addEventListener('focus', refresh);
    return () => { alive = false; clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [userId]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function MembershipStatus() {
  const membership = useMembership();
  return <span className="membership-status">{membership.active ? `会员至 ${new Date(membership.endsAt).toLocaleDateString(getUiLanguage() === 'eng' ? 'en-HK' : 'zh-HK')}` : membership.status === 'revoked' ? '会员已暂停' : '普通账号'}</span>;
}
export function MemberNotice({ children }) {
  return <div className="member-notice">{children || '会员专享 · 知识点关联'}</div>;
}
