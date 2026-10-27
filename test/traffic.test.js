import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseTraffic, lineTraffic, seriousMessages, alertOf, cleanText } from '../src/traffic.js';
import { NOW, ALERTS, LINE_STATES, STATION_STATES, EQUIPMENT } from './helpers/fixtures.js';

const TRAFFIC = parseTraffic({
  alerts: ALERTS,
  lineStates: LINE_STATES,
  stations: STATION_STATES,
  equipment: EQUIPMENT,
});

test('an alert: its level, its window, the part of its id shared across lines', () => {
  const alert = alertOf(ALERTS.find((raw) => raw.titre === 'Arrêt TNB'));
  assert.equal(alert.level, 'blocking');
  assert.equal(alert.lineId, '0011');
  assert.equal(alert.event, alert.id.slice(0, 36));
  assert.equal(alert.end, Date.parse('2026-12-31T22:59:00Z'));
  assert.equal(alert.url, 'https://www.star.fr/se-deplacer/info-trafic');
  assert.equal(alert.text.split('\n')[0], 'Pendant plusieurs mois');
  assert.equal(cleanText(' a \r\n\n  b  c ', 100), 'a\nb c');
});

test('line states: the worst alert under way, the planned ones aside', () => {
  assert.equal(lineTraffic(TRAFFIC, '0011', NOW).state, 'blocking');
  assert.equal(lineTraffic(TRAFFIC, '0001', NOW).state, 'major');
  assert.equal(lineTraffic(TRAFFIC, '1001', NOW).state, 'minor');
  assert.equal(lineTraffic(TRAFFIC, '0005', NOW).state, 'normal');
  assert.equal(lineTraffic(null, '0005', NOW).state, 'unknown');
  const c6 = lineTraffic(TRAFFIC, '0006', NOW);
  assert.equal(c6.state, 'major');
  // "secteur morinais" begins on 31/10: planned, last.
  assert.equal(c6.messages.at(-1).state, 'planned');
  assert.equal(c6.messages.at(-1).title, 'secteur morinais');
  assert.equal(seriousMessages(c6).length, 4);
  // An alert over is gone.
  const later = Date.parse('2027-02-01T00:00:00Z');
  assert.equal(lineTraffic(TRAFFIC, '0001', later).state, 'normal');
});

test('a metro line down is the worst state, with its restart', () => {
  const traffic = parseTraffic({
    lineStates: [
      {
        ...LINE_STATES[0],
        etat: 'En panne',
        pannedepuis: '2026-10-27T08:05:00+00:00',
        finpanneprevue: '2026-10-27T08:45:00+00:00',
      },
    ],
  });
  const a = lineTraffic(traffic, '1001', NOW);
  assert.equal(a.state, 'stopped');
  assert.deepEqual(a.metro, {
    name: 'a',
    running: false,
    since: Date.parse('2026-10-27T08:05:00Z'),
    until: Date.parse('2026-10-27T08:45:00Z'),
  });
  assert.equal(TRAFFIC.metro['1002'].running, true);
});

test('stations and equipment out of service', () => {
  assert.equal(TRAFFIC.stations.length, 30);
  assert.ok(TRAFFIC.stations.every((station) => station.open));
  const closed = parseTraffic({
    stations: [{ idstation: '15006', nom: 'République', etat: 'Fermée' }],
  });
  assert.equal(closed.stations[0].open, false);
  assert.equal(TRAFFIC.equipment.length, 9);
  assert.deepEqual([...new Set(TRAFFIC.equipment.map((item) => item.kind))].sort(), [
    'elevator',
    'escalator',
    'parking_elevator',
  ]);
  const lift = TRAFFIC.equipment.find((item) => item.id === 'ASC_JCA_1');
  assert.deepEqual(lift, {
    id: 'ASC_JCA_1',
    name: 'Quai vers Kennedy <-> Salle des billets',
    stationId: '15009',
    station: 'Jacques Cartier',
    kind: 'elevator',
    lineId: '1001',
  });
  // Ticket machines, or equipment working, are not kept.
  const other = parseTraffic({
    equipment: [
      { ...EQUIPMENT[0], typecourt: 'DAT' },
      { ...EQUIPMENT[0], etat: ['En fonctionnement'] },
    ],
  });
  assert.deepEqual(other.equipment, []);
});
