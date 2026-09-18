import { test } from 'node:test';
import assert from 'node:assert/strict';
import { settleFocus, focusRemaining, formatFocusTime } from '../src/lib/focus-timer.js';

test('focus ledger excludes pauses and caps completed sessions', () => {
  const session = { id: 'one', minutes: 30, remaining: 1800000, endsAt: 1800000, records: {} };
  const first = settleFocus(session, 60000);
  assert.equal(first.records.one, 60000);
  const paused = { ...first, remaining: focusRemaining(first, 60000), endsAt: null };
  assert.equal(settleFocus(paused, 600000).records.one, 60000);
  const resumed = { ...paused, endsAt: 600000 + paused.remaining };
  assert.equal(settleFocus(resumed, 660000).records.one, 120000);
  const completed = settleFocus(resumed, 10000000);
  assert.equal(completed.records.one, 1800000);
  assert.equal(settleFocus(completed, 20000000).records.one, 1800000);
  const next = { id: 'two', minutes: 60, remaining: 3600000, endsAt: 13600000, records: completed.records };
  assert.deepEqual(settleFocus(next, 10060000).records, { one: 1800000, two: 60000 });
  assert.equal(formatFocusTime(10800000), '180:00');
  assert.equal(formatFocusTime(0), '00:00');
});
