// -----------------------------------------------------------------------------
// Texts of the integration, in English, French, German and Spanish (English
// fallback).
//
// The manifest carries its own labels; these are the texts the code writes at
// runtime: device and feature names, line states, widget contents, scene
// summaries, messages of the Configuration screen. Vocabulary of the Gladys
// interface (appareil / Gerät / dispositivo, scène / Szene / escena) and of
// STAR (arrêt, ligne, passage, info trafic). The names of stops and lines,
// the destinations and the traffic alerts stay as STAR writes them, in
// French: the network has no other language.
// -----------------------------------------------------------------------------

import { minutesLeft } from './departures.js';
import { formatTime } from './time.js';

const LANGUAGES = ['en', 'fr', 'de', 'es'];

const TEXTS = {
  // devices
  stopDeviceName: {
    en: 'STAR {stop}',
    fr: 'STAR {stop}',
    de: 'STAR {stop}',
    es: 'STAR {stop}',
  },
  lineDeviceName: {
    en: 'STAR line {line}',
    fr: 'STAR ligne {line}',
    de: 'STAR Linie {line}',
    es: 'STAR línea {line}',
  },
  metroDeviceName: {
    en: 'STAR metro {line}',
    fr: 'STAR métro {line}',
    de: 'STAR Metro {line}',
    es: 'STAR metro {line}',
  },
  featureNext: {
    en: 'Next passage',
    fr: 'Prochain passage',
    de: 'Nächste Abfahrt',
    es: 'Próximo paso',
  },
  featureWait: {
    en: 'Wait',
    fr: 'Attente',
    de: 'Wartezeit',
    es: 'Espera',
  },
  featureFollowing: {
    en: 'Wait for the following one',
    fr: 'Attente du suivant',
    de: 'Wartezeit der folgenden',
    es: 'Espera del siguiente',
  },
  featureDelay: {
    en: 'Delay of the next one',
    fr: 'Retard du prochain',
    de: 'Verspätung der nächsten',
    es: 'Retraso del próximo',
  },
  featureStatus: {
    en: 'Traffic',
    fr: 'Trafic',
    de: 'Verkehrslage',
    es: 'Tráfico',
  },
  featureDisruptions: {
    en: 'Disruptions under way',
    fr: 'Perturbations en cours',
    de: 'Aktuelle Störungen',
    es: 'Incidencias en curso',
  },

  // passages
  noPassage: {
    en: 'No passage announced',
    fr: 'Aucun passage annoncé',
    de: 'Keine Abfahrt angekündigt',
    es: 'Ningún paso anunciado',
  },
  minutesValue: {
    en: '{n} min',
    fr: '{n} min',
    de: '{n} Min.',
    es: '{n} min',
  },
  approaching: {
    en: 'Approaching',
    fr: 'À l’approche',
    de: 'Fährt ein',
    es: 'Llegando',
  },
  inMinutes: {
    en: 'in {n} min',
    fr: 'dans {n} min',
    de: 'in {n} Min.',
    es: 'dentro de {n} min',
  },
  atTime: {
    en: 'at {time}',
    fr: 'à {time}',
    de: 'um {time}',
    es: 'a las {time}',
  },
  timetable: {
    en: 'timetable',
    fr: 'horaire théorique',
    de: 'Fahrplanzeit',
    es: 'horario teórico',
  },
  delayNote: {
    en: '+{n} min late',
    fr: '+{n} min de retard',
    de: '+{n} Min. Verspätung',
    es: '+{n} min de retraso',
  },

  // line states
  state_unknown: {
    en: 'No information',
    fr: 'Pas d’information',
    de: 'Keine Information',
    es: 'Sin información',
  },
  state_normal: {
    en: 'Normal traffic',
    fr: 'Trafic normal',
    de: 'Normaler Betrieb',
    es: 'Tráfico normal',
  },
  state_planned: {
    en: 'Disruption planned',
    fr: 'Perturbation prévue',
    de: 'Störung geplant',
    es: 'Incidencia prevista',
  },
  state_minor: {
    en: 'Minor disruption',
    fr: 'Perturbation mineure',
    de: 'Leichte Störung',
    es: 'Incidencia leve',
  },
  state_major: {
    en: 'Major disruption',
    fr: 'Perturbation majeure',
    de: 'Erhebliche Störung',
    es: 'Incidencia importante',
  },
  state_blocking: {
    en: 'Blocking disruption',
    fr: 'Perturbation bloquante',
    de: 'Blockierende Störung',
    es: 'Incidencia bloqueante',
  },
  state_stopped: {
    en: 'Metro down',
    fr: 'Métro en panne',
    de: 'Metro gestört',
    es: 'Metro averiado',
  },
  stateWithTitle: {
    en: '{state}: {title}',
    fr: '{state} : {title}',
    de: '{state}: {title}',
    es: '{state}: {title}',
  },

  // equipment
  kind_elevator: {
    en: 'Lift',
    fr: 'Ascenseur',
    de: 'Aufzug',
    es: 'Ascensor',
  },
  kind_escalator: {
    en: 'Escalator',
    fr: 'Escalier méca.',
    de: 'Rolltreppe',
    es: 'Escalera mec.',
  },
  kind_parking_elevator: {
    en: 'P+R lift',
    fr: 'Ascenseur P+R',
    de: 'P+R-Aufzug',
    es: 'Ascensor P+R',
  },

  // scene summaries
  summarySoon: {
    en: '{line} towards {destination} leaves {stop} in {minutes} min ({time}).',
    fr: '{line} vers {destination} passe à {stop} dans {minutes} min ({time}).',
    de: '{line} Richtung {destination} fährt an {stop} in {minutes} Min. ab ({time}).',
    es: '{line} hacia {destination} pasa por {stop} dentro de {minutes} min ({time}).',
  },
  summarySoonTimetable: {
    en: '{line} towards {destination} is due at {stop} in {minutes} min ({time}, timetable: the bus is not located yet).',
    fr: '{line} vers {destination} est attendu à {stop} dans {minutes} min ({time}, horaire théorique : le bus n’est pas encore localisé).',
    de: '{line} Richtung {destination} wird an {stop} in {minutes} Min. erwartet ({time}, Fahrplanzeit: Bus noch nicht geortet).',
    es: '{line} hacia {destination} está previsto en {stop} dentro de {minutes} min ({time}, horario teórico: el bus aún no está localizado).',
  },
  summaryDisrupted: {
    en: 'STAR line {line}: {state}.',
    fr: 'Ligne STAR {line} : {state}.',
    de: 'STAR-Linie {line}: {state}.',
    es: 'Línea STAR {line}: {state}.',
  },
  summaryDisruptedTitle: {
    en: 'STAR line {line}: {state} ({title}).',
    fr: 'Ligne STAR {line} : {state} ({title}).',
    de: 'STAR-Linie {line}: {state} ({title}).',
    es: 'Línea STAR {line}: {state} ({title}).',
  },
  summaryRestored: {
    en: 'STAR line {line} is back to normal ({state}).',
    fr: 'La ligne STAR {line} est revenue à la normale ({state}).',
    de: 'Die STAR-Linie {line} fährt wieder normal ({state}).',
    es: 'La línea STAR {line} vuelve a la normalidad ({state}).',
  },
  summaryMessage: {
    en: 'STAR line {line}, {kind}: {title}.',
    fr: 'Ligne STAR {line}, {kind} : {title}.',
    de: 'STAR-Linie {line}, {kind}: {title}.',
    es: 'Línea STAR {line}, {kind}: {title}.',
  },
  summaryLineState: {
    en: 'STAR line {line}: {state} ({title}).',
    fr: 'Ligne STAR {line} : {state} ({title}).',
    de: 'STAR-Linie {line}: {state} ({title}).',
    es: 'Línea STAR {line}: {state} ({title}).',
  },
  summaryLineStateOnly: {
    en: 'STAR line {line}: {state}.',
    fr: 'Ligne STAR {line} : {state}.',
    de: 'STAR-Linie {line}: {state}.',
    es: 'Línea STAR {line}: {state}.',
  },
  summaryEquipmentDown: {
    en: '{kind} out of service at the {station} metro station: {name}.',
    fr: '{kind} hors service à la station de métro {station} : {name}.',
    de: '{kind} außer Betrieb an der Metrostation {station}: {name}.',
    es: '{kind} fuera de servicio en la estación de metro {station}: {name}.',
  },
  summaryEquipmentBack: {
    en: '{kind} back in service at the {station} metro station: {name}.',
    fr: '{kind} de nouveau en service à la station de métro {station} : {name}.',
    de: '{kind} wieder in Betrieb an der Metrostation {station}: {name}.',
    es: '{kind} de nuevo en servicio en la estación de metro {station}: {name}.',
  },
  outputNext: {
    en: 'Next passage at {stop}: {line} towards {destination} {when}.',
    fr: 'Prochain passage à {stop} : {line} vers {destination} {when}.',
    de: 'Nächste Abfahrt an {stop}: {line} Richtung {destination} {when}.',
    es: 'Próximo paso en {stop}: {line} hacia {destination} {when}.',
  },
  outputNextTimetable: {
    en: 'Next passage at {stop}: {line} towards {destination} {when} (timetable).',
    fr: 'Prochain passage à {stop} : {line} vers {destination} {when} (horaire théorique).',
    de: 'Nächste Abfahrt an {stop}: {line} Richtung {destination} {when} (Fahrplanzeit).',
    es: 'Próximo paso en {stop}: {line} hacia {destination} {when} (horario teórico).',
  },
  outputDelay: {
    en: 'It runs {n} min late.',
    fr: 'Il a {n} min de retard.',
    de: 'Er hat {n} Min. Verspätung.',
    es: 'Lleva {n} min de retraso.',
  },
  outputFollowing: {
    en: 'The following one {when}.',
    fr: 'Le suivant {when}.',
    de: 'Die folgende {when}.',
    es: 'El siguiente {when}.',
  },
  outputNone: {
    en: 'No passage announced at {stop}.',
    fr: 'Aucun passage annoncé à {stop}.',
    de: 'Keine Abfahrt an {stop} angekündigt.',
    es: 'Ningún paso anunciado en {stop}.',
  },

  // widgets
  readAt: {
    en: 'read at {time}',
    fr: 'lu à {time}',
    de: 'gelesen um {time}',
    es: 'leído a las {time}',
  },
  updatedAt: {
    en: 'STAR · updated at {time}',
    fr: 'STAR · mis à jour à {time}',
    de: 'STAR · aktualisiert um {time}',
    es: 'STAR · actualizado a las {time}',
  },
  minutesShort: {
    en: 'min',
    fr: 'min',
    de: 'Min.',
    es: 'min',
  },
  timetableShort: {
    en: 'timetable',
    fr: 'théorique',
    de: 'Fahrplan',
    es: 'teórico',
  },
  moreInfo: {
    en: 'More on star.fr',
    fr: 'Plus sur star.fr',
    de: 'Mehr auf star.fr',
    es: 'Más en star.fr',
  },
  trafficTitle: {
    en: 'STAR traffic',
    fr: 'Trafic STAR',
    de: 'STAR-Verkehrslage',
    es: 'Tráfico STAR',
  },
  busLineLabel: {
    en: 'Line {line}',
    fr: 'Ligne {line}',
    de: 'Linie {line}',
    es: 'Línea {line}',
  },
  metroLineLabel: {
    en: 'Metro {line}',
    fr: 'Métro {line}',
    de: 'Metro {line}',
    es: 'Metro {line}',
  },
  noMessage: {
    en: 'No traffic alert for these lines.',
    fr: 'Aucune info trafic pour ces lignes.',
    de: 'Keine Verkehrsmeldung für diese Linien.',
    es: 'Ningún aviso de tráfico para estas líneas.',
  },
  fromDate: {
    en: 'from {date}',
    fr: 'à partir du {date}',
    de: 'ab {date}',
    es: 'desde el {date}',
  },
  untilDate: {
    en: 'until {date}',
    fr: 'jusqu’au {date}',
    de: 'bis {date}',
    es: 'hasta el {date}',
  },
  metroTitle: {
    en: 'STAR metro',
    fr: 'Métro STAR',
    de: 'STAR-Metro',
    es: 'Metro STAR',
  },
  metroRunning: {
    en: 'Running',
    fr: 'En service',
    de: 'In Betrieb',
    es: 'En servicio',
  },
  metroStopped: {
    en: 'Down',
    fr: 'En panne',
    de: 'Gestört',
    es: 'Averiado',
  },
  restartAt: {
    en: 'back about {time}',
    fr: 'reprise vers {time}',
    de: 'Wiederaufnahme gegen {time}',
    es: 'vuelta hacia las {time}',
  },
  closedStations: {
    en: 'Closed stations',
    fr: 'Stations fermées',
    de: 'Geschlossene Stationen',
    es: 'Estaciones cerradas',
  },
  equipmentAllWorking: {
    en: 'Every lift and escalator works.',
    fr: 'Tous les ascenseurs et escaliers mécaniques fonctionnent.',
    de: 'Alle Aufzüge und Rolltreppen funktionieren.',
    es: 'Todos los ascensores y escaleras mecánicas funcionan.',
  },
  equipmentDownCount: {
    en: '{n} out of service',
    fr: '{n} hors service',
    de: '{n} außer Betrieb',
    es: '{n} fuera de servicio',
  },
  andMore: {
    en: '{n} not shown',
    fr: '{n} non affiché(s)',
    de: '{n} nicht angezeigt',
    es: '{n} no mostrado(s)',
  },
  widgetNoStop: {
    en: 'No stop is followed: add one on the Configuration screen of the integration, or type one in the widget settings.',
    fr: 'Aucun arrêt n’est suivi : ajoutez-en un dans l’écran Configuration de l’intégration, ou saisissez-en un dans les réglages du widget.',
    de: 'Keine Haltestelle wird verfolgt: Füge eine im Konfigurationsbildschirm der Integration hinzu oder gib eine in den Widget-Einstellungen ein.',
    es: 'No se sigue ninguna parada: añade una en la pantalla Configuración de la integración, o escribe una en los ajustes del widget.',
  },
  widgetNoLine: {
    en: 'No line is followed: add some on the Configuration screen of the integration, or type them in the widget settings.',
    fr: 'Aucune ligne n’est suivie : ajoutez-en dans l’écran Configuration de l’intégration, ou saisissez-les dans les réglages du widget.',
    de: 'Keine Linie wird verfolgt: Füge welche im Konfigurationsbildschirm der Integration hinzu oder gib sie in den Widget-Einstellungen ein.',
    es: 'No se sigue ninguna línea: añade alguna en la pantalla Configuración de la integración, o escríbelas en los ajustes del widget.',
  },

  // configuration and status
  statusUnreachable: {
    en: 'The STAR open data portal does not answer ({detail}). Next try in {minutes} min.',
    fr: 'Le portail open data STAR ne répond pas ({detail}). Nouvel essai dans {minutes} min.',
    de: 'Das Open-Data-Portal von STAR antwortet nicht ({detail}). Neuer Versuch in {minutes} Min.',
    es: 'El portal de datos abiertos de STAR no responde ({detail}). Nuevo intento dentro de {minutes} min.',
  },
  statusQuota: {
    en: 'Daily quota of the STAR open data portal reached for this address: readings resume after midnight (UTC).',
    fr: 'Quota quotidien du portail open data STAR atteint pour cette adresse : les lectures reprennent après minuit (UTC).',
    de: 'Tageskontingent des Open-Data-Portals von STAR für diese Adresse erreicht: Die Abfragen laufen nach Mitternacht (UTC) weiter.',
    es: 'Cuota diaria del portal de datos abiertos de STAR alcanzada para esta dirección: las lecturas se reanudan tras la medianoche (UTC).',
  },
  statusConnected: {
    en: 'Connected to STAR: {stops} stop(s), {lines} line(s), stops read every {interval} s.',
    fr: 'Connecté au STAR : {stops} arrêt(s), {lines} ligne(s), arrêts lus toutes les {interval} s.',
    de: 'Mit STAR verbunden: {stops} Haltestelle(n), {lines} Linie(n), Haltestellen alle {interval} s gelesen.',
    es: 'Conectado a STAR: {stops} parada(s), {lines} línea(s), paradas leídas cada {interval} s.',
  },
  statusNotFound: {
    en: 'Unknown to STAR: {names}.',
    fr: 'Inconnu du STAR : {names}.',
    de: 'Bei STAR unbekannt: {names}.',
    es: 'Desconocido para STAR: {names}.',
  },
  statusNothing: {
    en: 'Connected to STAR. Add a stop or a line on the Configuration screen.',
    fr: 'Connecté au STAR. Ajoutez un arrêt ou une ligne dans l’écran Configuration.',
    de: 'Mit STAR verbunden. Füge im Konfigurationsbildschirm eine Haltestelle oder Linie hinzu.',
    es: 'Conectado a STAR. Añade una parada o una línea en la pantalla Configuración.',
  },
  testNetworkOk: {
    en: 'STAR open data reached: {lines} lines, {stops} stops',
    fr: 'Open data STAR joint : {lines} lignes, {stops} arrêts',
    de: 'STAR Open Data erreicht: {lines} Linien, {stops} Haltestellen',
    es: 'Datos abiertos de STAR alcanzados: {lines} líneas, {stops} paradas',
  },
  testStop: {
    en: '{stop}: {count} passage(s), next {next}',
    fr: '{stop} : {count} passage(s), prochain {next}',
    de: '{stop}: {count} Abfahrt(en), nächste {next}',
    es: '{stop}: {count} paso(s), próximo {next}',
  },
  testStopError: {
    en: '{stop}: {error}',
    fr: '{stop} : {error}',
    de: '{stop}: {error}',
    es: '{stop}: {error}',
  },
  testLine: {
    en: 'Line {line}: {state}',
    fr: 'Ligne {line} : {state}',
    de: 'Linie {line}: {state}',
    es: 'Línea {line}: {state}',
  },
  testTrafficError: {
    en: 'Traffic: {error}',
    fr: 'Trafic : {error}',
    de: 'Verkehrslage: {error}',
    es: 'Tráfico: {error}',
  },
  testQuota: {
    en: '{remaining} calls left today for this address',
    fr: '{remaining} appels restants aujourd’hui pour cette adresse',
    de: 'heute noch {remaining} Abfragen für diese Adresse',
    es: 'quedan {remaining} llamadas hoy para esta dirección',
  },
  unknownEntry: {
    en: 'unknown: {name}',
    fr: 'inconnu : {name}',
    de: 'unbekannt: {name}',
    es: 'desconocido: {name}',
  },
  errorUnreachable: {
    en: 'the STAR open data portal does not answer',
    fr: 'le portail open data STAR ne répond pas',
    de: 'das Open-Data-Portal von STAR antwortet nicht',
    es: 'el portal de datos abiertos de STAR no responde',
  },
  errorQuota: {
    en: 'daily quota of the portal reached',
    fr: 'quota quotidien du portail atteint',
    de: 'Tageskontingent des Portals erreicht',
    es: 'cuota diaria del portal alcanzada',
  },
  searchTooShort: {
    en: 'Type at least two letters of the stop name.',
    fr: 'Saisissez au moins deux lettres du nom de l’arrêt.',
    de: 'Gib mindestens zwei Buchstaben des Haltestellennamens ein.',
    es: 'Escribe al menos dos letras del nombre de la parada.',
  },
  searchNone: {
    en: 'No STAR stop matches "{query}".',
    fr: 'Aucun arrêt STAR ne correspond à « {query} ».',
    de: 'Keine STAR-Haltestelle passt zu „{query}“.',
    es: 'Ninguna parada de STAR coincide con «{query}».',
  },
  searchFound: {
    en: 'Type the name for every side of the street and the metro, or an id for one side only (its lines and destinations after the arrow):\n{list}',
    fr: 'Saisissez le nom pour tous les côtés de la rue et le métro, ou un identifiant pour un seul côté (ses lignes et destinations après la flèche) :\n{list}',
    de: 'Gib den Namen für alle Straßenseiten und die Metro ein oder eine Kennung für nur eine Seite (ihre Linien und Ziele nach dem Pfeil):\n{list}',
    es: 'Escribe el nombre para todos los lados de la calle y el metro, o un identificador para un solo lado (sus líneas y destinos tras la flecha):\n{list}',
  },
  searchBus: {
    en: 'bus',
    fr: 'bus',
    de: 'Bus',
    es: 'bus',
  },
  searchMetro: {
    en: 'metro',
    fr: 'métro',
    de: 'Metro',
    es: 'metro',
  },

  // stops added with the configuration buttons
  stopAdded: {
    en: 'Stop added: {name}. {count} stop(s) followed. Its device is offered in the Discover tab.',
    fr: 'Arrêt ajouté : {name}. {count} arrêt(s) suivi(s). Son appareil est proposé dans l’onglet Découvrir.',
    de: 'Haltestelle hinzugefügt: {name}. {count} Haltestelle(n) verfolgt. Ihr Gerät wird im Tab Entdecken angeboten.',
    es: 'Parada añadida: {name}. {count} parada(s) seguida(s). Su dispositivo se ofrece en la pestaña Descubrir.',
  },
  stopAlreadyFollowed: {
    en: '{name} is already followed.',
    fr: '{name} est déjà suivi.',
    de: '{name} wird bereits verfolgt.',
    es: '{name} ya se sigue.',
  },
  stopsFull: {
    en: 'Already {max} stops added: remove one first.',
    fr: 'Déjà {max} arrêts ajoutés : retirez-en un d’abord.',
    de: 'Bereits {max} Haltestellen hinzugefügt: entferne zuerst eine.',
    es: 'Ya hay {max} paradas añadidas: quita una primero.',
  },
  stopRemoved: {
    en: 'Stop removed: {name}. Delete its device in Gladys if you no longer want it.',
    fr: 'Arrêt retiré : {name}. Supprimez son appareil dans Gladys si vous n’en voulez plus.',
    de: 'Haltestelle entfernt: {name}. Lösche ihr Gerät in Gladys, wenn du es nicht mehr brauchst.',
    es: 'Parada quitada: {name}. Borra su dispositivo en Gladys si ya no lo quieres.',
  },
  stopRemoveUnknown: {
    en: 'No added stop matches "{query}": type its number given by "List the stops".',
    fr: 'Aucun arrêt ajouté ne correspond à « {query} » : saisissez son numéro donné par « Lister les arrêts ».',
    de: 'Keine hinzugefügte Haltestelle passt zu „{query}“: gib ihre Nummer aus „Haltestellen auflisten“ ein.',
    es: 'Ninguna parada añadida coincide con «{query}»: escribe su número dado por «Listar las paradas».',
  },
  stopRemoveAmbiguous: {
    en: 'Several added stops match "{query}": type the number given by "List the stops".',
    fr: 'Plusieurs arrêts ajoutés correspondent à « {query} » : saisissez le numéro donné par « Lister les arrêts ».',
    de: 'Mehrere hinzugefügte Haltestellen passen zu „{query}“: gib die Nummer aus „Haltestellen auflisten“ ein.',
    es: 'Varias paradas añadidas coinciden con «{query}»: escribe el número dado por «Listar las paradas».',
  },
  stopInForm: {
    en: '{name} is stop {slot} of the form: empty its field, then save the configuration.',
    fr: '{name} est l’arrêt {slot} du formulaire : videz son champ, puis enregistrez la configuration.',
    de: '{name} ist Haltestelle {slot} des Formulars: leere ihr Feld und speichere dann die Konfiguration.',
    es: '{name} es la parada {slot} del formulario: vacía su campo y guarda la configuración.',
  },
  stopsNone: {
    en: 'No stop followed yet: fill in a stop of the form or press "Add a stop".',
    fr: 'Aucun arrêt suivi pour l’instant : remplissez un arrêt du formulaire ou appuyez sur « Ajouter un arrêt ».',
    de: 'Noch keine Haltestelle verfolgt: fülle eine Haltestelle im Formular aus oder drücke „Haltestelle hinzufügen“.',
    es: 'Aún no se sigue ninguna parada: rellena una parada del formulario o pulsa «Añadir una parada».',
  },
  stopsList: {
    en: '{count} stop(s) followed:\n{list}',
    fr: '{count} arrêt(s) suivi(s) :\n{list}',
    de: '{count} Haltestelle(n) verfolgt:\n{list}',
    es: '{count} parada(s) seguida(s):\n{list}',
  },
  stopFromForm: {
    en: 'form, stop {slot}',
    fr: 'formulaire, arrêt {slot}',
    de: 'Formular, Haltestelle {slot}',
    es: 'formulario, parada {slot}',
  },
  stopUnknownMark: {
    en: 'unknown to STAR',
    fr: 'inconnu du STAR',
    de: 'STAR unbekannt',
    es: 'desconocido para STAR',
  },
  diagnosticDone: {
    en: 'Diagnostic written to the Logs tab ({count} line(s) starting with "STAR diagnostic").',
    fr: 'Diagnostic écrit dans l’onglet Journaux ({count} ligne(s) commençant par « STAR diagnostic »).',
    de: 'Diagnose in den Tab Protokolle geschrieben ({count} Zeile(n), beginnend mit „STAR diagnostic“).',
    es: 'Diagnóstico escrito en la pestaña Registros ({count} línea(s) que empiezan por «STAR diagnostic»).',
  },
};

/**
 * @description Whether a value is a supported language.
 * @param {unknown} value - The value.
 * @returns {boolean} True for en, fr, de, es.
 */
function isLanguage(value) {
  return LANGUAGES.includes(value);
}

/**
 * @description A text in a language, its placeholders filled.
 * @param {string} key - A TEXTS key.
 * @param {string} language - The language (English when unknown).
 * @param {object} [values] - The placeholder values.
 * @returns {string} The text.
 * @example
 * t('inMinutes', 'fr', { n: 3 }); // -> 'dans 3 min'
 */
function t(key, language, values = {}) {
  const entry = TEXTS[key];
  if (!entry) {
    return key;
  }
  const template = entry[isLanguage(language) ? language : 'en'] ?? entry.en;
  return template.replace(/\{(\w+)\}/g, (whole, name) =>
    values[name] === undefined || values[name] === null ? '' : String(values[name]),
  );
}

/**
 * @description A text in the four languages.
 * @param {string} key - A TEXTS key.
 * @param {object|Function} [values] - The values, or `(language) => values`.
 * @returns {object} `{ en, fr, de, es }`.
 */
function all(key, values = {}) {
  return Object.fromEntries(
    LANGUAGES.map((language) => [
      language,
      t(key, language, typeof values === 'function' ? values(language) : values),
    ]),
  );
}

/**
 * @description The label of a line state.
 * @param {string} state - A state name (traffic.js).
 * @param {string} language - The language.
 * @returns {string} The label.
 */
const lineStateText = (state, language) =>
  t(TEXTS[`state_${state}`] ? `state_${state}` : 'state_unknown', language);

/**
 * @description The label of a kind of equipment.
 * @param {string} kind - `elevator`, `escalator` or `parking_elevator`.
 * @param {string} language - The language.
 * @returns {string} The label.
 */
const equipmentKindText = (kind, language) =>
  t(TEXTS[`kind_${kind}`] ? `kind_${kind}` : 'kind_elevator', language);

/**
 * @description When a passage comes, in a sentence: "in 3 min", "at 10:32".
 * @param {object} passage - The passage.
 * @param {object} options - `{ language, now, timeZone }`.
 * @returns {string} The words.
 */
function passageWhen(passage, { language, now, timeZone }) {
  const minutes = minutesLeft(passage, now);
  if (minutes >= 60) {
    return t('atTime', language, { time: formatTime(passage.at, timeZone) });
  }
  return minutes === 0
    ? t('approaching', language).toLowerCase()
    : t('inMinutes', language, { n: minutes });
}

/**
 * @description The short time of a passage, as on the screens of the stops:
 * "3 min", "10:32", "Approaching".
 * @param {object} passage - The passage.
 * @param {object} options - `{ language, now, timeZone }`.
 * @returns {string} The time.
 */
function passageShort(passage, { language, now, timeZone }) {
  const minutes = minutesLeft(passage, now);
  if (minutes >= 60) {
    return formatTime(passage.at, timeZone);
  }
  return minutes === 0 ? t('approaching', language) : t('minutesValue', language, { n: minutes });
}

/**
 * @description One line for a passage: "C1 → Chantepie · 3 min (+2 min late)".
 * @param {object|null} passage - The passage, null when none.
 * @param {object} options - `{ language, now, timeZone }`.
 * @returns {string} The text.
 */
function passageText(passage, options) {
  if (!passage) {
    return t('noPassage', options.language);
  }
  const notes = [
    passage.reliable ? '' : t('timetable', options.language),
    passage.delay > 0 ? t('delayNote', options.language, { n: passage.delay }) : '',
  ].filter(Boolean);
  const head = passage.destination ? `${passage.line} → ${passage.destination}` : passage.line;
  const time = passageShort(passage, options);
  return `${head} · ${time}${notes.length ? ` (${notes.join(', ')})` : ''}`;
}

export {
  LANGUAGES,
  TEXTS,
  isLanguage,
  t,
  all,
  lineStateText,
  equipmentKindText,
  passageWhen,
  passageShort,
  passageText,
};
