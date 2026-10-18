'use client'

// Göreli yollar: vitest `@/` takma adını çözmez ve bu dosya testte çizilir.
import { ErrorContent } from '../components/error-content'

/**
 * Sayfa bölümlerindeki beklenmeyen hata (ör. API yanıt vermediği ve havalimanı listesi web
 * belleğinde henüz yokken bir havalimanı sayfası, D-111). Kök düzenin içinde çizilir: site başlığı,
 * menü, "Açık turkuaz" teması ve `color-scheme: light` geçerlidir (D-081). Metin `<html lang>`'ın
 * dilindedir (`ErrorContent`). `retry` bölümü sunucudan yeniden ister.
 */
export default function ErrorPage({
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return <ErrorContent retry={retry} />
}
