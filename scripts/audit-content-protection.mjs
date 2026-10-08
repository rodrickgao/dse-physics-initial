import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';

const root=process.cwd(), dist=resolve(root,'dist');
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(resolve(dir,e.name)):[resolve(dir,e.name)]);
const files=walk(dist), textFiles=files.filter(f=>/\.(?:js|json|html|css|txt)$/i.test(f));
const texts=textFiles.map(f=>({file:relative(root,f),text:readFileSync(f,'utf8')}));
const forbiddenFiles=files.filter(f=>/text-papers|textbook-examples|textbook-exercises|QDNA|knowledge_catalog|\.env|\.sqlite|\.pem$|\.key$|\.map$/i.test(relative(dist,f))).map(f=>relative(root,f));
const internalMarkers=['knowledge_weights','reasoning_steps','sourcesByPoint','calculateKnowledgeWeakness','getRecommendedQuestions','bodyConcepts','metadataPhrase'];
const internalHits=texts.flatMap(({file,text})=>internalMarkers.filter(marker=>text.includes(marker)).map(marker=>({file,marker})));
// Never print matched secret values, snippets, cookies, credentials, or token hashes.
const credentialPatterns=[/\bsk-[A-Za-z0-9_-]{24,}/g,/\bAKIA[A-Z0-9]{16}\b/g,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,/(?:postgres|mysql|mongodb(?:\+srv)?):\/\/[^\s:'"]+:[^\s@'"]+@/g];
const credentialHits=texts.flatMap(({file,text})=>credentialPatterns.flatMap((pattern,rule)=>[...text.matchAll(pattern)].map(m=>({file,line:text.slice(0,m.index).split('\n').length,rule}))));
const privateFiles=['.env','.env.local','.local-membership-preview/admin-key.txt','.local/admin-key.txt'];
const literalHits=[];
for(const name of privateFiles){const file=resolve(root,name);if(!existsSync(file))continue;
 const content=readFileSync(file,'utf8');
 const values=name.endsWith('admin-key.txt')?[{name:'admin-key',value:content.trim()}]:content.split(/\r?\n/).map(line=>{const m=/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line);return m?{name:m[1],value:m[2].replace(/^['"]|['"]$/g,'')}:null;}).filter(v=>v&&/KEY|SECRET|TOKEN|PASS|DATABASE/.test(v.name));
 for(const value of values.filter(v=>v.value.length>=12))for(const row of texts)if(row.text.includes(value.value))literalHits.push({file:row.file,privateSource:name,variable:value.name});
}
const sourceFiles=['server','src'].flatMap(name=>walk(resolve(root,name))).filter(f=>/\.(mjs|js|jsx)$/.test(f));
const aiCallFiles=sourceFiles.filter(f=>/api\.openai\.com|api\.anthropic\.com|chat\.completions|responses\.create/.test(readFileSync(f,'utf8'))).map(f=>relative(root,f));
const result={publicBuildFiles:files.length,forbiddenFiles,internalHits,credentialHits,literalHits,aiCallFiles,passed:![...forbiddenFiles,...internalHits,...credentialHits,...literalHits].length,scope:'Local source and local built output only; no live-production or historical Git scan. Secret values are never included.'};
mkdirSync(resolve(root,'../output/content-protection'),{recursive:true});writeFileSync(resolve(root,'../output/content-protection/build-audit.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=1;
