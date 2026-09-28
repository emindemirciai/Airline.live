/** Projenin sahibi ve lisansı (LICENSE dosyasıyla aynı). Sayfa kaynağındaki bildirimde kullanılır. */
export const PROJECT = {
  owner: 'emindemirciai',
  ownerUrl: 'https://github.com/emindemirciai',
  repoUrl: 'https://github.com/emindemirciai/havayolu',
  licenseUrl: 'https://github.com/emindemirciai/havayolu/blob/main/LICENSE',
  copyrightYear: 2026,
  license: 'MIT',
} as const

/** Tam git commit kimliğinin ekranda gösterilen kısa hâli (ilk 7 hane); "dev" gibi değerler olduğu gibi kalır. */
export function shortSha(sha: string): string {
  return /^[0-9a-f]{8,40}$/i.test(sha) ? sha.slice(0, 7) : sha
}
