import {MEMBERSHIP_ENABLED} from '../src/lib/access-policy.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readDraft, writeDraft, clearDraft } from '../src/lib/draft-store.js';
import { readAdminLocation, adminHash } from '../src/lib/admin-location.js';
import { activityContent } from '../server/management.mjs';
import { questions } from '../server/catalog.mjs';
import { studentLearning } from '../server/student-learning.mjs';

test('drafts survive a module remount, remain isolated by account and question, and clear after send', async () => {
  const values = new Map();
  globalThis.sessionStorage = {getItem:k=>values.get(k) ?? null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
  writeDraft('student:1:question:a','first question');
  writeDraft('student:1:question:b','second question');
  writeDraft('student:2:question:a','another account');
  const reloaded = await import('../src/lib/draft-store.js?reload');
  assert.equal(reloaded.readDraft('student:1:question:a'),'first question');
  clearDraft('student:1:question:a');
  assert.equal(readDraft('student:1:question:a'),'');
  assert.equal(readDraft('student:1:question:b'),'second question');
  assert.equal(readDraft('student:2:question:a'),'another account');
  globalThis.sessionStorage = {getItem:()=>{throw Error();},setItem:()=>{throw Error();},removeItem:()=>{throw Error();}};
  writeDraft('unavailable','kept in memory'); assert.equal(readDraft('unavailable'),'kept in memory');
  clearDraft('unavailable'); assert.equal(readDraft('unavailable'),'');
  delete globalThis.sessionStorage;
});

test('admin URLs round trip filters, student detail, pagination and learning tabs', () => {
  const state={...readAdminLocation(),tab:'users',query:'高 + a@b.test',filter:MEMBERSHIP_ENABLED?'expired':'all',selectedId:3,page:2,actionFilter:'knowledge_view',learningTab:'mastered',tutoringFilter:'all'};
  assert.deepEqual(readAdminLocation(adminHash(state)),state);
  const previous=adminHash(state), next=adminHash({...state,tab:'tutoring',selectedId:null});
  assert.equal(readAdminLocation(previous).selectedId,3);
  assert.equal(readAdminLocation(next).tab,'tutoring');
  assert.equal(readAdminLocation('#unknown?page=-9&filter=bad').page,1);
  assert.equal(readAdminLocation('#unknown').tab,'overview');
  assert.equal(readAdminLocation('#payments').tab,MEMBERSHIP_ENABLED?'payments':'overview');
  assert.equal(readAdminLocation('#audit?filter=expired').filter,MEMBERSHIP_ENABLED?'expired':'all');
});


test('activity links identify actual knowledge and bilingual exercises without linking search text', () => {
  const knowledge=activityContent({action:'knowledge_view',target:'17'});
  assert.match(knowledge.label,/1\.3\.5/); assert.match(knowledge.labelEn,/Energy balance/);
  assert.equal(knowledge.href,'/#textbook?knowledge=17');
  assert.equal(activityContent({action:'knowledge_view',target:'99999'}),null);
  assert.equal(activityContent({action:'search',target:'17'}),null);
  const exercise=activityContent({action:'question_view',target:'tb-103-1'});
  assert.match(exercise.labelEn,/Compulsory Book 1.*Temperature Changes and Heat Capacity.*Q1/);
  assert.equal(exercise.href,'/#exercises?question=tb-103-1');
  const review=studentLearning([{question_key:'2012|paper-1a|1',marked_at:1}],[],[],{new_questions:[{question_id:'tb-103-1',question_title:'Q1',primary_knowledge:{knowledge_id:'17'}}]}).review.questions;
  assert.ok(review.length);
  assert.ok(review.every(q=>q.labelEn===questions.get(q.key).labelEn && !/[\u3400-\u9fff]/.test(q.labelEn)));
});
