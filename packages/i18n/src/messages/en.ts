import type { Messages } from './tr'

export const en: Messages = {
  meta: {
    description:
      'Public live flight tracking focused on Türkiye: aircraft positions, airports and runways.',
  },
  nav: {
    map: 'Map',
    airports: 'Airports',
    status: 'Status',
    changelog: 'What’s new',
    about: 'About',
    language: 'Language',
    switchTo: 'Türkçe',
    mainLabel: 'Main menu',
  },
  seo: {
    home: {
      title: 'Live flight tracker and aircraft map for Türkiye',
      description:
        'Live position, altitude and speed of aircraft over Türkiye, from ADS-B. No schedules, delays or gate data. Live flight data: ADSB.lol (ODbL).',
    },
    airports: {
      title: 'Airports in Türkiye: IATA and ICAO codes',
      description:
        'IATA and ICAO codes, provinces, longest runways and scheduled service for {count} airports in Türkiye, each with a link to the live map. Source: OurAirports.',
    },
    airport: {
      title: '{name} ({iata}/{icao}) live air traffic and runways',
      description: '{name}, {province}: {facts}. {live}',
      descriptionNoFacts: '{name}, {province}. {live}',
      liveCovered: 'See nearby aircraft on the live map; no schedule data.',
      liveOutside: 'Outside the live data fetch area; no schedule data.',
      runwaysOne: 'one runway, {length}',
      runwaysMany: '{count} runways, longest {length}',
      runwaysCount: '{count} runways',
      elevation: 'elevation {elevation}',
    },
    about: {
      title: 'About: data sources and method',
      description:
        'How {app} works: the ADS-B source of live positions, data sources and licences, aircraft privacy rules and the limits of ADS-B.',
    },
    changelog: {
      description: 'What arrived in each version, with links to the pages added in that version.',
    },
    status: {
      description: 'App version, server connection and roadmap progress.',
    },
    terms: {
      description:
        'Terms of use: data licences (ODbL), map imagery (Esri), acceptable use and aircraft privacy.',
    },
    ogTagline: 'Live flight tracking',
  },
  airports: {
    title: 'Airports in Türkiye',
    summary:
      'The list has {count} airports: according to OurAirports, {scheduled} have scheduled service; {stations} are monitored stations.',
    scope:
      'It includes large and medium airports with an IATA code and small airports that OurAirports records as having scheduled service; other small airports are not listed.',
    names:
      'Official Turkish names come from DHMİ and the airport operators; the English names shown here are translations of them. Airports whose official name could not be confirmed are shown with their OurAirports name.',
    caption: 'Airports, sorted by province',
    columns: {
      name: 'Airport',
      province: 'Province',
      iata: 'IATA',
      icao: 'ICAO',
      longestRunway: 'Longest runway',
      scheduled: 'Scheduled service (OurAirports)',
      station: 'Monitored station',
    },
    empty: 'Airport data has not loaded yet. Please try again shortly.',
  },
  airport: {
    breadcrumbLabel: 'Breadcrumb',
    country: 'Türkiye',
    location: '{province}, Türkiye',
    lead: {
      runwaysOne: 'The airport has a single runway, {designator}, {length} long.',
      runwaysMany: 'The airport has {count} runways; the longest is {designator} at {length}.',
      runwaysCount: 'The airport has {count} runways.',
      elevation: 'Its elevation is {elevation}.',
      scheduled: 'According to OurAirports, it has scheduled airline service.',
      unscheduled:
        'OurAirports does not record scheduled airline service here; this may be out of date.',
      otherOne: 'Other airport in {province} province: {airports}.',
      otherMany: 'Other airports in {province} province: {airports}.',
    },
    facts: {
      heading: 'Key facts',
      iata: 'IATA code',
      icao: 'ICAO code',
      type: 'Type',
      province: 'Province',
      municipality: 'Municipality served',
      sourceName: 'Name in OurAirports',
      reference: 'Airport reference point',
      elevation: 'Elevation',
      scheduled: 'Scheduled service (OurAirports)',
      station: 'Monitored station',
      runways: 'Runways',
    },
    types: {
      large_airport: 'Large airport',
      medium_airport: 'Medium airport',
      small_airport: 'Small airport',
    },
    yes: 'Yes',
    notRecorded: 'Not recorded',
    stationYes: 'Yes',
    stationPrimary: 'Yes, primary station',
    stationNo: 'No',
    hemisphere: {
      n: 'N',
      s: 'S',
      e: 'E',
      w: 'W',
    },
    runways: {
      heading: 'Runways',
      caption: 'Runways at {name}',
      designator: 'Runway',
      length: 'Length',
      width: 'Width',
      surface: 'Surface',
      lighting: 'Lighting',
      bearing: 'True bearing',
      displaced: 'Displaced runway threshold',
      bearingNote:
        'Bearings are relative to true north; runway names come from the magnetic bearing.',
      displacedNote:
        'A displaced runway threshold means landings start this far along the runway rather than at its beginning.',
    },
    live: {
      heading: 'Live air traffic',
      open: 'Open on the live map',
      station:
        '{app} monitors this airport: aircraft within {radius} of the airport reference point are updated with priority.',
      stationPrimary:
        'It is the primary station: data within {radius} of the airport reference point is updated most often.',
      notStation:
        'Arrival monitoring is not yet enabled for this airport. It is inside the live data fetch area, so nearby aircraft appear on the live map (coverage depends on ADS-B receivers).',
      outside:
        'Arrival monitoring is not enabled for this airport, and it is outside the live data fetch area: no data is fetched for aircraft around it, so they may not appear on the live map.',
    },
    nearby: {
      heading: 'Nearest airports',
      item: '{airport}, {province}: {distance}',
      note: 'Distances are straight-line distances between airport reference points.',
    },
    limits:
      'This page has no schedule, delay, gate or cancellation data. For the limits of ADS-B and the data sources, {about}.',
    limitsLink: 'see the About page',
    source: 'Airport and runway data: {source} (public domain) · last changed {date}',
    /** The English name is a translation of the official Turkish name `{name}` (airport-names.ts). */
    nameSource: {
      dhmi: 'Official Turkish name: {name} (DHMİ); the English name is a translation.',
      operator:
        'Official Turkish name: {name} (airport operator); the English name is a translation.',
      ourairports: 'Name: OurAirports',
    },
  },
  surface: {
    asphalt: 'Asphalt',
    concrete: 'Concrete',
    mixed: 'Mixed surface',
    paved: 'Paved',
    grass: 'Grass',
    dirt: 'Dirt',
    gravel: 'Gravel',
    water: 'Water',
    unknown: 'Unknown',
  },
  about: {
    title: 'About',
    intro:
      '{app} is a public, free live flight tracking site focused on Türkiye. It is built and run by {owner}.',
    shows: {
      heading: 'What it shows',
      map: 'Live map: aircraft position, altitude, ground speed, vertical rate and identity (flight number, callsign, registration, aircraft type).',
      search:
        'Search: find an airborne aircraft by flight number, callsign, registration or hex code.',
      airports: 'Airports: codes, runways and nearest airports for the airports in Türkiye.',
    },
    limits: {
      heading: 'What it does not show',
      intro:
        'ADS-B only provides position, altitude, speed and identity. Without schedule data, the following are not available:',
      times: 'scheduled departure and arrival times',
      delays: 'delays, gates, terminals, baggage, codeshares and cancellations',
      board: 'a departures board before take-off',
      search: 'searching by flight number before take-off for flights with alphanumeric callsigns',
    },
    method: {
      heading: 'Method',
      adsb: 'Aircraft positions come from the ADS-B signals that aircraft broadcast and, for some aircraft, from multilateration (MLAT), which computes the position from several receivers’ measurements. The {source} network, which collects these signals from receivers on the ground, is the only live data source.',
      coverage:
        'Coverage depends on receivers: aircraft at low altitude or on the ground may be missing in some areas.',
      freshness:
        'Target data age: about 20 s within {radius} of the primary station, about 30 s around the other monitored airports and about 90 s in the data fetch area over eastern Türkiye. The status line on the map shows the actual data age around the primary station (or, if that is unavailable, the age of the newest data); the area you are viewing may differ.',
      stations: 'Monitored airports:',
      outside:
        'Airports outside the live data fetch area; aircraft around them may not appear on the map:',
      primary: 'primary station',
      reference:
        'Airport and runway data is updated daily from OurAirports. Runway bearings are true bearings, computed from the runway end coordinates where available.',
    },
    sources: {
      heading: 'Data sources and licences',
      live: 'Live aircraft positions: {source}, licensed under the {license}.',
      derived:
        'The stored position and track data is a database derived from it and stays under the ODbL.',
      reference: 'Airport and runway data: {source}, public domain.',
      names:
        'Official Turkish airport names: the DHMİ and airport operator websites (English names are translations of them); OurAirports where a name could not be confirmed.',
      airlines: 'Airline codes: {source}, CC0 (no attribution required; credited as a courtesy).',
      vector:
        'Vector map: {openFreeMap} © {openMapTiles}, map data © {openStreetMap} contributors (ODbL).',
      satellite: 'Satellite imagery (when shown): {esri}.',
    },
    privacy: {
      heading: 'Aircraft privacy',
      military: 'Military aircraft are not shown on the map, in search or in the API.',
      registration: 'Registrations of aircraft in the PIA or LADD programmes are not shown.',
      blocklist:
        'Aircraft on the administrator’s blocklist are not shown on the map, in search or in the API.',
    },
    more: {
      heading: 'More information',
      terms: '{link}: data licences, map imagery and acceptable use.',
      changelog: '{link}: what arrived in each version.',
    },
  },
  map: {
    title: 'Live map',
    mapLabel: 'Live flight map',
    webglUnavailable:
      'This browser cannot draw the map (WebGL2 is unsupported or turned off). You can still find aircraft with the search box and the aircraft list.',
    loading: 'Loading map…',
    nav: 'Map',
    dataAttributionPrefix: 'Live flight data:',
    termsLink: 'Terms',
    search: {
      label: 'Search aircraft',
      placeholder: 'Flight number, callsign, registration or hex',
      submit: 'Search',
      searching: 'Searching…',
      notFound:
        'This flight is not airborne right now or is flying under a different callsign; try searching by registration.',
      error: 'Search is not available right now. Try again shortly.',
      rateLimited: 'Too many searches in a short time. Try again in a minute.',
      pick: 'More than one aircraft matched; pick one.',
      flightNumberNote:
        'The flight number is derived from the callsign the aircraft broadcasts. Flights that use an alphanumeric callsign (e.g. THY4KN) cannot be found by flight number; search by callsign or registration.',
      results: 'Search results',
    },
    card: {
      close: 'Close',
      follow: 'Centre on aircraft',
      following: 'The map keeps this aircraft centred.',
      flight: 'Flight number',
      callsign: 'Callsign',
      registration: 'Registration',
      type: 'Aircraft type',
      altitude: 'Altitude',
      speed: 'Ground speed',
      verticalRate: 'Vertical speed',
      track: 'Track',
      squawk: 'Transponder code',
      lastSeen: 'Last seen',
      secondsAgo: '{s} s ago',
      minutesAgo: '{m} min ago',
      source: 'Data source',
      positionSource: 'Position source',
      hex: 'Hex code',
      sources: {
        adsbLol: 'ADSB.lol',
        localReceiver: 'Local receiver',
      },
    },
    table: {
      caption: 'Aircraft visible on the map',
      captionLimited: 'Aircraft visible on the map (first {shown} of {total})',
      flight: 'Flight',
      type: 'Type',
      altitude: 'Altitude',
      speed: 'Speed',
      position: 'Position',
      empty: 'No aircraft are visible in this area right now.',
      show: 'Show aircraft list',
      hide: 'Hide aircraft list',
      select: 'Select {flight}',
    },
    labels: {
      button: 'Labels',
      title: 'Label settings',
      selected: 'Selected aircraft',
      others: 'Other aircraft',
      hidden: 'Hide',
      short: 'Short',
      full: 'Full',
      hint: 'Short: flight number only. Full: flight number, speed and altitude.',
    },
    status: {
      freshness: 'Data age {s} s',
      connecting: 'Connecting to live data…',
      reconnecting: 'Connection lost; reconnecting…',
      offline:
        'Cannot reach the live data server. Check your internet connection; we keep retrying.',
      noProvider:
        'The live data source is switched off right now; no aircraft are shown on the map.',
      providerDegraded: 'The live data source is slow; positions may arrive late.',
      providerDown:
        'The live data source is not responding; positions on the map may be out of date.',
      coverageNone: 'This area is outside our coverage; no aircraft appear here.',
      coveragePartial: 'Part of this area is outside our coverage; some aircraft may be missing.',
      basemapFailed: 'The base map could not be loaded.',
    },
  },
  status: {
    title: 'System status',
    intro: 'App version, server connection and roadmap progress.',
    appVersion: 'App version',
    build: 'Build',
    environment: 'Environment',
    api: 'Server (API)',
    apiOk: 'Running',
    apiDown: 'Server unreachable',
    apiDownHint: 'To start it locally, run “pnpm dev” in the project folder.',
    apiVersion: 'Server version',
    checkedAt: 'Checked at',
    roadmap: 'Roadmap',
    progress: '{done} of {total} milestones done',
    milestoneStatus: {
      done: 'Done',
      in_progress: 'In progress',
      planned: 'Planned',
    },
    part: 'Part',
  },
  changelog: {
    title: 'What’s new',
    intro:
      'Follow what arrived in each version. Use the links to try the pages added in that version right away.',
    current: 'Current version',
    tryIt: 'Try it',
    released: 'Released',
  },
  admin: {
    title: 'Administration',
    loginTitle: 'Admin sign-in',
    loginIntro: 'The admin panel and the analytics panel use the same admin account.',
    email: 'Email',
    password: 'Setup key',
    submit: 'Sign in',
    logout: 'Sign out',
    loginFailed: 'Wrong email or setup key.',
    loginRateLimited: 'Too many attempts. Try again in a minute.',
    loginDisabled:
      'Admin sign-in is disabled on this server. ADMIN_EMAIL and ADMIN_SETUP_TOKEN (at least 12 characters) must both be set and REDIS_QUEUE_URL must be reachable. The API logs say why.',
    loginUnavailable: 'Could not reach the server. Check that the API is running.',
    servicesTitle: 'Services',
    servicesIntro: 'Live status of every service. The page checks again each time it opens.',
    overall: 'Overall status',
    refresh: 'Check again',
    openAnalytics: 'Open analytics panel',
    columns: {
      service: 'Service',
      state: 'Status',
      version: 'Version',
      latency: 'Latency',
      detail: 'Details',
    },
    states: {
      ok: 'Running',
      degraded: 'Degraded',
      down: 'Down',
      not_configured: 'Not configured',
    },
    services: {
      web: 'Web',
      api: 'API',
      workerRt: 'Worker (real-time)',
      workerBg: 'Worker (background)',
      workerOther: 'Worker',
      postgres: 'PostgreSQL',
      redisQueue: 'Redis (queue)',
      redisLive: 'Redis (live state)',
      analytics: 'Analytics (Siteni Analiz Et)',
      referenceData: 'Reference data (airports, runways, airlines)',
      trackPartitions: 'Track tables (daily partitions)',
      providerAdsbLol: 'Live data · adsb.lol',
      providerLocalReceiver: 'Live data · local receiver',
    },
    detail: {
      memory: 'Memory',
      heartbeatAge: 'Last signal',
      roles: 'Roles',
      gitSha: 'Build',
      uptime: 'Uptime',
      httpStatus: 'HTTP',
      error: 'Error',
      secondsAgo: '{n} s ago',
      seconds: '{n} s',
      megabytes: '{used} / {max} MB',
      counts: '{airports} airports · {runways} runways · {airlines} airlines',
      lastCheck: 'Last check',
      hoursAgo: '{n} h ago',
      origin: 'Source',
      originRemote: 'OurAirports and VRS (daily)',
      originFixture: 'Committed subset (local development)',
      daysAhead: 'Days prepared ahead',
      oldestDay: 'Oldest day',
      defaultRows: 'Rows in DEFAULT partition (should be 0)',
      minutesAgo: '{n} min ago',
      daysAgo: '{n} days ago',
      rps: 'Rate (requests/s)',
      freshnessP95: 'Freshness p95',
      errorRatio: 'Error rate (60 s)',
      rateLimited1h: '429 ratio (1 h)',
      rateLimited24h: '429 ratio (24 h)',
      circuit: 'Circuit',
      lastSuccess: 'Last successful response',
      never: 'none',
      healthRecord: 'Last health record',
      circuitStates: {
        closed: 'closed (normal)',
        open: 'open',
        half_open: 'half-open',
        config: 'configuration error',
      },
    },
    fetchFailed: 'Could not load the service report. The API may be unreachable.',
  },
  consent: {
    title: 'Consent for analytics',
    body: 'We measure visit statistics with our own analytics app to improve the site. This stores a random visitor ID in your browser. If you do not consent, nothing is measured.',
    accept: 'Accept',
    reject: 'Reject',
    settings: 'Analytics preferences',
  },
  errors: {
    notFoundTitle: 'Page not found',
    notFoundBody:
      'The page you are looking for does not exist or has moved. Continue from the live map.',
    goToMap: 'Back to the map',
  },
  terms: {
    title: 'Terms of use',
    effective: 'Effective date: {date}',
    interim:
      'This is an interim text; full terms of use and a privacy policy will be published soon.',
    service: {
      heading: 'The service',
      about:
        '{app} is a public, free flight tracking service focused on Türkiye. Aircraft positions come from the ADS-B signals that aircraft broadcast, for some aircraft from multilateration (MLAT), and are for information only.',
      notOperational:
        'Do not use the service for operational, navigation or flight safety decisions.',
      noWarranty:
        'We do not guarantee that the data is accurate, complete or always available; the service is provided “as is”.',
    },
    data: {
      heading: 'Data',
      live: 'Live aircraft positions come from {source} and are licensed under the {license}.',
      odbl: 'These terms do not restrict the rights the ODbL gives you over data derived from ADS-B.',
      airports: 'Airport data comes from {source} and is in the public domain.',
    },
    map: {
      heading: 'Map imagery',
      esri: 'When the satellite map is shown, its imagery is provided by Esri. By using the map you agree to comply with Esri’s applicable terms: the {platform} and the {productTerms}.',
      esriPlatform: 'ArcGIS Location Platform agreement (E204)',
      esriProductTerms: 'Product-Specific Terms of Use (E300)',
      tiles:
        'Satellite map tiles (Esri) are for viewing on this site only: you may not download, scrape, cache or store them (beyond your browser’s standard cache) or redistribute them.',
      vector:
        'When the vector map is shown, it is provided by {openFreeMap} or a backup vector map. Map data: © {openMapTiles}, © {openStreetMap} contributors (ODbL).',
    },
    use: {
      heading: 'Acceptable use',
      bulk: 'Do not use automated tools to collect data in bulk from the site or the API beyond the rate limits the API reports.',
      disrupt: 'Do not attempt to disrupt the service.',
    },
    privacy: {
      heading: 'Aircraft privacy',
      military: 'Military aircraft are not shown on the map, in search or in the API.',
      registration: 'Registrations of aircraft in the PIA or LADD programmes are not shown.',
    },
    code: {
      heading: 'Source code and name',
      license: 'The app’s source code is licensed under the MIT License.',
    },
    changes: {
      heading: 'Changes',
      body: 'These terms may be updated; when they are, the effective date above changes.',
    },
  },
  legal: {
    owner: '{app} · © {year} {owner} ({ownerUrl}) · Source code: {repoUrl}',
    license:
      'The code of this software is licensed under the MIT License. All copies or substantial portions of the code must include the copyright notice and the MIT license text (LICENSE).',
    violation:
      'Copying or distributing it without that notice and license text infringes the license and the copyright; the copyright holder may take legal action under Turkish Law No. 5846 on Intellectual and Artistic Works and international copyright law.',
    brand:
      'The “{app}” name and logo are not covered by the MIT License; rights reserved. Third-party data keeps its own license.',
  },
}
