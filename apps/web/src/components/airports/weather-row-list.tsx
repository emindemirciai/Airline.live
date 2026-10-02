import './weather-rows.css'

import { WeatherRowIcon } from './weather-icon'
import type { WeatherRow } from './weather-rows'

/**
 * Hava durumu satırları (harita penceresi ve havalimanı sayfası): gerçek `<dl>`, her satır bir
 * `<div>` içinde `<dt>` (simge + etiket) ve `<dd>` (değer, varsa kuvvetli rüzgâr etiketi). Var olan
 * olayın satırı `data-tone` ile renkli zemin ve kalın yazı alır; vurgu renkten ibaret değildir,
 * değer olayın adını yazar ("Yok" yerine "Hafif sağanak yağmur"). Kanca yoktur: sunucuda, adada ve
 * harita penceresinde aynı biçimde çizilir.
 */
export function WeatherRowList({
  rows,
  className,
}: {
  rows: readonly WeatherRow[]
  /** Ek sınıf (`wx-rows--page`: dar sayfada etiket değerin üstüne geçer). */
  className?: string
}) {
  return (
    <dl className={className ? `wx-rows ${className}` : 'wx-rows'}>
      {rows.map((row) => (
        <div key={row.key} className="wx-row" data-row={row.key} data-tone={row.tone ?? undefined}>
          <dt>
            <WeatherRowIcon row={row.key} />
            {row.label}
          </dt>
          <dd>
            {row.value}
            {row.strong ? (
              <>
                {' '}
                <span className="wx-tag">{row.strong}</span>
              </>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  )
}
