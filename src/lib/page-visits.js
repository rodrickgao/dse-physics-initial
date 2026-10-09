// One visit per route; hidden tabs are paused, and repeated reports are cumulative.
export function startPageVisits(pageOverride) {
 let visit=null, stopped=false, chain=Promise.resolve();
 const target=()=>{
  if(pageOverride)return pageOverride;
  const [page='home',search='']=location.hash.slice(1).split('?');
  const source=new URLSearchParams(search), params=new URLSearchParams();
  for(const key of ['question','knowledge']) if(source.has(key)) params.set(key,source.get(key));
  return (page||'home')+(params.size?'?'+params:'');
 };
 const accrue=()=>{const now=performance.now();if(visit&&visit.visible) visit.ms+=Math.max(0,Math.min(now-visit.tick,15000));if(visit)visit.tick=now;};
 const send=()=>{
  if(!visit)return;
  const body={visitId:visit.id,target:visit.target,durationMs:Math.floor(visit.ms)};
  chain=chain.catch(()=>{}).then(()=>fetch('/api/page-visits',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})).catch(()=>{});
 };
 const change=()=>{if(visit?.target===target() && visit.ms<86400000)return;accrue();send();visit={id:crypto.randomUUID(),target:target(),ms:0,tick:performance.now(),visible:!document.hidden};send();};
 const visibility=()=>{accrue();send();visit.visible=!document.hidden;};
 const leave=()=>{accrue();send();visit.visible=false;};
 const resume=()=>{visit.tick=performance.now();visit.visible=!document.hidden;};
 change();
 let ticks=0;
 const timer=setInterval(()=>{if(stopped)return;if(visit.target!==target()){change();return;}accrue();if(visit.ms>=86400000)change();else if(++ticks%10===0 && visit.visible)send();},1000);
 window.addEventListener('hashchange',change);document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',leave);window.addEventListener('pageshow',resume);
 return()=>{stopped=true;accrue();send();clearInterval(timer);window.removeEventListener('hashchange',change);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',leave);window.removeEventListener('pageshow',resume);};
}
