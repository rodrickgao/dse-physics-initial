import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const site=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const chineseExampleFigures=JSON.parse(fs.readFileSync(path.join(site,'scripts/chinese-example-figures.json'),'utf8'));
export function localizeChineseExampleFigures(html=''){
 return html.replace(/src="([^"]+)"/g,(original,src)=>{
  const figure=chineseExampleFigures[src];
  if(!figure)return original;
  if(createHash('sha256').update(fs.readFileSync(path.join(site,src))).digest('hex')!==figure.originalSha256)throw Error('Source artwork changed: '+src);
  if(!fs.existsSync(path.join(site,figure.src)))throw Error('Missing Chinese artwork: '+figure.src);
  return `src="${figure.src}"`;
 });
}
