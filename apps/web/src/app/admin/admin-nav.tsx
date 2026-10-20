import Link from 'next/link'

export type AdminSection = 'services' | 'coverage' | 'live'

const SECTIONS: { id: AdminSection; href: string }[] = [
  { id: 'services', href: '/admin' },
  { id: 'coverage', href: '/admin/kapsama' },
  // Canlı katman anahtarı (D-115).
  { id: 'live', href: '/admin/canli-katman' },
]

/** Yönetim sayfaları arasındaki gezinme (yalnızca Türkçe, D-076); açık sayfa `aria-current`. */
export function AdminNav({
  current,
  labels,
}: {
  current: AdminSection
  labels: { label: string } & Record<AdminSection, string>
}) {
  return (
    <nav aria-label={labels.label} className="admin-nav">
      <ul>
        {SECTIONS.map((section) => (
          <li key={section.id}>
            <Link
              href={section.href}
              prefetch={false}
              aria-current={section.id === current ? 'page' : undefined}
            >
              {labels[section.id]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
