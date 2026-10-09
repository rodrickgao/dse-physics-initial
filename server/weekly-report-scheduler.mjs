import { weeklyReportEmail } from './weekly-report-email.mjs';

const DAY=86400000, WEEK=7*DAY, OFFSET=8*3600000;
// Sunday 19:00 in Asia/Hong_Kong (UTC+8), independent of the server timezone.
export function latestWeeklySlot(now) {
 const local=new Date(now+OFFSET);
 const midnight=Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate())-OFFSET;
 const sunday=midnight-local.getUTCDay()*DAY+19*3600000;
 return sunday<=now?sunday:sunday-WEEK;
}
export function nextWeeklySlot(now) {return latestWeeklySlot(now)+WEEK;}

export function createWeeklyReportScheduler({db,clock=Date.now,buildReport,sendMail,from}) {
 db.exec(`CREATE TABLE IF NOT EXISTS weekly_report_schedule(key TEXT PRIMARY KEY,value INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS weekly_report_deliveries (
  user_id INTEGER NOT NULL REFERENCES users(id), week_end INTEGER NOT NULL,
  recipient TEXT NOT NULL, report TEXT NOT NULL, created_at INTEGER NOT NULL,
  sent_at INTEGER, attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,week_end));`);
 if(sendMail&&!from)throw new Error('Weekly report sender is required.');
 db.prepare('INSERT OR IGNORE INTO weekly_report_schedule VALUES(?,?)').run('next_at',nextWeeklySlot(clock()));
 let busy=false,closed=false;
 function status() {
  return {enabled:Boolean(sendMail),timezone:'Asia/Hong_Kong',day:'Sunday',hour:19,
   nextAt:db.prepare('SELECT value FROM weekly_report_schedule WHERE key=?').get('next_at').value,
   pending:db.prepare('SELECT COUNT(*) n FROM weekly_report_deliveries WHERE sent_at IS NULL').get().n};
 }
 async function tick() {
  if(!sendMail||closed||busy)return;
  busy=true;
  try {
   const now=clock(), next=status().nextAt;
   if(now>=next) {
    const end=latestWeeklySlot(now),start=end-WEEK;
    // Persist a fixed report for each student so retries never regenerate it.
    const users=db.prepare("SELECT id,email FROM users WHERE role='student' AND created_at<=?").all(end);
    const reports=users.map(u=>({user:u,report:JSON.stringify(buildReport(u.id,{start,end,language:'chn'}))}));
    db.exec('BEGIN IMMEDIATE');
    try {
     for(const {user,report} of reports)db.prepare('INSERT OR IGNORE INTO weekly_report_deliveries(user_id,week_end,recipient,report,created_at,next_at) VALUES(?,?,?,?,?,?)').run(user.id,end,user.email,report,now,now);
     db.prepare('UPDATE weekly_report_schedule SET value=? WHERE key=?').run(end+WEEK,'next_at');
     db.exec('COMMIT');
    }catch(error){db.exec('ROLLBACK');throw error;}
   }
   const rows=db.prepare('SELECT * FROM weekly_report_deliveries WHERE sent_at IS NULL AND next_at<=? ORDER BY week_end,user_id LIMIT 50').all(clock());
   for(const row of rows) {
    if(closed)break;
    try {
     const message=await weeklyReportEmail({from,to:row.recipient,report:JSON.parse(row.report)});
     message.messageId=`<weekly-${row.user_id}-${row.week_end}@ddphysics.com>`;
     await sendMail(message);
     if(!closed)db.prepare('UPDATE weekly_report_deliveries SET sent_at=?,attempts=attempts+1 WHERE user_id=? AND week_end=?').run(clock(),row.user_id,row.week_end);
    }catch {
     if(!closed)db.prepare('UPDATE weekly_report_deliveries SET attempts=attempts+1,next_at=? WHERE user_id=? AND week_end=?').run(clock()+Math.min(3600000,60000*2**Math.min(row.attempts,6)),row.user_id,row.week_end);
    }
   }
  }catch(error){console.error('Weekly report scheduler failed:',error.name);}
  finally{busy=false;}
 }
 const timer=sendMail?setInterval(()=>{void tick();},30000):null;
 timer?.unref();
 // On restart, resume persisted due deliveries; first activation never sends old weeks.
 if(sendMail)void tick();
 return {tick,status,close(){closed=true;if(timer)clearInterval(timer);}};
}
