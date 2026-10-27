# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/). This file is generated at
each release from the Conventional Commits: do not edit it by hand.

## [0.1.0] - 2026-10-27

### Added

- One device per followed stop of the STAR network of Rennes (three in the form and up to 20 more with the "Add a stop" button, typed by name or by id, filtered by line and direction): the next passage as text, the wait of the next two passages and the delay of the next bus, bus stops and metro platforms of a name together.
- One device per followed line, bus or metro (up to six): its traffic state (normal, minor, major or blocking disruption, metro down) and the number of disruptions under way.
- Scene triggers: departure soon (2 to 20 minutes before a passage), line disrupted (major or blocking alert, metro down), line back to normal, new traffic alert about a followed line, and a lift or an escalator of a metro station out of service or back in service.
- Scene actions: read the next passages of a stop, and read the traffic of a line, each with a ready-made sentence.
- Dashboard widgets: the next passages of one or several stops, like the screens of the stops (any stop can be typed in the widget); the traffic of lines with the full alerts of STAR; the metro, its two lines, closed stations and lifts and escalators out of service.
- Configuration actions: test the connection, find a stop by name (with the id, the lines and the destinations of each side of the street), add, list and remove stops, and a diagnostic written to the Logs tab.
- Cloud transport: the official open data portal of STAR, no account and no key; stops read every 30 seconds to 5 minutes (stretched to stay within the daily quota of the portal), traffic every 5 minutes; lines and stops of the network kept in /data.
- English, French, German and Spanish everywhere: settings, devices, widgets, scenes and documentation.

[0.1.0]: https://github.com/William-De71/gladys-star-rennes/releases/tag/v0.1.0
