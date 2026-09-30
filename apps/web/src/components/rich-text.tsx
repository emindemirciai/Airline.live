import { Fragment, type ReactNode } from 'react'

/**
 * `format`'ın (packages/i18n) React karşılığı: "{ad}" yer tutucularını öğelerle (ör. bağlantı)
 * doldurur. Metin i18n'de tek cümle olarak kalır, bağlantı cümlenin içinde durur. Eksik değişken
 * hata fırlatır; sessizce boş metin çizilmez.
 */
export function richText(template: string, values: Readonly<Record<string, ReactNode>>): ReactNode {
  // Yakalama gruplu bölme: çift sıradakiler metin, tek sıradakiler yer tutucu adıdır.
  const parts = template.split(/\{(\w+)\}/g)
  return parts.map((part, index) => {
    if (index % 2 === 0) return part
    const value = values[part]
    if (value === undefined) throw new Error(`Missing text variable: {${part}}`)
    return <Fragment key={`${part}-${index}`}>{value}</Fragment>
  })
}
