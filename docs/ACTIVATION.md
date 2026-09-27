# Dış aktivasyon adımları

Bu dosya, kullanıcının elle yapacağı dış adımların **tek ve canlı** listesidir. Her parça yeni adımlar ekler.

Durum işaretleri: `[ ]` bekliyor, `[x]` tamam, `[-]` bilinçli olarak yapılmıyor.

## Maliyet özeti (2026-09 fiyatları; kampanya ve kur değişebilir)
| Kalem | Ne zaman gerekir | Tutar |
|---|---|---|
| Hostinger KVM 2 | zaten ödeniyor | Ek gider yok. Bellek eşiği aşılırsa KVM 4: 12,99 $/ay (kampanya), yenilemede 28,99 $/ay |
| Domain | kalıcı domain seçilince (geçici host ücretsiz) | ~10–20 $/yıl |
| GitHub (herkese açık repo, Free) | başlangıç | 0; Actions dakikası sınırsız, dal koruması ücretsiz |
| GHCR, adsb.lol, OpenFreeMap, OurAirports, VRS, aviationweather | — | 0 |
| Analiz (kendi uygulaman) | Parça 1 | 0 (aynı VPS'te ~150–250 MB) |
| SMTP (doğrulama/şifre e-postaları) | Parça 2B | ücretsiz katman yeter |
| Yedek deposu (Backblaze B2 / Cloudflare R2) | Parça 2B | birkaç GB için ~0–1 $/ay |
| Uptime izleme, heartbeat, Sentry | Parça 2B | ücretsiz katman |
| Google Play Console | Parça 4A | 25 $, tek sefer |
| Apple Developer Program | Parça 4B | 99 $/yıl |
| Expo EAS | Parça 4 | ücretsiz plan: platform başına ayda 15 build |
| Yasal metin incelemesi | herkese açık yayından önce | teklife göre |
| Tarife verisi (Parça 5, opsiyonel) | bütçe kararıyla | ~19–100+ $/ay |

Web sürümü (Parça 1–3) için zorunlu tek ek gider kalıcı domain'dir. İki mağaza hesabı ilk yıl toplam ~124 $ tutar.

## Adımlar
| Durum | Adım | Env / secret | Nerede | Neyi açar |
|---|---|---|---|---|
| [x] | GitHub repo `emindemirciai/havayolu` (2026-09-25). Kullanıcı kararıyla **herkese açık** yapıldı; `main` kural seti, gizli bilgi taraması ve push koruması açık (D-061) | — | github.com | İlk push, dal koruması |
| [x] | `gh auth login` (2026-09-25) | — | Terminal | CI izleme, PR ve birleştirme |
| [x] | DNS kayıtları (2026-09-25): A `@`, `api`, `admin`, `analiz` → `72.62.53.122` (TTL 60); CNAME `www` → `havayolu.live` (TTL 300). Hostinger DNS'inde girildi; yeni kayıtlı alan adı olduğu için dünya genelinde görünmesi birkaç saat sürebilir. Dokploy'da alan adı eklemeden önce `nslookup havayolu.live 1.1.1.1` ile doğrulanır | `WEB_HOST=havayolu.live`, `API_HOST=api.havayolu.live`, `ADMIN_HOST=admin.havayolu.live`, `ANALYZE_URL=https://analiz.havayolu.live` | Hostinger DNS | Yayın |
| [x] | Ad ve alan adı: **havayolu** · **havayolu.live** (kayıt 2026-09-25, bitiş 2027-09-25). Domain değişirse web push abonelikleri, ana ekran kurulumları, uygulama bağlantıları, Play'deki `/hesap-silme` adresi ve User-Agent değişir | `APP_NAME=havayolu` | — | Kalıcı yayın |
| [ ] | İletişim e-postası (adsb.lol User-Agent'ı, yasal metinler) | `CONTACT_EMAIL` | — | Canlı veri (boşsa ingest başlamaz) |
| [ ] | **Canlı ingest yayına çıkmadan önce** info@adsb.lol'e bilgilendirme e-postası: uygulamanın tanımı, istek bütçesi (0,1 istek/sn, tek VPS IP'si), User-Agent, ODbL uyum planı | — | E-posta | adsb.lol şartlarına uyum (Parça 1 M4) |
| [ ] | **Erken:** Apple Developer Program (yıllık 99 $; kimlik doğrulaması günler sürebilir) | — | developer.apple.com | iOS build, TestFlight, iOS push |
| [ ] | **Erken:** Google Play Console (25 $). Kişisel hesapta (13.11.2023 sonrası) üretim için en az 12 test kullanıcısının 14 gün kesintisiz katıldığı kapalı test şarttır; ardından inceleme ≤ 7 gün sürer. Kurumsal hesap muaftır ama D-U-N-S ister. Kendi telefonuna APK kurmak için Play hesabı gerekmez | — | play.google.com/console | Android mağaza yayını |
| [ ] | **Erken:** Kapalı test için 12 kişi bul (Google hesabı + Android telefon, 14 gün testten çıkmayacaklar) | `REGISTRATION_ALLOWLIST` | — | Play kapalı testi |
| [-] | Opsiyonel: kendi ADS-B alıcın (RTL-SDR + anten) ve adsb.lol'e besleme. **Şimdilik yapılmıyor (D-006).** Kesin iniş tespiti ve ileride zorunlu olacak API anahtarı için önerilir | `LOCAL_RECEIVER_URLS`, `ADSBLOL_API_KEY` | Ev/ofis | Kesin iniş tespiti |

### Parça 1
| Durum | Adım | Env / secret | Nerede | Neyi açar |
|---|---|---|---|---|
| [ ] | `docs/DEPLOY_DOKPLOY.md` adımları: Dokploy ≥ v0.30.7, panel domain + `ufw-docker` ile 3000 kapalı, Let's Encrypt e-postası, Compose servisi (Autodeploy KAPALI), GHCR registry, Environment (`deploy/dokploy.env.example` bloğu; `.env.example` olduğu gibi kopyalanmaz, `GIT_SHA`/`BUILD_TIME` girilmez), domain'ler | `deploy/dokploy.env.example` (D-060) | Dokploy | Yayın |
| [ ] | Sırları **ilk deploy'dan önce** üret ve Dokploy'da `#parola üret#` yazan yerlere gir (yalnızca `[A-Za-z0-9_-]`, her biri farklı; D-063). Parola yöneticisi ya da PowerShell'de güvenli üretici: `$b = New-Object byte[] 36; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b).Replace('+','-').Replace('/','_').TrimEnd('=')` (48 karakter). Değerleri parola yöneticisine de kaydet | `ADMIN_SETUP_TOKEN`, `POSTGRES_PASSWORD`, `REDIS_QUEUE_PASSWORD`, `REDIS_LIVE_PASSWORD` | Parola yöneticisi → Dokploy | Admin girişi, veritabanları |
| [ ] | VPS: 2 GB swap + `vm.overcommit_memory=1` (tüm projeleri etkiler; bilinçli uygula) | — | VPS (SSH) | Bellek güvenliği |
| [ ] | GitHub secrets ve variables | `DOKPLOY_URL`, `DOKPLOY_API_TOKEN`, `DOKPLOY_COMPOSE_ID`; `WEB_URL`, `API_URL`, `DEPLOY_ENABLED` | GitHub → Settings → Secrets and variables | Otomatik yayın |
| [ ] | Deploy-bot API token'ının kapsamını doğrula; bitiş tarihini buraya yaz | — | Dokploy | Güvenlik |
| [ ] | GHCR için classic PAT (`read:packages`), Dokploy → Settings → Registry'ye `ghcr.io` olarak ekle; bitiş tarihini buraya yaz | — | github.com → Tokens (classic) → Dokploy | İmaj çekme |
| [ ] | İlk yayın (M1b kabulü): `deploy.yml` deneme (`dry_run=true`) → `DEPLOY_ENABLED=true` → `deploy.yml` `dry_run=false`; ardından bir PR birleşince deploy işi yeşil biter ve `https://havayolu.live/api/version` yeni `gitSha`'yı gösterir. Toplam süreyi buraya yaz (hedef ≤ 20 dk) | `DEPLOY_ENABLED` | GitHub Actions | Otomatik yayının kanıtı |
| [ ] | Analiz uygulamasını ayrı Dokploy Compose uygulaması olarak kur (repo `emindemirciai/Analyze.Your.Site-Siteni-Analiz-Et-`, env bloğu `deploy/analiz.env.example`, `ANALYZE_GEO_LOOKUP=false`) | `ANALYZE_URL`, `ANALYZE_SITE_ID` | Dokploy | Ziyaretçi analizi |
| [ ] | 24 saatlik kapsama raporu: admin panelinden `coverage:report` (üretim yoksa `pnpm coverage:probe --hours 24`, bilgisayar uyku moduna geçmeden) | — | Admin / bilgisayar | Parça 2 kararları |

### Parça 2
| Durum | Adım | Env / secret | Nerede | Neyi açar |
|---|---|---|---|---|
| [ ] | VAPID anahtarlarını üret (`pnpm vapid:generate`, sen çalıştırırsın) ve parola yöneticisine yedekle | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Terminal → Dokploy | Web push |
| [ ] | iPhone'da siteyi Ana Ekrana ekle, bildirim izni ver; 20 gerçek IST varışını doğrula | — | Telefon | İlk gerçek bildirim |
| [ ] | SMTP hesabı + SPF/DKIM DNS kayıtları | `SMTP_URL`, `SMTP_FROM` | E-posta sağlayıcısı, DNS | Hesaplar |
| [ ] | S3 uyumlu yedek deposu (B2/R2) | `BACKUP_S3_*` | B2/R2 | Yedekleme |
| [ ] | Dış uptime izleme ve heartbeat URL'leri | `HEARTBEAT_URL_INGEST`, `HEARTBEAT_URL_NOTIFIER`, `HEARTBEAT_URL_BACKUP` | UptimeRobot vb. | Uyarılar |
| [ ] | Expo enhanced push security erişim token'ı | `EXPO_ACCESS_TOKEN` | expo.dev | Mobil push gönderimi |
| [ ] | Opsiyonel: Sentry | `SENTRY_DSN` | sentry.io | Hata takibi |

### Parça 3
| Durum | Adım | Env / secret | Nerede | Neyi açar |
|---|---|---|---|---|
| [ ] | Yasal metinlerin ve analiz onay bandının hukukçu incelemesi | — | Hukukçu | Herkese açık yayın |
| [ ] | Opsiyonel: Turnstile anahtarları | `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Cloudflare | Kayıtta bot koruması |
| [ ] | Herkese açık duyurudan önce info@adsb.lol'e güncelleme e-postası | — | E-posta | adsb.lol şartları |

### Parça 4
| Durum | Adım | Env / secret | Nerede | Neyi açar |
|---|---|---|---|---|
| [ ] | Expo hesabı, EAS projesi, `eas login`, ilk etkileşimli Android build (keystore) | `EXPO_TOKEN` | Terminal | Mobil build |
| [ ] | Firebase projesi + FCM v1 hizmet hesabı; `google-services.json` EAS dosya env'i | `GOOGLE_SERVICES_JSON` | Firebase, EAS | Android push |
| [ ] | Android Studio + SDK + emülatör, Maestro CLI; test için bir Android telefon | — | Bilgisayar | Mobil E2E, gerçek cihaz |
| [ ] | App Store Connect kaydı, APNs anahtarı (EAS'a), zamana duyarlı capability (etkileşimli `eas build -p ios` ya da portal) | — | Apple | iOS push |
| [ ] | Derin bağlantı kimlikleri | Apple Team ID, Android imza parmak izi | Apple, EAS | Universal/App Links |
| [ ] | Mağaza görselleri ve metinleri | — | Play Console, App Store Connect | Yayın |
