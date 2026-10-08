import { entriesByLanguage } from './data';
export function clearSearchIndexes() {}
export async function searchQuestions(language, query, {source='all',offset=0,limit=30}={}) {
 const response=await fetch(`/api/content/search?${new URLSearchParams({language,q:query,source,offset,limit})}`,{cache:'no-store'});
 if(!response.ok)throw new Error('Search unavailable');
 const data=await response.json();
 data.results=data.results.map(row=>({...entriesByLanguage[language].find(e=>e.key===row.key),...row}));
 return data;
}
