import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
const output=path.resolve('../output/free-site-20261014');
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const manifest=JSON.parse(fs.readFileSync(path.join(output,'backup-manifest.json'),'utf8'));
for(const [name,hash] of Object.entries(manifest))if(digest(fs.readFileSync(path.join(output,'membership-backup',name)))!==hash)throw Error('Backup changed: '+name);
const mode=process.argv[2]||'before';
const db=new DatabaseSync(path.resolve('.local-membership-preview/students.sqlite'),{readOnly:true});
const tableNames=db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name);
const retained=tableNames.filter(name=>!['codes','sessions','limits','content_requests','protected_content','protected_dna','sqlite_sequence','weekly_report_schedule'].includes(name));
const encode=rows=>JSON.stringify(rows,(_key,value)=>value instanceof Uint8Array?{base64:Buffer.from(value).toString('base64')}:value);
db.exec('BEGIN');
try{
 const hashes=Object.fromEntries(retained.map(name=>{const rows=db.prepare(`SELECT * FROM "${name}"`).all();return [name,{rows:rows.length,sha256:digest(encode(rows))}];}));
 if(mode==='before'){
  const history=Object.fromEntries(['memberships','membership_audit','payment_orders','payment_receipts','payment_notifications'].map(name=>[name,db.prepare(`SELECT * FROM "${name}"`).all()]));
  history.accounts=db.prepare('SELECT id,email,nickname FROM users ORDER BY id').all();
  fs.writeFileSync(path.join(output,'membership-history.json'),encode(history));
  fs.writeFileSync(path.join(output,'local-data-before.json'),JSON.stringify(hashes,null,2));
 }else{
  const before=JSON.parse(fs.readFileSync(path.join(output,'local-data-before.json'),'utf8'));
  const changes=retained.filter(name=>before[name]?.sha256!==hashes[name].sha256);
  fs.writeFileSync(path.join(output,'local-data-after.json'),JSON.stringify({tables:hashes,changes},null,2));
  if(changes.length)throw Error('Local data changed: '+changes.join(', '));
 }
 console.log(JSON.stringify({backupFiles:Object.keys(manifest).length,retainedTables:retained.length,mode,passed:true}));
}finally{db.exec('ROLLBACK');db.close();}
