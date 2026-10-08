import { useState } from 'react';
import { useMembership } from './Membership';
import { readSaved, writeSaved } from '../lib/study-state';
export function ReaderBookmark({questionKey,language}) {
  const {userId}=useMembership(), en=language==='eng';
  const storage=`dse-bookmarks-${userId}`;
  const [,refresh]=useState(0);
  const items=readSaved(storage,[]), marked=items.includes(questionKey);
  return <button className="reader-bookmark" aria-pressed={marked} onClick={()=>{writeSaved(storage,marked?items.filter(k=>k!==questionKey):[questionKey,...items]);refresh(v=>v+1);}}>{marked?(en?'Bookmarked ✓':'已收藏 ✓'):(en?'Bookmark':'收藏')}</button>;
}
