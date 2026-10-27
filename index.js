// -----------------------------------------------------------------------------
// Entry point of the STAR Rennes external integration.
//
// Brings the bus and metro network of Rennes (STAR, Rennes Métropole) into
// Gladys, through its official open data portal (no key):
//   - devices: one per followed stop, with the next passages, the waits and
//     the delay in real time, and one per followed line, with its traffic
//     (src/device.js);
//   - scene triggers: departure soon, line disrupted, line back to normal,
//     new traffic alert, lift or escalator out of / back in service;
//   - scene actions: read the next passages of a stop, read the traffic of a
//     line;
//   - dashboard widgets: departures, traffic, metro.
//
// This file only wires the SDK client: the handlers are in src/app.js.
//
// Environment variables provided by the Gladys supervisor:
//   GLADYS_HOST_API_URL / GLADYS_INTEGRATION_TOKEN / GLADYS_INTEGRATION_SELECTOR
// The SDK reads them automatically: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { createApp } from './src/app.js';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const gladys = new GladysIntegration();
createApp(gladys);

// --- Startup -----------------------------------------------------------------------
logger.info(`Starting the STAR Rennes integration ${version}...`);
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
