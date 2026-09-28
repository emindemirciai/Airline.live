import type postgres from 'postgres'

/**
 * Çağrı kodundan sefer no çıkarmak (THY974 → TK 974) ve sefer no aramasında ICAO adaylarını
 * bulmak için havayolu kod eşlemeleri (D-074). Kaynak VRS `airlines` tablosu ve yöneticinin
 * düzeltmeleridir (`airline_overrides`).
 */
export interface AirlineCodes {
  /** ICAO → tek IATA kodu. */
  icaoToIata: ReadonlyMap<string, string>
  /** IATA → bu IATA'yı taşıyan bütün ICAO kodları (düzeltmeden gelen önce, sonra alfabetik). */
  iataToIcao: ReadonlyMap<string, readonly string[]>
}

export const EMPTY_AIRLINE_CODES: AirlineCodes = {
  icaoToIata: new Map(),
  iataToIcao: new Map(),
}

const ICAO_CODE = /^[A-Z]{3}$/
/** İki harf ya da harf + rakam; iki rakam IATA havayolu kodu değildir. */
const IATA_CODE = /^(?=.*[A-Z])[A-Z0-9]{2}$/

/** Birleştirilmiş havayolu satırı (`airlines` + aynı `code`'lu `airline_overrides`). */
export interface AirlineCodeRow {
  code: string
  icao: string | null
  iata: string | null
  /** Kodlar (ICAO ya da IATA) yöneticinin düzeltmesinden mi geliyor. */
  overridden: boolean
}

const clean = (value: string | null, pattern: RegExp): string | null => {
  if (value === null) return null
  const code = value.trim().toUpperCase()
  return pattern.test(code) ? code : null
}

const byCode = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/**
 * Saf kısım: satırlardan eşlemeleri kurar. Biçimi geçersiz kod (ICAO `^[A-Z]{3}$`, IATA iki
 * harf/rakam ama iki rakam değil) yok sayılır; kodlar kırpılıp büyük harfe çevrilir.
 * - `icaoToIata`: ICAO başına tek IATA; önce düzeltmeden gelen satır, sonra en küçük `code`.
 * - `iataToIcao`: IATA başına bütün ICAO'lar, tekrarsız; önce düzeltmeden gelenler, sonra
 *   alfabetik (ör. VF → [TKJ, VLU]).
 */
export function buildAirlineCodes(rows: readonly AirlineCodeRow[]): AirlineCodes {
  const pairs: { code: string; icao: string; iata: string; overridden: boolean }[] = []
  for (const row of rows) {
    const icao = clean(row.icao, ICAO_CODE)
    const iata = clean(row.iata, IATA_CODE)
    if (icao === null || iata === null) continue
    pairs.push({ code: row.code, icao, iata, overridden: row.overridden })
  }
  pairs.sort(
    (a, b) =>
      Number(b.overridden) - Number(a.overridden) ||
      byCode(a.code, b.code) ||
      byCode(a.icao, b.icao),
  )

  const icaoToIata = new Map<string, string>()
  for (const p of pairs) if (!icaoToIata.has(p.icao)) icaoToIata.set(p.icao, p.iata)

  const ranked = new Map<string, Map<string, boolean>>()
  for (const p of pairs) {
    const icaos = ranked.get(p.iata) ?? new Map<string, boolean>()
    icaos.set(p.icao, (icaos.get(p.icao) ?? false) || p.overridden)
    ranked.set(p.iata, icaos)
  }
  const iataToIcao = new Map<string, readonly string[]>()
  for (const [iata, icaos] of ranked) {
    const sorted = [...icaos].sort(([a, ao], [b, bo]) => Number(bo) - Number(ao) || byCode(a, b))
    iataToIcao.set(
      iata,
      sorted.map(([icao]) => icao),
    )
  }
  return { icaoToIata, iataToIcao }
}

/**
 * `airlines` ile `airline_overrides`'ı `code` üzerinden birleştirip eşlemeleri kurar. Düzeltme
 * satırı aynı koddaki VRS satırının yerine geçer: dolu alanı VRS değerini ezer, boş (null) alanı
 * VRS değerini korur; boş metin ('') alanı bilerek temizler (geçersiz kod sayılır). VRS'te
 * olmayan kodun düzeltmesi yeni havayolu olarak eklenir. Ham SQL ingest.ts'teki gibidir (zaman ve
 * JSON parametresi yok; Drizzle'ın verdiği istemciyle de aynı çalışır).
 */
export async function loadAirlineCodes(sql: postgres.Sql): Promise<AirlineCodes> {
  const rows = await sql<
    { code: string; icao: string | null; iata: string | null; overridden: boolean }[]
  >`
    select coalesce(o.code, a.code) as code,
      coalesce(o.icao, a.icao) as icao,
      coalesce(o.iata, a.iata) as iata,
      (o.icao is not null or o.iata is not null) as overridden
    from airlines a
    full join airline_overrides o on o.code = a.code`
  return buildAirlineCodes(
    rows.map((r) => ({ code: r.code, icao: r.icao, iata: r.iata, overridden: r.overridden })),
  )
}
