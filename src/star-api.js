// -----------------------------------------------------------------------------
// HTTP client of the STAR open data portal (https://data.explore.star.fr), the
// official data of the bus and metro network of Rennes Métropole, run by
// Keolis Rennes. An Opendatasoft portal: Explore API v2.1, no key, ODbL data.
//
// Datasets used (documentation: https://data.explore.star.fr/explore/):
//   tco-bus-topologie-pointsarret-td         bus stops (one id per side of
//                                            the street), read weekly;
//   tco-metro-topologie-pointsarret-td       metro platforms (one id per
//                                            direction), read weekly;
//   tco-bus-topologie-lignes-td              bus lines, read daily;
//   tco-metro-topologie-lignes-td            metro lines a and b, read daily;
//   tco-bus-topologie-dessertes-td           the lines of each bus stop, for
//                                            "Find a stop";
//   tco-bus-circulation-passages-tr          the next bus passages, three
//                                            hours ahead, real time or
//                                            timetable;
//   tco-metro-circulation-passages-tr        the next metro passages;
//   tco-busmetro-trafic-alertes-tr           the traffic alerts of the lines;
//   tco-metro-lignes-etat-tr                 the metro lines: "OK" or "En panne";
//   tco-metro-stations-etat-tr               the metro stations: open or closed;
//   tco-metro-equipements-etat-tr            lifts and escalators of the metro
//                                            stations and park-and-rides.
//
// Without a key, the portal allows a daily number of calls per address
// (`X-RateLimit-*` headers, 20 000 seen, reset at midnight UTC) and answers
// 429 beyond. Errors are JSON `{ error_code, message }`.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

const BASE_URL =
  process.env.STAR_API_URL || 'https://data.explore.star.fr/api/explore/v2.1/catalog/datasets';
const TIMEOUT_MS = 20000;
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const USER_AGENT = `gladys-star-rennes/${version} (+https://github.com/William-De71/gladys-star-rennes)`;

const DATASETS = {
  BUS_STOPS: 'tco-bus-topologie-pointsarret-td',
  METRO_STOPS: 'tco-metro-topologie-pointsarret-td',
  BUS_LINES: 'tco-bus-topologie-lignes-td',
  METRO_LINES: 'tco-metro-topologie-lignes-td',
  BUS_SERVICES: 'tco-bus-topologie-dessertes-td',
  BUS_PASSAGES: 'tco-bus-circulation-passages-tr',
  METRO_PASSAGES: 'tco-metro-circulation-passages-tr',
  ALERTS: 'tco-busmetro-trafic-alertes-tr',
  METRO_LINE_STATES: 'tco-metro-lignes-etat-tr',
  METRO_STATION_STATES: 'tco-metro-stations-etat-tr',
  METRO_EQUIPMENT: 'tco-metro-equipements-etat-tr',
};
// The most records one call returns (a limit of the portal).
const MAX_LIMIT = 100;
const PASSAGE_FIELDS =
  'idarret,nomarret,idligne,nomcourtligne,sens,destination,depart,departtheorique,precision';
const METRO_PASSAGE_FIELDS =
  'idarret,nomarret,idligne,nomcourtligne,sens,destination,depart,precision';

class StarError extends Error {
  /**
   * @param {string} kind - `quota`, `unreachable` or `invalid`.
   * @param {string} message - The detail.
   * @param {object} [extra] - `{ status }`.
   */
  constructor(kind, message, { status = null } = {}) {
    super(message);
    this.name = 'StarError';
    this.kind = kind;
    this.status = status;
  }
}

/**
 * @description A string literal of the query language of the portal (ODSQL).
 * @param {unknown} value - The value.
 * @returns {string} `"…"`, quotes and backslashes escaped.
 * @example
 * quote('1001'); // -> '"1001"'
 */
const quote = (value) => `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/**
 * @description The ODSQL condition "field among these values".
 * @param {string} field - The field.
 * @param {string[]} values - The values.
 * @returns {string} `idarret in ("1","2")`.
 */
const among = (field, values) => `${field} in (${values.map(quote).join(',')})`;

/**
 * @description A client of the STAR open data portal.
 * @param {object} [options] - Options.
 * @param {Function} [options.fetch] - The fetch function (tests).
 * @param {Function} [options.now] - `() => number` in ms.
 * @param {string} [options.baseUrl] - The datasets root (tests, end-to-end runs).
 * @returns {object} The methods, `requests` and `quota` for the diagnostic.
 */
function createStarClient({
  fetch: fetchFn = globalThis.fetch,
  now = () => Date.now(),
  baseUrl = BASE_URL,
} = {}) {
  // Requests made, per dataset, and the last quota seen, for the diagnostic.
  const requests = { total: 0, byDataset: {}, failed: 0, last: null };
  const quota = { limit: null, remaining: null, reset: null };

  /**
   * @description Call the portal.
   * @param {string} dataset - The dataset id.
   * @param {string} endpoint - `records` or `exports/json`.
   * @param {object} [params] - Query parameters (`where`, `select`, `order_by`, `limit`).
   * @returns {Promise<unknown>} The JSON answer.
   */
  async function call(dataset, endpoint, params = {}) {
    const query = new URLSearchParams();
    for (const [name, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        query.set(name, String(value));
      }
    }
    requests.total += 1;
    requests.byDataset[dataset] = (requests.byDataset[dataset] ?? 0) + 1;
    requests.last = now();
    let response;
    try {
      response = await fetchFn(`${baseUrl}/${dataset}/${endpoint}?${query}`, {
        headers: { accept: 'application/json', 'user-agent': USER_AGENT },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      requests.failed += 1;
      throw new StarError('unreachable', err.cause?.code ?? err.message);
    }
    const remaining = Number(response.headers?.get?.('x-ratelimit-remaining'));
    if (Number.isFinite(remaining) && response.headers.get('x-ratelimit-remaining') !== null) {
      quota.remaining = remaining;
      quota.limit = Number(response.headers.get('x-ratelimit-limit')) || null;
      quota.reset = response.headers.get('x-ratelimit-reset') || null;
    }
    if (!response.ok) {
      requests.failed += 1;
      let detail = `HTTP ${response.status}`;
      try {
        const body = await response.json();
        if (typeof body?.message === 'string') {
          detail = `${detail}: ${body.message.slice(0, 160)}`;
        }
      } catch {
        // No JSON body: the status says enough.
      }
      let kind = 'unreachable';
      if (response.status === 429) {
        kind = 'quota';
      } else if (response.status >= 400 && response.status < 500) {
        kind = 'invalid';
      }
      throw new StarError(kind, detail, { status: response.status });
    }
    try {
      return await response.json();
    } catch (err) {
      requests.failed += 1;
      throw new StarError('invalid', `${dataset}: ${err.message}`);
    }
  }

  /**
   * @description The records of a dataset (one page).
   * @param {string} dataset - The dataset id.
   * @param {object} params - `where`, `select`, `order_by`, `limit` (100 at most).
   * @returns {Promise<object[]>} The records.
   */
  async function records(dataset, params) {
    const body = await call(dataset, 'records', {
      ...params,
      limit: Math.min(MAX_LIMIT, params.limit ?? MAX_LIMIT),
    });
    if (!Array.isArray(body?.results)) {
      throw new StarError('invalid', `${dataset}: no results`);
    }
    return body.results;
  }

  /**
   * @description Every record of a dataset (the export, without a page limit).
   * @param {string} dataset - The dataset id.
   * @param {object} [params] - `where`, `select`, `order_by`.
   * @returns {Promise<object[]>} The records.
   */
  async function exportAll(dataset, params = {}) {
    const body = await call(dataset, 'exports/json', params);
    if (!Array.isArray(body)) {
      throw new StarError('invalid', `${dataset}: not a list`);
    }
    return body;
  }

  /**
   * @description The passages to come at some stops.
   * @param {string} dataset - DATASETS.BUS_PASSAGES or METRO_PASSAGES.
   * @param {string[]} ids - The stop ids.
   * @param {object} options - `{ lineId, limit, select }`.
   * @returns {Promise<object[]>} The records, soonest first.
   */
  function passages(dataset, ids, { lineId, limit, select }) {
    const where = [among('idarret', ids), 'depart >= now(minutes=-1)'];
    if (lineId) {
      where.push(`idligne = ${quote(lineId)}`);
    }
    return records(dataset, { where: where.join(' and '), select, order_by: 'depart', limit });
  }

  return {
    requests,
    quota,
    /**
     * @description The bus stops in service.
     * @returns {Promise<object[]>} `{ id, nom, nomcommune }`.
     */
    busStops: () =>
      exportAll(DATASETS.BUS_STOPS, {
        select: 'id,nom,nomcommune',
        where: 'estversionactive = "Oui"',
      }),
    /**
     * @description The metro platforms.
     * @returns {Promise<object[]>} `{ id, nom, nomcommune, idstationparente }`.
     */
    metroStops: () =>
      exportAll(DATASETS.METRO_STOPS, { select: 'id,nom,nomcommune,idstationparente' }),
    /**
     * @description The bus lines in service.
     * @returns {Promise<object[]>} `{ id, nomcourt, nomlong, nomfamillecommerciale, couleurligne }`.
     */
    busLines: () =>
      exportAll(DATASETS.BUS_LINES, {
        select: 'id,nomcourt,nomlong,nomfamillecommerciale,couleurligne',
        where: 'estversionactive = "Oui"',
      }),
    /**
     * @description The metro lines.
     * @returns {Promise<object[]>} Same fields as the bus lines.
     */
    metroLines: () =>
      exportAll(DATASETS.METRO_LINES, {
        select: 'id,nomcourt,nomlong,nomfamillecommerciale,couleurligne',
      }),
    /**
     * @description The lines serving some bus stops.
     * @param {string[]} ids - The stop ids.
     * @returns {Promise<object[]>} `{ idarret, nomcourtligne }`, once each.
     */
    busServices: (ids) =>
      records(DATASETS.BUS_SERVICES, {
        select: 'idarret,nomcourtligne',
        where: among('idarret', ids),
        group_by: 'idarret,nomcourtligne',
        order_by: 'idarret,nomcourtligne',
        limit: MAX_LIMIT,
      }),
    /**
     * @description The destinations announced at some bus stops.
     * @param {string[]} ids - The stop ids.
     * @returns {Promise<object[]>} `{ idarret, nomcourtligne, destination }`, once each.
     */
    busDestinations: (ids) =>
      records(DATASETS.BUS_PASSAGES, {
        select: 'idarret,nomcourtligne,destination',
        where: among('idarret', ids),
        group_by: 'idarret,nomcourtligne,destination',
        order_by: 'idarret,nomcourtligne',
        limit: MAX_LIMIT,
      }),
    /**
     * @description The destinations announced at some metro platforms.
     * @param {string[]} ids - The platform ids.
     * @returns {Promise<object[]>} `{ idarret, nomcourtligne, destination }`, once each.
     */
    metroDestinations: (ids) =>
      records(DATASETS.METRO_PASSAGES, {
        select: 'idarret,nomcourtligne,destination',
        where: among('idarret', ids),
        group_by: 'idarret,nomcourtligne,destination',
        order_by: 'idarret,nomcourtligne',
        limit: MAX_LIMIT,
      }),
    /**
     * @description The next bus passages at some stops.
     * @param {string[]} ids - The stop ids.
     * @param {string} [lineId] - Only this line (its id, "0001").
     * @returns {Promise<object[]>} The records, soonest first.
     */
    busPassages: (ids, lineId) =>
      passages(DATASETS.BUS_PASSAGES, ids, { lineId, limit: 60, select: PASSAGE_FIELDS }),
    /**
     * @description The next metro passages at some platforms.
     * @param {string[]} ids - The platform ids.
     * @param {string} [lineId] - Only this line ("1001").
     * @returns {Promise<object[]>} The records, soonest first.
     */
    metroPassages: (ids, lineId) =>
      passages(DATASETS.METRO_PASSAGES, ids, {
        lineId,
        limit: 30,
        select: METRO_PASSAGE_FIELDS,
      }),
    /**
     * @description The traffic alerts of every line.
     * @returns {Promise<object[]>} The alerts.
     */
    alerts: () => exportAll(DATASETS.ALERTS),
    /**
     * @description The state of the metro lines.
     * @returns {Promise<object[]>} `{ idligne, nomcourt, etat, pannedepuis, finpanneprevue }`.
     */
    metroLineStates: () =>
      records(DATASETS.METRO_LINE_STATES, {
        select: 'idligne,nomcourt,etat,pannedepuis,finpanneprevue,lastupdate',
        limit: 10,
      }),
    /**
     * @description The state of the metro stations.
     * @returns {Promise<object[]>} `{ idstation, nom, etat, idligne }`.
     */
    metroStationStates: () =>
      exportAll(DATASETS.METRO_STATION_STATES, { select: 'idstation,nom,etat,idligne' }),
    /**
     * @description The lifts and escalators out of service.
     * @returns {Promise<object[]>} The equipment records.
     */
    equipmentDown: () =>
      exportAll(DATASETS.METRO_EQUIPMENT, {
        select: 'idequipement,nom,idstation,nomstation,type,typecourt,etat,idligne',
        where: 'typecourt in ("ASC","ESC","PR_ASC") and etat = "Indisponible"',
      }),
  };
}

export { BASE_URL, USER_AGENT, DATASETS, StarError, quote, among, createStarClient };
