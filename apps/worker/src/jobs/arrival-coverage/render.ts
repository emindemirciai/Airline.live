import { PROVIDER_LICENSES } from '@havayolu/providers'
import {
  ARRIVAL_AGL_BUCKETS,
  ARRIVAL_CANDIDATE_BOX_KM,
  ARRIVAL_DISTANCE_BUCKETS,
  ARRIVAL_GEOID_FT_PER_M,
  ARRIVAL_PROPOSAL_AGL_STEP_FT,
  ARRIVAL_PROPOSAL_DISTANCE_STEP_KM,
  ARRIVAL_QNH_FT_PER_HPA,
  ARRIVAL_QNH_STANDARD_HPA,
  ARRIVAL_SEEN_POS_BUCKETS,
  ARRIVAL_UNKNOWN_BUCKET,
  type ArrivalBucket,
  type ArrivalCoverageDefinitions,
  type ArrivalCoverageProviderResult,
  type ArrivalCoverageResult,
  type ArrivalCoverageStationResult,
  type ArrivalLandingRule,
  type ArrivalLandingRuleGeometry,
  type ArrivalProposal,
  type ArrivalProviderStatus,
  type ArrivalQuantiles,
  type ArrivalRuleResult,
  type ArrivalShare,
  type ArrivalStationNote,
  type ArrivalSubsetStats,
} from '@havayolu/shared'
import { FINE_ARP_KM, FINE_MAX_AGL_FT } from '../../ingest/tracks'

/**
 * Kapsama raporunun Türkçe Markdown'ı (`docs/reports/kapsama.md`'nin içeriği; Parça 1 M7b.2,
 * D-098). Rapor bir docs/ belgesidir, arayüz metni değildir: dili Türkçedir, sayılar Türkçe
 * yazılır (ondalık virgül, binlik nokta, `%33,3`), zamanlar UTC'dir (`Z`), satır sonu LF'dir.
 *
 * Bölümler: başlık (kaynak, pencere, etkin pencere, tanım sürümü, uyarılar), özet tablosu, karar
 * kuralları (Wilson aralığı, "sınırda", "az örnek", `lost_low` ve bütün varışların eşik önerileri), istasyon
 * ayrıntıları (dağılımlar, `seen_pos`, QNH duyarlılığı), sağlayıcı (429 ve veri sürekliliği),
 * yöntem ve tanımlar, veri atfı (ODbL md. 4.3).
 *
 * Saf ve belirlenimcidir: yalnızca sonuç ve `meta` kullanılır (saat yok); aynı girdi aynı metni
 * verir. Sonuç kimlik taşımadığı için metinde hex, çağrı kodu ya da tescil olamaz.
 */

export type ArrivalCoverageReportSource =
  { kind: 'admin'; reportId: number } | { kind: 'local' } | { kind: 'probe' }

export interface ArrivalCoverageRenderMeta {
  source: ArrivalCoverageReportSource
  /** Uygulama sürümü (kök package.json). */
  appVersion: string
}

export const ARRIVAL_COVERAGE_REPORT_HEADING = '# Kapsama raporu'

const MINUS = '\u2212'
const RANGE = '\u2013'
const NONE = '\u2014'
const ELLIPSIS = '\u2026'
const LE = '\u2264'
const GE = '\u2265'
const PM = '\u00b1'

// ---------------------------------------------------------------------------------------------
// Biçim yardımcıları

/** Türkçe sayı: binlik nokta, ondalık virgül, eksi işareti U+2212; −0 yazılmaz. */
export function trNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return NONE
  const fixed = Math.abs(value).toFixed(decimals)
  const [whole = '0', fraction] = fixed.split('.')
  const isZero = /^[0.]+$/.test(fixed)
  const sign = value < 0 && !isZero ? MINUS : ''
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${sign}${grouped}${fraction === undefined ? '' : `,${fraction}`}`
}

/** İşaretli sayı (+/−), sapma aralıkları için. */
function trSigned(value: number, decimals = 0): string {
  const text = trNumber(value, decimals)
  return value > 0 && text !== trNumber(0, decimals) ? `+${text}` : text
}

/** İki uç aynıysa tek değer, değilse `a…b` (biçimlendirilmiş). */
function span(min: number, max: number, format: (v: number) => string): string {
  return min === max ? format(min) : `${format(min)}${ELLIPSIS}${format(max)}`
}

/** Tam sayıysa ondalıksız, değilse bir ondalıkla. */
function trCompact(value: number): string {
  return trNumber(value, Number.isInteger(value) ? 0 : 1)
}

/** Türkçe yüzde: `%33,3`; boşsa uzun çizgi. */
export function trPercent(share: number | null, decimals = 1): string {
  return share === null || !Number.isFinite(share) ? NONE : `%${trNumber(share * 100, decimals)}`
}

const nullable = (value: number | null, format: (v: number) => string) =>
  value === null ? NONE : format(value)
const ft = (value: number | null) => nullable(value, (v) => `${trNumber(v)} ft`)
const km = (value: number | null) => nullable(value, (v) => `${trNumber(v, 1)} km`)
const sec = (value: number | null) => nullable(value, (v) => `${trNumber(v, 1)} sn`)

/** UTC zaman: `2026-10-05 09:15Z` (saniye varsa `09:15:27Z`); geçersizse uzun çizgi. */
export function utcText(isoText: string | null): string {
  if (isoText === null) return NONE
  const date = new Date(isoText)
  if (Number.isNaN(date.getTime())) return NONE
  const text = date.toISOString()
  const day = text.slice(0, 10)
  const hm = text.slice(11, 16)
  return date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0
    ? `${day} ${hm}Z`
    : `${day} ${hm}:${text.slice(17, 19)}Z`
}

/** Süre: `1 sa 5 dk`, `40 dk`, `3 sa`. */
export function durationText(ms: number): string {
  const total = Math.max(0, Math.round(ms / 60_000))
  const hours = Math.floor(total / 60)
  const rest = total % 60
  if (hours === 0) return `${rest} dk`
  return rest === 0 ? `${trNumber(hours)} sa` : `${trNumber(hours)} sa ${rest} dk`
}

/** Pay ve sayılar; baro belirsizliği payı değiştiriyorsa aralık da yazılır. */
function shareText(s: ArrivalShare): string {
  if (s.n === 0 || s.share === null) return NONE
  const base = `${trPercent(s.share)} (${trNumber(s.count)}/${trNumber(s.n)})`
  if (s.low === null || s.high === null || (s.low === s.share && s.high === s.share)) return base
  return `${base}; baro aralığı ${trPercent(s.low)}${RANGE}${trPercent(s.high)}`
}

function cell(text: string): string {
  return text.replaceAll('|', '\\|').replaceAll('\n', ' ')
}

/** Markdown tablosu; `align` her sütun için sol (`l`) ya da sağ (`r`); eksik harf sağdır. */
function table(header: readonly string[], align: string, rows: readonly string[][]): string[] {
  const separator = header.map((_, i) => ((align[i] ?? 'r') === 'r' ? '---:' : '---'))
  return [
    `| ${header.map(cell).join(' | ')} |`,
    `| ${separator.join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`),
  ]
}

const label = (s: Pick<ArrivalCoverageStationResult, 'icao' | 'iata'>) =>
  s.iata.trim() === '' ? s.icao : `${s.icao} (${s.iata})`

/** Kova etiketi: tanımdan (`[min, max)`); sınırsız uçlar `<` ve `≥` ile. */
function bucketLabel(bucket: ArrivalBucket): string {
  if (bucket.min === null && bucket.max !== null) return `< ${trCompact(bucket.max)}`
  if (bucket.max === null && bucket.min !== null) return `${GE} ${trCompact(bucket.min)}`
  if (bucket.min !== null && bucket.max !== null) {
    return `${trCompact(bucket.min)}${RANGE}${trCompact(bucket.max)}`
  }
  return NONE
}

function bucketRow(
  buckets: readonly ArrivalBucket[],
  counts: Record<string, number>,
  withUnknown: boolean,
): string[] {
  const row = buckets.map((b) => trNumber(counts[b.key] ?? 0))
  if (withUnknown) row.push(trNumber(counts[ARRIVAL_UNKNOWN_BUCKET] ?? 0))
  return row
}

function bucketHeader(
  title: string,
  buckets: readonly ArrivalBucket[],
  withUnknown: boolean,
): string[] {
  return [title, ...buckets.map(bucketLabel), ...(withUnknown ? ['bilinmiyor'] : [])]
}

// ---------------------------------------------------------------------------------------------
// Kurallar ve tanım metinleri

const RULE_ORDER: readonly ArrivalLandingRule[] = ['high', 'medium', 'low']

function frameText(frame: ArrivalLandingRuleGeometry['frame']): string {
  return frame === 'threshold' ? 'eşiğe' : "ARP'a"
}

function ruleGeometryText(g: ArrivalLandingRuleGeometry): string {
  return (
    `AGL ${g.aglInclusive ? LE : '<'} ${trNumber(g.maxAglFt)} ft, ` +
    `${frameText(g.frame)} ${LE} ${trCompact(g.maxKm)} km`
  )
}

function verdictText(rule: ArrivalRuleResult, applies: string): string {
  if (rule.verdict === 'no_arrivals') return 'varış yok'
  const parts = [rule.verdict === 'applies' ? applies : 'uygulanmaz']
  if (rule.borderline) parts.push('sınırda')
  if (rule.lowSample) parts.push('az örnek')
  return parts.join(', ')
}

const rule1Text = (s: ArrivalCoverageStationResult) => verdictText(s.rule1, 'uygulanır')
const rule2Text = (s: ArrivalCoverageStationResult) => verdictText(s.rule2, 'uygulanır (DUR-SOR)')

function geoidSourceText(s: ArrivalCoverageStationResult): string {
  if (s.geoidM === null) return 'yok (AGL baro yöntemiyle)'
  const value = `${trNumber(s.geoidM, 2)} m`
  return s.geoidSource === 'station'
    ? `${value} (istasyon kaydı)`
    : `${value} (araştırma tablosu, docs/research/2026-09-25-kaynak-dogrulama.md)`
}

function noteText(
  note: ArrivalStationNote,
  s: ArrivalCoverageStationResult,
  d: ArrivalCoverageDefinitions,
): string {
  const tolerance = `${PM}${trNumber(d.baroAglToleranceFt)} ft`
  switch (note) {
    case 'no_elevation':
      return (
        `Alan yüksekliği bilinmiyor; 0 ft alındı (AGL ve ${trNumber(d.maxAboveFieldFt)} ft ` +
        'koşulu bundan etkilenir).'
      )
    case 'threshold_fallback':
      return "Gerçek pist eşiği yok; eşik mesafesi yerine ARP'a mesafe kullanıldı."
    case 'no_geoid':
      return `Geoid ondülasyonu yok; AGL hep baro yöntemiyle hesaplandı (${tolerance}).`
    case 'geoid_fallback':
      return 'Geoid ondülasyonu istasyon kaydında yok; araştırma tablosundaki değer kullanıldı.'
    case 'data_gap':
      return (
        'Havadaki ince örneklerde boş `baro_rate` ya da `seen_pos` payı uyarı eşiğini ' +
        `(${trPercent(d.dataGapWarningShare, 0)}) aşıyor.`
      )
    case 'no_baro_rate':
      return "Pencerede `baro_rate`'i dolu örnek yok; bu istasyonda varış sayılamadı."
    case 'qnh_bias_exceeds_tolerance':
      return (
        `METAR QNH sapması ${tolerance} aralığını aşıyor; baro aralığı ` +
        `${trSigned(s.baroToleranceFt.low)}${ELLIPSIS}${trSigned(s.baroToleranceFt.high)} ft ` +
        'olarak genişletildi.'
      )
  }
}

// ---------------------------------------------------------------------------------------------
// Bölümler

function sourceText(meta: ArrivalCoverageRenderMeta): string {
  switch (meta.source.kind) {
    case 'admin':
      return `üretim veritabanı, admin raporu #${meta.source.reportId}`
    case 'local':
      return 'yerel veritabanı (`pnpm coverage:report`)'
    case 'probe':
      return 'yerel ölçüm (`pnpm coverage:probe`)'
  }
}

/** Etkin pencere pencereden %5'ten fazla kısa mı? */
function effectiveLate(result: ArrivalCoverageResult, startIso: string | null): boolean {
  if (startIso === null) return false
  const start = Date.parse(result.window.start)
  const end = Date.parse(result.window.end)
  const effective = Date.parse(startIso)
  return effective - start > (end - start) * result.definitions.dataGapWarningShare
}

function warnings(result: ArrivalCoverageResult): string[] {
  const out: string[] = []
  const gapPct = trPercent(result.definitions.dataGapWarningShare, 0)
  for (const s of result.stations) {
    const e = s.effectiveWindow
    if (e.start === null) {
      out.push(`${label(s)}: pencerede \`baro_rate\`'i dolu örnek yok; varış sayılamadı.`)
      continue
    }
    if (effectiveLate(result, e.start)) {
      const late = Date.parse(e.start) - Date.parse(result.window.start)
      out.push(
        `${label(s)}: etkin pencere başlangıcı ${utcText(e.start)} (pencere başından ` +
          `${durationText(late)} sonra; öncesinde \`baro_rate\` yok).`,
      )
    }
    if (e.warning) {
      out.push(
        `${label(s)}: havadaki ince örneklerde \`baro_rate\` boş ${trPercent(e.baroRateNullShare)}, ` +
          `\`seen_pos\` boş ${trPercent(e.seenPosNullShare)} (uyarı eşiği ${gapPct}).`,
      )
    }
  }
  if (result.totals.openRecordArrivals > 0) {
    out.push(
      `Kaydı hâlâ açık olduğu için sayılmayan varış: ${trNumber(result.totals.openRecordArrivals)} ` +
        '(pencerenin son dakikaları; kayıt yere indikten sonra da bir süre açık kalabilir).',
    )
  }
  const p = result.provider
  if (p !== null && p.hoursWithoutRows > 0) {
    out.push(
      `Sağlayıcı satırı olmayan saat: ${trNumber(p.hoursWithoutRows)}/${trNumber(p.hours)} ` +
        '(pencereye değen UTC saatleri; ingest çalışmıyordu).',
    )
  }
  const durSor = result.stations.filter((s) => s.rule2.verdict === 'applies').map(label)
  if (durSor.length > 0) {
    out.push(
      `DUR-SOR: kural 2 uygulanıyor: ${durSor.join(', ')}. Eşik önerileri "Karar kuralları" bölümünde.`,
    )
  }
  return out
}

function header(result: ArrivalCoverageResult, meta: ArrivalCoverageRenderMeta): string[] {
  const d = result.definitions
  const lines = [
    ARRIVAL_COVERAGE_REPORT_HEADING,
    '',
    `- **Kaynak:** ${sourceText(meta)}; uygulama sürümü ` +
      `${meta.appVersion.startsWith('v') ? meta.appVersion : `v${meta.appVersion}`}`,
    `- **Pencere (UTC):** ${utcText(result.window.start)} ${RANGE} ${utcText(result.window.end)} ` +
      `(${trNumber(result.window.hours)} sa)`,
    `- **İş başlangıcı:** ${utcText(result.jobStart)}; kapanma payı ${durationText(d.settleMs)}, ` +
      `kayıt kapanma sınırı ${durationText(d.closedRecordMs)}, geriye bakış ${durationText(d.lookbackMs)}`,
    `- **Etkin pencere başlangıcı:** ${
      result.effectiveStart === null
        ? `yok (pencerede \`baro_rate\`'i dolu örnek yok)`
        : `${utcText(result.effectiveStart)} (\`baro_rate\`'i dolu ilk örnek; istasyon başına aşağıda)`
    }`,
    `- **Tanım sürümü:** ${result.definitionVersion}`,
    `- **Sayılan varış:** ${trNumber(result.totals.arrivals)}; yerde örneği görülen: ` +
      `${trNumber(result.totals.groundSeen)}; kaydı açık olduğu için sayılmayan: ` +
      `${trNumber(result.totals.openRecordArrivals)}`,
    '',
  ]
  const list = warnings(result)
  if (list.length === 0) lines.push('**Uyarılar:** yok.')
  else lines.push('**Uyarılar:**', '', ...list.map((w) => `- ${w}`))
  lines.push('')
  return lines
}

function summary(result: ArrivalCoverageResult): string[] {
  const rate = result.provider === null ? NONE : trPercent(result.provider.rateLimitedShare, 2)
  const rows = result.stations.map((s) => {
    const wilson = s.groundShareWilson
    const median = s.all.medianAglFt
    const range = s.all.medianAglRangeFt
    const baro =
      range !== null && (range.low !== median || range.high !== median)
        ? ` (${trNumber(range.low)}${RANGE}${trNumber(range.high)})`
        : ''
    return [
      label(s),
      trNumber(s.arrivals),
      s.arrivals === 0
        ? NONE
        : `${trPercent(s.groundShare)} (${trNumber(s.groundSeen)}/${trNumber(s.arrivals)})`,
      wilson === null ? NONE : `${trPercent(wilson.low)}${RANGE}${trPercent(wilson.high)}`,
      median === null ? NONE : `${trNumber(median)} ft${baro}`,
      km(s.all.medianThresholdKm),
      `${trNumber(s.aglMethods.geoid)} / ${trNumber(s.aglMethods.baro_tolerant)}`,
      rate,
      rule1Text(s),
      rule2Text(s),
    ]
  })
  return [
    '## Özet',
    '',
    ...table(
      [
        'İstasyon',
        'Varış',
        'Yerde örneği',
        'Wilson %95',
        'Medyan AGL',
        'Eşiğe medyan',
        'AGL yöntemi (geoid / baro)',
        '429/420 oranı',
        'Kural 1',
        'Kural 2',
      ],
      'lrrrrrrrll',
      rows,
    ),
    '',
    'AGL ve mesafe, varışın son havadaki örneğinindir; parantezdeki aralık baro belirsizliğiyle ' +
      'medyan AGL aralığıdır. 429/420 oranı sağlayıcı başınadır; her satırda aynıdır. "Sınırda": ' +
      `kural 1'de Wilson %95 aralığı ${trPercent(result.definitions.groundShareMin, 0)} değerini ` +
      `içerir, kural 2'de baro belirsizliği sonucu değiştirir. "Az örnek": varış sayısı < ` +
      `${trNumber(result.definitions.lowSampleArrivals)}.`,
    '',
  ]
}

/** İki çerçevede eşik önerileri; AGL'si bilinen varış yoksa tek satırlık not. */
function proposalBlock(stats: ArrivalSubsetStats): string[] {
  if (stats.proposals.threshold.length === 0 && stats.proposals.arp.length === 0) {
    return ["AGL'si bilinen varış yok; eşik önerisi çıkarılmadı.", '']
  }
  return [
    `Eşik önerileri, AGL ve eşiğe mesafe (\`high\` çerçevesi; AGL ${trNumber(ARRIVAL_PROPOSAL_AGL_STEP_FT)} ` +
      `ft'e, mesafe ${trNumber(ARRIVAL_PROPOSAL_DISTANCE_STEP_KM, 1)} km'ye yukarı yuvarlanır):`,
    '',
    ...proposalTable(stats.proposals.threshold, 'Eşiğe'),
    '',
    "Eşik önerileri, AGL ve ARP'a mesafe (`medium` ve `low` çerçevesi):",
    '',
    ...proposalTable(stats.proposals.arp, "ARP'a"),
    '',
  ]
}

/** Kural 2 uygulanırken DUR-SOR satırının yönlendirdiği öneri tabloları (hangileri basıldıysa). */
function durSorChoiceText(s: ArrivalCoverageStationResult): string {
  const lostLow = s.lostLow.proposals.threshold.length > 0
  const all = s.all.proposals.threshold.length > 0
  if (lostLow && all) {
    return 'Aşağıdaki `lost_low` ya da bütün varış önerilerinden birini seç ya da yeni eşik söyle.'
  }
  if (all) {
    return (
      'Aşağıdaki bütün varış önerilerinden birini seç ya da yeni eşik söyle (`lost_low` önerisi ' +
      'yok).'
    )
  }
  return "AGL'si bilinen varış olmadığı için eşik önerisi çıkarılamadı; yeni eşik söyle."
}

function proposalTable(proposals: readonly ArrivalProposal[], frameLabel: string): string[] {
  return table(
    ['Yüzdelik', 'AGL ≤', `${frameLabel} ≤`, 'Birlikte yakalanan'],
    'lrrl',
    proposals.map((p) => [
      `p${p.percentile}`,
      `${trNumber(p.aglFt)} ft`,
      `${trNumber(p.distanceKm, 1)} km`,
      shareText(p.capture),
    ]),
  )
}

function captureTable(
  d: ArrivalCoverageDefinitions,
  lostLow: ArrivalSubsetStats,
  all: ArrivalSubsetStats,
): string[] {
  const rows = RULE_ORDER.map((rule) => [
    `\`${rule}\``,
    ruleGeometryText(d.landingRules[rule]),
    shareText(lostLow.capture[rule]),
    shareText(all.capture[rule]),
  ])
  rows.push([
    '`high` ∪ `medium`',
    'ikisinden biri',
    shareText(lostLow.capture.high_or_medium),
    shareText(all.capture.high_or_medium),
  ])
  return table(['Kural', 'Konum koşulu', '`lost_low`', 'Bütün varışlar'], 'llll', rows)
}

function medianLine(stats: ArrivalSubsetStats): string {
  const range = stats.medianAglRangeFt
  const baro =
    range !== null && (range.low !== stats.medianAglFt || range.high !== stats.medianAglFt)
      ? ` (baro aralığı ${trNumber(range.low)}${RANGE}${trNumber(range.high)} ft)`
      : ''
  return (
    `medyan AGL ${ft(stats.medianAglFt)}${baro}, eşiğe medyan mesafe ${km(stats.medianThresholdKm)}, ` +
    `ARP'a medyan mesafe ${km(stats.medianArpKm)}`
  )
}

function decisionBlock(s: ArrivalCoverageStationResult, d: ArrivalCoverageDefinitions): string[] {
  const lines = [`### ${label(s)}`, '']
  if (s.arrivals === 0) {
    lines.push(
      `Sayılan varış yok; kurallar değerlendirilemedi (kaydı açık olduğu için sayılmayan: ` +
        `${trNumber(s.openRecordArrivals)}).`,
      '',
    )
    return lines
  }
  const wilson = s.groundShareWilson
  const rule1Effect =
    s.rule1.verdict === 'applies'
      ? ' Bu istasyonda inişler varsayılan olarak "muhtemel" sunulur.'
      : ''
  lines.push(
    `- **Kural 1 (yerde örneği payı < ${trPercent(d.groundShareMin, 0)}): ${rule1Text(s)}.** ` +
      `Pay ${trPercent(s.groundShare)} (${trNumber(s.groundSeen)}/${trNumber(s.arrivals)})` +
      (wilson === null
        ? '.'
        : `, Wilson %95 aralığı ${trPercent(wilson.low)}${RANGE}${trPercent(wilson.high)}.`) +
      rule1Effect,
    `  - Duyarlılık (\`left_zone\` ve \`other_field\` hariç): ${shareText(s.groundShareExcludingLeft)}.`,
    `  - Yerde örneği olmayan varışlar: \`lost_low\` ${trNumber(s.noGround.lost_low)}, ` +
      `\`left_zone\` ${trNumber(s.noGround.left_zone)}, \`other_field\` ${trNumber(s.noGround.other_field)}.`,
    `  - Yalnızca geometrik hızla nitelikli kayıtlar (\`baro_rate\` boş): ` +
      `${trNumber(s.geomOnly.arrivals)} varış, yerde örneği ` +
      (s.geomOnly.arrivals === 0
        ? `${NONE}`
        : `${trPercent(s.geomOnly.groundShare)} (${trNumber(s.geomOnly.groundSeen)}/${trNumber(s.geomOnly.arrivals)})`) +
      '; başlık rakamlarına girmez.',
    `- **Kural 2 (medyan AGL > ${trNumber(d.medianAglMaxFt)} ft ya da eşiğe medyan mesafe > ` +
      `${trCompact(d.medianThresholdMaxKm)} km): ${rule2Text(s)}.** Bütün varışlarda ${medianLine(s.all)}.`,
  )
  if (s.rule2.verdict === 'applies') {
    lines.push(
      '  - **DUR-SOR:** bugünkü `high` ve `medium` kuralları bu istasyonda inişlerin çoğunu ' +
        `kaçırır. ${durSorChoiceText(s)}`,
    )
  }
  lines.push('')

  const ll = s.lostLow
  lines.push(`#### Alçakta kaybolan varışlar (\`lost_low\`, n = ${trNumber(ll.n)})`, '')
  if (ll.n === 0) {
    lines.push('`lost_low` varış yok; eşik önerisi çıkarılmadı.', '')
  } else {
    lines.push(
      `AGL'si bilinen: ${trNumber(ll.withAgl)}; ${medianLine(ll)}.`,
      '',
      ...proposalBlock(ll),
    )
  }
  lines.push(
    `#### Bütün varışlar (n = ${trNumber(s.all.n)})`,
    '',
    `AGL'si bilinen: ${trNumber(s.all.withAgl)}; medyanlar kural 2 satırında.`,
    '',
    ...proposalBlock(s.all),
  )
  lines.push(
    'Bugünkü kuralların konum koşulları (alçalma ve süre koşulları değerlendirilmez):',
    '',
    ...captureTable(d, ll, s.all),
    '',
  )
  return lines
}

function quantileRow(title: string, q: ArrivalQuantiles | null, format: (v: number) => string) {
  const keys = ['p10', 'p25', 'p50', 'p75', 'p90'] as const
  return [title, ...keys.map((k) => (q === null ? NONE : format(q[k])))]
}

function detailBlock(s: ArrivalCoverageStationResult, d: ArrivalCoverageDefinitions): string[] {
  const e = s.effectiveWindow
  const lines = [`### ${label(s)}`, '']
  const elevation = s.elevationFt === null ? 'bilinmiyor' : `${trNumber(s.elevationFt)} ft`
  const delta = s.thresholdElevationDeltaFt
  lines.push(
    `- Alan yüksekliği ${elevation}; geoid N ${geoidSourceText(s)}.`,
    `- Pist eşiği: ${trNumber(s.thresholds)}` +
      (s.thresholdFallbackOnly ? ' (yalnızca ARP yedeği)' : '') +
      (delta === null
        ? '; pist ucu yükseklikleri bilinmiyor.'
        : `; pist ucu yükseklikleri alana göre ${span(delta.min, delta.max, (v) => trSigned(v))} ft.`),
    `- Etkin pencere başlangıcı: ${utcText(e.start)}. Havadaki ince örnek (istasyon bölgesi): ` +
      `${trNumber(e.airborneSamples)}; \`baro_rate\` boş ${trPercent(e.baroRateNullShare)}, ` +
      `\`seen_pos\` boş ${trPercent(e.seenPosNullShare)}.`,
    `- Sayılan varış ${trNumber(s.arrivals)}; kaydı açık olduğu için sayılmayan ${trNumber(s.openRecordArrivals)}.`,
    `- AGL yöntemi: geoid ${trNumber(s.aglMethods.geoid)}, baro ${trNumber(s.aglMethods.baro_tolerant)}, ` +
      `bilinmiyor ${trNumber(s.aglMethods.unknown)}.` +
      (s.aglMethods.baro_tolerant > 0
        ? ` Baro yöntemindeki AGL'ler ${PM}${trNumber(d.baroAglToleranceFt)} ft belirsizlik taşır.`
        : ''),
  )
  if (s.qnh === null) {
    lines.push('- QNH (METAR): pencerede gözlem yok; duyarlılık hesaplanmadı.')
  } else {
    const q = s.qnh
    lines.push(
      `- QNH (METAR, pencerede ${trNumber(q.observations)} gözlem): ` +
        `${span(q.minHpa, q.maxHpa, trCompact)} hPa; baro sapması ` +
        `${span(q.biasMinFt, q.biasMaxFt, (v) => trSigned(v))} ft. ` +
        `QNH düzeltmeli medyan AGL ${ft(q.correctedMedianAglFt === null ? null : Math.round(q.correctedMedianAglFt))} ` +
        `(n = ${trNumber(q.correctedN)}; yalnızca duyarlılık).`,
    )
  }
  lines.push(
    `- Baro aralığı: ${trSigned(s.baroToleranceFt.low)}${ELLIPSIS}${trSigned(s.baroToleranceFt.high)} ft.`,
    `- Örnek aralığı medyanı ${sec(s.medianGapS)}. Düşük ağırlıklı konum kaynağı (MLAT, TIS-B, ` +
      `diğer) payı ${trPercent(s.lowWeightShare)}; son havadaki örneği düşük ağırlıklı varış ` +
      `${trNumber(s.lowWeightLastAirborne)}.`,
    `- Varıştan sonraki ${durationText(d.providerDegradedWithinMs)} içinde sağlayıcı ` +
      `\`degraded\`/\`down\`: ` +
      (s.degradedAfterArrival === null
        ? `${NONE} (sağlayıcı sayaçları yok).`
        : `${trNumber(s.degradedAfterArrival)} varış.`),
  )
  if (s.notes.length > 0) {
    lines.push('- Notlar:', ...s.notes.map((n) => `  - ${noteText(n, s, d)}`))
  }
  lines.push(
    '',
    'Dağılımlar (sayılan varışların son havadaki örneği):',
    '',
    ...table(['', 'p10', 'p25', 'p50', 'p75', 'p90'], 'l', [
      quantileRow('AGL (ft)', s.all.aglQuantilesFt, (v) => trNumber(v)),
      quantileRow('Eşiğe mesafe (km)', s.all.thresholdQuantilesKm, (v) => trNumber(v, 1)),
      quantileRow("ARP'a mesafe (km)", s.all.arpQuantilesKm, (v) => trNumber(v, 1)),
    ]),
    '',
    ...table(bucketHeader('AGL (ft)', ARRIVAL_AGL_BUCKETS, true), 'l', [
      ['Varış', ...bucketRow(ARRIVAL_AGL_BUCKETS, s.aglHistogram, true)],
    ]),
    '',
    ...table(bucketHeader('Mesafe (km)', ARRIVAL_DISTANCE_BUCKETS, false), 'l', [
      ['Eşiğe', ...bucketRow(ARRIVAL_DISTANCE_BUCKETS, s.thresholdHistogram, false)],
      ["ARP'a", ...bucketRow(ARRIVAL_DISTANCE_BUCKETS, s.arpHistogram, false)],
    ]),
    '',
    `\`seen_pos\` (sayılan varışların istasyon bölgesindeki örnekleri: ${trNumber(s.seenPos.samples)}; ` +
      `p50 ${sec(s.seenPos.p50)}, p90 ${sec(s.seenPos.p90)}, p99 ${sec(s.seenPos.p99)}):`,
    '',
    ...table(bucketHeader('`seen_pos` (sn)', ARRIVAL_SEEN_POS_BUCKETS, true), 'l', [
      ['Örnek', ...bucketRow(ARRIVAL_SEEN_POS_BUCKETS, s.seenPos.buckets, true)],
    ]),
    '',
  )
  return lines
}

const STATUS_ORDER: readonly ArrivalProviderStatus[] = ['ok', 'degraded', 'down', 'unknown']
const STATUS_LABEL: Record<ArrivalProviderStatus, string> = {
  ok: '`ok`',
  degraded: '`degraded`',
  down: '`down`',
  unknown: 'bilinmiyor',
}

function providerBlock(p: ArrivalCoverageProviderResult | null): string[] {
  const name = PROVIDER_LICENSES.adsbLol.attribution.text
  if (p === null) {
    return [
      `## 429 ve veri sürekliliği (${name})`,
      '',
      'Sağlayıcı sayaçları bu raporda yok (yerel ölçüm).',
      '',
    ]
  }
  const count = (n: number, s: number | null) => `${trNumber(n)} (${trPercent(s, 2)})`
  const range =
    p.hourRange === null
      ? ''
      : ` (${utcText(p.hourRange.start)} ${RANGE} ${utcText(p.hourRange.end)})`
  return [
    `## 429 ve veri sürekliliği (${name})`,
    '',
    'Sayaçlar pencereye değen UTC saatlerinin satırlarıdır. Saatlik satır bölünemez: pencere saat ' +
      'başında başlamıyorsa ilk ve son saat pencere dışındaki dakikaları da içerir. Durum süreleri ' +
      'pencereye kırpılır.',
    '',
    ...table(['Ölçü', 'Değer'], 'lr', [
      ['Pencereye değen UTC saatleri', `${trNumber(p.hours)}${range}`],
      ['Satırı olmayan saat (ingest çalışmıyor)', trNumber(p.hoursWithoutRows)],
      ['Satırı olup başarısı 0 olan saat', trNumber(p.hoursWithoutSuccess)],
      ['İstek', trNumber(p.requests)],
      ['Başarılı', trNumber(p.successes)],
      ['429/420 (hız sınırı)', count(p.rateLimited, p.rateLimitedShare)],
      ['5xx', count(p.serverErrors, p.serverErrorShare)],
      ['Ağ hatası', trNumber(p.networkErrors)],
      ['Diğer hata', trNumber(p.otherErrors)],
      ["Saatlik tazelik p95'inin en yükseği", sec(p.freshnessP95MaxS.max)],
      ["Saatlik tazelik p95'lerinin medyanı", sec(p.freshnessP95MaxS.median)],
      ...STATUS_ORDER.map((status) => [
        `Durum ${STATUS_LABEL[status]}`,
        durationText(p.statusMs[status]),
      ]),
    ]),
    '',
  ]
}

function methodBlock(result: ArrivalCoverageResult): string[] {
  const d = result.definitions
  const fallback = Object.entries(d.geoidFallbackM)
    .sort(([a], [b]) => a.localeCompare(b, 'en'))
    .map(([icao, m]) => `${icao} ${trNumber(m, 2)} m`)
    .join(', ')
  const rules = RULE_ORDER.map((r) => `\`${r}\` ${ruleGeometryText(d.landingRules[r])}`).join('; ')
  const above = trNumber(d.maxAboveFieldFt)
  return [
    '## Yöntem ve tanımlar',
    '',
    `- **Örnekler:** \`track_points_fine\` satırları. Yakalama kuralı (\`tracks.ts\`): bir etkin ` +
      `istasyonun ARP'ına ${LE} ${trNumber(FINE_ARP_KM)} km ve yerde ya da \`alt_baro ${MINUS} alan ` +
      `yüksekliği < ${trNumber(FINE_MAX_AGL_FT)} ft\`. Aşağıdaki tanımların tamamı bu kuralın içinde ` +
      'kalır (koruma testi).',
    `- **Varış:** bir uçuş kaydında en az bir havadaki örnek şu üç koşulu birlikte sağlar: ARP'a ` +
      `${LE} ${trCompact(d.arrivalArpKm)} km (haversine), \`alt_baro ${LE} alan yüksekliği + ${above} ft\` ` +
      `(yükseklik bilinmiyorsa 0), ham \`baro_rate < ${trNumber(d.baroRateBelowFpm)} fpm\`. ` +
      '`baro_rate` boşsa örnek sayılmaz. İlk nitelikli örnek varış zamanıdır; kayıt istasyon ' +
      'başına bir kez sayılır (pas geçme ikinci varış değildir).',
    `- **Yerde örneği:** aynı kayıtta varış zamanından sonra, ARP'a ${LE} ` +
      `${trCompact(d.groundArpKm)} km içinde \`alt_baro: "ground"\`. Öncesindeki yer örnekleri ` +
      '(aynı kayıttaki kalkış) sayılmaz.',
    '- **Son havadaki örnek:** varış zamanından sonra ve ilk yerde örneğinden (yoksa kaydın ' +
      `sonundan) önce, istasyonun ${trCompact(d.zoneKm)} km bölgesindeki son havadaki örnek.`,
    `- **AGL:** \`geoid\` yöntemi \`alt_geom ${MINUS} N × ${trNumber(ARRIVAL_GEOID_FT_PER_M, 5)} ` +
      `${MINUS} alan yüksekliği\` (ft; N metre: \`stations.geoid_undulation_m\`, yoksa araştırma ` +
      `tablosu: ${fallback}). \`alt_geom\` ya da N yoksa \`baro_tolerant\`: \`alt_baro ${MINUS} alan ` +
      `yüksekliği\`, ${PM}${trNumber(d.baroAglToleranceFt)} ft belirsizlikle. İşaret korunur ` +
      '(sıfırın altındaki değerler "< 0" kovasındadır). Pist ucu yükseklikleri alan yüksekliğinden ' +
      'farklı olabilir; fark istasyon ayrıntılarındadır.',
    `- **QNH duyarlılığı:** kararlar QNH kullanmaz. Her son havadaki örneğe en çok ` +
      `${durationText(d.qnhMaxAgeMs)} önceki METAR QNH'si uygulanır: sapma \`(QNH ${MINUS} ` +
      `${trNumber(ARRIVAL_QNH_STANDARD_HPA, 2)}) × ${trNumber(ARRIVAL_QNH_FT_PER_HPA)} ft\`. QNH ` +
      'düzeltmeli medyan yalnızca duyarlılıktır. Penceredeki sapma ' +
      `${PM}${trNumber(d.baroAglToleranceFt)} ft aralığını aşarsa baro aralığı sapmaya genişletilir.`,
    '- **Pist eşiği mesafesi:** gizli olmayan pistlerin en yakın eşiğine (`runway_overrides` ' +
      "uygulanmış); yalnızca ARP yedeği varsa ARP'a.",
    `- **Pencere:** [iş başlangıcı ${MINUS} ${durationText(d.settleMs)} ${MINUS} saat, iş başlangıcı ` +
      `${MINUS} ${durationText(d.settleMs)}). Yalnızca kaydı kapanmış varışlar sayılır ` +
      `(\`flights.last_seen_at ${LE} iş başlangıcı ${MINUS} ${durationText(d.closedRecordMs)}\`). ` +
      `Kaydın örnekleri \`max(first_seen_at, pencere başı ${MINUS} ${durationText(d.lookbackMs)})\` ` +
      'anından okunur; varış zamanı gerçek ilk nitelikli örnektir ve ardışık raporlar aynı varışı ' +
      'iki kez saymaz.',
    "- **Etkin pencere:** istasyon bölgesinde `baro_rate`'i dolu ilk örnekten başlar (v0.20.0 " +
      'öncesi satırlarda `baro_rate` yoktur). Havadaki ince örneklerde boş `baro_rate` ya da ' +
      `\`seen_pos\` payı ${trPercent(d.dataGapWarningShare, 0)} değerini aşarsa ya da etkin pencere ` +
      `pencere süresinin ${trPercent(d.dataGapWarningShare, 0)} kadarından daha geç başlarsa ` +
      'başlıkta uyarı verilir.',
    '- **Yerde örneği olmayan varışlar:** son havadaki örnek ' +
      `${trCompact(d.nearbyAirfieldKm)} km içindeki başka bir bilinen alana (OurAirports büyük, ` +
      'orta ve küçük alanları; askerî alanlar dahil) istasyonun eşiğinden yakınsa `other_field`; ' +
      'kayıt son havadaki örnekten ' +
      `\`max(${trNumber(d.leftZoneMinMs / 1000)} sn, ${trNumber(d.leftZoneGapFactor)} × medyan örnek ` +
      'aralığı)` sonra hâlâ görüldüyse `left_zone`; değilse `lost_low` (alçakta kayboldu).',
    `- **Kural 1:** yerde örneği payı < ${trPercent(d.groundShareMin, 0)} ise iniş varsayılan ` +
      'olarak "muhtemel" sunulur. Pay bütün sayılan varışlar üzerindendir; Wilson %95 aralığı ' +
      `${trPercent(d.groundShareMin, 0)} değerini içeriyorsa "sınırda". Duyarlılık satırı ` +
      '`left_zone` ve `other_field` varışlarını dışarıda bırakır.',
    `- **Kural 2:** son havadaki örneğin medyan AGL'si > ${trNumber(d.medianAglMaxFt)} ft ya da ` +
      `eşiğe medyan mesafe > ${trCompact(d.medianThresholdMaxKm)} km ise DUR-SOR. Baro belirsizliği ` +
      'sonucu değiştiriyorsa "sınırda".',
    `- **Az örnek:** varış sayısı < ${trNumber(d.lowSampleArrivals)} ise; kural yine yazılır.`,
    '- **Medyan ve yüzdelikler:** sıralı değerler arasında doğrusal aradeğerleme (R tip 7); çift ' +
      'sayıda değerde medyan ortadaki iki değerin ortalamasıdır.',
    '- **Eşik önerileri:** `lost_low` varışlarında ve bütün varışlarda ayrı ayrı AGL ve mesafe ' +
      `yüzdelikleri (p50, p75, p90; AGL ${trNumber(ARRIVAL_PROPOSAL_AGL_STEP_FT)} ft'e, mesafe ` +
      `${trNumber(ARRIVAL_PROPOSAL_DISTANCE_STEP_KM, 1)} km'ye yukarı yuvarlanır) ve her çiftin ` +
      "birlikte yakaladığı pay; eşik ve ARP çerçevesinde. Pay AGL'si bilinen varışlar üzerindendir. " +
      'Kural 2 uygulanırken `lost_low` varışı yoksa bütün varışların önerileri kullanılır.',
    `- **Bugünkü kuralların konum koşulları** (alçalma ve süre koşulları değerlendirilmez): ${rules}. ` +
      '`baro_tolerant` varışlarda pay baro aralığıyla verilir.',
    '- **Geometrik hız duyarlılığı:** `baro_rate` boşken görünen (geometrik) dikey hızla nitelikli ' +
      'olacak kayıtlar ayrıca sayılır (yalnızca etkin pencerede); başlık rakamlarına girmez.',
    `- **\`seen_pos\`:** sayılan varışların istasyon bölgesindeki (${LE} ${trCompact(d.zoneKm)} km) ` +
      'örneklerinin ham değeri; negatif değerler "< 0" kovasındadır.',
    '- **429 oranı:** adsb.lol için pencereye değen her UTC saati `provider_health_hourly` ile ' +
      'eşleştirilir; saatlik satır bütün olarak toplanır (pencere saat başında başlamıyorsa ilk ve ' +
      'son saat pencere dışındaki dakikaları da içerir). Oran `rate_limited / istek`tir (429 ve ' +
      '420). Satırı olmayan saat "ingest çalışmıyor", satırı olup başarısı 0 olan saat "başarı ' +
      '0"dır. Durum süreleri `provider_status_changes`ten pencere içinde hesaplanır. Varıştan ' +
      `sonraki ${durationText(d.providerDegradedWithinMs)} içindeki kesintiyi saymak için ` +
      `geçişler pencere sonundan ${durationText(d.providerDegradedWithinMs)} sonrasına kadar okunur.`,
    `- **Aday sorgusu:** ARP çevresinde yarı genişliği ${trNumber(ARRIVAL_CANDIDATE_BOX_KM, 1)} km ` +
      `(kenarı ≈ ${trNumber(ARRIVAL_CANDIDATE_BOX_KM * 2)} km) olan enlem/boylam kutusu; boylam ` +
      'açıklığı kutunun kutba yakın kenarının enleminde alınır, böylece kutu ' +
      `${trCompact(d.arrivalArpKm)} km'lik çemberi tümüyle kapsar. Satır koşulları: havada, ` +
      `\`alt_baro ${LE} alan yüksekliği + ${above} ft\` (yükseklik bilinmiyorsa 0) ve ` +
      `\`baro_rate < ${trNumber(d.baroRateBelowFpm)} fpm\`; ayrıca geometrik hız duyarlılığı için ` +
      `\`baro_rate\` boşken görünen dikey hızı ${trNumber(d.baroRateBelowFpm)} fpm'in altında olan ` +
      'satırlar. Sınıflandırıcının kesin üst kümesidir.',
    '- **Gizlilik:** rapor yalnızca toplam sayılar taşır; hex, tescil, çağrı kodu ve raporu ' +
      'isteyen yönetici yazılmaz. Askerî uçuşlar sayıma girer (iz tablosunda `dbFlags` yoktur); ' +
      'kimlikleri hiçbir çıktıda yer almaz.',
    '',
  ]
}

function attributionBlock(result: ArrivalCoverageResult): string[] {
  const live = PROVIDER_LICENSES.adsbLol
  const airports = PROVIDER_LICENSES.ourAirports
  const weather = PROVIDER_LICENSES.aviationWeather
  const licenseName = live.license.replace(/-(\d)/, ' $1')
  const lines = [
    '## Veri atfı',
    '',
    `- Canlı uçuş verisi: [${live.attribution.text}](${live.attribution.url}) ${NONE} ` +
      `[${licenseName}](${live.attribution.licenseUrl}). Bu rapor, ODbL 1.0 md. 4.3 uyarınca ` +
      'türetilmiş veritabanından üretilmiş bir eserdir (Produced Work).',
    `- Havalimanı, pist ve yakın alan verisi: [${airports.attribution.text}](${airports.attribution.url}) ` +
      '(kamu malı).',
  ]
  if (result.stations.some((s) => s.qnh !== null)) {
    lines.push(`- QNH: [${weather.attribution.text}](${weather.attribution.url}) METAR gözlemleri.`)
  }
  lines.push('')
  return lines
}

/** Raporun Markdown metni (LF, sonda tek satır sonu). */
export function renderArrivalCoverageMarkdown(
  result: ArrivalCoverageResult,
  meta: ArrivalCoverageRenderMeta,
): string {
  const d = result.definitions
  const lines = [
    ...header(result, meta),
    ...summary(result),
    '## Karar kuralları',
    '',
    ...result.stations.flatMap((s) => decisionBlock(s, d)),
    '## İstasyon ayrıntıları',
    '',
    ...result.stations.flatMap((s) => detailBlock(s, d)),
    ...providerBlock(result.provider),
    ...methodBlock(result),
    ...attributionBlock(result),
  ]
  return `${lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()}\n`
}
