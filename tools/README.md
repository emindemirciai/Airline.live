# @havayolu/tools

Yalnızca geliştirme ve test araçları. Uygulamalar bu pakete bağımlı olmadığından üretim imajına girmez. Replay ve senaryolar yalnızca `APP_ENV=development|test` iken çalışır; `production` ya da başka bir değerde başlamaz (D-073). Commit'li referans verisi için bkz. [`fixtures/README.md`](fixtures/README.md).

## Senaryolar (`src/scenarios`)
Zamanın saf fonksiyonudur: aynı an her zaman aynı readsb `aircraft.json` karesini verir; rastgelelik ve saat okuması yoktur.

- **`cruise`:**
  - Varsayılan 8 seyir uçağı (`--count` ile 0–90). Havalimanı çiftleri arasında (IST–ESB, IST–AYT, SAW–ADB, ESB–VAN, ADB–TZX, AYT–ESB, IST–DIY, SAW–ERZ) büyük daire üzerinde gidip gelir; 35.000 ft, ≈ 450 kt (441–462), iz gerçek yöndedir.
  - LTFM 35L'ye 12 NM'den 3° süzülüşle döngüsel son yaklaşma yapan bir uçak (`ff0091`).
  - LTFM'de yerde 15 kt ile taksi turu atan bir uçak (`ff0092`).
- **Kimlikler açıkça sentetiktir:** hex `ff0001`…, çağrı kodu `HYS001`…, tescil `TC-SYN01`…, `dbFlags` 0, kaynak `adsb_icao`, `seen_pos` 0,5 sn.

## Replay alıcısı (`src/replay-receiver`)
Senaryoyu ya da kayıtlı kareleri `http://127.0.0.1:<port>/data/aircraft.json` (ve `/aircraft.json`) adresinde sunar. Worker onu `LOCAL_RECEIVER_URLS` ile gerçek bir alıcı gibi okur. Yanıtın `now` değeri sunulduğu anın saatidir: ayrıştırıcı 60 sn'den fazla kayan yanıtı reddeder.

```bash
# Kökte: alıcı + pnpm dev (web, API, worker); dış servis isteği kapalı
pnpm dev:replay
pnpm dev:replay --count 20
pnpm dev:replay --recording kayit.jsonl   # çok kareli kayıt: döngüyle sunulur
# Tek kare döngüye alınmaz: uçaklar yerinde durur, 60 sn içinde bayatlar
pnpm dev:replay --recording tools/fixtures/adsblol/point-ltfm-40nm.json

# Yalnızca alıcı (adres ekrana yazılır)
pnpm --filter @havayolu/tools replay -- --scenario cruise --count 12
```

- **Port:** `REPLAY_RECEIVER_PORT`, varsayılan 4300. Değer sırayla süreç ortamından, kökteki `.env`'den ve `.env.example`'dan okunur.
- **`pnpm dev:replay`:** `LOCAL_RECEIVER_URLS`'i alıcının adresine ayarlar ve `EXTERNAL_PROVIDERS_DISABLED=true`'yu zorlar. Ctrl+C ikisini birlikte kapatır.
- **Kayıt biçimleri** (`--recording`):
  - readsb `aircraft.json` karesi (`now` saniye, `aircraft`) ya da adsb.lol v2 yanıtı (`now` ms, `ac`)
  - tek kare, kare dizisi, `{"frames": [...]}` ya da satır başına bir kare (JSON Lines)
- **Oynatma:** Kareler zamanı kaydırılarak sunulur: ilk kare alıcının açıldığı ana denk gelir. Döngünün tek bir turu içinde aynı kare tekrar okunursa `seen_pos` ve `seen` geçen süre kadar artar (ikisi de yoksa yaş `seen` olarak eklenir); böylece örnek zamanı değişmez ve aynı konum yeni bir örnek gibi görünmez. Döngü başa sarınca ilk kare yeni zamanla yeniden sunulur.
  - **Döngü** için en az iki farklı zamanlı kare gerekir. Döngünün süresi son karenin göreli zamanı ile kareler arasındaki tipik (medyan) aralığın toplamıdır.
  - **Tek kare** (ör. `tools/fixtures/adsblol/point-ltfm-40nm.json`) ya da hepsi aynı anlı kareler döngüye alınmaz. Kare donmuş bir alıcı gibi sunulur: uçaklar yerinde durur ve 60 sn içinde bayatlar, sonra ayrıştırıcı onları reddeder. Ayrıştırıcıyı ve alıcı bağlantısını denemek için yeterlidir; hareket için senaryo ya da çok kareli kayıt kullanılır.
- **dbFlags:** adsb.lol karesinde eksik `dbFlags` 0 yazılır, çünkü orada yokluk 0 demektir. readsb karesinde eksik bırakılır; yerel alıcıda bu "bilinmiyor" demektir ve uçak gizli sayılır (D-071).

## Ülke adlarının sınır içi yerleşimi (`src/country-labels`, D-096)
Haritadaki her ülke adının görünür kutusunun ülkenin kara poligonunun içinde kaldığı yeri ve ilk yakınlaştırmayı çevrimdışı hesaplar. İkisi de ağa çıkmaz:

```bash
# Kökte: node_modules/world-atlas'tan sadeleşmiş poligonlar → tools/fixtures/naturalearth/countries.json
pnpm country-labels:fixture
# Kökte: fixture'dan yerleşim tablosu → packages/shared/src/map/country-label-placements.ts
pnpm country-labels
```

- **Dosyalar:** `geometry.ts` (Web Mercator, Douglas–Peucker, 180. meridyende sürekli kılma, kırpma, "dikdörtgen çokgenin içinde mi"), `natural-earth.ts` (Natural Earth birimleri, fixture), `label-model.ts` (MapLibre 6.11.2'nin yazıyı çizdiği kutunun modeli, güvenlik payı), `placement.ts` (çapa kuralı, tablo), `cli.ts`.
- **Adlar** üreticinin çalıştığı Node'un CLDR'ından gelir ve tabloya yazılır; harita bu adı çizer. Node güncellemesi bir adı değiştirirse shared testi kırılır, `pnpm country-labels` yeniden çalıştırılır.
- **Testler** commit'li tabloyu fixture'dan yeniden hesaplar (sürüklenme), her adın kutusunun ilk yakınlaştırmasından z8'e kadar ülkesinin içinde kaldığını, adların örtüşmediğini, fixture'ın world-atlas'tan yeniden üretilebildiğini ve model değerlerinin yazı tipi dosyalarıyla aynı olduğunu denetler. e2e beklentileri (`e2e/country-label-expectations.ts`) de burada tablodan doğrulanır.

## Testler

```bash
pnpm --filter @havayolu/tools test
pnpm --filter @havayolu/tools typecheck
pnpm --filter @havayolu/tools lint
```

Testler ağa çıkmaz. Alıcı rastgele boş bir portta (`port: 0`) açılır ve yalnızca `127.0.0.1` üzerinden okunur.
