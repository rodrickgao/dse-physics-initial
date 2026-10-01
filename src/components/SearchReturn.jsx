import { useMembership } from './Membership';
import { readSearchSession } from '../lib/search-session';
export function SearchReturn({language,questionKey}) {
  const {userId}=useMembership();
  const saved=readSearchSession(userId);
  if(!saved || saved.key!==questionKey || !saved.hash?.startsWith('#bank?'))return null;
  return <a className="search-return" href={saved.hash}>{language==='eng'?'← Back to search results':'← 返回搜索结果'}</a>;
}
