// Builds the widget contents of the illustrations with the integration's own
// code: node gen.mjs <repo> <out.json> (run by render.sh)
//
// The three widgets on a real Tuesday morning in Rennes: the answers of the
// STAR portal read on 2026-10-27 at 09:12 and kept in test/fixtures (passages
// at République, traffic alerts, state of the metro, lifts and escalators out
// of service) go through the real parsers (src/departures.js, src/traffic.js)
// and the real widget builders (src/widgets.js).
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [repo, out] = process.argv.slice(2);
const load = (path) => import(pathToFileURL(`${repo}/${path}`).href);
const { buildDeparturesWidget, buildTrafficWidget, buildMetroWidget, EQUIPMENT_KINDS } =
  await load('src/widgets.js');
const { parsePassages } = await load('src/departures.js');
const { parseTraffic, lineTraffic } = await load('src/traffic.js');
const { LANGUAGES } = await load('src/i18n.js');
const fixture = (name) => JSON.parse(readFileSync(`${repo}/test/fixtures/${name}`, 'utf8'));
const manifest = JSON.parse(readFileSync(`${repo}/gladys-assistant-integration.json`, 'utf8'));

// Tuesday 27 October 2026, 09:13 in Paris.
const NOW = Date.parse('2026-10-27T08:13:00Z');
const TZ = 'Europe/Paris';

const passages = parsePassages(
  {
    bus: fixture('bus-passages-republique.json').results,
    metro: fixture('metro-passages-republique.json').results,
  },
  { stopName: 'République' },
);
const traffic = parseTraffic({
  alerts: fixture('alerts.json'),
  lineStates: fixture('metro-line-states.json').results,
  stations: fixture('metro-station-states.json'),
  equipment: fixture('equipment-down.json'),
});
const lines = [
  { id: '1001', name: 'a', mode: 'metro' },
  { id: '1002', name: 'b', mode: 'metro' },
  { id: '0001', name: 'C1', mode: 'bus' },
  { id: '0011', name: '11', mode: 'bus' },
].map((line) => ({ line, traffic: lineTraffic(traffic, line.id, NOW) }));

const contents = {};
for (const language of LANGUAGES) {
  contents[language] = {
    departures: buildDeparturesWidget({
      title: 'République',
      passages,
      readAt: NOW,
      count: 6,
      language,
      now: NOW,
      timeZone: TZ,
    }),
    traffic: buildTrafficWidget({ lines, readAt: NOW - 2 * 60 * 1000, language, timeZone: TZ }),
    metro: buildMetroWidget({
      lines: [
        { id: '1001', name: 'a' },
        { id: '1002', name: 'b' },
      ],
      traffic,
      readAt: NOW - 2 * 60 * 1000,
      kinds: EQUIPMENT_KINDS,
      language,
      timeZone: TZ,
    }),
  };
}
const widgets = Object.fromEntries(
  manifest.widgets.map((w) => [w.key, { icon: w.icon, label: w.label }]),
);
writeFileSync(out, JSON.stringify({ now: NOW, widgets, contents }));
