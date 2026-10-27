// The whole integration against the fake Gladys of the SDK
// (`@gladysassistant/integration-sdk/testing`), which checks the discovered
// devices, the states and the scene events like the host API does, and a
// fake STAR portal serving real (reduced) answers.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import {
  createApp,
  SCENE_ACTIONS,
  ACTIONS,
  IDLE_INTERVAL_MS,
  DAILY_STOP_BUDGET,
} from '../src/app.js';
import { WIDGETS } from '../src/widgets.js';
import { TRIGGERS } from '../src/events.js';
import {
  fakeStar,
  storePath,
  silent,
  busPassage,
  NOW,
  TZ,
  BUS_STOPS,
  LINE_STATES,
} from './helpers/fixtures.js';

const CONFIG = {
  stop_1: 'République',
  stop_1_line: 'C1',
  stop_1_direction: 'Chantepie',
  stop_2: 'republique',
  stop_3: 'Nulle part',
  lines: 'a, C1, 11, Z9',
  interval: '60',
  language: 'fr',
};
const PREFIX = 'ext:test-integration';
const C1_STOP = `${PREFIX}:stop:n-republique_0001_chantepie`;
const ALL_STOP = `${PREFIX}:stop:n-republique`;
const A = `${PREFIX}:line:1001`;
const C1 = `${PREFIX}:line:0001`;
const L11 = `${PREFIX}:line:0011`;
const MINUTE = 60 * 1000;
const iso = (ms) => new Date(ms).toISOString().replace('.000Z', '+00:00');

/**
 * @description The integration, connected to a fake Gladys and a fake portal.
 * @param {object} [options] - `{ config, path, logger }`.
 * @returns {Promise<object>} `{ gladys, app, api, clock, path }`.
 */
async function startApp({ config = CONFIG, path = storePath(), logger = silent } = {}) {
  const clock = { now: NOW };
  const api = fakeStar({ now: () => clock.now });
  const gladys = createFakeGladys({ config });
  const app = createApp(gladys, {
    fetch: api,
    storePath: path,
    now: () => clock.now,
    timeZone: TZ,
    timers: false,
    logger,
  });
  await gladys.connect();
  await app.whenReady();
  return { gladys, app, api, clock, path };
}

const created = async (gladys, externalId) => {
  const device = gladys.fake.discoveredDevices.find((d) => d.external_id === externalId);
  assert.ok(device, `${externalId} is offered`);
  await gladys.fake.deviceCreated(device);
  return device;
};
const eventsOf = (gladys, key) => gladys.fake.sceneEvents.filter((event) => event.key === key);
const datasets = (api) => api.calls.map((call) => call.dataset);

test('two stops and three lines become five devices; unknown names are reported', async (t) => {
  const { gladys, api } = await startApp();
  t.after(() => gladys.fake.shutdown());
  assert.deepEqual(
    gladys.fake.discoveredDevices.map((device) => [device.external_id, device.name]),
    [
      [C1_STOP, 'STAR République (C1 → Chantepie)'],
      [ALL_STOP, 'STAR République'],
      [A, 'STAR métro a'],
      [C1, 'STAR ligne C1'],
      [L11, 'STAR ligne 11'],
    ],
  );
  const status = gladys.fake.connectionStatus;
  assert.equal(status.connected, true);
  assert.equal(
    status.message.fr,
    'Connecté au STAR : 2 arrêt(s), 3 ligne(s), arrêts lus toutes les 60 s. Inconnu du STAR : Nulle part, Z9.',
  );
  // The network once (four exports), the C1 stop (bus only, the line in the
  // query), the whole stop (bus and metro), the traffic (four datasets).
  assert.deepEqual(datasets(api).sort(), [
    'tco-bus-circulation-passages-tr',
    'tco-bus-circulation-passages-tr',
    'tco-bus-topologie-lignes-td',
    'tco-bus-topologie-pointsarret-td',
    'tco-busmetro-trafic-alertes-tr',
    'tco-metro-circulation-passages-tr',
    'tco-metro-equipements-etat-tr',
    'tco-metro-lignes-etat-tr',
    'tco-metro-stations-etat-tr',
    'tco-metro-topologie-lignes-td',
    'tco-metro-topologie-pointsarret-td',
  ]);
  // The first readings are a baseline: nothing fires.
  assert.deepEqual(gladys.fake.sceneEvents, []);
});

test('created devices get their states, sent again after the creation', async (t) => {
  const { gladys, app, api, clock } = await startApp();
  t.after(() => gladys.fake.shutdown());
  await created(gladys, C1_STOP);
  await created(gladys, C1);
  await created(gladys, A);
  assert.equal(gladys.fake.lastState(`${C1_STOP}:wait`), 6);
  assert.equal(gladys.fake.lastState(`${C1_STOP}:following`), 12);
  assert.equal(gladys.fake.lastState(`${C1_STOP}:delay`), 1);
  assert.equal(
    gladys.fake.lastState(`${C1_STOP}:next`),
    'C1 → Chantepie · 6 min (+1 min de retard)',
  );
  assert.equal(gladys.fake.lastState(`${C1}:status`), 'Perturbation majeure : Travaux');
  assert.equal(gladys.fake.lastState(`${C1}:disruptions`), 2);
  assert.equal(gladys.fake.lastState(`${A}:status`), 'Perturbation mineure');
  // Seven minutes later the first bus is gone; the whole stop, not created,
  // gets nothing.
  clock.now += 7 * MINUTE;
  api.state.busPassages = api.state.busPassages.filter(
    (record) => record.depart !== '2026-10-27T08:19:03+00:00',
  );
  await app.readStops();
  assert.equal(gladys.fake.lastState(`${C1_STOP}:wait`), 5);
  assert.equal(gladys.fake.lastState(`${ALL_STOP}:next`), undefined);
});

test('departure soon: fired close to its mark, once, between two readings too', async (t) => {
  const { gladys, app, api, clock } = await startApp({
    config: { stop_1: 'République', stop_1_line: 'C1', language: 'en' },
  });
  t.after(() => gladys.fake.shutdown());
  clock.now += MINUTE;
  const depart = iso(clock.now + 12 * MINUTE);
  api.state.busPassages = [busPassage({ depart, departtheorique: depart })];
  await app.readStops({ force: true });
  assert.deepEqual(eventsOf(gladys, TRIGGERS.DEPARTURE_SOON), []);
  // Seven minutes later, without a reading: the 5-minute mark (between readings).
  clock.now += 7 * MINUTE + 10000;
  await app.checkReminders();
  const soon = eventsOf(gladys, TRIGGERS.DEPARTURE_SOON);
  assert.deepEqual(
    soon.map((event) => [event.data.minutes, event.data.line, event.data.destination]),
    [['5', 'C1', 'Chantepie']],
  );
  assert.equal(soon[0].data.stop, `${PREFIX}:stop:n-republique_0001`);
  assert.equal(soon[0].data.summary, 'C1 towards Chantepie leaves République in 5 min (09:26).');
  await app.checkReminders();
  await app.readStops({ force: true });
  assert.equal(eventsOf(gladys, TRIGGERS.DEPARTURE_SOON).length, 1);
});

test('line changes and lifts fire once, after the baseline, never again after a restart', async (t) => {
  const path = storePath();
  const { gladys, app, api } = await startApp({ path });
  t.after(() => gladys.fake.shutdown());
  // Metro a goes down; a lift is repaired, another one breaks.
  api.state.lineStates = [{ ...LINE_STATES[0], etat: 'En panne' }, LINE_STATES[1]];
  const [repaired, ...others] = api.state.equipment;
  api.state.equipment = [
    ...others,
    { ...repaired, idequipement: 'ASC_PON_1', idstation: '15003', nomstation: 'Pontchaillou' },
  ];
  await app.trafficTick();
  assert.deepEqual(
    gladys.fake.sceneEvents.map((event) => [
      event.key,
      event.data.station_name ?? event.data.line_name,
    ]),
    [
      [TRIGGERS.LINE_DISRUPTED, 'a'],
      [TRIGGERS.EQUIPMENT_DOWN, 'Pontchaillou'],
      [TRIGGERS.EQUIPMENT_BACK, 'Jacques Cartier'],
    ],
  );
  const [disrupted, down] = gladys.fake.sceneEvents;
  assert.deepEqual([disrupted.data.line, disrupted.data.severity], [A, 'stopped']);
  assert.deepEqual(
    [down.data.station, down.data.kind, down.data.line_name],
    ['15003', 'elevator', 'a'],
  );
  // The same reading again: nothing new.
  await app.trafficTick();
  assert.equal(gladys.fake.sceneEvents.length, 3);
  // A restart on the same /data: nothing replayed.
  const second = createFakeGladys({ config: CONFIG });
  t.after(() => second.fake.shutdown());
  const restarted = createApp(second, {
    fetch: api,
    storePath: path,
    now: () => NOW,
    timeZone: TZ,
    timers: false,
    logger: silent,
  });
  await second.connect();
  await restarted.whenReady();
  assert.deepEqual(second.fake.sceneEvents, []);
  // Back to running: restored.
  api.state.lineStates = LINE_STATES;
  await restarted.trafficTick();
  assert.deepEqual(
    second.fake.sceneEvents.map((event) => [event.key, event.data.state]),
    [[TRIGGERS.LINE_RESTORED, 'minor']],
  );
});

test('a quiet stop is read every 10 minutes; many stops stretch the interval', async (t) => {
  const { gladys, app, api, clock } = await startApp({
    config: { stop_1: 'République', stop_1_line: 'C1', interval: '30' },
  });
  t.after(() => gladys.fake.shutdown());
  const reads = () => datasets(api).filter((d) => d === 'tco-bus-circulation-passages-tr').length;
  assert.equal(app.effectiveInterval(), 30);
  api.state.busPassages = [];
  await app.readStops({ force: true });
  const before = reads();
  clock.now += 2 * MINUTE;
  await app.readStops();
  assert.equal(reads(), before);
  clock.now += IDLE_INTERVAL_MS;
  await app.readStops();
  assert.equal(reads(), before + 1);
  // Twenty stops, one request each: the interval grows to stay in the budget.
  const added = BUS_STOPS.slice(0, 20).map((stop) => ({ stop: stop.id, line: '', direction: '' }));
  await gladys.fake.configUpdated({ interval: '30', added_stops: added });
  const requests = app.getStops().length;
  assert.equal(requests, 20);
  assert.equal(app.effectiveInterval(), Math.ceil((requests * 86400) / DAILY_STOP_BUDGET));
});

test('the quota reached, then the portal down: clear statuses, the last passages kept', async (t) => {
  const { gladys, app, api, clock } = await startApp();
  t.after(() => gladys.fake.shutdown());
  await created(gladys, C1_STOP);
  api.state.fail = 429;
  clock.now += 2 * MINUTE;
  await app.readStops();
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.fr, /Quota quotidien/);
  api.state.fail = 503;
  await app.trafficTick();
  clock.now += 2 * MINUTE;
  await app.readStops();
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.en, /does not answer \(HTTP 503\)/);
  // The device keeps its last state.
  assert.equal(gladys.fake.lastState(`${C1_STOP}:wait`), 6);
  api.state.fail = null;
  await app.trafficTick();
  await app.readStops();
  assert.equal(gladys.fake.connectionStatus.connected, true);
});

test('widgets: followed stops, a typed stop, lines, the metro; valid in every language', async (t) => {
  const { gladys } = await startApp();
  t.after(() => gladys.fake.shutdown());
  for (const language of ['en', 'fr', 'de', 'es']) {
    const answers = [
      await gladys.fake.widgetGet(WIDGETS.DEPARTURES, { settings: {}, language }),
      await gladys.fake.widgetGet(WIDGETS.DEPARTURES, {
        settings: { stops: [C1_STOP, ALL_STOP] },
        language,
      }),
      await gladys.fake.widgetGet(WIDGETS.DEPARTURES, {
        settings: { stop_name: 'Republique', line: 'a' },
        language,
      }),
      await gladys.fake.widgetGet(WIDGETS.TRAFFIC, { settings: {}, language }),
      await gladys.fake.widgetGet(WIDGETS.TRAFFIC, { settings: { lines: 'C4' }, language }),
      await gladys.fake.widgetGet(WIDGETS.METRO, { settings: { kinds: ['elevator'] }, language }),
    ];
    for (const answer of answers) {
      assert.equal(answer.success, true);
      assert.deepEqual(validateWidgetContent(answer.data.content), [], language);
    }
  }
  const typed = await gladys.fake.widgetGet(WIDGETS.DEPARTURES, {
    settings: { stop_name: 'Republique', line: 'a' },
    language: 'fr',
  });
  const [heading, , status] = typed.data.content.components;
  assert.equal(heading.text, 'République (a)');
  assert.deepEqual(
    status.items.map((item) => item.label),
    ['a → La Poterie', 'a → J.F. Kennedy'],
  );
  const unknown = await gladys.fake.widgetGet(WIDGETS.TRAFFIC, {
    settings: { lines: 'Z9' },
    language: 'en',
  });
  assert.equal(unknown.data.content.components[0].text, 'Unknown to STAR: Z9.');
  const metro = await gladys.fake.widgetGet(WIDGETS.METRO, { settings: {}, language: 'fr' });
  assert.deepEqual(
    metro.data.content.components[2].items.slice(0, 2).map((item) => item.label),
    ['Métro a', 'Métro b'],
  );
});

test('scene actions: next passages of a stop, traffic of a line', async (t) => {
  const { gladys } = await startApp();
  t.after(() => gladys.fake.shutdown());
  const next = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_NEXT_DEPARTURES, {
    stop: C1_STOP,
  });
  assert.equal(next.success, true);
  assert.deepEqual(
    [
      next.data.outputs.found,
      next.data.outputs.minutes,
      next.data.outputs.time,
      next.data.outputs.delay_minutes,
    ],
    [true, 6, '09:19', 1],
  );
  assert.equal(
    next.data.outputs.summary,
    'Prochain passage à République : C1 vers Chantepie dans 6 min. Il a 1 min de retard. Le suivant dans 12 min.',
  );
  const traffic = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_LINE_TRAFFIC, { line: L11 });
  assert.deepEqual(
    [traffic.data.outputs.state, traffic.data.outputs.disrupted, traffic.data.outputs.title],
    ['blocking', true, 'Arrêt TNB'],
  );
  // No field: the first stop and the first line.
  const first = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_LINE_TRAFFIC, {});
  assert.equal(first.data.outputs.line_name, 'a');
});

test('configuration actions: test, find a stop, diagnostic', async (t) => {
  const { gladys, api } = await startApp();
  t.after(() => gladys.fake.shutdown());
  const tested = await gladys.fake.action(ACTIONS.TEST_CONNECTION);
  assert.equal(tested.success, true);
  const fr = tested.data.message.fr;
  assert.match(fr, /^Open data STAR joint : 14 lignes, \d+ arrêts/);
  assert.match(fr, /République \(C1 → Chantepie\) : 4 passage\(s\), prochain C1 dans 6 min/);
  assert.match(fr, /Ligne 11 : Perturbation bloquante/);
  assert.match(fr, /inconnu : Nulle part · inconnu : Z9/);
  assert.match(fr, /appels restants aujourd’hui/);
  const found = await gladys.fake.action(ACTIONS.SEARCH_STOP, { query: 'republique' });
  const text = found.data.message.fr;
  assert.match(text, /^Saisissez le nom/);
  assert.match(text, /République \(Rennes\)\n• bus 1052 → C4 Grand Quartier/);
  assert.match(text, /• bus 1242 → 11 La Poterie, C1 Chantepie/);
  assert.match(text, /• métro 5006 → a La Poterie/);
  // One request for the bus destinations, one for the metro, one for the
  // lines of the stops announcing nothing.
  assert.deepEqual(
    api.calls.slice(-3).map((call) => [call.dataset, call.params.group_by]),
    [
      ['tco-bus-circulation-passages-tr', 'idarret,nomcourtligne,destination'],
      ['tco-metro-circulation-passages-tr', 'idarret,nomcourtligne,destination'],
      ['tco-bus-topologie-dessertes-td', 'idarret,nomcourtligne'],
    ],
  );
  const short = await gladys.fake.action(ACTIONS.SEARCH_STOP, { query: 'r' });
  assert.match(short.data.message.en, /at least two letters/);
  const none = await gladys.fake.action(ACTIONS.SEARCH_STOP, { query: 'zzz' });
  assert.equal(none.data.message.en, 'No STAR stop matches "zzz".');
  const diagnostic = await gladys.fake.action(ACTIONS.DIAGNOSTIC);
  assert.match(diagnostic.data.message.en, /STAR diagnostic/);
});

test('add, list and remove stops with the buttons, beyond the three of the form', async (t) => {
  const { gladys, app } = await startApp();
  t.after(() => gladys.fake.shutdown());
  const added = await gladys.fake.action(ACTIONS.ADD_STOP, { stop: '1168', line: 'c4' });
  assert.match(added.data.message.en, /^Stop added: République \[1168\] \(C4\)\. 3 stop\(s\)/);
  assert.deepEqual(gladys.fake.config.added_stops, [{ stop: '1168', line: 'C4', direction: '' }]);
  assert.ok(
    gladys.fake.discoveredDevices.some(
      (device) => device.external_id === `${PREFIX}:stop:i-1168_0004`,
    ),
  );
  assert.ok(app.getSnapshot('i-1168_0004').passages.every((p) => p.line === 'C4'));
  const again = await gladys.fake.action(ACTIONS.ADD_STOP, { stop: '1168', line: 'C4' });
  assert.match(again.data.message.en, /already followed/);
  const unknown = await gladys.fake.action(ACTIONS.ADD_STOP, { stop: 'Nowhere' });
  assert.equal(unknown.data.message.en, 'Unknown to STAR: Nowhere.');
  const list = await gladys.fake.action(ACTIONS.LIST_STOPS);
  assert.equal(
    list.data.message.fr,
    '4 arrêt(s) suivi(s) :\n' +
      '1. République (C1 → Chantepie) (formulaire, arrêt 1)\n' +
      '2. République (formulaire, arrêt 2)\n' +
      '3. Nulle part (formulaire, arrêt 3, inconnu du STAR)\n' +
      '4. République [1168] (C4)',
  );
  const inForm = await gladys.fake.action(ACTIONS.REMOVE_STOP, { stop: '2' });
  assert.match(inForm.data.message.en, /is stop 2 of the form/);
  const removed = await gladys.fake.action(ACTIONS.REMOVE_STOP, { stop: '4' });
  assert.match(removed.data.message.en, /^Stop removed: République \[1168\] \(C4\)/);
  assert.deepEqual(gladys.fake.config.added_stops, []);
  assert.equal(app.getStops().length, 2);
});

test('two followed stops on the same stop and line share one request per reading', async (t) => {
  const { gladys, app, api } = await startApp({
    config: {
      stop_1: 'République',
      stop_1_line: 'C1',
      stop_1_direction: 'Chantepie',
      stop_2: 'République',
      stop_2_line: 'C1',
      stop_2_direction: 'Saint-Grégoire',
    },
  });
  t.after(() => gladys.fake.shutdown());
  const before = api.calls.length;
  await app.readStops({ force: true });
  assert.deepEqual(datasets(api).slice(before), ['tco-bus-circulation-passages-tr']);
  assert.equal(app.effectiveInterval(), 60);
});
