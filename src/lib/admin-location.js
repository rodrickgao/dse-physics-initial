export function readAdminLocation(hash = '') {
  const [tab, search] = hash.replace(/^#/, '').split('?');
  const params = new URLSearchParams(search);
  const number = key => Math.max(1, Math.min(100000, Math.floor(Number(params.get(key))) || 1));
  return {
    tab: ['overview','users','questions','visits','tutoring','payments','activity','audit'].includes(tab) ? tab : 'overview',
    query: params.get('query') || '',
    filter: ['none','active','expired','revoked','expiring'].includes(params.get('filter')) ? params.get('filter') : 'all',
    selectedId: params.has('student') ? number('student') : null,
    page: number('page'), actionFilter: params.get('action') || '',
    tutoringFilter: ['answered','all'].includes(params.get('tutoring')) ? params.get('tutoring') : 'pending',
    learningTab: ['mastered','trash','deleted'].includes(params.get('learning')) ? params.get('learning') : 'active',
  };
}
export function adminHash(state) {
  const params = new URLSearchParams();
  for (const [key, value, fallback] of [
    ['query',state.query,''],['filter',state.filter,'all'],['student',state.selectedId,null],
    ['page',state.page,1],['action',state.actionFilter,''],['tutoring',state.tutoringFilter,'pending'],['learning',state.learningTab,'active']
  ]) if (value != null && value !== fallback) params.set(key, String(value));
  return `#${state.tab}${params.size ? '?' + params : ''}`;
}
