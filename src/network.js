// -----------------------------------------------------------------------------
// The reference data of the network: lines and stops, kept in /data.
//
//   - lines (bus and metro): read again once a day, after 04:00. A line is
//     typed the way the user reads it: "C1", "11", "a", "métro b", "ligne C4";
//     it resolves to its id ("0001", "1001"), the one the real-time datasets
//     use;
//   - stops (bus stops and metro platforms): read again every seven days. A
//     stop is typed by name ("République", "gares") — every stop of that
//     name: both sides of the street, the bus stops and the metro platforms
//     — or by id ("1168", one side or one direction only), given by the
//     "Find a stop" button. A name typed with other words resolves when one
//     name only holds them all ("kennedy" -> "J.F. Kennedy").
//
// Names are compared folded: no case, no accent, no punctuation.
// -----------------------------------------------------------------------------

const LINES_MAX_AGE_MS = 24 * 3600 * 1000;
const STOPS_MAX_AGE_MS = 7 * 24 * 3600 * 1000;
const MODES = { BUS: 'bus', METRO: 'metro' };

/**
 * @description Fold a text for comparisons.
 * @param {unknown} value - The text.
 * @returns {string} Lower case, no accent, words separated by one space.
 * @example
 * fold('Saint-Jacques - Gaîté'); // -> 'saint jacques gaite'
 */
function fold(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * @description A slug for an external id.
 * @param {unknown} value - The text.
 * @param {number} [max] - Its longest length.
 * @returns {string} "saint-jacques-gaite".
 */
function slug(value, max = 40) {
  return fold(value).replace(/ /g, '-').slice(0, max).replace(/-$/, '');
}

/**
 * @description What is kept of a line.
 * @param {object} raw - A record of the lines datasets.
 * @param {string} mode - MODES.
 * @returns {object} `{ id, name, label, mode, family, color }`.
 */
const lineOf = (raw, mode) => ({
  id: String(raw.id),
  name: String(raw.nomcourt ?? raw.id),
  label: String(raw.nomlong ?? ''),
  mode,
  family: String(raw.nomfamillecommerciale ?? ''),
  color: /^#[0-9a-f]{6}$/i.test(raw.couleurligne ?? '') ? raw.couleurligne : '',
});

/**
 * @description What is kept of a stop.
 * @param {object} raw - A record of the stops datasets.
 * @param {string} mode - MODES.
 * @returns {object} `{ id, name, commune, mode, station }`.
 */
const stopOf = (raw, mode) => ({
  id: String(raw.id),
  name: String(raw.nom ?? raw.id).trim(),
  commune: String(raw.nomcommune ?? ''),
  mode,
  station: raw.idstationparente ? String(raw.idstationparente) : null,
});

/**
 * @description Find a line among the known ones.
 * @param {object[]} lines - The known lines.
 * @param {string} typed - "C1", "c1", "a", "métro A", "ligne 11", "0001".
 * @returns {object|null} The line.
 * @example
 * findLine(lines, 'metro a'); // -> { id: '1001', name: 'a', … }
 */
function findLine(lines, typed) {
  const compact = (value) => fold(value).replace(/ /g, '');
  const wanted = compact(String(typed ?? '').replace(/^\s*(ligne|line|linie|l[ií]nea)\s+/i, ''));
  if (!wanted) {
    return null;
  }
  const bare = wanted.replace(/^metro/, '');
  return (
    lines.find((line) => compact(line.name) === wanted) ??
    lines.find((line) => line.mode === MODES.METRO && compact(line.name) === bare) ??
    lines.find((line) => line.id.toLowerCase() === wanted) ??
    null
  );
}

/**
 * @description A stop resolved: what the passages are read for.
 * @param {string} kind - `place` (every stop of the name) or `stop` (one id).
 * @param {object[]} members - The known stops it covers.
 * @returns {object} `{ kind, id, name, busIds, metroIds }`.
 */
function resolved(kind, members) {
  const ids = (mode) => members.filter((stop) => stop.mode === mode).map((stop) => stop.id);
  return {
    kind,
    id: kind === 'stop' ? members[0].id : null,
    name: members[0].name,
    busIds: ids(MODES.BUS),
    metroIds: ids(MODES.METRO),
  };
}

/**
 * @description Find a stop among the known ones.
 * @param {object[]} stops - The known stops.
 * @param {string} typed - A name or an id.
 * @returns {object|null} `{ kind, id, name, busIds, metroIds }`.
 * @example
 * findStop(stops, 'republique'); // -> { kind: 'place', name: 'République', busIds: [...], metroIds: [...] }
 */
function findStop(stops, typed) {
  const raw = String(typed ?? '').trim();
  if (!raw) {
    return null;
  }
  const byId = stops.find((stop) => stop.id.toLowerCase() === raw.toLowerCase());
  if (byId) {
    return resolved('stop', [byId]);
  }
  const wanted = fold(raw);
  const exact = stops.filter((stop) => fold(stop.name) === wanted);
  if (exact.length > 0) {
    return resolved('place', exact);
  }
  // A unique name holding every typed word ("kennedy" -> "J.F. Kennedy").
  const words = wanted.split(' ');
  const matching = stops.filter((stop) => {
    const name = ` ${fold(stop.name)} `;
    return words.every((word) => name.includes(` ${word}`));
  });
  const names = new Set(matching.map((stop) => fold(stop.name)));
  return names.size === 1 ? resolved('place', matching) : null;
}

/**
 * @description Search stops by name, for the "Find a stop" button.
 * @param {object[]} stops - The known stops.
 * @param {string} query - Words of the name.
 * @param {number} [max] - The most names returned.
 * @returns {Array<{ name: string, stops: object[] }>} The names, exact ones
 * first, with their stops (bus stops first).
 */
function searchStops(stops, query, max = 6) {
  const words = fold(query).split(' ').filter(Boolean);
  if (words.length === 0) {
    return [];
  }
  const byName = new Map();
  for (const stop of stops) {
    const name = ` ${fold(stop.name)} `;
    if (words.every((word) => name.includes(word))) {
      const key = fold(stop.name);
      const entry = byName.get(key) ?? { name: stop.name, stops: [] };
      entry.stops.push(stop);
      byName.set(key, entry);
    }
  }
  const wanted = words.join(' ');
  return [...byName.values()]
    .sort((a, b) => {
      const rank = (entry) =>
        fold(entry.name) === wanted ? 0 : fold(entry.name).startsWith(wanted) ? 1 : 2;
      return rank(a) - rank(b) || a.name.localeCompare(b.name, 'fr');
    })
    .slice(0, max)
    .map((entry) => ({
      ...entry,
      stops: entry.stops.sort(
        (a, b) => a.mode.localeCompare(b.mode) || a.id.localeCompare(b.id, 'en', { numeric: true }),
      ),
    }));
}

/**
 * @description The reference data, read through the API and kept in the store.
 * @param {object} options - Options.
 * @param {object} options.api - The STAR client.
 * @param {object} options.store - The store (`data.network`).
 * @param {Function} options.now - `() => number` in ms.
 * @param {Function} options.isNewDay - `(readAt) => boolean`: a 04:00 passed since.
 * @param {object} [options.logger] - Logger.
 * @returns {object} The network.
 */
function createNetwork({ api, store, now, isNewDay, logger }) {
  const data = () => {
    if (!store.data.network || typeof store.data.network !== 'object') {
      store.data.network = { lines: null, linesAt: 0, stops: null, stopsAt: 0 };
    }
    return store.data.network;
  };

  /**
   * @description Read a part of the network again when stale. A failed
   * reading keeps what is known.
   * @param {string} name - `lines` or `stops`.
   * @param {boolean} stale - Whether it must be read.
   * @param {Function} read - `() => Promise<object[]>`.
   * @returns {Promise<object[]>} The part.
   */
  async function refresh(name, stale, read) {
    const kept = data();
    if (!stale) {
      return kept[name];
    }
    try {
      kept[name] = await read();
      kept[`${name}At`] = now();
      await store.save();
    } catch (err) {
      if (!kept[name]) {
        throw err;
      }
      logger?.warn(`STAR ${name} not read again (${err.kind ?? 'error'}): ${err.message}`);
    }
    return kept[name];
  }

  /**
   * @description The lines, bus then metro, read again daily.
   * @param {boolean} [force] - Read even when fresh.
   * @returns {Promise<object[]>} The lines.
   */
  function lines(force = false) {
    const kept = data();
    const fresh = kept.lines && now() - kept.linesAt < LINES_MAX_AGE_MS && !isNewDay(kept.linesAt);
    return refresh('lines', force || !fresh, async () => {
      const [bus, metro] = await Promise.all([api.busLines(), api.metroLines()]);
      return [
        ...metro.map((raw) => lineOf(raw, MODES.METRO)),
        ...bus.map((raw) => lineOf(raw, MODES.BUS)),
      ];
    });
  }

  /**
   * @description The stops, bus stops and metro platforms, read again weekly.
   * @param {boolean} [force] - Read even when fresh.
   * @returns {Promise<object[]>} The stops.
   */
  function stops(force = false) {
    const kept = data();
    const fresh = kept.stops && now() - kept.stopsAt < STOPS_MAX_AGE_MS;
    return refresh('stops', force || !fresh, async () => {
      const [bus, metro] = await Promise.all([api.busStops(), api.metroStops()]);
      return [
        ...bus.map((raw) => stopOf(raw, MODES.BUS)),
        ...metro.map((raw) => stopOf(raw, MODES.METRO)),
      ];
    });
  }

  return {
    lines,
    stops,
    /**
     * @description A line known without reading anything.
     * @param {string} id - The line id.
     * @returns {object|null} The line.
     */
    peekLine: (id) => data().lines?.find((line) => line.id === String(id)) ?? null,
    /**
     * @description Resolve a typed line.
     * @param {string} typed - The line as typed.
     * @returns {Promise<object|null>} The line, null when unknown.
     */
    resolveLine: async (typed) => findLine(await lines(), typed),
    /**
     * @description Resolve a typed stop.
     * @param {string} typed - A name or an id.
     * @returns {Promise<object|null>} `{ kind, id, name, busIds, metroIds }`.
     */
    resolveStop: async (typed) => findStop(await stops(), typed),
    /**
     * @description Search stops by name.
     * @param {string} query - Words of the name.
     * @returns {Promise<object[]>} `[{ name, stops }]`.
     */
    searchStops: async (query) => searchStops(await stops(), query),
  };
}

export {
  LINES_MAX_AGE_MS,
  STOPS_MAX_AGE_MS,
  MODES,
  fold,
  slug,
  lineOf,
  stopOf,
  findLine,
  findStop,
  searchStops,
  createNetwork,
};
