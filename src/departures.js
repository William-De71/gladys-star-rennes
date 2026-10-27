// -----------------------------------------------------------------------------
// The records of the passages datasets -> the passages of a followed stop.
//
// Each record is one vehicle at one stop: its line, direction (`sens`),
// destination and departure time (`depart`, an instant in UTC). The bus
// records also give the timetable time (`departtheorique`), hence the delay,
// and `precision`:
//   - "Temps réel"   the bus is located: the time is its real-time estimate;
//   - "Applicable"   the bus is not located yet: the time is the timetable
//                    (said "timetable" in every text, shown in grey).
// The metro runs on its timetable, adjusted by the control centre: its times
// count as real time.
// Passages towards the stop itself (the vehicle ends its trip there) are left
// out: nobody boards them.
// -----------------------------------------------------------------------------

import { fold, MODES } from './network.js';

const REAL_TIME = 'temps reel';
// Beyond this, a gap between the expected and the timetable time is not a
// delay but another trip (the datasets never pair them so far apart).
const MAX_DELAY_MIN = 120;

/**
 * @description Split a typed direction into the words to look for.
 * @param {string} direction - "Saint-Grégoire | Chantepie".
 * @returns {string[]} The folded alternatives.
 * @example
 * directionTerms('Saint-Grégoire | Chantepie'); // -> ['saint gregoire', 'chantepie']
 */
function directionTerms(direction) {
  return String(direction ?? '')
    .split('|')
    .map(fold)
    .filter(Boolean);
}

/**
 * @description The first value of a field the portal gives as a text or a list.
 * @param {unknown} value - "Temps réel" or ["Temps réel"].
 * @returns {string} The text.
 */
const single = (value) => String((Array.isArray(value) ? value[0] : value) ?? '');

/**
 * @description An instant of the datasets.
 * @param {unknown} value - "2026-10-27T08:10:06+00:00".
 * @returns {number|null} Milliseconds, null when absent or invalid.
 */
function instant(value) {
  const ms = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(ms) ? ms : null;
}

/**
 * @description One passage.
 * @param {object} raw - A record.
 * @param {string} mode - MODES.
 * @returns {object} The passage.
 */
function passageOf(raw, mode) {
  const at = instant(raw.depart);
  const scheduled = mode === MODES.BUS ? instant(raw.departtheorique) : null;
  const realTime = fold(single(raw.precision)) === REAL_TIME;
  const gap = at !== null && scheduled !== null ? Math.round((at - scheduled) / 60000) : null;
  return {
    stopId: String(raw.idarret ?? ''),
    lineId: String(raw.idligne ?? ''),
    line: String(raw.nomcourtligne ?? raw.idligne ?? ''),
    mode,
    direction: Number(raw.sens) || 0,
    destination: String(raw.destination ?? '').trim(),
    at,
    scheduled,
    // Late only: an early bus waits at the stop, the screens show no advance.
    delay: realTime && gap !== null && Math.abs(gap) <= MAX_DELAY_MIN ? Math.max(0, gap) : null,
    reliable: mode === MODES.METRO || realTime,
  };
}

/**
 * @description The passages of a followed stop, soonest first.
 * @param {object} answers - `{ bus, metro }`: the records read, `[]` when
 * the stop has no bus stop or no platform.
 * @param {object} filter - `{ stopName, lineId, direction }`.
 * @returns {object[]} The passages.
 */
function parsePassages(
  { bus = [], metro = [] } = {},
  { stopName = '', lineId = '', direction = '' } = {},
) {
  const terms = directionTerms(direction);
  const here = fold(stopName);
  return [
    ...(Array.isArray(bus) ? bus : []).map((raw) => passageOf(raw, MODES.BUS)),
    ...(Array.isArray(metro) ? metro : []).map((raw) => passageOf(raw, MODES.METRO)),
  ]
    .filter((passage) => passage.at !== null)
    .filter((passage) => !lineId || passage.lineId === lineId)
    .filter((passage) => !here || fold(passage.destination) !== here)
    .filter((passage) => {
      if (terms.length === 0) {
        return true;
      }
      const target = fold(passage.destination);
      return terms.some((term) => target.includes(term));
    })
    .sort((a, b) => a.at - b.at);
}

/**
 * @description The minutes left before a passage.
 * @param {object} passage - The passage.
 * @param {number} now - Now (ms).
 * @returns {number} Whole minutes (rounded down, like the screens).
 */
function minutesLeft(passage, now) {
  return Math.max(0, Math.floor((passage.at - now) / 60000));
}

/**
 * @description The passages not gone yet.
 * @param {object[]} passages - The passages.
 * @param {number} now - Now (ms).
 * @returns {object[]} The passages to come.
 */
const upcomingPassages = (passages, now) => passages.filter((passage) => passage.at > now - 30000);

/**
 * @description Who a passage is, across readings: line, direction and
 * destination.
 * @param {object} passage - The passage.
 * @returns {string} "0001|1|saint gregoire".
 */
const routeOf = (passage) => `${passage.lineId}|${passage.direction}|${fold(passage.destination)}`;

export {
  MAX_DELAY_MIN,
  directionTerms,
  passageOf,
  parsePassages,
  minutesLeft,
  upcomingPassages,
  routeOf,
};
