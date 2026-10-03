import type { ReactElement } from 'react'
import { LOGO_COLORS, THEME_COLORS, type LogoColors } from '../seo/brand'
import {
  LOGO_BOX,
  LOGO_CENTER,
  LOGO_ICON_CORNER_RATIO,
  LOGO_ICON_INSET_RATIO,
  LOGO_KNOCKOUT_PATH,
  LOGO_KNOCKOUT_WIDTH,
  LOGO_RING,
  LOGO_SMALL_DISC_RADIUS,
  logoPlaneTransform,
  PLANE_BODY_PATH,
  PLANE_ENGINES_PATH,
  type LogoVariant,
} from './logo-geometry'

/**
 * Logonun SVG'si (D-086). Hook almaz ve `<svg>`'nin içinde yalnızca yerleşik SVG ögeleri vardır:
 * aynı çizim hem sitede (React DOM, `components/brand/brand-mark.tsx`) hem `next/og` (Satori, resvg)
 * görsellerinde çalışır. Tam işarette halka uçağın kalın çizilmiş gövdesiyle maskelenir; maskenin
 * kimliği belgede tekil olmalıdır (sitede `useId`, tek işaretli görselde sabit ad).
 */
const VIEW_BOX = `0 0 ${LOGO_BOX} ${LOGO_BOX}`

function planeShapes(variant: LogoVariant, fill: string): ReactElement {
  return (
    <g transform={logoPlaneTransform(variant)} fill={fill}>
      <path d={PLANE_BODY_PATH} />
      <path d={PLANE_ENGINES_PATH} />
    </g>
  )
}

/**
 * İşaretin şekilleri (100 × 100 birim) tek `<g>` içinde. `full`: halka ve içinden geçen uçak; burun,
 * kanat uçları ve kuyruk halkayı keser. `small` (32 px ve altı): dolu daire ve içinde uçak.
 *
 * Satori `<svg>` içinde bileşen kabul etmez; bu yüzden şekiller işlev çağrısıyla kurulur.
 */
export function logoShapes({
  variant,
  colors,
  maskId,
}: {
  variant: LogoVariant
  colors: LogoColors
  /** Halkayı kesen maskenin belgedeki tekil kimliği (yalnızca `full`). */
  maskId: string
}): ReactElement {
  if (variant === 'small') {
    return (
      <g>
        <circle cx={LOGO_CENTER} cy={LOGO_CENTER} r={LOGO_SMALL_DISC_RADIUS} fill={colors.ring} />
        {planeShapes(variant, colors.plane)}
      </g>
    )
  }
  return (
    <g>
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={LOGO_BOX} height={LOGO_BOX}>
          <rect width={LOGO_BOX} height={LOGO_BOX} fill="#fff" />
          <path
            d={LOGO_KNOCKOUT_PATH}
            transform={logoPlaneTransform(variant)}
            fill="#000"
            stroke="#000"
            strokeWidth={LOGO_KNOCKOUT_WIDTH}
            strokeLinejoin="round"
          />
        </mask>
      </defs>
      <circle
        cx={LOGO_RING.cx}
        cy={LOGO_RING.cy}
        r={LOGO_RING.r}
        fill="none"
        stroke={colors.ring}
        strokeWidth={LOGO_RING.strokeWidth}
        mask={`url(#${maskId})`}
      />
      {planeShapes(variant, colors.plane)}
    </g>
  )
}

export interface LogoSvgProps {
  variant: LogoVariant
  colors: LogoColors
  maskId: string
  /** Kenar (px); verilmezse boyut CSS'ten gelir. */
  size?: number
  className?: string
}

/** Logonun kendi `<svg>`'si. Yazının yanında süstür: ekran okuyucuya ad verilmez, odaklanmaz. */
export function logoSvg({ variant, colors, maskId, size, className }: LogoSvgProps): ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={VIEW_BOX}
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {logoShapes({ variant, colors, maskId })}
    </svg>
  )
}

/**
 * Uygulama simgesi: turkuaz zemin ve %12 içeride beyaz tam işaret. `rounded`: köşeler kenarın
 * %24'ü yarıçapla yuvarlatılır, köşeler saydamdır (tarayıcı, masaüstü, JSON-LD logosu).
 * `rounded: false`: tam kare, saydam piksel yok (iOS köşeyi kendisi yuvarlar ve saydamı siyaha
 * boyar; Android'in maskelenebilir simgesi kareyi doldurmalıdır). İşaret maskelenebilir simgenin
 * güvenli alanında kalır (merkezden en uzak nokta kanat ucu, kenarın ~%35'i; sınır %40).
 */
export function logoIconSvg({
  size,
  rounded,
  maskId,
}: {
  size: number
  rounded: boolean
  maskId: string
}): ReactElement {
  const inset = LOGO_BOX * LOGO_ICON_INSET_RATIO
  const scale = 1 - 2 * LOGO_ICON_INSET_RATIO
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={VIEW_BOX}
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <rect
        width={LOGO_BOX}
        height={LOGO_BOX}
        rx={rounded ? LOGO_BOX * LOGO_ICON_CORNER_RATIO : 0}
        fill={THEME_COLORS.header}
      />
      <g transform={`translate(${inset} ${inset}) scale(${scale})`}>
        {logoShapes({ variant: 'full', colors: LOGO_COLORS.header, maskId })}
      </g>
    </svg>
  )
}
