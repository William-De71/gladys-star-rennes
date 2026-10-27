import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeConfig,
  readLanguage,
  readInterval,
  parseLines,
  parseAddedStops,
  DEFAULT_INTERVAL,
  MAX_ADDED_STOPS,
} from '../src/config.js';

test('stops, lines, interval and language from the raw config', () => {
  const config = normalizeConfig({
    stop_1: ' République ',
    stop_1_line: 'C1',
    stop_1_direction: 'Chantepie',
    stop_2: '',
    stop_3: '1168',
    lines: 'a, c1 ; 11, a',
    interval: '30',
    language: 'de',
  });
  assert.deepEqual(config, {
    stops: [
      { slot: 1, stop: 'République', line: 'C1', direction: 'Chantepie' },
      { slot: 3, stop: '1168', line: '', direction: '' },
    ],
    addedStops: [],
    lines: ['a', 'c1', '11'],
    interval: 30,
    language: 'de',
  });
  assert.deepEqual(normalizeConfig(null), {
    stops: [],
    addedStops: [],
    lines: [],
    interval: DEFAULT_INTERVAL,
    language: 'auto',
  });
});

test('bounds: six lines, the intervals offered, the stored language', () => {
  assert.equal(parseLines('1,2,3,4,5,6,7,8').length, 6);
  assert.deepEqual(parseLines(undefined), []);
  assert.equal(readInterval(45), DEFAULT_INTERVAL);
  assert.equal(readInterval(300), 300);
  assert.equal(readLanguage({ last_language: 'es' }, 'fr'), 'es');
  assert.equal(readLanguage({ last_language: 'español' }, 'fr'), 'fr');
  assert.equal(readLanguage(undefined, 'en'), 'en');
});

test('the stops added with the buttons follow the three of the form', () => {
  const added = [
    { stop: '1242', line: 'C1', direction: '' },
    { stop: ' Gares ', line: '', direction: 'Poterie' },
    { stop: '', line: 'a' },
    'Gares',
  ];
  const config = normalizeConfig({ stop_2: 'Sainte-Anne', added_stops: added });
  assert.deepEqual(config.stops, [
    { slot: 2, stop: 'Sainte-Anne', line: '', direction: '' },
    { slot: null, added: 1, stop: '1242', line: 'C1', direction: '' },
    { slot: null, added: 2, stop: 'Gares', line: '', direction: 'Poterie' },
  ]);
  assert.equal(config.addedStops.length, 2);
  // Stored as JSON text by an older core: read the same.
  assert.deepEqual(parseAddedStops(JSON.stringify(added)), config.addedStops);
  assert.deepEqual(parseAddedStops('not json'), []);
  assert.deepEqual(parseAddedStops(undefined), []);
  const many = Array.from({ length: 30 }, (_, n) => ({ stop: `S${n}` }));
  assert.equal(parseAddedStops(many).length, MAX_ADDED_STOPS);
});
