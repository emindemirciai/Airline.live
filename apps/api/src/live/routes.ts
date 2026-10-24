import type { AirlineCodes } from '@havayolu/db'
import {
  LIVE_DATA_LICENSE,
  type LiveDataLicense,
  type LiveResponse,
  type SearchResponse,
} from '@havayolu/shared'
import type { FastifyInstance } from 'fastify'
import { parseBbox } from './bbox'
import { searchLive } from './search'
import type { LiveSource } from './types'

export interface LiveRouteOptions {
  /** `null`: canlı önbellek yok (redis-live tanımsız) → 503. */
  source: LiveSource | null
  codes: () => AirlineCodes
  /** false iken (engel listesi henüz okunmadı) 503; verilmezse hep hazır. */
  ready?: () => boolean
}

/** IP başına hız sınırları (D-074); anahtar genel sınırla aynıdır (istemci IP'si, IPv6 /64). */
export const LIVE_RATE_LIMIT = { max: 120, timeWindow: '1 minute' } as const
export const SEARCH_RATE_LIMIT = { max: 60, timeWindow: '1 minute' } as const
/** Arama sorgusunun en uzun hâli (kırpıldıktan sonra). */
export const SEARCH_QUERY_MAX_LENGTH = 32

export const LIVE_ERRORS = {
  badBbox: {
    error: 'bad_bbox',
    message:
      'bbox "minLon,minLat,maxLon,maxLat" biçiminde olmalı; en fazla 60° boylam × 40° enlem.',
  },
  badQuery: {
    error: 'bad_query',
    message: `Arama metni 1–${SEARCH_QUERY_MAX_LENGTH} karakter olmalı.`,
  },
  unavailable: { error: 'live_unavailable', message: 'Canlı veri şu an kullanılamıyor.' },
} as const

const nullable = (type: string) => ({ type: [type, 'null'] })

/** `PublicAircraft` (types.ts); yanıt bu şemayla serileştirilir, fazla alan gönderilmez. */
const aircraftSchema = {
  type: 'object',
  required: [
    'hex',
    'lat',
    'lon',
    'alt',
    'gnd',
    'gs',
    'trk',
    'vr',
    'cs',
    'fn',
    'reg',
    'type',
    'cat',
    'sq',
    'src',
    'psrc',
    't',
  ],
  properties: {
    hex: { type: 'string', description: 'ICAO 24 bit adresi (küçük harf; ~ ICAO dışı)' },
    lat: { type: 'number' },
    lon: { type: 'number' },
    alt: { ...nullable('number'), description: 'Barometrik irtifa, ft; yerde null' },
    gnd: { type: 'boolean' },
    gs: { ...nullable('number'), description: 'Yer hızı, kt' },
    trk: { ...nullable('number'), description: 'İz yönü, derece' },
    vr: { ...nullable('number'), description: 'Dikey hız, ft/dk' },
    cs: { ...nullable('string'), description: 'Çağrı kodu' },
    fn: {
      type: ['object', 'null'],
      description: 'Çağrı kodundan çıkarılan sefer no (THY974 → TK 974)',
      required: ['airline', 'number'],
      properties: { airline: { type: 'string' }, number: { type: 'string' } },
    },
    reg: { ...nullable('string'), description: 'Tescil; PIA/LADD uçakta null' },
    type: { ...nullable('string'), description: 'ICAO tip kodu' },
    cat: { ...nullable('string'), description: 'ADS-B kategori' },
    sq: nullable('string'),
    src: { type: 'string', enum: ['adsbLol', 'localReceiver'] },
    psrc: { type: 'string', description: 'Konum kaynağı (adsb_icao, mlat …)' },
    t: { type: 'number', description: 'Örnek zamanı, UTC epoch ms' },
  },
} as const

const providerState = {
  type: 'string',
  enum: ['ok', 'limited', 'degraded', 'down'],
  description: 'limited: kaynak günlük istek bütçesiyle seyrek sorgulanıyor (D-122)',
} as const

const statusSchema = {
  type: 'object',
  required: ['providers', 'primaryAgeS', 'newestAgeS', 'layer', 'maxAgeS'],
  properties: {
    providers: {
      type: 'object',
      properties: { adsbLol: providerState, localReceiver: providerState },
    },
    primaryAgeS: { ...nullable('number'), description: 'Birincil istasyon verisinin yaşı, sn' },
    newestAgeS: { ...nullable('number'), description: 'En yeni örneğin yaşı, sn' },
    layer: {
      type: 'string',
      enum: ['on', 'off'],
      description: 'Canlı katman anahtarı; off iken hiçbir uçak sunulmaz (D-115)',
    },
    maxAgeS: {
      type: 'number',
      description: 'Uçakların sunulduğu yaş penceresi, sn; 120 sn üstü seyrek veridir (D-122)',
    },
  },
} as const

/** Canlı uçak verisinin lisansı ve atfı (ODbL 1.0, ADSB.lol; D-115). */
const licenseProperties = {
  license: { type: 'string', enum: ['ODbL-1.0'], description: 'Canlı uçak verisinin lisansı' },
  licenseUrl: { type: 'string', description: 'Lisans metni' },
  attribution: { type: 'string', enum: ['ADSB.lol'], description: 'Veri kaynağı (atıf)' },
} as const
const LICENSE_FIELDS = ['license', 'licenseUrl', 'attribution'] as const

const errorSchema = {
  type: 'object',
  required: ['error', 'message'],
  properties: { error: { type: 'string' }, message: { type: 'string' } },
} as const

/**
 * `GET /v1/live?bbox=` (kutudaki anlık görüntü) ve `GET /v1/search?q=` (canlı önbellekte arama).
 * İkisi de `LiveSource`'tan okur; gizlilik ve engel listesi kaynakta uygulanmıştır (D-074).
 * Canlı katman kapalıyken (D-115) ikisi de 200 ile boş küme ve `status.layer: "off"` döner. Her
 * yanıt canlı verinin lisansını ve atfını taşır (ODbL 1.0, ADSB.lol).
 */
export function registerLiveRoutes(
  app: FastifyInstance,
  { source: liveSource, codes, ready = () => true }: LiveRouteOptions,
): void {
  /** Sunulabilir kaynak; yoksa ya da henüz hazır değilse null (503). */
  const available = () => (liveSource !== null && ready() ? liveSource : null)
  app.get(
    '/v1/live',
    {
      config: { rateLimit: LIVE_RATE_LIMIT },
      attachValidation: true,
      schema: {
        tags: ['live'],
        summary: 'Kutudaki canlı uçaklar',
        querystring: {
          type: 'object',
          required: ['bbox'],
          properties: {
            bbox: {
              type: 'string',
              description: 'minLon,minLat,maxLon,maxLat (derece; en fazla 60° × 40°)',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            required: ['seq', 'coverage', 'status', 'aircraft', ...LICENSE_FIELDS],
            properties: {
              seq: { type: 'integer', description: 'Önbellek sayacı (WS lastSeq ile aynı)' },
              coverage: { type: 'string', enum: ['full', 'partial', 'none', 'unknown'] },
              status: statusSchema,
              aircraft: { type: 'array', items: aircraftSchema },
              ...licenseProperties,
            },
          },
          400: errorSchema,
          503: errorSchema,
        },
      },
    },
    async (request, reply) => {
      reply.header('cache-control', 'no-store')
      const { bbox: raw } = (request.query ?? {}) as { bbox?: unknown }
      const bbox =
        request.validationError === undefined && typeof raw === 'string' ? parseBbox(raw) : null
      if (bbox === null) return reply.code(400).send(LIVE_ERRORS.badBbox)
      const source = available()
      if (source === null) return reply.code(503).send(LIVE_ERRORS.unavailable)
      const body: LiveResponse & LiveDataLicense = {
        seq: source.seq(),
        coverage: source.coverage(bbox),
        status: source.status(),
        aircraft: source.snapshot(bbox),
        ...LIVE_DATA_LICENSE,
      }
      return body
    },
  )

  app.get(
    '/v1/search',
    {
      config: { rateLimit: SEARCH_RATE_LIMIT },
      attachValidation: true,
      schema: {
        tags: ['live'],
        summary: 'Canlı uçak arama (hex, tescil, sefer no, çağrı kodu)',
        querystring: {
          type: 'object',
          required: ['q'],
          properties: { q: { type: 'string', description: 'Arama metni (1–32 karakter)' } },
        },
        response: {
          200: {
            type: 'object',
            required: ['kind', 'results', 'status', ...LICENSE_FIELDS],
            properties: {
              kind: {
                type: 'string',
                enum: ['hex', 'registration', 'flight', 'callsign', 'none'],
              },
              results: { type: 'array', items: aircraftSchema },
              status: statusSchema,
              ...licenseProperties,
            },
          },
          400: errorSchema,
          503: errorSchema,
        },
      },
    },
    async (request, reply) => {
      reply.header('cache-control', 'no-store')
      const { q: raw } = (request.query ?? {}) as { q?: unknown }
      const q = request.validationError === undefined && typeof raw === 'string' ? raw.trim() : ''
      if (q === '' || q.length > SEARCH_QUERY_MAX_LENGTH) {
        return reply.code(400).send(LIVE_ERRORS.badQuery)
      }
      const source = available()
      if (source === null) return reply.code(503).send(LIVE_ERRORS.unavailable)
      const { kind, results } = searchLive(q, source, codes())
      const body: SearchResponse & LiveDataLicense = {
        kind,
        results,
        status: source.status(),
        ...LIVE_DATA_LICENSE,
      }
      return body
    },
  )
}
