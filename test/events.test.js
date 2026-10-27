// Scene triggers fire once per transition, with flat payloads within the
// limits of the core; scene actions return their declared outputs only.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  detectReminders,
  detectLineChanges,
  detectEquipmentChanges,
  reminderData,
  lineEvent,
  equipmentEvent,
  nextDeparturesOutputs,
  lineTrafficOutputs,
  pick,
  tolerance,
  TRIGGERS,
  REMINDER_MINUTES,
  NEXT_DEPARTURES_OUTPUTS,
  LINE_TRAFFIC_OUTPUTS,
} from '../src/events.js';
import { parsePassages } from '../src/departures.js';
import { parseTraffic, lineTraffic } from '../src/traffic.js';
import { LANGUAGES } from '../src/i18n.js';
import {
  NOW,
  TZ,
  ALERTS,
  LINE_STATES,
  EQUIPMENT,
  BUS_PASSAGES,
  busPassage,
} from './helpers/fixtures.js';

const manifest = JSON.parse(
  readFileSync(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const FOLLOWED = {
  name: 'République (C1 → Chantepie)',
  deviceId: 'ext:star-rennes:stop:n-republique_0001_chantepie',
  stop: { name: 'République' },
};
const C1 = { id: '0001', name: 'C1', deviceId: 'ext:star-rennes:line:0001' };
const A = { id: '1001', name: 'a', deviceId: 'ext:star-rennes:line:1001' };
const MINUTE = 60 * 1000;

/**
 * @description Assert that event data is flat and within the limits of the core.
 * @param {object} data - The data.
 * @param {string} key - The trigger key.
 */
function assertPayload(data, key) {
  const trigger = manifest.scene_triggers.find((entry) => entry.key === key);
  assert.ok(trigger, key);
  assert.ok(Object.keys(data).length <= 30);
  for (const [name, value] of Object.entries(data)) {
    assert.ok(
      value === null || ['string', 'number', 'boolean'].includes(typeof value),
      `${key}.${name}`,
    );
    if (typeof value === 'string') {
      assert.ok(value.length <= 1000, `${key}.${name}`);
    }
  }
  // Every variable is in the data, and every field filters a key of it.
  for (const variable of trigger.variables) {
    assert.ok(variable.key in data, `${key}: variable ${variable.key}`);
  }
  for (const field of trigger.fields) {
    assert.ok(field.key in data, `${key}: field ${field.key}`);
  }
}

test('reminders: once per passage and mark, never on the first reading', () => {
  const passages = parsePassages({
    bus: [busPassage({ depart: '2026-10-27T08:17:40+00:00' })],
  });
  // First reading of the stop: a baseline.
  const first = detectReminders({ passages, fired: undefined, now: NOW });
  assert.deepEqual(first.due, []);
  assert.equal(first.fired.length, 1);
  // 4 min 40 s before: the 5-minute mark, once.
  const memory = detectReminders({ passages, fired: [], now: NOW });
  assert.deepEqual(
    memory.due.map((entry) => entry.mark),
    [5],
  );
  const again = detectReminders({ passages, fired: memory.fired, now: NOW + 10000 });
  assert.deepEqual(again.due, []);
  // The same bus a minute later (real time): no new 5-minute reminder.
  const later = parsePassages({ bus: [busPassage({ depart: '2026-10-27T08:18:40+00:00' })] });
  assert.deepEqual(
    detectReminders({ passages: later, fired: memory.fired, now: NOW + MINUTE }).due,
    [],
  );
  // The marks never overlap.
  for (let i = 1; i < REMINDER_MINUTES.length; i += 1) {
    assert.ok(REMINDER_MINUTES[i] - tolerance(REMINDER_MINUTES[i]) >= REMINDER_MINUTES[i - 1]);
  }
});

test('departure_soon payload, in every language', () => {
  const [passage] = parsePassages(
    { bus: BUS_PASSAGES },
    { stopName: 'République', lineId: '0001', direction: 'Chantepie' },
  );
  for (const language of LANGUAGES) {
    const data = reminderData(FOLLOWED, passage, 5, { language, timeZone: TZ });
    assertPayload(data, TRIGGERS.DEPARTURE_SOON);
    assert.equal(data.minutes, '5');
    assert.equal(data.stop, FOLLOWED.deviceId);
    assert.equal(data.time, '09:19');
    assert.equal(data.delay_minutes, 1);
  }
  const fr = reminderData(FOLLOWED, passage, 5, { language: 'fr', timeZone: TZ });
  assert.equal(fr.summary, 'C1 vers Chantepie passe à République dans 5 min (09:19).');
  const [timetable] = parsePassages({ bus: [busPassage({ precision: 'Applicable' })] });
  assert.match(
    reminderData(FOLLOWED, timetable, 5, { language: 'en', timeZone: TZ }).summary,
    /timetable/,
  );
});

test('lines: baseline, disrupted, worse, restored, new alerts', () => {
  const traffic = parseTraffic({ alerts: ALERTS, lineStates: LINE_STATES });
  // First reading: a baseline, nothing fires.
  const first = detectLineChanges({ lines: [C1, A], traffic, now: NOW });
  assert.deepEqual(first.changes, []);
  assert.equal(first.seen['0001'].state, 'major');
  // Metro a goes down: disrupted (from minor).
  const down = parseTraffic({
    alerts: ALERTS,
    lineStates: [{ ...LINE_STATES[0], etat: 'En panne' }, LINE_STATES[1]],
  });
  const stopped = detectLineChanges({ lines: [C1, A], traffic: down, seen: first.seen, now: NOW });
  assert.deepEqual(
    stopped.changes.map((change) => [change.key, change.line.name, change.traffic.state]),
    [[TRIGGERS.LINE_DISRUPTED, 'a', 'stopped']],
  );
  // Back to running: restored to minor.
  const back = detectLineChanges({ lines: [A], traffic, seen: stopped.seen, now: NOW });
  assert.deepEqual(
    back.changes.map((change) => [change.key, change.traffic.state]),
    [[TRIGGERS.LINE_RESTORED, 'minor']],
  );
  // A new alert on C1: one traffic message.
  const extra = {
    ...ALERTS.find((alert) => alert.nomcourtligne === 'C1'),
    idperturbation: '00000000-0000-0000-0000-0000000000010001',
    titre: 'Manifestation',
    niveau: ['Mineure'],
  };
  const news = detectLineChanges({
    lines: [C1],
    traffic: parseTraffic({ alerts: [...ALERTS, extra], lineStates: LINE_STATES }),
    seen: first.seen,
    now: NOW,
  });
  assert.deepEqual(
    news.changes.map((change) => [change.key, change.message.title, change.message.state]),
    [[TRIGGERS.TRAFFIC_MESSAGE, 'Manifestation', 'minor']],
  );
});

test('line event payloads, in every language', () => {
  const traffic = parseTraffic({ alerts: ALERTS, lineStates: LINE_STATES });
  const c1 = lineTraffic(traffic, '0001', NOW);
  for (const language of LANGUAGES) {
    const disrupted = lineEvent(
      { key: TRIGGERS.LINE_DISRUPTED, line: C1, traffic: c1, message: c1.messages[0] },
      { language },
    );
    assertPayload(disrupted.data, TRIGGERS.LINE_DISRUPTED);
    assert.equal(disrupted.data.severity, 'major');
    const restored = lineEvent(
      { key: TRIGGERS.LINE_RESTORED, line: C1, traffic: { state: 'normal', messages: [] } },
      { language },
    );
    assertPayload(restored.data, TRIGGERS.LINE_RESTORED);
    const message = lineEvent(
      { key: TRIGGERS.TRAFFIC_MESSAGE, line: C1, traffic: c1, message: c1.messages[0] },
      { language },
    );
    assertPayload(message.data, TRIGGERS.TRAFFIC_MESSAGE);
    assert.equal(message.data.kind, 'major');
  }
  const fr = lineEvent(
    { key: TRIGGERS.LINE_DISRUPTED, line: C1, traffic: c1, message: c1.messages[0] },
    { language: 'fr' },
  );
  assert.equal(fr.data.summary, 'Ligne STAR C1 : Perturbation majeure (Travaux).');
});

test('equipment: a baseline, then out of service and back in service', () => {
  const traffic = parseTraffic({ equipment: EQUIPMENT });
  const first = detectEquipmentChanges({ equipment: traffic.equipment, seen: null });
  assert.deepEqual(first.changes, []);
  assert.equal(Object.keys(first.seen.down).length, 9);
  const [repaired, ...others] = traffic.equipment;
  const extra = { ...repaired, id: 'ASC_REP_9', station: 'République', stationId: '15006' };
  const next = detectEquipmentChanges({ equipment: [...others, extra], seen: first.seen });
  assert.deepEqual(
    next.changes.map((change) => [change.key, change.equipment.id]),
    [
      [TRIGGERS.EQUIPMENT_DOWN, 'ASC_REP_9'],
      [TRIGGERS.EQUIPMENT_BACK, repaired.id],
    ],
  );
  for (const language of LANGUAGES) {
    for (const change of next.changes) {
      const event = equipmentEvent(change, { language, lineName: () => 'a' });
      assertPayload(event.data, change.key);
    }
  }
  const fr = equipmentEvent(next.changes[0], { language: 'fr', lineName: () => 'a' });
  assert.deepEqual([fr.data.station, fr.data.kind, fr.data.line_name], ['15006', 'elevator', 'a']);
  assert.equal(
    fr.data.summary,
    'Ascenseur hors service à la station de métro République : Quai vers Kennedy <-> Salle des billets.',
  );
});

test('the equipment trigger offers every station the portal names', () => {
  const trigger = manifest.scene_triggers.find((entry) => entry.key === TRIGGERS.EQUIPMENT_DOWN);
  const stations = trigger.fields.find((field) => field.key === 'station').options;
  const values = stations.map((option) => option.value);
  for (const item of parseTraffic({ equipment: EQUIPMENT }).equipment) {
    assert.ok(values.includes(item.stationId), item.station);
  }
  const kinds = trigger.fields.find((field) => field.key === 'kind').options.map((o) => o.value);
  assert.deepEqual(kinds, ['elevator', 'escalator', 'parking_elevator']);
});

test('scene action outputs: declared keys only, a summary in every language', () => {
  const passages = parsePassages(
    { bus: BUS_PASSAGES },
    { stopName: 'République', lineId: '0001', direction: 'Chantepie' },
  );
  const declared = (key) =>
    manifest.scene_actions.find((action) => action.key === key).outputs.map((o) => o.key);
  assert.deepEqual(NEXT_DEPARTURES_OUTPUTS, declared('get_next_departures'));
  assert.deepEqual(LINE_TRAFFIC_OUTPUTS, declared('get_line_traffic'));
  for (const language of LANGUAGES) {
    const outputs = pick(
      nextDeparturesOutputs({ followed: FOLLOWED, passages, now: NOW, language, timeZone: TZ }),
      NEXT_DEPARTURES_OUTPUTS,
    );
    assert.deepEqual(Object.keys(outputs), NEXT_DEPARTURES_OUTPUTS);
    assert.deepEqual(
      [
        outputs.found,
        outputs.minutes,
        outputs.time,
        outputs.delay_minutes,
        outputs.following_minutes,
      ],
      [true, 6, '09:19', 1, 12],
    );
  }
  const fr = nextDeparturesOutputs({
    followed: FOLLOWED,
    passages,
    now: NOW,
    language: 'fr',
    timeZone: TZ,
  });
  assert.equal(
    fr.summary,
    'Prochain passage à République : C1 vers Chantepie dans 6 min. Il a 1 min de retard. Le suivant dans 12 min.',
  );
  const none = nextDeparturesOutputs({
    followed: FOLLOWED,
    passages: [],
    now: NOW,
    language: 'en',
  });
  assert.deepEqual([none.found, none.minutes, none.time], [false, -1, '']);
  const traffic = lineTraffic(parseTraffic({ alerts: ALERTS }), '0011', NOW);
  const line = lineTrafficOutputs({ line: { name: '11' }, traffic, language: 'fr' });
  assert.deepEqual(
    [line.state, line.disrupted, line.disruption_count, line.title],
    ['blocking', true, 2, 'Arrêt TNB'],
  );
});
