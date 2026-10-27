// The traps of the Gladys core that the fake Gladys does not catch
// (community feedback, thread 11005): a device is only polled with
// should_poll AND poll_frequency, every feature needs min / max / read_only /
// has_feedback, a wrong category / type pair shows no icon nor label, and a
// single invalid field rejects the whole discovery batch.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';

import {
  stopKey,
  followedName,
  idsOf,
  parseExternalId,
  buildStopDevice,
  buildStopStates,
  buildLineDevice,
  buildLineStates,
  lineStatusText,
  DEVICE_TYPES,
} from '../src/device.js';
import { parsePassages } from '../src/departures.js';
import { parseTraffic, lineTraffic } from '../src/traffic.js';
import { LANGUAGES } from '../src/i18n.js';
import {
  fakeGladys,
  NOW,
  TZ,
  BUS_PASSAGES,
  ALERTS,
  LINE_STATES,
  busPassage,
} from './helpers/fixtures.js';

const REPUBLIQUE_C1 = {
  stop: { kind: 'place', id: null, name: 'République', busIds: ['1242'], metroIds: [] },
  line: { id: '0001', name: 'C1', mode: 'bus' },
  direction: 'Chantepie',
};
REPUBLIQUE_C1.key = stopKey(REPUBLIQUE_C1.stop, REPUBLIQUE_C1.line, REPUBLIQUE_C1.direction);
REPUBLIQUE_C1.name = followedName(REPUBLIQUE_C1);
const SIDE = {
  stop: { kind: 'stop', id: '1168', name: 'République', busIds: ['1168'], metroIds: [] },
  line: null,
  direction: '',
};
SIDE.key = stopKey(SIDE.stop, null, '');
SIDE.name = followedName(SIDE);
const C1 = { id: '0001', name: 'C1', label: 'Saint-Grégoire <> Chantepie', mode: 'bus' };
const A = { id: '1001', name: 'a', label: 'J.F. Kennedy <> La Poterie', mode: 'metro' };

const devices = (language) => [
  buildStopDevice(fakeGladys, REPUBLIQUE_C1, language),
  buildStopDevice(fakeGladys, SIDE, language),
  buildLineDevice(fakeGladys, C1, language),
  buildLineDevice(fakeGladys, A, language),
];

// Pairs with an icon and a label in the Gladys front (front/src/utils/consts.js).
const PAIRS = [
  [DEVICE_FEATURE_CATEGORIES.TEXT, DEVICE_FEATURE_TYPES.TEXT.TEXT, undefined],
  [
    DEVICE_FEATURE_CATEGORIES.DURATION,
    DEVICE_FEATURE_TYPES.DURATION.INTEGER,
    DEVICE_FEATURE_UNITS.MINUTES,
  ],
  [DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR, DEVICE_FEATURE_TYPES.SENSOR.INTEGER, undefined],
];

test('devices are never polled by Gladys: the integration has its own timer', () => {
  for (const device of devices('en')) {
    assert.equal(device.should_poll, false, device.external_id);
    assert.equal(device.poll_frequency, undefined);
  }
});

test('every feature carries min, max, read_only and has_feedback, in every language', () => {
  for (const language of LANGUAGES) {
    for (const device of devices(language)) {
      for (const feature of device.features) {
        for (const key of ['min', 'max']) {
          assert.equal(typeof feature[key], 'number', `${feature.external_id}.${key}`);
        }
        assert.ok(feature.min <= feature.max, feature.external_id);
        assert.equal(feature.read_only, true, feature.external_id);
        assert.equal(feature.has_feedback, false, feature.external_id);
        assert.ok(feature.name.length > 0 && feature.name.length <= 255);
      }
      const names = new Set(device.features.map((feature) => feature.name));
      assert.equal(names.size, device.features.length, 'every feature has its own name');
    }
  }
});

test('category / type / unit pairs known to the Gladys front, from the SDK constants', () => {
  for (const feature of devices('en').flatMap((device) => device.features)) {
    assert.ok(
      PAIRS.some(
        ([category, type, unit]) =>
          feature.category === category && feature.type === type && feature.unit === unit,
      ),
      `${feature.external_id}: ${feature.category}/${feature.type}/${feature.unit}`,
    );
  }
});

test('ids from the stop as typed, the line id and the direction; read back', () => {
  const [republique, side, c1, a] = devices('fr');
  assert.equal(republique.external_id, 'ext:star-rennes:stop:n-republique_0001_chantepie');
  assert.equal(republique.name, 'STAR République (C1 → Chantepie)');
  assert.equal(side.external_id, 'ext:star-rennes:stop:i-1168');
  assert.equal(side.name, 'STAR République [1168]');
  assert.equal(c1.external_id, 'ext:star-rennes:line:0001');
  assert.equal(c1.name, 'STAR ligne C1');
  assert.equal(a.name, 'STAR métro a');
  assert.deepEqual(parseExternalId('ext:star-rennes:stop:i-1168:wait'), {
    type: 'stop',
    key: 'i-1168',
  });
  assert.deepEqual(parseExternalId('ext:star-rennes:line:1001'), { type: 'line', key: '1001' });
  assert.equal(parseExternalId('something'), null);
  // Other accents or case: the same device.
  assert.equal(stopKey({ kind: 'place', name: 'RÉPUBLIQUE' }, null, ''), 'n-republique');
  assert.deepEqual(
    republique.params.map((param) => [param.name, param.value]),
    [
      ['STAR_STOP', 'République'],
      ['STAR_LINE', 'C1'],
      ['STAR_DIRECTION', 'Chantepie'],
    ],
  );
});

test('stop states: the next passage, the two waits, the delay', () => {
  const passages = parsePassages(
    { bus: BUS_PASSAGES },
    { stopName: 'République', lineId: '0001', direction: 'Chantepie' },
  );
  const states = buildStopStates(fakeGladys, REPUBLIQUE_C1, passages, {
    language: 'fr',
    now: NOW,
    timeZone: TZ,
  });
  const byKey = Object.fromEntries(
    states.map((s) => [s.device_feature_external_id.split(':').pop(), s.state ?? s.text]),
  );
  assert.deepEqual(byKey, {
    next: 'C1 → Chantepie · 6 min (+1 min de retard)',
    wait: 6,
    following: 12,
    delay: 1,
  });
  // A bus not located: said, and no delay.
  const timetable = parsePassages({ bus: [busPassage({ precision: 'Applicable' })] });
  const [next] = buildStopStates(fakeGladys, SIDE, timetable, { language: 'en', now: NOW });
  assert.equal(next.text, 'C1 → Chantepie · 5 min (timetable)');
  // Nothing announced: the waits and the delay are left untouched.
  const empty = buildStopStates(fakeGladys, SIDE, [], { language: 'es', now: NOW });
  assert.deepEqual(
    empty.map((s) => s.text),
    ['Ningún paso anunciado'],
  );
});

test('line states: the state with the title of the alert, the count', () => {
  const traffic = parseTraffic({ alerts: ALERTS, lineStates: LINE_STATES });
  assert.deepEqual(
    buildLineStates(fakeGladys, C1, lineTraffic(traffic, '0001', NOW), 'fr').map(
      (s) => s.text ?? s.state,
    ),
    ['Perturbation majeure : Travaux', 2],
  );
  // Minor: the state alone, no disruption counted.
  assert.deepEqual(
    buildLineStates(fakeGladys, A, lineTraffic(traffic, '1001', NOW), 'en').map(
      (s) => s.text ?? s.state,
    ),
    ['Minor disruption', 0],
  );
  // The metro down without an alert: still one disruption.
  const down = parseTraffic({ lineStates: [{ ...LINE_STATES[0], etat: 'En panne' }] });
  assert.deepEqual(
    buildLineStates(fakeGladys, A, lineTraffic(down, '1001', NOW), 'de').map(
      (s) => s.text ?? s.state,
    ),
    ['Metro gestört', 1],
  );
  assert.equal(lineStatusText({ state: 'normal', messages: [] }, 'de'), 'Normaler Betrieb');
});

test('the discovery batch and the states pass the checks of the fake host API', async (t) => {
  const gladys = createFakeGladys({});
  t.after(() => gladys.fake.shutdown());
  await gladys.connect();
  for (const language of LANGUAGES) {
    await gladys.publishDiscoveredDevices([
      buildStopDevice(gladys, REPUBLIQUE_C1, language),
      buildLineDevice(gladys, C1, language),
    ]);
  }
  const [stop, line] = gladys.fake.discoveredDevices;
  await gladys.fake.deviceCreated(stop);
  await gladys.fake.deviceCreated(line);
  const passages = parsePassages(
    { bus: BUS_PASSAGES },
    { stopName: 'République', lineId: '0001', direction: 'Chantepie' },
  );
  await gladys.publishStates(
    buildStopStates(gladys, REPUBLIQUE_C1, passages, { language: 'en', now: NOW }),
  );
  const traffic = parseTraffic({ alerts: ALERTS, lineStates: LINE_STATES });
  await gladys.publishStates(buildLineStates(gladys, C1, lineTraffic(traffic, '0001', NOW), 'en'));
  assert.equal(idsOf(gladys, DEVICE_TYPES.STOP, REPUBLIQUE_C1.key).device, stop.external_id);
  assert.equal(gladys.fake.lastState(`${stop.external_id}:wait`), 6);
  assert.equal(gladys.fake.lastState(`${stop.external_id}:delay`), 1);
  assert.equal(gladys.fake.lastState(`${line.external_id}:disruptions`), 2);
});
