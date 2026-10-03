import './weather-rows.css'

import { WeatherRowIcon } from './weather-icon'
import type { WeatherRow } from './weather-rows'

/**
 * Hava durumu satırları (harita penceresi ve havalimanı sayfası): gerçek `<dl>`, her satır bir
 * `<div>` içinde `<dt>` (simge + etiket) ve `<dd>` (değer, varsa rüzgârın şiddet etiketi). Var olan
 * olayın, etkili rüzgârın ve şimşek ve yıldırım riskinin satırı `data-tone` ile renkli zemin ve kalın
 * yazı alır; vurgu renkten ibaret değildir, değer olayın adını ya da uyarıyı yazar ("Yok" yerine
 * "Hafif sağanak yağmur"), rüzgârın şiddeti etiketle yazılır. Kanca yoktur: sunucuda, adada ve harita
 * penceresinde aynı biçimde çizilir. Harita penceresinin bilgi satırları (rakım, pistler, yerel saat)
 * da bu listeyle çizilir: iki liste aynı DOM'u ve aynı sütunları kullanır (M6e.1, D-083).
 */
export function WeatherRowList({
  rows,
  className,
}: {
  rows: readonly WeatherRow[]
  /**
   * Ek sınıf: `wx-rows--page` dar sayfada etiketi değerin üstüne alır; `wx-rows--popup` (harita
   * penceresi) sabit genişlikte etiket sütunuyla bilgi ve hava durumu satırlarını aynı x'e hizalar.
   */
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
