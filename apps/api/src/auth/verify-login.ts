import { createHash, timingSafeEqual } from 'node:crypto'

export interface AdminCredentials {
  email: string
  setupToken: string
}

const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest()

/**
 * E-posta büyük/küçük harf duyarsız, parola sabit zamanlı karşılaştırılır. Uzunluk farkı da
 * zamanlamadan sızmasın diye iki taraf önce SHA-256 ile eşit uzunluğa getirilir.
 */
export function verifyAdminCredentials(
  expected: AdminCredentials,
  email: string,
  password: string,
): boolean {
  const emailOk = expected.email.trim().toLowerCase() === email.trim().toLowerCase()
  const passwordOk = timingSafeEqual(digest(expected.setupToken), digest(password))
  return emailOk && passwordOk
}
