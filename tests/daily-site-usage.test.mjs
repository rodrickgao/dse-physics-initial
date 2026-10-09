import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createAdminInsights} from '../server/admin-insights.mjs';

test('daily usage sums users and short visits, splits Hong Kong midnight, and ignores duplicate or stale reports',()=>{
 const db=new DatabaseSync(':memory:');
 db.exec("CREATE TABLE users(id INTEGER PRIMARY KEY,role TEXT); INSERT INTO users VALUES(1,'student'),(2,'student');");
 let now=Date.parse('2026-10-09T15:59:50Z');
 const clock=()=>now,fail=(status,message)=>{throw new Error(message);};
 let insights=createAdminInsights({db,clock,fail});
 const a={visitId:'usage-visit-0000001',target:'home',durationMs:0};
 const b={visitId:'usage-visit-0000002',target:'papers',durationMs:0};
 const user=id=>({id,role:'student'});
 try {
  insights.track(user(1),a);insights.track(user(2),b);
  now+=20000;
  insights.track(user(1),{...a,durationMs:20000});
  insights.track(user(2),{...b,durationMs:10000});
  insights.track(user(1),{...a,durationMs:20000});
  insights.track(user(1),{...a,durationMs:10000});
  assert.deepEqual(insights.dailyUsage().dailyUsage.map(r=>({...r})),[{day:'2026-10-09',durationMs:10000},{day:'2026-10-10',durationMs:20000}]);
  const since=insights.dailyUsage().usageSince;
  now+=600000;insights.track(user(1),{...a,durationMs:20000});
  assert.equal(insights.dailyUsage().dailyUsage.reduce((n,r)=>n+r.durationMs,0),30000,'hidden time adds nothing');
  insights=createAdminInsights({db,clock,fail});
  assert.equal(insights.dailyUsage().usageSince,since,'restart preserves collection start');
  assert.equal(insights.dailyUsage().dailyUsage.reduce((n,r)=>n+r.durationMs,0),30000);
 } finally {db.close();}
});
