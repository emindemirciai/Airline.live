# Proje Teslim ve Tam Yedek Entegrasyon Promptu

Bu projeye aşağıdaki ortak teslim ve yedek standardını uygula.

Repository kökünde şu standart dosyalar bulunacaktır:

```text
push-and-backup.ps1
run-backup.cmd
BACKUP-STANDARD.md
PROJECT-BACKUP-RULES.md
AI-PROMPT.md
```

Bu dosya adlarını değiştirme.

Mevcut `README.md` dosyasına dokunma veya üzerine yazma.

## Google Drive yedek yolu

Ana yedek kökü TAM OLARAK:

```text
H:\Drive'ım\Artificial Intelligence - Projects
```

`push-and-backup.ps1`, proje adını repository kök klasörünün adından otomatik belirlemelidir.

Örneğin repository klasörü:

```text
Bozkurt Obası
```

ise ilk başarılı yedeklemede otomatik olarak şu klasörü oluşturmalıdır:

```text
H:\Drive'ım\Artificial Intelligence - Projects\Bozkurt Obası
```

Kullanıcı Google Drive üzerinde proje klasörünü önceden oluşturmak zorunda değildir.

## ZIP adlandırma standardı

Her ZIP dosyasının adında tarih ve saat zorunlu olmalıdır.

Biçim:

```text
<Proje Adı>_YYYY-MM-DD_HHMMSS.zip
```

Örnek:

```text
Bozkurt Obası_2026-10-01_031542.zip
```

Her başarılı teslim yeni ve bağımsız bir tarihli ZIP oluşturmalıdır.

Varsayılan olarak son **30** tarihli yedek tutulmalı, daha eski tarihli yedekler otomatik silinmelidir.

## En önemli kural — tam proje yedeği

Google Drive ZIP'i hazırlanırken hiçbir dosyaya veya klasöre exclusion / ignore uygulama.

"Yeniden üretilebilir", "gereksiz", "cache", "dependency", "build output" gibi gerekçelerle hiçbir şeyi ZIP dışında bırakma.

Yedekleme anında repository kök klasörü altında ne bulunuyorsa tamamını ZIP'e al.

Buna gerektiğinde şunlar da dahildir:

```text
.git
node_modules
dist
build
coverage
cache klasörleri
IDE klasörleri
.env
sertifikalar
anahtarlar
yerel konfigürasyonlar
üretilmiş assetler
diğer bütün proje dosya ve klasörleri
```

Boş klasörleri de mümkün olduğunca koru.

Amaç, kullanıcı ZIP'i geri açtığında eksik dependency, build, asset veya yerel dosya üretmek için tekrar uğraşmak zorunda kalmamasıdır.

`.gitignore` yalnızca GitHub/Git davranışını etkiler. Google Drive tam yedeğini filtrelemek için `.gitignore` kullanma.

## GitHub güvenliği ayrı tutulacak

Tam Drive yedeğinin bütün dosyaları içermesi, hassas dosyaların GitHub'a gönderilebileceği anlamına gelmez.

`push-and-backup.ps1`, GitHub'a gönderilmek üzere görünen `.env`, private key, certificate, credentials ve benzeri hassas dosyaları kontrol etmeye devam etmelidir.

Hassas dosya GitHub'a gidecekse Git işlemini durdur ve kullanıcıya bildir.

Bu güvenlik kontrolünü ZIP yedeğinden dosya eksiltmek için kullanma.

## Teslim akışı

Bir geliştirme görevi tamamlandığında:

1. Görevin gerektirdiği test/lint/type-check/build kontrollerini çalıştır.
2. Gerekli kontroller hata verirse push ve backup yapma.
3. Kontroller başarılıysa repository kökündeki `push-and-backup.ps1` dosyasını çalıştır.
4. Script Git commit/push işlemini tamamlasın.
5. Push başarılıysa tam proje ZIP yedeğini oluştursun.
6. İşlem sonunda GitHub sonucunu ve oluşan ZIP'in tam yolunu kullanıcıya bildir.

Bu akış kullanılan geliştirme aracından bağımsızdır. Aynı standart terminal, IDE, editör veya farklı otomasyon ortamlarında kullanılabilir.

## Saklama

Varsayılan olarak son **30** tarihli yedek tutulmalıdır.

## Boyut

Yedek boyutu için maksimum limit koyma.

Proje 300 MB, birkaç GB veya daha büyük olabilir.

Tek ZIP 10 GB'ı aşarsa yalnızca bilgi amaçlı uyarı ver.

10 GB üzerindeki yedeği:

- silme,
- oluşturmayı engelleme,
- işlemi durdurma,
- işlemi başarısız sayma.

Kota veya internet bağlantısı için ayrıca limit varsayma.

## Korunacak standart

Kullanıcı açıkça istemedikçe:

- `push-and-backup.ps1` dosyasını silme veya yeniden adlandırma,
- `run-backup.cmd` dosyasını silme veya yeniden adlandırma,
- Google Drive kök yolunu değiştirme,
- tarih-saat zorunluluğunu kaldırma,
- son 30 yedek politikasını değiştirme,
- ZIP'e exclusion / ignore listesi ekleme,
- GitHub secret güvenlik kontrolünü gevşetme,
- mevcut `README.md` dosyasını değiştirme.

Repository içinde proje talimatları için kullanılan mevcut bir kural veya talimat dosyası varsa, `PROJECT-BACKUP-RULES.md` içeriğini mevcut yapıyı bozmadan uygun biçimde dahil et.

Böyle bir dosya yoksa yeni bir araç-özel talimat dosyası oluşturma; `PROJECT-BACKUP-RULES.md` referans dosyası olarak kalsın.

Standart teslim zinciri:

```text
kodla
→ test/lint/build
→ push-and-backup.ps1
→ GitHub push
→ Google Drive tam proje ZIP yedeği
→ sonucu kullanıcıya bildir
```

Bu sistemi bundan sonraki geliştirme görevlerinde proje teslim standardı olarak koru.
