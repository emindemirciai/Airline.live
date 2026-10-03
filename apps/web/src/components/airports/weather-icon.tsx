import type { WeatherIconCategory } from '@havayolu/shared'
import type { ReactNode } from 'react'

/**
 * Hava durumu simgeleri (M6c, brief §5): kendi çizimimiz, 24 px, `currentColor`. Süsleme amaçlıdır
 * (`aria-hidden`); anlamı her zaman yanındaki metin taşır. Üçüncü taraf ya da marka simge seti ve
 * emoji kullanılmaz.
 */

/** Tam bulut (ortada). */
const CLOUD = 'M6.5 18h11a4 4 0 0 0 .4-7.98A5.5 5.5 0 0 0 7.3 9.2 4.4 4.4 0 0 0 6.5 18z'
/** Üstte duran bulut (altına yağış çizilir). */
const CLOUD_HIGH = 'M6.5 14h11a3.6 3.6 0 0 0 .4-7.18A5 5 0 0 0 7.6 5.9 4 4 0 0 0 6.5 14z'

function Sun({ cx = 12, cy = 12, r = 4 }: { cx?: number; cy?: number; r?: number }) {
  const rays = [0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
    const rad = (deg * Math.PI) / 180
    const x1 = cx + Math.cos(rad) * (r + 2)
    const y1 = cy + Math.sin(rad) * (r + 2)
    const x2 = cx + Math.cos(rad) * (r + 4)
    const y2 = cy + Math.sin(rad) * (r + 4)
    return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} />
  })
  return (
    <>
      <circle cx={cx} cy={cy} r={r} />
      {rays}
    </>
  )
}

function Moon({ dx = 0, dy = 0 }: { dx?: number; dy?: number }) {
  return (
    <path
      transform={`translate(${dx} ${dy})`}
      d="M15.5 4.5a7.5 7.5 0 1 0 4 13.6A6.5 6.5 0 0 1 15.5 4.5z"
    />
  )
}

function Drops({ count = 3, slant = true }: { count?: number; slant?: boolean }) {
  const xs = count === 2 ? [10, 14] : [8, 12, 16]
  return (
    <>
      {xs.map((x) => (
        <line key={x} x1={x} y1={16.5} x2={slant ? x - 1.5 : x} y2={21} />
      ))}
    </>
  )
}

function Dots({ y = 18.5 }: { y?: number }) {
  return (
    <>
      {[8, 12, 16].map((x) => (
        <circle key={x} cx={x} cy={y} r={0.9} fill="currentColor" />
      ))}
    </>
  )
}

function Flakes() {
  return (
    <>
      {[8, 12, 16].map((x, i) => (
        <g key={x} transform={`translate(${x} ${i === 1 ? 19.5 : 17.8})`}>
          <line x1={-1.6} y1={0} x2={1.6} y2={0} />
          <line x1={-0.8} y1={-1.4} x2={0.8} y2={1.4} />
          <line x1={-0.8} y1={1.4} x2={0.8} y2={-1.4} />
        </g>
      ))}
    </>
  )
}

function Lines({ ys, from = 4, to = 20 }: { ys: readonly number[]; from?: number; to?: number }) {
  return (
    <>
      {ys.map((y, i) => (
        <line key={y} x1={from + (i % 2) * 2} y1={y} x2={to - ((i + 1) % 2) * 2} y2={y} />
      ))}
    </>
  )
}

function shape(category: WeatherIconCategory): ReactNode {
  switch (category) {
    case 'clear':
      return <Sun />
    case 'clear_night':
      return <Moon />
    case 'fair':
      return (
        <>
          <Sun cx={9} cy={9} r={3} />
          <path d="M10 19h7.5a3 3 0 0 0 .3-5.98A4 4 0 0 0 10.4 12.6 3.2 3.2 0 0 0 10 19z" />
        </>
      )
    case 'fair_night':
      return (
        <>
          <Moon dx={-4} dy={-3} />
          <path d="M10 20h7.5a3 3 0 0 0 .3-5.98A4 4 0 0 0 10.4 13.6 3.2 3.2 0 0 0 10 20z" />
        </>
      )
    case 'partly':
      return (
        <>
          <Sun cx={8} cy={8} r={3} />
          <path d={CLOUD} />
        </>
      )
    case 'partly_night':
      return (
        <>
          <Moon dx={-5} dy={-4} />
          <path d={CLOUD} />
        </>
      )
    case 'mostly_cloudy':
      return (
        <>
          <path d="M9 9.5a4.5 4.5 0 0 1 8.4-1.2A3.4 3.4 0 0 1 20 13.4" />
          <path d={CLOUD} />
        </>
      )
    case 'overcast':
      return (
        <>
          <path d="M4 12.5a3.6 3.6 0 0 1 3.4-5.4A5 5 0 0 1 16.6 6" />
          <path d={CLOUD} />
        </>
      )
    case 'obscured':
      return (
        <>
          <path d={CLOUD_HIGH} />
          <Lines ys={[17, 20]} />
        </>
      )
    case 'fog':
      return <Lines ys={[7, 11, 15, 19]} />
    case 'mist_haze':
      return (
        <>
          {[8, 12.5, 17].map((y) => (
            <path key={y} d={`M4 ${y}c2-1.6 4-1.6 6 0s4 1.6 6 0 3-1.2 4-.6`} />
          ))}
        </>
      )
    case 'dust_sand':
      return (
        <>
          <path d="M4 8h10a2.5 2.5 0 1 0-2.5-2.5" />
          <path d="M4 12.5h14a2.5 2.5 0 1 1-2.5 2.5" />
          <path d="M4 17h7" />
        </>
      )
    case 'drizzle':
      return (
        <>
          <path d={CLOUD_HIGH} />
          <Dots />
        </>
      )
    case 'rain':
      return (
        <>
          <path d={CLOUD_HIGH} />
          <Drops count={2} />
        </>
      )
    case 'rain_heavy':
      return (
        <>
          <path d={CLOUD_HIGH} />
          <Drops />
        </>
      )
    case 'showers':
      return (
        <>
          <Sun cx={17.5} cy={5.5} r={2} />
          <path d={CLOUD_HIGH} />
          <Drops count={2} />
        </>
      )
    case 'snow':
      return (
        <>
          <path d={CLOUD_HIGH} />
          <Flakes />
        </>
      )
    case 'sleet':
      return (
        <>
          <path d={CLOUD_HIGH} />
          <line x1={9} y1={16.5} x2={7.8} y2={20.5} />
          <circle cx={13} cy={18.5} r={0.9} fill="currentColor" />
          <line x1={17} y1={16.5} x2={15.8} y2={20.5} />
        </>
      )
    case 'freezing':
      return (
        <>
          <path d={CLOUD_HIGH} />
          <Drops count={2} />
          <g transform="translate(18 19)">
            <line x1={-1.6} y1={0} x2={1.6} y2={0} />
            <line x1={0} y1={-1.6} x2={0} y2={1.6} />
          </g>
        </>
      )
    case 'hail':
      return (
        <>
          <path d={CLOUD_HIGH} />
          {[8, 12, 16].map((x, i) => (
            <circle key={x} cx={x} cy={i === 1 ? 19.5 : 17.5} r={1.3} />
          ))}
        </>
      )
    case 'thunder':
      return (
        <>
          <path d={CLOUD_HIGH} />
          <path d="M12.5 14l-2.5 4h3l-2 4" />
        </>
      )
    case 'thunder_hail':
      return (
        <>
          <path d={CLOUD_HIGH} />
          <path d="M11 14l-2.5 4h3l-2 4" />
          <circle cx={16} cy={18} r={1.3} />
        </>
      )
    case 'severe':
      return (
        <>
          <path d="M12 3.5l9 16H3z" />
          <line x1={12} y1={9.5} x2={12} y2={14} />
          <circle cx={12} cy={16.8} r={0.9} fill="currentColor" />
        </>
      )
    default:
      return (
        <>
          <circle cx={12} cy={12} r={8.5} />
          <path d="M9.6 9.6a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.6" />
          <circle cx={12} cy={16.6} r={0.9} fill="currentColor" />
        </>
      )
  }
}

/**
 * Satır simgeleri (M6d ek istekleri, 2026-10-02): rüzgâr, yağmur, kar, gök gürültüsü, sis ve pus,
 * görüş, bulut ve dolu satırının önünde, 18 px, kendi çizimimiz (kullanıcının onayladığı tasarım
 * tuvalindeki çizgi simgeler). Harita penceresinin bilgi satırları da aynı çizgi biçiminde simge
 * taşır (M6e.1, D-083): rakım (iki tepeli dağ), pistler (perspektifte pist şeridi ve kesik orta
 * çizgisi), yerel saat (saat kadranı). Havalimanı sayfasında bu anahtarlarla satır yoktur.
 */
const ROW_SHAPES: Readonly<Partial<Record<string, ReactNode>>> = {
  elevation: <path d="M3 19 9.5 8l3.7 6.2L15.5 11 21 19z" />,
  runways: (
    <>
      <path d="M9.5 3h5l4 18h-13z" />
      <path d="M12 6.5v1.5M12 11v2M12 16v2.5" />
    </>
  ),
  localTime: (
    <>
      <circle cx={12} cy={12} r={9} />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  wind: (
    <>
      <path d="M3 8h11a3 3 0 1 0-3-3" />
      <path d="M3 12h15a3 3 0 1 1-3 3" />
      <path d="M3 16h7" />
    </>
  ),
  rain: (
    <>
      <path d="M7 15a4 4 0 0 1-.6-8 5 5 0 0 1 9.7 1.1A3.5 3.5 0 0 1 17 15" />
      <path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3" />
    </>
  ),
  snow: <path d="M12 2v20M4.9 6.5l14.2 11M4.9 17.5l14.2-11" />,
  thunder: <path d="M13 2L5 13h6l-1 9 8-11h-6l1-9z" />,
  fog: <path d="M3 9h18M5 13h14M3 17h18" />,
  visibility: (
    <>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
      <circle cx={12} cy={12} r={3} />
    </>
  ),
  clouds: <path d={CLOUD} />,
  hail: (
    <>
      <path d={CLOUD_HIGH} />
      {[8, 12, 16].map((x, i) => (
        <circle key={x} cx={x} cy={i === 1 ? 19.5 : 18} r={1.4} />
      ))}
    </>
  ),
}

/**
 * Hava durumu satırının simgesi; süsleme amaçlıdır (`aria-hidden`), anlamı satırın etiketi taşır.
 * Simgesi olmayan satırda (sıcaklık, nem, basınç…) etiketler hizalı kalsın diye boş yer tutucu.
 */
export function WeatherRowIcon({ row }: { row: string }) {
  const shape = ROW_SHAPES[row]
  if (shape === undefined) return <span className="wx-icon" aria-hidden="true" />
  return (
    <svg
      className="wx-icon"
      data-icon={row}
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {shape}
    </svg>
  )
}

export function WeatherIcon({ category }: { category: WeatherIconCategory }) {
  return (
    <svg
      className="weather-icon"
      data-icon={category}
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {shape(category)}
    </svg>
  )
}
