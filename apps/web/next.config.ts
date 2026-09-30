import { resolve } from 'node:path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Docker imajı için bağımsız sunucu çıktısı. Monorepo kökü izleme kökü olarak verilir.
  output: 'standalone',
  outputFileTracingRoot: resolve(process.cwd(), '../..'),
  // Paylaşım görsellerinin yazı tipleri çalışma anında diskten okunur (lib/seo/og-fonts.ts). Turbopack
  // klasörü kendisi de izliyor; açık ekleme standalone çıktıyı bu sezgiye bağımlı olmaktan kurtarır.
  // OFL-1.1 lisans metni yazı tipleriyle birlikte dağıtılır.
  outputFileTracingIncludes: {
    '/*': ['./assets/og-fonts/*.woff', './assets/og-fonts/OFL.txt'],
  },
  // Sayfa üst verisi (başlık, kanonik adres, hreflang) her istemci için <head> içinde, akış
  // beklenmeden yazılır. Varsayılan liste GPTBot, ClaudeBot, PerplexityBot gibi tarayıcıları
  // kapsamaz; onlar üst veriyi <body>'de görürdü (D-076). Üst veri önbellekli veriden gelir.
  htmlLimitedBots: /.*/,
  transpilePackages: ['@havayolu/shared', '@havayolu/i18n', '@havayolu/geo'],
  poweredByHeader: false,
  reactStrictMode: true,
}

export default nextConfig
