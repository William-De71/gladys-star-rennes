import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createStarClient, StarError, quote, among, DATASETS } from '../src/star-api.js';
import { fakeStar, NOW } from './helpers/fixtures.js';

test('ODSQL literals are quoted and escaped', () => {
  assert.equal(quote('1001'), '"1001"');
  assert.equal(quote('a"b\\c'), '"a\\"b\\\\c"');
  assert.equal(among('idarret', ['1', '2']), 'idarret in ("1","2")');
});

test('passages: the stops, the line and "from a minute ago" in the query, soonest first', async () => {
  const fetch = fakeStar();
  const api = createStarClient({ fetch, now: () => NOW });
  const records = await api.busPassages(['1242', '1550'], '0001');
  assert.ok(records.length > 0);
  assert.ok(records.every((r) => r.idligne === '0001'));
  const [call] = fetch.calls;
  assert.equal(call.dataset, DATASETS.BUS_PASSAGES);
  assert.equal(call.endpoint, 'records');
  assert.equal(
    call.params.where,
    'idarret in ("1242","1550") and depart >= now(minutes=-1) and idligne = "0001"',
  );
  assert.equal(call.params.order_by, 'depart');
  assert.equal(call.params.limit, '60');
  assert.deepEqual(api.requests.byDataset, { [DATASETS.BUS_PASSAGES]: 1 });
  // The quota headers are kept for the diagnostic and "Test the connection".
  assert.equal(api.quota.limit, 20000);
  assert.equal(typeof api.quota.remaining, 'number');
});

test('topology and traffic use the export: no page limit', async () => {
  const fetch = fakeStar();
  const api = createStarClient({ fetch });
  assert.ok((await api.busStops()).length > 0);
  assert.ok((await api.alerts()).length > 0);
  assert.ok((await api.equipmentDown()).length > 0);
  assert.deepEqual(
    fetch.calls.map((call) => call.endpoint),
    ['exports/json', 'exports/json', 'exports/json'],
  );
  assert.match(fetch.calls[0].params.where, /estversionactive = "Oui"/);
  assert.match(fetch.calls[2].params.where, /etat = "Indisponible"/);
});

test('errors: 429 is the quota, 4xx invalid, 5xx and network unreachable', async () => {
  const fetch = fakeStar();
  const api = createStarClient({ fetch });
  fetch.state.fail = 429;
  await assert.rejects(api.alerts(), (err) => {
    assert.ok(err instanceof StarError);
    assert.equal(err.kind, 'quota');
    assert.match(err.message, /HTTP 429: Too many requests/);
    return true;
  });
  fetch.state.fail = 400;
  await assert.rejects(api.alerts(), { kind: 'invalid', status: 400 });
  fetch.state.fail = 503;
  await assert.rejects(api.alerts(), { kind: 'unreachable', status: 503 });
  fetch.state.fail = 'network';
  await assert.rejects(api.alerts(), { kind: 'unreachable', message: 'ECONNREFUSED' });
  assert.equal(api.requests.failed, 4);
});

test('an answer of the wrong shape is invalid', async () => {
  const api = createStarClient({
    fetch: async () => new Response(JSON.stringify({ nothing: true }), { status: 200 }),
  });
  await assert.rejects(api.busPassages(['1']), { kind: 'invalid' });
  await assert.rejects(api.alerts(), { kind: 'invalid' });
});
