import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import fs from 'node:fs';import path from 'node:path';
import {fixture} from './deep-test-fixture.mjs';
const f=await fixture('chinese-2025-render'),client=f.client();
try {
 await f.register(client,'chinese-2025-render@local.test');
 const result=await promisify(execFile)(process.execPath,['scripts/build-official-screenshots.mjs'],{cwd:process.cwd(),env:{...process.env,QA_URL:f.base,DSE_SCREENSHOT_SESSION:client.jar.get('dse_session'),DSE_SCREENSHOT_YEAR:'2025',DSE_SCREENSHOT_LANGUAGE:'chn'}});
 console.log(result.stdout);if(result.stderr)console.error(result.stderr);
}finally{await f.close();const root=path.resolve(process.env.TEMP||process.env.TMP),target=path.resolve(f.directory);if(!target.startsWith(root+path.sep)||!path.basename(target).startsWith('ddphysics-deep-chinese-2025-render-'))throw Error('Unexpected render directory');fs.rmSync(target,{recursive:true});}
