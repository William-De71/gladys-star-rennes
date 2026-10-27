# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** for STAR, the bus and metro network
of Rennes Métropole: a Node.js service (Node 22+, ESM, no build step) that runs
in its own sandboxed Docker container and talks to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
its only runtime dependency. It reads the official open data portal of STAR
(`https://data.explore.star.fr`, an Opendatasoft portal, Explore API v2.1, no
key, ODbL data): the bus and metro passages of the followed stops — three in
the form, up to 20 more added with the "Add a stop" button —, the traffic
alerts, the state of the metro lines and stations, the lifts and escalators out
of service, and the lines and stops of the network (kept in /data).
Transport: cloud only.
Documentation of the datasets: https://data.explore.star.fr/explore/ (each
dataset id is listed at the top of `src/star-api.js`).

## Commands

```bash
npm install
npm test                                  # node --test, the built-in runner
node --test test/widgets.test.js          # one file
DEBUG=gladys-integration-sdk npm test     # with the SDK debug logs
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store . --skip-image-check   # store checks
scripts/build-cover.sh                    # cover.jpg from docs/assets/cover.svg
docs/illustrations/render.sh              # docs/assets/widgets.<lang>.png
node .github/scripts/release.mjs next     # the version the next release would get
```

## Architecture

```
index.js                SDK wiring only (new GladysIntegration + createApp)
src/app.js              every handler, registered before connect(); the timers, the quota budget
src/star-api.js         HTTP client of the portal: records / exports, ODSQL filters, quota headers
src/network.js          lines and stops in /data, typed names -> stop ids (bus and metro)
src/departures.js       passage records -> passages (time, delay, real time or timetable)
src/traffic.js          alerts (levels, windows), metro lines and stations, equipment out of service
src/events.js           scene trigger transitions, payloads, scene action outputs
src/device.js           the stop and line devices and their states
src/widgets.js          departures, traffic and metro dashboard widgets
src/store.js            /data/star-rennes.json: network, `seen`
src/time.js             times of day (TZ), the service day (04:00)
src/config.js           configuration (three stops + `added_stops`, lines, interval, language)
src/i18n.js             runtime texts, en / fr / de / es
gladys-assistant-integration.json   manifest
docs/{en,fr,de,es}.md   user documentation, re-hosted by the store
docs/illustrations/     generated widget images (render.sh, gen.mjs, render.js)
test/fixtures/          real answers of the STAR portal, reduced (ODbL)
.github/scripts/release.mjs         version, changelog, bump (tested in test/)
```

## Rules

- **External ids are forever**, and so is every key users store: device and
  feature external ids (`stop:n-<folded name>_<line id>_<direction>` or
  `stop:i-<stop id>…`, `line:<line id>`: the ids of STAR, "0001" for C1,
  "1001" for metro a, never a public label that could change), feature
  `category` / `type` / `unit` / `min` / `max` / `step`, the keys of
  `config_schema`, `actions`, the widgets and their settings, scene triggers
  (fields, options — the station ids of the equipment triggers —, variables)
  and scene actions (fields, outputs), and the internal config keys
  `added_stops` (`[{ stop, line, direction }]`) and `last_language`.
  `test/structure.test.js` compares them to
  `test/fixtures/discovery.baseline.json`: never update the baseline to make a
  test pass without a documented migration.
- **Category / type pairs.** The next passage and the line traffic are `text`
  / `text`, the waits `duration` / `integer` in minutes (0-180), the delay
  `duration` / `integer` (0-120), the counts `counter-sensor` / `integer`
  (0-20). Without a passage the waits and the delay are not published (a 0
  would announce a bus now).
- **`should_poll` stays false**: the integration reads on its own timer — the
  stops every `interval` (30 s to 5 min, 1 min by default; 10 min while a stop
  announces nothing), the traffic and the metro every 5 min, the lines daily
  after 04:00, the stops weekly. A widget or a scene action reuses a reading
  of less than 90 s.
- **Quota of the portal.** Without a key, the portal allows a daily number of
  calls per address (20 000 seen, `X-RateLimit-*` headers, 429 beyond). The
  stops share `DAILY_STOP_BUDGET` (12 000): `effectiveInterval()` stretches
  the interval when many stops are followed. Two followed stops on the same
  stop and line share one request. Never add a request per stop and per tick.
- **Filter on the portal.** The passages are read with an ODSQL `where`
  (`idarret in (…)`, `depart >= now(minutes=-1)`, the line), never a whole
  dataset; the topology and the traffic use the `exports/json` endpoint (no
  page limit).
- **Timetable times.** A bus record with `precision` "Applicable" is not
  located: say "timetable" in every text, show it in grey, no delay. The metro
  runs on its adjusted timetable: it counts as real time.
- **Events once.** `seen` (in /data) remembers the reminders fired per stop,
  the state and alerts of each followed line, the equipment out of service.
  The first reading of a stop, a line or the equipment is a baseline: nothing
  fires. A scene action or a widget never fires an event.
- **Data licence.** ODbL: keep "STAR" and the time of the reading visible in
  the widgets, and the credit in the README, the docs and NOTICE.
- **The container rootfs is read-only.** Write only under `/data`.
- **Four languages.** Every user-facing text (manifest, runtime messages in
  `src/i18n.js`, `docs/*.md`, README) exists in English, French, German and
  Spanish. `test/i18n.test.js` checks it. Names of stops, destinations and the
  alerts of STAR stay in French.
- **Widget images.** After any change to the content of a widget, run
  `docs/illustrations/render.sh` again and look at the four PNG files.
- **Versions belong to the Release workflow**: never edit `version` in
  `package.json`, the lockfile or the manifest, nor the `docker_image` tag.
  The version stays below 1.0.0 until the maintainer runs the Release workflow
  with `release-as: 1.0.0`.
- **Changelog.** Never edit CHANGELOG.md by hand, it is generated at the
  release. Write the PR title as the line the user will read.
- **Commits and PR titles** follow Conventional Commits, in English: `feat` ->
  minor, `fix` / `perf` -> patch, `!` or `BREAKING CHANGE:` -> major (minor
  below 1.0.0); `docs`, `chore`, `ci`, `test`, `style`, `refactor`, `build`
  release nothing.
- **Manifest.** Texts are objects `{ "en", "fr", "de", "es" }`; the catalog
  `description` holds 10 to 100 characters per language; the file stays under
  100 KB. `gladys_version` is `>=5.3.0` (widgets, scene triggers, catalog
  `keywords` and `countries`); a widget button form would need nothing more.
  Transport: `["cloud"]`. No permission, no secret.
- **Forum drafts** (`.github/forum-*.md`) are never committed.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English. Tests never touch the network (the fake portal of
  `test/helpers/fixtures.js`).
