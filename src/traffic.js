// -----------------------------------------------------------------------------
// The traffic of the network, read together every 5 minutes:
//   - the alerts of the lines (one record per alert and line, its level as
//     STAR writes it: "Mineure", "Majeure", "Bloquante", a validity window);
//   - the state of the metro lines ("OK" or "En panne", since when, the
//     restart the control centre expects);
//   - the state of the metro stations (open or closed);
//   - the lifts and escalators out of service (metro stations and the lifts
//     of their park-and-rides).
//
// States of a line, named here, from the mildest:
//   `unknown`   nothing read yet;
//   `normal`    no alert under way;
//   `minor`     a minor alert under way;
//   `major`     a major alert under way (STAR files long works as major);
//   `blocking`  a blocking alert under way (a stop moved, a section closed);
//   `stopped`   the metro line is down.
// An alert whose window has not begun is `planned`: shown, never a state.
// The alert texts are in French only: the network has no other language.
// -----------------------------------------------------------------------------

import { fold } from './network.js';

const STATES = ['unknown', 'normal', 'planned', 'minor', 'major', 'blocking', 'stopped'];
const SERIOUS = ['major', 'blocking', 'stopped'];
const LEVELS = { mineure: 'minor', majeure: 'major', bloquante: 'blocking' };
const EQUIPMENT_KINDS = { ASC: 'elevator', ESC: 'escalator', PR_ASC: 'parking_elevator' };
const TEXT_MAX = 2000;

/**
 * @description The first value of a field the portal gives as a text or a list.
 * @param {unknown} value - "Majeure" or ["Majeure"].
 * @returns {string} The text.
 */
const single = (value) => String((Array.isArray(value) ? value[0] : value) ?? '');

/**
 * @description An instant of the datasets.
 * @param {unknown} value - An ISO date, or nothing.
 * @returns {number|null} Milliseconds, null when absent.
 */
function instant(value) {
  const ms = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(ms) ? ms : null;
}

/**
 * @description A text of STAR, cleaned: lines trimmed, blank lines dropped.
 * @param {unknown} value - The text.
 * @param {number} max - Its longest length.
 * @returns {string} The text.
 */
function cleanText(value, max) {
  return String(value ?? '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.replace(/[ \t\u00a0]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, max);
}

/**
 * @description What is kept of an alert.
 * @param {object} raw - A record of the alerts dataset.
 * @returns {object} `{ id, event, lineId, line, level, title, text, url, start, end }`.
 */
function alertOf(raw) {
  const id = String(raw.idperturbation ?? '');
  return {
    id,
    // One alert covering several lines is one record per line, its id ending
    // with the line id: the shared part groups them.
    event: /^[0-9a-f-]{36}/i.test(id) ? id.slice(0, 36) : id,
    lineId: String(raw.idligne ?? ''),
    line: String(raw.nomcourtligne ?? ''),
    level: LEVELS[fold(single(raw.niveau))] ?? 'minor',
    title: cleanText(raw.titre, 200).replace(/\n/g, ' '),
    text: cleanText(raw.description, TEXT_MAX),
    url: typeof raw.url === 'string' && /^https:\/\//.test(raw.url) ? raw.url : '',
    start: instant(raw.debutvalidite),
    end: instant(raw.finvalidite),
  };
}

/**
 * @description Read the four answers.
 * @param {object} answers - `{ alerts, lineStates, stations, equipment }`.
 * @returns {object} `{ alerts, metro, stations, equipment }`: the alerts, the
 * state of each metro line by id, the stations, the equipment out of service.
 */
function parseTraffic({ alerts = [], lineStates = [], stations = [], equipment = [] } = {}) {
  const list = (value) => (Array.isArray(value) ? value : []);
  return {
    alerts: list(alerts)
      .map(alertOf)
      .filter((alert) => alert.id && alert.lineId),
    metro: Object.fromEntries(
      list(lineStates).map((raw) => [
        String(raw.idligne),
        {
          name: String(raw.nomcourt ?? ''),
          running: fold(raw.etat) !== 'en panne',
          since: instant(raw.pannedepuis),
          until: instant(raw.finpanneprevue),
        },
      ]),
    ),
    stations: list(stations).map((raw) => ({
      id: String(raw.idstation ?? ''),
      name: String(raw.nom ?? ''),
      open: fold(single(raw.etat)) !== 'fermee',
      lineId: String(raw.idligne ?? ''),
    })),
    equipment: list(equipment)
      .filter((raw) => fold(single(raw.etat)) === 'indisponible' && EQUIPMENT_KINDS[raw.typecourt])
      .map((raw) => ({
        id: String(raw.idequipement),
        name: cleanText(raw.nom, 120).replace(/\n/g, ' '),
        stationId: String(raw.idstation ?? ''),
        station: String(raw.nomstation ?? ''),
        kind: EQUIPMENT_KINDS[raw.typecourt],
        lineId: String(raw.idligne ?? ''),
      })),
  };
}

/**
 * @description The rank of a state, for comparisons.
 * @param {string} state - A state.
 * @returns {number} Its position in STATES.
 */
const rank = (state) => STATES.indexOf(state);

/**
 * @description The traffic of one line.
 * @param {object|null} traffic - parseTraffic().
 * @param {string} lineId - The line id.
 * @param {number} now - Now (ms).
 * @returns {{ state: string, messages: object[], metro: object|null }} Its
 * state, its alerts not over (each with its `state`: `planned` or its level),
 * the most serious first, and the state of a metro line.
 */
function lineTraffic(traffic, lineId, now) {
  if (!traffic) {
    return { state: 'unknown', messages: [], metro: null };
  }
  const messages = traffic.alerts
    .filter((alert) => alert.lineId === lineId && (alert.end === null || alert.end > now))
    .map((alert) => ({
      ...alert,
      state: alert.start !== null && alert.start > now ? 'planned' : alert.level,
    }))
    .sort((a, b) => rank(b.state) - rank(a.state) || (a.start ?? 0) - (b.start ?? 0));
  const metro = traffic.metro[lineId] ?? null;
  let state = 'normal';
  for (const message of messages) {
    if (message.state !== 'planned' && rank(message.state) > rank(state)) {
      state = message.state;
    }
  }
  if (metro && !metro.running) {
    state = 'stopped';
  }
  return { state, messages, metro };
}

/**
 * @description The alerts of a line about a disruption under way.
 * @param {{ messages: object[] }} line - lineTraffic().
 * @returns {object[]} The alerts.
 */
const seriousMessages = (line) => line.messages.filter((m) => SERIOUS.includes(m.state));

export {
  STATES,
  SERIOUS,
  LEVELS,
  EQUIPMENT_KINDS,
  cleanText,
  alertOf,
  parseTraffic,
  lineTraffic,
  seriousMessages,
};
