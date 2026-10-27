// The widget contents pass the validator of the SDK (what the core would
// drop or truncate), in every language.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import {
  buildDeparturesWidget,
  buildTrafficWidget,
  buildMetroWidget,
  messageContent,
  readCount,
  readKinds,
  routeValue,
  shortDate,
  BOARD_COUNT,
  EQUIPMENT_KINDS,
} from '../src/widgets.js';
import { parsePassages } from '../src/departures.js';
import { parseTraffic, lineTraffic } from '../src/traffic.js';
import { LANGUAGES } from '../src/i18n.js';
import {
  NOW,
  TZ,
  BUS_PASSAGES,
  METRO_PASSAGES,
  ALERTS,
  LINE_STATES,
  STATION_STATES,
  EQUIPMENT,
  busPassage,
} from './helpers/fixtures.js';

const TRAFFIC = parseTraffic({
  alerts: ALERTS,
  lineStates: LINE_STATES,
  stations: STATION_STATES,
  equipment: EQUIPMENT,
});
const METRO_LINES = [
  { id: '1001', name: 'a' },
  { id: '1002', name: 'b' },
];
const ALL = parsePassages({ bus: BUS_PASSAGES, metro: METRO_PASSAGES }, { stopName: 'République' });

/**
 * @description Assert that the core would keep the content whole.
 * @param {object} content - The content.
 * @param {string} label - For the message.
 */
function assertValid(content, label) {
  assert.deepEqual(validateWidgetContent(content), [], label);
}

test('departures widget: one compact row per route, soonest first, in every language', () => {
  for (const language of LANGUAGES) {
    const content = buildDeparturesWidget({
      title: 'République',
      passages: ALL,
      readAt: NOW,
      count: 6,
      language,
      now: NOW,
      timeZone: TZ,
    });
    assertValid(content, language);
    const [heading, caption, status] = content.components;
    assert.equal(heading.text, 'République');
    assert.match(caption.text, /^STAR · .*09:13/);
    assert.equal(status.items.length, 6);
  }
  const fr = buildDeparturesWidget({
    title: 'République',
    passages: ALL,
    readAt: NOW,
    count: 3,
    language: 'fr',
    now: NOW,
    timeZone: TZ,
  });
  assert.deepEqual(fr.components[2].items[0], {
    label: 'a → La Poterie',
    value: 'À l’approche · 1 · 3 · 5 · 6 min',
    color: 'success',
  });
  // A route mixing located buses and timetable times: the star, said in the caption.
  const six = buildDeparturesWidget({
    title: 'République',
    passages: ALL,
    readAt: NOW,
    count: 6,
    language: 'fr',
    now: NOW,
    timeZone: TZ,
  });
  assert.equal(six.components[1].text, 'STAR · mis à jour à 09:13 · * théorique');
  assert.equal(six.components[2].items[3].value, '1 · 12* · 12 · 22 · 32 min');
});

test('departures widget: timetable only, times beyond an hour, nothing announced', () => {
  const options = { language: 'en', now: NOW, timeZone: TZ };
  const timetable = parsePassages({
    bus: [
      busPassage({ precision: 'Applicable' }),
      busPassage({ precision: 'Applicable', depart: '2026-10-27T09:40:00+00:00' }),
    ],
  });
  assert.deepEqual(routeValue(timetable, options), {
    value: '5 min · 10:40 · timetable',
    starred: false,
  });
  const empty = buildDeparturesWidget({
    title: 'République',
    passages: [],
    readAt: NOW,
    count: 6,
    language: 'de',
    now: NOW,
    timeZone: TZ,
  });
  assertValid(empty, 'empty');
  assert.equal(
    empty.components[1].text,
    'Keine Abfahrt angekündigt. STAR · aktualisiert um 09:13.',
  );
  assert.equal(empty.ttl_seconds, 300);
});

test('departures widget: several stops in one list, a row per stop then its routes', () => {
  const content = buildDeparturesWidget({
    boards: [
      { title: 'République (C1)', label: 'République', passages: ALL, readAt: NOW },
      { title: 'Gares', label: 'Gares', passages: [], readAt: NOW - 60000 },
    ],
    count: 6,
    language: 'fr',
    now: NOW,
    timeZone: TZ,
  });
  assertValid(content, 'several');
  const [heading, caption, status] = content.components;
  assert.equal(heading.text, 'République · Gares');
  assert.match(caption.text, /^STAR/);
  assert.equal(status.items[0].icon, 'map-pin');
  assert.equal(status.items.at(-1).value, 'Aucun passage annoncé');
  assert.ok(status.items.length <= 10);
});

test('traffic widget: states, alerts with their text, window and link, in every language', () => {
  const lines = [
    { id: '1001', name: 'a', mode: 'metro' },
    { id: '0001', name: 'C1', mode: 'bus' },
    { id: '0006', name: 'C6', mode: 'bus' },
    { id: '0011', name: '11', mode: 'bus' },
  ];
  for (const language of LANGUAGES) {
    const content = buildTrafficWidget({
      lines: lines.map((line) => ({ line, traffic: lineTraffic(TRAFFIC, line.id, NOW) })),
      readAt: NOW,
      language,
      timeZone: TZ,
    });
    assertValid(content, language);
  }
  const fr = buildTrafficWidget({
    lines: lines.map((line) => ({ line, traffic: lineTraffic(TRAFFIC, line.id, NOW) })),
    readAt: NOW,
    language: 'fr',
    timeZone: TZ,
  });
  const [, status, cards, caption] = fr.components;
  assert.deepEqual(
    status.items.map((item) => [item.label, item.value, item.color]),
    [
      ['Métro a', 'Perturbation mineure', 'info'],
      ['Ligne C1', 'Perturbation majeure', 'warning'],
      ['Ligne C6', 'Perturbation majeure', 'warning'],
      ['Ligne 11', 'Perturbation bloquante', 'danger'],
    ],
  );
  const [first] = cards.items;
  assert.equal(first.title, 'Arrêt TNB');
  assert.equal(first.subtitle, 'Perturbation bloquante · jusqu’au 31/12');
  assert.deepEqual(first.badge, { text: '11', color: 'danger' });
  assert.equal(first.links[0].url, 'https://www.star.fr/se-deplacer/info-trafic');
  // Eight cards at most, the most serious first: the planned alert of C6 is
  // shown with C6 alone.
  assert.equal(cards.items.length, 8);
  const c6 = buildTrafficWidget({
    lines: [{ line: lines[2], traffic: lineTraffic(TRAFFIC, '0006', NOW) }],
    readAt: NOW,
    language: 'fr',
    timeZone: TZ,
  });
  const planned = c6.components[2].items.at(-1);
  assert.equal(planned.title, 'secteur morinais');
  assert.equal(planned.subtitle, 'Perturbation prévue · à partir du 31/10');
  assert.deepEqual(planned.badge, { text: 'C6', color: 'info' });
  assert.equal(caption.text, 'STAR · mis à jour à 09:13');
  // No alert: the body says so, with the time.
  const calm = buildTrafficWidget({
    lines: [{ line: { id: '0005', name: 'C5' }, traffic: lineTraffic(TRAFFIC, '0005', NOW) }],
    readAt: NOW,
    language: 'en',
    timeZone: TZ,
  });
  assertValid(calm, 'calm');
  assert.equal(
    calm.components.at(-1).text,
    'No traffic alert for these lines. STAR · updated at 09:13.',
  );
});

test('metro widget: both lines, the equipment out of service, in every language', () => {
  for (const language of LANGUAGES) {
    const content = buildMetroWidget({
      lines: METRO_LINES,
      traffic: TRAFFIC,
      readAt: NOW,
      kinds: EQUIPMENT_KINDS,
      language,
      timeZone: TZ,
    });
    assertValid(content, language);
  }
  const fr = buildMetroWidget({
    lines: METRO_LINES,
    traffic: TRAFFIC,
    readAt: NOW,
    kinds: EQUIPMENT_KINDS,
    language: 'fr',
    timeZone: TZ,
  });
  const [heading, caption, status] = fr.components;
  assert.equal(heading.text, 'Métro STAR');
  // The lines first, then a row per equipment, ten rows at most.
  assert.deepEqual(
    status.items.slice(0, 4).map((item) => [item.label, item.value, item.color]),
    [
      ['Métro a', 'En service', 'success'],
      ['Métro b', 'En service', 'success'],
      ['Cesson - Viasilva', 'Escalier méca.', 'warning'],
      ['Colombier', 'Ascenseur', 'warning'],
    ],
  );
  assert.equal(status.items.length, 9);
  assert.equal(caption.text, '9 hors service · 2 non affiché(s) · STAR · mis à jour à 09:13');
  // Escalators only, a line down with its restart, a closed station.
  const down = parseTraffic({
    lineStates: [
      { ...LINE_STATES[0], etat: 'En panne', finpanneprevue: '2026-10-27T08:45:00+00:00' },
      LINE_STATES[1],
    ],
    stations: [{ idstation: '15006', nom: 'République', etat: 'Fermée' }],
    equipment: EQUIPMENT,
  });
  const escalators = buildMetroWidget({
    lines: METRO_LINES,
    traffic: down,
    readAt: NOW,
    kinds: readKinds(['escalator']),
    language: 'en',
    timeZone: TZ,
  });
  assertValid(escalators, 'escalators');
  assert.deepEqual(
    escalators.components[2].items.map((item) => [item.label, item.value, item.color]),
    [
      ['Metro a', 'Down · back about 09:45', 'danger'],
      ['Metro b', 'Running', 'success'],
      ['Closed stations', 'République', 'warning'],
      ['Cesson - Viasilva', 'Escalator', 'warning'],
      ['Saint-Germain', 'Escalator', 'warning'],
    ],
  );
  assert.equal(escalators.components[1].text, '2 out of service · STAR · updated at 09:13');
  // Everything works: one sentence.
  const fine = buildMetroWidget({
    lines: METRO_LINES,
    traffic: parseTraffic({ lineStates: LINE_STATES }),
    readAt: NOW,
    kinds: EQUIPMENT_KINDS,
    language: 'es',
    timeZone: TZ,
  });
  assertValid(fine, 'fine');
  assert.match(fine.components[1].text, /^Todos los ascensores/);
  assert.equal(fine.components[2].items.length, 2);
});

test('messages and settings', () => {
  assertValid(messageContent('Hello'), 'message');
  assert.equal(readCount(undefined, BOARD_COUNT), BOARD_COUNT.default);
  assert.equal(readCount('99', BOARD_COUNT), BOARD_COUNT.max);
  assert.equal(readCount(0, BOARD_COUNT), BOARD_COUNT.min);
  assert.deepEqual(readKinds(undefined), EQUIPMENT_KINDS);
  assert.deepEqual(readKinds(['elevator', 'rocket']), ['elevator']);
  assert.equal(shortDate(Date.parse('2026-12-31T22:59:00Z'), TZ), '31/12');
  assert.equal(shortDate(null, TZ), '');
});
