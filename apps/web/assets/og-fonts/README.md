# Paylaşım görseli yazı tipleri

Overpass (normal, 400 ve 800), `@fontsource/overpass` 5.3.0 paketinin `files/` klasöründen kopyalanmıştır. Lisans: SIL Open Font License 1.1 (`OFL.txt`, telif: The Overpass Project Authors).

- `next/og` (Satori) WOFF2 okumaz; bu yüzden `.woff` dosyaları kullanılır.
- `latin` alt kümesinde ğ, İ ve ş yoktur; `latin-ext` ayrı bir aile adıyla yüklenir ve eksik harflerde yedek olarak kullanılır (`apps/web/src/lib/seo/og-fonts.ts`). Böylece Satori hiçbir harf için Google Fonts'a istek atmaz.
- Dosyalar çalışma anında okunur ve standalone çıktıya `next.config.ts` → `outputFileTracingIncludes` ile girer.
- Sürüm yükseltmesinde aynı dört dosya ve lisans metni yeniden kopyalanır.
