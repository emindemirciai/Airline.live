/**
 * Marka adı (D-112): `APP_NAME` tanımsız ya da boşken web, API, worker ve araçlar bunu kullanır;
 * build sırasında (env yokken) çizilen metinler de (havalimanı paylaşım görselinin `alt`'ı).
 */
export const DEFAULT_APP_NAME = 'Airline.live'

/**
 * Projenin sahibi ve lisansı (LICENSE dosyasıyla aynı). Sayfa kaynağındaki bildirimde kullanılır.
 * Repo gizlidir (D-068) ve iç adını taşır: sayfalarda repo adresi yazılmaz, `<link rel="license">`
 * kullanım koşullarının kaynak kodu bölümüne gider (D-112).
 */
export const PROJECT = {
  owner: 'emindemirciai',
  ownerUrl: 'https://github.com/emindemirciai',
  copyrightYear: 2026,
  license: 'MIT',
} as const

/** Tam git commit kimliğinin ekranda gösterilen kısa hâli (ilk 7 hane); "dev" gibi değerler olduğu gibi kalır. */
export function shortSha(sha: string): string {
  return /^[0-9a-f]{8,40}$/i.test(sha) ? sha.slice(0, 7) : sha
}
