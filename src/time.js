// -----------------------------------------------------------------------------
// Times of day.
//
// The datasets give instants in UTC. Times are written in the timezone of the
// Gladys instance, which the supervisor injects as TZ (Paris time for the
// users of Rennes).
// -----------------------------------------------------------------------------

const MINUTE_MS = 60 * 1000;
// The lines of the day are read again after this local hour, once the night
// buses are done.
const NEW_DAY_HOUR = 4;

/**
 * @description The timezone of the instance.
 * @returns {string|undefined} An IANA name, undefined for the system one.
 */
function defaultTimeZone() {
  return process.env.TZ || undefined;
}

/**
 * @description The local date and time of an instant in a timezone.
 * @param {number} instant - The instant, in ms.
 * @param {string} [timeZone] - IANA timezone.
 * @returns {{ date: string, minutes: number }} `YYYY-MM-DD` and minutes since midnight.
 * @example
 * localClock(Date.parse('2026-10-16T12:00:00Z'), 'Europe/Paris'); // 2026-10-16, 840
 */
function localClock(instant, timeZone = defaultTimeZone()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(instant))
      .map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

/**
 * @description "07:42", in the timezone of the instance.
 * @param {number|null} instant - The instant, in ms.
 * @param {string} [timeZone] - IANA timezone.
 * @returns {string} The time, '' when none.
 */
function formatTime(instant, timeZone = defaultTimeZone()) {
  if (!Number.isFinite(instant)) {
    return '';
  }
  const { minutes } = localClock(instant, timeZone);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/**
 * @description The "service day" of an instant: the local date, until 04:00
 * the day before (a night bus at 00:30 still belongs to the evening).
 * @param {number} instant - The instant, in ms.
 * @param {string} [timeZone] - IANA timezone.
 * @returns {string} `YYYY-MM-DD`.
 */
function serviceDay(instant, timeZone = defaultTimeZone()) {
  return localClock(instant - NEW_DAY_HOUR * 3600 * 1000, timeZone).date;
}

/**
 * @description Whether a new service day began since an instant.
 * @param {number} since - The instant (ms), 0 for never.
 * @param {number} now - Now (ms).
 * @param {string} [timeZone] - IANA timezone.
 * @returns {boolean} True when 04:00 local time passed in between.
 */
function newDaySince(since, now, timeZone = defaultTimeZone()) {
  if (!since) {
    return true;
  }
  return serviceDay(since, timeZone) !== serviceDay(now, timeZone);
}

export {
  MINUTE_MS,
  NEW_DAY_HOUR,
  defaultTimeZone,
  localClock,
  formatTime,
  serviceDay,
  newDaySince,
};
