import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parsePassages,
  passageOf,
  directionTerms,
  minutesLeft,
  upcomingPassages,
  routeOf,
} from '../src/departures.js';
import { NOW, BUS_PASSAGES, METRO_PASSAGES, busPassage } from './helpers/fixtures.js';

test('a bus record: real time, its delay on the timetable', () => {
  const passage = passageOf(
    busPassage({
      depart: '2026-10-27T08:19:03+00:00',
      departtheorique: '2026-10-27T08:18:00+00:00',
    }),
    'bus',
  );
  assert.deepEqual(passage, {
    stopId: '1242',
    lineId: '0001',
    line: 'C1',
    mode: 'bus',
    direction: 0,
    destination: 'Chantepie',
    at: Date.parse('2026-10-27T08:19:03Z'),
    scheduled: Date.parse('2026-10-27T08:18:00Z'),
    delay: 1,
    reliable: true,
  });
  // Early: no delay. Not located: the timetable, no delay.
  assert.equal(passageOf(busPassage({ depart: '2026-10-27T08:16:00+00:00' }), 'bus').delay, 0);
  const timetable = passageOf(busPassage({ precision: 'Applicable' }), 'bus');
  assert.deepEqual([timetable.reliable, timetable.delay], [false, null]);
});

test('a metro record counts as real time, whatever its precision', () => {
  const [record] = METRO_PASSAGES;
  const passage = passageOf({ ...record, precision: ['Applicable'] }, 'metro');
  assert.deepEqual([passage.reliable, passage.delay, passage.mode], [true, null, 'metro']);
});

test('the passages of a stop: bus and metro merged, soonest first', () => {
  const passages = parsePassages(
    { bus: BUS_PASSAGES, metro: METRO_PASSAGES },
    { stopName: 'République' },
  );
  assert.equal(passages.length, BUS_PASSAGES.length + METRO_PASSAGES.length);
  assert.ok(passages.every((p, i) => i === 0 || passages[i - 1].at <= p.at));
  assert.deepEqual([...new Set(passages.map((p) => p.mode))].sort(), ['bus', 'metro']);
});

test('filters: the line, the words of the direction, the arrivals at the stop itself', () => {
  const c1 = parsePassages(
    { bus: BUS_PASSAGES },
    { stopName: 'République', lineId: '0001', direction: 'chantepie | nowhere' },
  );
  assert.equal(c1.length, 4);
  assert.ok(c1.every((p) => p.line === 'C1' && p.destination === 'Chantepie'));
  assert.deepEqual(directionTerms(' Saint-Grégoire | | Gaîté '), ['saint gregoire', 'gaite']);
  const ending = parsePassages(
    { bus: [busPassage({ destination: 'République' }), busPassage()] },
    { stopName: 'republique' },
  );
  assert.deepEqual(
    ending.map((p) => p.destination),
    ['Chantepie'],
  );
  assert.deepEqual(parsePassages({ bus: [busPassage({ depart: null })] }), []);
  assert.deepEqual(parsePassages(undefined), []);
});

test('waits, passages to come and routes', () => {
  const [first] = parsePassages({ bus: [busPassage()] });
  assert.equal(minutesLeft(first, NOW), 5);
  assert.equal(minutesLeft(first, NOW + 10 * 60000), 0);
  assert.equal(upcomingPassages([first], NOW + 6 * 60000).length, 0);
  assert.equal(routeOf(first), '0001|0|chantepie');
});
