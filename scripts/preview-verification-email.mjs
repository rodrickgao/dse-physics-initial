import { mkdirSync, writeFileSync } from 'node:fs';
import { verificationEmail } from '../server/verification-email.mjs';

const email = verificationEmail({from:'preview@example.invalid',to:'preview@example.invalid',code:'123456'});
const image = email.attachments[0];
const html = email.html.replace(`cid:${image.cid}`,`data:${image.contentType};base64,${image.content.toString('base64')}`);
const output = new URL('../dist/verification-email-preview.html',import.meta.url);
mkdirSync(new URL('../dist/',import.meta.url),{recursive:true});
writeFileSync(output,html);
console.log('Local email preview (sample code only, no email sent): http://127.0.0.1:5178/verification-email-preview.html');
