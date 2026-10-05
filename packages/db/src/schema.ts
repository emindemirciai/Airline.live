// Drizzle şeması (Parça 1 M2). Partition'lı iz tabloları için yöntem docs/spec/infra.md →
// "Migration": parent tablolar burada tip güvenliği için tanımlanır; üretilen CREATE TABLE elle
// `PARTITION BY RANGE ("ts")` ile düzenlenir. Çocuk partition'lar ve DEFAULT partition şemada
// yoktur (packages/db/drizzle altındaki özel migration ve src/partitions.ts).
import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  type PgColumn,
} from 'drizzle-orm/pg-core'

const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()

/** OurAirports airports.csv (kamu malı). `id` OurAirports kimliğidir. */
export const airports = pgTable(
  'airports',
  {
    id: integer('id').primaryKey(),
    // Kaynakta tekildir ama tekil kısıt konmaz: bir kod başka kayda geçtiğinde (eski kayıt yeni
    // koda, yeni kayıt eski koda) aynı içe aktarımda geçici çakışma olur ve içe aktarım her gün
    // başarısız olurdu. Tam anlık görüntü yazıldığı için sonuç yine tekildir (D-066).
    ident: text('ident').notNull(),
    type: text('type').notNull(),
    name: text('name').notNull(),
    latitudeDeg: doublePrecision('latitude_deg').notNull(),
    longitudeDeg: doublePrecision('longitude_deg').notNull(),
    elevationFt: integer('elevation_ft'),
    isoCountry: text('iso_country').notNull(),
    isoRegion: text('iso_region').notNull(),
    municipality: text('municipality'),
    scheduledService: boolean('scheduled_service').notNull(),
    icaoCode: text('icao_code'),
    iataCode: text('iata_code'),
    gpsCode: text('gps_code'),
    /** Kaynak satırın özeti; değişmeyen satır yeniden yazılmaz. */
    rowHash: text('row_hash').notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('airports_ident_idx').on(t.ident),
    index('airports_icao_code_idx').on(t.icaoCode),
    index('airports_iata_code_idx').on(t.iataCode),
  ],
)

/**
 * OurAirports runways.csv (kapalı pistler alınmaz); eşikler içe aktarımda hesaplanır (domain.md, D-066).
 * `*_bearing_source`: 'coordinates' | 'heading_field'.
 * `*_threshold_source`: 'runway_end' | 'displaced_threshold' | 'arp_fallback'.
 */
export const runways = pgTable(
  'runways',
  {
    id: integer('id').primaryKey(),
    airportId: integer('airport_id')
      .notNull()
      .references(() => airports.id, { onDelete: 'cascade' }),
    airportIdent: text('airport_ident').notNull(),
    lengthFt: integer('length_ft'),
    widthFt: integer('width_ft'),
    surface: text('surface'),
    lighted: boolean('lighted').notNull(),
    /** Uç koordinatları zaten kaydırılmış eşik (D-066). */
    endsAreThresholds: boolean('ends_are_thresholds').notNull().default(false),
    leIdent: text('le_ident'),
    leLatitudeDeg: doublePrecision('le_latitude_deg'),
    leLongitudeDeg: doublePrecision('le_longitude_deg'),
    leElevationFt: integer('le_elevation_ft'),
    leHeadingDegT: real('le_heading_deg_t'),
    leDisplacedThresholdFt: integer('le_displaced_threshold_ft'),
    leTrueBearingDeg: real('le_true_bearing_deg'),
    leBearingSource: text('le_bearing_source'),
    leHeadingMismatch: boolean('le_heading_mismatch').notNull().default(false),
    leThresholdLat: doublePrecision('le_threshold_lat').notNull(),
    leThresholdLon: doublePrecision('le_threshold_lon').notNull(),
    leThresholdSource: text('le_threshold_source').notNull(),
    heIdent: text('he_ident'),
    heLatitudeDeg: doublePrecision('he_latitude_deg'),
    heLongitudeDeg: doublePrecision('he_longitude_deg'),
    heElevationFt: integer('he_elevation_ft'),
    heHeadingDegT: real('he_heading_deg_t'),
    heDisplacedThresholdFt: integer('he_displaced_threshold_ft'),
    heTrueBearingDeg: real('he_true_bearing_deg'),
    heBearingSource: text('he_bearing_source'),
    heHeadingMismatch: boolean('he_heading_mismatch').notNull().default(false),
    heThresholdLat: doublePrecision('he_threshold_lat').notNull(),
    heThresholdLon: doublePrecision('he_threshold_lon').notNull(),
    heThresholdSource: text('he_threshold_source').notNull(),
    rowHash: text('row_hash').notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [index('runways_airport_id_idx').on(t.airportId)],
)

/**
 * Yöneticinin pist düzeltmeleri (data-sources.md §3); içe aktarım bu tabloya dokunmaz. Anahtar
 * OurAirports pist kimliğidir; pist kaynaktan kalksa da düzeltme kaybolmasın diye yabancı anahtar
 * yoktur. Boş alan, içe aktarılan değerin kullanılacağı anlamına gelir.
 */
export const runwayOverrides = pgTable('runway_overrides', {
  runwayId: integer('runway_id').primaryKey(),
  leThresholdLat: doublePrecision('le_threshold_lat'),
  leThresholdLon: doublePrecision('le_threshold_lon'),
  leTrueBearingDeg: real('le_true_bearing_deg'),
  heThresholdLat: doublePrecision('he_threshold_lat'),
  heThresholdLon: doublePrecision('he_threshold_lon'),
  heTrueBearingDeg: real('he_true_bearing_deg'),
  note: text('note'),
  updatedBy: text('updated_by'),
  updatedAt: updatedAt(),
})

/** Takip edilen istasyonlar (tohum: IST birincil, SAW, ESB, ADB, AYT). */
export const stations = pgTable(
  'stations',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    icao: text('icao').notNull().unique(),
    iata: text('iata').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    isPrimary: boolean('is_primary').notNull().default(false),
    /** Veri çekimi için ARP merkezli çember (domain.md: 60 NM). */
    fetchRadiusNm: real('fetch_radius_nm').notNull().default(60),
    /** Varsayılan uyarı mesafesi (domain.md: 10 km). */
    defaultAlertDistanceKm: real('default_alert_distance_km').notNull().default(10),
    /** EGM96 geoid ondülasyonu (m); bilinmiyorsa null (AGL yöntemi sıradakine düşer). */
    geoidUndulationM: real('geoid_undulation_m'),
    /**
     * Son 7 günde yerde örneği görülen varışların oranı; varış yoksa null (günlük
     * `arrival-coverage-ratio-7d` işi yazar, D-098).
     */
    coverageGroundRatio7d: real('coverage_ground_ratio_7d'),
    /** Oranın paydası: son 7 günde sayılan varışlar (aynı iş). */
    coverageArrivals7d: integer('coverage_arrivals_7d'),
    /** Oranın ve varış sayısının son yazıldığı an; iş hiç çalışmadıysa null. */
    coverageUpdatedAt: timestamp('coverage_updated_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  // Aynı anda tek birincil istasyon.
  (t) => [
    uniqueIndex('stations_single_primary_idx')
      .on(t.isPrimary)
      .where(sql`${t.isPrimary}`),
  ],
)

/** VRS standing-data airlines.csv (CC0). `code` VRS anahtarıdır; ICAO boş olabilir. */
export const airlines = pgTable(
  'airlines',
  {
    code: text('code').primaryKey(),
    name: text('name').notNull(),
    icao: text('icao'),
    iata: text('iata'),
    positioningFlightPattern: text('positioning_flight_pattern'),
    charterFlightPattern: text('charter_flight_pattern'),
    rowHash: text('row_hash').notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [index('airlines_icao_idx').on(t.icao), index('airlines_iata_idx').on(t.iata)],
)

/** Yöneticinin havayolu düzeltmeleri; içe aktarım bu tabloya dokunmaz. */
export const airlineOverrides = pgTable('airline_overrides', {
  code: text('code').primaryKey(),
  name: text('name'),
  icao: text('icao'),
  iata: text('iata'),
  note: text('note'),
  updatedBy: text('updated_by'),
  updatedAt: updatedAt(),
})

/** Uçuş kaydı: aynı hex'in kesintisiz bir uçuşu (domain.md → Uçuş kaydı). */
export const flights = pgTable(
  'flights',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    hex: text('hex').notNull(),
    callsign: text('callsign'),
    registration: text('registration'),
    typeCode: text('type_code'),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull(),
    /** 'active' | 'ended' */
    status: text('status').notNull().default('active'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('flights_hex_last_seen_idx').on(t.hex, t.lastSeenAt),
    index('flights_callsign_idx').on(t.callsign),
    index('flights_active_idx')
      .on(t.lastSeenAt)
      .where(sql`${t.status} = 'active'`),
  ],
)

/**
 * Konum örnekleri; parent tablo `PARTITION BY RANGE (ts)`, günlük partition'lar (infra.md).
 * Geometry sütunu yoktur; `flight_id` için yabancı anahtar yazma hızı için konmaz.
 */
const trackPoints = (name: string) =>
  pgTable(
    name,
    {
      flightId: bigint('flight_id', { mode: 'number' }).notNull(),
      ts: timestamp('ts', { withTimezone: true }).notNull(),
      lat: doublePrecision('lat').notNull(),
      lon: doublePrecision('lon').notNull(),
      altBaroFt: integer('alt_baro_ft'),
      altGeomFt: integer('alt_geom_ft'),
      gsKt: real('gs_kt'),
      trackDeg: real('track_deg'),
      /** Görünen dikey hız: barometrik, yoksa geometrik (fpm). */
      verticalRateFpm: integer('vertical_rate_fpm'),
      onGround: boolean('on_ground').notNull().default(false),
      /** Konum kaynağı kodu (sağlayıcı ve konum türü; M3). */
      source: smallint('source').notNull(),
      /**
       * Kaynağın bildirdiği ham `seen_pos` (sn): örnekteki konumun yaşı. Kaynak göndermediyse
       * null; `seen` yerine konmaz. 0006'dan önceki satırlarda null (D-097).
       */
      seenPosS: real('seen_pos_s'),
      /**
       * Kaynağın bildirdiği ham barometrik dikey hız (fpm); yoksa null, geometrik hız yerine
       * konmaz. 0006'dan önceki satırlarda null (D-097).
       */
      baroRateFpm: integer('baro_rate_fpm'),
    },
    (t) => [
      primaryKey({ columns: [t.flightId, t.ts] }),
      index(`${name}_ts_brin`).using('brin', t.ts),
    ],
  )

export const trackPointsSampled = trackPoints('track_points_sampled')
export const trackPointsFine = trackPoints('track_points_fine')

/** Sağlayıcıların anlık sağlık durumu (admin Servisler paneli ve kesinti bastırma). */
export const providerHealth = pgTable('provider_health', {
  provider: text('provider').primaryKey(),
  /** 'ok' | 'degraded' | 'down' (data-sources.md) */
  status: text('status').notNull(),
  lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
  lastErrorAt: timestamp('last_error_at', { withTimezone: true }),
  lastError: text('last_error'),
  consecutiveFailures: integer('consecutive_failures').notNull().default(0),
  /** Hız kovasının anlık hızı (istek/sn); kovası olmayan sağlayıcıda null (D-073). */
  rps: real('rps'),
  /** Devre kesici: 'closed' | 'open' | 'half_open' | 'config' (D-073). */
  circuit: text('circuit').notNull().default('closed'),
  /** 429 ya da hata sonrası bekleme bitişi; beklemede değilse null. */
  backoffUntil: timestamp('backoff_until', { withTimezone: true }),
  /** Birincil istasyon verisinin yaşı, son 5 dk p95 (sn). */
  freshnessP95S: real('freshness_p95_s'),
  /** Son 60 sn'de (429/420 + 5xx) / bütün istekler; istek yoksa null. */
  errorRatio60s: real('error_ratio_60s'),
  requests60s: integer('requests_60s').notNull().default(0),
  updatedAt: updatedAt(),
})

/**
 * Sağlayıcı başına saatlik istek sayaçları (D-073). Worker dakikada bir ekleyerek yazar; admin
 * paneli son 1 ve 24 saatteki 429 oranını buradan hesaplar.
 */
export const providerHealthHourly = pgTable(
  'provider_health_hourly',
  {
    provider: text('provider').notNull(),
    /** Saatin başı (UTC, `date_trunc('hour', …)`). */
    hour: timestamp('hour', { withTimezone: true }).notNull(),
    requests: integer('requests').notNull().default(0),
    successes: integer('successes').notNull().default(0),
    /** 429/420 yanıtları. */
    rateLimited: integer('rate_limited').notNull().default(0),
    serverErrors: integer('server_errors').notNull().default(0),
    networkErrors: integer('network_errors').notNull().default(0),
    otherErrors: integer('other_errors').notNull().default(0),
    /** Saat içindeki en yüksek tazelik p95 (sn). */
    freshnessP95MaxS: real('freshness_p95_max_s'),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.provider, t.hour] })],
)

/** Sağlayıcı durum geçişleri ('ok' | 'degraded' | 'down'); ilk kayıtta `from_status` null'dır. */
export const providerStatusChanges = pgTable(
  'provider_status_changes',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    provider: text('provider').notNull(),
    at: timestamp('at', { withTimezone: true }).notNull(),
    fromStatus: text('from_status'),
    toStatus: text('to_status').notNull(),
    reason: text('reason'),
  },
  (t) => [index('provider_status_changes_provider_at_idx').on(t.provider, t.at)],
)

/**
 * Referans verisi kaynaklarının durumu: koşullu indirme (ETag / Last-Modified), son içe aktarım
 * ve son hata. Admin Servisler paneli buradan okur.
 */
export const referenceSources = pgTable('reference_sources', {
  source: text('source').primaryKey(),
  /** 'remote' | 'fixture' (EXTERNAL_PROVIDERS_DISABLED iken commit'li alt küme). */
  origin: text('origin').notNull(),
  etag: text('etag'),
  lastModified: text('last_modified'),
  /** Son başarılı kontrol (304 dahil). */
  checkedAt: timestamp('checked_at', { withTimezone: true }),
  /** İçeriğin son içe aktarıldığı an. */
  importedAt: timestamp('imported_at', { withTimezone: true }),
  rowCount: integer('row_count'),
  skippedCount: integer('skipped_count'),
  lastError: text('last_error'),
  lastErrorAt: timestamp('last_error_at', { withTimezone: true }),
  updatedAt: updatedAt(),
})

/** İstasyon kodu denetimi (ICAO: dört büyük harf ya da rakam). */
const stationIcaoCheck = (name: string, column: PgColumn) =>
  check(name, sql`${column} ~ '^[A-Z0-9]{4}$'`)

/**
 * METAR/SPECI kaydı (D-078): her farklı rapor saklanır (geçmiş listesi), 30 gün sonra silinir.
 * Anahtar `(station_icao, observed_at, report_type)`; aynı anahtarla gelen düzeltilmiş rapor (COR)
 * metnin yerine geçer. Ham metin asıl veridir, kod çözme okurken yapılır. Havalimanı tablosuna
 * yabancı anahtar yoktur (referans içe aktarımı serbestçe yazar; listeden çıkan istasyon silinir).
 */
export const weatherMetar = pgTable(
  'weather_metar',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    stationIcao: text('station_icao').notNull(),
    /** 'METAR' | 'SPECI' */
    reportType: text('report_type').notNull(),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
    rawText: text('raw_text').notNull(),
    /** Ham metindeki QNH (hPa); Parça 2 AGL hesabı yalnızca 90 dk'dan yeni gözlemde kullanır. */
    qnhHpa: real('qnh_hpa'),
    /** AWC uçuş kategorisi (ABD sınıflandırması); yalnızca uzman görünüm. */
    flightCategory: text('flight_category'),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // Tekil anahtar ve tek dizin. Sıra en yeni rapor ve geçmiş sorgularının `ORDER BY observed_at
    // DESC, report_type DESC` sırasıyla birebir aynıdır (PostgreSQL'de DESC = NULLS FIRST); sıralama
    // adımı olmadan dizin taranır (weather.int.test.ts → EXPLAIN). Aynı anda SPECI METAR'dan önce.
    uniqueIndex('weather_metar_station_observed_type_idx').on(
      t.stationIcao,
      t.observedAt.desc().nullsFirst(),
      t.reportType.desc().nullsFirst(),
    ),
    stationIcaoCheck('weather_metar_station_icao_check', t.stationIcao),
    check('weather_metar_report_type_check', sql`${t.reportType} in ('METAR', 'SPECI')`),
  ],
)

/** TAF kaydı: her farklı `(station_icao, issued_at)`; geçerliliği bittikten 30 gün sonra silinir. */
export const weatherTaf = pgTable(
  'weather_taf',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    stationIcao: text('station_icao').notNull(),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull(),
    validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
    validTo: timestamp('valid_to', { withTimezone: true }).notNull(),
    rawText: text('raw_text').notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // Tekil anahtar; `ORDER BY issued_at DESC` (NULLS FIRST) sırasıyla aynı.
    uniqueIndex('weather_taf_station_issued_idx').on(t.stationIcao, t.issuedAt.desc().nullsFirst()),
    stationIcaoCheck('weather_taf_station_icao_check', t.stationIcao),
    check('weather_taf_valid_range_check', sql`${t.validTo} > ${t.validFrom}`),
  ],
)

/**
 * Hava durumu kaynaklarının durumu (`metar` | `taf`): son başarılı kontrol, son hata ve AWC
 * engeli. `reference_sources`'tan ayrıdır (referans telafisi orada tam üç satır bekler) ve
 * `provider_health`'ten ayrıdır (o tablo 180 sn'de eskir; hava durumu 5–15 dk'da bir çalışır).
 */
export const weatherSources = pgTable('weather_sources', {
  kind: text('kind').primaryKey(),
  /** 'remote' | 'fixture' | 'disabled' */
  origin: text('origin').notNull(),
  /** origin = 'disabled' iken nedeni (ör. EXTERNAL_PROVIDERS_DISABLED üretim imajında). */
  disabledReason: text('disabled_reason'),
  /** Son başarılı kontrol (204 dahil). */
  checkedAt: timestamp('checked_at', { withTimezone: true }),
  stationCount: integer('station_count'),
  reportCount: integer('report_count'),
  skippedCount: integer('skipped_count'),
  lastError: text('last_error'),
  lastErrorAt: timestamp('last_error_at', { withTimezone: true }),
  /** 429 ya da 403 sonrası bu ana kadar istek atılmaz. */
  blockedUntil: timestamp('blocked_until', { withTimezone: true }),
  /** Engelin nedeni: 'rate_limit' (429) | 'forbidden' (403). */
  blockedKind: text('blocked_kind'),
  updatedAt: updatedAt(),
})

/**
 * Kapsama raporları (Parça 1 M7b.2, D-098). Admin "Raporu başlat" satırı `queued` yazar; worker'ın
 * `jobs` rolü satırı üstlenir (`running`), hesaplar ve `done` ya da `failed` yazar. Aynı anda tek
 * etkin rapor olur (danışma kilidi ve tekil kısmi dizin). Yalnızca toplamlar saklanır: hex, çağrı
 * kodu, tescil ve raporu isteyen yönetici yazılmaz. En yeni 50 satır tutulur.
 */
export const arrivalCoverageReports = pgTable(
  'arrival_coverage_reports',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    /** 'queued' | 'running' | 'done' | 'failed' */
    status: text('status').notNull().default('queued'),
    /** Pencere uzunluğu (saat). */
    hours: integer('hours').notNull(),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    /** Pencere [başlangıç, bitiş); worker üstlenirken yazar. */
    windowStart: timestamp('window_start', { withTimezone: true }),
    windowEnd: timestamp('window_end', { withTimezone: true }),
    /** Hata kodu ya da kısa ileti (en çok 500 karakter). */
    error: text('error'),
    /** `@havayolu/shared` `ArrivalCoverageResult`. */
    result: jsonb('result'),
    /** Türkçe rapor metni (docs/reports/kapsama.md içeriği). */
    markdown: text('markdown'),
    /** `ARRIVAL_COVERAGE_DEFINITION_VERSION`; worker üstlenirken yazar. */
    definitionVersion: smallint('definition_version'),
  },
  (t) => [
    index('arrival_coverage_reports_requested_at_idx').on(t.requestedAt),
    // Aynı anda en çok bir etkin (kuyrukta ya da çalışan) rapor.
    uniqueIndex('arrival_coverage_reports_single_active_idx')
      .on(sql`(true)`)
      .where(sql`${t.status} in ('queued', 'running')`),
    check(
      'arrival_coverage_reports_status_check',
      sql`${t.status} in ('queued', 'running', 'done', 'failed')`,
    ),
    check('arrival_coverage_reports_hours_check', sql`${t.hours} between 1 and 168`),
  ],
)
