import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('2012-2014 reviewed batches retain complete bilingual editions', () => {
  for (const [year, paper, count] of [2012,2013,2014].flatMap(y => [[y,'paper-1a',y===2014 ? 33 : 36],[y,'paper-1b',y===2014 ? 10 : 11],[y,'paper-2',36]])) {
    const editions = ['eng','chn'].map(lang => JSON.parse(fs.readFileSync(`text-papers/${year}-${lang}.json`, 'utf8')));
    const ids = paper==='paper-2' ? [1,2,3,4].flatMap(s => [1,2,3,4,5,6,7,8,'S'].map(q => `${s}.${q}`)) : Array.from({length:count},(_,i) => String(i+1));
    for (const n of ids) {
      const key = `${year}|${paper}|${n}`;
      for (const edition of editions) {
        const record = edition[key];
        assert.equal(record.status, 'curated_verified', key);
        assert.equal(record.reasoningStatus, 'detailed', key);
        assert.ok(record.question && record.official && record.reasoning, key);
        assert.equal(record.officialFormat, 'text', key);
      }
      if (paper === 'paper-1a' || (paper==='paper-2' && !n.endsWith('.S'))) {
        const answer = html => html.replace(/<[^>]*>/g,'').trim().match(/(Deleted|[ABCD])$/)?.[1];
        assert.ok(answer(editions[0][key].official), key);
        assert.equal(answer(editions[0][key].official), answer(editions[1][key].official), key);
      }
    }
  }
});
