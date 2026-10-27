// -----------------------------------------------------------------------------
// Scene triggers (pure logic) and scene action outputs.
//
// Triggers (one event per transition, never a periodic snapshot):
//   - `departure_soon`              a bus or metro of a followed stop leaves
//                                   in N minutes (2, 3, 5, 10, 15 or 20):
//                                   checked on each reading and every 30
//                                   seconds on the last one, fired close to
//                                   the mark, once per passage. A passage is
//                                   matched by line, direction, destination
//                                   and time (± 2 min);
//   - `line_disrupted`              a followed line gets a major or blocking
//                                   alert under way, or its metro goes down
//                                   (or it goes from one to a worse one);
//   - `line_restored`               it runs normally again;
//   - `traffic_message`             STAR publishes a new alert about a
//                                   followed line (planned or under way);
//   - `equipment_out_of_service`    a lift or an escalator of a metro station
//                                   (or of its park-and-ride) goes out of
//                                   service: the whole network, filtered by
//                                   station and kind in the scene;
//   - `equipment_back_in_service`   it works again.
//
// What was seen is kept in /data (`seen`): a restart never fires the same
// event twice, and the first reading of a stop, a line or the equipment is a
// baseline (no event replays what was already there). A scene action or a
// widget never fires an event.
// -----------------------------------------------------------------------------

import { t, lineStateText, passageWhen, equipmentKindText } from './i18n.js';
import { routeOf, minutesLeft, upcomingPassages } from './departures.js';
import { lineTraffic, seriousMessages, SERIOUS, STATES } from './traffic.js';
import { formatTime } from './time.js';

const TRIGGERS = {
  DEPARTURE_SOON: 'departure_soon',
  LINE_DISRUPTED: 'line_disrupted',
  LINE_RESTORED: 'line_restored',
  TRAFFIC_MESSAGE: 'traffic_message',
  EQUIPMENT_DOWN: 'equipment_out_of_service',
  EQUIPMENT_BACK: 'equipment_back_in_service',
};
const REMINDER_MINUTES = [2, 3, 5, 10, 15, 20];
const REMINDER_MATCH_MS = 2 * 60 * 1000;
const REMINDER_KEEP_MS = 10 * 60 * 1000;
// An alert seen is remembered this long after it disappeared: an alert the
// portal drops for a moment must not fire again.
const MESSAGE_KEEP_MS = 3 * 24 * 3600 * 1000;
// At most this many new alerts fire per line and reading, and this many
// equipment changes per reading.
const MAX_MESSAGES_PER_LINE = 5;
const MAX_EQUIPMENT_EVENTS = 20;
const SUMMARY_MAX = 1000;
const MESSAGE_MAX = 1000;
const OUTPUT_MAX = 10000;
const NEXT_DEPARTURES_OUTPUTS = [
  'stop_name',
  'found',
  'line',
  'destination',
  'minutes',
  'time',
  'reliable',
  'delay_minutes',
  'following_minutes',
  'summary',
];
const LINE_TRAFFIC_OUTPUTS = [
  'line_name',
  'state',
  'state_label',
  'disrupted',
  'disruption_count',
  'title',
  'message',
  'summary',
];

/**
 * @description Truncate a text, with an ellipsis.
 * @param {string} value - The text.
 * @param {number} max - The bound.
 * @returns {string} The text.
 */
function clip(value, max) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * @description How close to a mark a reminder may fire (minutes before it).
 * @param {number} mark - The mark (minutes).
 * @returns {number} The tolerance: the marks never overlap.
 */
function tolerance(mark) {
  if (mark <= 3) {
    return 1;
  }
  return mark <= 5 ? 1.5 : 3;
}

/**
 * @description The reminders due on the passages of a stop.
 * @param {object} options - Options.
 * @param {object[]} options.passages - The passages of the stop.
 * @param {object[]} [options.fired] - The reminders already fired `[{ route, mark, at }]`,
 * undefined before the first reading of the stop: a baseline, the reminders
 * already due are remembered without firing (a busy stop would fire dozens).
 * @param {number} options.now - Now (ms).
 * @returns {{ due: Array<{ passage: object, mark: number }>, fired: object[] }}
 * The reminders to fire and the memory to keep.
 */
function detectReminders({ passages, fired, now }) {
  const baseline = !Array.isArray(fired);
  const memory = (fired ?? []).filter((entry) => entry.at > now - REMINDER_KEEP_MS);
  const due = [];
  for (const passage of upcomingPassages(passages, now)) {
    const left = (passage.at - now) / 60000;
    const route = routeOf(passage);
    for (const mark of REMINDER_MINUTES) {
      if (left > mark || left <= mark - tolerance(mark)) {
        continue;
      }
      const known = memory.some(
        (entry) =>
          entry.route === route &&
          entry.mark === mark &&
          Math.abs(entry.at - passage.at) <= REMINDER_MATCH_MS,
      );
      if (!known) {
        memory.push({ route, mark, at: passage.at });
        if (!baseline) {
          due.push({ passage, mark });
        }
      }
    }
  }
  return { due, fired: memory };
}

/**
 * @description What changed on the followed lines since the last reading.
 * @param {object} options - Options.
 * @param {object[]} options.lines - The followed lines (`id`).
 * @param {object} options.traffic - parseTraffic().
 * @param {object} [options.seen] - Per line id `{ state, messages: { id: lastSeen } }`.
 * @param {number} options.now - Now (ms).
 * @returns {{ changes: object[], seen: object }} `{ key, line, traffic,
 * message? }` per event, and the memory to keep.
 */
function detectLineChanges({ lines, traffic, seen = {}, now }) {
  const changes = [];
  const next = {};
  for (const line of lines) {
    const current = lineTraffic(traffic, line.id, now);
    const before = seen[line.id];
    const messages = {};
    for (const [key, at] of Object.entries(before?.messages ?? {})) {
      if (at > now - MESSAGE_KEEP_MS) {
        messages[key] = at;
      }
    }
    const fresh = current.messages.filter((message) => !messages[message.id]);
    current.messages.forEach((message) => {
      messages[message.id] = now;
    });
    const { state } = current;
    next[line.id] = { state, messages };
    if (!before) {
      continue;
    }
    const wasSerious = SERIOUS.includes(before.state);
    const isSerious = SERIOUS.includes(state);
    const worse = STATES.indexOf(state) > STATES.indexOf(before.state);
    if (isSerious && (!wasSerious || worse)) {
      changes.push({
        key: TRIGGERS.LINE_DISRUPTED,
        line,
        traffic: current,
        message: seriousMessages(current)[0] ?? null,
      });
    } else if (wasSerious && !isSerious) {
      changes.push({ key: TRIGGERS.LINE_RESTORED, line, traffic: current });
    }
    fresh.slice(0, MAX_MESSAGES_PER_LINE).forEach((message) => {
      changes.push({ key: TRIGGERS.TRAFFIC_MESSAGE, line, traffic: current, message });
    });
  }
  return { changes, seen: next };
}

/**
 * @description The lifts and escalators that went out of or back in service.
 * @param {object} options - Options.
 * @param {object[]} options.equipment - The equipment out of service now.
 * @param {object|null} options.seen - `{ down: { id: equipment } }` kept,
 * null before the first reading (a baseline).
 * @returns {{ changes: Array<{ key: string, equipment: object }>, seen: object }}
 * The events and the memory to keep.
 */
function detectEquipmentChanges({ equipment, seen }) {
  const before = seen?.down ?? {};
  const down = Object.fromEntries(equipment.map((item) => [item.id, item]));
  const changes = [];
  if (seen) {
    for (const item of equipment) {
      if (!before[item.id]) {
        changes.push({ key: TRIGGERS.EQUIPMENT_DOWN, equipment: item });
      }
    }
    for (const [id, item] of Object.entries(before)) {
      if (!down[id]) {
        changes.push({ key: TRIGGERS.EQUIPMENT_BACK, equipment: item });
      }
    }
  }
  return { changes: changes.slice(0, MAX_EQUIPMENT_EVENTS), seen: { down } };
}

// --- Payloads ------------------------------------------------------------------------

/**
 * @description The data of a `departure_soon` event.
 * @param {object} followed - The followed stop (`name`, `deviceId`, `stop`).
 * @param {object} passage - The passage.
 * @param {number} mark - The minutes of the reminder.
 * @param {object} options - `{ language, timeZone }`.
 * @returns {object} Flat scalars.
 */
function reminderData(followed, passage, mark, { language, timeZone }) {
  const time = formatTime(passage.at, timeZone);
  return {
    stop: followed.deviceId,
    minutes: String(mark),
    stop_name: followed.name,
    line: passage.line,
    destination: passage.destination,
    time,
    reliable: passage.reliable,
    delay_minutes: passage.delay ?? 0,
    summary: clip(
      t(passage.reliable ? 'summarySoon' : 'summarySoonTimetable', language, {
        line: passage.line,
        destination: passage.destination,
        stop: followed.stop.name,
        minutes: mark,
        time,
      }),
      SUMMARY_MAX,
    ),
  };
}

/**
 * @description The data of a line event.
 * @param {object} change - From detectLineChanges, with `deviceId` on its line.
 * @param {object} options - `{ language }`.
 * @returns {{ key: string, data: object }} The event.
 */
function lineEvent(change, { language }) {
  const { line, traffic, message } = change;
  const base = { line: line.deviceId, line_name: line.name };
  const stateLabel = lineStateText(traffic.state, language);
  if (change.key === TRIGGERS.LINE_RESTORED) {
    return {
      key: change.key,
      data: {
        ...base,
        state: traffic.state,
        summary: clip(
          t('summaryRestored', language, { line: line.name, state: stateLabel }),
          SUMMARY_MAX,
        ),
      },
    };
  }
  const title = message?.title ?? '';
  const details = {
    title,
    message: clip(message?.text ?? '', MESSAGE_MAX),
    url: message?.url ?? '',
  };
  if (change.key === TRIGGERS.LINE_DISRUPTED) {
    return {
      key: change.key,
      data: {
        ...base,
        severity: traffic.state,
        ...details,
        summary: clip(
          t(title ? 'summaryDisruptedTitle' : 'summaryDisrupted', language, {
            line: line.name,
            state: stateLabel,
            title,
          }),
          SUMMARY_MAX,
        ),
      },
    };
  }
  return {
    key: TRIGGERS.TRAFFIC_MESSAGE,
    data: {
      ...base,
      kind: message.state,
      ...details,
      summary: clip(
        t('summaryMessage', language, {
          line: line.name,
          kind: lineStateText(message.state, language),
          title,
        }),
        SUMMARY_MAX,
      ),
    },
  };
}

/**
 * @description The event of a lift or an escalator.
 * @param {object} change - From detectEquipmentChanges.
 * @param {object} options - `{ language, lineName }`: `lineName(id)` gives "a".
 * @returns {{ key: string, data: object }} The event.
 */
function equipmentEvent({ key, equipment }, { language, lineName }) {
  const kindLabel = equipmentKindText(equipment.kind, language);
  return {
    key,
    data: {
      station: equipment.stationId,
      kind: equipment.kind,
      station_name: equipment.station,
      equipment_name: equipment.name,
      kind_label: kindLabel,
      line_name: lineName(equipment.lineId),
      summary: clip(
        t(
          key === TRIGGERS.EQUIPMENT_DOWN ? 'summaryEquipmentDown' : 'summaryEquipmentBack',
          language,
          {
            kind: kindLabel,
            station: equipment.station,
            name: equipment.name,
          },
        ),
        SUMMARY_MAX,
      ),
    },
  };
}

// --- Scene action outputs ------------------------------------------------------------

/**
 * @description The outputs of `get_next_departures`.
 * @param {object} options - Options.
 * @param {object} options.followed - The followed stop.
 * @param {object[]} options.passages - Its passages.
 * @param {number} options.now - Now (ms).
 * @param {string} options.language - Language of the summary.
 * @param {string} [options.timeZone] - IANA timezone.
 * @returns {object} The outputs.
 */
function nextDeparturesOutputs({ followed, passages, now, language, timeZone }) {
  const [first, second] = upcomingPassages(passages, now);
  const outputs = {
    stop_name: followed.name,
    found: Boolean(first),
    line: first?.line ?? '',
    destination: first?.destination ?? '',
    minutes: first ? minutesLeft(first, now) : -1,
    time: first ? formatTime(first.at, timeZone) : '',
    reliable: first?.reliable ?? false,
    delay_minutes: first?.delay ?? 0,
    following_minutes: second ? minutesLeft(second, now) : -1,
  };
  let summary;
  if (first) {
    summary = t(first.reliable ? 'outputNext' : 'outputNextTimetable', language, {
      stop: followed.stop.name,
      line: first.line,
      destination: first.destination,
      when: passageWhen(first, { language, now, timeZone }),
    });
    if (first.delay > 0) {
      summary += ` ${t('outputDelay', language, { n: first.delay })}`;
    }
    if (second) {
      summary += ` ${t('outputFollowing', language, { when: passageWhen(second, { language, now, timeZone }) })}`;
    }
  } else {
    summary = t('outputNone', language, { stop: followed.stop.name });
  }
  return { ...outputs, summary: clip(summary, OUTPUT_MAX) };
}

/**
 * @description The outputs of `get_line_traffic`.
 * @param {object} options - `{ line, traffic, language }`.
 * @returns {object} The outputs.
 */
function lineTrafficOutputs({ line, traffic, language }) {
  const serious = seriousMessages(traffic);
  const first = serious[0] ?? traffic.messages.find((m) => m.state !== 'planned') ?? null;
  const stateLabel = lineStateText(traffic.state, language);
  const disrupted = SERIOUS.includes(traffic.state);
  const count = disrupted ? Math.max(1, serious.length) : serious.length;
  const summary = first?.title
    ? t('summaryLineState', language, { line: line.name, state: stateLabel, title: first.title })
    : t('summaryLineStateOnly', language, { line: line.name, state: stateLabel });
  return {
    line_name: line.name,
    state: traffic.state,
    state_label: stateLabel,
    disrupted,
    disruption_count: count,
    title: first?.title ?? '',
    message: clip(first?.text ?? '', OUTPUT_MAX),
    summary: clip(summary, OUTPUT_MAX),
  };
}

/**
 * @description Keep only the declared outputs.
 * @param {object} outputs - The outputs.
 * @param {string[]} keys - The declared keys.
 * @returns {object} The outputs.
 */
const pick = (outputs, keys) => Object.fromEntries(keys.map((key) => [key, outputs[key]]));

export {
  TRIGGERS,
  REMINDER_MINUTES,
  NEXT_DEPARTURES_OUTPUTS,
  LINE_TRAFFIC_OUTPUTS,
  tolerance,
  detectReminders,
  detectLineChanges,
  detectEquipmentChanges,
  reminderData,
  lineEvent,
  equipmentEvent,
  nextDeparturesOutputs,
  lineTrafficOutputs,
  pick,
};
