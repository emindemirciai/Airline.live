// Drizzle şeması (Parça 1 M2). Partition'lı iz tabloları için yöntem docs/spec/infra.md →
// "Migration": parent tablolar burada tip güvenliği için tanımlanır; üretilen CREATE TABLE elle
// `PARTITION BY RANGE ("ts")` ile düzenlenir. Çocuk partition'lar ve DEFAULT partition şemada
// yoktur (packages/db/drizzle altındaki özel migration ve src/partitions.ts).
import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
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
    /** Son 7 günde yerde örneği görülen varışların oranı (jobs rolü yazar). */
    coverageGroundRatio7d: real('coverage_ground_ratio_7d'),
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
      verticalRateFpm: integer('vertical_rate_fpm'),
      onGround: boolean('on_ground').notNull().default(false),
      /** Konum kaynağı kodu (sağlayıcı ve konum türü; M3). */
      source: smallint('source').notNull(),
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
  updatedAt: updatedAt(),
})

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
