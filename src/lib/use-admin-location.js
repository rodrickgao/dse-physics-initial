import { useEffect, useState } from 'react';
import { readAdminLocation, adminHash } from './admin-location';
export function useAdminLocation() {
  const [route, setRoute] = useState(() => readAdminLocation(location.hash));
  useEffect(() => {
    const read = () => setRoute(readAdminLocation(location.hash));
    window.addEventListener('popstate', read); window.addEventListener('hashchange', read);
    return () => { window.removeEventListener('popstate', read); window.removeEventListener('hashchange', read); };
  }, []);
  function update(patch, replace = false) {
    const next = {...readAdminLocation(location.hash), ...patch};
    const hash = adminHash(next);
    if (location.hash !== hash) history[replace ? 'replaceState' : 'pushState']({}, '', hash);
    setRoute(next);
  }
  return [route, update];
}
