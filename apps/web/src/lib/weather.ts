import 'server-only'
import {
  RawAirportWeatherSchema,
  toAirportWeather,
  type AirportWeather,
  type RawAirportWeather,
} from '@havayolu/shared'
import { cache } from 'react'
import { z } from 'zod'
// Göreli yol: vitest `@/` takma adını çözmez; bu modül testte yüklenir.
import { AIRPORTS_SCOPE } from './airports'
import { getServerEnv } from './env'
import { createMemoryCache } from './memory-cache'

/**
 * Havalimanı sayfalarının hava durumu verisi (Parça 1 M6c, D-078; M6h ölçek düzeltmesi, D-090). Sayfa
 * sunucuda tek kaynak okur:
 *
 * - Toplu güncel hava durumu, **ham biçimde**: `GET /v1/weather?scope=listed&format=raw`
 *   (listelenen havalimanları: Türkiye ve Türkiye dışındakiler, D-080; ham biçim D-101). API hiçbir
 *   raporu çözümlemez; sayfa yalnız çizdiği havalimanını paylaşılan görünümlerle çözer
 *   (`toAirportWeather`: METAR, süresi dolmamış TAF'lar ve yürürlükteki TAF seçimi; API'nin tam
 *   biçimiyle aynı kayıt). 4. halkada (1.217 istasyonla ölçüldü; D-110'la 1.240) ham gövde istasyon başına
 *   ~0,9 KB, toplam ~1,1 MB'tır; tam biçim ~4 MB olurdu. **Next veri önbelleğinde değil, web sunucusunun
 *   belleğinde** 60 sn tutulur (`createMemoryCache`, tek kayıt): Next veri önbelleği gövdeyi base64
 *   saklar ve kaydı 2 MiB'ta keser (D-088); sınırı aşan yanıt önbelleğe alınmaz ve her sayfa çizimi
 *   API'ye giderdi (web konteynerinin API kovası 60/dk, D-060). API'ye dakikada en çok bir istek
 *   gider (aynı anda gelen çizimler süren tek isteği paylaşır), gövde dakikada bir kez ayrıştırılır;
 *   çözülen istasyonlar o yanıtla birlikte bellekte kalır (aynı dakikadaki ikinci çizim yeniden
 *   çözmez). Web tek süreçtir; birden çok kopya çalışırsa her biri dakikada bir istek atar.
 *
 * METAR/TAF kaydını (`/v1/airports/<ICAO>/weather/history`) sunucu istemez (D-111): ada onu açılışta
 * tarayıcıdan, ziyaretçinin kendi hız sınırı kovasıyla alır ve 5 dakikada bir tazeler
 * (airport-weather-live.tsx). Önce web kaydı sunucuda ister ve Next veri önbelleğinde 30 dk tutardı
 * (D-102): 5. halkada 3.264 istasyonla (D-110) tam bir tarama web konteynerinin bu rotadaki kovasını
 * (dakikada 60) aşar ve kayıtlar (istasyon başına ~70 KB) konteynerin diskinde birikirdi.
 * JavaScript'siz ziyaretçi kaydı görmez; güncel METAR ve TAF sunucu çiziminde vardır.
 *
 * Hiçbir hata sayfaya taşınmaz: API ulaşılamazsa, yanıt bozuksa ya da süre dolarsa `null` döner ve
 * sayfa "Hava durumu şu an alınamıyor" der; sayfa hava durumu yüzünden 500 vermez. API ulaşılamazken
 * eldeki toplu yanıt en çok 10 dk daha kullanılır (gözlem yaşı sayfada yazılır), yeniden deneme en
 * erken 15 sn sonradır. İstemci başlıkları iletilmez (önbellek anahtarı ziyaretçi başına bölünmesin,
 * lib/airports.ts).
 */

/** Toplu hava durumunun web belleğindeki süresi, ms (API'nin önbelleğiyle aynı, 60 sn). */
export const WEATHER_BULK_TTL_MS = 60_000
/** Toplu hava isteği başarısız olunca yeniden deneme için en kısa süre, ms. */
export const WEATHER_BULK_RETRY_MS = 15_000
/** API'ye ulaşılamazken eldeki toplu yanıtın en çok kullanılacağı yaş, ms. */
export const WEATHER_BULK_MAX_STALE_MS = 10 * 60_000
/** Hava durumu ikincil bilgidir: sayfa onu en fazla bu kadar bekler. */
export const WEATHER_TIMEOUT_MS = 4000

/** Toplu yanıt (ham biçim): istasyonlar ICAO'ya göre, çözümlenmemiş. */
export interface WeatherBulk {
  generatedAt: string
  attribution: { text: string; url: string } | null
  stations: ReadonlyMap<string, RawAirportWeather>
}

const ICAO = /^[A-Z0-9]{4}$/

const envelopeSchema = z.object({
  generatedAt: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
  attribution: z.object({ text: z.string(), url: z.string() }).nullish().catch(null),
  stations: z.array(z.unknown()),
})

export function weatherBulkUrl(apiInternalUrl: string): string {
  const url = new URL('/v1/weather', apiInternalUrl)
  url.searchParams.set('scope', AIRPORTS_SCOPE)
  url.searchParams.set('format', 'raw')
  return url.toString()
}

/**
 * Ham toplu yanıtı denetler. Zarf bozuksa null; tek bir bozuk istasyon kaydı (sürüm geçişi) yanıtı
 * düşürmez, atlanır.
 */
export function parseWeatherBulk(body: unknown): WeatherBulk | null {
  const envelope = envelopeSchema.safeParse(body)
  if (!envelope.success) return null
  const stations = new Map<string, RawAirportWeather>()
  for (const item of envelope.data.stations) {
    const parsed = RawAirportWeatherSchema.safeParse(item)
    if (parsed.success && ICAO.test(parsed.data.icao)) stations.set(parsed.data.icao, parsed.data)
  }
  return {
    generatedAt: envelope.data.generatedAt,
    attribution: envelope.data.attribution ?? null,
    stations,
  }
}

/** Çözülmüş istasyonlar, toplu yanıt başına (yanıt yenilenince eskisiyle birlikte çöpe gider). */
const decodedStations = new WeakMap<WeatherBulk, Map<string, AirportWeather>>()

/**
 * Toplu yanıttan havalimanının güncel havası (API'nin tam biçimiyle aynı kayıt). Yanıt yoksa
 * (API'ye ulaşılamadı) null; istasyon listede yoksa raporsuz bir kayıt (sayfa "güncel rapor yok"
 * der, "alınamıyor" demez). Yalnız istenen istasyon çözülür; sonuç yanıtla birlikte tutulur.
 */
export function stationWeather(bulk: WeatherBulk | null, icao: string): AirportWeather | null {
  if (bulk === null) return null
  let decoded = decodedStations.get(bulk)
  if (decoded === undefined) {
    decoded = new Map()
    decodedStations.set(bulk, decoded)
  }
  const cached = decoded.get(icao)
  if (cached !== undefined) return cached
  const station = bulk.stations.get(icao)
  const weather: AirportWeather =
    station === undefined
      ? { icao, generatedAt: bulk.generatedAt, metar: null, tafs: [] }
      : toAirportWeather(station, bulk.generatedAt)
  decoded.set(icao, weather)
  return weather
}

async function fetchJson(url: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(WEATHER_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`weather request failed: HTTP ${response.status}`)
  return response.json()
}

async function loadWeatherBulk(): Promise<WeatherBulk> {
  const bulk = parseWeatherBulk(
    // Next veri önbelleğine konmaz (gövde her dakika değişir ve büyüktür); bellek önbelleği tutar.
    await fetchJson(weatherBulkUrl(getServerEnv().API_INTERNAL_URL), { cache: 'no-store' }),
  )
  if (bulk === null) throw new Error('weather response has an unexpected shape')
  return bulk
}

/** Toplu hava durumunun süreç içi önbelleği (modül düzeyi; bütün sayfalar paylaşır). */
const weatherBulkCache = createMemoryCache({
  load: loadWeatherBulk,
  ttlMs: WEATHER_BULK_TTL_MS,
  retryMs: WEATHER_BULK_RETRY_MS,
  maxStaleMs: WEATHER_BULK_MAX_STALE_MS,
})

/** Listelenen bütün havalimanlarının güncel hava durumu; hata olursa null (fırlatmaz). */
export const getWeather = cache((): Promise<WeatherBulk | null> => weatherBulkCache())

/** Havalimanı sayfasının hava durumu verisi ve çizim anı. */
export interface AirportWeatherPageData {
  bulk: WeatherBulk | null
  /** Sunucu çizim anı (epoch ms); ada hidrasyonda aynı saati kullanır. */
  renderedAt: number
}

/**
 * Toplu hava durumu ve çizim anı; fırlatmaz. METAR/TAF kaydı istenmez: ada onu tarayıcıdan alır
 * (D-111).
 */
export async function getAirportWeatherPage(): Promise<AirportWeatherPageData> {
  return { bulk: await getWeather(), renderedAt: Date.now() }
}
