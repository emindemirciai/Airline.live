import Link from 'next/link'

export interface Crumb {
  name: string
  /** Dil önekli site içi yol; son öğe (geçerli sayfa) bağlantısızdır. */
  href: string
}

/**
 * Görünür içerik yolu (breadcrumb). JSON-LD `BreadcrumbList` aynı öğelerden kurulur, bu yüzden
 * ikisi ayrışmaz. Ayraç CSS'tedir ve ekran okuyucuya okunmaz (globals.css → `.breadcrumbs`).
 */
export function Breadcrumbs({ label, items }: { label: string; items: readonly Crumb[] }) {
  return (
    <nav aria-label={label} className="breadcrumbs">
      <ol>
        {items.map((item, index) =>
          index === items.length - 1 ? (
            <li key={item.href}>
              <span aria-current="page">{item.name}</span>
            </li>
          ) : (
            <li key={item.href}>
              <Link href={item.href}>{item.name}</Link>
            </li>
          ),
        )}
      </ol>
    </nav>
  )
}
