import test from 'node:test';
import assert from 'node:assert/strict';
import {protectStudyFiles} from '../server/premium.mjs';
test('retired bulk file guard fails closed for guests and members',()=>{
 for(const active of [true,false])for(const url of ['/text-papers/2025-chn.json','/assets/textbook-exercises/chn/101.json','/assets/textbook-examples/eng/101.json']){
 let status;assert.equal(protectStudyFiles({url},{writeHead:s=>status=s,end:()=>{}},active),true);assert.equal(status,404);
 }
});
