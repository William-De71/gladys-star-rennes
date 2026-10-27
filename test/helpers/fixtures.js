// A fake STAR open data portal for the tests, served through the `fetch`
// option of the integration. Its answers are real ones, read on 2026-10-27 at
// 09:12 (Paris) and reduced: the bus stops of twelve names, every metro
// platform, twelve bus lines and both metro lines, the next bus and metro
// passages at République, twelve traffic alerts (one planned), the state of
// the metro lines and stations, and nine lifts and escalators out of
// service. Open data of STAR, ODbL. Tests never touch the network.

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// 2026-10-27 09:13 in Paris: the time of the readings.
const NOW = Date.parse('2026-10-27T08:13:00Z');
const TZ = 'Europe/Paris';

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8'));
const BUS_STOPS = fixture('bus-stops.json');
const METRO_STOPS = fixture('metro-stops.json');
const BUS_LINES = fixture('bus-lines.json');
const METRO_LINES = fixture('metro-lines.json');
const BUS_PASSAGES = fixture('bus-passages-republique.json').results;
const METRO_PASSAGES = fixture('metro-passages-republique.json').results;
const ALERTS = fixture('alerts.json');
const LINE_STATES = fixture('metro-line-states.json').results;
const STATION_STATES = fixture('metro-station-states.json');
const EQUIPMENT = fixture('equipment-down.json');

const silent = { info() {}, warn() {}, error() {}, debug() {} };

/**
 * @description A temporary path for the file kept in /data.
 * @returns {string} The path (its directory exists, the file does not).
 */
const storePath = () => join(mkdtempSync(join(tmpdir(), 'star-')), 'star-rennes.json');

const clone = (value) => JSON.parse(JSON.stringify(value));

/**
 * @description A record of the bus passages dataset.
 * @param {object} fields - What differs from a C1 towards Chantepie at
 * République, located, leaving at 09:18 (Paris) on time.
 * @returns {object} The record, as the portal writes it.
 */
function busPassage(fields = {}) {
  return {
    idarret: '1242',
    nomarret: 'République',
    idligne: '0001',
    nomcourtligne: 'C1',
    sens: 0,
    destination: 'Chantepie',
    depart: '2026-10-27T08:18:00+00:00',
    departtheorique: '2026-10-27T08:18:00+00:00',
    precision: 'Temps réel',
    ...fields,
  };
}

/**
 * @description The values of a condition `field in ("a","b")` of a query.
 * @param {string} where - The ODSQL condition.
 * @param {string} field - The field.
 * @returns {string[]|null} The values, null when the field is not filtered.
 */
function among(where, field) {
  const match = new RegExp(`${field} in \\(([^)]*)\\)`).exec(where ?? '');
  return match ? [...match[1].matchAll(/"([^"]*)"/g)].map((m) => m[1]) : null;
}

/**
 * @description The value of a condition `field = "x"` of a query.
 * @param {string} where - The ODSQL condition.
 * @param {string} field - The field.
 * @returns {string|null} The value.
 */
function equal(where, field) {
  const match = new RegExp(`${field} = "([^"]*)"`).exec(where ?? '');
  return match ? match[1] : null;
}

/**
 * @description The fake portal.
 * @param {object} [options] - `{ now }`: `() => number`, the clock of `now()`.
 * @returns {Function} A fetch function, with `.calls` and `.state`.
 */
function fakeStar({ now = () => NOW } = {}) {
  const state = {
    busStops: clone(BUS_STOPS),
    metroStops: clone(METRO_STOPS),
    busLines: clone(BUS_LINES),
    metroLines: clone(METRO_LINES),
    busPassages: clone(BUS_PASSAGES),
    metroPassages: clone(METRO_PASSAGES),
    alerts: clone(ALERTS),
    lineStates: clone(LINE_STATES),
    stations: clone(STATION_STATES),
    equipment: clone(EQUIPMENT),
    // 'network', or an HTTP status, for every request.
    fail: null,
    remaining: 19000,
  };
  const calls = [];

  /**
   * @description An answer of the portal.
   * @param {unknown} body - The JSON body.
   * @param {number} [status] - The HTTP status.
   * @returns {Response} The answer, with the quota headers.
   */
  const json = (body, status = 200) => {
    state.remaining -= 1;
    return new Response(JSON.stringify(body), {
      status,
      headers: {
        'content-type': 'application/json',
        'x-ratelimit-limit': '20000',
        'x-ratelimit-remaining': String(Math.max(0, state.remaining)),
        'x-ratelimit-reset': '2026-10-28 00:00:00+00:00',
      },
    });
  };

  /**
   * @description The passages a query asks for.
   * @param {object[]} records - The dataset.
   * @param {URLSearchParams} params - The query.
   * @returns {object[]} The records.
   */
  function passages(records, params) {
    const where = params.get('where');
    const ids = among(where, 'idarret') ?? [];
    const line = equal(where, 'idligne');
    const from = /now\(minutes=-1\)/.test(where ?? '') ? now() - 60000 : -Infinity;
    return records
      .filter((r) => ids.includes(r.idarret))
      .filter((r) => !line || r.idligne === line)
      .filter((r) => Date.parse(r.depart) >= from)
      .sort((a, b) => Date.parse(a.depart) - Date.parse(b.depart));
  }

  /**
   * @description The distinct values of a `group_by` query.
   * @param {object[]} records - The records.
   * @param {URLSearchParams} params - The query.
   * @returns {object[]} One record per group, with the grouped fields only.
   */
  function grouped(records, params) {
    const fields = params.get('group_by').split(',');
    const ids = among(params.get('where'), 'idarret') ?? [];
    const groups = new Map();
    for (const record of records.filter((r) => ids.includes(r.idarret))) {
      const row = Object.fromEntries(fields.map((field) => [field, record[field]]));
      groups.set(JSON.stringify(row), row);
    }
    return [...groups.values()];
  }

  /**
   * @description The fetch function.
   * @param {string} url - The URL.
   * @returns {Promise<Response>} The answer.
   */
  async function fetchFn(url) {
    const parsed = new URL(url);
    const [, dataset, endpoint] = /\/([^/]+)\/(records|exports\/json)$/.exec(parsed.pathname) ?? [];
    calls.push({ dataset, endpoint, params: Object.fromEntries(parsed.searchParams) });
    if (state.fail === 'network') {
      throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } });
    }
    if (state.fail === 429) {
      return json({ error_code: 'TooManyRequests', message: 'Too many requests' }, 429);
    }
    if (typeof state.fail === 'number') {
      return new Response('down', { status: state.fail });
    }
    const page = (results) => json({ total_count: results.length, results: results.slice(0, 100) });
    const { searchParams: params } = parsed;
    switch (dataset) {
      case 'tco-bus-topologie-pointsarret-td':
        return json(state.busStops);
      case 'tco-metro-topologie-pointsarret-td':
        return json(state.metroStops);
      case 'tco-bus-topologie-lignes-td':
        return json(state.busLines);
      case 'tco-metro-topologie-lignes-td':
        return json(state.metroLines);
      case 'tco-bus-topologie-dessertes-td':
        return page(
          grouped(
            state.busPassages.map((r) => ({ idarret: r.idarret, nomcourtligne: r.nomcourtligne })),
            params,
          ),
        );
      case 'tco-bus-circulation-passages-tr':
        return page(
          params.get('group_by')
            ? grouped(state.busPassages, params)
            : passages(state.busPassages, params),
        );
      case 'tco-metro-circulation-passages-tr':
        return page(
          params.get('group_by')
            ? grouped(state.metroPassages, params)
            : passages(state.metroPassages, params),
        );
      case 'tco-busmetro-trafic-alertes-tr':
        return json(state.alerts);
      case 'tco-metro-lignes-etat-tr':
        return page(state.lineStates);
      case 'tco-metro-stations-etat-tr':
        return json(state.stations);
      case 'tco-metro-equipements-etat-tr':
        return json(state.equipment);
      default:
        return json({ error_code: 'UnknownDatasetError', message: 'Unknown dataset' }, 404);
    }
  }
  fetchFn.calls = calls;
  fetchFn.state = state;
  return fetchFn;
}

/**
 * @description A minimal Gladys client for the pure builders.
 */
const fakeGladys = {
  externalIds: (type, id) => ({
    device: `ext:star-rennes:${type}:${id}`,
    feature: (key) => `ext:star-rennes:${type}:${id}:${key}`,
  }),
};

export {
  NOW,
  TZ,
  BUS_STOPS,
  METRO_STOPS,
  BUS_LINES,
  METRO_LINES,
  BUS_PASSAGES,
  METRO_PASSAGES,
  ALERTS,
  LINE_STATES,
  STATION_STATES,
  EQUIPMENT,
  silent,
  storePath,
  busPassage,
  fakeStar,
  fakeGladys,
};
