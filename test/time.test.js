import { test } from 'node:test';
import assert from 'node:assert/strict';

import { formatTime, localClock, serviceDay, newDaySince } from '../src/time.js';

const TZ = 'Europe/Paris';

test('times of day in the timezone of the instance', () => {
  assert.equal(formatTime(Date.parse('2026-10-17T20:19:00Z'), TZ), '22:19');
  assert.equal(formatTime(Date.parse('2026-10-17T20:19:00Z'), 'UTC'), '20:19');
  assert.equal(formatTime(null, TZ), '');
  assert.deepEqual(localClock(Date.parse('2026-10-25T01:30:00Z'), TZ), {
    date: '2026-10-25',
    minutes: 150,
  });
});

test('the service day changes at 04:00, local time', () => {
  assert.equal(serviceDay(Date.parse('2026-10-17T22:30:00Z'), TZ), '2026-10-17');
  assert.equal(serviceDay(Date.parse('2026-10-18T02:10:00Z'), TZ), '2026-10-18');
  const evening = Date.parse('2026-10-17T20:00:00Z');
  assert.equal(newDaySince(evening, Date.parse('2026-10-18T01:00:00Z'), TZ), false);
  assert.equal(newDaySince(evening, Date.parse('2026-10-18T02:05:00Z'), TZ), true);
  assert.equal(newDaySince(0, evening, TZ), true);
});
