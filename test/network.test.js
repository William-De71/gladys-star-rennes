import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  fold,
  slug,
  lineOf,
  stopOf,
  findLine,
  findStop,
  searchStops,
  createNetwork,
  MODES,
} from '../src/network.js';
import { createStarClient } from '../src/star-api.js';
import { createStore } from '../src/store.js';
import {
  fakeStar,
  storePath,
  silent,
  NOW,
  BUS_STOPS,
  METRO_STOPS,
  BUS_LINES,
  METRO_LINES,
} from './helpers/fixtures.js';

const LINES = [
  ...METRO_LINES.map((raw) => lineOf(raw, MODES.METRO)),
  ...BUS_LINES.map((raw) => lineOf(raw, MODES.BUS)),
];
const STOPS = [
  ...BUS_STOPS.map((raw) => stopOf(raw, MODES.BUS)),
  ...METRO_STOPS.map((raw) => stopOf(raw, MODES.METRO)),
];

test('fold and slug ignore case, accents and punctuation', () => {
  assert.equal(fold('Saint-Jacques - Gaîté'), 'saint jacques gaite');
  assert.equal(slug('Joliot-Curie - Chateaubriand', 12), 'joliot-curie');
  assert.equal(fold(null), '');
});

test('lines: by public name, the metro by its letter, by id', () => {
  assert.equal(findLine(LINES, 'c1').id, '0001');
  assert.equal(findLine(LINES, 'ligne C4').id, '0004');
  assert.equal(findLine(LINES, 'A').id, '1001');
  assert.equal(findLine(LINES, 'métro b').id, '1002');
  assert.equal(findLine(LINES, '0011').name, '11');
  assert.equal(findLine(LINES, 'C9'), null);
  assert.equal(findLine(LINES, ''), null);
  const [a] = LINES;
  assert.deepEqual(a, {
    id: '1001',
    name: 'a',
    label: 'Rennes (J.F. Kennedy) <> Rennes (La Poterie)',
    mode: 'metro',
    family: 'Métro',
    color: '#ee1d23',
  });
});

test('stops: a name covers every bus stop and metro platform of that name', () => {
  const republique = findStop(STOPS, 'republique');
  assert.equal(republique.kind, 'place');
  assert.equal(republique.name, 'République');
  assert.equal(republique.busIds.length, 13);
  assert.deepEqual(republique.metroIds, ['5006', '5021']);
  // An id: one side of the street only.
  assert.deepEqual(findStop(STOPS, '1242'), {
    kind: 'stop',
    id: '1242',
    name: 'République',
    busIds: ['1242'],
    metroIds: [],
  });
  // A metro station only (a terminus: one platform).
  const kennedy = findStop(STOPS, 'J.F. Kennedy');
  assert.deepEqual([kennedy.busIds, kennedy.metroIds], [[], ['5001']]);
  // Words of a unique name.
  assert.equal(findStop(STOPS, 'henri').name, 'Henri Fréville');
  // Words of several names: unknown, the user narrows it.
  assert.equal(findStop(STOPS, 'champ'), null);
  assert.equal(findStop(STOPS, 'Nulle part'), null);
});

test('search: names holding the words, exact first, bus stops before platforms', () => {
  const found = searchStops(STOPS, 'gares');
  assert.equal(found[0].name, 'Gares');
  assert.deepEqual([...new Set(found[0].stops.map((stop) => stop.mode))], [MODES.BUS, MODES.METRO]);
  assert.deepEqual(searchStops(STOPS, '  '), []);
});

test('the network is read once, kept in /data, and read again when stale', async () => {
  const fetch = fakeStar();
  const path = storePath();
  const store = createStore({ path });
  await store.load();
  let clock = NOW;
  const network = createNetwork({
    api: createStarClient({ fetch }),
    store,
    now: () => clock,
    isNewDay: () => false,
    logger: silent,
  });
  assert.equal((await network.resolveLine('C1')).id, '0001');
  assert.equal((await network.resolveStop('Gares')).name, 'Gares');
  const first = fetch.calls.length;
  assert.equal(first, 4);
  await network.resolveLine('a');
  assert.equal(fetch.calls.length, first);
  assert.equal(network.peekLine('1002').name, 'b');
  // A restart reads nothing.
  const again = createStore({ path });
  await again.load();
  assert.equal(again.data.network.lines.length, LINES.length);
  // A day later the lines are read again; a failure keeps the known ones.
  clock += 25 * 3600 * 1000;
  fetch.state.fail = 503;
  assert.equal((await network.resolveLine('C1')).id, '0001');
  assert.equal(fetch.calls.length, first + 2);
});
