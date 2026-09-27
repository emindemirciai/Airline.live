/**
 * Loglarda ve panelde gösterilecek hata iletisi. Sürücü hatasını saran kütüphanelerde (Drizzle'ın
 * "Failed query: <sorgu> params: <parametreler>" iletisi) asıl sebep `cause`'tadır; o kullanılır.
 * Uzun iletiler kısaltılır.
 */
export function errorMessage(error: unknown, maxLength = 500): string {
  if (!(error instanceof Error)) return String(error).slice(0, maxLength)
  const cause = error.cause instanceof Error ? error.cause.message : null
  return (cause ?? error.message).slice(0, maxLength)
}
