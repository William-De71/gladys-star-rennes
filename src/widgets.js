// -----------------------------------------------------------------------------
// Dashboard widgets of the STAR integration.
//
//   - `departures`  the next passages of a stop, like the screens of the
//                   stops, compact: one row per line and destination, its
//                   next passages on one line — 1 · 9 · 27 min, 10:32 —,
//                   timetable times in grey. A followed stop (chosen among
//                   the devices), several (the devices of one stop merged, a
//                   row per stop otherwise), or any stop typed in the widget
//                   settings (with an optional line);
//   - `traffic`     the state of lines — normal, minor, major, blocking,
//                   metro down — then their alerts; a tap opens the full
//                   text. The followed lines, or the ones typed in the
//                   settings;
//   - `metro`       the two metro lines (running or down, the restart
//                   expected), the closed stations, then a row per lift or
//                   escalator out of service.
// Every content credits STAR and the time of the reading (ODbL licence).
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { t, lineStateText, passageShort, equipmentKindText } from './i18n.js';
import { minutesLeft, routeOf, upcomingPassages } from './departures.js';
import { STATES } from './traffic.js';
import { formatTime } from './time.js';

const WIDGETS = {
  DEPARTURES: 'departures',
  TRAFFIC: 'traffic',
  METRO: 'metro',
};

const TTL_SECONDS = {
  departures: 60,
  idle: 300,
  traffic: 180,
  message: 300,
};

const BOARD_COUNT = { min: 1, max: 8, default: 6 };
// Characters a status row holds on one line in a dashboard column: beyond,
// the core cuts the value. A route then drops its last passages.
const ROW_CHARACTERS = 46;
const MAX_LIST_ITEMS = 8;
const MAX_STATUS_ITEMS = 10;
const STATE_COLORS = {
  unknown: WIDGET_COLORS.NEUTRAL,
  normal: WIDGET_COLORS.SUCCESS,
  planned: WIDGET_COLORS.INFO,
  minor: WIDGET_COLORS.INFO,
  major: WIDGET_COLORS.WARNING,
  blocking: WIDGET_COLORS.DANGER,
  stopped: WIDGET_COLORS.DANGER,
};
const EQUIPMENT_KINDS = ['elevator', 'escalator', 'parking_elevator'];

/**
 * @description Truncate a text to a bound, with an ellipsis.
 * @param {string} value - The text.
 * @param {number} max - The bound.
 * @returns {string} The text.
 * @example
 * clip('Joliot-Curie - Chateaubriand', 12); // -> 'Joliot-Curi…'
 */
function clip(value, max) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * @description Read a bounded integer setting.
 * @param {unknown} raw - The raw setting.
 * @param {{ min: number, max: number, default: number }} bounds - The bounds.
 * @returns {number} The value.
 */
function readCount(raw, bounds) {
  const value = Number(raw);
  if (raw === undefined || raw === null || raw === '' || !Number.isFinite(value)) {
    return bounds.default;
  }
  return Math.min(bounds.max, Math.max(bounds.min, Math.round(value)));
}

/**
 * @description Read the kinds of equipment a widget shows.
 * @param {unknown} raw - The `multi_select` value.
 * @returns {string[]} The kinds, all of them when none is ticked.
 */
function readKinds(raw) {
  const kinds = (Array.isArray(raw) ? raw : []).filter((kind) => EQUIPMENT_KINDS.includes(kind));
  return kinds.length > 0 ? kinds : EQUIPMENT_KINDS;
}

/**
 * @description A widget content made of one message.
 * @param {string} message - The message.
 * @param {number} [ttl] - Its freshness.
 * @returns {object} The content.
 */
function messageContent(message, ttl = TTL_SECONDS.message) {
  return { ttl_seconds: ttl, components: [{ type: 'text', variant: 'body', text: message }] };
}

/**
 * @description The rows of the "departures" widget: one per line and
 * destination, its next passages on one line, soonest route first.
 * @param {object[]} passages - The passages to come, soonest first.
 * @returns {object[][]} The passages of each route.
 */
function routesOf(passages) {
  const byRoute = new Map();
  for (const passage of passages) {
    const route = routeOf(passage);
    byRoute.set(route, [...(byRoute.get(route) ?? []), passage]);
  }
  return [...byRoute.values()];
}

/**
 * @description The times of one route, as on the screens of the stops, on one
 * line: "1 · 9 · 27 min", "10:32 · 10:47". In a route mixing located buses
 * and timetable times, the timetable ones carry a star.
 * @param {object[]} passages - The passages of the route.
 * @param {object} options - `{ language, now, timeZone }`.
 * @returns {{ value: string, starred: boolean }} The value of the row.
 */
function routeValue(passages, options) {
  const timetable = passages.filter((passage) => !passage.reliable);
  const mixed = timetable.length > 0 && timetable.length < passages.length;
  const star = (passage) => (mixed && !passage.reliable ? '*' : '');
  // A run of waits shares its unit: "10 · 33 min · 11:29".
  const parts = [];
  let run = [];
  const flush = () => {
    if (run.length) {
      parts.push(`${run.join(' · ')} ${t('minutesShort', options.language)}`);
      run = [];
    }
  };
  for (const passage of passages) {
    const minutes = minutesLeft(passage, options.now);
    if (minutes > 0 && minutes < 60) {
      run.push(`${minutes}${star(passage)}`);
      continue;
    }
    flush();
    parts.push(`${passageShort(passage, options)}${star(passage)}`);
  }
  flush();
  let value = parts.join(' · ');
  // Said when no bus of the route is located.
  if (timetable.length > 0 && !mixed) {
    value = `${value} · ${t('timetableShort', options.language)}`;
  }
  return { value: clip(value, 40), starred: mixed };
}

/**
 * @description The rows of one stop: one compact row per line and
 * destination, soonest first, each row cut to one line.
 * @param {object[]} upcoming - The passages to come.
 * @param {number} count - How many routes (rows).
 * @param {object} options - `{ language, now, timeZone }`.
 * @returns {{ items: object[], starred: boolean }} The rows.
 */
function boardRows(upcoming, count, options) {
  let starred = false;
  const items = routesOf(upcoming)
    .slice(0, count)
    .map((route) => {
      const [next] = route;
      const label = clip(next.destination ? `${next.line} → ${next.destination}` : next.line, 40);
      let shown = route;
      let row = routeValue(shown, options);
      while (shown.length > 1 && label.length + row.value.length > ROW_CHARACTERS) {
        shown = shown.slice(0, -1);
        row = routeValue(shown, options);
      }
      starred = starred || row.starred;
      return {
        label,
        value: row.value,
        color: next.reliable ? WIDGET_COLORS.SUCCESS : WIDGET_COLORS.NEUTRAL,
      };
    });
  return { items, starred };
}

/**
 * @description The "departures" widget: the stop, then one compact row per
 * line and destination, like the screens of the stops. With several stops
 * (`boards`), still one heading and one list (the content budget of the core
 * allows one status list and two texts): each stop opens with a row of its
 * own — its name and the time of its reading —, then its routes.
 * @param {object} options - Options.
 * @param {string} [options.title] - The name of the stop.
 * @param {object[]} [options.passages] - Its passages.
 * @param {number} [options.readAt] - When they were read (ms).
 * @param {object[]} [options.boards] - Several stops instead:
 * `[{ title, label, passages, readAt }]`, `label` the short name of the stop.
 * @param {number} options.count - How many routes (rows) to show per stop.
 * @param {string} options.language - The user language.
 * @param {number} options.now - Now (ms).
 * @param {string} [options.timeZone] - IANA timezone.
 * @returns {object} The content.
 */
function buildDeparturesWidget({
  title,
  passages,
  readAt,
  boards = [{ title, passages, readAt }],
  count,
  language,
  now,
  timeZone,
}) {
  const options = { language, now, timeZone };
  // A stop takes a row of its own and at least one route.
  const shown = boards.slice(0, Math.floor(MAX_STATUS_ITEMS / 2));
  const several = shown.length > 1;
  const nameOf = (board) => board.label ?? board.title;
  const headingText = several ? [...new Set(shown.map(nameOf))].join(' · ') : shown[0].title;
  const heading = { type: 'text', variant: 'heading', text: clip(headingText, 40) };
  // The oldest reading: the widget never claims fresher data than it shows.
  const oldest = Math.min(...shown.map((board) => board.readAt));
  const updated = t('updatedAt', language, { time: formatTime(oldest, timeZone) });
  const upcomingOf = (board) => upcomingPassages(board.passages, now);
  if (shown.every((board) => upcomingOf(board).length === 0)) {
    return {
      ttl_seconds: TTL_SECONDS.idle,
      components: [
        heading,
        { type: 'text', variant: 'body', text: `${t('noPassage', language)}. ${updated}.` },
      ],
    };
  }
  // The routes of each stop share what the stop rows leave of the list.
  const perStop = several
    ? Math.max(1, Math.min(count, Math.floor((MAX_STATUS_ITEMS - shown.length) / shown.length)))
    : Math.min(count, MAX_STATUS_ITEMS);
  let starred = false;
  const items = [];
  for (const board of shown) {
    const upcoming = upcomingOf(board);
    if (several) {
      items.push({
        icon: 'map-pin',
        label: clip(nameOf(board), 40),
        value: clip(
          upcoming.length
            ? t('readAt', language, { time: formatTime(board.readAt, timeZone) })
            : t('noPassage', language),
          40,
        ),
        color: WIDGET_COLORS.NEUTRAL,
      });
    }
    const rows = boardRows(upcoming, perStop, options);
    starred = starred || rows.starred;
    items.push(...rows.items);
  }
  // With several stops, each stop row carries its own reading time.
  const credit = several ? 'STAR' : updated;
  const caption = starred ? `${credit} · * ${t('timetableShort', language)}` : credit;
  return {
    ttl_seconds: TTL_SECONDS.departures,
    components: [
      heading,
      { type: 'text', variant: 'caption', text: clip(caption, 80) },
      { type: 'status', items },
    ],
  };
}

/**
 * @description The "traffic" widget.
 * @param {object} options - Options.
 * @param {Array<{ line: object, traffic: object }>} options.lines - The lines and their traffic.
 * @param {number|null} options.readAt - When the traffic was read.
 * @param {string} options.language - The user language.
 * @param {string} [options.timeZone] - IANA timezone.
 * @returns {object} The content.
 */
function buildTrafficWidget({ lines, readAt, language, timeZone }) {
  const components = [
    { type: 'text', variant: 'heading', text: t('trafficTitle', language) },
    {
      type: 'status',
      items: lines.slice(0, MAX_STATUS_ITEMS).map(({ line, traffic }) => ({
        label: clip(
          t(line.mode === 'metro' ? 'metroLineLabel' : 'busLineLabel', language, {
            line: line.name,
          }),
          40,
        ),
        value: clip(lineStateText(traffic.state, language), 40),
        color: STATE_COLORS[traffic.state] ?? WIDGET_COLORS.NEUTRAL,
      })),
    },
  ];
  // One card per alert, even when it covers several of the lines (one record
  // per line for STAR).
  const grouped = new Map();
  for (const { line, traffic } of lines) {
    for (const message of traffic.messages) {
      const entry = grouped.get(message.event) ?? { message, names: [] };
      if (STATES.indexOf(message.state) > STATES.indexOf(entry.message.state)) {
        entry.message = message;
      }
      if (!entry.names.includes(line.name)) {
        entry.names.push(line.name);
      }
      grouped.set(message.event, entry);
    }
  }
  const items = [...grouped.values()].sort(
    (a, b) => STATES.indexOf(b.message.state) - STATES.indexOf(a.message.state),
  );
  if (items.length > 0) {
    components.push({
      type: 'card-list',
      display: 'list',
      items: items.slice(0, MAX_LIST_ITEMS).map(({ message, names }) => {
        const until = message.end
          ? t(message.state === 'planned' ? 'fromDate' : 'untilDate', language, {
              date: shortDate(message.state === 'planned' ? message.start : message.end, timeZone),
            })
          : '';
        const item = {
          title: clip(message.title || names.join(', '), 60),
          subtitle: clip(
            [lineStateText(message.state, language), until].filter(Boolean).join(' · '),
            60,
          ),
          badge: {
            text: clip(names.join(' · '), 16),
            color: STATE_COLORS[message.state] ?? WIDGET_COLORS.NEUTRAL,
          },
        };
        if (message.text) {
          item.description = clip(message.text, 2000);
        }
        if (/^https:\/\//.test(message.url) && message.url.length <= 2048) {
          item.links = [{ url: message.url, label: clip(t('moreInfo', language), 24) }];
        }
        return item;
      }),
    });
  }
  // Two texts at most: without an alert, the body carries the update time.
  const updated = readAt ? t('updatedAt', language, { time: formatTime(readAt, timeZone) }) : '';
  if (items.length === 0) {
    components.push({
      type: 'text',
      variant: 'body',
      text: [t('noMessage', language), updated && `${updated}.`].filter(Boolean).join(' '),
    });
  } else if (updated) {
    components.push({ type: 'text', variant: 'caption', text: updated });
  }
  return { ttl_seconds: TTL_SECONDS.traffic, components };
}

/**
 * @description "31/10", the day of an instant in the timezone of the instance.
 * @param {number|null} instant - The instant (ms).
 * @param {string} [timeZone] - IANA timezone.
 * @returns {string} The day and month, '' when none.
 */
function shortDate(instant, timeZone) {
  if (!Number.isFinite(instant)) {
    return '';
  }
  return new Intl.DateTimeFormat('fr-FR', { timeZone, day: '2-digit', month: '2-digit' }).format(
    new Date(instant),
  );
}

/**
 * @description The "metro" widget.
 * @param {object} options - Options.
 * @param {object[]} options.lines - The metro lines (`id`, `name`).
 * @param {object} options.traffic - parseTraffic().
 * @param {number} options.readAt - When it was read.
 * @param {string[]} options.kinds - The kinds of equipment shown.
 * @param {string} options.language - The user language.
 * @param {string} [options.timeZone] - IANA timezone.
 * @returns {object} The content.
 */
function buildMetroWidget({ lines, traffic, readAt, kinds, language, timeZone }) {
  const items = lines.map((line) => {
    const state = traffic.metro[line.id];
    if (!state) {
      return {
        label: t('metroLineLabel', language, { line: line.name }),
        value: lineStateText('unknown', language),
        color: WIDGET_COLORS.NEUTRAL,
      };
    }
    let value = t(state.running ? 'metroRunning' : 'metroStopped', language);
    if (!state.running && state.until) {
      value = `${value} · ${t('restartAt', language, { time: formatTime(state.until, timeZone) })}`;
    }
    return {
      label: t('metroLineLabel', language, { line: line.name }),
      value: clip(value, 40),
      color: state.running ? WIDGET_COLORS.SUCCESS : WIDGET_COLORS.DANGER,
    };
  });
  const closed = traffic.stations.filter((station) => !station.open);
  if (closed.length > 0) {
    items.push({
      label: t('closedStations', language),
      value: clip(closed.map((station) => station.name).join(', '), 40),
      color: WIDGET_COLORS.WARNING,
    });
  }
  const down = traffic.equipment
    .filter((item) => kinds.includes(item.kind))
    .sort((a, b) => a.station.localeCompare(b.station, 'fr') || a.name.localeCompare(b.name, 'fr'));
  // The lines first, then one compact row per equipment out of service, in
  // the same list: the core allows one main component, and a card per lift
  // would push the state of the lines out of sight.
  const room = MAX_STATUS_ITEMS - items.length;
  const shown = down.length > room ? down.slice(0, room - 1) : down;
  for (const item of shown) {
    items.push({
      label: clip(item.station, 40),
      value: clip(equipmentKindText(item.kind, language), 40),
      color: WIDGET_COLORS.WARNING,
    });
  }
  const updated = t('updatedAt', language, { time: formatTime(readAt, timeZone) });
  const summary =
    down.length === 0
      ? `${t('equipmentAllWorking', language)} ${updated}.`
      : [
          t('equipmentDownCount', language, { n: down.length }),
          shown.length < down.length
            ? t('andMore', language, { n: down.length - shown.length })
            : '',
          updated,
        ]
          .filter(Boolean)
          .join(' · ');
  return {
    ttl_seconds: TTL_SECONDS.traffic,
    components: [
      { type: 'text', variant: 'heading', text: t('metroTitle', language) },
      { type: 'text', variant: down.length ? 'caption' : 'body', text: clip(summary, 120) },
      { type: 'status', items },
    ],
  };
}

export {
  WIDGETS,
  TTL_SECONDS,
  BOARD_COUNT,
  STATE_COLORS,
  EQUIPMENT_KINDS,
  clip,
  messageContent,
  readCount,
  readKinds,
  routeValue,
  shortDate,
  buildDeparturesWidget,
  buildTrafficWidget,
  buildMetroWidget,
};
