# Parça 1 planı — canlı ilerleme dosyası

Kaynak: `docs/prompts/parca-1.md`. Her kilometre taşı ayrı dal ve PR'dır.

Onay: 2026-09-25 (kullanıcı: "Proje + Parça 1'e başla")

Durumlar: `[ ]` başlamadı, `[~]` sürüyor, `[k]` kod bitti ve kullanıcı doğrulaması bekliyor, `[x]` tamam.

| # | Kilometre taşı | Dal | Durum | Birleşen PR |
|---|---|---|---|---|
| M0 | Repo iskeleti, yerel test ortamı, Durum ve Yenilikler | `p1/m0-skeleton` | [x] | #1 |
| M1a | İmajlar, bütün servisler, yönetici oturumu, admin Servisler paneli | `p1/m1a-images` | [k] üretimde yayında (2026-09-27); admin Servisler panelinde bütün servislerin çalıştığını kullanıcı doğrulayacak | #2 |
| — | Marka geçişi: havayolu · havayolu.live (D-059) | `chore/havayolu-marka` | [x] | #3 |
| — | Birleştirme öncesi inceleme düzeltmeleri, açık repo ve `main` koruması (D-060…D-063) | `p1/m1a-hardening` | [x] | #4 |
| M1b | Yayın hattı (CI, deploy, rollback, DEPLOY_DOKPLOY.md) | `p1/m1b-deploy` | [x] otomatik yayın zinciri 2026-09-27'de doğrulandı (CI → `release` dalı → Dokploy Autodeploy → `/version`, D-070) | #6, #9 |
| M2 | Veritabanı ve referans verisi | `p1/m2-db` | [x] | #7 |
| M3 | Sağlayıcılar | `p1/m3-providers` | [x] | #10 |
| M4 | Ingest, replay ve senaryo araçları | `p1/m4-ingest` | [k] kod bitti; üretimde adsb.lol çekimi kullanıcının iki ACTIVATION adımından (info@adsb.lol bildirimi, ardından `CONTACT_EMAIL`) sonra açılır | #11 |
| M5 | Canlı API | `p1/m5-live-api` | [x] tamam; üretimde 5 dk boşta WS bağlantısı doğrulandı (2026-09-29) | #13 |
| M6 | Web canlı harita | `p1/m6-map` | [x] tamam; üretimde uydu altlığı doğrulandı (2026-09-30) | #14 |
| M6b | Havalimanı sayfaları, dil adreste (`/en`), SEO ve GEO | `p1/m6b-seo` | [k] kod bitti; Search Console, Bing ve Yandex doğrulaması kullanıcıda (ACTIVATION) | #15 |
| M6c | Havalimanı hava durumu (METAR/TAF), METAR/TAF kaydı, haritada havalimanı penceresi | `p1/m6c-weather` | [x] tamam; üretimde gerçek METAR/TAF doğrulandı (2026-10-02) | #16 |
| M6d | Türkiye dışındaki havalimanları, 1. halka (≤ 500 km, 75 havalimanı), açık turkuaz tema, hava durumu sunumu | `p1/m6d-ring1` | [x] tamam; üretimde 136 havalimanı, 122 istasyonda METAR (68'i yurt dışı) doğrulandı (2026-10-02) | #17 |
| M6e | Hava durumu: pencere ortalı, rüzgâr km/sa ve kt, kuvvetli rüzgâr vurgusu, kümülonimbüs ve yıldırım uyarısı | `p1/m6e-weather-wind` | [x] tamam; üretimde doğrulandı (2026-10-03, v0.13.0): IST penceresinde "Kuzeydoğudan 37 km/sa (20 kt)", kehribar "Kuvvetli rüzgâr" | #18 |
| M6e.1 | Pencere hizası (yama) | `p1/m6e1-popup-align` | [x] tamam; üretimde doğrulandı (2026-10-03, v0.13.1): IST penceresinin 9 satırında simge x=13, değer x=147 | #19 |
| M6f | Adlar ve saat: askerî ve sivil havalimanı adları TR/EN, haritada havalimanı adı etiketi, yurt dışında yerel saat ve UTC farkı | `p1/m6f-names-time` | [x] tamam; üretimde doğrulandı (2026-10-03, v0.14.0): İncirlik Hava Üssü / Incirlik Air Base, Ankara (Etimesgut), /istasyon/LGAV "Yerel saat 19:37 (UTC+3)" | #20 |
| M6e.2 | Rüzgâr renkleri ve rüzgâr kesmesi (yama, v0.14.1) | `p1/m6e2-wind-colors` | [x] tamam; üretimde doğrulandı (2026-10-03, v0.14.1): UGTB, UGKO, LGMK kehribar, LGKP ve LRCK açık yeşil | #21 |
| M6l | Logo: A · Halka | `p1/m6l-logo` | [x] tamam; üretimde doğrulandı (2026-10-03, v0.15.0): başlıkta yeni işaret, /icon/512 ve /icon/maskable, 512 px simgede kuyruk kırıntısı yok | #22 |
| M6k | Uçak listesi sağ üstte: sefer, kuyruk, yükseklik, konum ve durum | `p1/m6k-aircraft-list` | [k] kod bitti; üretimde listenin ve durumların görülmesi bekliyor (ACTIVATION) | #23 |
| M6e.3 | Derecelendirilmiş rüzgâr renkleri (yama, v0.16.1) | `p1/m6e3-wind-scale` | [x] tamam; üretimde doğrulandı (2026-10-04, v0.16.1): LTFM, LTBA, LGAV kehribar, LTAC sarı, UGTB yeşil-sarı, LTAI yeşil | #24 |
| M6g | Türkiye dışındaki havalimanları, 2. halka (≤ 1.000 km); haritanın atıf şeridinde site künyesi | `p1/m6g-ring2` | [k] kod bitti; üretimde 225 havalimanı ve HEBA hava durumunun görülmesi bekliyor (ACTIVATION) | #25 |
| M6e.4 | Yeniliklerde yayın tarihi ve saati (yama, v0.17.1) | `p1/changelog-time` | [x] tamam; üretimde doğrulandı (2026-10-04, v0.17.1): /yenilikler v0.17.1 "4 Ekim 2026, 21:36 (Türkiye saati)" (sunucunun açılışı), v0.17.0 20:27 | #26 |
| M6e.5 | Haritada kesikli ülke sınırları (yama, v0.17.2) | `p1/map-borders` | [x] tamam; üretimde doğrulandı (2026-10-04, v0.17.2): Balkanlarda kesikli sınırlar, şeritte OpenFreeMap atfı | #27 |
| M6e.6 | API yanıtlarının sıkıştırılması (yama, v0.18.1) | `p1/api-gzip` | [x] tamam; üretimde doğrulandı (2026-10-04, v0.18.1): content-encoding br; haritanın havalimanı ve pist listesi 439.090 → 75.715 bayt; v0.18.1 Release 2026-10-04T20:32:07Z | #29 |
| M6e.7 | Haritada ülke adları başkentlerde (yama, v0.18.2) | `p1/map-country-labels` | [x] tamam; üretimde doğrulandı (2026-10-05, v0.18.2): uydu üstünde z5'te TÜRKİYE, ROMANYA, BULGARİSTAN, YUNANİSTAN okunur, iğneler ve kesikli sınırlar üstte; Balkanlarda küçük adlar soluk; v0.18.2 Release 2026-10-05T01:08:09Z | #30 |
| M6e.8 | Ülke adları sınır içinde, kelime başına satır (yama, v0.19.1) | `p1/map-country-fit` | [x] tamam; üretimde doğrulandı (2026-10-05, v0.19.1): uydu üstünde z5,3'te TÜRKİYE sınır içinde (Ankara'nın güneyinde), BOSNA / HERSEK alt alta, adlar kıyıdan taşmıyor; v0.19.1 Release 2026-10-05T05:51:51Z | #32 |
| M6e.9 | Ülke adları daha belirgin, boş yerde (yama, v0.21.1; D-099) | `p1/map-country-clear` | [k] kod bitti; üretimde uydu üstünde görünüm denetimi bekliyor (ACTIVATION M6e.9) | — |
| M6e.10 | Askerî üsler haritada gösterilmez; açılış yakınlaştırması masaüstünde 8 (yama; D-103, D-104) | `p1/map-no-military` | [k] kod bitti; üretimde doğrulandı (2026-10-06, v0.22.1): `/version` 0.22.1, Release 2026-10-06T13:34:14Z; görünüm denetimi kullanıcıda (ACTIVATION v0.22.1) | #37 |
| M6e.13 | Askerî üsler sitenin hiçbir yerinde yok (yama; D-107) | `p1/no-military-site` | [k] kod bitti (v0.22.2); üretim denetimi bekliyor (ACTIVATION v0.22.2) | — |
| M6e.12 | Global konumlandırma (yama; D-106) | `p1/map-global-copy` | [~] kod sürüyor (2026-10-06); 4. halkadan (M6i.2) önce birleşir | — |
| M6h | 3. halka (≤ 2.000 km) — kullanıcı isteğiyle M7a'nın önüne alındı (2026-10-04); sivil uçuşa kapalı olabilecek havalimanı notu | `p1/m6h-ring3` | [k] kod bitti; üretimde doğrulandı (2026-10-04, v0.18.0): `scope=listed` 503 (61 + 75 + 89 + 278), Viyana 3. halka 1.149 km, beş Özbek istasyonunun METAR'ı UZxx koduyla, METAR'lı istasyon 463/503, toplu hava 1,34 MB, URKK ve UUOO notu iki dilde; admin Servisler ve worker günlüğü (429 yok) bekliyor (ACTIVATION) | #28 |
| M7a | Canlı araçlar: `smoke:live`, `record` | `p1/m7a-live-tools` | [k] kod bitti; canlı smoke ve kayıt kullanıcıda (ACTIVATION) | #31 |
| M7b.1 | İz tablolarına ham `seen_pos` ve `baro_rate` (migration 0006, v0.20.0; D-097) | `p1/m7b1-track-columns` | [x] tamam; üretimde doğrulandı (2026-10-05, v0.20.0): `hy-migrate` 0006'yı uyguladıktan sonra servisler açıldı, `/version` 0.20.0, `/ready` 200; v0.20.0 Release 2026-10-05T07:45:13Z. Ingest yazımı üretimde adsb.lol açılınca görülür (ACTIVATION 2. adım) | #33 |
| M7b.2 | Kapsama raporu: worker işi, admin sayfası, CLI (`coverage:report`, v0.21.0; D-098) | `p1/m7b-coverage` | [k] kod bitti; gerçek 24 saatlik rapor üretim ingest'i açıldıktan sonra (ACTIVATION) | — |
| M6i.1 | 4. halkanın ön koşulları ve veri altyapısı (halka 3'te kalır, 503 listelenen): fixture'a 4. halka, 4 karakterli ICAO kuralı, pist kuralları, kaplama kodları, saat dilimleri; toplu havanın ham biçimi, AWC istek sayısı günlükte, uçuş evresi ızgarası, harita penceresinin tembel yüklenmesi — kullanıcı isteğiyle M7c'nin önüne alındı (2026-10-05; D-101) | `p1/m6i1-ring4-prep` | [k] kod bitti; üretimde doğrulandı (2026-10-06, v0.22.0): `/version` 0.22.0, ham toplu hava (`format=raw`) 502 KB, br ile 60 KB (çözülmüş biçim 1,36 MB, br ile 70 KB); v0.22.0 Release 2026-10-06T00:41:12Z; worker günlüğünde AWC `requests` denetimi bekliyor (ACTIVATION) | #36 |
| M6i.2 | 4. halka (≤ 5.000 km, 719 havalimanı, 1.222 listelenen): adlar, halkanın açılması, ülke adı yerleşiminin yeniden üretimi, metinler, e2e (D-102) | `p1/m6i2-ring4` | [ ] | — |
| M6j | 5. halka (dünyanın geri kalanı, ABD dahil); haritada görünür alana göre havalimanı yükleme, AWC toplu dosyası (DUR-SOR) ve adların tembel yüklenmesi burada değerlendirilir (D-101) | `p1/m6j-ring5` | [ ] | — |
| M7c | Kapsama ölçümü yedek yolu (`coverage:probe`) | `p1/m7c-coverage-probe` | [ ] | — |

## M0 — Repo iskeleti ve yerel test ortamı
**Dizinler:**
- kök yapılandırma
- `packages/{shared,i18n,geo,providers}`
- `apps/{web,api}`
- `scripts/`
- `.github/workflows/ci.yml`
- `.claude/launch.json`
- `.env.example`
- `LICENSE`

**Kabul komutları:**
- `pnpm install --frozen-lockfile`
- `pnpm ci:local`
- `pnpm check:eol`
- `pnpm changelog:check`
- `pnpm stats`
- `pnpm backup`
- `pnpm dev` → `http://localhost:3100/durum` API'yi "Çalışıyor" gösterir; `/yenilikler` açılır; TR/EN geçişi çalışır

**Notlar:**
- TypeScript 6.0.x'e sabitlendi (D-021).
- `engine` ve `db` paketleri ilk kullanıldıkları kilometre taşında oluşturulur.

**Çıktı kaydı (2026-09-25):**
- `pnpm install` → 258 paket, pnpm 12.6.0. turbo 2.11.3 ve vitest 5.0.1'e sabitlendi (2.11.4 ve 5.0.2 24 saatten yeni; `minimumReleaseAge` istisnası eklenmedi).
- `pnpm ci:local` → format ✓, EOL ✓, changelog v0.2.0 ✓, scripts typecheck ✓. turbo: 20/20 görev başarılı (lint 6, typecheck 6, test 6 paket / 27 test, build 2).
- `pnpm dev` → web :3100, api :4100. `/durum` 200, API "Çalışıyor", `/version` → `version:"0.2.0"`; `/dil?to=en` → `/yenilikler` İngilizce; konsol hatası yok.
- `pnpm stats` → 90 dosya, 4.828 satır (2.062 kod).

## M1a — Bütün servisler, yönetici oturumu, Servisler paneli
**Çıktı kaydı (2026-09-25):**
- `turbo run lint typecheck test build` → 28/28 görev; birim testleri: api 28, worker 7, web 5, shared 5, i18n 4, geo 7, providers 4.
- `pnpm dev:infra` → PostGIS 18-3.6, Redis 8.10.2 ×2, Mailpit v1.31.2 healthy.
- `pnpm test:integration` → db 2/2 (migration + eşzamanlı advisory lock), api 3/3 (Redis oturum deposu, heartbeat, gerçek /ready + giriş).
- `pnpm compose:guard` → 8 servis, kurallar tamam.
- Yerel üretim compose (imajlar kaynaktan): 7 servis healthy, migrate servisi 0 ile çıktı; PostGIS 3.6.4; PGDATA `/var/lib/postgresql/18/docker`; isimsiz volume yok; web → api iç ağ ✓; iki worker heartbeat'i Redis'te; boşta toplam ~270 MB. İmajlar: web 387 MB, api 341 MB, worker 336 MB.
- Tarayıcı: `/admin` → giriş ekranına yönlendirme ✓; Servisler paneli bütün servisleri gerçek veriyle gösterdi (curl + oturum çereziyle); onay bandı: onaysız script yok, "Kabul et" → script doğru `src` ve `data-site` ile yüklendi, "Reddet" → yüklenmedi; admin sayfalarında bant yok.
- Not: onay akışının otomatik E2E testi Playwright ile M6'da eklenir (bu kilometre taşında elle doğrulandı).

## Marka geçişi — havayolu · havayolu.live (v0.3.1)
**Çıktı kaydı (2026-09-25):**
- Paketler `@havayolu/*`, konteynerler `hy-*`, imajlar `ghcr.io/emindemirciai/havayolu-{web,api,worker}`; Redis anahtar öneki `hy:`, çerezler `hy_admin` / `hy_consent`.
- `www.havayolu.live` → `havayolu.live` kalıcı yönlendirme (308, `proxy.ts`), birim testiyle.
- `pnpm ci:local` → 28/28 görev, 62 birim testi.
- Eski adlı yerel altyapı silindi; `pnpm dev:infra` → `havayolu-dev` 4 servis healthy. `pnpm test:integration` → 5/5. `pnpm compose:guard` → 8 servis ✓.
- DNS kayıtları Hostinger'da girildi; alan adı bugün kaydedildiği için bu makineden henüz çözümlenmiyor (yayılma bekleniyor).
- `pnpm stats` → 149 dosya, 8.400 satır (4.884 kod).

## Birleştirme öncesi inceleme, açık repo ve `main` koruması (v0.3.2)
**Çıktı kaydı (2026-09-25):**
- Çok ajanlı inceleme (CI, güvenlik, backend, web+deploy açıları; her açıya çürütmeye çalışan bir doğrulayıcı): 12 bulgu, 11'i doğrulandı ya da muhtemel, 1'i çürütüldü. Düzeltmeler ve gerekçeler D-060'ta.
- Repo kullanıcı kararıyla herkese açık (D-061). Açmadan önce bütün geçmiş sır ve kişisel veri açısından tarandı; bulgu yok. `main-koruma` kural seti etkin (silme ve force push yasak, yalnızca PR + merge commit, zorunlu `checks`; `test-integration` PR #1 birleşince zorunlu kontrollere eklenir, çünkü M0'ın CI'ında bu iş yoktur); gizli bilgi taraması, push koruması ve bağımlılık uyarıları açık.
- Üretim env şablonu `deploy/dokploy.env.example` (60 anahtar) ve analiz uygulaması şablonu `deploy/analiz.env.example`; `pnpm compose:guard` şablonu da denetler (olumsuz denemede 4 hatanın dördünü de yakaladı).
- `pnpm ci:local` → 28/28 görev; birim testleri: api 37, web 10, worker 7, geo 7, shared 5, i18n 4, providers 4.
- `pnpm dev:infra` (TCP sağlık kontrolüyle) → 4 servis healthy; `pnpm test:integration` → 5/5; `pnpm compose:guard` → 8 servis ✓.
- Yerel üretim compose, boş volume'larla: 7 servis healthy, migrate 0 ile çıktı; `TRUSTED_PROXY_CIDRS` compose varsayılanından geldi; `/health` hız sınırı başlığı taşımıyor, `/ready` taşıyor; `/version` gömülü SHA'yı döndü; sayfa kaynağında iki dilli telif/lisans yorumu, `author`/`copyright` meta ve `rel="license"` var; boşta toplam ~290 MB.
- Tarayıcı (dev): bildirim DOM'da, gizli; hidrasyon uyarısı yok.
- İkinci çok ajanlı inceleme (düzeltme farkı; güvenlik, gerileme, env/belge/lisans): 10 bulgu, hiçbiri çürütülmedi. IPv6 /64 gruplama, `/0` reddi, MIT'e birebir lisans metni, güven sınırı belgesi ve belge tutarsızlıkları düzeltildi. Analiz env adları `ANALYZE_` (D-062), Dokploy şablonunda boş alanlar `#talimat#` (D-063).
- Son durum: `pnpm ci:local` 28/28 (api 39, web 10, shared 7 birim testi); `pnpm test:integration` 5/5; `pnpm compose:guard` ✓.
- `pnpm stats` → 159 dosya, 9.269 satır (5.495 kod).
- Birleştirme (2026-09-25): #1 → `main` (`ac71d28`), #2 (`15d2e64`), #3 (`e258b26`), #4 (`95e126a`), hepsi merge commit ve yeşil CI ile. `--delete-branch` taban dalını silince GitHub #2'yi kapattı; dal aynı commit'ten geri açılıp PR yeniden açıldı. Yığılmış PR'larda sıra: birleştir → sonraki PR'ın tabanını `main` yap → dalı sil. #1 birleştikten sonra `test-integration` da zorunlu kontrollere eklendi.

## M1b — Yayın hattı
**Dizinler ve dosyalar:**
- `.github/workflows/ci.yml` (+ `actionlint`, `deploy`), `deploy.yml`, `rollback.yml`
- `scripts/deploy-dokploy.mts` + stub testleri (`scripts/deploy-dokploy.test.mts`, `scripts/vitest.config.mts`)
- `docs/DEPLOY_DOKPLOY.md`

**Kabul komutları:**
- `pnpm test:scripts` → stub Dokploy + stub `/version` sunucusuna karşı sahte saatle: `freshVolumes` gönderilmez; deployment `error`/`cancelled` → 1; 15 dk eski SHA → 1; `/ready` 503 → 1; başarı → 0
- `actionlint` (CI işi; yerelde Docker ile) yeşil
- `pnpm ci:local`, `pnpm test:integration`, `pnpm compose:guard` yeşil; PR'da CI yeşil
- Kullanıcıya bağlı (ACTIVATION): DEPLOY_DOKPLOY.md kurulumu → bir PR birleşir → deploy işi yeşil → `${WEB_URL}/api/version` yeni `GIT_SHA`; toplam süre ≤ 20 dk

**Çıktı kaydı (2026-09-26):**
- Dış gerçekler kaynağından doğrulandı: Dokploy v0.30.7 API sözleşmesi (research/2026-09-25), action sürümleri ve commit SHA'ları GitHub API'den (checkout v7.0.1, setup-node v7.0.0, pnpm/action-setup v6.1.0, setup-buildx v4.4.1, login v4.6.0, metadata v6.2.0, build-push v7.4.0, paths-filter v4.0.3), actionlint 1.7.12 imaj digest'i Docker Hub'dan.
- `pnpm test:scripts` → 14/14 (başarı; freshVolumes gönderilmez; error, cancelled, kuyrukta 15 dk, eski SHA 15 dk, /ready 503, Dokploy 401 → 1; plan: atla / eksik ayar / https / SHA biçimi).
- Birleştirme öncesi çok ajanlı inceleme (Actions anlamı, deploy script'i, güvenlik, belge/operasyon; her açıya çürütmeye çalışan doğrulayıcı): 12 bulgu, 7'si doğrulandı. Düzeltilenler: belge birleşmesi kod yayınını yutuyordu → `main`'e her push yayın işini çalıştırır, "yayın gerekmedi" kararı canlı sürüme göre; rehberdeki ufw-docker adımı Traefik'i (VPS'teki bütün siteleri) kapatırdı → `ufw route allow` + sabitlenmiş, SHA-256'lı indirme; Dokploy'un geçici hataları artık yayını düşürmez; uç kontrolü `pipefail` ile; Postgres volume kurtarma adımları. Çürütülen 3'ü de ucuz sertleştirme olarak eklendi (rollback imaj ön kontrolü, anahtar biçimi, alan adı notu).
- Son durum: `pnpm test:scripts` → 23/23; `actionlint` temiz.
- `actionlint` (Docker, digest'li imaj) → temiz.
- `pnpm ci:local` → 28/28; `pnpm compose:guard` ✓.
- Yerel altyapı portları D-065 ile 41xxx–49xxx aralığına taşındı (Windows açılışta 56336–56435'i ayırmıştı); `pnpm dev:infra` → 4 servis healthy; `pnpm test:integration` → 5/5.
- `pnpm dev` → `/durum` v0.4.0, yol haritasında M1b "Sürüyor"; API `/ready` 200, worker sağlıklı.
- `pnpm stats` → 165 dosya, 10.615 satır (6.280 kod).

**Tasarım notu (D-064):** imajlar matris işinde yalnızca `sha-<7>` etiketiyle gönderilir. `:main` etiketi ancak seri çalışan `release` işinde, commit hâlâ `main`'in ucundaysa `docker buildx imagetools create` ile taşınır. Böylece eski bir derleme yenisinin üstüne yazılamaz; rollback da aynı yöntemi kullanır.

**Üretimde ilk gün (2026-09-27, v0.5.0–v0.5.2):**
- Site Dokploy'dan elle yayına alındı (v0.4.0). Paketler gizli yapıldı, Dokploy'a süresiz `read:packages` PAT'li Registry eklendi (D-068).
- #8 (v0.5.1): 32 karakterden kısa `ADMIN_SETUP_TOKEN` API'yi her açılışta düşürüyordu; alt sınır 12, hatalı yönetici ayarı artık yalnızca girişi kapatıyor (D-069).
- #9 (v0.5.2): Autodeploy `main`'i izlerken imajlardan önce tetikleniyor ve eski sürümü yayınlıyordu. Dokploy artık `release` dalını izliyor; CI imajları hazırlayınca dala yayın commit'i gönderiyor (D-070).
- **M1b kabulü:** #9 08:16:21 UTC'de birleşti; CI 4,7 dk sonra (08:21:05) `release` dalına yayın commit'ini gönderdi. Bu ilk denemede Dokploy tetiklenmedi: kullanıcı ~08:05'te panel adresini değiştirmişti, GitHub App'in bildirim adresi eski adreste kaldı ve teslimatlar Traefik'ten 404 aldı. Yayını kullanıcı elle yaptı; CI'daki doğrulama geçti. Bildirim adresi `https://dokploy.havayolu.live/api/deploy/github` yapıldıktan sonra 08:44:30'da `release`'e gönderilen test commit'i (`ca339ab`, ağacı canlıyla aynı) Dokploy yayınını başlattı; teslimat 200 (kullanıcı doğruladı). Tam otomatik ölçüm (#10, v0.6.0): 09:19:42 UTC birleşme → 09:23:53 `release` dalına yayın commit'i → 09:24:25 `api.havayolu.live/version` ve `havayolu.live/api/version` yeni SHA, `/ready` 200. **Birleşmeden canlıya 4 dk 43 sn**, elle müdahale yok (hedef ≤ 20 dk).
- Dokploy paneli `https://dokploy.havayolu.live` (Let's Encrypt). `http://72.62.53.122:3000` hâlâ açık; kapatmak kullanıcı adımı (ACTIVATION).

## M2 — Veritabanı ve referans verisi
**Dizinler ve dosyalar:**
- `packages/db`: `src/schema.ts`, `drizzle/0001_reference_and_tracks.sql` (iz tabloları elle `PARTITION BY RANGE ("ts")`), `drizzle/0002_track_default_partitions.sql` (özel migration), `src/partitions.ts`, `src/reference.ts`, `src/seed.ts`, `src/cli/migrate.ts` (migration sonrası partition + tohum)
- `packages/providers/src/reference/` (CSV, OurAirports, VRS), `packages/geo` (`runwayThreshold`)
- `apps/worker/src/jobs/` (`jobs` rolü: BullMQ zamanlayıcıları, referans içe aktarımı, partition bakımı)
- admin Servisler paneli: "Referans verisi" ve "İz tabloları" satırları
- `tools/fixtures/` (+ README), `scripts/make-reference-fixtures.mts`, `scripts/check-migrations.mts`, `scripts/test-migration-upgrade.mts`

**Kabul komutları:**
- `pnpm db:check` → `drizzle-kit check` + `drizzle-kit generate` boş fark (CI `checks`)
- `pnpm test:integration` → db: temiz DB'de 3 migration; partition işi sahte saatle (süresi dolanı siler, 7 gün ileriyi açar, kilit alınamazsa yeniden dener); seed iki kez → yinelenme yok; referans yazımı idempotent. worker: BullMQ zamanlayıcıları, ilk içe aktarım, partition işi, fixture içe aktarımı
- `pnpm test:migration-upgrade` → `origin/main` migration'ları + dalınkiler (CI `test-integration`)
- `pnpm --filter @havayolu/providers test` → LTFM ve diğer tohum istasyonlarının her pisti için eşikler arası mesafe (±50 m), eşikten eşiğe yön (±1°; D-066 sapması), kaydırılmış eşik (±1 m)
- `pnpm ci:local`, `pnpm compose:guard`, `actionlint`; PR'da CI yeşil

**Notlar:**
- LTFM'de 16L/16R/17L/17R için OurAirports heading alanı ~5° yanlış; yön uç koordinatlarından hesaplanır ve tutarsızlık işaretlenir (D-066).
- Tam OurAirports verisiyle ölçüm: 6.347 havalimanı ve 7.977 pist tutulur (79.787 havalimanı ve 40.301 pist filtre dışı, 0 hatalı satır); heap zirvesi ~58 MB.

**Çıktı kaydı (2026-09-27):**
- Fixture'lar kullanıcı onayıyla bir kez indirildi (OurAirports, VRS; `tools/fixtures/README.md`).
- `pnpm --filter @havayolu/providers test` → 50/50: 5 tohum istasyonunun iki ucu koordinatlı bütün pistlerinde (LTFM 6 pist) eşikler arası mesafe ±50 m, yön ±1°, kaydırılmış eşik ±1 m; LTFM'de heading alanı tutarsız pistler tam olarak 16L/16R/17L/17R; LTAC 03L uçları zaten eşik.
- `pnpm db:check` → boş fark; kasıtlı bir sütun yeniden adlandırması kırmızıya döndü.
- `pnpm test:integration` → db 14/14 (3 migration; partition işi sahte saatle; DEFAULT'taki satır taşınır, süresi dolan silinir; kilit yeniden denemesi; seed; referans yazımı idempotent, kod takası, yarım kaynak reddi), api 3/3, worker 5/5 (BullMQ zamanlayıcıları, açılış telafisi, yeniden başlatmada zamanlayıcıya dokunulmaması, fixture içe aktarımı, hata kaydı).
- `pnpm test:migration-upgrade` → 1 → 3 migration.
- `pnpm ci:local` → 28/28 görev; `pnpm compose:guard` ✓; `actionlint` temiz.
- `pnpm dev`: worker ilk açılışta fixture'dan 76 havalimanı, 115 pist, 5.964 havayolu yükledi; admin Servisler'de "Referans verisi" ve "İz tabloları" Çalışıyor (7 gün ileri, DEFAULT 0).
- Birleştirme öncesi çok ajanlı inceleme (5 açı + çürütmeye çalışan doğrulayıcılar): 18 bulgu, hiçbiri çürütülmedi, hepsi düzeltildi (D-066).
- Yerel üretim compose (imajlar kaynaktan): 7 servis healthy; `hy-migrate` 3 migration + 18 partition + 5 istasyon; worker-bg ~90 MB; dış istek kapalı olduğu için referans içe aktarımı beklendiği gibi atlandı; `/ready` hazır.
- GitHub Releases (kullanıcı talebi, D-067): CI'da `github-release` işi; v0.1.0–v0.4.0 geçmiş birleşme commit'lerine eklendi.
- `pnpm stats` → 185 dosya, 14.716 satır (10.032 kod). Fixture CSV'leri ve drizzle snapshot'ları artık sayılmaz (elle yazılmayan veri).

## M3 — Sağlayıcılar
**Dizinler ve dosyalar:**
- `packages/providers/src/aircraft.ts` (`AircraftState`, `dbFlags`, gizlilik yardımcıları)
- `packages/providers/src/live/`: `response.ts` (ayrıştırıcı ve temizlik), `adsblol.ts` (istemci, `providerUserAgent`, `chunkHexes`), `local-receiver.ts`
- `packages/providers/src/schedule.ts` (`ScheduleProvider`, yalnızca tip)
- `tools/fixtures/adsblol/`, `scripts/record-adsblol-fixtures.mts` (v0.19.0'da kaldırıldı; yeni kayıt `pnpm record`, M7a)

**Kabul komutları:**
- `pnpm --filter @havayolu/providers test` → yanıt biçimi kuralları (yerde irtifa, eksik alanlar, `lastPosition`, `now` ms/sn, boş `flight`, `~` hex, `dbFlags` bitleri), hata türleri (403 yapılandırma, 429 HTML ve 420 kısıtlama, 5xx, ağ), stub HTTP sunucusuna karşı istemciler (gzip, User-Agent, API anahtarı başlığı, yerel alıcı token'ı ve sağlık metriği)
- `pnpm ci:local`; PR'da CI yeşil

**Çıktı kaydı (2026-09-27):**
- Fixture: kullanıcı onayıyla adsb.lol'e 4 istek (aralarında 12 sn): LTFM 40 NM çevresi 18 uçak, 3 hex, 1 çağrı kodu, 1 tescil; hepsi 200. İletişim adresi yalnızca ortam değişkenindeydi.
- `pnpm --filter @havayolu/providers test` → 80/80 (yeni 30: ayrıştırıcı 17, istemciler 13). Birleştirme öncesi inceleme: 23 bulgu, 2 çürütüldü, düzeltmeler D-071.
- Kapsama gözlemi (D-071): yoğun saatte LTFM çevresinde 18 uçak, yerde hiç yok; M7 kapsama raporunda ölçülecek.
- `pnpm stats` → 194 dosya, 16.836 satır (11.988 kod); fixture JSON dosyaları da artık sayılmaz.

## M4 — Ingest, replay ve senaryo araçları
Spec boşlukları için alınan kararlar D-073'tedir; metrik birim kararı D-072'dir.

**Dizinler ve dosyalar:**
- **`packages/db`:**
  - `drizzle/0003_*`: `provider_health`'e sütunlar; `provider_health_hourly` ve `provider_status_changes` tabloları
  - `src/ingest.ts`: istasyon + ARP sorgusu, uçuş kaydı ve iz yazma, sağlayıcı sağlığı
  - `src/live.ts`: `redis-live` anahtarları (`hy:ac:*`) ve yazıcılar
- **`packages/geo`:** kt ↔ km/sa, ft/dk → m/dk, `distanceNm`, çember içerme
- **`packages/i18n/src/units.ts`:** metrik varsayılanlı birim ve sefer no biçimleyiciler (D-072)
- **`packages/providers/src/track-source.ts`:** `track_points.source` smallint kodu
- **`apps/worker/src/ingest/`:**
  - `rate.ts` (AIMD kova, geri çekilme, devre kesici)
  - `status.ts` (sağlayıcı durumu, tazelik p95)
  - `plan.ts` (kapsama planı ve istek zamanlayıcı; plan M6b'den beri `packages/geo/src/coverage.ts`'tedir, D-076)
  - `merge.ts`, `flights.ts`, `tracks.ts`
  - `writer.ts`, `index.ts` (döngüler, kapanış)
- **`tools/`:** artık `@havayolu/tools` workspace paketi; imaja girmez
  - `src/scenarios/`: deterministik sentetik seyir uçakları
  - `src/replay-receiver/`: `aircraft.json` sunar
- **`scripts/dev-replay.mts`**, kök `pnpm dev:replay`
- **Admin Servisler paneli:** "Canlı veri · adsb.lol" ve "Canlı veri · yerel alıcı" satırları (API `services.ts`, web `/admin`, i18n)

**Kabul komutları:**
- `pnpm --filter @havayolu/worker test` → sahte saatle:
  - 429 (Retry-After yok) → hız ≤ %50, bekleme; 10 dk temiz → kademeli toparlanma
  - 403 → devre açık, yeniden deneme yok
  - 5 tohum istasyonun P0'ı tek batı çemberinde, Doğu çemberi her planda
  - 0,1 rps benzetiminde birincil p95 ≤ 20 sn, takip listesi ≤ 30 sn
  - örnekleme (30 sn, ince iz kuralı, yerde 20 m) ve uçuş kaydı ayrıştırma
- `pnpm --filter @havayolu/tools test` → senaryo deterministik; replay yanıtı ayrıştırıcıdan geçer; üretimde başlamaz
- `pnpm test:integration` (önce `pnpm dev:infra`):
  - Redis canlı durum: GEO süpürme, stream sınırı
  - iz yazıcı ve uçuş kaydı (gerçek PostgreSQL)
  - sağlık tabloları
- `pnpm dev:replay` → replay alıcısı (4300) ve worker ingest; `redis-live`'da `hy:ac:*` anahtarları oluşur, `track_points_*` dolar
- `pnpm ci:local` ve `pnpm ci:full` yeşil; PR'da CI yeşil

**Notlar:**
- **Ağ:** Canlı adsb.lol isteği yalnızca üretimde (`EXTERNAL_PROVIDERS_DISABLED=false`) atılır. Yerelde ve CI'da veri replay alıcısından gelir.
- **Yayın öncesi:** CONTACT_EMAIL ve info@adsb.lol bildirimi ACTIVATION'dadır; ikisi tamamlanmadan üretimde adsb.lol çekimi başlamaz.

**Çıktı kaydı (2026-09-28):**
- **Yöntem:** Kod tabanı ve spec'ler 6 paralel okuyucuyla haritalandı. Arayüz sözleşmesi yazıldı; 6 paralel ajan ayrışık dosyalarda uyguladı, ardından tek ajan worker'a bağladı.
- **İnceleme:** 6 açıdan inceleme (spec, çalışma zamanı, veri, güvenlik, testler, araçlar ve belgeler) ve bulgu başına 3 çürütücü doğrulayıcı. 20 bulgu, 18 tekil, 11 doğrulandı (4 orta, 7 düşük), hepsi düzeltildi. Bağımsız denetimde çıkan 2 yeni kusur da düzeltildi (takip son tarihinin donması, bozuk hex'in kayıt açmayı kilitlemesi). Ayrıntı D-073'tedir.
- **Zamanlayıcı benzetimi** (0,1 istek/sn, 30 dk, tohum istasyonlar):
  - Takip listesi yokken: birincil p95 16 sn, istasyonlar ≤ 30 sn, Doğu ≤ 90 sn.
  - Takip uçağı kapsama içindeyken `/v2/hex` 0 (düzeltmeden önce isteklerin %27'siydi).
  - Kapsamaya girip çıkan ve susan uçakta birincil p95 ≤ 20 sn.
- `pnpm ci:full` → yeşil:
  - Birim testleri: worker 182, providers 88, tools 74, api 57, scripts 31, i18n 28, geo 20, web 10, shared 7, db 6 (toplam 503).
  - Entegrasyon testleri: db 40, worker 11, api 3 (toplam 54).
  - `compose:guard` yeşil; migration yükseltmesi 3 → 4.
- **`pnpm dev:replay` (yerel):**
  - `redis-live`: 10 sentetik uçak, 320 stream girdisi, hash TTL 120 sn.
  - DB: 10 aktif uçuş kaydı, 20 örneklenmiş ve 43 tam çözünürlüklü iz noktası.
  - `provider_health`'te `localReceiver` `ok`, 60 sn'de 60 istek.
- `pnpm stats` → 241 dosya, 29.228 satır (24.060 kod).
- **Kullanıcıya bağlı (`[k]`):** üretimde adsb.lol çekimi, admin "Canlı veri · adsb.lol" satırının "Çalışıyor" olması.

## Düzeltme — Durum sayfasında taşma (v0.7.1)
- **Belirti:** Üretimde /durum'daki "Derleme" ve "Sunucu sürümü" kutularında 40 haneli commit kimliği yandaki kutunun üstüne taşıyordu. Yerelde değer `dev` olduğu için görünmüyordu.
- **Neden:** `.facts` ızgarası kutuları 200 px'e kadar daraltıyor, ama boşluksuz kimlik ~400 px tutuyordu. Kırılma noktası olmayan metin kutudan dışarı taşıyordu.
- **Düzeltme:**
  - Kimliğin kısa hâli (`shortSha`, 7 hane) gösterilir, tamamı `title`'dadır. Admin'deki worker commit satırı da aynı yolla kısaltıldı.
  - `.facts` kutuları `min-width: 0`, değerler `overflow-wrap: anywhere` aldı; uzun metin kutu içinde kırılır.
- **Doğrulama:** Önizlemede 40 haneli kimlik 199 px'lik kutuda taşmadan 3 satıra kırıldı. 375 px mobil genişlikte sayfada yatay taşma yok.

## M5 — Canlı API
Spec boşlukları için alınan kararlar D-074'tedir.

**Dizinler ve dosyalar:**
- **`apps/api/src/live/`:**
  - `types.ts` (`PublicAircraft`, `LiveSource`)
  - `record.ts` (gizlilik, sefer no), `bbox.ts` (kutu, kapsama), `search.ts`
  - `cache.ts` (`redis-live` yoklaması, fark, `seq`), `routes.ts` (`/v1/live`, `/v1/search`)
  - `ws.ts` (`/v1/ws`)
- **`apps/api/src/admin/blocklist.ts`:** `/v1/admin/blocklist`
- **`packages/db/src/`:** `live.ts` (okuyucular, kapsama), `blocklist.ts`, `airlines.ts` (ICAO↔IATA)
- **`apps/worker/src/ingest/index.ts`:** kapsama çemberlerini `redis-live`'a yazar

**Kabul komutları:**
- `pnpm --filter @havayolu/api test`:
  - gizlilik: askeri ve bilinmeyen bayrak yok, PIA/LADD tescili yok
  - kutu ve kapsama; arama (hex, tescil, sefer no, çağrı kodu)
  - önbellek farkı ve `seq`; farklı `X-Forwarded-For` ayrı sayaç, güvenilmeyen XFF yok sayılır
  - WS birim: ortak hücre Buffer'ı, geri basınç, ping/pong, sınırlar, `Origin`
- `pnpm test:integration` (önce `pnpm dev:infra`):
  - `/v1/live` ve `/v1/search` gerçek `redis-live` ile; askeri uçak görünmez
  - WS: tam görüntü → fark, `lastSeq` ile devam, yeniden bağlanma mesajı ve 1012, IP sınırı
- `pnpm dev:replay` → `http://localhost:4100/v1/live?bbox=25,35,45,43` sentetik uçakları döner
- `pnpm ci:full` yeşil
- **Kullanıcıya bağlı (`[k]`):** `wss://api.havayolu.live/v1/ws` üzerinden 5 dk boşta bağlantı kopmaz. **2026-09-29 doğrulandı:** üretimde (v0.8.0) bağlantı 5 dk 30 sn boşta açık kaldı.

**Çıktı kaydı (2026-09-29):**
- **Yöntem:** Arayüz sözleşmesi (`types.ts`) önce yazıldı. Paralel ajanlar ayrışık dosyalarda uyguladı, tek ajan API ve worker'a bağladı.
- **İnceleme:** Çok açılı inceleme ve bulgu başına çürütücü doğrulayıcılar. 7 bulgu doğrulandı (6 orta, 1 düşük), hepsi düzeltildi:
  - WS tamponları için merkez geneli 64 MiB bütçe
  - engel listesi okunana kadar kapalı başlama
  - redis-live okunamazken sağlayıcının `down` görünmesi
  - `lastSeq` devam farkında güncel durum
  - abonelik hız sınırı
  - büyük kutuda `none` yerine tam çember–dikdörtgen kesişimi
  - worker 180 sn'den uzun durunca sağlayıcının yanıttan düşmemesi

  Bağımsız denetim iki düzeltmeyi yarım buldu, ikisi de tamamlandı. Tampon sınırında `close()` yerine `terminate()` kullanılıyor, çünkü `close()` tamponu 30 sn tutuyordu. Worker yapılandırdığı sağlayıcıları `hy:ingest:providers`'a yazıyor; böylece worker çökükken açılan API de sağlayıcıyı `down` gösteriyor. Ayrıntı D-074'tedir.
- **`pnpm ci:full` → yeşil:**
  - Birim testleri: worker 184, api 172, providers 88, tools 74, scripts 31, i18n 28, geo 20, db 19, web 10, shared 9 (toplam 635).
  - Entegrasyon testleri: db 58, api 15, worker 11 (toplam 84).
  - `compose:guard` yeşil; migration yükseltmesi 4 → 4 (M5'te migration yok).
- **`pnpm dev:replay` (yerel):**
  - `/v1/live?bbox=25,35,45,43` → 10 sentetik uçak; kapsama `partial`; `localReceiver` `ok`; en yeni örnek 1–2 sn.
  - `bbox=0,0,5,5` → `none`, 0 uçak; `bbox=bad` → 400; `/v1/search?q=HYS001` → çağrı kodu eşleşmesi.
  - `/v1/ws`: tam görüntü (10 uçak), ardından saniyede bir fark (4 hücre, 10 güncelleme).
- `pnpm stats` → 270 dosya, 36.182 satır (30.861 kod).

## M6 — Web canlı harita
Spec boşlukları için alınan kararlar D-075'tedir. Uydu altlığı kullanıcının seçimiyle Esri World Imagery'dir: ArcGIS Location Platform ücretsiz katmanı, anahtar ACTIVATION'da.

**Dizinler ve dosyalar:**
- **`packages/shared/src/`:**
  - `live.ts`: API ile istemcinin ortak tipleri (`PublicAircraft`, WebSocket mesajları, arama ve havalimanı yanıtları)
  - `map/`: harita renkleri, uçak kategorisi ve ikon kimlikleri, uçak/havalimanı/iz katman stilleri (mobille ortak), özgün siluetler (`silhouettes.ts`)
- **`packages/db/src/airports.ts`:** IATA kodlu havalimanları
- **`apps/api`:** `GET /v1/airports?country=TR` (10 dk bellek önbelleği)
- **`apps/web/src/lib/`:**
  - `env.ts` (harita env'leri), `map-config.ts` (altlık zinciri)
  - `live/`: `store`, `clock` (geri gitmeyen saat, sunucu saati tahmini), `interpolate`, `connection`, `subscription` (hücreye yuvarlanan abonelik), `api`, `visible`
  - `map/`: `label-text`, `label-layout`, `label-settings`, `url-state`, `shared-link` (`/?hex=` çözümü)
- **`apps/web/src/components/map/`:** `live-map.tsx`, harita görünümü ve denetleyicisi, `maplibre-loader.ts` (MapLibre'nin tembel yüklenmesi), `camera.ts`, ikonlar, `data-attribution.tsx`, `use-live.ts`; `panels/` (arama, bilgi kartı, tablo, durum şeridi, etiket ayarı)
- **`apps/web/src/app/page.tsx`:** kök `/` haritayı gösterir; menüde "Harita" ilk sıradadır
- **Geçici kullanım koşulları (kullanıcı kararı 2026-09-29, D-075):** `apps/web/src/app/kullanim-kosullari/page.tsx`, `components/terms-content.tsx`, `components/rich-text.tsx` (i18n metnine bağlantı yerleştirme), `lib/terms.ts` (yol, yürürlük tarihi, belge adresleri). Esri sözleşmesinin (E204 §3.1c.5) istediği Esri şartlarına uyma maddesi ve ODbL maddesi buradadır. Bağlantı site alt bilgisinde ve harita atıf satırındadır ("Koşullar")
- **`packages/i18n`:** `map` ve `terms` bölümleri (TR/EN)
- **`apps/web/public/test-style.json`:** yerel test stili (glif, sprite ve uzak adres yok)
- **`e2e/`:** Playwright yapılandırması ve testleri; kökte `pnpm test:e2e`, `typecheck:e2e`, `lint:e2e`
- **CI:** `e2e` işi; `deploy` onu da bekler
- **Belgeler:** D-075, data-sources.md §6a, `ATTRIBUTION.md`, ACTIVATION (Esri anahtarı; geçici kullanım koşullarının hukukçu incelemesi Parça 3 satırında)

**Kabul komutları:**
- `pnpm --filter @havayolu/web test`:
  - altlık zinciri (yerel, uydu, vektör; anahtar adrese kodlanarak yazılır)
  - uçak deposu (tam görüntü, fark, budama, iz en çok 600 nokta; örnek yaşı sunucu saatinden, eski örnek yok sayılır), ara değerleme (örnekten en çok 10 sn ileri), ekranda 0,5 px altı kaymada yükleme yok
  - bağlantı: yeniden bağlanma gecikmesi, `lastSeq`, `reconnect` mesajı, `refresh` (sahte WebSocket); abonelik planı ("Uçağı ortala" hücre içinde yeniden abone olmaz); 30 sn sessizlikte yenileme
  - etiket metni (sefer no → çağrı kodu → tescil → hex), etiket yerleşimi (500 etiket < 8 ms; yalnızca seçili etiket zorla yerleşir), havalimanı kodları uçak simgesini ve seçili izi örtmez, etiket ayarı, `?hex=` ayrıştırma ve paylaşılan bağlantı akışı
  - veri yaşı (sağlayıcı sağlıklıyken sakin bölgede artmaz), harita yokken atıf, MapLibre yükleyicisi (ortak modül bir kez)
  - atıf satırı: canlı veri atfı ve "Koşullar" bağlantısı tek girdi; harita yokken aynı metin
  - kullanım koşulları (TR ve EN): Esri maddesi, E204 ve E300 bağlantıları, ODbL maddesi, yürürlük tarihi, doldurulmamış yer tutucu yok
- `pnpm --filter @havayolu/i18n test` → TR ve EN anahtarları ve yer tutucuları aynı (`terms` dahil)
- `pnpm --filter @havayolu/shared test` → uçak kategorisi tablosu
- `pnpm --filter @havayolu/api test` → `/v1/airports` (önbellek, 400, 503, başlıklar)
- `pnpm test:integration` (önce `pnpm dev:infra`) → fixture'daki 61 IATA kodlu Türkiye havalimanı
- `pnpm test:e2e` (önce `pnpm dev:infra` ve `pnpm db:migrate`; `pnpm dev` kapalı):
  - `/api/version` → `app: havayolu`; replay uçağı API'de görünene kadar beklenir
  - harita açılır, ADSB.lol (ODbL) atfı ve veri yaşı görünür
  - replay uçağı `HYS001` tabloda görünür ve konumu 6 sn içinde değişir
  - satıra tıklayınca bilgi kartı açılır, adres `?hex=ff0001` olur; kart kapanınca `hex` silinir; satır klavyeyle de seçilir
  - arama `HYS001`'i bulur; bulunamayan sefer için spec'teki metin çıkar
  - `/?hex=ff0001` ile doğrudan açılış aynı uçağı seçer; canlı olmayan hex'te arama alanında "bulunamadı" metni çıkar
  - "Diğer uçaklar: Gizle" yeniden yüklemede korunur
  - 375 px genişlikte yatay kayma yok
  - analiz onay bandı (M1a'dan): onaysız script yok, "Kabul et" yükler, "Reddet" yüklemez, tercih alt bilgiden ve harita sayfasında harita denetimlerinden değişir, admin'de bant yok
  - `/kullanim-kosullari` 200 döner ve Esri maddesini içerir (E204 bağlantısı, ODbL); haritanın atıf satırındaki "Koşullar" bağlantısı sayfayı açar; site alt bilgisinde "Kullanım koşulları" bağlantısı var
- `pnpm ci:full` yeşil; PR'da CI (`e2e` dahil) yeşil
- **Kullanıcıya bağlı (`[k]`):** Esri anahtarı girilince https://havayolu.live haritası uydu görüntüsü ve "Powered by Esri" atfı gösterir; atıf satırındaki "Koşullar" bağlantısı https://havayolu.live/kullanim-kosullari'yi açar (ACTIVATION). Geçici kullanım koşullarının hukukçu incelemesi Parça 3 ACTIVATION satırındadır. 2026-09-30 doğrulandı: üretimde (v0.9.0) uydu görüntüsü, 'Powered by Esri' atfı ve 'Koşullar' bağlantısı görünüyor; karolar 200.

**Çıktı kaydı (2026-09-29):**
- **Yöntem:** Arayüz sözleşmesi yazıldı; 5 paralel ajan ayrışık dosyalarda uyguladı (paylaşılan tipler ve `/v1/airports`, web mantık modülleri, MapLibre çizimi, paneller ve i18n, E2E/CI/belgeler), tek ajan birleştirdi.
- **İnceleme:** 6 açıdan inceleme (spec ve tasarım, çalışma zamanı, güvenlik/gizlilik/lisans, erişilebilirlik ve mobil, test/CI/belgeler, performans) ve bulgu başına 3 çürütücü doğrulayıcı. 35 bulgudan 23'ü çoğunlukla doğrulandı (tekilleştirilince 18 sorun), hepsi düzeltildi. Başlıcaları:
  - harita başlatılamadığında da görünen ADSB.lol atfı
  - havalimanı kutucuklarının uçakları örtmemesi
  - örnek yaşına göre "son görülme"
  - "Uçağı ortala"da seyrek abonelik
  - yarım pikselin altındaki hareketlerde veri yüklememe
  - altlık yüklenirken de çizilen uçaklar
  - uydu → koyu vektör → yedek → düz arka plan zinciri
  - haritada analiz tercihleri düğmesi
  - MapLibre'nin sayfa paketinden ayrılması

  Bağımsız denetim 23 bulgunun hepsini düzeltilmiş buldu; 10 kasıtlı hata denemesinin hepsi testlerce yakalandı. Denetimin küçük notları da düzeltildi (karo kuralı yalnızca Esri karolarına uygulanır, MLAT ibaresi, test anahtarı).
- **Kullanım koşulları:** Esri E204 §3.1c.5 gereği `/kullanim-kosullari` (geçici metin, TR/EN) eklendi; kullanıcı kararı 2026-09-29.
- **`pnpm ci:full` → yeşil** (önbelleksiz turbo çalıştırması dahil):
  - Birim testleri: web 245, worker 184, api 182, providers 89, tools 74, shared 34, i18n 31, scripts 31, db 26, geo 20.
  - Entegrasyon testleri: db 61, api 16, worker 11.
  - E2E: 17/17 (kurulum 1, onay 4, canlı harita 9, koşullar 3).
  - `compose:guard` yeşil; migration yükseltmesi 4 → 4 (M6'da migration yok).
- `pnpm stats` → 361 dosya, 49.569 satır (43.835 kod).

## M6b — Havalimanı sayfaları ve keşfedilebilirlik (SEO, GEO)
Onay: 2026-09-29 (kullanıcı isteği: SEO/GEO, kararlar sohbette)

Kararlar ve gerekçeler D-076'dadır. Kilometre taşı Parça 1'e sonradan eklendi. Parça 3 M2'nin dil yönlendirmesi buraya taşındı (`docs/prompts/parca-3.md`).

**Kapsam:**
- Dil adreste: Türkçe `/`, İngilizce `/en/...`; her genel sayfanın `/en` ikizi var. Dil çerezi emekliye ayrıldı; eski `/dil` bağlantıları önekli adrese 308 ile gider.
- Yeni genel sayfalar: `/havalimanlari` (61 havalimanı), `/istasyon/<ICAO>` (veritabanındaki gerçek veri), `/hakkinda` (veri kaynakları ve yöntem).
- Canonical ve hreflang (`x-default` İngilizce), robots.txt, site haritası, manifest, ikonlar, paylaşım (OG) görselleri, JSON-LD, `/llms.txt`, arama motoru doğrulama env'leri.
- Havalimanı ayrıntı API'si: `include=runways` ve `GET /v1/airports/:code`.
- Kapsam dışı: METAR/TAF (Parça 2 M2'den M6c'ye öne alındı, D-078), istasyon operasyon panosu (Parça 3 M4), uçuş sayfası (Parça 3 M3b), service worker (Parça 3 M5), IndexNow (ayrı PR, kullanıcı onayıyla).

**Dizinler ve dosyalar:**
- **`packages/shared/src/`:** havalimanı ayrıntı tipleri (`AirportDetail`, `RunwayDetail`); `reference/`: `tr-provinces.ts` (ISO 3166-2:TR), `airport-names.ts` (resmî adlar; kaynak DHMİ, işletmeci ya da OurAirports), `runway-surface.ts`
- **`packages/db/src/airports.ts`:** pistler, pist düzeltmeleri (alan alan `COALESCE`), istasyon bilgisi, `dataUpdatedAt`
- **`apps/api/src/`:** `reference/airports.ts` (`include=runways`, `GET /v1/airports/:code`); `app.ts` (`GET /robots.txt` → `Disallow: /`, her yanıtta `X-Robots-Tag: noindex`)
- **`apps/web/src/lib/`:**
  - dil: `locale-routing.ts`, `locale.ts`, `safe-path.ts`, `admin-host.ts`
  - `env.ts` (`WEB_HOST` üretimde zorunlu; üç doğrulama env'i), `airports.ts` (tek toplu istek, 1 saat önbellek)
  - `seo/`: `metadata.ts` (`pageMetadata`, `siteUrl`), `structured-data.ts`, `robots.ts`, `sitemap.ts`, `llms.ts`, OG yardımcıları ve yazı tipleri
- **`apps/web/src/proxy.ts`:** `/en/*` yeniden yazma, `/tr/*` → 308, dil ve yol başlıkları, `X-Robots-Tag`
- **`apps/web/src/app/`:**
  - sayfalar: `havalimanlari/page.tsx`, `istasyon/[icao]/page.tsx` + `opengraph-image.tsx`, `hakkinda/page.tsx`; mevcut sayfalarda `pageMetadata` ve JSON-LD; `admin/layout.tsx` (noindex, nofollow); `dil/route.ts` (308)
  - kök dosyalar: `robots.ts`, `sitemap.ts`, `manifest.ts`, `icon.tsx`, `apple-icon.tsx`, `favicon.ico`, `og/site/route.ts`, `llms.txt/route.ts`
  - `apps/web/public/robots.txt` silindi
- **`apps/web/src/components/`:** `language-toggle.tsx` (düz `<a hreflang lang>`), `json-ld.tsx`, `airports/`, `about/`; `map/` (`?havalimani=<ICAO>`, `/en` önekini koruyan `?hex=`)
- **`apps/web/`:** `next.config.ts` (`htmlLimitedBots: /.*/`, `outputFileTracingIncludes`), `assets/og-fonts/` (Overpass latin ve latin-ext `.woff`, OFL-1.1)
- **`scripts/gen-favicon.mts`:** `favicon.ico` üretimi (yeni bağımlılık yok)
- **`packages/i18n`:** `nav`, `seo`, `airports`, `airport`, `surface`, `about` (TR/EN)
- **`e2e/`:** `tests/seo.spec.ts`, `tests/airports.spec.ts`, `tests/language.spec.ts`, `html.ts` (ham HTML, robots, site haritası ayrıştırıcıları); kurulum API'de 61 havalimanını bekler ve yeni sayfaları derletir
- **Belgeler:** D-076; CLAUDE.md URL şeması; `docs/prompts/parca-3.md` M2 notu; ACTIVATION (Search Console, Bing Webmaster, Yandex Webmaster); REFERENCES; ATTRIBUTION (Overpass, paylaşım görselleri); `.env.example` ve `deploy/dokploy.env.example` (üç doğrulama env'i); `.claude/rules/web-ui.md`

**Kabul komutları:**
- `pnpm --filter @havayolu/shared test`:
  - 81 il kodunun hepsi; fixture'daki her `iso_region` çözülür
  - fixture'daki 61 havalimanının her biri için ad kaydı ya da açık OurAirports yedeği
  - fixture'daki her pist kaplaması eşlenir
- `pnpm --filter @havayolu/api test`:
  - `GET /v1/airports/:code`: 400, 404, IATA ile arama, başlıklar, pist düzeltmeleri uygulanır, pistler sıralı
  - `include=runways`
  - API `GET /robots.txt` ve her yanıtta `X-Robots-Tag`
- `pnpm test:integration` (önce `pnpm dev:infra`) → 61 havalimanı, 51'i indekslenebilir; LTFM 6 pist; her havalimanında en az bir pist; LTFM yönleri uç koordinatlarından
- `pnpm --filter @havayolu/web test`:
  - dil: `localeRouting`'in her dalı (`/en`, `/en/x`, `/english`, `/tr/x`, `/en/admin`, `/en/robots.txt`), `localePath`, `alternatesFor` (kendisi, tr, en, x-default); admin host'unda `/robots.txt` geçer; dil anahtarı (`?hex=` korunur, `/en` ↔ `/`); `safe-path` `/en` yolları
  - env: doğrulama env'leri, üretimde `WEB_HOST` zorunlu
  - SEO: `pageMetadata`; her fixture havalimanının başlığı ve açıklaması (açıklama 70–170 karakter; "rötar", "gecikme", "kalkış saati", "METAR", "meydan" yok); `JsonLd` `<` kaçışı; Airport düğümünde `iataCode`, `icaoCode` ve sayısal `geo`
  - robots (web host'u politikası ve mutlak Sitemap, admin host'u `Disallow: /`), site haritası (adres sayısı = (indekslenebilir havalimanı + 5) × 2, mutlak, karşılıklı, noindex sayfa yok), llms.txt (`# havayolu` ile başlar, bağlantılar mutlak, indekslenebilir her havalimanı bir satır)
  - paylaşım görseli çizilirken `fetch` hiç çağrılmaz (Google Fonts yedeği yok)
- `pnpm --filter @havayolu/i18n test` → TR ve EN anahtarları ve yer tutucuları aynı
- `pnpm test:e2e` (önce `pnpm dev:infra` ve `pnpm db:migrate`; `pnpm dev` kapalı):
  - kurulum: API `/v1/airports?country=TR` 61 havalimanı döndürene kadar beklenir; `GET /v1/airports/ist` → LTFM, 6 pist
  - `/`, `/havalimanlari`, `/istasyon/LTFM`, `/hakkinda`, `/yenilikler`, `/kullanim-kosullari` ve `/en` ikizleri: 200, doğru `<html lang>`, beklenen başlık, tek ve kendini gösteren mutlak canonical, karşılıklı tr/en/x-default hreflang (x-default İngilizce), `og:url` ve `og:locale`; GPTBot User-Agent'ıyla hepsi `<head>` içinde
  - JSON-LD: her blok ayrıştırılır; ana sayfada `WebSite` + `Organization`, `SearchAction` yok; havalimanında `Airport` (IATA, ICAO, sayısal `geo`) ve sıralı `BreadcrumbList`; listede 61 öğelik sıralı `ItemList`; sayfa düğümünün `inLanguage` değeri `<html lang>` ile aynı
  - yönlendirme ve durum kodları: `/istasyon/ltfm`, `/istasyon/IST` ve `/istasyon/ist` → 308 → `/istasyon/LTFM`; `/en/istasyon/ist` → `/en/istasyon/LTFM`; `/tr/durum` → `/durum`; `/dil?to=en&next=/durum` → 308 → `/en/durum` (`X-Robots-Tag`, `lang` çerezi silinir, site dışı hedef reddedilir; `next=/en//evil.example` ve `next=/tr//evil.example` de site içinde kalır); `/istasyon/ZZZZ` gerçek 404; `/en/admin`, `/en/robots.txt`, `/english` 404
  - canonical ve noindex: `/?hex=ff0001` ve `/?havalimani=LTFM` canonical `/`; `/durum` ve resmî adı doğrulanamayan tarifesiz hava üssü (LTAG) `noindex, follow`; `/admin` ve `/admin/giris` `noindex, nofollow`
  - kök dosyalar: robots.txt (tek `*` grubu, `Disallow: /admin`, yalnızca Bytespider grubu, mutlak `Sitemap:`); sitemap.xml (120 adres, LTFM için `xhtml:link` karşılıkları, `/durum` ve LTAG yok, iki istekte aynı); llms.txt; manifest ve ikonlar (PNG boyutları); `favicon.ico`; OG görselleri 1200×630 PNG (havalimanı görseli TR ve EN'de aynı); web `/api/version` ve API host'unun yanıtları `X-Robots-Tag: noindex`
  - tarayıcı: dil anahtarı `/istasyon/LTFM` ↔ `/en/istasyon/LTFM` ve `lang` değişir; istemci geçişinden sonra anahtar yeni sayfayı gösterir; haritada `/?hex=ff0001` ↔ `/en?hex=ff0001`, seçim dil değişince korunur, EN haritada seçim adresi `/en?hex=`; EN sayfalardaki bütün site içi bağlantılar `/en` altında, TR sayfalarda hiçbiri
  - `/havalimanlari` tablosunda 61 satır, satır havalimanı sayfasını açar; havalimanı sayfasında görünür yol, 6 satırlı pist tablosu, yakın havalimanları ve `/hakkinda` bağlantısı; "Canlı haritada aç" haritayı LTFM'de açar (taksi uçağı görünür, Esenboğa–Van uçağı görünmez); 320 px'te yatay kayma yok; klavye odak halkası açık ve koyu temada zemine karşı ≥ 3:1
  - mevcut onay bandı, canlı harita ve kullanım koşulları testleri değişmeden geçer
- `pnpm build` → metadata rotaları dinamik (build'e `WEB_HOST` gömülmez); `.next/standalone/apps/web/assets/og-fonts` var
- `pnpm dev:replay` üzerinde elle: `curl` ile `/`, `/en`, `/havalimanlari`, `/en/havalimanlari`, `/istasyon/LTFM`, `/en/istasyon/LTFM`, `/istasyon/ist` (308), `/hakkinda`, `/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/manifest.webmanifest`, `/icon/192`, OG görseli; `curl -A "GPTBot/1.2"` → başlık, canonical ve hreflang `<head>` içinde; API `GET /robots.txt` ve `X-Robots-Tag`
- `pnpm ci:full` yeşil; PR'da CI (`e2e` dahil) yeşil
- **Kullanıcıya bağlı (`[k]`):**
  - Yayından sonra `curl -A "GPTBot/1.2" https://havayolu.live/istasyon/LTFM` → canonical ve hreflang `<head>` içinde; `curl https://api.havayolu.live/robots.txt` → `Disallow: /`.
  - Google Search Console, Bing Webmaster Tools ve Yandex Webmaster doğrulaması ve site haritası gönderimi (ACTIVATION).

**Sonuçlar (2026-10-01, entegrasyon):**
- `pnpm ci:full` → yeşil: format, EOL, changelog, script ve e2e tip denetimi, e2e lint, `db:check`, `test:scripts` (31), lint, typecheck, build; `compose:guard` (8 servis, 64 anahtar); migration yükseltme (4 → 4).
- Birim testleri: shared 46, i18n 31, geo 20, providers 89, db 32, worker 184, tools 74, api 197, web 416 (45 dosya).
- `pnpm test:integration` → db 65, api 19, worker 11.
- `pnpm test:e2e` → 58/58 (3 kurulum + 55 test, ~48 sn).
- `pnpm build` → `robots.txt`, `sitemap.xml`, `manifest.webmanifest`, `llms.txt`, `/og/site`, `/istasyon/[icao]/opengraph-image` ve bütün sayfalar dinamik (ƒ); `/icon/192`, `/icon/512` (●), `/apple-icon` ve `favicon.ico` build'de üretilir. `.next/standalone/apps/web/assets/og-fonts` dört `.woff` ve `OFL.txt` ile var.
- Standalone üretim sunucusu (yan port 3190, `APP_ENV=production`, `WEB_HOST=localhost:3190`): `Sitemap:` satırı, site haritası ve canonical adresler çalışma zamanındaki `WEB_HOST`'u kullanır (build'e gömülmez); `/en/istasyon/LTFM` `lang="en"` ve EN canonical ile döner; havalimanı ve site OG görselleri `Cache-Control: public, max-age=86400`'ü korur.
- `pnpm dev:replay` üzerinde curl:
  - GPTBot User-Agent'ıyla `/`, `/en`, `/havalimanlari`, `/istasyon/LTFM`, `/hakkinda`, `/yenilikler`, `/kullanim-kosullari` ve EN ikizleri: 200, doğru `lang`; başlık, tek canonical, tr/en/x-default hreflang ve `og:url` `<head>` içinde; JSON-LD sayfa gövdesinde (`<main>`; React satır içi betiği `<head>`'e taşımaz, Google için yeri önemsizdir); `/durum`, `/en/durum` ve LTAG `noindex, follow`; `/?hex=ff0001` ve `/en?havalimani=LTFM` canonical `/` ve `/en`.
  - `/istasyon/ist` → 308 `/istasyon/LTFM`; `/en/istasyon/ltfm` → 308 `/en/istasyon/LTFM`; `/istasyon/ZZZZ` → 404 (`noindex`); `/en/admin`, `/en/robots.txt` → 404; `/tr/durum?x=1` → 308 `/durum?x=1`; `/dil?to=en&next=/durum` → 308 `/en/durum` (`X-Robots-Tag: noindex`, `lang` çerezi silinir; `next=//evil.com` → `/en`).
  - `/robots.txt` tek `*` grubu + Bytespider; `/sitemap.xml` geçerli XML, 112 adres, 336 `xhtml:link`; `/llms.txt` 51 havalimanı satırı; manifest, `/icon/192`, `/icon/512`, `/apple-icon`, `favicon.ico`, `/og/site` ve havalimanı OG görseli 200 ve doğru içerik türü; web `/api/version` `X-Robots-Tag: noindex`.
  - API: `GET /robots.txt` → `Disallow: /`; `/v1/airports/ist` 200, `zzzz` 404, `x1` 400; bütün yanıtlarda (404 dahil) `X-Robots-Tag: noindex`.
- Bilinen sınır: `/istasyon/<bilinmeyen>` 404'ünün sunucu HTML'i Next'in boş hata kabuğudur (`<html id="__next_error__">`); 404 sayfası tarayıcıda çizilir (D-076 → "Gerçek 404").

**İnceleme düzeltmeleri (2026-10-01; doğrulanan 20 bulgu, tekilleştirilince 16 sorun, hepsi düzeltildi, ayrıntı D-076):**
- `/dil` açık yönlendirmesi (`next=/en//evil.example` → `//evil.example`) kapatıldı; proxy'de `/tr//…` ve `/en//…` 404.
- Kök dosyalar yeniden proxy'den geçer: www'de 308, admin host'unda `X-Robots-Tag` ve `/admin` yönlendirmesi (site haritası, llms.txt, OG).
- Boş havalimanı listesi saatlik önbellekte kalırsa dakikalık ikinci kayıt okunur; önbelleksiz istek yok.
- Dizine ekleme: tarifeli ya da istasyon ya da resmî adı doğrulanmış sivil havalimanı (fixture'da 55; noindex 6 askerî üs). OurAirports tarifeli sefer ve pist ışıklandırması bayrakları kaynağa atfedilir, "Yok" denmez.
- Kapsama planı `packages/geo/src/coverage.ts`'e taşındı; çekim alanı dışındaki havalimanı (LTCW) canlı haritada uçak vaat etmez, `/hakkinda` onu veriden listeler.
- `/hakkinda` ve llms.txt: "her hesaplanan değer tahmini etiketlidir" cümlesi kaldırıldı; birincil çember 40 NM; durum satırı birincil istasyonun veri yaşını gösterir.
- İngilizce adlar çeviri olarak atfedilir; ham OurAirports yerleşimi (Istanbul(Bakırköy) vb.) sayfada ve JSON-LD'de yok; açık temada odak halkası `#1f5fd1` (5,4:1).
- Site haritası E2E'sindeki `lastmod` denetimi gün biçimli tarihlerde İstanbul takvimine göre kıyaslar (00:00–03:00 arası kırmızı olmaz).
- `pnpm ci:full` → yeşil. Birim testleri: shared 49, i18n 31, geo 31, providers 89, db 32, worker 175 (kapsama planı testleri geo'ya taşındı), tools 74, api 197, web 442 (46 dosya), scripts 31. `test:integration` → db 65, api 19, worker 11. Migration yükseltme 4 → 4. `compose:guard` 8 servis, 64 anahtar. `test:e2e` → 59/59 (3 kurulum + 56 test). Site haritası artık 120 adres, llms.txt 55 havalimanı satırı.
- **Bağımsız denetim:** 20 bulgunun hepsi düzeltilmiş bulundu. `/dil` için 53 düşmanca girdiyle (424 çağrı, 25 proxy yolu) atlatma denendi, site dışına giden yönlendirme yok. 16 mutasyonun 15'i testlerce yakalandı (16. satır başka denetimle zaten kapalı). Denetimin bulduğu, `main`'de de olan bir sorun düzeltildi: `next` "ş" gibi Latin-1 dışı karakter içerince `/dil` 500 dönüyordu; hedef artık yüzde kodlanır (test eklendi).
- `pnpm stats` → 434 dosya, 60.942 satır (54.417 kod).

## M6c — Havalimanı hava durumu, METAR/TAF kaydı ve harita penceresi
Onay: 2026-10-01 (kullanıcı isteği: havalimanı hava durumu, METAR/TAF kaydı, harita penceresi)

Kararlar ve gerekçeler D-078'dedir; düzeltme turundaki harita ek istekleri (pin, yazı boyu, açılış görünümü, tıklama önceliği) D-079'dadır. Kilometre taşı Parça 1'e sonradan eklendi; METAR/TAF Parça 2 M2'den öne alındı (`docs/prompts/parca-2.md`). Hedef sürüm 0.11.0, migration 0004.

**Kapsam:**
- Her havalimanı sayfasında (`/istasyon/<ICAO>`, TR ve EN) canlı hava durumu: rüzgâr (yön, hız, hamle), yağmur, kar, gök gürültüsü ve sis her zaman açıkça; görüş, bulut, sıcaklık, nem, basınç, gözlem saati ve yaşı, TAF tahmini, yerel saat, gün doğumu ve batımı. Sade görünüm metrik ve kodsuz; ayrıntı ve ham metin uzman `<details>`'inde.
- METAR/TAF kaydı: her farklı rapor 30 gün saklanır; sayfada son 24 saatin "METAR/TAF kaydı" listesi; API'den istek başına en çok 7 gün.
- Kaynak aviationweather.gov: worker METAR'ı 5 dk'da, TAF'ı 15 dk'da bir tek toplu istekle çeker; günlük budama.
- API: `GET /v1/weather?country=TR`, `GET /v1/airports/:code/weather`, `GET /v1/airports/:code/weather/history?hours=`.
- Canlı haritada havalimanına (pini ya da IATA kutucuğu) tıklayınca küçük pencere: ad, kodlar, il, rakım, pist özeti, yerel saat, gün doğumu ve batımı, güncel hava, havalimanı sayfası bağlantısı. Klavyeyle "Havalimanları" listesinden açılır.
- **Ek istekler (kullanıcı, 2026-10-01; D-079):**
  - havalimanı noktası yerine özgün kırmızı pin (ucu referans noktasında, beyaz kenar ve koyu hat, yakınlaştırmayla büyür); IATA kodu pinin yanında ya da üstünde, pini örtmez; pin ve kod tıklanır
  - harita yazıları ~1 px küçük (uçak etiketi 12/11 px, kod 11 px), çakışma düzeni yeni boyutlarla
  - açılış görünümü her açılışta ve yenilemede IST/LTFM merkezli, kısa kenar ~100 km (masaüstünde z8,5, D-104'ten beri 8; telefonda ~7,8); `?hex=` ve `?havalimani=` önceliklidir; Türkiye görünümü kaldırıldı
  - tıklama önceliği: uçak etiketi > havadaki uçak > havalimanı kodu ya da pini > yerdeki uçak > dokunma payı; IST'nin kodu yerdeki uçakların üstüne yazılabilir
  - `/havalimanlari` kapsam cümlesindeki "OurAirports'ta tarifeli seferi kayıtlı" ifadesi kaldırıldı (yalın dahil etme cümlesi); `/hakkinda` tazelik listesi kalır
- "Tarifeli sefer (OurAirports)" ve "İzlenen istasyon" bilgileri her yerden kaldırıldı (dizine ekleme kuralı D-076'daki gibi kalır).
- Havalimanı sayfasında "Sefer sayısı, rötar ve iptal" bölümü: bu bilgilerin henüz olmadığını açıkça söyler.
- Admin Servisler'de "Hava durumu · aviationweather.gov" satırı.
- Kapsam dışı: rötar, iptal ve tarife (Parça 5, ücretli sağlayıcı, DUR-SOR 5); gözlenen günlük iniş ve kalkış sayıları ve pist kullanımı (Parça 2 motoru); `/havalimanlari` listesinde hava durumu; canlı fixture kaydı (kullanıcı kararı: fixture'lar elle yazılır).

**Dizinler ve dosyalar:**
- **`packages/shared/src/map/airport-pin.ts`, `layers.ts`, `colors.ts`:** pin geometrisi, pin symbol katmanı ve renkleri (D-079)
- **`packages/shared/src/weather/`:** zod sözleşmesi (`AirportWeatherSchema`, `WeatherBulkResponseSchema`, `WeatherHistoryResponseSchema`), METAR/SPECI ve TAF çözümleyicileri (ham metinden), türetilen değerler (başlık, tavan, bağıl nem, kuvvetli rüzgâr, yaş sınıfı), i18n anahtarı döndüren özetleyici, pusula yönü, gün doğumu ve batımı (NOAA), yerel saat; saf, IO yok
- **`packages/providers/src/weather/`:** aviationweather.gov istemcisi (HTTPS, User-Agent, `redirect: 'manual'`, gövde sınırı, 200/204/400/403/429/5xx, `Retry-After`) ve toleranslı AWC JSON şeması; `license.ts` → `aviationWeather` 7 alan
- **`tools/fixtures/weather/`:** elle yazılmış, "sentetik" etiketli METAR ve TAF fixture'ları; LTFM için en az 3 günlük kayıt
- **`packages/db`:** `weather_metar`, `weather_taf`, `weather_sources` (`drizzle/0004_weather.sql`); `src/weather.ts` (ekleme, son rapor, kayıt sorgusu, budama, kaynak durumu)
- **`apps/worker/src/jobs/`:** `weather-metar` (5 dk), `weather-taf` (15 dk), `weather-prune` (günlük); `EXTERNAL_PROVIDERS_DISABLED` iken geliştirme ve testte fixture (zamanlar tam saat kaydırılır), üretimde nedeniyle kapalı
- **`apps/api/src/`:** `reference/cache.ts` (`cachedReader` ayrıldı), `reference/weather.ts` (üç uç nokta, OpenAPI etiketi `weather`), `admin/services.ts` (hava durumu satırı), `app.ts` ve `index.ts` bağlantıları
- **`apps/web/src/`:**
  - `lib/weather.ts` (sunucu yükleyicisi; hata `null` döner), `lib/use-now.ts` (`components/map/`'ten taşındı)
  - `components/airports/`: hava durumu bölümü ve istemci yenileme adası, METAR/TAF kaydı listesi, sefer bilgisi bölümü, simgeler; kaldırılan iki bilgi
  - `app/istasyon/[icao]/page.tsx`, `app/havalimanlari/` (iki sütun kalktı), `app/llms.txt/` ve `lib/seo/` (kaldırılan satırlar)
  - `components/map/`: havalimanı penceresi (`airport-popup.tsx`), pin ve kutucuk isabet testi (`resolveHit`), konumlama, odak yönetimi, uçak kartıyla karşılıklı dışlama, tembel toplu hava isteği, "Havalimanları" listesi (`panels/airport-list-control.tsx`), pin bitmapi (`icons.ts`), IST açılış görünümü (`camera.ts`)
  - `lib/wall-clock.ts`: sunucu saatine bağlı duvar saati (hava durumu "şimdi"si)
  - `app/globals.css`: bölümlerin ve pencerenin stilleri
- **`packages/i18n`:** `weather.*` (satırlar, hava olayları, rüzgâr, bulut, yaş, TAF şablonları, kayıt listesi, uzman ayrıntısı, kaynak ve uyarı), `airport.schedule.*`, `map.airportPopup.*`, admin ve hakkında satırları; kaldırılan bilgilerin anahtarları silindi
- **`e2e/`:** `tests/weather.spec.ts`; kurulum (`app.setup.ts`) sayfaları derletmeden önce LTFM'nin METAR/TAF kaydının ve toplu yanıttaki son METAR'ın API'de görünmesini bekler; `support.ts`'te hava fixture değerleri (`PRIMARY_WEATHER`, `NO_WEATHER_AIRPORT`)
- **Belgeler:** D-078; `docs/spec/data-sources.md` §5; `docs/REFERENCES.md` (AWC, NWS, MGM, WMO-782, NOAA güneş hesabı); `docs/RUNBOOK.md` (AWC 429/403); `docs/spec/domain.md` (QNH kaynağı); `docs/prompts/parca-2.md` ve `parca-3.md` notları; `ATTRIBUTION.md`; `tools/fixtures/README.md`; `docs/ACTIVATION.md` (üretimde ilk gerçek METAR'ın doğrulanması)

**Kabul komutları:**
- `pnpm --filter @havayolu/db db:generate --name weather` ve `pnpm db:check` → şema ile migration tutarlı
- `pnpm --filter @havayolu/shared test`:
  - METAR/SPECI: yağmur, kar, gök gürültüsü, FZRA, VC, RE, CAVOK, NSC, NCD, SKC, VV, VRB, sakin, hamle, değişken yön aralığı, RVR, NOSIG/TEMPO/BECMG, AUTO, NIL, COR; tanınmayan parça → "belirlenemedi" (MGM ve WMO-782 örnekleri dahil)
  - TAF: PROB30 TEMPO, AMD, CNL, NIL, yerine geçme, ay dönümü; "… saatine kadar" olayın gerçek sonudur (yalnız rüzgârı değiştiren BECMG, MGM BCFG örneği, örtüşen iki TAF'ta da yağmur)
  - eğilim penceresi: taze gözlemde "önümüzdeki 2 saat", 30 dk–2 sa'te bitiş saatiyle, sonra yok
  - başlık sıralaması ("-DZ FG" sis başlığı alır), bağıl nem (20/15 → %75; 5/4 → %95), tavan, kuvvetli rüzgâr, yaş sınıfı, pusula sınırları
  - gün doğumu ve batımı LTFM için üç tarihte NOAA hesaplayıcısına ±1 dk
- `pnpm --filter @havayolu/providers test` → URL (düz virgül, belgelenmemiş parametre yok), 200, 204 (ayrıştırılmaz), 400, 403, 429 (`Retry-After` var ve yok), 5xx, 3xx, gövde sınırı, zaman aşımı, 400 kayıtta bölme; AWC şeması (`"VRB"`, `"6+"`, boş ve bilinmeyen alanlar); lisans kaydı
- `pnpm --filter @havayolu/worker test` → çalışma kipi (lisans engeli, uzak, fixture, kapalı), fixture kaydırma (epoch ve ham gruplar, ay dönümü), 429 → engel ve atlanan çalışmalar, 403, 204 satırları korur, zamanlama kalıpları; kesinti sonrası METAR geriye bakışı (5 sa önce son denetim → 6 sa, ilk açılış → 24 sa) ve uzun geriye bakışta istasyon gruplama (providers)
- `pnpm --filter @havayolu/api test` → üç uç nokta: ICAO ve IATA, 400/404/503, `Cache-Control`, `hours` 1–168, gövde 1 MB altında (168 saat dahil), OpenAPI etiketi ve şeması, okurken çözümleme; admin hava durumu satırının durumları; geçmiş önbelleği farklı saat ve istasyonlarla doldurulsa da anahtar ve bayt sınırında kalır; yayımlanan OpenAPI şemaları fixture yanıtlarını Ajv ile doğrular (null enum)
- `pnpm --filter @havayolu/web test` → duvar saati (uyku, yanlış cihaz saati), açılışta iki yanıtın da tazeliği, uzman tablosunda pist yüzeyi durumu ve renk durumu, "1 report", kuvvetli rüzgâr etiketinden önce ayraç, pencerede Escape kuralı ve kibar bildirim, görünümdeki havalimanları listesi, tıklama önceliği, pin geometrisi ve IST kodu kuralı, IST açılış yakınlaştırması; hava durumu bölümü her fixture vakası için (yağmur, kar, gök gürültüsü ve sis satırları hep var; CAVOK, VRB, hamle, SPECI ve dolu, FZRA, gecikmiş, eski, rapor yok, TAF yok, süresi dolmuş TAF, API yok), METAR/TAF kaydı listesi, sefer bilgisi bölümü, kaldırılan iki bilgi yok; harita penceresinin saf parçaları (konumlama, isabet testi, veri birleştirme); SEO yasak kelime testi aynen geçer, JSON-LD'de hava durumu anahtarı yok
- `pnpm --filter @havayolu/i18n test` → TR ve EN anahtarları ve yer tutucuları aynı
- `pnpm test:integration` (önce `pnpm dev:infra`) → hava tabloları: ekleme, COR değişimi, 30 günlük budama, istasyon budaması, kaynak durumu, en yeni rapor ve geçmiş sorgularının dizini sıralama adımı olmadan kullanması (EXPLAIN); 5 migration; worker zamanlayıcıları ve fixture'dan dolan `weather_metar`; API gerçek PostgreSQL'le
- `pnpm test:migration-upgrade` → 4 → 5
- `pnpm test:e2e` (önce `pnpm dev:infra` ve `pnpm db:migrate`; `pnpm dev` kapalı):
  - kurulum: `/v1/weather?country=TR` METAR'lı istasyon döndürene ve LTFM kaydı dolana kadar beklenir
  - API: toplu yanıtta 61 havalimanı (LTBQ'nun raporu yok), `/v1/airports/ist/weather` → LTFM, kayıt en yenisi önce ve METAR ile TAF içerir, 72 saat 24 saatten fazla döndürür, `hours=0`, `169` ve `abc` → 400, `ZZZZ` → 404
  - `/istasyon/LTFM` ve `/en/istasyon/LTFM`: hava durumu bölümü ve açık rüzgâr (hamle, kuvvetli rüzgâr), yağmur, kar, gök gürültüsü ve sis satırları; yerel saat, gün doğumu ve batımı; uzman ayrıntısında ham METAR; METAR/TAF kaydında en az fixture'daki kadar kayıt, en yenisi önce; sefer sayısı, rötar ve iptal bölümü; başlık, açıklama ve JSON-LD'de hava durumu yok; "Tarifeli sefer" ve "İzlenen istasyon" hiçbir yerde yok (liste, liste açıklaması ve llms.txt dahil); 320 px'te yatay kayma yok
  - harita: IST kutucuğuna tıklayınca pencere ad, kodlar, rakım, pistler, yerel saat, gün doğumu ve batımı, hava durumu ve "Havalimanı sayfası" bağlantısıyla açılır ve odak pencereye geçer; Escape kapatır ve odak haritaya döner; arama kutusundaki Escape kapatmaz; kapat düğmesi ve haritada boş yere tıklama kapatır; uçak seçmek pencereyi kapatır; bağlantı havalimanı sayfasını açar; 375 px'te pencere alttan açılan sayfadır; "Havalimanları" listesinden klavyeyle açılır ve hava durumu kibarca bildirilir; z10'da apronda IST kodu ve pini tıklanır
  - açılış görünümü IST merkezlidir (görünümdeki ilk havalimanı IST, LTFM'deki taksi uçağı tabloda), yenilemede de; Esenboğa sayfasındaki "Canlı haritada aç" ESB'de açar
  - mevcut onay bandı, canlı harita, dil, SEO, havalimanı ve kullanım koşulları testleri geçer
- `pnpm dev:replay` üzerinde elle: `curl` ile `/v1/weather?country=TR`, `/v1/airports/LTFM/weather`, `/v1/airports/IST/weather/history?hours=24`; tarayıcıda `/istasyon/LTFM`, `/en/istasyon/LTFM`, `/istasyon/LTCW` (eski gözlem), `/istasyon/LTBQ` (rapor yok), haritada IST penceresi, admin Servisler'de hava durumu satırı
- `pnpm ci:full` yeşil; PR'da CI (`e2e` dahil) yeşil
- **Kullanıcıya bağlı (`[k]`):** yayından sonra üretimde gerçek METAR'ların geldiğinin doğrulanması (ACTIVATION). **2026-10-02 doğrulandı:** 61 havalimanının 54'ünde METAR, 55'inde TAF; IST geçmişi 48 rapor.

**Çıktı kaydı (2026-10-02):**
- **Yöntem:** Araştırma notu (AWC API'si, MGM/WMO terimleri, kod tabanı) üzerine sözleşme yazıldı. 6 paralel ajan ayrışık dosyalarda uyguladı: çözümleyici, sağlayıcı/DB/işler, API, havalimanı sayfaları ve i18n, harita penceresi, E2E ve belgeler. Ardından tek ajan birleştirdi.
- **İnceleme:** 6 açıdan inceleme ve bulgu başına 3 çürütücü doğrulayıcı. 16 bulgu doğrulandı; ilk turdaki dizin bulgusu da eklendi (migration yayımlanmadığı için 0004 yeniden üretildi). Hepsi düzeltildi. Başlıcaları:
  - geçmiş önbelleğiyle API belleğini tüketme açığı (yüksek önem)
  - ilgisiz BECMG ya da yeni TAF'ta süren olayı erken "bitiyor" gösteren TAF özeti
  - uykudan dönen cihazda kayan saat
  - klavyeyle açılamayan havalimanı penceresi
  - OpenAPI'de `null` kaybeden enum'lar
  - kesintiden sonra boşluk bırakan METAR kaydı
- **Kullanıcının ek istekleri** (aynı turda, D-079): kırmızı toplu iğne simgesi, küçük harita yazıları, açılışta ve yenilemede IST merkezli görünüm, tıklama önceliği (havadaki uçak > havalimanı iğnesi ve kodu > yerdeki uçak), `/havalimanlari` kapsam cümlesi.
- **Bağımsız denetim:**
  - Bütün maddeler düzeltilmiş bulundu.
  - Bellek açığına 6.160 isteklik saldırı denendi; heap ~30 MB'ta sabit kaldı.
  - 20 mutasyonun 19'u testlerce yakalandı.
  - Tarayıcıda IST açılışı, iğne ucunun konumu (0,5 px), yerdeki uçağın üstündeyken iğne ve kod tıklaması (5/5), Escape ve klavye yolu doğrulandı.
  - Denetimin bulduğu üç küçük sorun da düzeltildi: pencere kapanınca odak, pencere saati, birleştirilen rüzgârın en kuvvetli değeri. Bu düzeltmelerin 18 mutasyonundan 14'ü yakalandı.
- **Bilinen küçük boşluklar:** haritanın cihaz öncelikli saati kullandığını ve sekmeye dönüşte saatin yenilendiğini doğrulayan test yok; birleştirilen rüzgârda eşit hızda yön seçimi testsiz.
- **`pnpm ci:full` → yeşil** (turbo önbelleği kapalı):
  - Birim testleri: web 560, shared 380, api 236, worker 195, providers 118, tools 74, i18n 55, db 35, geo 31, scripts 31.
  - Entegrasyon testleri: db 77, api 22, worker 12.
  - Migration yükseltme 4 → 5; `compose:guard` 8 servis, 64 anahtar.
  - E2E 78/78.
- `pnpm stats` → 511 dosya, 81.929 satır (74.144 kod).

## M6d — Türkiye dışındaki havalimanları, 1. halka (≤ 500 km)
Onay: 2026-10-01 (kullanıcı: Türkiye dışı havalimanları halka halka, ABD ve ötesi dahil)

Kararlar ve gerekçeler D-080'dedir; site teması ve hava durumu sunumu D-081'dedir. Kilometre taşı Parça 1'e sonradan eklendi. Halkalar yakından uzağa ayrı sürümlerle açılır; bu kilometre taşı yalnızca 1. halkayı açar. Hedef sürüm 0.12.0; tek migration veri migration'ıdır (`0005_ourairports_reimport`: içe aktarım süzgeci değiştiği için OurAirports bir kez koşulsuz yeniden içe aktarılır; şema değişmez).

**Kapsam:**
- **Halkalar:** uzaklık, IATA kodlu en yakın Türkiye havalimanına büyük daire mesafesidir. 1 ≤ 500 km, 2 ≤ 1.000 km, 3 ≤ 2.000 km, 4 ≤ 5.000 km, 5 = dünyanın geri kalanı (ABD dahil). Sonraki halka yalnızca `ENABLED_AIRPORT_RING`'i büyütür.
- **Uzaklık referansı (entegrasyonda, D-080):** analizdeki gibi Türkiye'nin IATA kodlu 66 alanı. İçe aktarım tarifesiz 5 küçük alanı (Gökçeada, Selçuk-Efes, Bodrum-İmsık, Aydın Çıldır, Adana Şakirpaşa) yalnızca referans olarak alır; Türkiye listesi 61'de kalır. Onlarsız 1. halka 72'ye düşüyordu (Priştine, Preveze, Niş dışarıda). Ayrıntılı kayıt uzaklığın ölçüldüğü havalimanını taşır (`nearestTr`); sayfa onu yazar.
- **Aday:** OurAirports `large_airport`/`medium_airport`, tarifeli seferi kayıtlı, 3 harfli IATA kodlu; 1. halkada 75 havalimanı.
- **"Listelenen havalimanları" tek tanım:** IATA kodlu Türkiye havalimanları (61) + açık halkalardaki yabancı adaylar. Her biri `country`, `ring` (Türkiye 0) ve `distanceToTrKm` (Türkiye null) taşır; halka üyeliği sunucuda hesaplanır.
- **API:** `GET /v1/airports?scope=listed` (`include=runways` ile ve onsuz), `GET /v1/weather?scope=listed`. Varsayılan `country=TR` kalır; ikisi birlikte 400. Tek havalimanı ve hava durumu uç noktaları listelenen yabancı havalimanlarını da çözer.
- **Worker:** hava durumu istasyonları listelenen havalimanlarıdır (~136). AWC istemcisi istasyonları baştan gruplara böler: 400 kayıt sınırına göre olağan 2 saatlik METAR'da 80 istasyon (136 istasyon = 2 istek), her istekte en çok 200 istasyon; ikiye bölme yalnızca yedektir. Son 24 saatte METAR'ı saklanmamış (listeye yeni giren) istasyon, worker süreci başına bir kez ayrı bir istekle 24 saat istenir.
- **Harita:** listelenen havalimanları ve onların toplu havası; yabancı havalimanları da pin, IATA kodu ve pencereyle gösterilir. Pencere il yerine ülkeyi yazar (Ercan: KKTC). IST açılış görünümü ve performans kuralları değişmez.
- **Sayfalar:** `/havalimanlari`'da Türkiye tablosundan sonra "Yakın ülkelerdeki havalimanları" tablosu (ad, ülke, IATA, ICAO, Türkiye'ye uzaklık, en uzun pist; ülkeye sonra ada göre Türkçe sıralı). `/istasyon/<ICAO>` listelenen yabancı havalimanlarında aynı bölümlerle açılır; il satırı yerine şehir ve ülke (şehir küratörlü tablodan, sayfanın dilinde: "Selanik, Yunanistan"; OurAirports'un İngilizce yerleşimi gösterilmez). Listelenmeyen havalimanı 404.
- **SEO:** yabancı sayfalar dizine eklenir (TR/EN hreflang), site haritasına ve llms.txt'e (ayrı "Yakın ülkeler" listesi) girer; JSON-LD `addressCountry` LCEN'de yazılmaz.
- **Adlar ve ülkeler:** 75 havalimanının TR/EN adı ve şehri küratörlü tabloda (Türkçe yer adlarıyla); uzaklık referansı 5 küçük alanın adı ayrı tabloda ("Bodrum-İmsık Havalimanı"); ülke adı `Intl.DisplayNames` (XK ve LCEN istisnaları).
- **Fixture:** OurAirports'tan onaylı tek indirme (2026-10-01T23:03:49Z); 75 havalimanı ve 89 açık pist fixture'ın sonuna eklendi. LGAV, LCLK, LCEN, UGTB, LBSF ve LGTS için elle yazılmış hava durumu.
- **`/hakkinda`:** yakın ülkelerdeki havalimanlarının listelendiği ve canlı uçak kapsamasının Türkiye odaklı olduğu yazılır.
- **Tema A "Açık turkuaz" (kullanıcı kararı 2026-10-02, D-081):** koyu lacivert geçici temanın yerine tek tema; işletim sisteminin koyu tercihi rengi değiştirmez. Sayfalar, harita panelleri, havalimanı penceresi, etiket ve IATA kutuları (beyaz, #B9E2E6 kenar), paylaşım görselleri, uygulama simgeleri, manifest. Next'in yerleşik hata sayfası yerine temalı ve iki dilli `error.tsx` / `global-error.tsx`.
- **Hava durumu sunumu (kullanıcı istekleri 2026-10-02, D-081 ek):** pencerede gün doğumu ve batımı yok; sıcaklık başlığın yanında ayrı kutucuk (eksi U+2212); sayıdan önce "·" ya da "–" yok (hava durumu metinleri, uçak etiketi "431 km/sa, 333 m", arama sonucu, yönetim sayım satırı); satır simgeleri; var olan olayın satırı vurgulu. Düzeltme turunda: dar ekranda satır düzeni (etiket sütunu en çok 11rem, 480 px'te tek sütun), telefonda pencerenin "Havalimanı sayfası →" bağlantısı kaydırmadan görünür, arama ipucu 1280 ve 375 px'te kesilmez, liste tablosu başlıkları ("il adına göre sıralı").
- **Kapsam dışı:** 2–5. halkalar (ayrı sürümler); yakın ülkelerde canlı uçak verisi (kapsama planı değişmez).

**Dizinler ve dosyalar:**
- **`packages/shared`:** halka sabitleri ve işlevleri (`AIRPORT_RINGS_KM`, `ENABLED_AIRPORT_RING`, `airportRing`, `isForeignCandidate`), `reference/foreign-airport-names.ts` (75 havalimanının TR/EN adı ve şehri, `FOREIGN_AIRPORT_CITIES`), `reference/airport-names.ts` (`REFERENCE_AIRFIELD_NAMES`, `airportLocality`), ülke adları (`airportCountryName`, `countryName`), `AirportDetail`'e `country`, `ring`, `distanceToTrKm`; `map/colors.ts` (tema A etiket renkleri), `weather/phrase.ts` (virgül ayraç)
- **`tools/fixtures/`:** `ourairports/airports.csv` ve `runways.csv` (1. halka satırları sonda), `weather/` (altı 1. halka istasyonu), `README.md` (indirme anı)
- **`packages/db`, `apps/api/src/reference/`:** listelenen havalimanları okuyucusu (halka üyeliği, önbellek), `scope=listed`, OpenAPI
- **`packages/providers`, `apps/worker/src/jobs/`, `packages/db/src/weather.ts`:** hava durumu istasyon kümesi = listelenen havalimanları; 80 istasyonluk baştan gruplama (400 kayıt sınırı); yeni istasyonun 24 saatlik doldurması (`metarStationsSince`); içe aktarım süzgeci Türkiye'nin IATA kodlu küçük alanlarını da alır (uzaklık referansı)
- **`apps/web/src/`:**
  - `lib/airports.ts`, `lib/weather.ts`: `scope=listed`
  - `components/airports/`, `app/havalimanlari/`, `app/istasyon/[icao]/`: yakın ülkeler tablosu, yabancı havalimanı sayfası (şehir ve ülke, yakın havalimanları karışık)
  - `lib/seo/`: site haritası, llms.txt "Yakın ülkeler" listesi, JSON-LD ülke kodu
  - `components/map/`: `airport-data.ts` (`scope=listed`, `country`), `use-airport-weather.ts` (`scope=listed`), `airport-popup-model.ts` ve `airport-popup.tsx` (il yerine ülke; saat dilimi bilinmeyen havalimanında saat satırları yok, gözlem saati UTC)
  - `components/about/`: komşu ülkeler ve Türkiye odaklı kapsama
  - tema A: `app/globals.css`, `app/layout.tsx`, `app/manifest.ts`, `app/favicon.ico` (`scripts/gen-favicon.mts`), `lib/seo/brand.ts`, `lib/seo/og.tsx`, `components/map/labels.ts`; hata sayfaları `app/error.tsx`, `app/global-error.tsx`, `components/error-content.tsx`
  - hava durumu sunumu: `components/airports/weather-rows.ts`, `weather-row-list.tsx`, `weather-rows.css`, `weather-icon.tsx`, `weather-panel.tsx`, `weather-log.tsx`, `weather-expert.ts`; `components/map/airport-popup.tsx`, `airport-popup.css`, `airport-popup-model.ts`; `lib/map/label-text.ts`, `components/map/panels/panel-format.ts`
- **`packages/i18n`:** liste, havalimanı sayfası, hakkında ve llms.txt metinleri (TR/EN); hava durumu ayraçları; arama ipucu ve erişilebilir ad; hata sayfası metinleri (`src/error-page.ts`, `@havayolu/i18n/error-page`)
- **`e2e/`:** `tests/foreign-airports.spec.ts`; kurulum `scope=listed` havalimanı ve hava yanıtlarını bekler; `support.ts`'te 1. halka sabitleri; liste, site haritası ve llms.txt sayıları 136/130'a güncellendi; `airports.spec.ts` (odak halkası açık ve koyu tercihte), `weather.spec.ts` (hava durumu sunumu, IST kodunun tuvalde bulunması, telefonda pencere bağlantısı, dar ekranda satır düzeni), `live-map.spec.ts` (arama ipucu)
- **Belgeler:** D-080, D-081; D-078'in pencere bölümü ve örnekleri; `docs/spec/data-sources.md` §3 ve §5; `docs/RUNBOOK.md` (aviationweather.gov istek sayıları); `docs/ACTIVATION.md` (M6d yayın doğrulaması, web önbelleği); `tools/fixtures/README.md`

**Kabul komutları:**
- `pnpm --filter @havayolu/shared test` → `airportRing` sınırları (500 dahil, 500,1 2. halka), `isForeignCandidate`; fixture'daki her 1. halka havalimanının küratörlü adı ve şehri var, listelenmeyen her Türkiye referansının adı var ("Bodrum-İmsık"); `airportLocality`; tema A palet ve karşıtlık testi (`map/layers.test.ts`); ülke adları (Yunanistan/Greece, Kosova, Ercan → KKTC/TRNC); tabloda olmayan ad için kural ("International Airport" → "Uluslararası Havalimanı")
- `pnpm --filter @havayolu/api test` → `scope=listed` (61 + 75, halka ve uzaklık), `include=runways` ile, `country` ile birlikte 400, OpenAPI; tek havalimanı ve hava durumu yabancı havalimanını çözer
- `pnpm --filter @havayolu/worker test` ve `@havayolu/providers` → istasyon kümesi listelenen havalimanları; 136 istasyonluk olağan istek iki isteğe (80 + 56) bölünür; istasyon listesi büyüyünce yeni istasyonlar ayrı istekte 24 saatle istenir
- `pnpm --filter @havayolu/i18n test` → hiçbir metinde sayıdan ya da yer tutucudan önce "·" ya da "–" yok; hata sayfası metinleri iki dilde
- `pnpm --filter @havayolu/web test` → liste tabloları, yabancı havalimanı sayfası, site haritası ve llms.txt; harita: `scope=listed` adresleri, ülke alanı (eski API'de bölge kodundan), pencerede il yerine ülke (Ercan KKTC), saat dilimi bilinmeyen havalimanında saat satırları yok ve gözlem saati UTC; yabancı sayfada yer satırı, yerleşim satırı, paylaşım görseli ve JSON-LD küratörlü şehri yazar ("Selanik, Yunanistan", "Athens, Greece"); uçak etiketi ve arama sonucu virgülle; hata sayfaları (`app/error.test.ts`); simgeler (`app-icons.test.ts`)
- `pnpm test:integration` → listelenen havalimanları gerçek PostgreSQL'le; `metarStationsSince`
- `pnpm test:e2e`:
  - kurulum: `/v1/airports?scope=listed` 136 havalimanı, `/v1/weather?scope=listed`'de LGAV'nin METAR'ı
  - API: `scope=listed` 61 + 75, yabancıların hepsi 1. halkada ve ≤ 500 km, EGLL yok, `country` + `scope` → 400; `/v1/airports/ath` → LGAV; toplu havada altı 1. halka istasyonunun METAR'ı
  - `/havalimanlari` ve `/en/havalimanlari`: iki tablo; yakın ülkeler tablosu 75 satır, ülkeye göre sıralı, Atina satırında Yunanistan/Greece ve km, Ercan satırında KKTC; ItemList 136
  - `/istasyon/LGAV` ve `/en/istasyon/LGAV`: ülke, hava durumu, harita bağlantısı, dizine eklenir, JSON-LD `addressCountry` GR; `/istasyon/LCEN` KKTC'yi gösterir, JSON-LD'de ülke kodu yok; `/istasyon/ath` → 308; `/istasyon/EGLL` ve `/istasyon/LHR` → 404
  - site haritası 130 havalimanı (LGAV ve LCEN dahil, EGLL yok); llms.txt 130 havalimanı satırı, yakın ülkeler ayrı başlık altında
  - harita: `?havalimani=LGAV` Atina'da açar, pin ve "Havalimanları"/"Airports" listesi pencereyi açar; pencerede Yunanistan/Greece ve hava durumu
  - mevcut testler geçer (IST açılışı, IST penceresi, M6c hava durumu)
  - tema ve sunum: odak halkası açık ve koyu tercihte ≥ 3:1, koyu tercihte de sayfa açık turkuaz; pencere ve sayfada sıcaklık kutucuğu, vurgulu yağmur satırı, gizli simgeler, sayıdan önce ayraç yok; IST kodu diğer uçak etiketleri görünürken de bulunur; 375×812'de pencerenin bağlantısı kaydırmadan görünür ve tıklanır; 412, 430 ve 560 px'te hava durumu satırlarında değer sütunu ≥ 150 px ve kuvvetli rüzgâr etiketi kutusunda; arama ipucu 1280 ve 375 px'te iki dilde kutuya sığar
- `pnpm dev:replay` üzerinde elle: `curl` ile `/v1/airports?scope=listed` (136), `/v1/weather?scope=listed`; tarayıcıda `/havalimanlari`, `/istasyon/LGAV`, `/istasyon/LCEN`, `/en/istasyon/UGTB`, haritada Atina ve Ercan pencereleri
- `pnpm ci:full` yeşil; PR'da CI (`e2e` dahil) yeşil
- **Kullanıcıya bağlı (`[k]`):** yayından sonra üretimde `scope=listed` 136 havalimanı, yakın ülkeler tablosu 75 satır ve yabancı havalimanlarında gerçek METAR (ACTIVATION, "M6d yayın doğrulaması"). **2026-10-02 doğrulandı (v0.12.0):** 136 havalimanı (75 yurt dışı), 122 istasyonda METAR ve TAF (68'i yurt dışı), `/istasyon/LGAV` "Atina, Yunanistan", `/istasyon/LCEN` KKTC.

**Çıktı kaydı (2026-10-02):**
- **Yöntem:** Halka analizi (OurAirports'tan onaylı tek indirme) ve sözleşme üzerine 4 paralel ajan ayrışık dosyalarda uyguladı: shared/db/API, fixture ve worker, sayfalar/SEO/i18n, harita/E2E/belgeler. Ardından tek ajan birleştirdi; 75 ↔ 72 farkını uzaklık referansı kuralıyla çözdü (D-080). Kullanıcının 2026-10-02 istekleri (tema A, pencere ve hava durumu sunumu) iki paralel ajan ve bir birleştirici ile eklendi (D-081).
- **İnceleme:** 6 açıdan inceleme (referans verisi, API/worker, sayfalar/SEO, tema/erişilebilirlik, hava durumu sunumu, testler/belgeler) ve bulgu başına 3 çürütücü doğrulayıcı. 22 bulgunun 13'ü doğrulandı (11 ayrı madde), 9'u çürütüldü. Hepsi düzeltildi. Başlıcaları:
  - Türkçe sayfalarda OurAirports'un İngilizce şehir adı (küratörlü TR/EN şehir tablosu)
  - uzaklık referansı küçük alanların adı ("Bodrum-İmsık")
  - listeye yeni giren istasyonun yalnızca 2 saatlik METAR'la başlaması (24 saatlik tek seferlik doldurma)
  - Next'in koyu ve İngilizce yerleşik hata sayfası (temalı, iki dilli hata sayfaları)
  - 412–430 px telefonlarda sıkışan hava durumu satırları
  - RUNBOOK, D-078/D-080/D-081 ve ACTIVATION'daki eski sayılar ve web önbelleği notu
- **Düzenleyicinin ek düzeltmeleri:** uçak etiketi ve arama sonucunda sayıdan önce "·" yok (i18n testi bütün metinleri denetler), telefonda pencere bağlantısı kaydırmadan görünür, arama ipucu kesilmez, liste tablosu başlıkları, E2E'de IST kodunun tuvalde bulunması.
- **Bağımsız denetim:** bütün maddeler düzeltilmiş bulundu. 11 mutasyon grubunun hepsi testlerce yakalandı (560 px EN e2e vakası ayırt edici değil). Tarayıcıda (1280 ve 375 px, TR ve EN) IST açılışı, etiketler, IST penceresi, telefonda bağlantı, LTFM ve LGAV sayfaları, liste tabloları ve arama ipucu doğrulandı; konsol hatası yok.
- **`pnpm ci:full` → yeşil:**
  - Birim testleri: web 616, shared 403, api 251, worker 200, providers 120, tools 74, i18n 57, db 44, geo 31, scripts 31.
  - Entegrasyon testleri: db 82, api 26, worker 12.
  - Migration yükseltme 5 → 6; `compose:guard` 8 servis, 64 anahtar.
  - E2E 101/101.
- `pnpm stats` → 526 dosya, 88.430 satır (80.437 kod).

## M6e — Hava durumu: pencere ortalı, rüzgâr km/sa ve kt, kuvvetli rüzgâr, kümülonimbüs ve yıldırım uyarısı
Onay: 2026-10-03 (kullanıcı istekleri, üretimdeki Gazipaşa ve İstanbul pencerelerinin ekran görüntüleriyle; küçük sürüm, D-082)

Hedef sürüm 0.13.0. Kararlar D-083'tedir.

**Kapsam:**
- Haritadaki havalimanı penceresinde bütün yazılar ortalı.
- Rüzgâr hızı km/sa'nın yanında knot olarak da yazılır ("Kuzeyden 46 km/sa (25 kt)"); pencerede, sayfada ve tahminlerde.
- Etkili rüzgâr her havalimanında belirtilir: rüzgâr satırı eşiği geçince vurgulanır ve şiddeti adıyla yazılır.
- Kümülonimbüs bulutu ya da gök gürültüsü varsa şimşek ve yıldırım riski açıkça yazılır (yağmursuz durum araştırmayla belirlenir).
- **Araştırma sonucu (D-083):** yağmur yokken de yıldırım riski vardır (yağışsız oraj METAR'da tek başına `TS`; yıldırım çoğu zaman yağmurun dışına, 16–24 km'ye kadar düşer). Havalimanında TS → "şimşek ve yıldırım tehlikesi" (yağışlı ya da yağışsız), VCTS → "yıldırım havalimanına da düşebilir", CB ve havalimanında yağış → "şimşek ve yıldırım tehlikesi" (kullanıcının sözü, ikinci kontrol turunda düzeltildi), yağışsız CB → "şimşek ve yıldırım olabilir"; TCU ve yalnız son saatteki oraj için iddia yok; TAF ve eğilime ek cümle yok.
- **Rüzgâr şiddeti (D-083):** eşik MGM meydan uyarısı (ortalama ≥ 20 kt ya da hamle ≥ 30 kt) değişmez; şiddetin adı MGM Beaufort ıskalasından (Kuvvetli rüzgâr, Fırtınamsı rüzgâr, Fırtına … Harikeyn (orkan)), hamle Met Office karşılıklarıyla; yalnız hamle eşiği aşılınca "Kuvvetli hamle". Satır kehribar, şiddet etiketle; TAF öğesi şiddetin adıyla başlar.
- **Kapsam dışı:** pist yan rüzgâr bileşeni; yurt dışında yerel saat ve UTC farkı (M6f).

**Dizinler ve dosyalar:**
- **`packages/shared/src/weather/`:** `schema.ts` (`WIND_LEVELS`, `LIGHTNING_RISKS`; `Wind.speedKmh`/`gustKmh` isteğe bağlı), `groups.ts` (km/sa raporun biriminden), `derive.ts` (`windLevel`; `isStrongWind` = düzey var), `summary.ts` (`windLevel`, `lightning`, gök gürültüsü satırı, hız ölçüsünde km/sa, TAF öğesinde şiddet adı, birleşen dilimde hamlenin km/sa'sı), `phrase.ts` (`weather.wind.level.*`, `weather.thunder.*`, `weather.taf.strongWind` = level + wind; `weather.value.noneWithCb` kalktı), `index.ts`; testler `derive.test.ts`, `metar.test.ts`, `summary.test.ts`, `test/fake-text.ts`
- **`packages/i18n/src/`:** `messages/tr.ts`, `messages/en.ts` (`weather.thunder.*`, `weather.wind.level.*`, "{speed} ve üzeri", "{level}, {wind}"; `weather.value.noneWithCb` ve `weather.wind.strong` kalktı), `weather.ts` (`formatWindSpeedDual`; `formatWindSpeed` ve `formatWindSpeedBoth` raporun km/sa'sını alır), `weather.test.ts`
- **`apps/web/src/components/`:** `airports/weather-rows.ts` (rüzgâr ve gök gürültüsü vurgusu, şiddet etiketi), `airports/weather-rows.css` (kehribar rüzgâr, vurgulu satırda beyaz etiket, `wx-rows--center`), `airports/weather-row-list.tsx`, `airports/weather-expert.ts` (uzmanda raporun km/sa'sı), `map/airport-popup.tsx` ve `map/airport-popup.css` (bütün yazılar ortalı); testler `airports/airport-weather.test.ts`, `map/airport-popup.test.ts`, `map/airport-popup-model.test.ts`
- **`e2e/tests/weather.spec.ts`:** km/sa ve kt, rüzgâr ve gök gürültüsü vurgusu ve metni, LTAI ve LTAU'da yıldırım uyarısı (TR/EN), pencerede ortalı yazılar (1280, 430, 375, 320 px), "Kuvvetli hamle" etiketi (412, 430, 560 px). Fixture değişmedi (LTFM CB ve hamle, LTAI havalimanında oraj, LTAU çevrede oraj, LGTS kuvvetli rüzgâr, UGTB MPS zaten vardı).
- **Belgeler:** D-083; D-078 (madde 7, kelime seçimleri, TAF örneği) ve D-081 (ayraç örneği, vurgu kuralı) güncellendi. `docs/spec/domain.md` hava durumu sunum kuralı taşımadığı için değişmedi.

**Kabul komutları:**
- `pnpm --filter @havayolu/shared test` → `windLevel` sınırları (19/20/27/28/33/34 kt, 19G29/19G30, 25G42/25G43, 10G52, 40G61, 50G69, 64 kt, P99, 20GP99, 11/10 MPS, sakin ve bilinmeyen), km/sa raporun biriminden (11 MPS = 40 km/sa); 20 gerçek biçimli METAR'da rüzgâr satırı, şiddet, gök gürültüsü satırı ve `lightning` (Gazipaşa `-TSRA` → `here`, İstanbul `04026KT … SCT030CB` → `strong` ve `cloud`, `TS` → `hereDry`, `VCSH TS` → `hereDry`, `VCTS` → `vicinity`, `RETSRA` → yok, CB + `RETSRA` → `cloud`, TCU → yok, NIL, belirlenemeyen + CB → `cloudUndetermined`); TAF öğesinde şiddet adı (kuvvetli rüzgâr, fırtınamsı rüzgâr, fırtına, kuvvetli hamle) ve MPS hamlesinin km/sa'sı. Kontrol turu: 26 METAR (belirlenemeyen raporda oraj `AUTO … TS //`, görüşü eksik `TS`, `TS XXRA` → `here` ve başlık `weather.wx.VCTS`; `P49MPS` ve `GP49MPS` → "ve üzeri", `33090GP99KT` yalnız hamlede); `offScaleWind`; TAF'ta sonra gelen daha güçlü rüzgâr seçilir (temel 20 kt + TEMPO 45G65 → tam fırtına; iki TEMPO 15G30 ve 50G70 → çok şiddetli fırtına; hava olayıyla PROB 40G55 → kuvvetli fırtına ikinci satırda; eşit şiddette en erken)
- `pnpm --filter @havayolu/i18n test` → yeni anahtarlar iki dilde aynı yer tutucularla; "33 km/sa (18 kt)", "40 km/sa (21 kt)" (MPS), "185 km/sa (100 kt) ve üzeri"; iki ekran görüntüsünün metinleri TR/EN; uyarılarda "güvenli" ya da "risk yok" yok, TS için "fırtına" yok; sayıdan önce "·" ya da "–" yok. Kontrol turu: hızda bölünmez boşluk ("48 km/sa (26 kt)" U+00A0 ile); "Batıdan 180 km/sa (97 kt) ve üzeri" (P49MPS); belirlenemeyen raporda başlık "Gök gürültüsü", satır "tehlikesi", "yağış yok" yok; TAF'ta "18:00 ile 21:00 arası ara ara tam fırtına …"
- `pnpm --filter @havayolu/web test` → sayfa ve pencerede rüzgâr satırı `data-tone="wind"` ve "Kuvvetli hamle"; CB ve yağışta (fixture IST) gök gürültüsü satırı `data-tone="thunder"` ve "Kümülonimbüs (oraj bulutu) ve yağış var; şimşek ve yıldırım tehlikesi" (ilk uygulamada "Yok; … olabilir"); LTAU "düşebilir", LTAI ve LTBS "tehlikesi"; LGTS "Kuvvetli rüzgâr"; pencerede `wx-rows--center`; METAR/TAF kaydı özetinde kt. Kontrol turu: pencere ve sayfa HTML'inde hız bölünmez boşlukla; ölçek üstü rüzgâr (P49MPS, GP49MPS, P99KT, GP99KT) sade ve uzman görünümde aynı
- `pnpm --filter @havayolu/api test` → OpenAPI şeması (yeni isteğe bağlı alanlarla) Ajv ile derlenir, fixture yanıtları doğrulanır
- `pnpm test:e2e` → `weather.spec.ts`: sayfa ve pencerede km/sa ve kt, rüzgâr vurgusu ve şiddet etiketi, CB uyarısı; `/istasyon/LTAI` ve `/en/istasyon/LTAI`'de tehlike, LTAU'da "düşebilir"; pencerede başlık, bilgiler, hava başlığı, satırlar, gözlem satırı ve bağlantı ortalı (1280, 430, 375, 320 px), pencere genişliği 320 px, yatay taşma yok; 412, 430 ve 560 px'te etiket değerin kutusunda. Kontrol turu: hava başlığı satır satır ölçülür (öğeler bitişik ve satır eksende; eski `space-between` dört genişlikte kırmızı), rüzgâr hızı tek satırda (`Range.getClientRects`; bölünmez boşluk olmadan kırmızı), `speedDual` U+00A0 ister
- `pnpm ci:full` yeşil; PR'da CI (`e2e` dahil) yeşil

**Çıktı kaydı (2026-10-03, uygulama; sürüm, changelog ve README yayın adımındadır):**
- **Yöntem:** araştırma (MGM, WMO, NWS/NOAA, FAA, Met Office; aviationweather.gov veri API'sine istek atılmadı) ve tek ajanla uygulama. Tarayıcıda (`pnpm dev:replay`, 1280 ve ~490 px) IST penceresi, `/istasyon/LTAI` ve `/en/istasyon/LGTS` denetlendi.
- **`pnpm ci:full` → yeşil:**
  - Birim testleri: web 616, shared 455 (+52), api 251, worker 200, providers 120, i18n 75 (+18), tools 74, db 44, geo 31, scripts 31.
  - Entegrasyon testleri: db 82, api 26, worker 12.
  - Migration yükseltme 6 → 6 (yeni migration yok); `compose:guard` 8 servis, 64 anahtar.
  - E2E 106/106 (+5: LTAI/LTAU yıldırım uyarısı TR ve EN, pencere 375, 320 ve 430 px). İlk koşuda dar ekran satır testi bir kez sıfır genişlik okudu (etiket hidrasyondan önce DOM'da değiştiriliyordu); test adanın hidrasyonunu bekler, ardından blok 8 kez tekrarla 48/48 ve `ci:full` yeniden yeşil.
- **Kontrol turu (2026-10-03, doğrulanmış 5 bulgu; ayrıntı D-083):**
  - Belirlenemeyen raporda oraj (`AUTO … TS //`, görüşü eksik rapor, çözülemeyen parça): gök gürültüsü satırı `here` ("… tehlikesi", "yağış yok" demez), hava başlığı "Gök gürültüsü" (`weather.wx.VCTS`); yağmur satırı "Belirlenemedi".
  - TAF özeti birden çok kuvvetli rüzgârdan şiddeti en büyük olanı yazar (eşitse en erken, sonra en kesin); sonra gelen TEMPO/PROB fırtınası artık görünür.
  - Ölçek üstü rüzgâr `offScaleWind` ile (sade ve uzman görünüm aynı): `P49MPS` "Batıdan 180 km/sa (97 kt) ve üzeri".
  - Rüzgâr hızında bölünmez boşluk (U+00A0): "48 km/sa (26 kt)" pencerenin dar değer sütununda iki satıra bölünmez.
  - e2e pencere ölçümü: hava başlığı satır satır ölçülür (öğeler bitişik, satır eksende), rüzgâr hızı tek satırda.
  - Her yeni test düzeltme geri alınınca kırmızı (denendi): `lightningRisk` 4, başlık 1, TAF seçimi 1, ölçek üstü 2 birim testi; bölünmez boşluk i18n testi ve e2e (dört genişlikte "33 km/sa (18 kt)" 2 satır); `justify-content: space-between` e2e'de dört genişlikte (öğeler arası 89–199 px).
  - **`pnpm ci:full` → yeşil:** birim testleri web 620 (+4), shared 465 (+10), api 251, worker 200, providers 120, i18n 80 (+5), tools 74, db 44, geo 31, scripts 31; entegrasyon db 82, api 26, worker 12; migration yükseltme 6 → 6; `compose:guard` 8 servis, 64 anahtar; E2E 106/106 (test sayısı aynı, pencere testleri sıkılaştı).
- **İkinci kontrol turu (2026-10-03, 3 düzeltme; ayrıntı D-083):**
  - **Kümülonimbüs ve yağış (kullanıcının sözü):** "kümülonimbüs bulut aktivitesi varsa yağmurla beraber, şimşek ve yıldırım tehlikesi olduğunu belirt". Yeni `LIGHTNING_RISKS` değeri `cloudPrecip`: TS ve VCTS yok, CB var, havalimanında yağış grubu var → "Kümülonimbüs (oraj bulutu) ve yağış var; şimşek ve yıldırım tehlikesi" / "Cumulonimbus (thunderstorm cloud) and precipitation present; lightning danger", kehribar. Fixture IST (`-SHRA FEW025CB`) artık bunu yazar (önce "Yok; … olabilir"). Yağışsız CB `cloud`, tanınan yağışsız belirlenemeyen rapor `cloudUndetermined` kalır. API ve OpenAPI özeti taşımaz; değişmedi.
  - **Başlıkta çelişki:** `TS RA`, `TS -SHRA`, `TS GS` (oraj ve yağış ayrı gruplarda) başlığı "Gök gürültüsü ve şimşek, yağış yok" yerine "Gök gürültüsü" (`weather.wx.VCTS`); yağmur ve dolu satırı yağışı yazmaya devam eder.
  - **Pist uzunluğu kırılması:** penceredeki rakım ve en uzun pist sayı ile birim arasında U+00A0 ile (`formatAltitude(…, { nowrap: true })`, `NBSP` units.ts'te, rüzgâr hızıyla ortak). Yeni e2e: LTAI penceresi 1280 px'te ortalı ve "3.400 m" tek satırda; `expectPopupCentred` rakım ve pist uzunluğunun her "sayı birim" parçasını ölçer (U+00A0 ve tek satır).
  - Her yeni test düzeltme geri alınınca kırmızı (denendi): `cloudPrecip` olmadan shared 4 birim testi; başlık kuralı olmadan shared 1; bölünmez boşluk olmadan e2e 4/4 pencere testi (IST 1280, 375, 320, 430 px) ve yalnız yerleşim ölçümüyle LTAI'de "3.400 m" 2 satır. i18n ve web birim testleri yeni metni ve U+00A0'ı ister.
  - **`pnpm ci:full` → yeşil:** birim testleri web 620, shared 470 (+5), api 251, worker 200, providers 120, i18n 83 (+3), tools 74, db 44, geo 31, scripts 31; entegrasyon db 82, api 26, worker 12; migration yükseltme 6 → 6; `compose:guard` 8 servis, 64 anahtar; E2E 107/107 (+1: LTAI penceresi), kararsız test yok.
- `pnpm stats` → 526 dosya, 90.247 satır (82.085 kod).
- **Yayından sonra:** üretimde IST penceresi (ortalı yazılar, km/sa ve kt, rüzgâr ve yıldırım vurgusu) tarayıcıda görülür; sonra satır `[x]` olur. **2026-10-03 doğrulandı (v0.13.0):** "Kuzeydoğudan 37 km/sa (20 kt)", kehribar "Kuvvetli rüzgâr". Kullanıcı ortalı düzeni yamuk buldu; hizalı tablo M6e.1'de (v0.13.1).

## M6e.1 — Pencere hizası (v0.13.1)
Onay: 2026-10-03 (kullanıcı geri bildirimi, üretimdeki İstanbul penceresinin ekran görüntüsüyle: "ortala yapınca olmadı yamuk yumuk oldu. hepsi hizalı olsun"; yama sürümü, D-082)

Hedef sürüm 0.13.1. Karar D-083'teki "2026-10-03 kullanıcı geri bildirimi" maddesidir; M6e'nin ortalı düzeninin yerine geçer.

**Kapsam:**
- Pencere tek hizalı tablodur: bütün yazılar sola yaslı ve aynı sol kenardan başlar (kodlar, ad, yer; kapat düğmesi sağda; "Hava durumu", hava başlığı ve sıcaklık kutucuğu, gözlem satırı, bağlantı).
- Bilgi satırları (rakım, pistler, yerel saat) ve hava durumu satırları aynı sütunlarda: simge, etiket ve değer her satırda aynı x'te (sabit etiket sütunu, 8rem).
- Bilgi satırlarına hava simgeleriyle aynı biçimde kendi simgeleri: rakım (dağ), pistler (pist şeridi), yerel saat (kadran).
- **Değişmeyenler:** pencere genişliği, odak, aria, kapat düğmesi, alt sayfa, bölünmez boşluklar, havalimanı sayfasının hava durumu bölümü.

**Dosyalar:**
- `apps/web/src/components/map/airport-popup.css`, `airport-popup.tsx`, `airport-popup-model.ts` (bilgi satırları `WeatherRow`), `airport-popup.test.ts`
- `apps/web/src/components/airports/weather-rows.css` (`wx-rows--center` yerine `wx-rows--popup`), `weather-row-list.tsx`, `weather-icon.tsx` (3 simge)
- `e2e/tests/weather.spec.ts` (`expectPopupCentred` yerine `expectPopupAligned`; IST ve LTAI, TR ve EN, 1280, 768, 430, 375 ve 320 px; kırılan etiket)
- `docs/DECISIONS.md` (D-083 alt maddesi)

**Kabul komutları:**
- `pnpm --filter @havayolu/web test` → iki liste `wx-rows--popup`, `wx-rows--center` yok; bilgi satırları sırası, simgeleri ve U+00A0'lı değerleri; her `<dt>` simge yuvasıyla başlar
- `pnpm test:e2e` → `weather.spec.ts`: IST ve LTAI pencerelerinde TR ve EN, 1280, 768, 430, 375 ve 320 px'te simge, etiket ve değer x'i her satırda eşit (±1 px), simge etiketin ilk satırının ortasında ve etiket ile değer aynı yükseklikte (kırılan "Diğer hava olayları" etiketinde de), başlık ve diğer yazılar simge sütununda, kapat düğmesi sağda, satır kutuları aynı kenarda, hız ve uzunluklar tek satırda, yatay taşma yok
- `pnpm ci:full` yeşil; PR'da CI (`e2e` dahil) yeşil

**Çıktı kaydı (2026-10-03, uygulama; sürüm, changelog ve README yayın adımındadır):**
- Tarayıcıda (`pnpm dev:replay`, başsız Chromium) IST ve LTAI pencereleri TR ve EN, 1280, 430, 375 ve 320 px'te ölçüldü: simge, etiket yazısı ve değer yazısı her satırda aynı x'te (simge içerik kenarında, etiket +24 px, değer +134 px), başlık ve diğer yazılar simge sütununda, yatay taşma yok.
- e2e: `expectPopupCentred` yerine `expectPopupAligned`; LTAI 1280 px testi ve dar ekran döngüsü (375, 320, 430) havalimanı ve dil başına tek testte toplandı (sayfa bir kez yüklenir, genişlik pencere açıkken değişir; WebSocket el sıkışma sınırı, D-083). Ölçüm M6e'nin ortalı CSS'iyle 4/4 kırmızı (denendi).
- **`pnpm ci:full` → yeşil:** birim testleri web 621 (+1), shared 470, api 251, worker 200, providers 120, i18n 83, tools 74, db 44, geo 31, scripts 31; entegrasyon db 82, api 26, worker 12; migration yükseltme 6 → 6; `compose:guard` 8 servis, 64 anahtar; E2E 107/107 (sayı aynı: 4 test kalktı, 4 test geldi).
- **Kontrol turu (2026-10-03):** 30 durumda (IST, AYT, ATH × TR, EN × 1280, 768, 430, 375, 320 px) hiza yeşil. Düzeltilen: iki satıra kırılan etiketin (TR "Diğer hava olayları") simgesi iki satırın ortasındaydı → `wx-rows--popup` satırında `<dt>` `align-items: flex-start`, simge ilk satırın yüksekliğinde ortalanır (`1lh`); tarayıcıda simgenin ortası ilk satırın ortasından 0,8 px (önce 9,5 px). e2e: `expectPopupAligned` dikeyi (simge ↔ etiketin ilk satırı ±2 px, etiket ↔ değer ±1 px) ve kapat düğmesini ölçer; testler sonda "Diğer hava olayları" satırını ekleyip 320 ve 1280 px'te ölçer (TR iki satır, EN tek satır); genişlik döngüsüne 768 px eklendi. Düzeltmesiz CSS'te 2 TR testi kırmızı (`other: simge etiketin ilk satırının ortasında`, 9,55 px; denendi), EN testleri yeşil (etiket kırılmıyor). `formatElevation` yorumunda değer sütunu ~160 px. LGAV e2e'ye eklenmedi (her test bir WebSocket el sıkışması; `WS_RATE_LIMIT`), kontrol turunda elle ölçüldü.
- **`pnpm ci:full` → yeşil (kontrol turundan sonra):** birim testleri web 621, shared 470, api 251, worker 200, providers 120, i18n 83, tools 74, db 44, geo 31, scripts 31 (turbo 31/31); entegrasyon db 82, api 26, worker 12; migration yükseltme 6 → 6; `compose:guard` 8 servis, 64 anahtar; E2E 107/107 (1,9 dk).
- `pnpm stats` → 526 dosya, 90.568 satır (82.346 kod).

## M6f — Adlar ve saat: askerî ve sivil havalimanı adları TR/EN, haritada havalimanı adı etiketi, yurt dışında yerel saat ve UTC farkı
Onay: 2026-10-03 (kullanıcı istekleri ve aynı gün verilen kararlar: Ankara (Etimesgut) adı, etiket varsayılanı "Kod", Sohum'da Moskova saati; küçük sürüm, D-082)

Hedef sürüm 0.14.0. Kararlar D-084'tedir. Yarıda kesilen bir koşunun ara commit'inden (70a23a9, "save partial M6f work") sürdürüldü; bitmiş parçalar yeniden yazılmadı, gözden geçirilip tamamlandı.

**Kapsam:**
- **Adlar (istek 1):** "askerî havalimanları ve normal havalimanları türkçe ingilizce dil desteğine uygun olsun. hata var ise düzelt": Türkçe sayfalarda İngilizce OurAirports adıyla görünen LTAD, LTAG, LTAH, LTBG, LTBI ve LTBL (yabancı sayfaların "Türkiye'deki en yakın havalimanı" satırı dahil) iki dilde düzeltilir. LTAD "Ankara (Etimesgut) Havalimanı" / "Ankara (Etimesgut) Airport" (bakanlığın verdiği ad, kullanıcı kararı); beş askerî alan "<yer> Hava Üssü" / "<place> Air Base" (İncirlik EN "Incirlik"). Bütün yüzeyler aynı ad işlevinden okur: liste, sayfa (başlık, içerik yolu, `<title>`, ad kaynağı satırı), pencere, "Havalimanları" listesi, paylaşım görseli, JSON-LD, llms.txt, il cümlesi, yakın havalimanları ve en yakın Türkiye havalimanı satırı. Beş üs `noindex, follow` kalır; LTAD dizine girer. Yurt dışında Türkçe yazımlar: Gebele, Şehit Eşrefi İsfahani, Serdar Cengel.
- **Harita etiketi (istek 2):** "havalimanı isimleri de açılır kapanabilir olsun. etiketleri güncelle": "Etiketler" panelinde havalimanları için Gizle / Kod / Kod ve ad (EN Hide / Code / With name; varsayılan Kod, kullanıcı kararı). Kısa ad en çok 16 karakter, yalnız z ≥ 7'de; yer yoksa kod yalnız kalır, ad pin, kod, uçak simgesi ve iz örtmez. Gizle yalnız yazıyı kaldırır, pin görünür ve tıklanır. Ayar `hy:map:labels` kaydında; eski kayıt geçerli. Panel alçak ekranda kayar.
- **Yerel saat (istek 3):** "türkiye dışındaki havalimanlarının da utc olarak yerel saatlerini bulabilir miyiz? bulabilirsek onları da ekle": evet. Saat dilimi IANA tz veritabanından (kamu malı; ülke → dilim tablosu ve 1.–2. halka kuralları, poligon ve ODbL verisi yok, yeni bağımlılık yok). Pencerede her havalimanında "Yerel saat 23:05 (UTC+2)" (Türkiye'de "(UTC+3)"), gözlem saati yerel. Yabancı havalimanı sayfasında yerel saat ve UTC farkı, gün doğumu ve batımı geri gelir; gözlem, tahmin, TAF ve kayıt saatleri havalimanının yerel saatidir. Dilimi bilinmeyen havalimanında bugünkü davranış (UTC ya da "Türkiye saati" etiketi) sürer. Türkiye sayfaları değişmez.

**Dizinler ve dosyalar — adlar ve harita etiketi:**
- **`packages/shared/src/reference/`:** `airport-names.ts` (`ministry` ve `military` kaynakları, `official` alanı, `airportOfficialName`; tabloda `ourairports` kaydı kalmadı), `foreign-airport-names.ts` (Gebele, Şehit Eşrefi İsfahani, Serdar Cengel), `airport-map-names.ts` (`AIRPORT_MAP_NAMES`, `airportMapName`, `AIRPORT_MAP_NAME_MAX_LENGTH` 16), `index.ts`; testler `names.test.ts`, `reference.test.ts`
- **`packages/i18n/src/messages/`:** `tr.ts`, `en.ts` (`airport.nameSource.ministry` ve `military`, `airports.names`, `about.sources.names`, `map.labels.airports` ve `airportModes`, `map.labels.hint`)
- **`apps/web/src/`:** `lib/airports.ts` (`isIndexable`: `dhmi`, `operator`, `ministry`), `components/airports/airport-view.tsx` (ad kaynağı satırında resmî ad), `lib/map/label-settings.ts` (`airports` alanı, `copyLabelSettings`, `sameLabelSettings`), `components/map/use-label-settings.ts`, `components/map/map-controller.ts` (`sameViewState` bütün alanlar, ad yazı tipinin Türkçe alt kümesi), `components/map/labels.ts` (`nameOf`, `showsAirportChips`, `showsAirportNames`, `AIRPORT_NAME_MIN_ZOOM` 7), `components/map/panels/label-settings-control.tsx` (`LabelSettingsPanel`, `ModeGroup`), `app/globals.css` (panelde kaydırma; yükseklik `.live-map` kapsayıcı sorgusuyla haritadan, `--map-panel-top` telefonda arama kutusunun altı, `--map-controls-bottom`; açık panelin denetimleri aramanın üstünde; seçenek yazısı ortalı); testler `lib/airports.test.ts`, `lib/map/label-settings.test.ts`, `components/map/labels.test.ts`, `components/map/map-controller.test.ts`, `components/map/panels/panels.test.ts`, `components/airports/airport-view.test.ts`, `app/og/site/route.test.ts`
- **`e2e/`:** `label-canvas.ts` (etiket tuvalindeki havalimanı kutuları), `tests/live-map.spec.ts` (havalimanı etiketi), `tests/airports.spec.ts` (altı alanın adları, Atina'nın en yakını), `support.ts` (dizine eklenen 56), `tests/seo.spec.ts` (metinler)
- **Belgeler:** D-084 "Adlar" ve "Harita etiketi" maddeleri; `docs/spec/domain.md` (Harita etiketleri); `docs/REFERENCES.md` (bakanlık ve üs kaynakları); `ATTRIBUTION.md`

**Kabul komutları — adlar ve harita etiketi:**
- `pnpm --filter @havayolu/shared test` → `names.test.ts`: 61 + 5 + 75 havalimanının Türkçe adında İngilizce cins adı (Air Base, Airbase, Airport, International, National, Airfield, Heliport, Island), İngilizce adında Türkçe cins adı (Havalimanı, Havaalanı, Hava Üssü, Uluslararası, Ulusal) yok; hiçbir Türkiye havalimanı OurAirports adıyla görünmez; kısa ad listelenen her havalimanında iki dilde ≤ 16 karakter, büyük harfle başlar, dile uygun ve tekil; Türkiye'de görünen addaki yer adıdır. `reference.test.ts`: kaynak dağılımı 50 DHMİ, 5 işletmeci, 1 bakanlık, 5 askerî; altı alanın TR/EN adları; `airportOfficialName`
- `pnpm --filter @havayolu/i18n test` → yeni anahtarlar iki dilde aynı yer tutucularla
- `pnpm --filter @havayolu/web test` → `isIndexable`: gizli 5 üs, LTAD dizinde, 56 sayfa, tabloda olmayan Türkiye havalimanı (LTZZ) yalnız tarifeli ya da istasyonsa dizinde; sayfada altı alanın başlığı ve içerik yolu iki dilde, `lang` ile işaretli ögeler dışında öbür dilin cins adı yok, OurAirports adı `lang="en"` satırında; LTAD resmî ad satırı; Atina'nın en yakını "Çiğli Hava Üssü (IGL)" / "Çiğli Air Base (IGL)"; etiket ayarı kaydı (eski kayıt, geçersiz değer, yalnız bilinen alanlar), `sameViewState` havalimanı alanıyla; yerleşim: adlı kutu, sola geçme, sığmazsa kod, Kod ve ad hiçbir kodu kaybettirmez ve kutular çakışmaz, birincil istasyonda ad yerdeki uçakları örtmez (kod kısmı örtebilir, D-079); çizim: Gizle yazı ve kod tıklaması yok, Kod yalnız "IST", Kod ve ad z ≥ 7'de "IST" + "İstanbul"/"Istanbul" ve adın üstü tıklanır, z < 7 yalnız kod; panelde üç grup, ayrı radyo adları, TR/EN metinleri
- `pnpm test:e2e` → `live-map.spec.ts`: varsayılan Kod ve IST kodu tıklanır; Kod ve ad klavyeyle (ok tuşu) seçilir, kayıt `{selected, others, airports: 'name'}`, z10'da IST kutusu genişler ve adın üstü pencereyi açar; yenilemede ayar geri gelir; Gizle (diğer uçaklar da gizli) tuvalde hiçbir piksel bırakmaz, pin pencereyi açar; 375×560, 320×480 ve 812×340'ta açık Etiketler ve Havalimanları panelinin üstü haritanın içinde ve arama kutusunun altında, başlığı, grup adları ve her seçeneği tıklama noktasında kendisi. `airports.spec.ts`: altı alanın `/istasyon/<ICAO>` ve `/en/…` başlığı ve `<title>`'ı, sayfanın kendi dilindeki metinde öbür dilin cins adı yok; `/istasyon/LGAV` ve `/en/istasyon/LGAV`'de en yakın Türkiye havalimanı bağlantısı Çiğli. `seo.spec.ts`: site haritası 56 + 75 havalimanı, LTAG `noindex, follow`
- `pnpm ci:full` yeşil; PR'da CI (`e2e` dahil) yeşil

**Dizinler ve dosyalar — yerel saat:**
- **`packages/shared/src/reference/`:** `time-zones.ts` (`COUNTRY_TIME_ZONES`: tzdb `zone.tab`'ın 216 tek dilimli ülkesi ve XK; `REGION_TIME_ZONES`: Rusya'nın Kuzey Kafkasya, Krasnodar, Rostov, Kalmukya → Moskova, Volgograd, Astrahan, Kazakistan Mangistav; `AIRPORT_TIME_ZONES`: LCEN, LCLK, LCPH, UGSS; `airportTimeZone`, `isSupportedTimeZone`), `index.ts`; test `time-zones.test.ts`. Uzak halkalar (5. halka dahil) yalnız bölge ve havalimanı kuralı ekler.
- **`packages/i18n/src/`:** `weather.ts` (`WeatherTextOptions.timeZone`; `formatClock`, `formatUtcOffset`, `formatDayMonth`, `formatDayTime`, `formatMeasure`, `weatherText` dilim alır, varsayılan Europe/Istanbul), `messages/tr.ts` ve `messages/en.ts` (`map.airportPopup.localTimeValue`, `weather.log.introLocal`), `weather.test.ts`
- **`apps/web/src/components/`:** `map/airport-popup-model.ts` (`popupTimeZone` = `airportTimeZone`, `formatLocalTime`), `map/airport-popup.tsx`, `airports/airport-weather.tsx`, `airports/airport-weather-live.tsx` (tarayıcının tanımadığı dilimde Türkiye saatine düşer), `airports/weather-panel.tsx`, `airports/weather-expert.ts`, `airports/weather-log.tsx` (`abroad` yerine `timeZone: string | null`); testler `map/airport-popup-model.test.ts`, `map/airport-popup.test.ts`, `airports/airport-weather.test.ts`
- **`e2e/tests/`:** `foreign-airports.spec.ts` (LGAV penceresi ve sayfası: Atina'nın saati UTC farkıyla, beklenen değer Node `Intl`'iyle o an için hesaplanır; gün doğumu, gün batımı, kaydın girişi), `weather.spec.ts` (LTFM sayfası ve penceresi "(UTC+3)")
- **Belgeler:** D-084 "Yerel saat" maddesi; D-080'in iki saat dilimi maddesi ve D-078'in gün doğumu maddesi D-084'e bağlandı; `docs/spec/domain.md` (Birimler ve zaman: yerel saat havalimanının kendi dilimi, dilimi bilinmeyende UTC ya da etiketli Türkiye saati); `docs/spec/data-sources.md` §5a (tzdb, 7 alanlı lisans kaydı); `docs/REFERENCES.md`; `ATTRIBUTION.md`

**Kabul komutları — yerel saat:**
- `pnpm --filter @havayolu/shared test` → `time-zones.test.ts`: her dilim `Intl.supportedValuesOf('timeZone')`'da; ülke tablosu `Intl.Locale#getTimeZones()` ile birebir (XK boş liste); bölge kuralları yalnız çok dilimli ülkelerde ve o ülkenin dilimleriyle; 1. ve 2. halkanın 164 havalimanı araştırmanın beklenen diliminde (2. halka scratch listesinden, Sohum Moskova, Volgograd kendi dilimi); kural sırası; kuralı olmayan çok dilimli ülke, bilinmeyen kod ve prototip anahtarı null; Atina 25 Ekim 2026 01:00 UTC'de UTC+3 → UTC+2, Tahran UTC+3:30, Astrahan UTC+4, Aktav UTC+5, Kahire 29 Ekim'e kadar UTC+3; fixture'daki Türkiye havalimanları Europe/Istanbul ve açık halkadaki her yabancı havalimanı beklenen dilimde
- `pnpm --filter @havayolu/i18n test` → Atina "23:05" ile "UTC+3"/"UTC+2", Tahran "UTC+3:30", New York "UTC−5" (U+2212), Londra "UTC"; "yarın" havalimanının takvimine göre; TAF geçerlilik sonu dilimde
- `pnpm --filter @havayolu/web test` → pencere: IST "16:00 (UTC+3)", ATH yazın "16:00 (UTC+3)" ve kışın "23:05 (UTC+2)", Tahran "16:30 (UTC+3:30)", Tiflis "(UTC+4)", Sohum ve Ercan "(UTC+3)"; gözlem yerel ("Gözlem 16:20"), ABD'de yerel saat satırı yok ve "12:50 UTC"; sayfa: LGAV'de "Yerel saat 15:00 (UTC+2)", gün doğumu 07:38, gün batımı 17:28, "Gözlem 14:50", "yarın 14:00", "Gözlem zamanı: 12:50 UTC (yerel saat 14:50)", kayıt girişi "şu an UTC+2"; dilimsiz yabancı havalimanında "Türkiye saati" etiketleri; tanınmayan dilimde ada Türkiye saatine düşer
- `pnpm test:e2e` → `foreign-airports.spec.ts`: `/?havalimani=LGAV` penceresinde (TR, EN) "Yerel saat" satırı Atina'nın o anki saati ve farkı ("HH:MM (UTC+2|3)"); `/istasyon/LGAV` ve `/en/istasyon/LGAV`'de yerel saat ve farkı, gün doğumu, gün batımı, kaydın girişi yerel saatle, "Türkiye saati" yok; `weather.spec.ts`: `/istasyon/LTFM` ve pencere "(UTC+3)", değişmedi
- `pnpm ci:full` yeşil; PR'da CI (`e2e` dahil) yeşil

- **Kontrol (2026-10-03):** üç istek, kullanıcı kararları ve 4 doğrulanmış bulgu (IST ad kutusu yerdeki uçakları örtmez, küçük telefonda panel arama kutusunun altına girmez, D-084 dizin kuralı metni, domain.md yerel saat) tamam; 19 mutasyonun 17si birim testlerince, 1i e2e ile yakalandı, 1i (IST ad kutusunun yalnız kod kısmının uçak etiketlerini engellememesi) testsiz kaldı.
- **`pnpm ci:full` → yeşil:** birim testleri web 645, shared 494, api 251, worker 200, providers 120, i18n 85, tools 74, db 44, geo 31, scripts 31; entegrasyon db 82, api 26, worker 12; migration yükseltme 6 → 6; `compose:guard` 8 servis, 64 anahtar; E2E 110/110.
- `pnpm stats` → 531 dosya, 93.235 satır (84.877 kod).

## M6e.2 — Rüzgâr renkleri ve rüzgâr kesmesi (v0.14.1)
Onay: 2026-10-03 (kullanıcı isteği, üretimdeki Konya penceresinin ekran görüntüsüyle: "rüzgar 10km ve altında ise açık yeşil yap. üzerinde ise normal renginde olmaya devam etsin. rüzgarlı limanlar var ama renkli değil. hataları analiz et. sadece 1 liman üzerinden gitme"; eşik kararı: ortalama ≥ 17 kt ya da hamle ≥ 25 kt; yama sürümü, D-082)

Hedef sürüm 0.13.2. Karar D-083'teki "2026-10-03 kullanıcı kararı: rüzgâr renkleri ve rüzgâr kesmesi" maddesidir.

**Kapsam:**
- Analiz tek havalimanı değil, üretimde METAR'ı olan 122 istasyondur: meydan uyarısı kuralı (20/30 kt) doğru uygulanıyordu; 17–19 kt esen 10 ve hamlesi 25–26 kt olan 2 istasyon eşiğin altında kalıp sade görünüyordu; LGMK'nin `WS R34` grubu sade görünümde yoktu.
- Rüzgâr satırı ortalama ≥ 17 kt ya da hamle ≥ 25 kt'de kehribar, yanında şiddetin adı: "Sert rüzgâr" (17–19 kt), "Hamleli rüzgâr" (hamle 25–29 kt); güçlü düzeylerin adları değişmedi.
- Gösterilen hız ≤ 10 km/sa (sakin dahil) açık yeşil; değer hızı yazıyorsa "Hafif rüzgâr" etiketi ("Sakin", "Hafif ve değişken yönlü" değerlerinde etiket yok). Arası sade.
- Rüzgâr kesmesi (`WS R34`, `WS RWY34`, `WS ALL RWY`) rüzgâr satırında değerin altında: "Rüzgâr kesmesi bildirildi: pist 34"; satır kehribar (rüzgâr hafif olsa da). Uzman görünümü grubu zaten yazıyordu.
- Pencere ve havalimanı sayfası aynı bileşendir (`phenomenonRows`).
- **Kontrol turu düzeltmeleri (D-083 "Kontrol turu"):** (1) TAF özeti zayıflatan BECMG'de eski koşulu (kuvvetli rüzgâr, hava olayı) değişim penceresinin başında değil sonunda bitirir (WMO-782; M6c'den beri pencerenin başındaydı: üretimde LTCG ve LTFO "önemli hava olayı yok" diyordu); (2) uzman görünümünde tekrarlanan `WS` grubunun her satırı yalnız kendi pistini söyler; (3) D-083'teki fixture listesine LTBS eklendi.
- **Değişmeyenler:** MGM meydan uyarısı eşiği (`isStrongWind`, API'deki `derived.strongWind`, OpenAPI), TAF'ın rüzgâr öğesinin eşiği (20/30 kt), pencere düzeni ve hizası.

**Dosyalar:**
- `packages/shared/src/weather/schema.ts` (`WIND_LEVELS` başına `gusty`, `fresh`; `LIGHT_WINDS`), `derive.ts` (`FRESH_WIND_MEAN_KT`, `GUSTY_WIND_GUST_KT`, `LIGHT_WIND_MAX_KMH`, `lightWind`, `isLightAndVariable`; `isStrongWind` açık eşikle), `summary.ts` (`windLight`, `windShear`, `windShearText`; `strongWind` = `isStrongWind`; `Prevailing.until`, `mergePrevailing` örtüşen dilimler), `phrase.ts` (3 kesme anahtarı), `index.ts`; `derive.test.ts`, `summary.test.ts`
- `packages/i18n/src/messages/tr.ts`, `en.ts` (`weather.wind.level.gusty`, `fresh`, `weather.wind.light`, `shearAll`, `shearRunway`, `shearRunways`), `weather.test.ts`
- `apps/web/src/components/airports/weather-rows.ts` (`windRow`, ton `calm`, `note`), `weather-row-list.tsx` (`.wx-note`), `weather-rows.css` (açık yeşil token'ları, etiket rengi satırın rengi), `weather-expert.ts` (`WS` satırı kendi grubundan); `airport-weather.test.ts`, `weather-expert.test.ts`, `components/map/airport-popup.test.ts`
- `e2e/tests/weather.spec.ts` (LTAI kehribar "Hamleli rüzgâr", LTAJ açık yeşil; pencere hizasında LTAI'nin vurgulu satırlarına rüzgâr)
- `docs/DECISIONS.md` (D-083 alt maddesi), `docs/REFERENCES.md` (MGM IV.1.3.9.4, Beaufort ıskalası)

**Kabul komutları:**
- `pnpm --filter @havayolu/shared test` → düzeylerin ve hafif rüzgârın sınırları (16/17 kt, 24/25 kt hamle, 5/6 kt, MPS 2/3 m/s, KMH 10/11), 17 gerçek üretim METAR'ı, rüzgâr kesmesinin dört biçimi; zayıflatan BECMG (üretim LTCG ve LTFO TAF'ları, pencere içinde başlayan FM)
- `pnpm --filter @havayolu/i18n test` → iki dilde adlar, etiket ve kesme metinleri; sayıdan önce ayraç yok
- `pnpm --filter @havayolu/web test` → sayfada ve pencerede rüzgâr satırının tonu, etiketi ve kesme satırı; uzman görünümünde `WS R34` ve tekrarlanan grup (`WS R16 WS R34`); LTBS "Hamleli rüzgâr"
- `pnpm test:e2e` → `weather.spec.ts`: LTAI rüzgâr satırı kehribar ve "Hamleli rüzgâr"/"Gusty wind"; LTAJ açık yeşil (`rgb(220, 252, 231)` zemin, `rgb(22, 101, 52)` yazı) ve "Hafif rüzgâr"/"Light wind"; IST ve LTAI pencereleri tek hizalı
- `pnpm ci:full` yeşil; PR'da CI (`e2e` dahil) yeşil

**Çıktı kaydı (2026-10-03, uygulama; sürüm, changelog ve README yayın adımındadır):**
- Üretim anlık görüntüsü (122 istasyon) yeni kurallarla arayüzün `phenomenonRows`'undan geçirildi: 36 açık yeşil (31'i "Hafif rüzgâr" etiketli, 5'i "Hafif ve değişken yönlü"), 65 sade, 21 kehribar (9 meydan uyarısı düzeyi, 10 "Sert rüzgâr", 2 "Hamleli rüzgâr"; LGMK'de "Rüzgâr kesmesi bildirildi: pist 34"). Önce 9 kehribar, 0 yeşil.
- Renk karşıtlığı (betikle): `#166534` yazı `#DCFCE7` zeminde 6,49:1, beyaz etikette 7,13:1.
- Birim testleri: `pnpm --filter @havayolu/shared test` → 519 (+49), `@havayolu/i18n` → 91 (+8), `@havayolu/web` → 625 (+4); API ve worker hava testleri (`reference/weather.test.ts` 35, `jobs/weather.test.ts` 25) değişmeden yeşil.
- **Kontrol turu (2026-10-03):** TAF özeti üretim anlık görüntüsünde (TAF'ı olan 122 istasyon) eski ve yeni kodla karşılaştırıldı: 9'u değişti (LTCG ve LTFO "önemli hava olayı yok" yerine kuvvetli rüzgâr 20G30, UGTB'de eksik fırtına öğesi geldi; LTBJ, LTAY, LTFC, LTBA, LTFM, LTBU'da bitiş BECMG penceresinin sonuna kaydı), öteki 113 aynı. Fixture'da (13:00Z) 10 istasyonun 5'i değişti (LTCE, LTAI, LTAC, LTCG, LBSF). Fixture METAR'larının rüzgâr tonu eski ve yeni kuralla karşılaştırıldı: 20 istasyonun 8'i değişti, D-083 listesi tamdır (LTBS eklendi). Eski kodla yeni BECMG testleri ve güncellenen 3 beklenti (6 test) kırmızı, eski uzman koduyla tekrarlanan `WS` testi kırmızıdır (denendi).
- Kontrol turundan sonra: `pnpm --filter @havayolu/shared test` → 522 (+3), `@havayolu/i18n` → 91 (bir beklenti güncellendi), `@havayolu/web` → 626 (+1; LTBS bir teste eklendi); API `reference/weather.test.ts` 35, worker `jobs/weather.test.ts` 25 yeşil. `pnpm --filter` shared, i18n, web `typecheck` ve `lint`, `pnpm format`, `pnpm check:eol`, `pnpm changelog:check` (v0.13.1) → yeşil.
- `pnpm typecheck --force` (9/9), `pnpm lint --force` (9/9), `pnpm typecheck:e2e`, `pnpm lint:e2e`, `pnpm format`, `pnpm check:eol`, `pnpm changelog:check` (v0.13.1; sürüm yayın adımında) → yeşil.
- **Yayın adımı (2026-10-03):** dal v0.14.0 ile birleştirildi (plan çakışması iki bölüm korunarak çözüldü; testlerdeki eski `abroad` seçeneği M6f'nin `timeZone` seçeneğiyle değiştirildi). main CI'da bir kez kırmızı olan pencere hizası testi düzeltildi: 375 px'ten 320 px'e inince harita tuvalinin yeni genişliği beklenir (`expect.poll`).
- **`pnpm ci:full` → yeşil:** birim testleri web 650, shared 546, api 251, worker 200, providers 120, i18n 93, tools 74, db 44, geo 31, scripts 31; entegrasyon db 82, api 26, worker 12; migration yükseltme 6 → 6; `compose:guard`; E2E 110/110.
- `pnpm stats` → 531 dosya, 94.167 satır (85.714 kod).


## M6l — Logo (v0.15.0)
Onay: 2026-10-03 (kullanıcı seçimi: tasarım tuvalindeki "A · Halka"; B · Tırmanış, C · Rota ve A + B birleşik öneri reddedildi; küçük sürüm, D-082)

Hedef sürüm 0.15.0. Karar D-086'dadır.

**Kapsam:**
- Başlıktaki "◎" halka işaretinin yerine logo: halkanın içinden 45° ile sağ üste uçan, üstten görülen çift motorlu yolcu uçağı; burun, kanat uçları ve kuyruk halkayı keser. Şeritte beyaz (`currentColor`), yazının 1,5 katı (24 px), şerit uzamaz; işaret süstür (`aria-hidden`), bağlantının adı yalnızca yazı. Yazı marka değişmez (Overpass 800).
- Bütün yüzeyler tek geometri ve renk kaynağından çizer: başlık (site, yönetim, 404 ve hata sayfaları kök düzende), paylaşım görselleri (site ve havalimanı; açık zemin renkleri), uygulama simgeleri (192 ve 512 px köşeleri yuvarlatılmış; maskelenebilir simge `/icon/maskable` ve Apple 180 px tam kare), `favicon.ico` (16, 32, 48 px küçük işaret: turkuaz daire, beyaz uçak).
- **Değişmeyenler:** yazı marka ve boyutu, tema renkleri, manifest adı ve renkleri, paylaşım görsellerinin yazıları ve yazı tipleri.

**Dosyalar:**
- `apps/web/src/lib/brand/logo-geometry.ts` (uçak çizgisi, motorlar, halka, ölçekler, dönüşüm ve tersi), `lib/brand/logo-svg.tsx` (hook'suz SVG: `logoShapes`, `logoSvg`, `logoIconSvg`), `lib/seo/brand.ts` (`LOGO_COLORS`), `lib/seo/og.tsx` (`BrandMark`, `BrandIcon`), `lib/seo/og-site.tsx` ve `components/airports/airport-og.tsx` (işaret boyu)
- `apps/web/src/components/brand/brand-mark.tsx` (`useId` ile tekil maske), `components/brand/site-brand.tsx`, `app/layout.tsx`, `app/globals.css` (`.brand`, `.brand-mark`)
- `apps/web/src/app/icon.tsx` (`192`, `512`, `maskable`), `app/apple-icon.tsx`, `app/manifest.ts`, `app/favicon.ico` (`scripts/gen-favicon.mts` ile yeniden üretildi)
- Testler: `lib/brand/logo.test.ts`, `components/brand/brand.test.ts`, `app/app-icons.test.ts`, `lib/seo/test/png.ts` (test için PNG çözücü); `e2e/tests/airports.spec.ts` (başlıktaki logo)
- Belgeler: D-086; D-081 ve D-076'nın simge maddeleri D-086'ya bağlandı

**Kabul komutları:**
- `pnpm exec tsx scripts/gen-favicon.mts` → `favicon.ico` 16, 32, 48 px
- `pnpm --filter @havayolu/web test` → uçağın iki yolu tasarımdaki `planeTop` ile birebir; dönüşümler (0,98 ve 0,74, 45°), `toPlaneSpace` tersidir, burun sağ üstte; tam işarette burun, kanat uçları ve kuyruk halkanın dışında, küçük işarette uçak dairenin içinde, uygulama simgesinde işaret güvenli alanda; `LOGO_COLORS`; SVG: maske, halka, uçak sırası ve renkleri, küçük işaret maskesiz, simgede `rx="24"` ve `translate(12 12) scale(0.76)`; başlık bağlantısının erişilebilir adı yalnızca "havayolu" (bir kez), işaret `aria-hidden` ve `focusable="false"`, iki işaretin maske kimlikleri farklı ve her halka kendi maskesini kullanır; PNG pikselleri: 192/512 köşe saydam ve merkez beyaz, `maskable` köşeler dolu ve güvenli alanın dışı yalnızca zemin, Apple 180 tam kare, favicon köşe saydam, kenar turkuaz, merkez beyaz
- `pnpm test:e2e` → `airports.spec.ts`: başlıkta tek marka bağlantısı, adı "havayolu", işaret 24 × 24 px ve `aria-hidden`, halkanın maskesi belgede tek ve `<mask>`; `seo.spec.ts`: manifestteki üç simge (`/icon/maskable` dahil) ve `<link rel="icon">`'lar 200 ve PNG
- `pnpm ci:full` yeşil; PR'da CI (`e2e` dahil) yeşil

- **Yayın adımı (2026-10-03):** dal v0.14.1 ile birleştirildi; maskeye kuyruk üçgeni eklendi (512 px önizlemede kuyrukta halka kırıntısı görüldü; D-086). Başlık logosu e2e testi, yol satırındaki "havayolu" bağlantısını saymasın diye başlıkla sınırlandı.
- **`pnpm ci:full` → yeşil:** birim testleri web 663, shared 546, api 251, worker 200, providers 120, i18n 93, tools 74, db 44, geo 31, scripts 31; entegrasyon db 82, api 26, worker 12; migration yükseltme 6 → 6; `compose:guard`; E2E 111/111.
- `pnpm stats` → 538 dosya, 95.066 satır (86.551 kod).

## M6k — Uçak listesi sağ üstte (v0.16.0)
Onay: 2026-10-03 (kullanıcı isteği, üretimdeki haritanın ekran görüntüsüyle: "Haritada görünen uçakları ekranın sağ üst köşesine yerleştir. aranan uçaklar kalsın solda sadece. uçaklar listelenmeye başlayınca ekranın bir tarafı en azından kullanılabilsin. Sefer / Kuyruk(tescil-reg) / Yükseklik / Konum ve Durum (yaklaşıyorsa ya da inişte ise veya yerde ise bildir.)"; açık sorularda araştırmanın önerdiği varsayılanlar; küçük sürüm, D-082)

Hedef sürüm 0.16.0. Karar D-085'tedir.

**Kapsam:**
- **Yerleşim:**
  - 768 px ve üstünde liste sağ üstte: en çok 440 px genişlik, alt kenarı haritanın ortasının 12 px üstünde (yükseklik en çok yarısı eksi 24 px; 959 px ve altında 30 px, ortalanan seçili simge altında kalmaz); içinde kayar.
  - Seçili uçağın etiketi haritanın üstündeki panelleri (arama, kart, liste, sağ alttaki düğmeler; `data-map-panel`) örtmeyen konumu seçer (`layoutLabels` → `panels`).
  - Başlık düğmesiyle daralır ya da açılır, sayı rozeti ve ok vardır; hâl cihazda saklanır (`hy:map:list`, varsayılan açık).
  - Sol sütunda yalnızca arama ve bilgi kartı (kart sağ üstten aramanın altına taşındı). Sütun konumlandırılmamış (static) bir bloktur; haritanın öteki katmanları `position: absolute`'tur.
  - Durum şeridi 1180 px ve üstünde sütun ile liste arasında ortalı, altında arama ile kartın arasında.
  - Havalimanı penceresi listeyi, aramayı ve sağ alt düğmeleri örtmeyen yanı seçer (`placePopup` → `avoid`); hepsi örtüyorsa en az örteni.
  - Kart haritanın ortasını örtünce (768 px'e yakın) harita sola pay alır (`MapViewState.insets`: `bottom`, `left`; ölçü kökü `.live-map`).
  - Telefonda sol alt düğme ve alt liste kalır (kapalı başlar, saklanmaz).
- **Sütunlar:**
  - Sefer;
  - Kuyruk (tescil; PIA/LADD ya da bilinmeyen tescilde "—", notla; erişilebilir adı "Kuyruk tescili");
  - Yükseklik ("yerde"; sayı ve birim bölünmez);
  - Konum ve durum (rozet: Yaklaşmada, İnişte, Yerde, Alçakta sinyal kaybı; konum: "IST, 18 km", "IST, pist 35L", "IST üzerinde", "IST, 45 km kuzeyinde").
  - Tip ve Hız listeden çıkar (bilgi kartında kalır). Altta "Durumlar tahminidir" notu (`aria-describedby`).
- **Durum:** yalnızca gösterim. İstemcide, depo değiştikçe (WebSocket farkı), listelenen havalimanlarına ve pist uçlarına göre hesaplanır (domain.md → "Haritadaki uçak listesi: tahmini durum"). Motor eşikleri değişmez. Durumlar canlı bölge değildir, değişince duyurulmaz. Merkeze göre kurallar yalnızca tarifeli havalimanlarında, girişte 45° ve çıkışta 90° koniyle; kendi başına uyan aday önce gelir (gözden geçirme 2026-10-04: IST ve SAW varışları "Yaklaşmada ISL" görünüyordu).
- **Kapsam dışı:**
  - pas geçme ve kalkış durumları;
  - duruma göre sıralama (sıra değişmedi: görünüm ortasına uzaklık, ilk 50);
  - bilgi kartında durum satırı;
  - QNH ile yerden yükseklik;
  - mobil uygulama.
- **Bilinen sınırlar:**
  - 1280 × 720'de ~516 px'ten uzun IST penceresi solda açılır ve arama kutusunu birkaç piksel örtebilir (bütün yanlar bir paneli örtünce en az örten yan seçilir);
  - güzergâh bilinmediği için başka bir havalimanına giderken tarifeli bir havalimanının önünden alçalarak geçen uçak (ör. Trakya'dan IST'ye gelirken TEQ) kısa süre ona "Yaklaşmada" görünebilir;
  - seçili etiket, bütün yakın ve çizgili konumlar doluysa panelin üstüne gelebilir.
- **Ek (2026-10-04, kullanıcı isteği; v0.16.0 ile yayımlanır):** "Havalimanları etiketi kod ve ad ı kaldır. tıklayınca detaylı veri var. adına gerek yok orada": Etiketler → Havalimanları yalnız Gizle / Kod (varsayılan Kod); saklanmış "Kod ve ad" ayarı Kod okunur. Kısa ad tablosu (`airport-map-names.ts`), adlı kutu çizimi ve ilgili i18n metinleri kaldırıldı; pinler her zaman görünür ve tıklanır. Karar D-084'e tarihli madde olarak eklendi.

**Dizinler ve dosyalar:**
- **`packages/geo/src/`:** `index.ts` (`crossTrackKm`, `alongTrackKm`); test `geo.test.ts`
- **`packages/i18n/src/messages/`:** `tr.ts`, `en.ts`. `map.table`: `registration`, `registrationLabel`, `place`, `phase.*`, `placeDistance`, `placeRunway`, `placeOver`, `placeBearing`, `direction.*`, `note`. `type`, `speed` ve `position` kalktı. `units.ts`: `formatDistance` `nowrap` seçeneği (konum sütununda "45 km" bölünmez); test `units.test.ts`.
- **`apps/web/src/lib/map/`:** `flight-phase.ts` (`FlightPhaseTracker`, eşikler, `scheduled`), `list-settings.ts` (`hy:map:list`), `label-layout.ts` (`panels`, `ScreenRect`); testler `flight-phase.test.ts`, `list-settings.test.ts`, `label-layout.test.ts`
- **`apps/web/src/components/map/`:**
  - `live-map.tsx` (`.live-map__left`; `useFlightPhases`; `insets` ölçüsü kökü `.live-map`; `data-map-panel`);
  - `use-aircraft-list-open.ts`, `use-flight-phases.ts`, `use-map-panels.ts` (panel dikdörtgenleri, `ResizeObserver`);
  - `airport-data.ts` (pist uçları);
  - `popup-placement.ts` (`avoid`), `airport-popup.tsx` (`data-map-panel` dikdörtgenleri, `ResizeObserver`);
  - `map-view.tsx`, `map-controller.ts` (`MapInsets`, `NO_INSETS`, `mapPadding`, `panels`), `labels.ts` (seçili etiketin panelleri);
  - `panels/aircraft-table.tsx`, `panels/aircraft-place.ts`;
  - testler `panels/panels.test.ts`, `panels/aircraft-place.test.ts`, `popup-placement.test.ts`, `airport-data.test.ts`, `map-controller.test.ts`, `use-map-panels.test.ts`.
- **`apps/web/src/app/globals.css`:** sol sütun, sağ üst liste (`--map-left-width`, `--map-table-width`, `--map-table-clear`: 959 px ve altında 30 px), daraltma (`data-wide-open`, `data-phone-open`), durum şeridi boşluğu, durum rozeti, not, telefon kuralları.
- **`e2e/tests/live-map.spec.ts`, `e2e/support.ts`:**
  - yükseklik değişimi ve konumda IST;
  - liste yeri (12 px kenar, yarı yükseklik), çakışmasızlık, sütunlar, durumlar, daraltmanın saklanması;
  - pencerenin listeyi örtmemesi;
  - kartın solda olması; 1024 ve 768 px'te seçili etiketin listenin altında kalmaması, 768 px'te dolu listenin ortalanan simgenin üstünde bitmesi (`e2e/label-canvas.ts` → `selectedLabelPixels`);
  - telefonda düğme, dört sütun, yatay taşma yok.
- **`e2e/tests/weather.spec.ts`:** pencereyi kapatan "boş yere tıklama" merkezden 450 px batıya taşındı (pencere artık genellikle solda açılır; eski nokta, merkezin 150 px batısı, pencerenin içine düşerdi).
- **Belgeler:** D-085; `docs/spec/domain.md` (Haritadaki uçak listesi: tahmini durum); `docs/ACTIVATION.md` (M6k yayın doğrulaması). `docs/REFERENCES.md`'ye 3° süzülüş kaynağı (ör. FAA AIM 1-1-9 ya da ICAO PANS-OPS) adresi doğrulanınca eklenecek: doğrulama canlı istek ister, bu oturumda yapılmadı.

**Kabul komutları:**
- `pnpm --filter @havayolu/geo test` → çapraz ve boyuna sapma; kapsam ≥ %90.
- `pnpm --filter @havayolu/i18n test` → yeni anahtarlar iki dilde aynı yer tutucularla; sayıdan önce "·" ya da "–" yok.
- `pnpm --filter @havayolu/web test` →
  - durum kuralları (taksi Yerde; 35L'de 5 km İnişte ve "pist 35L"; 18 km Yaklaşmada; uzaklaşan, tırmanan ve süzülüş zarfının üstündeki uçak durumsuz; iki havalimanı arasında doğru seçim; VAN rakımı; 5 sn onay ve çıkış eşikleri; 30 sn'de Alçakta sinyal kaybı; havalimanı yokken koordinat);
  - havalimanı seçimi (tarifesiz Atatürk merkez kuralına girmez, pist hizasında görünür; 70° yandaki SAW yaklaşmada değil; arkada kalan havalimanı 5 sn'de düşer; kendi başına uyan ve iz yönüne yakın aday önce; SAW ve IST rüzgâr altı kollarında 2 sn örnekli uçuşta yalnızca hedef havalimanı);
  - seçili etiketin panelleri örtmemesi (`layoutLabels` → `panels`), panel dikdörtgenleri (`use-map-panels`);
  - TR/EN metinleri ve sekiz yön;
  - tablo sütunları ("Kuyruk tescili"), "—", not ve `aria-describedby`, canlı bölge yok, düğme durumları (geniş: açık ve daraltılmış; telefon: kapalı);
  - pencere yerleşiminde kaçınma (sağ → sol → alt; en az örtüşme; kenar boşluğu; kaçınma yokken eski sonuçlar);
  - panel payı (`insets.bottom`, `insets.left`);
  - pist uçlarının okunması;
  - `hy:map:list` kaydı (varsayılan açık, geçersiz değer açık, hata veren depolama).
- `pnpm test:e2e` → `live-map.spec.ts`:
  - 1280 px'te liste sağ üstte (12 px kenar, alt kenarı ortanın 12 px üstünde) ve arama, durum şeridi, sağ alttaki düğmeler ve atıfla çakışmaz;
  - sütun adları;
  - HYS092 "Yerde" ve "IST", kuyruk "TC-SYN92"; HYS091 yaklaşmada ya da inişte ve "IST"; seyirdeki uçaklar rozetsiz;
  - daraltma yenilemede kalır;
  - IST penceresi listeyle çakışmaz (arama kutusuyla çakışmazlık denetlenmez; bilinen sınırlar);
  - kart solda, aramanın altında; 1024 ve 768 px'te seçili uçağın etiketi ve simgesi listenin altında kalmaz;
  - 375 px'te liste kapalı başlar, açılınca dört sütun, atıfın üstünde, yatay taşma yok.
- `pnpm ci:full` yeşil; PR'da CI (`e2e` dahil) yeşil.
- **Yayından sonra (`[k]`):** üretimde 1280 px'te liste sağ üstte, IST'ye gelen en az bir uçakta "Yaklaşmada" ya da "İnişte" görülür (Atatürk değil), daraltma yenilemede kalır, 768/1024 px'te seçili uçak listenin altında kalmaz, 375 px'te düğme çalışır (ACTIVATION → "M6k yayın doğrulaması").

- **Yayın adımı (2026-10-04):** dal v0.15.0 (logo) ile birleştirildi; karar ve plan çakışmaları iki bölüm korunarak çözüldü.
- **`pnpm ci:full` → yeşil:** birim testleri web 724, shared 546, api 251, worker 200, providers 120, i18n 94, tools 74, db 44, geo 36, scripts 31; entegrasyon db 82, api 26, worker 12; migration yükseltme 6 → 6; `compose:guard`; E2E 113/113.
- `pnpm stats` → 548 dosya, 98.374 satır (89.683 kod).
- **"Kod ve ad" kaldırıldı (2026-10-04, aynı sürüm):** bağımsız kontrol 6 mutasyonun 5ini birim testleriyle, 1ini e2e ile yakaladı; `pnpm ci:full` → yeşil: birim testleri web 718, shared 541, api 251, worker 200, providers 120, i18n 94, tools 74, db 44, geo 36, scripts 33; entegrasyon db 82, api 26, worker 12; E2E 113/113. `pnpm stats` → 547 dosya, 98.022 satır (89.302 kod).

## M6e.3 — Derecelendirilmiş rüzgâr renkleri (v0.16.1)
Onay: 2026-10-04 (kullanıcı isteği: "rüzgar için yeşil kod yaptık ya belli bir km/knot ta renk yok ama rüzgar var. derecelendirmeli yap. rüzgar varsa renkli belirt."; yama sürümü, D-082)

Hedef sürüm 0.16.1 (M6k'nin v0.16.0 dalının üstünden, `2323db0`). Karar D-083'teki "2026-10-04 kullanıcı isteği: derecelendirilmiş rüzgâr renkleri" maddesidir.

**Kapsam:**
- Rüzgâr varsa rüzgâr satırı her zaman renklidir ve basamağın adı metin olarak yazılır: ≤ 10 km/sa (sakin dahil) açık yeşil "Hafif rüzgâr" (değişmedi), 11–19 km/sa limon yeşili "Tatlı rüzgâr", 20 km/sa ve üstü (ortalama < 17 kt, hamle < 25 kt) sarı "Orta rüzgâr", ortalama 17–19 kt ya da hamle 25–29 kt kehribar (değişmedi), MGM meydan uyarısından 34 kt'ye turuncu, ortalama ≥ 34 kt ya da hamle ≥ 43 kt kırmızı.
- km/sa sınırları gösterilen değere göredir (ortalama ile hamlenin büyüğü), kt sınırları mevcut düzeylerinkidir; P99 en az kendi düzeyi; bilinmeyen hız ve NIL vurgusuz; VRB hafif rüzgâr açık yeşil, değeri değişmedi. Rüzgâr kesmesi satırı en az kehribar yapar (kesme basamağı yükselttiyse hafif, tatlı ve orta rüzgârın adı yazılmaz).
- Pencere ve havalimanı sayfası aynı satırlardır (`phenomenonRows`). Gök gürültüsü, dolu ve diğer olayların kehribarı, API `derived.strongWind`, TAF'ın rüzgâr öğesi değişmedi.

**Dosyalar:**
- `packages/shared/src/weather/schema.ts` (`WIND_TIERS`, `WindTier`), `derive.ts` (`BREEZE_WIND_MAX_KMH`, `windLevelTier`, `windTier`), `summary.ts` (`WeatherSummary.windTier`), `index.ts`; `derive.test.ts`, `summary.test.ts`
- `packages/i18n/src/messages/tr.ts`, `en.ts` (`weather.wind.breeze`, `weather.wind.moderate`), `weather.test.ts`
- `apps/web/src/components/airports/weather-rows.ts` (`WeatherTone` = basamaklar ve olaylar, `windRow`, `windTag`), `weather-row-list.tsx` (açıklama), `weather-rows.css` (dört yeni basamak rengi, kehribar ton adı `fresh`, `forced-colors` çerçeveleri); `airport-weather.test.ts`, `components/map/airport-popup.test.ts`, `components/map/airport-popup-model.test.ts`
- `e2e/tests/weather.spec.ts` (IST turuncu, LTAI `fresh`, LTDB limon yeşili, LTAC sarı; altı basamağın renkleri)
- `docs/DECISIONS.md` (D-083 alt maddesi)

**Kabul komutları:**
- `pnpm --filter @havayolu/shared test` → basamak sınırları (10/11, 19/20, 30/31 km/sa ve 16/17 kt; KT, KMH, MPS), hamle 24/25, 29/30, 42/43 kt, ortalama 19/20, 33/34 kt, P99, bilinmeyen hız; her basamaktan üretim METAR'ı
- `pnpm --filter @havayolu/i18n test` → yeni adlar iki dilde, eşlik, sayıdan önce ayraç yok
- `pnpm --filter @havayolu/web test` → sayfa ve pencerede ton ve etiket; bütün fixture istasyonları; kesme
- `pnpm test:e2e` → `weather.spec.ts`: IST satırı turuncu (`rgb(255, 237, 213)` zemin, `rgb(154, 52, 18)` yazı), LTAI kehribar, LTDB limon yeşili "Tatlı rüzgâr", LTAC sarı "Orta rüzgâr", altı basamağın zemini ve yazısı
- `pnpm ci:full` yeşil; PR'da CI (`e2e` dahil) yeşil

**Çıktı kaydı (2026-10-04, uygulama; sürüm, changelog ve README yayın adımındadır; e2e ve `ci:full` bu adımda çalıştırılmadı):**
- Üretim anlık görüntüsü (2026-10-03 16:56Z, METAR'ı olan 122 istasyon) çalışma ağacının çözücüsü ve arayüzün `phenomenonRows`'u ile: açık yeşil 51 (35 "Hafif rüzgâr", 14 "Hafif ve değişken yönlü", 2 "Sakin"), limon yeşili 37, sarı 22, kehribar 7, turuncu 5, kırmızı 0, vurgusuz 0. v0.14.1 kuralıyla 51 / 59 sade / 12 kehribar. 15:37Z görüntüsünde 36 / 44 / 21 / 12 / 9 / 0.
- Karşıtlık (betikle; yazı/zemin, yazı/beyaz etiket): açık yeşil 6,49 / 7,13; limon yeşili 6,52 / 7,08; sarı 6,12 / 6,64; kehribar 6,37 / 7,09; turuncu 6,38 / 7,31; kırmızı 6,80 / 8,31. Önerilen yellow-100 kehribardan CIEDE2000 ile yalnız 3,4 ayrıldığı için sarı `#FDF9B0` / `#715A00` seçildi (6,7).
- Birim testleri: `pnpm --filter @havayolu/shared test` → 614 (+68), `@havayolu/i18n` → 96 (+2), `@havayolu/web` → 726 (+2; mevcut testlerdeki ton beklentileri gerekçesiyle güncellendi).
- `pnpm typecheck` (9/9), `pnpm lint` (9/9), `pnpm typecheck:e2e`, `pnpm lint:e2e`, `pnpm format`, `pnpm check:eol` → yeşil.

- **Yayın adımı (2026-10-04):** dal v0.16.0 ile çakışmasız birleşti. **`pnpm ci:full` → yeşil:** birim testleri web 720, shared 609, api 251, worker 200, providers 120, i18n 96, tools 74, db 44, geo 36, scripts 33; entegrasyon db 82, api 26, worker 12; E2E 113/113. `pnpm stats` → 547 dosya, 98.817 satır (90.015 kod).

## M6g — 2. halka (v0.17.0)
Onay: 2026-10-01 kullanıcı (halkalar, her halka ayrı sürüm) ve 2026-10-03 kararları (tablo başlığı "Türkiye dışındaki havalimanları" / "Airports outside Türkiye"; Sohum Moskova saati)

Hedef sürüm 0.17.0 (`main` `a8753e4` = v0.16.1'den). Kararlar D-088'dedir; kural D-080'in aynısıdır. Migration yoktur: üretim veritabanı 2. halkanın havalimanlarını zaten tutar.

**Kapsam:**
- **Halka:** `ENABLED_AIRPORT_RING` 1 → 2; listelenen havalimanları 136 → 225 (61 + 75 + 89), 14 yeni ülke. En yakını Ben Gurion (500,44 km → API'de 500, 2. halka), en uzağı Kuveyt (988 km).
- **Fixture:** 2026-10-01 indirmesinden (yeniden indirme yok) 89 havalimanı ve 123 açık pist dosyaların sonuna; üretici betik halkaları sırayla yazar ve aynı baytları üretir.
- **Adlar, şehirler, ülkeler:** 89 havalimanının TR/EN adı ve şehri (D-080 kuralları, belirsiz yazımlarda yalnız bugünkü Türkçe kullanım); ülke adları `Intl` (İngilizcede "&" → "and"); KKTC kuralı değişmez; saat dilimi kuralları yeterli (164 havalimanının dilimi testle).
- **Kaynak düzeltmeleri:** İskenderiye HEAX → HEBA (koşullu ICAO düzeltmesi, iki pakette, testli); Taba 04/22 ve Cluj 08/26 yinelenen boş pist satırları gizli; adda çift boşluk teke iner.
- **Hava durumu:** istasyon 225; METAR 3, TAF 2 istek; ilk çalışmada 89 yeni istasyon 15 istekle 24 saat. Toplu ve tek havalimanı yanıtı yalnız yürürlükteki TAF'ları taşır (özet değişmez, eski TAF'lar kayıtta); bütçe 225 istasyon için.
- **Sayfalar ve harita:** `/havalimanlari` yabancı tablosunun başlığı "Türkiye dışındaki havalimanları" / "Airports outside Türkiye" (tablo başlığı, özet, sayfa açıklaması, `/hakkinda`, llms.txt bölümü; "yakın ülkeler" ve "neighbouring" kalmaz); uzaklık sınırı "1.000 km" / "1,000 km"; ad kuralı cümlesi (exonym ya da yerel ad: Kahire; Iași, Timișoara). Tablo 164 satır; site haritası 450 adres, llms.txt 220 havalimanı satırı. 2. halka sayfaları ve pencere ülke ve yerel saatle; harita 225 pini ve kodu kare başına yeni iş olmadan çizer (z5'te 225 kodun yerleşimi ~1–2 ms).

**Dizinler ve dosyalar (veri ve backend):**
- `packages/shared/src/reference/`: `airport-rings.ts` (`ENABLED_AIRPORT_RING`), `airport-codes.ts` (yeni: `OURAIRPORTS_ICAO_CORRECTIONS`, `ourAirportsIcao`), `foreign-airport-names.ts` (164 ad ve şehir), `countries.ts` ("and"); testler `foreign.test.ts`, `names.test.ts`, `time-zones.test.ts`, `reference.test.ts`
- `packages/shared/src/weather/`: `summary.ts` (`inForceTafs`), `schema.ts` (belge); `summary.test.ts`
- `packages/db/src/airports.ts` (`OURAIRPORTS_ICAO_CORRECTIONS`, `ourAirportsIcao`, `cleanAirportName`, `HIDDEN_RUNWAY_IDS`, `isHiddenRunway`); `airports.test.ts`, `airports.int.test.ts`
- `apps/api/src/reference/`: `weather.ts` (yürürlükteki TAF'lar), `airports.ts` (açıklama); `weather.test.ts`, `weather.int.test.ts`, `rings.test.ts`, `airport-details.int.test.ts`
- `apps/worker/src/jobs/weather.ts`, `packages/providers/src/weather/aviationweather.ts` (açıklamalar); `weather.test.ts`, `jobs.int.test.ts`, `aviationweather.test.ts`, `packages/providers/src/reference/reference.test.ts`
- `tools/fixtures/ourairports/airports.csv`, `runways.csv`, `tools/fixtures/README.md`, `scripts/make-reference-fixtures.mts`

**Dizinler ve dosyalar (sayfalar ve testler):**
- `packages/i18n/src/messages/{tr,en}.ts`: liste (başlık, tablo başlığı, özet, ad kuralı cümlesi), sayfa açıklaması, `/hakkinda` (`shows.airports`, `method.abroad`); llms.txt bölüm başlığı aynı metinden
- `apps/web/src/`: `components/airports/airport-text.ts` ve `lib/weather.ts` (açıklamalar: 1.000 km, 225 sayfanın kayıt istekleri); `lib/test/ourairports-fixture.ts` (API'nin düzeltmeleri: `ourAirportsIcao`, ad boşluğu, gizli pistler)
- `apps/web/src/` testleri: `components/airports/airport-text.test.ts` (225, 75 + 89, Ben Gurion 500, ülkeler ve şehirler, 1.000 km), `airport-view.test.ts` (başlık, Arnavutluk/Albania, ad kuralı örnekleri, Kahire, Ben Gurion, Belgrad, Bingazi sayfaları), `airport-og.test.ts` (karakter örneklemi), `components/about/about-content.test.ts`, `app/llms.txt/route.test.ts`, `components/map/labels.test.ts` (z5'te 225 kod), `airport-popup-model.test.ts` (225 havalimanının yeri ve dilimi), `airport-popup.test.ts` (Kahire penceresi), `lib/seo/structured-data.test.ts`
- `e2e/`: `support.ts` (`RING1_AIRPORT_COUNT` 75, `RING2_AIRPORT_COUNT` 89, `FOREIGN_AIRPORT_COUNT` 164, `LISTED_AIRPORT_COUNT` 225, `INDEXABLE_LISTED_AIRPORT_COUNT` 220, `RING2_AIRPORT` HECA, `RING2_BOUNDARY_AIRPORT` LLBG, `RING_LIMITS_KM`), `tests/foreign-airports.spec.ts`, `tests/seo.spec.ts`, `tests/app.setup.ts`, `tests/airports.spec.ts` ve `tests/weather.spec.ts` (açıklamalar)
- Belgeler: D-088, `docs/spec/data-sources.md` §3 ve §5, `docs/RUNBOOK.md` (istek sayıları), `docs/ACTIVATION.md` ("M6g yayın doğrulaması")
- Birleştirmede: `apps/api/src/live/ws.ts` (`wsRateLimit`: üretim dışında dakikada 60 el sıkışması), `ws.test.ts`, `ws.int.test.ts`; `turbo.json` (`build` çıktılarından `.next/dev/**` hariç); `e2e/tests/weather.spec.ts` (açıklama)

**Kabul komutları:**
- `pnpm --filter @havayolu/shared test` → halka sabitleri (2. halka açık), fixture'da 2. halka 89 ve 14 yeni ülke, 164 ad ve şehir kaydı, İngilizce ad kuralı (yalnız Bağdat ve Podgorica kısaltılmış), D-088 yazımları, HEAX → HEBA koşullu düzeltme, "Bosnia and Herzegovina", 164 havalimanının dilimi, `inForceTafs` ve özetin değişmemesi
- `pnpm --filter @havayolu/db test` ve `pnpm test:integration` → düzeltme, boşluk, gizli pist; 225 havalimanı, HEBA, Ben Gurion 500 km 2. halkada; API'de 61 + 164, HBE → HEBA, HEAX 404, Taba ve Cluj tek pist; worker istasyon listesi 225
- `pnpm --filter @havayolu/api test` → iki paketin ICAO kuralı aynı; toplu ve tek yanıtta aynı yürürlükteki TAF'lar, kayıtta hepsi; 225 istasyonun gövde bütçesi (1,8 MB en kötü, 1,2 MB tek TAF)
- `pnpm --filter @havayolu/worker test` ve `@havayolu/providers` → METAR 80 + 80 + 65, TAF 200 + 25, yayından sonra 89 yeni istasyon 15 istekte 24 saat
- `pnpm exec tsx scripts/make-reference-fixtures.mts <ham-klasör> <çıktı>` → commit'li iki OurAirports fixture'ıyla bayt bayt aynı
- `pnpm --filter @havayolu/web test` → fixture 225 (75 + 89, Ben Gurion 500/2. halka, HEBA, Taba ve Cluj tek pist); liste, `/hakkinda` ve llms.txt'te "Türkiye dışındaki havalimanları" ve "1.000 km", "yakın ülke"/"neighbouring" yok; ilk ülke Arnavutluk/Albania; Kahire (Mısır, Gazipaşa'ya bağlantı), Ben Gurion (Hatay, 500 km), Belgrad ve Bingazi (küçük alan) sayfaları; z5'te 225 kod örtüşmeden ve hızlı; pencerede 225 havalimanının yeri ve dilimi, Kahire'nin yaz ve kış saati; paylaşım görseli karakter örneklemi (33 görsel) ağsız
- `pnpm --filter @havayolu/i18n test`, `pnpm typecheck:e2e`, `pnpm lint:e2e`
- `pnpm test:e2e`:
  - kurulum: `/v1/airports?scope=listed` 225
  - API: `scope=listed` 61 + 164 (halka 1: 75, ≤ 500 km; halka 2: 89, 500–1.000 km), Kahire halka 2, Ben Gurion halka 2 ve 500 km, EGLL yok
  - `/havalimanlari` ve `/en/havalimanlari`: "Türkiye dışındaki havalimanları" / "Airports outside Türkiye" tablosu 164 satır, ülkeye göre sıralı; Kahire satırı (ad, Mısır/Egypt, 500 < km ≤ 1.000); ItemList 225
  - `/istasyon/HECA` ve `/en/istasyon/HECA`: ad, Mısır/Egypt, dizine eklenir, JSON-LD `addressCountry` EG, yerel saat Africa/Cairo; `/istasyon/cai` → 308
  - site haritası 450 adres (`/istasyon/HECA` dahil); llms.txt 220 havalimanı satırı, "## Türkiye dışındaki havalimanları / Airports outside Türkiye" başlığı altında Atina ve Kahire, "1.000 km" / "1,000 km", "yakın ülke"/"neighbouring" yok
  - harita: `?havalimani=HECA` Kahire'de açar; listeden açılan pencere Mısır'ı, Kahire'nin saatini ve sayfa bağlantısını gösterir
- `pnpm test:e2e` ve `pnpm ci:full` yeşil; PR'da CI (`e2e` dahil) yeşil
- **Kullanıcıya bağlı (`[k]`):** yayından sonra `scope=listed` 225, İskenderiye'nin HEBA METAR'ı, istasyon sayısı 225, toplu hava gövdesinin boyutu (ACTIVATION → "M6g yayın doğrulaması")

**Çıktı kaydı (2026-10-04, veri ve backend; sürüm, changelog ve README yayın adımındadır):**
- Fixture: ham dosyalardan üretim commit'li `airports.csv` (601 satır) ve `runways.csv` (358 satır) ile bayt bayt aynı.
- Birim testleri: `@havayolu/shared` 616, `@havayolu/db` 47, `@havayolu/api` 254, `@havayolu/worker` 200, `@havayolu/providers` 121.
- Entegrasyon testleri: db 83, worker 12, api 26.
- `pnpm typecheck` (shared, db, api, worker, providers), `pnpm typecheck:scripts`, `pnpm lint` (aynı paketler), `pnpm check:eol` → yeşil.
- Sayfalar ve testler: birim testleri `@havayolu/web` 728, `@havayolu/i18n` 96; web ve i18n typecheck ve lint, `pnpm typecheck:e2e`, `pnpm lint:e2e` → yeşil. Paylaşım görseli testi 225 yerine 33 görsel çizer (~1,6 sn; hepsi ~9 sn sürerdi). e2e `ci:full`'da birleştirici çalıştırır.
- **Birleştirme (2026-10-04):** iki işin çakışan dosyası yoktu; sayılar her yerde 61 + 164 = 225 listelenen, 220 dizine eklenen sayfa, site haritası 450, llms.txt 220 satır. `docs/RUNBOOK.md`'deki saatlik istek sayısı (~28 → ~44) düzeltildi. İlk `ci:full`'da e2e 11 kırmızıydı: (1) web, 136 havalimanlı eski listeyi okuyordu: turbo'nun önbellekten geri yüklediği web derlemesi, Next 16 geliştirme sunucusunun veri önbelleğini (`.next/dev/cache/fetch-cache`) de geri yazıyordu; `turbo.json`'da `!.next/dev/**` (10 test). (2) `live-map.spec.ts`'te canlı veri kesildi ("Bağlantı koptu"): API günlüğünde `/v1/ws` 429, 60 sn'de 32 el sıkışması; geliştirme sunucusunda StrictMode her yüklemede iki el sıkışması açar, Kahire harita testi bütçeyi aştı; `wsRateLimit` üretim dışında 60 (D-088). **`pnpm db:migrate`** (0 yeni) ve **`pnpm ci:full` → yeşil:** birim testleri web 728, shared 616, api 255 (+1), worker 200, providers 121, i18n 96, tools 74, db 47, geo 36, scripts 33; entegrasyon db 83, api 26, worker 12; migration yükseltme 6 → 6; `compose:guard` 8 servis, 64 anahtar; E2E 116/116 (+3: Kahire sayfası TR ve EN, Kahire harita penceresi).

- **Yayın adımı (2026-10-04):** site künyesi dalı (`p1/attrib-version`, D-089) birleştirildi; gözden geçirmenin 6 bulgusunun hiçbiri doğrulanmadı (D-088 önbellek sınırı metni base64 ayrıntısıyla düzeltildi). **`pnpm ci:full` → yeşil:** birim testleri web 736, shared 616, api 255, worker 200, providers 121, i18n 96, tools 74, db 47, geo 36, scripts 33; entegrasyon db 83, api 26, worker 12; E2E 117/117. `pnpm stats` → 548 dosya, 100.712 satır (91.762 kod).

## M6e.4 — Yeniliklerde yayın saati (v0.17.1)
Onay: 2026-10-04 (kullanıcı isteği: "yeniliklerdeki yayın tarihine tarih ve saat ekle."; yama sürümü, D-082)

Hedef sürüm 0.17.1 (`main` `fb6e0cc` = v0.17.0'dan). Karar D-091'dedir.

**Kapsam:**
- `ChangelogEntry.releasedAt` (isteğe bağlı, ISO 8601 UTC); `date` kalır. Denetim: biçim, İstanbul'daki günü `date`, yeniden eskiye kesin azalan.
- Geriye dönük doldurma: v0.5.0 ve sonrası GitHub Release `publishedAt`; v0.1.0–v0.4.0 `main`'e giriş anı (release'leri sonradan toplu açıldı). v0.9.0 ve v0.4.0'ın günü düzeltildi.
- `/yenilikler` ve `/en/yenilikler`: "Yayın tarihi: 4 Ekim 2026, 20:27 (TSİ)" / "Released: 4 October 2026, 20:27 (UTC+3)", `<time datetime>` ISO anı. Yayın anı henüz yazılmamış çalışan sürümde web sunucusunun açılış anı, yayın anı olmayan diğer sürümlerde yalnızca gün.
- CHANGELOG.md başlığı ve GitHub Release notunun tarih satırı saati taşır ("2026-10-04 20:27 (UTC+3)").
- **Yayın adımı kuralı (D-091, bundan sonraki her sürüm):** yeni kayıt `releasedAt`'sız eklenir; aynı adımda önceki sürümün `releasedAt`'ı `gh release view v<önceki> --json publishedAt` ile yazılır, anın İstanbul'daki günü farklıysa `date` düzeltilir, `pnpm changelog` çalıştırılır. Birim testi en yeni sürüm dışında boş `releasedAt` bırakmaz.

**Dosyalar:**
- `packages/shared/src/changelog/`: `types.ts` (`releasedAt`), `entries.ts` (25 sürümün yayın anı, iki gün düzeltmesi), `index.ts` (`isReleasedAt`, `validateChangelog`, `releaseStamp`, markdown başlığı); `changelog.test.ts`
- `packages/shared/src/weather/time.ts` (`utcOffsetLabel`, i18n'in `formatUtcOffset`'i ve CHANGELOG.md ortak kullanır), `index.ts`; `time.test.ts`
- `packages/i18n/src/index.ts` (`formatReleaseTime`, `RELEASE_ZONE`), `weather.ts` (`formatUtcOffset` → `utcOffsetLabel`), `messages/{tr,en}.ts` (`changelog.releasedAtValue`); `i18n.test.ts`
- `apps/web/src/`: `app/yenilikler/page.tsx` (`connection()`, içerik bileşene taşındı), `components/changelog/changelog-content.tsx` (yeni), `components/changelog/release-time.ts` (yeni: `releaseTime`, `isoInstant`), `lib/server-start.ts` (yeni: `SERVER_STARTED_AT`); `components/changelog/changelog-content.test.ts` (yeni)
- `scripts/changelog.mts` (`releaseNotes` dışa açıldı, ana işlev koruması), `scripts/changelog.test.mts` (yeni); `CHANGELOG.md` (yeniden üretildi)
- `e2e/tests/changelog.spec.ts` (yeni)
- `docs/DECISIONS.md` (D-091)

**Kabul komutları:**
- `pnpm --filter @havayolu/shared test` → `releasedAt` biçimi (salise, ofset, 31 Eylül, 24:00 reddedilir), İstanbul günü (21:00Z sınırı), kesin azalan sıra, gerçek veride en yeni dışında boş yok, v0.17.0/v0.9.0/v0.4.0/v0.1.0 değerleri, `releaseStamp`, markdown başlığı; `utcOffsetLabel`
- `pnpm --filter @havayolu/i18n test` → `formatReleaseTime` TR/EN, gece yarısı sonrası gün, 00:00, geçersiz an "—"; yer tutucu eşliği
- `pnpm --filter @havayolu/web test` → `releaseTime` üç kaynak (yayın anı, sunucu açılışı yalnızca çalışan sürümde, yalnızca gün), `<time dateTime>` ve metin TR/EN, "Güncel sürüm" yalnızca çalışan sürümde, gerçek changelog'un her sürümünde saat
- `pnpm test:scripts` → CHANGELOG.md kaynağından üretilmiş hâliyle aynı, başlıklarda saat, `--check` geçer, release notunun başlığı aynı ve tarih satırı saatli, `--release 0.17.0` ve bilinmeyen sürüm
- `pnpm changelog:check`, `pnpm typecheck`, `pnpm typecheck:scripts`, `pnpm lint`, `pnpm typecheck:e2e`, `pnpm lint:e2e`, `pnpm format`, `pnpm check:eol`
- `pnpm test:e2e` → `changelog.spec.ts`: v0.17.0 "4 Ekim 2026, 20:27 (TSİ)" / "4 October 2026, 20:27 (UTC+3)", v0.11.0 "2 Ekim 2026, 02:17 (TSİ)", her kartta tek `<time>`, ISO anı ile metin aynı an, çalışan sürümün anı geçmişte ve yeniden yüklemede sabit
- `pnpm ci:full` yeşil; PR'da CI (`e2e` dahil) yeşil

**Çıktı kaydı (2026-10-04, uygulama; sürüm, v0.17.1 kaydı ve README yayın adımındadır):**
- Yayın anları `gh release list` (2026-10-04) ve `git log --first-parent origin/main -- package.json` ile doğrulandı; tablo D-091'de.
- Birim testleri: `@havayolu/shared` 624 (+8), `@havayolu/i18n` 97 (+1), `@havayolu/web` 745 (+9), `pnpm test:scripts` 39 (+6).
- `pnpm changelog` (25 sürüm) ve `pnpm changelog:check`, `pnpm typecheck` (9/9), `pnpm typecheck:scripts`, `pnpm lint` (9/9), `pnpm typecheck:e2e`, `pnpm lint:e2e`, `pnpm format`, `pnpm check:eol` → yeşil.
- `pnpm test:e2e changelog language` → 18/18 (kurulum 4, `changelog.spec.ts` 3, `language.spec.ts` 11).
- `pnpm dev` önizlemesi: v0.17.0'ın `releasedAt`'ı geçici olarak silinince kart sunucunun açılış anını gösterdi ("4 Ekim 2026, 20:58 (TSİ)", `datetime` 17:58:06Z; ilk istekten ~8 sn önce, TR ve EN'de ve yeniden yüklemede aynı); geri konunca "4 Ekim 2026, 20:27 (TSİ)". Hidrasyon uyarısı yok.

- **Yayın adımı (2026-10-04):** Türkçe dilim etiketi "TSİ" yerine açık "Türkiye saati" (web-ui kuralı: sade görünümde kısaltma yok). Bağımsız denetim: 25 sürümün saati GitHub kayıtlarıyla birebir, 8 mutasyonun hepsi yakalandı. **`pnpm ci:full` → yeşil:** birim testleri web 745, shared 624, api 255, worker 200, providers 121, i18n 97, tools 74, db 47, geo 36, scripts 39; entegrasyon db 83, api 26, worker 12; E2E 120/120. `pnpm stats` → 554 dosya, 101.595 satır (92.544 kod).

## M6e.5 — Ülke sınırları (v0.17.2)
Onay: 2026-10-04 (kullanıcı isteği: "haritada ülke sınırları kesikli kesikli çizgilerle belirgin olmalı."; yama sürümü, D-082)

Hedef sürüm 0.17.2 (`main` `fb6e0cc` = v0.17.0'dan; v0.17.1 ayrı yamadadır). Karar D-092'dedir.

**Kapsam:**
- **Uydu:** Esri görüntüsünün üstüne OpenFreeMap'in vektör karolarından (TileJSON `https://tiles.openfreemap.org/planet`, kaynak `hy-country-borders`, `maxzoom` 10) kesikli ülke sınırları. Katman `boundary`; süzgeç `admin_level = 2`, `maritime ≠ 1`, `claimed_by` yok.
- **Görünüm:** beyaz kesikli çizgi (`[2, 3]` yuvarlak uçla, görünen 3:2; z3 1 px → z10+ 2,25 px), altında #0B2A33 0,6 saydamlıkta düz kenar (çizgiden 2–2,5 px geniş). Tartışmalı sınır (`disputed = 1`) aynı renk ve kenarla noktalı. Her yakınlaştırmada; görüntünün üstünde, pin, iz ve uçakların altında.
- **Koyu stil** (uydunun yedeği ve anahtarsız altlık): indirilen stilin `boundary` çizgi katmanları (ülke ve il) çıkar, aynı üç katman stilin kaynağıyla ilk sınır katmanının yerine (yer adlarının altına) girer.
- **Yerel test stili:** dokunulmaz; sınır kaynağı yok, dış istek yok.
- **Atıf:** sınırlar çizilirken şeritte "OpenFreeMap © OpenMapTiles Data from OpenStreetMap" (sınır kaynağının atfı); künye ilk sırada (D-089), Esri ve ADSB.lol metinleri değişmez. `/hakkinda` ve `/kullanim-kosullari` harita kaynağı cümleleri uydudaki sınırları da anar.
- **Hata:** sınır kaynağının TileJSON ve karo hataları altlık zincirine sayılmaz; OpenFreeMap kesintisinde uydu kalır.

**Dosyalar:**
- `packages/shared/src/map/borders.ts` (yeni: kaynak ve katman kimlikleri, `COUNTRY_BORDER_FILTER`, kesikler, kalınlıklar, `countryBorderLayers`, `countryBorderSource`, `COUNTRY_BORDER_SOURCE_MAX_ZOOM`), `layers.ts` (tipler: `source-layer`, `filter`, `line-dasharray`, süzgeç ifadeleri), `colors.ts` (`border`, `borderCasing`), `index.ts`; `borders.test.ts`
- `apps/web/src/lib/map-config.ts` (`OPENFREEMAP_TILEJSON_URL`, `CountryBorders`, uydu altlığında `countryBorders`); `map-config.test.ts`
- `apps/web/src/components/map/basemap.ts` (`satelliteStyle(…, borders)`, `withCountryBorders`, `prepareFetchedStyle`, `BasemapStep.countryBorders`, `NON_BASEMAP_SOURCES`), `map-controller.ts` (hazırlık ve hata kaynağı kuralı); `basemap.test.ts`, `attribution.test.ts` (şerit sırası)
- `packages/i18n/src/messages/{tr,en}.ts` (`about.sources.vector`, `terms.map.vector`)
- `packages/providers/src/license.ts` (açıklama), `license.test.ts`
- `e2e/tests/live-map.spec.ts` (yerel stilde sınır kaynağı ve OpenFreeMap isteği yok, atıfta OSM yok)
- Belgeler: D-092, `docs/spec/data-sources.md` §6 (sınır katmanı, istek hacmi, 7 alanlı lisans kaydı), `docs/REFERENCES.md` (OpenFreeMap ve OpenMapTiles belgeleri), `ATTRIBUTION.md`, `docs/ACTIVATION.md` ("M6e.5 yayın doğrulaması")

**Kabul komutları:**
- `pnpm --filter @havayolu/shared test` → katman sırası ve kimlikler, süzgeç (kara/deniz/il/iddia/tartışmalı), görünen kesik 3:2 ve nokta, kenar ≥ 2 px geniş ve yarı saydam, kalınlık z3 1 px → z10+ 2–2,5 px, kaynak `maxzoom` 10
- `pnpm --filter @havayolu/web test` → uydu stilinde sınır kaynağı (TileJSON, z10, atıf) ve katmanlar görüntünün üstünde, canlı katmanların altında; OSM atfı yalnızca sınırlar açıkken; adım bayrakları (uydu ve vektör açık, yerel ve düz kapalı); koyu stilde `boundary` katmanlarının yerine aynı katmanlar; test stili ve Protomaps şeması değişmez; sınır kaynağının hataları uyduyu değiştirmez; yapılandırmada TileJSON adresi; MapLibre'nin uzunluk sıralamasıyla şerit iki dilde de Esri, OpenFreeMap, canlı veri (koyu stilde OpenFreeMap, canlı veri)
- `pnpm --filter @havayolu/providers test`, `pnpm --filter @havayolu/i18n test`
- `pnpm typecheck`, `pnpm lint`, `pnpm typecheck:e2e`, `pnpm lint:e2e`, `pnpm format`, `pnpm check:eol`
- `pnpm test:e2e` → `live-map.spec.ts` ilk test: `/test-style.json` istendi, OpenFreeMap/`.pbf`/`/planet` isteği yok, atıfta OpenStreetMap ve OpenMapTiles yok
- `pnpm ci:full` yeşil; PR'da CI (`e2e` dahil) yeşil
- **Kullanıcıya bağlı (`[k]`):** yayından sonra üretimde sınırların görünümü, atıf şeridi, istek ve bayt hacmi (ACTIVATION → "M6e.5 yayın doğrulaması")

**Çıktı kaydı (2026-10-04, uygulama; sürüm, changelog ve README yayın adımındadır; e2e ve `ci:full` bu adımda çalıştırılmadı, sunucu açılmadı):**
- Birim testleri: `@havayolu/shared` 625 (+9, `borders.test.ts`), `@havayolu/web` 748 (+12: `basemap.test.ts` +10, `map-config.test.ts` +1, `attribution.test.ts` +1: şerit sırası iki dilde), `@havayolu/providers` 122 (+1), `@havayolu/i18n` 96.
- Stil denetimi (geçici betik, MapLibre style-spec 26.4.4 `validateStyleMin`): sınırlı uydu stili, sınırları çevrilmiş koyu stil ve düz stil 0 hata. Süzgeçler aynı kütüphanenin `featureFilter`'ıyla: kara sınırı (`maritime` 0 ya da yok) kenar + kesikli; tartışmalı kenar + noktalı; deniz, il ve `claimed_by` çizgisi hiçbir katmanda.
- `pnpm typecheck` (9/9), `pnpm lint` (9/9), `pnpm typecheck:e2e`, `pnpm lint:e2e`, `pnpm format`, `pnpm check:eol` → yeşil.

- **Yayın adımı (2026-10-04):** dal v0.17.1 ile birleştirildi; v0.17.1 `releasedAt` 2026-10-04T18:36:55Z (GitHub Release). **`pnpm ci:full` → yeşil:** birim testleri web 757, shared 633, api 255, worker 200, providers 122, i18n 97, tools 74, db 47, geo 36, scripts 39; entegrasyon db 83, api 26, worker 12; E2E 120/120. `pnpm stats` → 556 dosya, 102.656 satır (93.466 kod).

## M6e.6 — API yanıtlarının sıkıştırılması (v0.18.1)
Onay: 2026-10-04 orkestratör varsayılanı (kullanıcı "soru sorma" penceresindeyken; D-093). v0.18.0'ın üretim denetiminde API yanıtlarının sıkıştırılmadan gittiği görüldü: `curl -H 'accept-encoding: gzip, br'` ile `/v1/airports?scope=listed` 111.224 bayt, `Content-Encoding` yok; web (Next) kendi sayfalarını gzip'liyor.

Hedef sürüm 0.18.1 (`main` `1b745cd` = v0.18.0'dan). Karar D-093'tedir.

**Kapsam:**
- `@fastify/compress` 9.2.0 (`fastify ^5`, 2026-08-08 yayımı; ücretsiz, MIT). API'de `helmet`'ten hemen sonra, bütün yollardan önce kaydedilir: `encodings: ['br', 'gzip']` (istemci ikisini de kabul ediyorsa br), eşik 1 KB (eklenti varsayılanı), brotli kalitesi 4 (eklenti varsayılanı). İstek gövdeleri açılmaz (`globalDecompression: false`).
- Ölçüm (üretim gövdeleri, yerel Node): haritanın havalimanı ve pist listesi (`include=runways`) 439.090 → br 75.715 / gzip 78.666 bayt; pistsiz liste 111.224 → br 24.292 (1,3 ms) / gzip 23.763 bayt; toplu hava 1.339.535 → br 68.408 (5,6 ms) / gzip 77.653 bayt; LTFM'nin 24 saatlik kaydı 65.399 → gzip 2.385 bayt.
- Tarayıcının doğrudan API'den aldıkları: harita havalimanı listesi, havalimanı penceresinin havası, METAR/TAF kaydı. Toplu hava web sunucusunun iç isteğidir (Node `fetch` sıkıştırmayı kendisi açar).
- WebSocket etkilenmez (yükseltme yanıtının gövdesi yok).

**Dosyalar:** `apps/api/package.json`, `pnpm-lock.yaml`, `apps/api/src/app.ts`, `apps/api/src/app.test.ts` (3 yeni test), `docs/DECISIONS.md` (D-093).

**Kabul komutları:**
- `pnpm --filter @havayolu/api test` → `/openapi.json` br ve gzip ile sıkışır, açılan gövde sıkıştırmasız gövdeyle aynı, `Vary: accept-encoding`, `X-Robots-Tag` korunur; `/health` (1 KB altı) ve yalnız `deflate` isteyen istemci sıkıştırmasız; gzip'li istek gövdesi açılmaz (4xx).
- `pnpm ci:full` yeşil (e2e WS ve harita akışı dahil); PR'da CI yeşil.
- **Yayından sonra (ajan):** `curl -s -o /dev/null -D - -H 'accept-encoding: gzip, br' 'https://api.havayolu.live/v1/airports?scope=listed'` → `content-encoding: br`; `--compressed` ile 503 havalimanı.

**Çıktı kaydı (2026-10-04):**
- `pnpm ci:full` → yeşil: birim web 769, shared 640, api 259 (+3), worker 200, i18n 98, geo 36 (öbürleri önbellekten aynı); entegrasyon db 84, api 26, worker 12; `test:migration-upgrade` 6 → 6; e2e 124/124.
- v0.18.0 `releasedAt` 2026-10-04T19:45:30Z (GitHub Release). `pnpm stats` → 559 dosya, 105.499 satır (kod 96.118, belge 6.166).

## M6e.7 — Ülke adları (v0.18.2)
Onay: 2026-10-05 kullanıcı: tasarım tuvalinde A seçeneği, "Saydam olsun" (tam ifade: "Saydam olsun. Önerin iyi A olan"; tuval https://claude.ai/artifact/2Hu2UcsPVQw32MbWkAU83v, A · Sessiz büyük harf; istek: "Ülke isimlerini başkentlerinin oraya büyük bir şekilde ama kötü gözükmeyecek şekilde ayarla."; yama sürümü, D-082)

Hedef sürüm 0.18.2 (`main` `aebadce` = v0.18.1'den). Karar D-095'tedir.

**Kapsam:**
- **Adlar:** her ülkenin adı başkentinin üstünde, ortalı (tek istisna Slovakya: Viyana'yla çakışmasın diye Bratislava'nın 2,5 em kuzeyinde, `labelOffsetEm`), sayfanın dilinde büyük harf (`toLocaleUpperCase`; TÜRKİYE / TÜRKIYE), Overpass 600, harf aralığı 0,32 em, satır yüksekliği 1; beyaz 0,6 saydamlıkta, koyu hale 0,85 saydamlıkta, zeminsiz. Tek GeoJSON kaynağı (`hy-country-labels`) ve üç GL symbol katmanı (kademe 3, 2, 1), havalimanı pinlerinin altında.
- **Yazı tipi:** `@fontsource/overpass` 5.3.0'ın latin ve latin-ext 600 WOFF2 dosyaları değiştirilmeden `apps/web/public/fonts/`'ta (`OFL.txt` ile); her stile `font-faces` olarak eklenir (`withMapFonts`), `glyphs` ve dış istek yok.
- **Kademe:** yüzölçümü ≥ 700.000 km² kademe 1 (Irak istisna), ≥ 85.000 km² kademe 2, altı kademe 3: 10 / 20 / 29 ülke. Boy z5'te 34 / 22 / 14 px (dar haritada 27 / 18 / 14); z3–z7 arası eğri, düşük yakınlaştırmada dik.
- **Yakınlaştırma:** kademe 1 z3'ten, 2 z3,5'ten, 3 z4,5'ten (yarım kademede belirir); z7–8 arasında silinir, z8 ve üstünde çizilmez. Açılış görünümünde ad yoktur.
- **Satır:** geniş haritada tek satır (24 em); dar haritada (≤ 767 px) kademe 1–2'nin 10 em'i aşan çok sözcüklü adları iki satır (SUUDİ / ARABİSTAN, SAUDI / ARABIA). Brifin "kırma yok" kuralından tek ayrılık budur (D-095).
- **Hale:** boyla orantılı; glif SDF payını (boy/8) aşmaz. Tasarımın geniş gölgeleri SDF'le çizilemez; yedek yol `addImage` bitmapleridir (D-095).
- **Çakışma ve sıra:** adlar yalnızca birbiriyle çakışır (6 px pay); üst kademe ve kademede Türkiye, sonra büyük ülke önce. Yerleşim modeli testi: her başkentin adı, kendi başkentinde ortalı görünümde silinmeden önce tam saydam yerleşir. Pin, kod, uçak ve uçak etiketi her zaman üstte; ada tıklama boş harita tıklamasıdır.
- **Ülkeler:** listelenen havalimanı olan ülkeler (Türkiye + 1.–3. halka) ve boşluk ülkesi Ukrayna, İsrail ve Filistin yok; KIBRIS / CYPRUS Lefkoşa'da, KOSOVA / KOSOVO Priştine'de: 59 ülke.
- **Anahtar:** "Etiketler" panelinde dördüncü grup "Ülke adları" (Gizle / Göster, varsayılan Göster), aynı `hy:map:labels` kaydında `countries`; v0.18.1 kaydı Göster okunur. Panel ipucu: "Ülke adları haritayı uzaklaştırınca görünür."
- **Vektör yedek:** OpenFreeMap stilinin kendi ülke adı katmanları çıkarılır (kimlik ya da süzgeç kuralı).
- **Test niteliği:** `.live-map__canvas` → `data-country-labels` (yerleşen adlar, en fazla 500 ms'de bir).
- Mobil değişmez (`LIVE_MAP_LAYERS` aynı).

**Dosyalar:**
- `packages/shared/src/reference/capitals.ts` (yeni: 59 başkent, yüzölçümü, Slovakya'nın ad kayması `labelOffsetEm`, `UNLABELLED_COUNTRIES`, `HOLE_COUNTRIES`, kademe kuralı), `countries.ts` (`countryLabelText`), `index.ts`; `capitals.test.ts`, `foreign.test.ts` (kapsam, boşluk ülkesi, başkent–havalimanı uzaklığı)
- `packages/shared/src/map/country-labels.ts` (yeni: kimlikler, boylar, saydamlık durakları, hale, `countryLabelPoints`, `countryLabelLayers`, `countryLabelTextOffset`), `layers.ts` (`TextSymbolLayerStyle`, `text-offset`, `match`/`literal` ifadeleri), `colors.ts` (`countryLabel`, `countryLabelHalo`, `withAlpha`, ikinci saydamlık istisnası), `index.ts`; `country-labels.test.ts`, `country-label-placement.test.ts` (yeni: MapLibre yerleşim modeli), `layers.test.ts`
- `packages/i18n/src/messages/{tr,en}.ts` (`map.labels.countries`, `countryModes`, ipucu); `i18n.test.ts`
- `apps/web/public/fonts/` (iki WOFF2 ve `OFL.txt`)
- `apps/web/src/components/map/map-fonts.ts` (yeni), `country-labels.ts` (yeni: kaynak verisi, `CountryLabelOverlay`), `map-controller.ts` (`overlayLayers`, kurulum, ayar, boy, test niteliği), `basemap.ts` (`withoutBasemapCountryLabels`, `NON_BASEMAP_SOURCES`); `map-fonts.test.ts`, `country-labels.test.ts`, `map-controller.test.ts`, `basemap.test.ts`
- `apps/web/src/lib/map/label-settings.ts` (`countries`), `components/map/panels/label-settings-control.tsx` (dördüncü grup), `use-label-settings.ts`, `app/globals.css` (açıklamalar); `label-settings.test.ts`, `panels.test.ts`
- `apps/web/src/lib/locale-routing.ts` (`fonts`); `locale-routing.test.ts`
- `e2e/support.ts` (`countryLabels`, `zoomOut`, `zoomIn`), `e2e/map-pixels.ts` (yeni: pin ucundaki kesit), `e2e/tests/live-map.spec.ts`
- Belgeler: D-095, `docs/spec/domain.md` (Harita etiketleri), `docs/spec/data-sources.md` §5b, `ATTRIBUTION.md`, `docs/ACTIVATION.md` ("M6e.7 yayın doğrulaması")

**Kabul komutları:**
- `pnpm --filter @havayolu/shared test` → 59 başkent, kapsam = listelenen ülkeler + TR − IL + UA; kademeler 10 / 20 / 29 ve brifin örnekleri; katman kimlikleri, sırası, süzgeçleri, yakınlaştırmaları; boylar (z5'te 34 / 22 / 14, dar 27 / 18 / 14); hale her durakta glif payının içinde; saydamlık durakları; adlar TR/EN büyük harf (TÜRKİYE, KIBRIS, KOSOVA / TÜRKIYE, CYPRUS, ALGERIA); yerleşim modelinde her başkent (1400 × 900 ve 390 × 844, TR/EN) z7'den önce tam saydam yerleşir, kaymasız SLOVAKYA hiç yerleşmez, kayma başka adı silmez
- `pnpm --filter @havayolu/i18n test` → "Ülke adları", Gizle / Göster, ipucu; İngilizce Country names, Hide / Show
- `pnpm --filter @havayolu/web test` → `withMapFonts` (mutlak adres, glif yok), yazı tipi dosyaları ve lisans paketle bayt bayt aynı, aralıklar `600.css`'tekiyle aynı, her ad yazı tipinde ve 24 em'in altında, dar haritada en geniş satır ≤ %70; ayar (`countries`, v0.18.1 kaydı, geçersiz değer); panel dört grup; katman sırası; katmanlar yokken harita çağrısı yok; vektör stilin ülke adları çıkar (Dark, Liberty, Protomaps biçimleri); `/en/fonts/*` 404
- `pnpm typecheck`, `pnpm lint`, `pnpm typecheck:e2e`, `pnpm lint:e2e`, `pnpm format`, `pnpm check:eol`
- `pnpm exec playwright test -c e2e/playwright.config.ts e2e/tests/live-map.spec.ts` → açılışta `data-country-labels` boş ve yazı tipi isteği yok; Tahran'da z5'te İRAN (İSRAİL yok), aynı kökenden latin-ext WOFF2, `.pbf`/OpenFreeMap isteği yok; pin ucundaki kesitte ad çizilir ve pinin kırmızı pikselleri ad açıkken de görünür (bu kesit çizim sırasını ayırt etmez; adların pinlerin altında olduğu birim testindedir: `overlayLayers` sırası); Gizle saklanır ve yenilemede kalır; pine tıklama OIII penceresi; z9'da ad yok; İngilizce haritada TÜRKIYE, Country names Hide / Show
- `pnpm ci:full` yeşil; PR'da CI (`e2e` dahil) yeşil
- **Kullanıcıya bağlı (`[k]`):** yayından sonra uyduda görünüm (hale gücü, açık çölde okunurluk, 375 px), kod kutularının adların üstünde görünümü, koyu yedekte adların tekliği (ACTIVATION → "M6e.7 yayın doğrulaması")

**Çıktı kaydı (2026-10-05, uygulama; sürüm, changelog ve README yayın adımındadır):**
- Birim testleri: `@havayolu/shared` 666 (+26: `capitals.test.ts`, `country-labels.test.ts`, `foreign.test.ts` +3, `layers.test.ts` +2), `@havayolu/web` 792 (+23: `country-labels.test.ts` 10, `map-fonts.test.ts` 7, `basemap.test.ts` +4, `label-settings.test.ts` +1, `map-controller.test.ts` +1), `@havayolu/i18n` 98 (sabitlenen metinler genişledi).
- `pnpm typecheck` (9/9), `pnpm lint` (9/9), `pnpm typecheck:e2e`, `pnpm lint:e2e`, `pnpm format` (`format:check` temiz), `pnpm check:eol` → yeşil.
- E2E (yerel, `pnpm dev:replay`, yerel test stili): `live-map.spec.ts` 23/23 (4 kurulum + 19); aynı dalda `live-map`, `foreign-airports` ve `weather` birlikte 73/73. `pnpm ci:full` bu adımda çalıştırılmadı.
- Görsel denetim (geçici Playwright betiği, depoya girmedi): Tahran z5'te ERMENİSTAN, AZERBAYCAN, IRAK, İRAN, ÜRDÜN, KUVEYT, SURİYE, TÜRKMENİSTAN yerleşti; Belgrad z5'te 14 ad, Karadağ ve Kosova yer bulamayınca çıkmadı (üst üste binme yok); 375 px'te Riyad z5 SUUDİ / ARABİSTAN iki satır ortalı. Açık zeminde (çöl tonu ve yeşil) hale kutusuz, temiz bir kenar; harfin içi zeminle karışır (D-095), pin harfin üstünde.
- **İnceleme düzeltmeleri (2026-10-05):** (1) SLOVAKYA, AVUSTURYA yüzünden silinmeden önce hiç yerleşmiyordu (Bratislava Viyana'ya ~55 km, 0,06° güneyinde): başkentler tablosuna belgeli kayma (`labelOffsetEm`, yalnız SK [0, −2,5] em), katmana koda göre `text-offset`; yeni yerleşim modeli testi (`country-label-placement.test.ts`, MapLibre 6.11.2 kuralı) her başkentin z7'den önce tam saydam yerleştiğini, kaymasız SLOVAKYA'nın hiç yerleşmediğini ve kaymanın başka adı silmediğini denetler. Kayma geçici olarak kaldırılınca test SK 1400×900 tr'de kırıldı. Stil belirtimi (`@maplibre/maplibre-gl-style-spec` 26.4.4) ifadeyi geçerli sayar ve SK için [0, −2,5], öbürleri için [0, 0] verir. (2) Tahran e2e'sindeki pin kesiti çizim sırasını ayırt edemiyordu (pinin kırmızısı İRAN'ın R ile A harfleri arasındaki boşlukta): test adı, açıklaması, `e2e/map-pixels.ts`, D-095 ve bu plandaki kabul satırı yalnızca denetleneni söyler; sıra `overlayLayers` birim testindedir. Sonuç: `@havayolu/shared` 673 (+7: yerleşim modeli 5, `country-labels.test.ts` +1, `capitals.test.ts` +1), `@havayolu/web` 792, `@havayolu/i18n` 98; `pnpm format`, `pnpm lint`, `pnpm typecheck`, `pnpm typecheck:e2e`, `pnpm lint:e2e`, `pnpm check:eol` yeşil. E2E bu adımda yeniden çalıştırılmadı: e2e dosyalarında yalnız test adı ve açıklamalar değişti; yeni `text-offset` yalnız kademe 3'te SK'yı kaydırır, e2e ise Tahran ve IST görünümlerini denetler (yayından önce `ci:full` gerekir).

**Çıktı kaydı (2026-10-05, yayın adımı):**
- v0.18.1 `releasedAt` 2026-10-04T20:32:07Z (GitHub Release). Sürüm 0.18.2; changelog, README (TR/EN) güncellendi.
- `pnpm ci:full` → yeşil: birim web 792, shared 673, api 259, worker 200, providers 127, i18n 98, tools 74, db 50; entegrasyon db 84, api 26, worker 12; `test:migration-upgrade` 6 → 6; e2e 125/125.
- `pnpm stats` → 572 dosya, 108.897 satır (kod 99.129, belge 6.316).

## M6e.8 — Ülke adları sınır içinde
Onay: 2026-10-05 kullanıcı: "Ülke isimlerini ülke sınırları dışına taşırma. 2 kelime ise alt alta yaz. Sınır içinde kalsın ülke isimleri" (v0.18.2 yayınından sonra; ayrıntılar orkestratör varsayılanı, kullanıcı öğlene kadar soru istemedi; yama sürümü, D-082)

Hedef sürüm yayın adımında belirlenir (dal `p1/map-country-fit`, `main` `787eb97` = v0.18.2'den). Karar D-096'dadır.

**Kapsam:**
- **Sınırın içinde:** adın görünür kutusu (bütün satırlar, harf aralığı, hale, 3 px + 2 km pay) ülkenin kara poligonunun içine sığmadıkça ad çizilmez; kıyı da sınırdır. Ad ilk sığdığı yakınlaştırmada (0,25 adım, kademenin en küçüğünden önce değil) belirir; hiç sığmayan Bahreyn, Lüksemburg ve Malta yazılmaz.
- **Çapa:** başkent her dilde ve genişlikte en erken sığmanın en çok 0,5 kademe gerisindeyse ad başkentte; değilse dört bileşimde de en erkenin en çok 0,25 gerisinde sığan, başkente en yakın tek ortak nokta. Slovakya kayması kalkar.
- **Satır:** her sözcük ayrı satırda, ortalı, her genişlikte (SUUDİ / ARABİSTAN, BİRLEŞİK / ARAP / EMİRLİKLERİ, BOSNA / HERSEK, BOSNIA AND / HERZEGOVINA). Dar haritanın 10 em kuralı kalkar.
- **Geometri:** Natural Earth 4.1.0 1:10m (`world-atlas@2.0.2`, `topojson-client@3.1.0`; yalnızca `tools`'un geliştirme bağımlılığı). Sadeleşmiş alt küme `tools/fixtures/naturalearth/countries.json` (yalnızca test). Geometri çizilmez; hiçbir şey indirilmez.
- **Tablo:** `packages/shared/src/map/country-label-placements.ts` (üretilmiş): ülke × dil × düzen → [boylam, enlem, ilk yakınlaştırma] ya da `null`, ad (CLDR'dan, ölçülen metin).
- **Katmanlar:** her (kademe, ilk yakınlaştırma) için bir symbol katmanı (40): `minzoom` = ilk yakınlaştırma, yalnızca yakınlaştırmaya bağlı boy ve hale, `text-allow-overlap` true (adlar kendi ülkelerinde, örtüşemez). Web dil ve genişlik değişince kaynağı, genişlik değişince boy ve hale eğrilerini yeniler.
- Kademe boyları, renkler, hale, silinme (z7–8), anahtar, İsrail/Filistin kuralı, pinlerin üstte olması ve yerel test stili değişmez.

**Dosyalar:**
- `tools/package.json` (`world-atlas` 2.0.2, `topojson-client` 3.1.0, `@havayolu/shared`), `pnpm-lock.yaml`, kök `package.json` (`country-labels`, `country-labels:fixture`)
- `tools/src/country-labels/` (yeni): `geometry.ts`, `natural-earth.ts`, `label-model.ts`, `placement.ts`, `cli.ts`, `topojson-client.d.ts`; testler `geometry.test.ts`, `natural-earth.test.ts`, `label-model.test.ts`, `placement.test.ts`
- `tools/fixtures/naturalearth/countries.json` (yeni), `tools/README.md`, `tools/fixtures/README.md`
- `packages/shared/src/map/country-labels.ts` (40 katman, `countryLabelLines`, `countryLabelPoints(locale, compact)`, `countryLabelHaloCurve`, saydamlık ilk yakınlaştırmadan), `country-label-placements.ts` (yeni, üretilmiş), `layers.ts` (`text-offset` tipi kalktı), `index.ts`; `reference/capitals.ts` (`labelOffsetEm` kalktı); testler `country-labels.test.ts`, `capitals.test.ts`; `country-label-placement.test.ts` silindi (modeli tools'a taşındı)
- `apps/web/src/components/map/country-labels.ts`, `map-controller.ts` (açıklamalar); testler `country-labels.test.ts`, `map-controller.test.ts`, `map-fonts.test.ts`
- `e2e/country-label-expectations.ts` (yeni; tools testi tablodan doğrular), `e2e/map-pixels.ts` (`clipImage`, `changedPixels`), `e2e/tests/live-map.spec.ts`
- `turbo.json` (`@havayolu/tools#test`'in önbellek girdileri: shared, geo, providers kaynakları, e2e beklentileri, `apps/web/package.json`)
- Belgeler: D-096 (D-095'e işaret satırı), `docs/spec/domain.md`, `docs/spec/data-sources.md` §5b ve yeni §5c, `ATTRIBUTION.md`, `docs/REFERENCES.md`, `docs/ACTIVATION.md` (M6e.7 kapandı, "M6e.8 yayın doğrulaması")

**Kabul komutları:**
- `pnpm country-labels:fixture` ve `pnpm country-labels` (çevrimdışı) → dosyalarda fark yok
- `pnpm --filter @havayolu/tools test` → sürüklenme, içerme ve süreklilik, en küçüklük, çapa kuralı, örtüşme yok, Kırım, hiç sığmayanlar (BH LU MT), e2e beklentileri, ödünleşim listeleri; fixture yeniden üretimi, birimler, sapma bütçesi; model değerleri yazı tipi dosyalarından; geometri
- `pnpm --filter @havayolu/shared test`, `pnpm --filter @havayolu/web test`
- `pnpm typecheck`, `pnpm typecheck:scripts`, `pnpm lint`, `pnpm typecheck:e2e`, `pnpm lint:e2e`, `pnpm format`, `pnpm check:eol`
- `pnpm exec playwright test -c e2e/playwright.config.ts e2e/tests/live-map.spec.ts` → Tahran z5'te İRAN, IRAK, TÜRKMENİSTAN (hepsi gelene kadar beklenir); AZERBAYCAN, ERMENİSTAN, KUVEYT, KATAR, BAE yok; İRAN'ın değişen pikselleri modelin kutusunda (±1 px); İRAN'ın kutusundaki IKA pini görünür kalır ve tıklanınca OIIE penceresi açılır; z4'te TÜRKMENİSTAN kaybolur; z9'da ad yok; İngilizcede TÜRKIYE
- `pnpm ci:full` yeşil; PR'da CI (`e2e` dahil) yeşil
- **Kullanıcıya bağlı (`[k]`):** yayından sonra uydu üstünde adların sınırların içinde görünümü (ACTIVATION → "M6e.8 yayın doğrulaması")
- **Açık iş (ajan, ağ gerekir):** Natural Earth kullanım şartları sayfasını ve world-atlas deposunu açıp REFERENCES.md'deki "doğrulanmadı" notunu kaldırmak.
- **Açık iş (kullanıcı onayı):** iki komut (`pnpm country-labels:fixture`, `pnpm country-labels`) yayın adımında CLAUDE.md Komutlar tablosuna eklendi. CLAUDE.md'deki "İzinli → referans" listesine Natural Earth eklemek bir kural değişikliğidir; kullanıcının onayı beklenir (ACTIVATION "Natural Earth izinli kaynaklar listesine").

**Çıktı kaydı (2026-10-05, uygulama; sürüm, changelog ve README yayın adımındadır):**
- `pnpm country-labels:fixture` → 59 ülke, 39.984 nokta; `pnpm country-labels` → 0,85 sn (Node 24.16.0, ICU 78.3); dört bileşimde 56 ad, hiç sığmayan BH LU MT; 17 ülke başkentte, 42 ülke ortak noktada (ortanca 99 km, en çok 654 km, CEZAYİR).
- Birim testleri: `@havayolu/tools` 121 (+47), `@havayolu/shared` 669, `@havayolu/web` 792; öbürleri değişmedi (api 259, worker 200, providers 127, i18n 98, db 50, geo 36).
- `pnpm typecheck` (9/9), `pnpm typecheck:scripts`, `pnpm lint` (9/9), `pnpm typecheck:e2e`, `pnpm lint:e2e`, `pnpm format`, `pnpm check:eol` → yeşil.
- E2E (yerel, `pnpm dev:replay`, yerel test stili): `live-map.spec.ts` 23/23 (4 kurulum + 19). Yerel ölçüm: İRAN'ın (Tahran z5) değişen pikselleri x 20–135, y 20–57; modelin kutusu x 20–138, y 20,1–59,8 (kesit koordinatı). `pnpm ci:full` bu adımda çalıştırılmadı.
- Görsel denetim (geçici Playwright betiği, depoya girmedi; ekran görüntülerinin üstüne Natural Earth sınırları çizildi): Ankara z4/5/6, Belgrad z5/6, Sofya z5, Atina z6, Beyrut z5/6/7, Doha z5/6 (1280 px) ve Ankara, Riyad (375 px), Türkçe ve İngilizce; hiçbir ad sınırını ya da kıyıyı aşmıyor.

**İkinci inceleme düzeltmeleri (2026-10-05):**
- **Model:** harfler 0,5 birim sağda ve aşağıda modelleniyordu (`leftAdjustment` dörtgen payıyla götürülmemişti, taban çizgisi 22,5 yerine 22); 14 yerleşim 3 px + 2 km payının en çok 0,43 px altındaydı. Model düzeltildi, sabitler MapLibre kaynağıyla testte karşılaştırılır; tablo yeniden üretildi: 14 çapa kaydı, 13 ilk yakınlaştırma değişti. İRAN Tahran'dan 32 km güneydeki ortak noktaya geçti (Tahran'da tr geniş haritada z3,75, ortak noktada z3): e2e'nin pin kesiti ve tıklaması İRAN'ın kutusundaki IKA pinine taşındı (`IKA_PIN_Z5`).
- **Rusya'nın 180. meridyen şeridi:** halkalar ve yaylar sürekli kılınıyor; fixture'da yalnız RU değişti (39.975 nokta). Testler: kenar boyu, Rusya İskandinavya'yı ve denizi içermez, ülkeler örtüşmez (eski fixture'da 309 İsveç noktası Rusya'nın içindeydi).
- **Hale geçişi:** `text-halo-width-transition` ve `text-halo-blur-transition` 0 ms (dar haritaya geçerken hale küçük glifin payını aşmasın).
- **e2e yarışı:** z5'te beklenen adların hepsi (İRAN, IRAK, TÜRKMENİSTAN), z4'te İRAN ve IRAK ile TÜRKMENİSTAN'ın yokluğu birlikte beklenir.
- **turbo:** `@havayolu/tools#test`'in girdilerine shared, geo, providers kaynakları, e2e beklentileri ve `apps/web/package.json` eklendi (`turbo run test --filter=@havayolu/tools --dry=json`: 138 girdi, 68'i shared).
- **Belgeler:** data-sources.md §5c ve fixtures README tam kırpma kutusu (20° B–90° D, 8–72° K); ACTIVATION M6e.8 maddesine M6e.7'den kalan denetimler (z7–8 silinme ve IST açılışı, İsrail ve Filistin, soluk küçük adlar, hale, kod kutuları) ve İRAN'ın yeri; ACTIVATION'a "CLAUDE.md eki" (kullanıcı onayı).

**Çıktı kaydı (2026-10-05, ikinci inceleme düzeltmeleri):**
- `pnpm country-labels:fixture` → 59 ülke, 39.975 nokta (yalnız RU değişti); `pnpm country-labels` → 0,89 sn (Node 24.16.0, ICU 78.3); dört bileşimde 56 ad, hiç sığmayan BH LU MT; 15 ülke başkentte, 44 ülke ortak noktada (ortanca 76 km, %90 358 km, en çok 654 km, CEZAYİR).
- Birim testleri: `@havayolu/tools` 126 (+5), `@havayolu/shared` 669, `@havayolu/web` 792; öbürleri değişmedi (api 259, worker 200, providers 127, i18n 98, db 50, geo 36).
- `pnpm format`, `pnpm lint` (9/9), `pnpm typecheck` (9/9), `pnpm typecheck:scripts`, `pnpm test` (9/9), `pnpm typecheck:e2e`, `pnpm lint:e2e`, `pnpm check:eol` → yeşil.
- E2E (yerel, `pnpm dev:replay`, yerel test stili): `live-map.spec.ts` 23/23 (4 kurulum + 19), 36 sn. Yerel ölçüm (geçici günlük satırıyla, depoya girmedi): İRAN'ın değişen pikselleri kesitte x 14–126, y 14–48; modelin kutusu x 11,8–129,8, y 11,6–51,3 (boşluk 2,2 / 2,8 / 2,4 / 2,3 px; eski model 2,9 / 2,1 / 3,1 / 1,6 px verirdi); IKA pininin kırmızı pikselleri ad açıkken ve kapalıyken 75. `pnpm ci:full` bu adımda çalıştırılmadı.

**Çıktı kaydı (2026-10-05, yayın adımı):**
- Dal `17d40e3` sonra `origin/main` v0.19.0 ile birleştirildi (`dd82588`). Çakışmalar: plan tablosu, `tools/package.json` (iki tarafın geliştirme bağımlılıkları birlikte), lockfile (`main`'inki + `pnpm install`), iki README (iki bölüm birlikte). v0.19.0 `releasedAt` 2026-10-05T02:25:50Z (GitHub Release). Sürüm 0.19.1.
- CLAUDE.md Komutlar tablosuna `pnpm country-labels:fixture` · `pnpm country-labels` satırı eklendi. "İzinli → referans" listesi kullanıcının onayına bırakıldı (ACTIVATION).
- `pnpm ci:full` → yeşil: birim tools 296, web 792, shared 669, api 259, worker 200, providers 127, i18n 98, db 50; entegrasyon db 84, api 26, worker 12, tools 9; `test:migration-upgrade` 6 → 6; e2e 125/125.
- `pnpm stats` → 610 dosya, 119.046 satır (kod 108.692, belge 6.871).

## M6e.9 — Ülke adları daha belirgin, boş yerde (yama)
Onay: 2026-10-05 kullanıcı: "boyut iyi fakat az biraz daha belirgin olsun ülke isimleri. boşlukta bir yerde yazsa da olur. mesela rusya ve italya iç içe olmuş yazıları." (v0.19.1 ve v0.20.0 yayınından sonra; ayrıntılar orkestratör varsayılanı, itiraz edilebilir; yama sürümü, D-082)

Hedef sürüm yayın adımında belirlenir (dal `p1/map-country-clear`, `main` `1afaa28` = v0.20.0'dan). Karar D-099'dadır.

**Kapsam:**
- **Daha belirgin:** yazı beyaz 0,6 → 0,85, hale 0,85 → 0,9; hale payının 0,85'i genişlik, 0,1'i yumuşaklık (önce 0,65 ve 0,3; dış uç yine boy / 8'in içinde). A seçeneğinin karakteri kalır.
- **Boş yer:** adın görünür kutusuna, yazıldığı yakınlaştırmalarda, listelenen 503 havalimanının pini ve (z5'ten) kodu (pin başının sağında ve solunda: web'in ilk iki adayı) girmez. Engeller commit'li OurAirports fixture'ının 2026-10-01 kopyasından üretimin liste kuralıyla çıkar; yeni fixture yok. Üretimin gece yenilenen listesiyle karşılaştırma kullanıcıdadır (ACTIVATION "Ülke adlarının engelleri").
- **KIBRIS** kullanıcının D-095 kararıyla Lefkoşa'da kalır (boş yer kuralının tek istisnası; Ercan pini adın üstünde).
- **Çapa kuralı (başkent kuralının yerine):** her bileşimde en erkenin en çok 1,5 kademe gerisinde sığan, çakışması 0 noktalar; yoksa en erkenin en çok 0,25 gerisinde sığanlar. Sıra: çakışma, ilk sığma düzeylerinin toplamı, görsel merkeze (erişilmezlik kutbu) uzaklık, kuzey, batı. Ülke başına tek ortak nokta.
- Boy, kademe, yakınlaştırma aralıkları, silinme, sınır içi ve sözcük başına satır kuralları, anahtar, katman yapısı değişmez. Sürüm, `entries.ts`, `CHANGELOG.md` ve README yayın adımındadır.

**Dosyalar:**
- `tools/src/country-labels/airport-pins.ts` (yeni: listelenen havalimanları, pin ve kod kutusu, dizinli arama), `placement.ts` (boş yer kuralı, görsel merkez, tablo değişkenleri), `label-model.ts` (`visibleBoxAt`), `geometry.ts` (izdüşümde sınıra uzaklık), `cli.ts` (özet; `airports` alt komutu); testler `airport-pins.test.ts` (yeni), `placement.test.ts`, `geometry.test.ts`
- `packages/shared/src/map/country-label-placements.ts` (yeniden üretildi), `country-labels.ts` (saydamlıklar, hale payları, açıklama), `colors.ts` (açıklama), `reference/capitals.ts` (açıklama: ad başkente bağlı değil); test `country-labels.test.ts`
- `e2e/country-label-expectations.ts` (İRAN'ın yeni kutusu, z3 listesi, kesirli `minzoom` adları), `e2e/tests/live-map.spec.ts` (IKA kesiti ad açıkken ve kapalıyken aynı; z4 ve z3 adımları; İngilizce açıklaması)
- `turbo.json` (`@havayolu/tools#test` girdilerine `packages/db/src` ve web `labels.ts`)
- Belgeler: D-099 (D-096 ve D-095'e işaret satırları), `docs/spec/domain.md`, `docs/spec/data-sources.md` §5b ve §5c, `tools/README.md`, `tools/fixtures/README.md`, `docs/ACTIVATION.md` ("M6e.9 yayın doğrulaması", "Ülke adlarının engelleri", M6e.8 satırından taşınanlar), bu plan

**Kabul komutları:**
- `pnpm country-labels` (çevrimdışı) → tablo commit'lenenle aynı; özet: 54 ülke boş yerde, 1 kalabalık (TR), 1 başkentte (CY), 3 gizli (BH LU MT)
- `pnpm --filter @havayolu/tools test` → sürüklenme (fixture'lar), çapa kuralı ve türler, gecikme tablosu, boş yer (TÜRKİYE ve KIBRIS dışında hiçbir adın kutusuna ilk yakınlaştırmasından z7,95'e 0,05 adımla pin ya da kod, sağda ya da solda, girmez), sol kod kutusu ayrıca, İTALYA ve RUSYA, KIBRIS Lefkoşa'da, TÜRKİYE'nin çakışmaları, görsel merkez, e2e beklentileri, Türkiye çevresi; 503 havalimanı, pin ve iki kod kutusu, web sabitleri ve kodun dört adayının sırası, dizinli arama
- `pnpm --filter @havayolu/shared test`, `pnpm test`
- `pnpm format`, `pnpm lint`, `pnpm typecheck`, `pnpm typecheck:scripts`, `pnpm typecheck:e2e`, `pnpm lint:e2e`, `pnpm check:eol`
- `pnpm exec playwright test -c e2e/playwright.config.ts e2e/tests/live-map.spec.ts` → Tahran z5'te İRAN, IRAK, TÜRKMENİSTAN; İRAN'ın değişen pikselleri modelin kutusunda (±1 px); IKA kesiti ad açıkken ve kapalıyken aynı, IKA tıklanır; z4'te AFGANİSTAN, SURİYE, TÜRKİYE gelir, ÖZBEKİSTAN yok; z3'te kesirli adlar kaybolur, İRAN kalır; z9'da ad yok; İngilizcede TÜRKIYE
- `pnpm ci:full` yeşil; PR'da CI (`e2e` dahil) yeşil
- **Kullanıcıya bağlı (`[k]`):** yayından sonra uydu üstünde adların belirginliği ve boş yerde durması (ACTIVATION → "M6e.9 yayın doğrulaması")

**Çıktı kaydı (2026-10-05, ilk uygulama; inceleme düzeltmeleri aşağıda):**
- `pnpm country-labels` → 2,2 sn (Node 24.16.0, ICU 78.3), 503 havalimanı pini; dört bileşimde 56 ad, hiç sığmayan BH LU MT; 55 ülke boş yerde, TÜRKİYE kalabalıkta (çakışma 55 / 50 / 55 / 50; z5'te geniş haritada LTAU ve LTAZ, z5,05'ten sonra 0).
- z5'te pin ve kod çakışması (geniş harita): Türkçe 35 → 2, İngilizce 34 → 2 (yalnız TÜRKİYE 2 → 2). İTALYA ve RUSYA her yakınlaştırmada 0 (önce z5'te 2 ve 6).
- Yeni çapalar: İTALYA 12,48° D, 42,84° K (z5,25; İngilizce geniş z4,75), RUSYA 57,51° D, 61,77° K (z3), TÜRKİYE 34,8° D, 39,4° K (z3,25), İRAN 55,6° D, 34° K (z3), YUNANİSTAN 21,6° D, 39,51° K (z6; İngilizce z5,5), ROMANYA 25,5° D, 45,4° K (z4,25).
- Birim testleri: `@havayolu/tools` 305 (+9), `@havayolu/shared` 670 (+1); öbürleri değişmedi (web 792, api 260, worker 201, providers 132, i18n 98, db 50, geo 36).
- `pnpm format`, `pnpm lint` (9/9), `pnpm typecheck` (9/9), `pnpm typecheck:scripts`, `pnpm test` (9/9), `pnpm typecheck:e2e`, `pnpm lint:e2e`, `pnpm check:eol` → yeşil.
- E2E (yerel, `pnpm dev:replay`, yerel test stili): `live-map.spec.ts` 23/23 (4 kurulum + 19; iki koşu, 39 ve 35 sn). `pnpm ci:full` bu adımda çalıştırılmadı (yerel Docker altyapısı başka bir iş akışıyla paylaşılıyor).

**Çıktı kaydı (2026-10-05, inceleme düzeltmeleri; sürüm, changelog ve README yayın adımındadır):**
- Sol kod kutusu engel sayıldı (`chipLeftBoxPx`, `airportCodeSides: ['right', 'left']`); KIBRIS Lefkoşa'da sabit (`CAPITAL_ANCHORED_CODES`, `capitalAnchored: ['CY']`); "liste üretimdekiyle aynıdır" düzeltildi, `cli.ts airports` ve ACTIVATION "Ülke adlarının engelleri" eklendi; data-sources.md §5b, `capitals.ts` açıklaması, D-095 işaret satırı, M6e.8 satırı güncellendi.
- `pnpm country-labels` → 2,4 sn (Node 24.16.0, ICU 78.3), 503 havalimanı pini; dört bileşimde 56 ad, hiç sığmayan BH LU MT; 54 ülke boş yerde, TÜRKİYE kalabalıkta (çakışma 57 / 50 / 57 / 50; z5'te geniş haritada ASR ve NAV kodlarının sağdaki ve soldaki kutusu, z5,05'ten sonra 0), KIBRIS başkentte (Ercan; 12 / 12 / 9 / 9).
- Kayan çapalar (ilk uygulamaya göre): İTALYA 11,4° D, 46,2° K (Trentino; Türkçe geniş z5,25, dar z5, İngilizce geniş z4,75), BOSNA-HERSEK 17,44° D, 44,28° K (z5,25), BELÇİKA 3,92° D, 51,04° K (z5,25), BULGARİSTAN 24,99° D, 43,33° K (z5,5), YUNANİSTAN 21,33° D, 39,51° K (z6,5), HIRVATİSTAN 16,68° D, 45,54° K (z5,5), MACARİSTAN 18,55° D, 47,25° K (z5,5), KUVEYT 47,48° D, 29,7° K (z6,25), KIBRIS 33,36° D, 35,17° K (z6,25; İngilizce z6,5).
- z5'te pin ve kod çakışması (geniş harita; pin, sağdaki ve soldaki kod sayılarak): Türkçe 58 → 4, İngilizce 57 → 4 (yalnız TÜRKİYE 4 → 4).
- Birim testleri: `@havayolu/tools` 308 (+3: sol kod kutusu, adlarda sol kod, KIBRIS), `@havayolu/shared` 670; öbürleri değişmedi (web 792, api 260, worker 201, providers 132, i18n 98, db 50, geo 36).
- `pnpm format`, `pnpm lint` (9/9, önbelleksiz), `pnpm typecheck` (9/9, önbelleksiz), `pnpm test` (9/9, önbelleksiz), `pnpm typecheck:e2e`, `pnpm lint:e2e`, `pnpm check:eol` → yeşil.
- E2E (yerel, `pnpm dev:replay`, yerel test stili): `live-map.spec.ts` 23/23 (34,7 sn). `pnpm ci:full` çalıştırılmadı (yerel Docker altyapısı başka bir iş akışıyla paylaşılıyor).

**Çıktı kaydı (2026-10-05, yayın adımı):**
- Dal `734641c` sonra `origin/main` v0.21.0 ile birleştirildi (`45677a7`; çakışma `turbo.json`, `tools/README.md` ve DECISIONS'ta, iki tarafın eklemeleri birlikte). v0.21.0 `releasedAt` 2026-10-05T18:53:30Z (GitHub Release). Sürüm 0.21.1.
- `pnpm ci:full` → yeşil: birim tools 368, shared 686, web 827, worker 292, api 278, providers 132, i18n 98, db 64, geo 36; entegrasyon db 106, worker 17, api 30, tools 14; `test:migration-upgrade` 8 → 8; e2e 127/127.
- `pnpm stats` → 668 dosya, 136.876 satır (kod 126.052, belge 7.300).

## M6e.10 — Askerî üsler haritada gösterilmez; açılış yakınlaştırması 8 (yama)
Onay: 2026-10-06 kullanıcı: "askeri havalimanlarını kaldır haritadan." (kapsamın yalnız harita olması, `?havalimani=` davranışı, uçak listesinin üsleri kullanmaya devam etmesi ve ülke adlarının engelleri orkestratör varsayılanıdır, itiraz edilebilir; yama sürümü, D-082)

Sürüm v0.22.1 (dal `p1/map-no-military`, `main` `8a7a5ea` = v0.21.1'den; v0.22.0'ın dalı birleştirildi). Kararlar D-103 ve D-104'tedir.

**Kapsam:**
- **Harita:** beş askerî hava üssünün (D-084: İncirlik, Afyon, Bandırma, Eskişehir, Çiğli) pini, kodu, penceresi ve "Havalimanları" listesinde satırı yok. `?havalimani=<üs>` haritayı yine üssün yerinde açar, pencere açılmaz.
- **Değişmeyenler:** havalimanları listesi, istasyon sayfaları, API (`scope=listed` 503 kayıt); site haritası ve llms.txt (üsler `noindex`'tir, D-084: oralarda zaten yoklar). Uçak listesinin tahmini durumu ve konumu bütün listeyi kullanır (üsse yaklaşan uçak doğru yere göre yazılır). Ankara (Etimesgut) ve yurt dışındaki ortak sivil-askerî havalimanları (Bağdat, Podgorica, Cuxhaven/Nordholz) sivildir, haritada kalır.
- **Ülke adları:** engeller haritada pini çizilen 498 havalimanıdır (503 − 5 üs); tablo `pnpm country-labels` ile yeniden üretildi. Yalnız TÜRKİYE'nin çapası kaydı.
- **Açılış yakınlaştırması (D-104; kullanıcı 2026-10-06, İstanbul ekran görüntüsüyle: "başlangıçta zoom oranı bu olsun."):** masaüstünde 8,5 → 8; merkez IST/LTFM ve telefon kuralı (~7,8) aynı. Harita kurulmadan aboneliğin kutusu ±2,7° × ±1,2°'ye genişler (1920×1080'de z8 görünümü).
- Sürüm, `entries.ts`, `CHANGELOG.md` ve README yayın adımındadır.

**Dosyalar:**
- `apps/web/src/components/map/camera.ts` (`INITIAL_MAX_ZOOM` 8, `INITIAL_BOUNDS`); test `map-controller.test.ts` (1280×720, 1920×1080, 1915×910 → 8; kutu 1920×1080 görünümünü kapsar); `e2e/tests/live-map.spec.ts` (açıklama)
- `packages/shared/src/reference/military-airfields.ts` (`MILITARY_AIRFIELD_ICAOS`, `isMilitaryAirfield`, `mapShownAirports`: haritada gösterilenlerin tek kuralı; ad tablolarını içe aktarmaz, web haritası ve ülke adlarının engelleri ortak kullanır); test `reference.test.ts`
- `apps/web/src/components/map/airport-data.ts` (`airportLinkCenter`), `live-map.tsx` (harita, pencere ve liste haritadaki listeden; uçak listesi ve `?havalimani=` bütün listeden); test `airport-data.test.ts`
- `tools/src/country-labels/airport-pins.ts` (`mapAirportPins` = listenin `mapShownAirports`'u), `cli.ts` (tablo haritadaki pinlerle; `airports` yine bütün liste), `placement.ts` (üretilen dosyanın açıklaması); testler `airport-pins.test.ts`, `placement.test.ts`
- `packages/shared/src/map/country-label-placements.ts` (yeniden üretildi), `country-labels.ts` (açıklama: engeller haritadaki havalimanları); test `country-labels.test.ts`
- `e2e/support.ts` (`MILITARY_AIRFIELD`, `MILITARY_AIRFIELD_NEIGHBOUR`), `e2e/label-canvas.ts` (`paintedPixelsIn`), `e2e/tests/live-map.spec.ts` (yeni test; 375 px TÜRKIYE açıklaması)
- Belgeler: D-103, `docs/spec/domain.md` (Harita etiketleri: yeni madde, ülke adları; uçak listesinin konumu), `docs/spec/data-sources.md` ("Listelenen havalimanları" ve §5c), `tools/README.md`, `tools/fixtures/README.md`, `docs/ACTIVATION.md` ("Ülke adlarının engelleri"; M6e.9 doğrulamasının (3) TÜRKİYE maddesi), bu plan

**Kabul komutları:**
- `pnpm country-labels` (çevrimdışı) → tablo commit'lenenle aynı; 498 havalimanı pini; 54 ülke boş yerde, 1 kalabalık (TR), 1 başkentte (CY), 3 gizli (BH LU MT)
- `pnpm test` → shared (beş üs, tablonun `military` kaynağı), web (haritadaki liste, İzmir listesi, `?havalimani=` hedefi), tools (498 pin, sürüklenme, TÜRKİYE'nin çapası ve çakışmaları)
- `pnpm format`, `pnpm lint`, `pnpm typecheck`, `pnpm typecheck:e2e`, `pnpm lint:e2e`, `pnpm check:eol`
- `pnpm exec playwright test -c e2e/playwright.config.ts e2e/tests/live-map.spec.ts e2e/tests/airports.spec.ts e2e/tests/weather.spec.ts` → `?havalimani=LTBL` Çiğli'de açar, listede yalnız ADB, pencere yok; Çiğli'nin yerinde pin ve kod yok, tıklanmaz; ADB'nin pini ve kodu var, pini pencereyi açar; istasyon sayfaları ve hava durumu değişmedi
- `pnpm ci:full` yeşil; PR'da CI (`e2e` dahil) yeşil

**Çıktı kaydı (2026-10-06; sürüm, changelog ve README yayın adımındadır):**
- `pnpm country-labels` → 2,7 sn (Node 24.16.0, ICU 78.3), 498 havalimanı pini; dört bileşimde 56 ad, hiç sığmayan BH LU MT; 54 ülke boş yerde, TÜRKİYE kalabalıkta, KIBRIS başkentte. **Değişen tek kayıt TÜRKİYE / TÜRKIYE:** 34,8° D → 33,8° D, 39,4° K (görsel merkez; ilk yakınlaştırmalar aynı: geniş z3,25, dar z3); çakışma 57 / 50 / 57 / 50 → 50 / 44 / 50 / 44 (Türkçe geniş: z3,25'te 13 pin, önce 17; z4'te 6, önce 5; z5'te yine ASR ve NAV'ın 4 kod kutusu). Öbür 58 ülke aynı; görsel merkezde duran adlar 9 → 10; dar ekranda z3,8'de çapa IST'nin ~100 px doğusunda (önce ~120).
- Birim testleri: `@havayolu/tools` 369 (+1), `@havayolu/shared` 688 (+2; `mapShownAirports` tek kural olarak shared'e taşındıktan sonra), `@havayolu/web` 830 (+3); öbürleri değişmedi (worker 292, api 278, providers 132, i18n 98, db 64, geo 36).
- `pnpm format`, `pnpm lint` (9/9), `pnpm typecheck` (9/9), `pnpm test` (9/9), `pnpm typecheck:e2e`, `pnpm lint:e2e`, `pnpm check:eol` → yeşil.
- E2E (yerel, `pnpm dev:replay`, yerel test stili): `live-map.spec.ts`, `airports.spec.ts`, `weather.spec.ts` 68/68 (4 kurulum + 20 + 12 + 32; 2,2 dk). `pnpm ci:full` çalıştırılmadı (yerel Docker altyapısı başka bir iş akışıyla paylaşılıyor). İnceleme düzeltmelerinden sonra (kural shared'e taşındı, belgeler) birim testleri, `format`, `lint`, `typecheck`, `typecheck:e2e`, `lint:e2e` ve `check:eol` yeniden yeşil; e2e yeniden çalıştırılmadı (3100/4100/4200/4300 başka bir iş akışında; e2e dosyaları değişmedi, haritanın davranışı aynı).

- **Yayın (v0.22.1, 2026-10-06):** dal v0.22.0'ın dalıyla ve `main` (`7cad4dc`) ile birleştirildi (çakışmalar `live-map.tsx` içe aktarımları, D-101 ile D-103'ün sırası ve data-sources.md "Listelenen havalimanları" maddesi; birleşik hâlde tablo yeniden üretildi, değişmedi). Açılış yakınlaştırması 8 (D-104). Birim testleri: web 852, shared 703, tools 369, worker 294, api 284, providers 135, i18n 99, db 71, geo 36. Entegrasyon: db 107, api 31, worker 17, tools 14; migration yükseltmesi 8 → 8; `compose:guard` tamam. E2E 128/128: ilk koşuda 127 (tek hata, v0.22.0'ın `releasedAt`'ı henüz yazılmadığı için changelog testi), değer yazılınca `changelog.spec.ts` 7/7. `pnpm ci:local` yeşil. Yerel önizleme 1915×910: sürüm 0.22.1; görünümdeki havalimanları IST, ISL, SAW, TEQ, KCO (kullanıcının ekran görüntüsündeki alan). `pnpm stats`: 678 dosya, 140.980 satır (kod 129.889).
- **Paket boyutu (D-103):** `mapShownAirports` ad tablosunun modülündeyken tablolar haritanın ilk paketine dönmüştü (4. halka dalının ölçümü); kural `military-airfields.ts`'e taşındı. `/` ilk paketi 1.166.525 → 1.129.643 B (v0.22.0: 1.129.270 B); `/havalimanlari` ve istasyon sayfası v0.22.0 ile aynı. Test `lazy-chunks.test.ts`.
- **PR #37 CI (D-105):** ilk koşuda `checks` kırıldı: `apps/api` hava durumu testi 5 sn sınırını aştı (CI'da 5.754 ms, yerelde 52 ms); kök neden tek turbo çağrısında testlerin tsc, ESLint ve Next derlemesiyle aynı çekirdekleri paylaşmasıydı. CI'da testler ayrı adımda, aynı anda en çok iki paket koşar; yerelde bu adım 20,5 sn, 9/9 paket yeşil.

## M6e.13 — Askerî üsler sitenin hiçbir yerinde yok (yama)
Onay: 2026-10-06 kullanıcı (v0.22.1 yayına çıktıktan sonra): "önceliğin askeri havalimanlarını kaldırmak olsun.!" D-103'ün "itiraz edilebilir" varsayılanına (yalnız harita) itiraz olarak okundu; öncelikli yama (D-082). Uzaklık referansı seçimi (b) orkestratörün ölçümünün önerisidir (itiraz edilebilir).

Sürüm v0.22.2 (dal `p1/no-military-site`, `main` `7a9309e` = v0.22.1'den). Karar D-107'dedir.

**Kapsam:**
- **Tek kural, sunucuda:** `@havayolu/db` `listedEntries` ve `turkishReferencePoints` beş askerî üssü (D-084: LTAG, LTAH, LTBG, LTBI, LTBL; kanonik ICAO ile) atlar. API'nin bütün liste, tek havalimanı ve hava durumu uçları, sayfalar, site haritası, llms.txt, harita, uçak listesinin konumu ve worker'ın hava durumu istasyonları bunu izler. İçe aktarım değişmedi (satırlar veritabanında kalır), migration yok.
- **Sayılar (fixture):** Türkiye 61 → 56, listelenen 503 → 498; dizine eklenen sayfalar (498), site haritası (1.006 adres) ve ülke adı tablosu değişmedi.
- **Sayfalar:** `/istasyon/<üs ICAO ya da IATA>` iki dilde 404 (yönlenme yok); 14 sayfanın "En yakın havalimanları"nda, 4 sayfanın aynı il cümlesinde üs yok; Atina, Sakız, Kalamata'nın en yakın Türkiye havalimanı İzmir Adnan Menderes (284, 89, 472 km), Mitiga'nınki Gökçeada (1.386 km).
- **Metinler (TR/EN):** `/havalimanlari` kapsam cümlesi "askerî hava üsleri ve bazı küçük havalimanları listelenmez"; ad kaynağı ipucundaki ve `/hakkinda` kaynak satırındaki üs cümlesi kalktı.
- **Harita:** `mapShownAirports` savunma süzgeci olarak kaldı ve sadeleşti: liste yüklenirken bir kez süzülür; pin, pencere, liste, `?havalimani=` ve uçak listesi aynı listeyi kullanır. `?havalimani=<üs>` artık açılış görünümünde açar.
- **Uzaklık referansı:** 66 → 61 nokta; halka üyeliği 0 değişiklik, `nearestTr` 4 değişiklik (D-107).
- Sürüm, `entries.ts`, `CHANGELOG.md` ve README yayın adımındadır.

**Dosyalar:**
- `packages/db/src/airports.ts` (`MILITARY_AIRFIELD_ICAOS`, `listedEntries`, `turkishReferencePoints`, açıklamalar); testler `airports.test.ts` (kural, fixture 1.217 / 498 / 56, halka kararlılığı ve dört `nearestTr` değişikliği), `airports.int.test.ts` (beklentiler)
- `packages/shared/src/reference/military-airfields.ts` (açıklama: D-107, savunma süzgeci, fixture denetimi), `airport-names.ts` (beş `military` kaydı, `military` ad kaynağı ve yardımcısı silindi; gözden geçirme düzeltmesi); testler `reference.test.ts` (tablo 56; tablo + `MILITARY_AIRFIELD_ICAOS` = fixture'ın 61 satırı), `names.test.ts` (56 / 503), `foreign.test.ts` (halka analizi ve küçük alan listesi üssüz referansla)
- `apps/api/src/reference/airports.ts` (OpenAPI açıklaması), `weather.ts` (açıklama); testler `rings.test.ts` (iki paketin listesi aynı, db her kimlik biçiminde üssü listelemez), `airports.test.ts`, `airports.int.test.ts`, `airport-details.int.test.ts`, `weather.int.test.ts`
- `apps/worker/src/jobs/jobs.int.test.ts` (498 istasyon, üs yok)
- `apps/web/src/components/map/live-map.tsx` (liste yüklenirken bir kez süzülür), `airport-data.ts`, `lib/airports.ts`, `lib/map/flight-phase.ts`, `app/istasyon/[icao]/page.tsx` (açıklamalar), `lib/test/ourairports-fixture.ts` (test yardımcısı üsleri listeden ve referanstan çıkarır); testler `airports.test.ts`, `airport-view.test.ts`, `airport-text.test.ts`, `airport-data.test.ts`, `airport-popup-model.test.ts`, `labels.test.ts`, `sitemap.test.ts`, `llms.txt/route.test.ts`
- `packages/i18n/src/messages/tr.ts`, `en.ts` (`airports.scope`, `airports.names`, `about.sources.names`; `airport.nameSource.military` silindi)
- `apps/web/src/components/airports/airport-metadata.ts` (yeni: istasyon sayfasının üst verisi `page.tsx`'ten taşındı) ve testi `airport-metadata.test.ts` (iki dilde `noindex, follow` ve `index`)
- `tools/src/country-labels/airport-pins.ts`, `cli.ts` (açıklamalar); test `airport-pins.test.ts` (liste 498, harita pinleri listenin kendisi)
- `e2e/support.ts` (`AIRPORT_COUNT` 56, `LISTED_AIRPORT_COUNT` 498, `MILITARY_AIRFIELDS`; `NON_INDEXABLE_AIRPORT` kalktı), `e2e/tests/airports.spec.ts`, `seo.spec.ts`, `live-map.spec.ts`, `foreign-airports.spec.ts`
- Belgeler: D-107 (ve D-103, D-084, D-080, D-088, D-090, D-076 işaretleri), `docs/spec/domain.md` (uçak listesinin Eskişehir/Çiğli bilinen sınırı dahil), `docs/spec/data-sources.md` (498 istasyonla AWC istek düzeni), `docs/RUNBOOK.md` (istek sayıları ve NOAA e-postası), `docs/ACTIVATION.md` (v0.22.2 doğrulaması; v0.22.1 satırının 3. maddesi ve "Ülke adlarının engelleri"), `docs/REFERENCES.md`, `ATTRIBUTION.md`, `.claude/rules/web-ui.md`, `tools/README.md`, `tools/fixtures/README.md`

**Kabul komutları:**
- `pnpm format`, `pnpm lint`, `pnpm typecheck`, `pnpm typecheck:scripts`, `pnpm test`, `pnpm typecheck:e2e`, `pnpm lint:e2e`, `pnpm check:eol`, `pnpm db:check` → yeşil
- `pnpm country-labels` (çevrimdışı) → 498 havalimanı pini, tablo commit'lenenle aynı (fark yok)
- `pnpm ci:full` (entegrasyon ve e2e) → CI'da; PR'da `checks`, `test-integration` ve `e2e` yeşil

**Çıktı kaydı (2026-10-06; sürüm, changelog ve README yayın adımındadır):**
- `pnpm format`, `pnpm lint` (9/9), `pnpm typecheck` (9/9), `pnpm typecheck:scripts`, `pnpm typecheck:e2e`, `pnpm lint:e2e`, `pnpm check:eol` ("Satır sonları LF"), `pnpm db:check` ("Şema ve migration'lar tutarlı") → yeşil.
- `pnpm test` (9/9): web 865 (+12), api 285 (+1), db 73 (+2), shared 703, tools 369, worker 294, providers 135, i18n 99, geo 36.
- `pnpm country-labels` → 2,6 sn (Node 24.16.0, ICU 78.3), 498 airport pins; TR kalabalık (çakışma 50, 44, 50, 44, değişmedi); `country-label-placements.ts` değişmedi. `tsx tools/src/country-labels/cli.ts airports` → 498 satır, beş üsten hiçbiri yok.
- Entegrasyon testlerinin (db, api, worker) ve e2e'nin beklentileri güncellendi; bu oturumda çalıştırılmadı (Docker, yerel veritabanı ve 3100/4100 portları kullanılmadı): CI'da `test-integration` ve `e2e` doğrular.

**Çıktı kaydı (2026-10-06, gözden geçirme düzeltmeleri):**
- Üslerin adları istemci JS'inden çıktı: `AIRPORT_NAMES`'in beş `military` kaydı, `military` ad kaynağı ve i18n metni silindi (D-107 "Ad tablosu"). `next build`'in (`pnpm ci:local`) `.next/static/chunks/*.js` dosyalarında "Hava Üssü", "İncirlik", "Incirlik", "Çiğli" ve "Air Base" yok; sivil adlar iki parçada (pencere ve liste) duruyor. Sunucu tarafında adlar yalnız changelog parçasında (`/yenilikler`'in v0.14.0 ve v0.22.1 notları) kalır.
- İstasyon sayfasının `noindex, follow` bağlantısı birim testinde (`airport-metadata.test.ts`, iki dil; `index: true`'ya çevrilince 2 test kırılır, denendi).
- Belgeler: 503 → 498 istasyonla AWC istek düzeni (METAR 80 × 6 + 18, TAF 200 + 200 + 98, 24 saatlik doldurma 83 istek; olağan 7 + 3 istek değişmez) data-sources §5, RUNBOOK ve kod açıklamalarında; Eskişehir/Çiğli tahmini durum sınırı domain.md ve D-107'de; kapsama raporunun üs satırlarına bağımlılığı D-107'de; D-103'ün "Seçilmeyenler (c)" işareti.
- `pnpm ci:local` (format, check:eol, changelog:check, typecheck:scripts, typecheck:e2e, lint:e2e, db:check, test:scripts 39, turbo lint + typecheck + test + build 31/31) → yeşil. Testler: web 869 (+4), shared 703, api 285, tools 369, worker 294, providers 135, i18n 99, db 73, geo 36. `pnpm country-labels` → tablo değişmedi.

**Çıktı kaydı (2026-10-06, yayın v0.22.2):**
- `pnpm ci:full` yeşil: birim web 869, shared 703, tools 369, worker 294, api 285, providers 135, i18n 99, db 73, geo 36; entegrasyon db 107, api 31, worker 17, tools 14; `compose:guard` tamam; migration yükseltmesi 8 → 8; e2e 129/129 (3,9 dk).
- Yerel önizleme (`pnpm dev:replay`): sürüm 0.22.2; `/istasyon/LTBL`, `/istasyon/IGL`, `/istasyon/LTBI`, `/en/istasyon/LTAG` 404; `/havalimanlari` Türkiye tablosu 56, Türkiye dışı 442 satır, sayfada üs adı ve kodu yok; Atina'nın "Türkiye’deki en yakın havalimanı" satırı "İzmir Adnan Menderes Havalimanı (ADB), 284 km".
- `pnpm stats`: 681 dosya, 141.609 satır (kod 130.402).

## M6e.12 — Global konumlandırma (yama)
Onay: 2026-10-06 kullanıcı: "Türkiye semalarındaki uçakların canlı konumu olmasın. Türkiye canlı uçak harita vs olmasın başlık. uluslararası bir site gibi yap. önceliğimiz istanbul havalimanı ok ama site global olmalı. Türkiye ile sınırlama." Seçimler: metinler şimdi yama sürümüyle, dünya geneli canlı veri ayrı kilometre taşı; Türkçe kökte, `/en` ikizleri ve adresler değişmez (D-076). Sıra: "glabal metinleri halkaların önüne al. halkalar peşpeşe gelsin." (M6e.12 → M6i.2 → M6j → M7c). Yapı seçimleri orkestratör varsayılanıdır (D-106; itiraz edilebilir).

Sürüm v0.22.3 (geçici; dal `p1/map-global-copy`, `main` `7a9309e` = v0.22.1'den; `p1/no-military-site` ve `p1/map-all-countries` v0.22.2'yi tutuyor, birleştirmede `origin/main`'deki ilk boş PATCH alınır). Karar D-106.

**Kapsam:**
- **Konumlandırma metinleri:** ana sayfanın başlığı ve açıklaması (manifest, JSON-LD WebSite ve Organization, llms.txt özeti aynı anahtardan), varsayılan açıklama, paylaşım görselinin alt başlığı, Hakkında girişi (İstanbul Havalimanı öncelikli), kullanım koşullarının "Hizmet" maddesi (yürürlük 2026-10-06). Hiçbiri ülke adı taşımaz, dünya geneli vaat etmez.
- **Kapsama dürüstlüğü:** "Türkiye odaklıdır" yerine "Canlı uçak verisi şimdilik yalnızca Türkiye ve çevresinden çekilir"; Hakkında → Yöntem'in kapsama cümlesi, `/havalimanlari` kapsama notu, llms.txt'te ayrı satır. Liste kuralı "Şimdilik …" ile başlar.
- **`/havalimanlari`:** ikinci bölüm "Diğer ülkelerdeki havalimanları"; "Türkiye’ye uzaklık" sütunu ve dipnotu yok; SEO başlığı "Havalimanları: IATA ve ICAO kodları, pistler"; özet ve açıklamada tek toplam sayı, binlik ayraçlı.
- **Yurt dışı havalimanı sayfası:** "Türkiye’deki en yakın havalimanı" satırı yok; "En yakın havalimanları" listesi kalır.
- **Saat:** yayın saati Türkçede de "(UTC+3)"; `/durum` kontrol zamanı UTC, etiketli.
- **Yol haritası:** "Diğer ülkelerdeki havalimanları, 2. halka / 3. halka".
- **Değişmeyenler:** adresler, API (`ring`, `distanceToTrKm`, `nearestTr`), halka kuralı, IST açılışı, hava durumunun saat yedeği ("Türkiye saati", M6j'ye kaldı).
- Sürüm, `entries.ts`, `CHANGELOG.md`, README sürüm rozeti ve satır sayısı yayın adımındadır.

**Dosyalar:**
- `packages/i18n/src/messages/{tr,en}.ts` (metinler; silinen anahtarlar `seo.airports.descriptionWithForeign`, `airports.summaryWithForeign`, `airports.columns.distanceToTr`, `airports.foreign.distanceNote`, `airports.foreign.distance`, `airport.facts.nearestTr*`), `packages/i18n/src/index.ts` (`formatReleaseTime` iki dilde UTC farkı); test `i18n.test.ts` (UTC+3; konumlandırma metinleri ülke adı ve dünya geneli taşımaz, açıklama 70–170)
- `apps/web/src/components/airports/airport-text.ts` (`formatCount`), `airports-view.tsx` (toplam sayı, uzaklık sütunu yok), `airport-view.tsx` (Türkiye'ye göre satır yok), `apps/web/src/lib/airports.ts` (`nearestTurkishAirport` silindi), `apps/web/src/app/havalimanlari/page.tsx` (açıklama), `apps/web/src/lib/seo/llms.ts` (kapsama satırı, Türkiye başlığı, uzaklık yok), `apps/web/src/lib/terms.ts` (2026-10-06), `apps/web/src/app/durum/page.tsx` (UTC), `apps/web/src/components/changelog/release-time.ts`, `about/about-content.tsx`, `globals.css` (açıklamalar)
- Testler: `airport-view.test.ts`, `airport-text.test.ts`, `airports.test.ts`, `about-content.test.ts`, `changelog-content.test.ts`, `terms-content.test.ts`, `llms.txt/route.test.ts`
- `packages/shared/src/roadmap.ts` (M6g, M6h adları)
- e2e (CI'da): `seo.spec.ts`, `foreign-airports.spec.ts`, `airports.spec.ts`, `changelog.spec.ts`
- Belgeler: D-106 (ve D-101, D-091, D-088, D-080'e işaret satırları), `docs/spec/domain.md` ("v1 sınırları"), `docs/ACTIVATION.md` (yayın doğrulaması, CLAUDE.md onayı), `README.md` (giriş cümleleri, durum satırı), `ATTRIBUTION.md` (METAR cümlesi), bu plan

**Kabul komutları:**
- `pnpm format`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm typecheck:e2e`, `pnpm lint:e2e`, `pnpm check:eol`
- `pnpm ci:local` (derleme dahil), `pnpm stats`
- Metin taraması: `packages/i18n/src/messages/*.ts`'te "odaklı", "focused on Türkiye", "Türkiye dışındaki", "outside Türkiye", "Türkiye’ye uzaklık", "Distance to Türkiye", "semalarındaki" geçmez (açıklamalar hariç); `nearestTurkishAirport` hiçbir yerde geçmez
- e2e, `test:integration` ve `ci:full` CI'da; PR'da CI (`e2e` dahil) yeşil

**Çıktı kaydı (2026-10-06; sürüm, changelog, README rozeti ve satır sayısı yayın adımındadır):**
- `pnpm ci:local` → yeşil (format:check, check:eol, changelog:check, typecheck:scripts, typecheck:e2e, lint:e2e, db:check, test:scripts 39; turbo lint, typecheck, test, build 31/31).
- Birim testleri: `@havayolu/web` 849 (−5 +2: kalkan "Türkiye’deki en yakın havalimanı" satırının testleri silindi; `formatCount` ve "yurt dışı sayfasında Türkiye’ye göre satır yok" eklendi), `@havayolu/i18n` 100 (+1: konumlandırma metinleri); öbürleri değişmedi (shared 703, tools 369, worker 294, api 284, providers 135, db 71, geo 36).
- Açıklama uzunlukları: ana sayfa TR 160, EN 155; `/havalimanlari` 503 havalimanıyla TR 148, EN 152 (1.222 ile 150 / 154).
- Metin taraması: `packages/i18n/src/messages/*.ts`’te yasak ifadeler yalnız açıklamalarda (4 satır, "Türkiye dışındaki"); `nearestTurkishAirport` hiçbir yerde yok.
- `pnpm stats` → 679 dosya, 140.897 satır, 129.722 kod satırı.
- e2e (`seo`, `foreign-airports`, `airports`, `changelog`) yerelde çalıştırılmadı; CI'nin `e2e` işinde doğrulanır.

## M6h — 3. halka (v0.18.0)
Onay: 2026-10-04 kullanıcı isteği "sonraki işlerden birine bir halka daha ekle" ve kapalı havalimanı kararı (2022'den beri sivil uçuşa kapalı olduğu hâlde OurAirports'ta tarifeli görünen havalimanları listede kalır, sayfada ve pencerede "Sivil uçuşlara kapalı olabilir (2022’den beri)" notu); diğer seçimler M6h araştırmasının önerileri (orkestratör varsayılanı 2026-10-04)

Hedef sürüm 0.18.0 (dal `p1/m6g-ring2`'nin v0.17.0 sürüm commit'i `5f34acb`'den açıldı; PR #25 sonra `main`'e birleşti, `fb6e0cc`, v0.17.0 yayında). `main`'deki tek fark e2e düzeltmesi `f602d59`'dur (`e2e/tests/live-map.spec.ts`); dal `ci:full`'dan önce `origin/main`'i merge commit ile alır (çakışma yok). Kararlar D-090'dadır; kural D-080'in aynısıdır. Migration yoktur: üretim veritabanı 3. halkanın havalimanlarını zaten tutar. Plan sırası M6g → M6h → M7a (D-082).

**Kapsam:**
- **Halka:** `ENABLED_AIRPORT_RING` 2 → 3; listelenen havalimanları 225 → 503 (61 + 75 + 89 + 278), 27 yeni ülke (açık halkalarda 58). En yakını Gachsaran (1.006 km), en uzağı Växjö (1.994 km). Fixture'ın uzak örneklerinden Frankfurt, Dubai ve Doha Hamad 3. halkadadır ve listelenir. Dizine eklenen sayfa 498.
- **Fixture:** 2026-10-01 indirmesinden (yeniden indirme yok) 275 havalimanı ve 389 açık pist dosyaların sonuna; `FIXTURE_RINGS_KM = [500, 1000, 2000]`; üretim aynı baytları verir (876 / 747 satır).
- **Adlar, şehirler, ülkeler:** 278 havalimanının TR/EN adı ve şehri (D-080/D-084/D-088 kuralları; Béjaïa, Krakov, Marsa Alam, Navoi, Tozeur, Menorca, Szczecin varsayılan yazımları); ülke adları `Intl`; şehir istisnası Ercan + Bahreyn (Manama) + Malta (Valletta); Basel-Mulhouse-Freiburg → Mulhouse; Kızıldeniz → Kızıldeniz / Red Sea; Ebu Musa İran (OurAirports ülkesi); İngilizce ad kuralı EuroAirport'u kapsar; Cuxhaven ve Guemar kısaltılır.
- **Saat dilimleri:** 49 yeni bölge kuralı (Almanya'da OurAirports'un DE-BR kodu dahil, İspanya, Kazakistan, Rusya'nın Samara/Saratov/Ulyanovsk/Yekaterinburg/Kaliningrad dilimleri, Özbekistan); 442 havalimanının dilimi testle.
- **Kaynak düzeltmeleri:** API'nin ad temizliği tek başına duran küçük harfli "airport"u "Airport" yapar (dokuz Fransız havalimanı); Voronej ve Linz'in boş pist satırları gizli; karşı ucu olmayan satır pist değildir (Stuttgart'ın iki helikopter alanı; genel kural); yeni kaplama kodları; Özbekistan UZxx (OurAirports kimliği UTxx).
- **Sivil uçuşa kapalı olabilecek havalimanları:** küratörlü, belgeli liste `CIVIL_FLIGHT_CLOSURES` (`@havayolu/shared`; Rosaviatsiya'nın 2022-02-24 kısıtlamasındaki on Rusya havalimanı; listede olanlar Krasnodar, Gelencik, Elista, Voronej); API sözleşmesi değişmez; not sayfada ve harita penceresinde (web).
- **Hava durumu ve ölçek (bbox yok; 4. halka M6i'de):** istasyon 503; METAR 7, TAF 3 istek (saatte ~96); yayından sonra 278 yeni istasyon 47 istekte 24 saat (ilk çalışma 50 istek), tam doldurma 84 istek; AWC istekleri arasında en az 700 ms (`AWC_MIN_REQUEST_INTERVAL_MS`, dakikada en çok 86); geçmiş önbelleği 1.024; toplu hava bütçesi yalnız API/mobil (en kötü < 4 MB); harita penceresi tek havalimanının havasını ister, sayfalar toplu havayı web belleğinde 60 sn tutar, METAR/TAF kaydı önbelleği 900 sn (web).
- **Sayfalar ve harita (web):** tablo 442 satır; site haritası 1.006 adres, llms.txt 498 havalimanı satırı; "2.000 km" / "2,000 km"; 3. halka sayfaları ve pencere ülke ve yerel saatle; z5'te 503 kod; kapalı havalimanı notu.

**Dizinler ve dosyalar (veri ve backend):**
- `packages/shared/src/reference/`: `airport-rings.ts` (`ENABLED_AIRPORT_RING` 3), `foreign-airport-names.ts` (442 ad ve şehir), `time-zones.ts` (49 bölge kuralı), `runway-surface.ts` (kaplama kodları), `civil-closures.ts` (yeni), `index.ts`; testler `foreign.test.ts`, `names.test.ts`, `time-zones.test.ts`, `reference.test.ts`, `civil-closures.test.ts` (yeni)
- `packages/db/src/airports.ts` (`cleanAirportName`, `HIDDEN_RUNWAY_IDS`, `isHiddenRunway`); `airports.test.ts`, `airports.int.test.ts`
- `packages/providers/src/weather/aviationweather.ts` (`AWC_MIN_REQUEST_INTERVAL_MS`, `minIntervalMs`, `monotonicNow`, `sleep`); `aviationweather.test.ts`; `packages/providers/src/reference/reference.test.ts` (876 satır)
- `apps/worker/src/jobs/weather.ts` (açıklama); `weather.test.ts`, `jobs.int.test.ts`
- `apps/api/src/reference/`: `weather.ts` (`WEATHER_HISTORY_CACHE_MAX_ENTRIES` 1.024), `airports.ts` (açıklama); `weather.test.ts`, `rings.test.ts`, `airport-details.int.test.ts`
- `tools/fixtures/ourairports/airports.csv`, `runways.csv`, `tools/fixtures/README.md`, `scripts/make-reference-fixtures.mts`
- Belgeler: D-090, `docs/spec/data-sources.md` §3, §5 ve saat dilimleri, `docs/RUNBOOK.md` (istek sayıları), `docs/ACTIVATION.md` ("M6h yayın doğrulaması")

**Dizinler ve dosyalar (sayfalar ve testler, web):**
- `packages/i18n/src/`: `messages/{tr,en}.ts` (`airport.civilClosure`, `map.airportPopup.civilClosure`), `index.ts` (`formatSinceYear`: "2022’den" / "2022"); `i18n.test.ts`
- `apps/web/src/components/map/`: `use-airport-weather.ts` (`useAirportWeather`: tek havalimanı, son 32 havalimanı, `rememberStation`), `airport-popup-model.ts` (`AirportWeatherState`, yanıtın ICAO denetimi, `closure`), `airport-popup.tsx` (not), `live-map.tsx`, `labels.ts` (`RectObstacles` ile yerleşim), `airport-data.ts` (ölçek notu); testler `use-airport-weather.test.ts`, `airport-popup-model.test.ts`, `airport-popup.test.ts`, `labels.test.ts`
- `apps/web/src/lib/`: `weather.ts` (`createMemoryCache`, toplu hava web belleğinde 60 sn, `no-store`; kayıt 900 sn), `map/label-layout.ts` (`RectObstacles`), `airports.ts` (boyut notu), `test/ourairports-fixture.ts` (gizli pistler, tek uçlu satır, "airport"); testler `weather.test.ts`, `map/label-layout.test.ts`
- `apps/web/src/components/airports/`: `civil-closure.ts` (yeni, `civilClosureNote`), `airport-view.tsx` (not), `airport-weather.tsx` ve `weather-client.ts` (açıklama); testler `airport-view.test.ts`, `airport-text.test.ts`, `airport-og.test.ts`; `components/about/about-content.test.ts`, `app/llms.txt/route.test.ts`; `app/globals.css` (`.civil-closure`)
- `e2e/`: `support.ts` (`RING3_AIRPORT_COUNT`, 442 / 503 / 498, `RING_LIMITS_KM[3]`, `RING3_AIRPORT` Viyana, `CIVIL_CLOSURE_AIRPORT` Voronej), `tests/foreign-airports.spec.ts`, `tests/seo.spec.ts`, `tests/weather.spec.ts`, `tests/app.setup.ts`

**Kabul komutları:**
- `pnpm --filter @havayolu/shared test` → halka 3 açık; fixture'da 3. halka 278 (275 yeni + EDDF, OMDB, OTHH) ve 27 yeni ülke; 442 ad ve şehir; İngilizce ad kuralı (sapmalar: Bağdat, Podgorica, Cuxhaven, Guemar); küçük harfli "airport" dokuz satırda; şehir istisnaları; 442 havalimanının dilimi (Samara +4, Kaliningrad +2, Ufa +5, Herat +4:30); yeni kaplama kodları; kapalı havalimanı listesi
- `pnpm --filter @havayolu/db test` ve `pnpm test:integration` → ad temizliği, gizli pistler (Voronej, Linz, Stuttgart helikopter); 503 havalimanı; API'de 61 + 442 (`[434, 442]`); worker istasyon listesi 503
- `pnpm --filter @havayolu/api test` → iki paketin ad temizliği ve UZxx kuralı aynı; geçmiş önbelleği ≥ 1.006; 503 istasyonun toplu gövdesi (en kötü 3,41 MB < 4 MB; tek TAF 2,23 MB < 2,6 MB)
- `pnpm --filter @havayolu/worker test` ve `@havayolu/providers` → METAR 80 × 6 + 23, TAF 200 + 200 + 103, 278 yeni istasyon 47 istekte 24 saat (ilk çalışma 50), tam doldurma 84; istekler arası en kısa aralık (sahte saat)
- `pnpm exec tsx scripts/make-reference-fixtures.mts <ham-klasör> <çıktı>` → commit'li fixture'la bayt bayt aynı
- `pnpm --filter @havayolu/web test` → 503 (75 + 89 + 278); 3. halka > 1.000 ve ≤ 2.000 km; "2.000 km" / "2,000 km"; ilk ülke Afganistan; Viyana sayfası ve penceresi; Voronej notu iki dilde, yalnız URKG, URKK, URWI, UUOO; pencere tek havalimanını ister ve yanıtın ICAO'sunu denetler; toplu hava web belleğinde (tek uçuş, dakikada bir istek, `no-store`, 10 dk eski veri, 15 sn yeniden deneme); kayıt 900 sn; z5'te 503 kod, `RectObstacles` doğrusal taramayla eşit; paylaşım görseli örneklemi ağsız
- `pnpm --filter @havayolu/i18n test` → `formatSinceYear` ve not metni; `pnpm typecheck:e2e`, `pnpm lint:e2e`
- `pnpm test:e2e`: kurulum 503; API `scope=listed` 61 + 442 (halka 1: 75 ≤ 500; 2: 89, 500–1.000; 3: 278, 1.000–2.000), Viyana halka 3, EGLL yok; liste 442 satır, ItemList 503; `/istasyon/LOWW` iki dilde; `/istasyon/vie` → 308; site haritası 1.006; llms.txt 498; `?havalimani=LOWW`
- `pnpm ci:full` yeşil; PR'da CI (`e2e` dahil) yeşil
- **Kullanıcıya bağlı (`[k]`):** yayından sonra `scope=listed` 503; Özbekistan istasyonlarının METAR'ı UZxx koduyla (UTxx değil); ilk METAR çalışmasında 429 yok, AWC istek hızı; toplu hava gövdesinin boyutu ve sayfa hava durumunun gelmesi; kapalı havalimanı notu (ACTIVATION → "M6h yayın doğrulaması")

**Çıktı kaydı (2026-10-04, veri ve backend; sürüm, changelog ve README yayın adımındadır):**
- Fixture: ham dosyalardan üretim (çıktı scratchpad'e) commit'li `airports.csv` (876 satır) ve `runways.csv` (747 satır) ile bayt bayt aynı ("airports 437 + rings 75 + 89 + 275, runways 146 + 601").
- Birim testleri: `@havayolu/shared` 623, `@havayolu/db` 50, `@havayolu/api` 256, `@havayolu/worker` 200, `@havayolu/providers` 126, `@havayolu/tools` 74, `pnpm test:scripts` 33. Toplu hava gövdesi testte ölçüldü: en kötü 3.406.965 bayt (< 4 MB), tek TAF 2.233.969 bayt (< 2,6 MB).
- `pnpm typecheck` (9/9), `pnpm typecheck:scripts`, `pnpm lint` (9/9), `pnpm check:eol`, Prettier (değişen dosyalar) → yeşil. Entegrasyon testleri (db, api, worker) güncellendi ama bu oturumda çalıştırılmadı (veritabanı birleştirici `ci:full`'unda).

**Çıktı kaydı (2026-10-04, web):**
- Birim testleri: `@havayolu/web` 748 (63 dosya), `@havayolu/i18n` 97. `pnpm typecheck` (9/9), `pnpm lint` (9/9), `pnpm typecheck:e2e`, `pnpm lint:e2e`, `pnpm check:eol`, Prettier (değişen dosyalar) → yeşil. e2e güncellendi, bu oturumda çalıştırılmadı (birleştirici `ci:full`'unda).
- Ölçümler (Node, yerel): z5 kod yerleşimi 400–503 görünür havalimanıyla doğrusal taramada medyan 1,4–3,4 ms, `RectObstacles` ile 1,1–1,3 ms; liste sayfası HTML'i 106 KB (gzip 17 KB), üretim React'iyle çizim 40–50 ms; llms.txt 107 KB, 498 havalimanı satırı; havalimanı listesi yanıtı 448 KB, denetimi ~6 ms; paylaşım görseli örneklemi 35 görsel, ~1,5 sn; ayrıştırılmış toplu hava JSON'un ~1,5 katı yığın; LTFM'nin 24 saatlik kaydı 70 KB.

**Çıktı kaydı (2026-10-04, birleştirme; iki işin birlikte hâli, sunucu ve veritabanı olmadan):**
- `turbo run test --force` → 9/9 paket: web 748, shared 623, api 256, worker 200, providers 126, i18n 97, tools 74, db 50, geo 36. `pnpm test:scripts` 33.
- `turbo run typecheck lint --force` → 18/18; `pnpm typecheck:e2e`, `pnpm lint:e2e`, `pnpm typecheck:scripts`, `pnpm check:eol`, `prettier --check .` → yeşil.
- Sayılar her yerde aynı: listelenen 503 (61 + 75 + 89 + 278), Türkiye dışı 442, dizine eklenen 498, site haritası 1.006, llms.txt 498 satır (`e2e/support.ts` sabitleri, birim testleri, D-090, ACTIVATION). Not metni belgelerde de sitedeki gibi "2022’den beri" yazılır.
- Çalıştırılmayanlar: `pnpm test:integration`, `pnpm test:migration-upgrade`, `pnpm test:e2e` (`ci:full`, `origin/main` alındıktan sonra).

**Çıktı kaydı (2026-10-04, yayın; `origin/main` v0.17.2 alındıktan sonra `0d83f44`):**
- `pnpm ci:full` → `ci:local` yeşil (birim: web 769, shared 640, api 256, worker 200, providers 127, i18n 98, tools 74, db 50, geo 36), `compose:guard` yeşil, entegrasyon db 84, api 26, worker 12, `test:migration-upgrade` 6 → 6.
- İlk e2e denemesi kurulumda 228 havalimanı gördü: yerel geliştirme veritabanı 3. halkadan önceki içe aktarmayı tutuyordu (worker tablo boşken ya da son denetim 24 saatten eskiyken yeniden aktarır). `reference_sources`'taki iki OurAirports satırı yerelde migration 0005'teki gibi sıfırlandı. İkinci denemede kurulum 503'ü gördü; sayfalar web'in yerel geliştirme veri önbelleğinden (`apps/web/.next/dev/cache/fetch-cache`, 1 saat) eski 228'lik listeyi sundu ve 11 test düştü. Önbellek silindi ve yalnız `pnpm test:e2e` yeniden çalıştırıldı: 124 test geçti (3,3 dk). Bu iki durum yalnızca yereldir; CI her çalıştırmada boş veritabanı ve boş önbellekle başlar. Üretimde liste, içe aktarmadan sonra en geç 1 saat içinde tazelenir (önbellek penceresi, M6g'deki gibi).
- `pnpm stats` → 559 dosya, 105.368 satır (kod 96.039, belge 6.115).

## M7a — Canlı araçlar: smoke:live ve record (v0.19.0)
Onay: 2026-09-25 Parça 1 planı (kullanıcı: "Proje + Parça 1'e başla"). Kapsam `docs/prompts/parca-1.md` M7'nin `pnpm record` ve `pnpm smoke:live` maddeleridir; kapsama ölçümü M7b'dedir. Tasarım seçimleri orkestratör varsayılanıdır (2026-10-04, D-094; kullanıcı "soru sorma" penceresindeyken, itiraz edebilir). İki araç da canlı istek atar (DUR-SOR 6): ajan onları canlı çalıştırmaz, yalnızca 127.0.0.1'deki sahte adsb.lol sunucusuna karşı test eder. Canlı kabul kullanıcıdadır; kilometre taşı `[k]` kapanır.

Hedef sürüm 0.19.0. Dal `p1/m7a-live-tools`, `main`'in v0.18.1 birleştirmesinden (`aebadce`, PR #29) açıldı; PR tabanı `main`'dir. Migration yoktur ve üretim imajları değişmez. Değişiklikler şunlardadır:
- `tools/`
- kök script'ler
- `apps/worker/package.json`'ın `exports` alanı (kaynak kodu değişmez)
- belgeler

Kararlar D-094'tedir. Plan sırası M6h → M7a → M7b'dir (D-082).

**Kapsam:**
- **`pnpm record --station LTFM --minutes 30 --confirm`:**
  - **Sorgu:** Tek ve sabit bir sorgudur: `GET /v2/point/<enlem>/<boylam>/<yarıçap>`. Merkez istasyonun ARP'ıdır: OurAirports fixture'ından `parseAirports` ile okunur, ICAO düzeltmeleri geçerlidir (UZSS bulunur, UTSS reddedilir). Yarıçap varsayılan 40 NM'dir. LTFM'de yol `/v2/point/41.2749/28.7321/40`'tır, commit'li fixture'la aynıdır.
  - **Süre ve yarıçap:** Süre duvar saatiyle ölçülür, 1–60 dk (varsayılan 30). Yarıçap 1–60 NM.
  - **İstek tahmini:** Plan, worker'ın kovasını sahte saatle adımlayarak hesaplar (ağ yok; test aynı fonksiyonu kullanır). 30 dk ve `ADSBLOL_RPS=0.1` ile ≈199 istek gider (AIMD ile en çok 0,121 istek/sn).
  - **Kayıt biçimi:** Her başarılı yanıtın ham gövdesi JSON Lines dosyasına bir satır olarak yazılır (LF). Dosya `pnpm dev:replay --recording <dosya>` ile döngüyle oynar; yeni replay kodu gerekmez.
  - **Çıktı yeri:**
    - varsayılan `tools/recordings/tmp/<ICAO>-<YYYYMMDD>T<HHmm>Z.jsonl` (mevcut `.gitignore` kuralı; commit'lenmez)
    - `--fixture`: `tools/fixtures/replay/`, gizlilik süzgeciyle. Parça 2 `bench:engine` buradaki `LTFM-*.jsonl` dosyasını okur. 40 NM'lik karede ~20–40 uçak olur; bench 3.000 uçaklık yük için kaydı çoğaltır ya da döngüye alır (yöntemi Parça 2 seçer). M7a'da kayıt commit'lenmez.
    - `--out <yol>`: kullanıcının verdiği yol (`.jsonl` ile biter). Yol `tools/fixtures` altını gösterirse ret: commit'lenecek kayıt yalnızca `--fixture` ile yazılır. Repo içinde `tools/recordings/tmp` dışındaki yol da ret alır (ham kayıt gitignore dışında commit'lenebilirdi); repo dışı yol serbesttir.
  - **Meta dosyası:** Kaydın yanında `<ad>.meta.json` durur: kaynak, ODbL-1.0, atıf, yol, zamanlar ve sayılar. Marka `APP_NAME`'den gelir. User-Agent ve e-posta taşımaz.
  - **Dosya güvenliği:**
    - Son dosya, `.partial`'ı ya da meta dosyası zaten varsa ret; istek atılmaz.
    - Dosya ilk kareyle (`wx` bayrağı) oluşur ve bitene kadar `.partial` adını taşır. Bitişte yeniden adlandırılır; Windows'ta EPERM, EBUSY ya da EACCES gelirse 100 ms arayla en çok 10 kez denenir.
    - Araç hiçbir dosya silmez.
  - **Bitiş:** Dosya `loadRecording` ile yeniden okunur, kare sayısı tutmalıdır. Araç oynatma komutunu yazar. Bitiş başarısızsa (çıkış 4) ileti kalınan adımı ve öz denetimde ayrıştırıcının satır ya da kare numaralı nedenini yazar.
- **`pnpm smoke:live --confirm`:**
  - **Ne çalışır:** Gerçek ingest (`startIngest`, worker'ın kendi kodu) süreç içinde 5 dk çalışır. Pencere `startIngest`'in döndüğü andan başlar; rapor hazırlık, ingest ve kapanış süresini ayrı yazar ("hazırlık X sn · ingest 5 dk 0 sn · kapanış Y sn").
  - **Yalıtım (yerel altyapıda):**
    - `app_smoke_live` veritabanı her çalıştırmada yeniden kurulur: migration'lar, tohum istasyonları, OurAirports ve VRS fixture'ından içe aktarım. Ağa çıkılmaz.
    - redis-live'ın 7 numaralı veritabanı başta ve sonda temizlenir.
  - **Ölçütler:** Kapanıştan (`close()`, son `provider_health` yazımı) sonra üç ölçüt denetlenir:
    - **Uçak sayısı:** Türkiye bbox'ında (enlem 35–43, boylam 25–45, sınırlar dahil) görülen farklı uçak ≥ 50. Sayım `hy:ac:updates` stream'inden yapılır, gizlilik süzgecinden öncedir. Askerî hariç sayı ve ICAO dışı sayı bilgi için yazılır.
    - **Tazelik:** LTFM veri yaşı p95 ≤ 20 sn. Değer `provider_health.freshness_p95_s`'tir ve worker'ın tanımını kullanır: saniyede bir örnek, 5 dk pencere, en yakın sıra. Sütun `real` olduğu için 1e-4 pay bırakılır.
    - **Sağlık satırı:** `provider_health`'te `adsbLol` satırı var; `updated_at` çalıştırma başındaki veritabanı saatinden yeni, `last_success_at` dolu, devre `config` değil.
    - GEÇTİ için üçü birden geçmeli ve çalışma tamamlanmış olmalıdır (Ctrl+C ile kesilen çalışma GEÇTİ olamaz).
  - **Rapor:** Türkçedir ve yalnızca sayı taşır; hex, tescil ve çağrı kodu yoktur. Başlıkta `APP_NAME` ve sürüm yazar. İçeriği:
    - istek sayıları (200, 429/420, 5xx, ağ/diğer) ve yol başına istek
    - en kısa aralık, son hız ve devre
    - LTFM'yi kapsayan iki yanıt arasındaki en uzun süre
    - üç ölçütün `[GEÇTİ]`/`[KALDI]` satırı ve `SONUÇ`
  - **Sonrası:** Veritabanı inceleme için çalıştırmadan sonra kalır.
- **Ortak kapılar** (ret çıkış kodu 2'dir ve istek atılmaz):
  - **`--confirm` yoksa** araç yalnızca planı yazar ve çıkar: yol, istek tahmini, çıktı ya da veritabanı, `--confirm` ile de reddedecek kapılar (ajan oturumu dahil). Değer yazılmaz.
  - **Ajan oturumu:** `--confirm` verilmiş ve kabukta `CLAUDECODE` ya da `AI_AGENT` doluysa ret: "Canlı araç bir yapay zekâ ajanı oturumunda çalışmaz; kendi terminalinde çalıştır (DUR-SOR 6)". Plan ve `--help` ajan oturumunda da çalışır.
  - **Kabuk:** Kabukta `CI` ya da `EXTERNAL_PROVIDERS_DISABLED=true` varsa ret. Bu iki kapı yalnızca taban adres canlı adsb.lol iken uygulanır; 127.0.0.1'deki sahte sunucuya karşı testler CI'da da çalışır. Dosyalardaki değer okunmaz: `.env.example`'daki `true` elle çalıştırmayı engellemez. Araç `false` değerini yalnızca kendi yapılandırmasına verir.
  - **Ortam:** `APP_ENV` development ya da test olmalıdır.
  - **İletişim adresi:** `CONTACT_EMAIL` zorunlu ve geçerli olmalıdır (worker'ın `parseEnv`'i denetler). Değer hiçbir çıktıya, dosyaya ya da günlüğe yazılmaz; bütün çıktı maskelenir (`ADSBLOL_API_KEY` de).
  - **Adresler:** `DATABASE_URL`, `REDIS_LIVE_URL` ve tanımlıysa `REDIS_QUEUE_URL` yalnızca `localhost`, `127.0.0.1` ya da `::1` olabilir. Adres ve parola yazılmaz.
  - **Eşzamanlı çalışma:**
    - adsb.lol'den çeken başka bir ingest varsa (env'in redis-live indeksinde `hy:provider:adsbLol`) ya da başka bir canlı araç çalışıyorsa (`hy:tools:live` kilidi) ret.
    - Kilit 30 sn'de bir yenilenir ve başka ingest yeniden denetlenir. Kilit kaybolursa ya da başka ingest belirirse smoke durur (çıkış 2); `record` eldeki karelerle dosyayı kapatır (çıkış 2).
    - Kilit bırakılırken son isteğin başlangıcı 60 sn tutulur (`hy:tools:live:last`). Sonraki çalışma ilk isteğini `son + 1000 / ADSBLOL_RPS`'ten önce atmaz.
    - İkinci Ctrl+C kilidi bırakmadan çıkar; kilit en çok 2 dk kalır ve ret iletisi bunu söyler.
    - `record`'da Redis yoksa (PING 2 sn içinde yanıt vermezse) uyarı verilir ve kilitsiz devam edilir. PING'den sonra EXISTS, SET ya da GET yanıt vermez ya da hata verirse ret (çıkış 2, istek atılmaz).
  - **Smoke hedefleri:** Veritabanı adı yalnızca `app_smoke_live` olabilir (testte `app_test_*`) ve `DATABASE_URL`'in kendi veritabanı olamaz. Redis indeksi env'inkinden farklıdır.
- **Hız ve hata kuralları** (data-sources.md §1):
  - **Hız kovası:** `record`, worker'ın `AdaptiveRateController`'ını (başlangıç `ADSBLOL_RPS`, 0,05–0,2, AIMD) ve `createAdsbLolClient`'ı kullanır. Smoke'ta ingest'in kendi kovası çalışır.
  - **User-Agent:** `<APP_NAME>/<sürüm> (+mailto:<CONTACT_EMAIL>)`. `WEB_HOST` genel bir host ise duyurulan `(+https://<WEB_HOST>; <CONTACT_EMAIL>)` biçimini alır.
  - **Hata yanıtları:**
    - 429/420 (Retry-After yok): hız yarıya iner, tam jitter'lı 15 → 300 sn beklenir.
    - 5xx ve ağ hatası: bekleme merdiveni ve devre kesici.
    - **401/403: araç hemen durur, yeniden denemez, çıkış kodu 3.** Bu bir DUR-SOR 3 durumudur; RUNBOOK'taki "adsb.lol API anahtarı istemeye başladı (401/403)" adımlarına bakılır.
    - 3xx/404: yönlendirme izlenmez, `record` durur (çıkış 4).
  - **Ek bekçi** (`fetch` sarmalayıcısı):
    - yalnızca `https://api.adsb.lol` (testte 127.0.0.1)
    - yalnızca `GET /v2/point/...`, sorgu dizesiz
    - yönlendirme `manual`, UA zorunlu
    - iki istek arası en az 5 sn (üst sınır 0,2 istek/sn); saat payı 250 ms, yani 4.750 ms'den kısa aralık ihlaldir

    İhlal aracı durdurur (çıkış 4) ve bekçiyi kilitler: sonraki her istek alttaki `fetch`'e gitmeden kesilir. `routeset`/`route` hiçbir yolda çağrılmaz.
- **Gizlilik:**
  - **Yerel kayıt hamdır:** oynatmada API ve WS süzgeçleri böylece sınanır.
  - **`--fixture` kaydı** genel API'nin göstereceğinden fazlasını taşımaz:
    - askerî (bit 1) kayıtlar atılır, `dbFlags` değeri bozuk olanlar da atılır
    - PIA/LADD (4/8) kayıtlarından `r` ve `ownOp` silinir; tescille aynı çağrı kodu da silinir (`withPrivacy` ile aynı kural)
  - **Engel listesi:** Admin engel listesi kayda uygulanmaz, çünkü araç veritabanı okumaz; oynatmada API uygular.
  - **Konsol ve rapor:** sayılar; hex, tescil ve çağrı kodu yazılmaz. `record` konsola UA'yı bir kez, e-postası `<CONTACT_EMAIL>` ile maskeli yazar; kayıt ve meta dosyası UA taşımaz.
- **Hata çıktısı ve Redis düzeni:** CLI beklenmeyen hatada yalnızca maskeli iletiyi yazar ve çıkış 4 verir; yığın yalnızca `LOG_LEVEL=debug` iken, maskeli yazılır. `unhandledRejection` aynı yoldan geçer. Redis istemcisine `error` dinleyicisi hemen eklenir; ping hatasında `disconnect()`, sonda `quit()`, olmazsa `disconnect()` çağrılır.
- **Eski kaydedici:** `scripts/record-adsblol-fixtures.mts` kaldırılır: yönlendirme izliyor, gövde sınırı yok ve kendi UA'sını kullanıyor. M3'ün dört fixture'ı dondurulmuştur; betiğin geçmişi git'tedir.
- **Çıkış kodları:**

  | Kod | Anlamı |
  |---|---|
  | 0 | tamam / GEÇTİ |
  | 1 | KALDI ya da hiç kare yok |
  | 2 | ret ya da ön koşul eksik |
  | 3 | adsb.lol 401/403 |
  | 4 | bekçi ihlali, beklenmeyen yanıt, dosya hatası ya da iç hata |
  | 130 | Ctrl+C (`record` eldeki karelerle dosyayı kapatır; smoke yarım rapor verir) |

**Dizinler ve dosyalar:**
- `tools/src/live/`:
  - `args.ts`: `parseRecordArgs`, `parseSmokeArgs`, `RECORD_LIMITS`, `RECORD_DEFAULTS`, kullanım metinleri, `isPathInside`
  - `env.ts`: `devEnvSource`, `workspaceVersion`, `isLocalHostname`, `userAgentWebHost`, `createRedactor`
  - `gates.ts`: `checkLiveGates`, `isLiveBaseUrl`, `refusalText`
  - `guard.ts`: `createLiveFetch`, `pointPath`, `assertAllowedBaseUrl`, `LIVE_MIN_GAP_MS`, `LIVE_GAP_TOLERANCE_MS`, `LiveGuardError`
  - `lock.ts`: `hy:tools:live` kilidi, `hy:tools:live:last`, `otherIngestActive`, `checkLiveLock`, `connectLiveRedis`, `closeLiveRedis`
  - `station.ts`: `findStationPoint`
  - `logger.ts`: pino'dan kısa satır, maskeli
  - `record.ts`: `runRecord`, `recordingBaseName`, `recordOutputPaths`, `estimateRecordRequests` (istek tahmini), `recordPlanText`, `sanitizeFrameForFixture`
  - `smoke.ts`: `runSmoke`, `smokePlanLines`, `estimateSmokeRequests`, `evaluateSmoke`, `formatSmokeReport`, `countBboxAircraft`, `smokeEnvSource`, `assertSmokeTargets`, `TURKEY_BBOX`
  - `record-cli.ts`, `smoke-cli.ts`
- Testler (`tools/src/live/`):
  - birim: `args.test.ts`, `env.test.ts`, `gates.test.ts`, `guard.test.ts`, `lock.test.ts`, `station.test.ts`, `logger.test.ts`, `record.test.ts`, `smoke.test.ts`, `replay-fixtures.test.ts`
  - entegrasyon: `lock.int.test.ts`, `smoke.int.test.ts`
  - yardımcı `test/adsblol-stub.ts` (sahte sunucu, sahte saat, `localOnlyFetch`, bellek içi sahte Redis) ve testi `test/adsblol-stub.test.ts`
- `tools/src/replay-receiver/recording.test.ts`: çok kareli adsb.lol JSONL döngüsü
- `tools/` yapılandırması:
  - `tools/package.json`: `test:integration` script'i; geliştirme bağımlılıkları `@havayolu/db`, `@havayolu/worker` ve `pino` 10.3.1 (lockfile'da zaten var; yeni dış paket yok)
  - `tools/tsconfig.json`, `tools/vitest.config.ts` (`*.int.test.ts` hariç), `tools/vitest.integration.config.ts`, `tools/vitest.setup.ts` (yerel olmayan adrese `fetch` ağa çıkmadan hata verir)
- `apps/worker/package.json`: `exports` alanı `./env`, `./ingest`, `./ingest/rate`, `./ingest/status`, `./jobs/reference`; kaynak kodu değişmez
- Kök ve script'ler:
  - kök `package.json`: `record` ve `smoke:live` script'leri, sürüm 0.19.0
  - `pnpm-lock.yaml`: yalnızca tools bağlantıları
  - `scripts/stats.mts`: `tools/fixtures/**/*.jsonl` sayılmaz
  - `.gitignore`: `tools/fixtures/replay/*.partial`
  - `scripts/record-adsblol-fixtures.mts`: kaldırıldı
- Sürüm ve changelog: `packages/shared/src/changelog/entries.ts` (v0.19.0 TR/EN; v0.18.1'in `releasedAt`'ı, D-091), `CHANGELOG.md`, `README.md`
- Belgeler:
  - `CLAUDE.md`: Komutlar tablosuna `smoke:live` ve `record` satırları; "Sonraki kilometre taşları" notunda yalnızca `coverage:*` kalır
  - `tools/README.md`: "Canlı araçlar" bölümü, entegrasyon testleri
  - `tools/fixtures/README.md`: `replay/*.jsonl` satırı, `--fixture` süzgeci ve bench notu, eski kaydedicinin kaldırılması
  - `docs/spec/data-sources.md` §1: "Canlı araçlar" (ikinci IP notuyla)
  - `docs/DECISIONS.md`: D-094
  - `docs/ACTIVATION.md`: "M7a canlı araçlar" satırı; 1. adımın e-posta taslağına ikinci IP notu
  - bu plan: tablo satırı M7a `[k]`, M6e.6 `[x]`; yer tutucu M7 başlığı "M7b — Kapsama ölçümü ve raporu" olur

**Kabul komutları:**
- **`pnpm --filter @havayolu/tools test`** → yeşil. Ağa çıkılmaz: sahte adsb.lol 127.0.0.1'dedir, `record` testleri sahte saatle çalışır (uzun testler 30 sn zaman aşımıyla, 18 uçaklık fixture karesiyle). Testler şunları doğrular:
  - **Argümanlar:** `--station ltfm` LTFM olur; varsayılanlar 30 dk / 40 NM. `--minutes 0|61|abc`, `--radius 61` ve `--out` ile `--fixture` birlikte hata verir. Baştaki `--` atlanır.
  - **Kapılar:**
    - kabukta `CI` ya da `EXTERNAL_PROVIDERS_DISABLED=true` → canlı taban adreste ret, sahte sunucu adresinde ret yok; aynı değer yalnızca `.env.example`'daysa ret yok
    - `--confirm` ile kabukta `CLAUDECODE` ya da `AI_AGENT` → ret; `--confirm`'süz plan çalışır ve iki araçta da bu reddi listeler
    - `APP_ENV=production` → ret
    - `CONTACT_EMAIL` yoksa ya da geçersizse → ret, ileti değeri içermez
    - yerel olmayan `DATABASE_URL`/`REDIS_LIVE_URL`/`REDIS_QUEUE_URL` → ret, ileti adresi ve parolayı içermez; `localhost`, `127.0.0.1` ve `[::1]` kabul edilir
  - **Bekçi:** Yalnızca `GET /v2/point` geçer. Başka host, `/v2/hex`, `/v2/all`, `/api/0/routeset`, `/api/0/route`, `POST`, `redirect` değeri `manual` dışında ya da UA'sız istek engellenir. Aralık 4.999 ms geçer, 4.700 ms ihlaldir (sahte saat). İhlalden sonra geçerli bir istek de alttaki `fetch`'e gitmez. Yakalanan gövde ham ve gzip'i açılmış metindir. `pointPath(41.274874, 28.732136, 40)` = `/v2/point/41.2749/28.7321/40`.
  - **Kilit** (bellek içi sahte Redis): başka ingest ya da tutulan kilit → ret; 30 sn'lik yenilemede kilit kaybı ya da başka ingest → durur; `hy:tools:live:last` varsa ilk istek `son + 1000 / ADSBLOL_RPS`'ten önce gitmez (sahte saat); ping hiç yanıt vermezse `runRecord` biter ve açık Redis istemcisi kalmaz.
  - **`record`, 30 dk sahte saatle:**
    - yalnızca `/v2/point/41.2749/28.7321/40` çağrılır
    - aralıklar AIMD'nin beklediği değerlerdir: önce tam 10.000 ms, temiz 10 dk'dan sonra ≈ 9.091 ms, 20 dk'dan sonra ≈ 8.264 ms; hiçbiri 5.000 ms'den kısa değildir
    - istek sayısı kovanın sahte saatle hesaplanan tahminiyle (≈199) aynıdır ve satır sayısı da öyle; süre dolduktan sonra yeni istek başlamaz
    - dosya `loadRecording` ile döngüye girer; kareler `parseLiveResponse` ile 0 ret verir
    - UA `havayolu/0.0.0-test (+mailto:ops@example.org)` olur (yerel `WEB_HOST` düşer); `WEB_HOST=havayolu.example` ile `(+https://havayolu.example; ops@example.org)`
    - kayıt ve meta e-posta, UA ve adres içermez; meta yalnızca ilkel değer taşır ve markası `APP_NAME`'dendir (`testbrand`); satır sonu LF'dir ve `.partial` kalmaz
  - **Hata durumları:**
    - nginx 429 (Retry-After yok) ve gövdesiz 420 → hız yarıya iner, sonraki istek jitter'lı beklemeden sonra gelir
    - 5 kez 5xx → devre 60 sn açık kalır
    - 401 ve 403 → araç hemen durur; toplam istek 2, çıkış 3, alınan kare korunur
    - 302 → izlenmez, çıkış 4
    - saat kayması → kare yazılmaz, dosya oluşmaz, çıkış 1
    - iptal → eldeki karelerle dosya, çıkış 130
    - `--confirm` yokken `fetch` hiç çağrılmaz, çıkış 2
    - son dosya, `.partial` ya da meta dosyası varsa ya da `--out` `tools/fixtures` altında ya da repo içinde `tools/recordings/tmp` dışındaysa → istek atılmaz, çıkış 2
    - öz denetim başarısız (hex alanı olmayan uçak) → neden ve kare numarası yazılır, çıkış 4
    - Redis yoksa → uyarı, kayıt sürer; PING'den sonra EXISTS, SET ya da GET yanıtsız ya da hatalı → ret, istek yok, çıkış 2
  - **`--fixture` süzgeci:**
    - `dbFlags` 1 ve 3 olan kayıtlar ve bozuk `dbFlags` atılır
    - 4, 8 ve 12'de `r` ve `ownOp` silinir; TC-OIL'in "TCOIL" çağrı kodu silinir, havayolu çağrı kodu kalır
    - süzülmüş kare `parseLiveResponse(…, 'adsbLol')` ile ayrıştırılır (eksik `dbFlags` → 0) ve `withPrivacy` başka bir şey değiştirmez; karşı denetim: `'localReceiver'` ile eksik `dbFlags` null kalır
    - `replay-fixtures.test.ts`: commit'li her `tools/fixtures/replay/*.jsonl` için `sanitized: true` meta ve süzgeçte değişmeyen satırlar (bugün kayıt yok, test boş geçer)
  - **Smoke değerlendirmesi:**
    - bbox sınırları dahildir; 49 uçak → KALDI, 50 → GEÇTİ
    - p95 20,0 ve 20,00005 → GEÇTİ, 20,01 → KALDI, null → KALDI
    - satır yok, `updated_at` eski, `last_success_at` null ya da devre `config` → KALDI; Ctrl+C ile kesilen çalışma GEÇTİ değildir
    - rapor Türkçedir, e-posta ve adres içermez
    - hedefler: veritabanı adı `app_dev` ya da env'in kendi veritabanıysa, redis indeksi env'inkine eşitse → ret
  - **`recording.test.ts`:** 3 kareli adsb.lol JSONL döngüye girer; `durationMs` = son ofset + medyan adım.
- **`pnpm --filter @havayolu/tools test:integration`** (önce `pnpm dev:infra`) → yeşil. Gerçek PostgreSQL ve redis-live kullanılır, adsb.lol sahte sunucudur. Veritabanı `app_test_tools_smoke`; redis-live indeksleri 4 (smoke hedefi) ve 8 (env: kilit ve başka ingest), her testten önce ve sonra temizlenir. `lock.int.test.ts` kilit betiklerini indeks 9'da sınar.
  - **GEÇTİ yolu:** 8 sn, `ADSBLOL_RPS=0.19`, sentetik 60 uçak. En az 2 istek gider ve bekçinin kaydındaki her aralık ≥ 4.750 ms'dir; yollar batı / LTFM 40 / doğu çemberlerindendir. bbox ≥ 50, p95 ≤ 20, `adsbLol` satırı var, çıkış 0. UA deseni doğrudur; günlükte e-posta ve 127.0.0.1 yoktur.
  - **403:** Araç ilk istekten sonra durur; satırda devre `config`, durum `down`, çıkış 3.
  - **429 (Retry-After yok):** 1 istek; bbox 0, p95 yok → KALDI, çıkış 1.
  - **Başka ingest ya da kilit:** `app_test_tools_smoke` önce silinir. Hiç istek atılmaz, veritabanı kurulmaz (sonra da yoktur), çıkış 2.
- **Kuru çalıştırma ve yardım (birim testleriyle):** Ajan `pnpm record` ve `pnpm smoke:live`'ı hiçbir biçimde çağırmaz, `--confirm`'süz plan ve `--help` dahil: ikisi de `.claude/settings.json`'da `ask` listesindedir ve etkileşimsiz bir oturumda onay beklerken takılır. Gerekçe DUR-SOR 6'dır; izin kapısı `tsx tools/src/live/*-cli.ts` ile de aşılmaz. Davranışı şu testler doğrular; kabul çıktısı olarak bu testlerin vitest çıktısı eklenir:
  - `record.test.ts` "--confirm yok: yalnızca plan…" ve "plan eksik kapıları…": istek, Redis ve dosya yok, çıkış 2; plan yol `/v2/point/41.2749/28.7321/40`'ı, "≈199 istek (başlangıç 0,100 istek/sn, AIMD ile en çok 0,121)" bilgisini, çıktı yolunu, `CONTACT_EMAIL: var/yok` satırını (değer yazılmaz), `--confirm` ile de reddedecek kapıları (ajan oturumu dahil) ve "Canlı istek için --confirm ekle" satırını yazar
  - `smoke.test.ts` "runSmoke: plan (--confirm yok)": istek ve bağlantı yok, çıkış 2; ~30 istek, `app_smoke_live`, redis-live 7, kapılar
  - `args.test.ts`: `-h`/`--help` yardım döndürür (CLI kullanım metnini yazar, çıkış 0); kullanım metinleri çıkış kodlarını README tablosuyla aynı yazar

  Kullanıcı planı ve yardımı kendi terminalinde görür (ACTIVATION "M7a canlı araçlar" (1)).
- **Statik denetimler:** `pnpm typecheck` (9/9), `pnpm lint` (9/9), `pnpm typecheck:scripts`, `pnpm check:eol`, `prettier --check .`, `pnpm changelog:check` (0.19.0) → yeşil.
- **`pnpm stats`** → toplam ve dağılım; `tools/fixtures/**/*.jsonl` sayılmaz.
- **`pnpm ci:full`** yeşil; PR'da CI yeşil (tools entegrasyon testleri `test-integration` işinde koşar).
- **Kullanıcıya bağlı (`[k]`)** (ACTIVATION → "M7a canlı araçlar"):
  1. **Ön koşullar:** ACTIVATION 1. adımı (info@adsb.lol e-postası, ikinci IP notuyla) yapılmış olmalıdır. `CONTACT_EMAIL`, 2. adımdaki adresle kökteki `.env`'e yazılır; ajan `.env`'i okumaz. `pnpm dev:infra` açık olmalıdır. `pnpm dev` ya kapalıdır ya da `EXTERNAL_PROVIDERS_DISABLED=true` ile çalışır. Araçlar kullanıcının kendi terminalinde çalışır (ajan oturumunda değil).
  2. **Smoke:** `pnpm smoke:live --confirm` ~6 dk sürer (hazırlık + 5 dk ingest + kapanış), ~30 istek atar. Beklenen sonuç `SONUÇ: GEÇTİ`: bbox ≥ 50, LTFM p95 ≤ 20 sn, `provider_health` satırı. Çıktı bu plana eklenir.
  3. **Kayıt:** `pnpm record --station LTFM --minutes 30 --confirm` ≈199 istek atar ve `tools/recordings/tmp/LTFM-<UTC>.jsonl` ile `.meta.json` yazar; 401/403 görülmemelidir. Kayıt `pnpm dev:replay --recording <dosya>` ile haritada gerçek trafik olarak oynar.
  4. **İsteğe bağlı:** Parça 2 bench'i için `--fixture` ile commit'lenecek bir kayıt alınır. Ajan sonraki oturumda dosyayı `tools/fixtures/README.md` künyesiyle commit'ler.
  5. **Sorun çıkarsa:** Çıkış 3 (401/403) ya da tekrarlayan 429 görülürse dur ve bildir (DUR-SOR 3). p95 20 sn'yi aşarsa raporun "en uzun süre" ve 429 satırlarını bildir; zamanlayıcı ayarı ayrı bir kararla ele alınır.

**Çıktı kaydı (2026-10-05, yayın adımı):**
- Uygulama orkestratör iş akışıyla yazıldı (temel modüller → kayıt, smoke ve belgeler paralel → entegrasyon → üç açıdan inceleme → itiraz eden doğrulama → düzeltme). İncelemede 16 bulgu, doğrulamada 12'si gerçek çıktı ve düzeltildi. En önemlisi: PING'den sonra Redis komutu yanıtsız kalırsa kayıt artık kilitsiz devam etmez, istek atmadan çıkış 2 ile durur (`redis_unanswered`).
- İki inceleme ajanı `pnpm record` ve `pnpm smoke:live` kuru çalıştırmasında `ask` onayı beklerken takıldı (~3,5 sa). İş akışı bu komutları çağırmama kuralıyla sürdürüldü.
- Dal `7c3ddf5` (M7a) sonra `origin/main` v0.18.2 ile birleştirildi (`76c809a`; çakışma yalnızca DECISIONS ve plan tablosunda). v0.18.2 `releasedAt` 2026-10-05T01:08:09Z (GitHub Release).
- `pnpm ci:full` → yeşil: birim web 792, shared 673, api 259, tools 244, worker 200, providers 127, i18n 98, db 50, geo 36; entegrasyon db 84, api 26, worker 12, tools 9; `test:migration-upgrade` 6 → 6; e2e 125/125.
- Kuru çalıştırma ve yardım testleri (`vitest run src/live/{record,smoke,args}.test.ts -t "plan|yardım|help"`) → 25 test geçti: plan istek, Redis ve dosya olmadan çıkış 2 verir; eksik kapıları değer yazmadan listeler; ajan oturumunda `--confirm` reddedilir; `--out` repo içinde yalnızca `tools/recordings/tmp` altına yazar.
- Entegrasyonda (önceki adım) `pnpm record --station LTFM` ve `pnpm smoke:live` kuru çalıştırması çıkış 2 ile yalnızca planı yazdı: ≈199 istek (30 dk) ve ≈30 istek (5 dk); `CONTACT_EMAIL: yok`.
- `pnpm stats` → 599 dosya, 115.736 satır (kod 105.564, belge 6.705).

## M7b.1 — İz tablolarına seen_pos ve baro_rate (v0.20.0)
Onay: 2026-09-25 Parça 1 planı (kullanıcı: "Proje + Parça 1'e başla"). M7b'nin üç küçük yayına bölünmesi orkestratör varsayılanıdır (2026-10-05; D-082, D-097; itiraz edilebilir): M7b.1 (bu kilometre taşı), M7b.2 kapsama raporu, M7c `coverage:probe`.

Hedef sürüm 0.20.0 (dal `p1/m7b1-track-columns`, `main` `f2b865b` = v0.19.1'den). Karar D-097'dedir. Sürüm, changelog ve README yayın adımındadır.

**Neden önce:** kapsama raporu tanımları ham `seen_pos`'u ve ham `baro_rate`'i ister; bugünkü iz satırı ikisini de tutmuyor. Sütunlar, ACTIVATION 2. adımı (üretimde adsb.lol çekimi) başlamadan yayında olmalıdır; raporun 24,5 saatlik penceresi, v0.20.0 yayındayken adsb.lol çekiminin başladığı andan (2. adımın deploy'u) itibaren sayılır.

**Kapsam:**
- **Migration `0006_track_seen_pos_baro_rate`:** `track_points_fine` ve `track_points_sampled`'a `seen_pos_s real` ve `baro_rate_fpm integer` (boş bırakılabilir, varsayılansız; tablo başına tek `ALTER TABLE`). Partition'lı parent'ta yalnızca katalog değişikliğidir; günlük ve DEFAULT partition'lara kendiliğinden geçer, eski satırlar null kalır. Snapshot ve günlük `drizzle-kit generate` ile; 0000–0005 değişmez.
- **Şema ve yazıcı:** `schema.ts` iz tablosu kurucusu; `TrackPointRow`, `TRACK_COLUMNS` ve `insertTrackPoints` 13 sütun (1.000 satırlık parti = 13.000 parametre < 65.535); iki tabloya da aynı yazıcı yazar.
- **Sağlayıcılar:** `AircraftState.seenPosS` = ham `seen_pos` (gelmediyse null; `seen` yerine konmaz, kırpılmaz). adsb.lol ve yerel alıcı aynı ayrıştırıcıdan geçer. `vertical_rate_fpm` değişmez (`baroRateFpm ?? geomRateFpm`).
- **Worker:** `trackRow` `seenPosS` ve `baroRateFpm`'i olduğu gibi yazar.
- **redis-live ve API:** `seenPosS` `d` JSON'una da girer; API'nin şeması bilinmeyen alanı atar, herkese açık REST/WS çıktısı değişmez.

**Dosyalar:**
- `packages/db/drizzle/0006_track_seen_pos_baro_rate.sql` (yeni), `packages/db/drizzle/meta/0006_snapshot.json` (yeni), `packages/db/drizzle/meta/_journal.json`
- `packages/db/src/schema.ts`, `packages/db/src/ingest.ts`; testler `ingest.int.test.ts`, `migrate.int.test.ts`
- `packages/providers/src/aircraft.ts`, `packages/providers/src/live/response.ts`; testler `response.test.ts`, `adsblol.test.ts`
- `apps/worker/src/ingest/index.ts`; testler `index.test.ts`, `ingest.int.test.ts`, `writer.test.ts`, `flights.test.ts`, `merge.test.ts`, `tracks.test.ts`
- `apps/api/src/test/helpers.ts`, `apps/api/src/live/record.test.ts`
- Belgeler: D-097, `docs/spec/domain.md` (Saklama → İz satırı), `docs/spec/data-sources.md` (Yanıt biçimi → Zaman), `docs/ACTIVATION.md` (2. adım ön koşulu; M6e.8 doğrulananlar), bu plan

**Kabul komutları:**
- `pnpm --filter @havayolu/providers test` → `seen_pos` var/yok/tip uyuşmuyor/negatif (ham kalır, `sampleTime` kırpılır), `baro_rate` var/yok, yalnız `geom_rate`; yerel alıcı da aynı alanları verir
- `pnpm --filter @havayolu/worker test` → `trackRow` ham değerleri yazar, geometrik hız ya da `seen` yerine konmaz
- `pnpm --filter @havayolu/api test` → herkese açık kayıtta `seenPosS` yok; alanı olmayan eski kayıt aynı sonucu verir
- `pnpm db:check` → boş fark; `pnpm db:migrate` (yerel geliştirme veritabanı) → 0006 uygulanır, mevcut günlük ve DEFAULT partition'larda iki sütun
- `pnpm test:integration` → db: iki tabloda gidiş-dönüş (değerli ve null satır), sığmayan değer null; 0005'ten yükseltmede partition dosyaları değişmez, eski satırlar null. worker: yerel alıcıdan gelen üç uçağın `seen_pos_s` ve `baro_rate_fpm`'i iki tabloda (yalnız `geom_rate`'li uçakta `baro_rate_fpm` null, `vertical_rate_fpm` 64)
- `git fetch origin && pnpm test:migration-upgrade` → 6 → 7
- `pnpm format`, `pnpm lint`, `pnpm typecheck`, `pnpm typecheck:scripts`, `pnpm test`, `pnpm check:eol`

**Çıktı kaydı (2026-10-05, uygulama; sürüm, changelog ve README yayın adımındadır):**
- `pnpm install` → güncel; `pnpm format`, `pnpm lint` (9/9), `pnpm typecheck` (9/9), `pnpm typecheck:scripts`, `pnpm typecheck:e2e`, `pnpm check:eol` → yeşil.
- `pnpm db:check` → "No schema changes"; migration `drizzle-kit generate --name track_seen_pos_baro_rate` ile üretildi, SQL tablo başına tek `ALTER TABLE`'a indirildi ve açıklama satırları eklendi.
- `pnpm test` (9/9) → providers 132 (+5), worker 201 (+1), api 260 (+1); öbürleri değişmedi (web 792, shared 669, tools 296, i18n 98, db 50, geo 36).
- `pnpm db:migrate` (yerel `app_dev`) → 6 → 7 migration; iki parent ve 34 partition'da (iki DEFAULT dahil, 36 tablo) `seen_pos_s real` ve `baro_rate_fpm integer`, boş bırakılabilir, varsayılansız; partition'ların `relfilenode`'u değişmedi (yeniden yazma yok); eski satırlar (9.951 `track_points_sampled`, 36.592 `track_points_fine`) null.
- `pnpm test:integration` (6/6) → db 86 (+2: iki tabloda ham sütun gidiş-dönüşü; 0005'ten yükseltme), api 26, worker 12 (yerel alıcı testine ham sütun denetimi eklendi), tools 9.
- `git fetch origin && pnpm test:migration-upgrade` → `origin/main` (`f2b865b`) 6 → 7.

**Çıktı kaydı (2026-10-05, yayın adımı):**
- v0.19.1 `releasedAt` 2026-10-05T05:51:51Z (GitHub Release). Sürüm 0.20.0.
- `pnpm ci:full` → yeşil: birim web 792, shared 669, tools 296, api 260, worker 201, providers 132, i18n 98, db 50, geo 36; entegrasyon db 86, api 26, worker 12, tools 9; `test:migration-upgrade` 6 → 7; e2e 125/125.
- `pnpm stats` → 611 dosya, 119.485 satır (kod 109.046, belge 6.950).

## M7b.2 — Kapsama raporu (v0.21.0)
Onay: 2026-09-25 Parça 1 planı (kullanıcı: "Proje + Parça 1'e başla"). M7b'nin M7b.1, M7b.2 ve M7c'ye bölünmesi orkestratör varsayılanıdır (2026-10-05; D-082, D-097; itiraz edilebilir). Kapsam `docs/prompts/parca-1.md` M7'nin `coverage:report` maddesi, rapor tanımları ve karar kurallarıdır; domain.md "Kapsama kalitesi"ndeki günlük iş de buradadır. Yedek yol `coverage:probe` M7c'dedir. Tasarım seçimleri ve tasarım sonrası değişiklikler orkestratör varsayılanıdır (2026-10-05, D-098; itiraz edilebilir).

Hedef sürüm 0.21.0. Dal `p1/m7b-coverage`, `main` `1afaa28`'den (v0.20.0, PR #33) açıldı; PR tabanı `main`'dir. Migration 0007 gelir; web, api ve worker imajları değişir. Kararlar D-098'dedir. Sürüm, changelog ve README yayın adımındadır.

Ajan üretim veritabanına bağlanmaz. Gerçek rapor, üretim ingest'i v0.20.0 ya da sonrasıyla en az 24 sa 45 dk (24 saatlik pencere + 45 dk kapanma payı) çalıştıktan sonra (ACTIVATION 2. adım) kullanıcının admin panelinden aldığı rapordur. Kilometre taşı `[k]` kapanır.

**Kapsam:**
- **Tanımlar tek yerde:** `packages/shared/src/arrival-coverage.ts` (sabitler, tipler, tanım sürümü 1; Türkçe metin yok). db okuyucuları değerleri parametre olarak alır, çünkü `packages/db` shared'a bağlı değildir. Worker ve tools aynı sabitleri verir. Tanımların yorumu D-098'dedir; domain.md'nin tanımları değişmez.
- **Migration 0007** (`0007_arrival_coverage_reports`):
  - `arrival_coverage_reports`: durum `queued` / `running` / `done` / `failed` (CHECK), saat 1–168 (CHECK), istenme/başlama/bitiş zamanları, pencere, hata, `result jsonb`, `markdown`, tanım sürümü.
  - Etkin raporun tek olması için `queued`/`running` satırlarına kısmi benzersiz dizin.
  - `stations.coverage_arrivals_7d` ve `coverage_updated_at`. 0000–0006 değişmez.
- **Okuyucular** (`packages/db/src/arrival-coverage.ts`) ve rapor satırları (`arrival-coverage-reports.ts`):
  - Her okuma kendi salt okunur işlemindedir: `statement_timeout` 60 sn, `lock_timeout` 2 sn, 55P03/57014'te en çok 3 deneme.
  - Aday sorgusu UTC günü başına bir ifadedir; örnekler 200 uçuşluk partilerle birincil anahtar dizininden okunur.
  - Pencere istatistikleri, sağlayıcının saatleri ve durum aralıkları, METAR QNH.
- **Worker** (`apps/worker/src/jobs/arrival-coverage/`):
  - saf sınıflandırıcı ve toplayıcı
  - Türkçe Markdown (docs/ dilinde bir belge; arayüz metni değildir)
  - rapor işi: `jobs` rolü `queued` satırı yoklar ve üstlenir, eşzamanlılık 1, 10 dk bütçe
  - günlük `arrival-coverage-ratio-7d` (00:45 UTC)
- **API:** `POST` / `GET /v1/admin/arrival-coverage/reports`, `GET …/:id`, `GET …/:id/markdown`. Yönetici oturumu gerekir; kuyruk yoktur, API yalnızca `queued` satır yazar.
- **Web:** `/admin/kapsama` (yalnızca Türkçe, D-076): "Son 7 gün", başlatma formu, raporlar tablosu, seçili rapor. İndirme ucu `/admin/kapsama/indir?rapor=<id>`.
- **Yerel CLI `pnpm coverage:report --hours N`** (N: 6, 12, 24, 48, 72 ya da 168; varsayılan 24):
  - Aynı hesabı (worker'ın kodu) yerel veritabanında çalıştırır ve `tools/recordings/tmp/kapsama-<YYYYMMDD>T<HHmm>Z.md`'ye yazar (pencere sonu, UTC; `wx`, var olan dosya ezilmez).
  - Kapı: `DATABASE_URL` yalnızca `localhost`, `127.0.0.1` ya da `::1`; `APP_ENV` development ya da test. Ağa çıkmaz, veritabanına yazmaz; ajan ve CI çalıştırabilir.
  - Çıkış: 0 yazıldı, 1 rapor hesaplanamadı, 2 ret / argüman / veritabanı / dosya, 4 iç hata.
- **Fixture `pnpm --filter @havayolu/tools arrival-fixture [--clean]`:**
  - LTAI'ye üç kapanmış sentetik varış yazar (hex `e2e0a1`–`e2e0a3`): biri pistte yerde örnekleriyle, ikisi alçakta kayboluyor.
  - Önce kendi hex'lerinin uçuşlarını ve iz örneklerini siler (idempotent). `--clean` yalnızca siler.
  - LTFM kullanılmaz: replay'in `cruise` senaryosu LTFM'ye sonsuz son yaklaşma uçurur ve bunlar yerde örneği olmayan varış sayılır.
- **e2e** `e2e/tests/admin-coverage.spec.ts`: test yöneticisi değerleri Playwright `webServer` ortamından verilir ve `.env`'deki aynı anahtarları ezer; `.env`'in diğer değerleri (ör. `DATABASE_URL`) okunur, `.env`'e yazılmaz.

**Dosyalar:**
- `packages/shared/src/arrival-coverage.ts` ve testi, `src/index.ts`
- `packages/db/`:
  - `drizzle/0007_arrival_coverage_reports.sql`, `drizzle/meta/0007_snapshot.json`, `drizzle/meta/_journal.json`
  - `src/schema.ts`, `src/arrival-coverage.ts`, `src/arrival-coverage-reports.ts`, `src/index.ts`
  - testler `arrival-coverage.test.ts`, `arrival-coverage.int.test.ts`, `migrate.int.test.ts`, `src/test/geodesy.ts`
- `apps/worker/src/jobs/arrival-coverage/` (sınıflandırıcı, toplayıcı, Markdown, iş, yoklayıcı, testler, `test/synthetic.ts`), `src/jobs/index.ts`, `src/jobs/jobs.int.test.ts` (partition bakımı ile kapsama okumasının sırası), `package.json` (`exports`)
- `apps/api/src/admin/arrival-coverage.ts` ve testleri (`arrival-coverage.test.ts`, `arrival-coverage.int.test.ts`), `src/app.ts`, `src/index.ts`, `src/test/helpers.ts`, `src/integration.int.test.ts`
- `apps/web/`:
  - `src/app/admin/kapsama/` (sayfa, görünüm, form, otomatik yenileme, indirme ucu ve testleri)
  - `src/app/admin/admin-nav.tsx` (Servisler / Kapsama gezinmesi), `src/app/admin/page.tsx` (bağlantı)
  - `src/lib/arrival-coverage.ts` ve testi (şemalar, kimlik ve saat denetimi, biçimlendirme), `src/lib/test/coverage-fixture.ts`, `src/lib/admin-api.ts`
  - `src/app/globals.css` (yönetici gezinmesi, seçim kutusu, kapsama formu, yenileme durumu, ayrıntı ve Markdown kutusu stilleri)
- `packages/i18n/src/messages/{tr,en}.ts`: `admin.coverage`
- `tools/`:
  - `src/arrival-report/`: `args.ts`, `gate.ts`, `report.ts`, `local-generate.ts`, `report-cli.ts`, `fixture.ts`, `fixture-cli.ts` ve testleri (`*.test.ts`, `arrival-report.int.test.ts`, `test/result.ts`)
  - `package.json`: `arrival-fixture` script'i
  - `README.md`
- Kök `package.json`: `coverage:report` script'i; `turbo.json`: `@havayolu/tools#test`'in önbellek anahtarına `packages/db/src` ve `apps/worker/src`
- `e2e/`: `tests/admin-coverage.spec.ts`, `arrival-fixture.ts` (fixture aracını çalıştırır), `support.ts` (test yöneticisi değerleri; sır değildir), `playwright.config.ts` (`webServer` ortamı)
- Belgeler: `docs/DECISIONS.md` (D-098), bu plan, `docs/ACTIVATION.md`, `CLAUDE.md` (Komutlar), `docs/spec/domain.md` ("Kapsama kalitesi"nde yalnızca bağlantı), `docs/spec/data-sources.md` (ikinci IP notunda M7c probe'u)

**Kabul komutları:**
- **Birim testleri:** `pnpm --filter @havayolu/shared test`, `@havayolu/db`, `@havayolu/worker`, `@havayolu/api`, `@havayolu/web`, `@havayolu/i18n` ve `@havayolu/tools` → yeşil. tools testleri şunları doğrular:
  - argümanlar: `--hours` yalnızca 6/12/24/48/72/168, varsayılan 24, baştaki `--` atlanır; `--clean`; `-h`
  - kapı: yerel olmayan, geçersiz ya da eksik `DATABASE_URL` ve `APP_ENV=production` ret; ileti adres ve parola içermez
  - CLI çekirdeği: dosya adı, `wx` (var olan dosya ezilmez), hesap hatasında çıkış 1, PING yoksa çıkış 2, konsol özeti
  - fixture: worker'ın sınıflandırıcısıyla 3 varış, 1 yerde örneği, 2 `lost_low`; medyan AGL < 1.000 ft, eşiğe medyan < 8 km
- **`pnpm db:check`** → boş fark. **`pnpm db:migrate`** → 0007 uygulanır. **`git fetch origin && pnpm test:migration-upgrade`** → 7 → 8.
- **`pnpm test:integration`** (önce `pnpm dev:infra`) → yeşil. tools: `app_test_tools_arrival` veritabanında fixture yazılır (iki kez: idempotent), worker'ın rapor kodu LTAI'de 3 varış, %33,3 ve kural 1 verir; Markdown'da hex yoktur; `--clean` satırları siler.
- **`pnpm --filter @havayolu/tools arrival-fixture`, ardından `pnpm coverage:report --hours 24`** → LTAI'de 3 varış, yerde örneği %33,3 (1/3), kural 1 uygulanır (sınırda, az örnek), kural 2 uygulanmaz. Çıktı bu plana eklenir.
- **`pnpm test:e2e`** → `admin-coverage.spec.ts` dahil yeşil: oturumsuz `/admin/kapsama` giriş sayfasına döner; test yöneticisiyle giriş, 24 saatlik rapor, "Hazır"; LTAI satırı 3 varış, %33,3, kural 1; `.md` indirilir (başlık ve ODbL var, fixture hex'i yok); sonda fixture silinir.
- **Statik denetimler:** `pnpm typecheck`, `pnpm lint`, `pnpm typecheck:scripts`, `pnpm typecheck:e2e`, `pnpm lint:e2e`, `pnpm check:eol`, `prettier --check .` → yeşil.

**Kullanıcıya bağlı (`[k]`)** (ACTIVATION → "M7b.2 kapsama raporu"):
1. **Ön koşullar:** ACTIVATION 1. adımı (info@adsb.lol) ve 2. adımı (Dokploy'da `CONTACT_EMAIL`) yapılmış, v0.21.0 yayında olmalıdır. Gereken 24 sa 45 dk (24 saatlik pencere + 45 dk kapanma payı), v0.20.0 ya da sonrası yayındayken üretim ingest'inin başladığı andan sayılır (D-097, D-098).
2. **Rapor:** https://admin.havayolu.live/admin/kapsama → 24 saat → "Raporu başlat" → durum "Hazır" olunca "İndir (.md)". Dosyayı ya da metni ajana ver; ajan onu `docs/reports/kapsama.md` olarak commit'ler ve karar kurallarını Parça 2'nin girdisine işler.
3. **Kural 2:** Bir istasyonda kural 2 uygulanıyorsa DUR-SOR: rapordaki eşik önerilerinden birini seç ya da yenisini söyle.
4. **Günlük iş:** Ertesi gün "Son 7 gün" tablosunda güncellenme zamanının, oranların ve varış sayılarının dolduğunu doğrula. Ingest çalışmadan oran "—"dir.
5. **Yedek yol:** Üretim hazır değilse M7c'nin `pnpm coverage:probe --hours 24`'üdür (henüz yok).

**Çıktı kaydı (2026-10-05, CLI, fixture, e2e ve belgeler; sürüm, changelog ve README yayın adımındadır):**
- `pnpm --filter @havayolu/tools test` → 25 dosya, 356 test (yeni 5 dosya, 60 test: argümanlar, kapı, CLI çekirdeği, yerel hesap uyarlayıcısı, fixture ve fixture'ın worker'ın sınıflandırıcısı ve toplayıcısıyla sonucu). `pnpm --filter @havayolu/tools test:integration` → 3 dosya, 14 test (`arrival-report.int.test.ts` 5 test: fixture yokken çıkış 1, fixture iki kez yazılınca 3 uçuş, LTAI 3 varış ve %33,3, 6 saatlik pencere, `--clean` yalnızca kendi satırlarını siler).
- `pnpm --filter @havayolu/tools typecheck`, `pnpm --filter @havayolu/tools lint`, `pnpm typecheck` (9/9), `pnpm typecheck:e2e`, `pnpm lint:e2e`, `pnpm check:eol`, `prettier --check` (tools, e2e, docs, CLAUDE.md) → yeşil.
- `pnpm --filter @havayolu/tools arrival-fixture` (yerel `app_dev`) → "✓ LTAI fixture'ı yazıldı: 3 uçuş, 116 iz örneği … (iniş eşiği 18C)"; ikinci çalıştırma önce 3 uçuşu siler.
- `pnpm coverage:report --hours 24` → çıkış 0, `tools/recordings/tmp/kapsama-20261005T0748Z.md`:
  - `LTAI (AYT): 3 varış · yerde örneği %33,3 (1/3) · medyan AGL 308 ft · eşiğe medyan 1,5 km · Kural 1: uygulanır (sınırda, az örnek) · Kural 2: uygulanmaz (az örnek)`
  - yerel veritabanındaki eski replay verisinden LTFM'de 1 varış (yerde örneği yok); başlıkta LTFM için `baro_rate`/`seen_pos` boşluk uyarısı (v0.20.0 öncesi satırlar)
  - Markdown'da fixture hex'i yok; satır sonu LF. `--hours 25` → kullanım metni, çıkış 2.
- `npx playwright test -c e2e/playwright.config.ts admin-coverage app.setup` → 6/6 (setup 4, `admin-coverage.spec.ts` 2): oturumsuz sayfa ve indirme ucu girişe döner; rapor ~8 sn'de "Hazır", LTAI satırı 3 / %33,3 (1/3) / "Uygulanır (sınırda, az örnek)" / "Uygulanmaz (az örnek)", `.md` indirildi (`kapsama-<UTC>.md`, `admin raporu #<id>`, ODbL, hex yok).

**Bütün dalın denetimi (2026-10-05, birleştirme öncesi; commit yok):**
- `pnpm install` → güncel; `pnpm format` → değişiklik yok. `pnpm lint` 9/9, `pnpm typecheck` 9/9 (`turbo run typecheck --force` ile önbelleksiz de 9/9), `pnpm typecheck:scripts`, `pnpm typecheck:e2e`, `pnpm lint:e2e`, `pnpm check:eol`, `pnpm changelog:check` (v0.20.0), `prettier --check .` → yeşil. `pnpm build` 5/5 (`/admin/kapsama` ve `/admin/kapsama/indir` derlendi).
- `pnpm test` → 9 paket, 172 dosya, 2.754 test: providers 132, geo 36, db 61, i18n 98, shared 685, worker 286, web 822, tools 356, api 278. `pnpm test:scripts` → 2 dosya, 39 test.
- `turbo.json`: `@havayolu/tools#test`'in önbellek anahtarına `packages/db/src` ve `apps/worker/src` eklendi (D-098); kuru çalıştırmada worker'ın 42 ve db'nin 33 dosyası anahtardadır.
- `pnpm db:check` → boş fark. `pnpm db:migrate` → tamam (yerelde 0007 zaten uygulanmıştı). `git fetch origin && pnpm test:migration-upgrade` → `origin/main` (`1afaa28`) üstünde 7 → 8.
- `pnpm test:integration` iki kez → ikisinde de yeşil: db 9 dosya / 106 test, api 7 / 30, worker 3 / 16, tools 3 / 14 (toplam 22 dosya, 166 test).
- `pnpm exec playwright test -c e2e/playwright.config.ts admin-coverage live-map` → 25/25 (setup 4, `admin-coverage.spec.ts` 2, `live-map.spec.ts` 19), 51,2 sn.
- `pnpm --filter @havayolu/tools arrival-fixture`, ardından `pnpm coverage:report --hours 24` → çıkış 0, `tools/recordings/tmp/kapsama-20261005T0757Z.md` (358 satır, CR yok, fixture hex'i yok). Özet tablosundaki LTAI satırı:
  - `| LTAI (AYT) | 3 | %33,3 (1/3) | %6,1–%79,2 | 308 ft | 1,5 km | 3 / 0 | — | uygulanır, sınırda, az örnek | uygulanmaz, az örnek |`

**Çıktı kaydı (2026-10-05, inceleme düzeltmeleri; commit yok):**
- Düzeltmeler (D-098 güncellendi):
  - **Bütçe ve kapanış okuyucuların içinde:** `ReadOnlyOptions.checkpoint` her ifade denemesinden ve her yeniden deneme beklemesinden önce çağrılır; gün dilimleri, uçuş parçaları ve partiler bütçeyi en geç bir ifade sonra görür.
  - **Günlük oran işi:** bilinen hatalar ve son 57014/55P03 BullMQ'da yeniden denenmez (`UnrecoverableError`); `aborted` ve bağlantı hataları denenir.
  - **İz partition bakımı** kapsama raporu ve oran işiyle aynı sıraya girer (DDL kapsama okumasıyla çakışmaz).
  - **Sağlayıcı bölümü:** satırlar "pencereye değen UTC saatleri" diye adlandırılır, saat aralığı yazılır. Durum geçişleri pencere sonundan 10 dk sonrasına kadar okunur; durum süreleri pencereye kırpılır.
  - **Kural 2:** `lost_low`'un yanında bütün varışların eşik önerileri de basılır; DUR-SOR satırı basılan tabloyu gösterir.
  - **Yöntem metni:** aday kutusunun yarı genişliği (15,5 km, kenarı ≈ 31 km) ve geometrik hız satırları yazılır.
  - **Admin sayfası:** liste bir yenilemede alınamazsa otomatik yenileme sürer. İndirme bağlantılarında `download` özniteliği yoktur. Zaman aşımına uğrayan raporun bitişi zaman aşımı anıdır (süre büyümez); kuyrukta eskiyen raporun penceresi "—"dir.
  - **Belgeler:** `.env` ifadesi düzeltildi (webServer ortamı aynı anahtarları ezer, `.env`'in diğer değerleri okunur, `.env`'e yazılmaz); "Dosyalar" listesi tamamlandı.
- `pnpm format` → yalnızca yeni düzenlemeler biçimlendi. `pnpm lint` 9/9, `pnpm typecheck` 9/9, `pnpm typecheck:e2e`, `pnpm lint:e2e`, `pnpm check:eol` → yeşil.
- `pnpm test` → 9 paket, 172 dosya, 2.768 test: providers 132, geo 36, db 64, i18n 98, shared 685, worker 292, web 827, tools 356, api 278.
- `pnpm db:check` → boş fark. `pnpm db:migrate` → tamam. `pnpm test:migration-upgrade` → yerel `origin/main` (`1afaa28`) üstünde 7 → 8.
- `pnpm test:integration` → yeşil: db 9 dosya / 106 test, worker 3 / 17 (yeni: partition işi tutulan kapsama sırasını bekler), api 7 / 30, tools 3 / 14 (toplam 22 dosya, 167 test).
- `pnpm test:e2e` (tam koşu, 10 spec) → 127/127, 3,6 dk; `admin-coverage.spec.ts` 2/2 (rapor ~12 sn'de "Hazır", `.md` `download` özniteliği olmadan indirildi). Spec LTAI fixture'ını yazar ve sonda siler; diğer spec'ler etkilenmedi.

**Çıktı kaydı (2026-10-05, yayın adımı):**
- v0.20.0 `releasedAt` 2026-10-05T07:45:13Z (GitHub Release). Sürüm 0.21.0. Plan satırları: M7b.1 `[x]` (üretimde `hy-migrate` 0006, `/ready` 200), M7b.2 `[k]`.
- İlk `pnpm ci:full` e2e'nin ortasında oturum kapanınca kesildi (52 test geçmişti). İkinci deneme makine yeniden açıldıktan sonra yerel altyapı kapalı olduğu için entegrasyonda düştü (`ioredis` bağlantı hatası); `pnpm dev:infra` ve `pnpm db:migrate` sonrası kalan adımlar yeniden çalıştırıldı.
- `pnpm ci:full` → yeşil: `ci:local` ve `compose:guard` (ikinci deneme), birim web 827, shared 685, tools 356, worker 292, api 278, providers 132, i18n 98, db 64, geo 36; entegrasyon db 106, worker 17, api 30, tools 14; `test:migration-upgrade` 7 → 8; e2e 127/127.
- `pnpm stats` → 666 dosya, 135.793 satır (kod 125.082, belge 7.188).

## M6i.1 — 4. halkanın ön koşulları ve veri altyapısı (halka 3'te kalır)
Onay: 2026-10-05 kullanıcı: "havalimanları eklemeye devam et" (4. halka; halka sınırları ve her halkanın ayrı sürümde açılması D-080'deki kullanıcı kararıdır). M6i'nin M6i.1 ve M6i.2'ye bölünmesi, M7c'nin önüne alınması ve aşağıdaki seçimler orkestratör varsayılanıdır (2026-10-05, D-101; itiraz edilebilir).

Hedef sürüm yayın adımında belirlenir (MINOR). Dal `p1/m6i1-ring4-prep`, `main` `4154792`'den (v0.21.0, PR #34) açıldı; PR tabanı `main`'dir. Karar D-101'dedir. `ENABLED_AIRPORT_RING` 3 kalır: listelenen 503 (61 + 75 + 89 + 278), Türkiye dışı 442, dizine eklenen 498, site haritası 1.006, llms.txt 498, haritada 503 pin, ülke adı yerleşimi ve e2e sayıları aynı. Migration yoktur. Sürüm, changelog ve README yayın adımındadır.

**Neden önce:** fixture'a 4. halkanın satırlarını eklemek, açık halka hangisi olursa olsun fixture'a bağlı testleri değiştirir; halkaya bağlı sayılar ise yalnız halka açılınca değişir. Veri altyapısı ve 1.222 havalimanına göre ölçek işi halka 3'teyken test edilip yayımlanır; M6i.2 yalnız adları, halkanın açılmasını, ülke adı yerleşimini, metinleri ve e2e'yi taşır (D-101 "Neden bu kesim").

**Kapsam:**
- **Fixture:** 2026-10-01 indirmesinden (yeni indirme yok) 716 havalimanı ve 854 açık pist dosyaların sonuna; `FIXTURE_RINGS_KM = [500, 1000, 2000, 5000]`; 1.592 / 1.601 veri satırı. Ham dosyaların kalıcı kopyası `C:/PROJELER/havayolu-data/ourairports-2026-10-01/` (repo dışında; SHA-256'lar D-101'de, `tools/fixtures/README.md`'de ve o klasörün `SHA256SUMS`'ındadır); üretici o klasörden commit'li fixture'ı bayt bayt aynı verir. Fixture'a bağlı testler değişir (sağlayıcı satır sayıları, UNK listesi, kaplama testi, küçük harfli "airport" listesi, LEBL'nin yokluğu); halkaya bağlı sayılar değişmez.
- **4 karakterli kanonik ICAO:** yurt dışı adayı ayrıca `^[A-Z0-9]{4}$` kanonik ICAO taşır: `@havayolu/shared` `isForeignCandidate(type, scheduled, iata, icao)` (= `isScheduledIataAirport` + `isCanonicalIcao`) ve `@havayolu/db` `isForeignCandidateRow`. Eşlik testi (`apps/api/src/reference/rings.test.ts`) ICAO ekseniyle: 4 karakter, 3 karakter, "UG-0002", küçük harf, `gps_code` yedeği, `ident` yedeği. ICAO koşulu olmayan aday sayısı ayrıca tutulur: fixture'da 4. halka 720 aday, 719 listelenebilir (UG-0002/KHX dışarıda). Ülke listeleri (`?country=XX`) koşulu uygulamaz.
- **Pist kuralları:** `HIDDEN_RUNWAY_IDS` + DAUH 260338, LFOB 260344, HBBA 260310; kayıtlı uzunluğu 100 ft'ten kısa satır pist değildir (`MIN_RUNWAY_LENGTH_FT`; LEPP 260341); uçlar arası uzaklık hem kayıtlı uzunluğun 2 katından hem 1 km'den fazlaysa uç koordinatları içe aktarımda kullanılmaz (`endsAreTooFarApart`; VAAM 610195: yön `heading_field`, eşikler `arp_fallback`). Web'in test yardımcısı aynı kuralları yazar (db ve providers testleri kaynağını okuyup karşılaştırır). Görünür pisti olmayan havalimanları (4. halkada GMAZ, VIMB, ULDD, VOVI, ZWTK; bugün UBLC) boş pist listesiyle gelir, sayfa pistsiz çizilir.
- **Kaplama kodları:** BIT, BITUM, MACADAM, MAC → asfalt; HARD, PAVED → kaplamalı; COM, COMPOSITE → karışık; GRADED HARDCORE, LAT → çakıl; UNPAVED → toprak; SAN, SAND → yeni `sand` ("Kum" / "Sand", `packages/i18n`).
- **Saat dilimleri:** 93 bölge + 2 havalimanı kuralı (`tz-proposal.out.json`): Sincan, Tibet, Gansu, Qinghai → `Asia/Shanghai`, ISO harf kodu eşleriyle (CN-XJ, CN-XZ, CN-GS, CN-QH); Moğolistan'da `Asia/Hovd` yalnız Bayan-Ölgii, Hovd ve Uvs; Grönland havalimanı kuralları (BGCO `America/Scoresbysund`, BGKK `America/Godthab`); Kazakistan'da OurAirports'un harf kodları (2022 bölgeleri için ISO'da olmayan KZ-ABA, KZ-JET, KZ-ULY dahil) ve ISO 3166-2:KZ'nin 20 sayısal kodu aynı dilimle (OurAirports ISO'ya geçerse dilim kaybolmaz; KZ-ALM da tabloda), KZ-KUS → `Asia/Qostanay`. Fixture'daki 4. halkanın 720 adayının her biri beklenen dilimde (90 dilim); bölge kodu eşleri aynı dilimde; 2026 kış / yaz örnek farkları.
- **Ölçek:**
  - (a) **Toplu hava:** raporlar istasyonlara bir kez `Map`'le gruplanır (`groupByStation`; tam ve ham biçim). Yeni `GET /v1/weather?scope=listed&format=raw` (ve `country=XX&format=raw`): hiçbir rapor çözümlenmez, en yeni METAR/SPECI ve süresi dolmamış bütün TAF'lar ham metin ve zamanlarıyla; varsayılan tam biçim değişmez; geçersiz `format` 400; biçim başına ayrı 60 sn önbellek; OpenAPI. Görünümler `packages/shared/src/weather/views.ts`'e taşındı (`toAirportMetar`, `toAirportTaf`, `toRawMetar`, `toRawTaf`, `toAirportWeather`). Web havalimanı sayfası ham biçimi ister ve yalnız kendi istasyonunu çözer (`stationWeather`, yanıt başına bir kez). Bütçeler istasyon başına: ham ≤ 980 B (1.222'de < 1,2 MB), tam ≤ 3,8 KB (üretime benzer), ağır ≤ 7 KB, tek TAF ≤ 4,6 KB.
  - (b) **AWC istek sayısı:** worker'ın hava durumu çalışma sonucu `requests` taşır (gruplar, bölünmeler, doldurma); `hava durumu güncellendi` ve "400 kayıt sınırında" günlük satırlarında görünür (RUNBOOK).
  - (c) **Uçuş evresi ızgarası:** `apps/web/src/lib/map/flight-phase-grid.ts` (`PointGrid`, 1°): en küçük dizinle eşitlik, `cosMin` en küçük enlem kosinüsü, boylam ±180'de sarılır, hücre bütçesi aşılırsa doğrusal tarama; özellik testi doğrusal taramayla.
  - (d) **Çizim koruması:** `screenAirports` (`map-controller.ts`) kod yazılmayacaksa (z < 5 ya da ayar Gizle; `airportChipsEnabled`) havalimanlarını izdüşürmez.
  - (e) **Tembel yükleme:** `AirportPopup` (`live-map.tsx`) ve "Havalimanları" paneli (`panels/airport-list-panel.tsx`) `next/dynamic` ile, ikisi de kendi Suspense sınırıyla (`loading: () => null`); harita hazır olunca boşta önceden istenir (`whenIdle`, `lib/idle.ts`); parça yüklenemezse (yayından sonra açık kalan sekme, kesik bağlantı) hata ekranı yerine yedek çizilir (`withChunkFallback`, `chunk-fallback.tsx`: not ve "Sayfayı yenile"); ad tabloları `/*#__PURE__*/` işaretli kurulur ve `/`'nin ilk paketinden çıkar (`lazy-chunks.test.ts`).
- **Yapılmayanlar (D-101):** görünür alana göre (bbox) yükleme, AWC toplu dosyaları, kümeleme ve pin seyreltme, API bayt önbelleği ve ETag/304, paylaşım görseli LRU'su, llms.txt belleği, geçmiş önbelleği sınırları ve `WEATHER_HISTORY_REVALIDATE_S`.

**Dosyalar:**
- `tools/fixtures/ourairports/airports.csv`, `runways.csv`, `tools/fixtures/README.md`, `scripts/make-reference-fixtures.mts`
- `packages/shared/src/`:
  - `reference/airport-rings.ts` (`isCanonicalIcao`, `isScheduledIataAirport`, `isForeignCandidate`), `reference/time-zones.ts`, `reference/runway-surface.ts` (`sand`), `reference/airport-names.ts` ve `reference/foreign-airport-names.ts` (PURE işaretli tablolar)
  - `weather/views.ts` (yeni), `weather/schema.ts` (ham toplu şemalar, `WEATHER_BULK_FORMATS`), `weather/index.ts`
  - testler `reference/foreign.test.ts`, `reference/time-zones.test.ts`, `reference/reference.test.ts`, `reference/civil-closures.test.ts`, `weather/views.test.ts` (yeni), `weather/schema.test.ts`
- `packages/db/src/airports.ts` (`isForeignCandidateRow`, `HIDDEN_RUNWAY_IDS`, `MIN_RUNWAY_LENGTH_FT`, `isHiddenRunway`); `airports.test.ts`, `airports.int.test.ts`
- `packages/providers/src/reference/ourairports.ts` (`endsAreTooFarApart`, `parseRunways`); `reference.test.ts`
- `packages/i18n/src/messages/{tr,en}.ts` (`sand`; `map.airportPopup` ve `map.airportList` altında `loadFailed`, `reload`); `i18n.test.ts`
- `apps/api/src/reference/weather.ts` (`format=raw`, `groupByStation`, görünümler paylaşımdan); testler `weather.test.ts`, `weather-raw.test.ts` (yeni), `weather.int.test.ts`, `rings.test.ts`, `airport-details.int.test.ts`
- `apps/worker/src/jobs/weather.ts` (`requests`); `weather.test.ts`
- `apps/web/src/`:
  - `lib/weather.ts` (ham biçim, `stationWeather`), `components/airports/airport-weather.tsx`; testler `lib/weather.test.ts`, `lib/test/weather-fixture.ts`
  - `lib/map/flight-phase-grid.ts` (yeni), `lib/map/flight-phase.ts`; `lib/map/flight-phase-grid.test.ts` (yeni)
  - `components/map/map-controller.ts` (`screenAirports`), `components/map/labels.ts` (`airportChipsEnabled`); `map-controller.test.ts`
  - `components/map/live-map.tsx`, `components/map/panels/airport-list-control.tsx`, `components/map/panels/airport-list-panel.tsx` (yeni), `components/map/panels/index.ts`, `components/map/chunk-fallback.tsx` (yeni), `lib/idle.ts` (yeni), `app/globals.css` (yedeklerin stili); testler `components/map/lazy-chunks.test.ts` (yeni), `lib/idle.test.ts` (yeni)
  - `lib/test/ourairports-fixture.ts` (pist kuralları), `components/airports/airport-view.test.ts`
- Belgeler: D-101 (D-082 sırası), bu plan, `docs/spec/data-sources.md` (§3 liste kuralı, kaynak düzeltmeleri, fixture ve kalıcı kopya; §5 `requests`; §5a saat dilimleri), `docs/RUNBOOK.md` (`requests` nasıl okunur), `tools/fixtures/README.md`

**Kabul komutları:**
- `cd C:/PROJELER/havayolu-data/ourairports-2026-10-01 && sha256sum -c SHA256SUMS` → beş dosya OK
- `pnpm exec tsx scripts/make-reference-fixtures.mts C:/PROJELER/havayolu-data/ourairports-2026-10-01 <geçici-klasör>` → "airports 437 + rings 75 + 89 + 275 + 716, runways 146 + 1455, airlines 5964"; `cmp` ile `tools/fixtures/ourairports/airports.csv`, `ourairports/runways.csv` ve `vrs/airlines.csv` bayt bayt aynı (1.592 / 1.601 / 5.964 veri satırı)
- `pnpm --filter @havayolu/providers test` → 1.592 / 1.601 satır, 4. halka satırları sonda (UWWW → BGCO … ZWYN); uç uzaklığı kuralı fixture'da yalnız VAAM 610195 (yön 75° / 255°, eşikler ARP'ta, ham koordinatlar korunur); kuralın iki sabiti web yardımcısıyla aynı
- `pnpm --filter @havayolu/shared test` → halka 3 açık, 442 / 503 değişmedi; fixture'da 4. halka 720 aday (ICAO koşulsuz) ve 719 listelenebilir; `isForeignCandidate`'in ICAO ekseni; 4. halkanın 720 adayının dilimi (90 dilim), 93 yeni bölge kuralı, bölge kodu eşleri (Çin, Brandenburg, Kazakistan; 21 Kazak adayı ISO koduyla da aynı dilimde), örnek farklar; yeni kaplama kodları ve `sand`; `views.ts` API'nin önceki çözümüyle aynı, bozuk raporda `null`; ham toplu şema
- `pnpm --filter @havayolu/db test` → yurt dışı adayında 4 karakterli ICAO; gizli pistler (DAUH, LFOB, HBBA), 100 ft kuralı yalnız LEPP 260341; 4. halka açık bağlamla 61 + 75 + 89 + 278 + 719 = 1.222, UG-0002 yok, pistsiz GMAZ, ULDD, VIMB, VOVI, ZWTK ve UBLC; gizli kimlikler ve 100 ft sınırı web yardımcısıyla aynı
- `pnpm --filter @havayolu/api test` → db/shared aday kuralı eşliği (tür, tarife, IATA, ICAO); `format=raw`: çözümleyici çağrılmaz, her fixture istasyonunda `toAirportWeather` = tam biçim, geçersiz `format` 400, biçim başına önbellek; bütçeler istasyon başına (1.222 sentetik istasyonda ham ≤ 980 B ve < 1,2 MB, tam ≤ 3,8 KB; 503'te ağır ≤ 7 KB, tek TAF ≤ 4,6 KB); 2.444 / 1.222 istasyon süre oranı < 3; OpenAPI şemaları
- `pnpm --filter @havayolu/worker test` → çalışma sonucunda `requests` (503 istasyonda METAR 7, TAF 3 = 200 + 200 + 103; ilk çalışma 50); 400 kayıt uyarısı `requests`'le
- `pnpm --filter @havayolu/web test` → `stationWeather` = API tam biçimi (her fixture istasyonu; eski API tam biçim verirse de); 1.222 istasyonluk gövde bellekte bir kez ayrıştırılır; ızgara = doğrusal tarama (rastgele kümeler, eşitlik, ±180, boş ızgara); `screenAirports` z4'te ve ayar Gizle'de izdüşürmez; pencere ve panel dinamik importla ve kendi Suspense sınırıyla, `import()` reddedilirse yedek bileşen (uyarı, işlenmemiş ret yok; yedekler tembel modülleri yalnız tür olarak import eder, metinler iki dilde i18n'den), harita hazır olunca boşta önceden isteme (`whenIdle`: `requestIdleCallback`, yoksa `setTimeout`), ad tabloları PURE; VAAM ve pistsiz havalimanları sayfada
- `pnpm --filter @havayolu/i18n test` → her kaplama anahtarının (`sand` dahil) iki dilde metni
- `pnpm test:integration` → db 4. halka açık bağlamla 1.222 ve açık halka 3'te 503; API `scope=listed` 61 + 442 (`[434, 442]`), her ICAO 4 karakter, pistsiz yurt dışı yine yalnız UBLC; API hava durumu entegrasyonu (ham biçim dahil)
- `pnpm typecheck`, `pnpm typecheck:scripts`, `pnpm lint`, `pnpm typecheck:e2e`, `pnpm lint:e2e`, `pnpm format`, `pnpm check:eol`
- `pnpm build` → `/`'nin First Load JS'i önce ve sonra (çıktı kaydı)
- `pnpm ci:full` yeşil (e2e sayıları değişmez: 503); PR'da CI (`e2e` dahil) yeşil
- **Kullanıcıya bağlı (`[k]`):** yayından sonra `/istasyon/LTFM` ve birkaç yurt dışı sayfada (ör. `/istasyon/LOWW`) hava durumu (ham yol) ve METAR/TAF kaydı geliyor; `curl -s 'https://api.havayolu.live/v1/weather?scope=listed&format=raw' | wc -c` (503 istasyonda beklenen ~0,4–0,5 MB) ve tam biçim değişmedi; worker günlüğünde (`hy-worker-bg`) `hava durumu güncellendi` satırlarında `requests` (METAR 7, TAF 3); haritada havalimanı penceresi ve "Havalimanları" listesi ilk açılışta gecikmesiz açılıyor; yayından önce açılıp açık bırakılan harita sekmesinde yayından sonra havalimanı seçmek ve listeyi açmak hata ekranı vermiyor (ACTIVATION → "M6i.1 yayın doğrulaması", yayın adımında yazılır)

**Çıktı kaydı (2026-10-05):**
- **Fixture:** kalıcı kopyada `sha256sum -c SHA256SUMS` → `airports.csv`, `runways.csv`, `airlines.csv`, `ring4-append/ring4-airports.csv`, `ring4-append/ring4-runways.csv`: OK. `pnpm exec tsx scripts/make-reference-fixtures.mts C:/PROJELER/havayolu-data/ourairports-2026-10-01 <scratchpad>/docs-gen-out` → "✓ airports 437 + rings 75 + 89 + 275 + 716, runways 146 + 1455, airlines 5964"; üç dosya `cmp` ile commit'lenecek fixture'la aynı. Fixture SHA-256: `airports.csv` `c038b5df449b6ae6af51cdf6427260c51c6e24a58f75cdeb664528b194f404e9`, `runways.csv` `e775f4cdd955f0d2f8c7e62d6c7d79b879364e16afb5c724375ad20d06019e09`.
- **`/` First Load JS** (Next 16.3.6 Turbopack üretim derlemesi, `.next/diagnostics/route-bundle-stats.json`; gzip düzey 9 ile yeniden sıkıştırılarak): önce (`main` `4154792`, `git archive` ile ayrı klasörde derlendi) 13 parça, 1.077.325 B (gzip 303.762 B), ad tabloları ilk parçalarda; sonra (bu dal, `pnpm build`) 15 parça, 1.015.243 B (gzip 286.328 B), ad tabloları ilk parçalarda yok: −62.082 B (gzip −17.434 B). Dalın öbür değişiklikleriyle aynı ağaçta istekli (statik) importla 1.081.941 B (gzip 305.058 B), yalnız dinamik importla (PURE işareti olmadan) 1.062.364 B (gzip 300.409 B) idi ve tablolar yine ilk parçadaydı: paylaşılan tabloların yardımcı çağrıları paketleyiciye yan etkili görünüyordu. `/istasyon/[icao]` da küçüldü: 994.891 → 951.560 B (gzip 275.804 → 263.184 B).
- **Uçuş evresi** (Node, tam güncelleme, doğrusal → ızgara, fark 0): 503 havalimanı / 500 uçak 9,5 → 2,7 ms, 1.500 uçak 26,1 → 7,0 ms; 1.223 havalimanı / 500 uçak 20,2 → 4,0 ms, 1.500 uçak 64,1 → 11,6 ms; 3.254 havalimanı / 1.500 uçak 183,9 → 13,5 ms.
- **Birleştirme denetimi (2026-10-05, yerel; ağ yok):** `pnpm install --frozen-lockfile` (lockfile güncel), `pnpm format` (fark yok), `pnpm check:eol`, `pnpm changelog:check` (v0.21.0), `pnpm lint` (9/9), `pnpm typecheck` (9/9), `pnpm typecheck:scripts`, `pnpm typecheck:e2e`, `pnpm lint:e2e`, `pnpm db:check` (boş fark), `pnpm compose:guard` (8 servis), `pnpm test:migration-upgrade` (8 → 8) → yeşil. Fixture üreticisi kalıcı kopyadan yeniden çalıştırıldı: üç dosya `cmp` ile aynı.
- `pnpm test` → birim web 841, shared 699, tools 356, worker 294, api 284, providers 135, i18n 99, db 71, geo 36; `pnpm test:scripts` 39.
- `pnpm test:integration` → db 107, api 31, worker 17, tools 14.
- `pnpm build` → 5/5 (First Load JS yukarıda).
- e2e (`pnpm exec playwright test -c e2e/playwright.config.ts`, önce `pnpm db:migrate`) → 127/127 (3,8 dk); halkaya bağlı sayılar değişmedi (503 listelenen).
- **İnceleme düzeltmeleri (2026-10-06):** (1) Kazakistan'ın 20 ISO 3166-2 sayısal kodu ve Almatı bölgesi (KZ-ALM) saat dilimi tablosunda, OurAirports kodlarıyla aynı dilimde (`time-zones.ts`; test: eşler, 21 Kazak adayı ISO koduyla da aynı dilimde); (2) tembel parça yüklenemezse hata ekranı yerine yedek (`chunk-fallback.tsx`: not ve "Sayfayı yenile"), harita hazır olunca boşta önceden isteme (`lib/idle.ts`); (3) pencerenin kendi Suspense sınırı (`loading: () => null`). D-101, data-sources §5a ve bu plan güncellendi.
  - `pnpm format` (fark yok), `pnpm lint` (9/9), `pnpm typecheck` (9/9), `pnpm typecheck:scripts`, `pnpm typecheck:e2e`, `pnpm lint:e2e`, `pnpm check:eol`, `pnpm db:check` (boş fark) → yeşil.
  - `pnpm test` → birim web 848, shared 700, tools 356, worker 294, api 284, providers 135, i18n 99, db 71, geo 36; `pnpm test:scripts` 39; `pnpm test:integration` → db 107, api 31, worker 17, tools 14.
  - Fixture: kalıcı kopyada `sha256sum -c SHA256SUMS` beş dosya OK; üretici "airports 437 + rings 75 + 89 + 275 + 716, runways 146 + 1455, airlines 5964", üç dosya `cmp` ile commit'lenecek fixture'la aynı.
  - `pnpm build` → 5/5 (`NEXT_TELEMETRY_DISABLED=1`); `/` First Load JS 15 parça, 1.016.736 B (gzip 286.642 B; yedekler ve önceden isteme +1.493 B, gzip +314 B), ad tabloları ilk parçalarda yok; `/istasyon/[icao]` 952.027 B (gzip 263.261 B). Derlenmiş parçada yükleyiciler `dynamic(() => …, { loading: () => null })`.
  - e2e (`pnpm test:e2e`, önce `pnpm db:migrate`) → 126/127 (4,3 dk): `seo.spec.ts` sitemap testinin ikinci `/sitemap.xml` isteği geliştirme sunucusunda `ECONNRESET` aldı (bu işle ilgisiz geçici bağlantı kesilmesi); `seo.spec.ts` tek başına yeniden → 23/23 (kurulum dahil).

**Çıktı kaydı (2026-10-06, yayın adımı):**
- Dal `2aeac17` sonra `origin/main` v0.21.1 ile birleştirildi (`e3bae4a`; çakışma yalnız DECISIONS'ta). v0.21.1 `releasedAt` 2026-10-05T23:42:57Z (GitHub Release); yayın anı İstanbul'da 6 Ekim olduğu için v0.21.1'in `date`'i 2026-10-06'ya düzeltildi (`pnpm changelog` denetimi). Sürüm 0.22.0.
- `pnpm ci:full` → yeşil: birim web 848, shared 701, tools 368, worker 294, api 284, providers 135, i18n 99, db 71, geo 36; entegrasyon db 107, api 31, worker 17, tools 14; `test:migration-upgrade` 8 → 8; e2e 127/127.
- `pnpm stats` → 678 dosya, 140.508 satır (kod 129.501, belge 7.483).
