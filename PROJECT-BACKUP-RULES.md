# Project Backup Rules

Bu proje yerel Windows ortamında geliştirilir.

Bir geliştirme görevi tamamlandığında aşağıdaki teslim ve yedek akışı uygulanır:

1. Görevin gerektirdiği test, lint, type-check ve/veya build kontrollerini çalıştır.
2. Gerekli kontroller başarısızsa GitHub push veya Google Drive yedeği yapma; hatayı kullanıcıya bildir.
3. Kontroller başarılıysa repository kökündeki `push-and-backup.ps1` dosyasını çalıştır.
4. Script tamamlanana kadar bekle.
5. Script hata verirse işlemi başarılı kabul etme.
6. Başarılıysa oluşturulan tarih-saat damgalı ZIP dosyasının tam yolunu kullanıcıya bildir.

## Standart dosyalar

Repository kökünde şu dosyalar bulunur:

```text
push-and-backup.ps1
run-backup.cmd
BACKUP-STANDARD.md
PROJECT-BACKUP-RULES.md
AI-PROMPT.md
```

## Google Drive yedek kökü

```text
H:\Drive'ım\Artificial Intelligence - Projects
```

Script proje adını repository kök klasörünün adından otomatik alır.

Örnek:

```text
H:\Drive'ım\Artificial Intelligence - Projects\Bozkurt Obası
```

## ZIP adı

Her yedek dosyasının adında tarih ve saat zorunludur:

```text
<Proje Adı>_YYYY-MM-DD_HHMMSS.zip
```

Örnek:

```text
Bozkurt Obası_2026-10-01_031542.zip
```

## Tam yedek kuralı

Google Drive ZIP yedeğinde hiçbir proje dosyası veya klasörü hariç tutulmaz.

Yedekleme anında repository kök klasörü altında bulunan içerik eksiksiz olarak ZIP'e alınır. Buna `.git`, `node_modules`, build çıktıları, cache klasörleri, IDE dosyaları, `.env`, yerel konfigürasyonlar, üretilmiş assetler ve diğer proje dosyaları da dahil olabilir.

Boş klasörler de mümkün olduğunca korunur.

`.gitignore` yalnızca Git davranışını etkiler; Google Drive tam yedeğinin içeriğini azaltmak için kullanılmaz.

Amaç, ZIP geri açıldığında yeniden dependency, asset, build veya yerel dosya üretme zorunluluğunu en aza indiren eksiksiz bir proje yedeği oluşturmaktır.

## GitHub güvenliği

Google Drive tam yedeğinin eksiksiz olması ile GitHub'a gönderilecek içerik birbirinden ayrı değerlendirilir.

`push-and-backup.ps1`, Git tarafından gönderilmek üzere görünen `.env`, private key, certificate, credentials ve benzeri hassas dosyaları kontrol etmeye devam eder.

Hassas bir dosya GitHub'a gitmek üzereyse Git işlemi durdurulur ve kullanıcı bilgilendirilir.

Bu güvenlik kontrolü Drive ZIP yedeğinden dosya çıkarmak için kullanılmaz.

## Saklama ve boyut politikası

- Varsayılan olarak son **30** tarihli yedek tutulur.
- Maksimum ZIP boyutu limiti yoktur.
- Tek ZIP 10 GB'ı aşarsa yalnızca bilgi amaçlı uyarı verilir.
- 10 GB üzerindeki ZIP silinmez ve işlem başarısız sayılmaz.
- Kota veya internet bağlantısı için ayrıca limit varsayılmaz.

## Değiştirilmemesi gereken standartlar

Kullanıcı açıkça istemedikçe:

- `push-and-backup.ps1` dosyasını silme veya yeniden adlandırma.
- `run-backup.cmd` dosyasını silme veya yeniden adlandırma.
- Google Drive kök yolunu değiştirme.
- Tarih-saat zorunluluğunu kaldırma.
- Son 30 yedek politikasını değiştirme.
- ZIP içeriğine exclusion / ignore listesi ekleme.
- GitHub secret güvenlik kontrolünü kaldırma.
- Mevcut `README.md` dosyasını değiştirme.

Standart teslim zinciri:

```text
kodla
→ test/lint/build
→ push-and-backup.ps1
→ GitHub push
→ Google Drive tam proje ZIP yedeği
→ sonucu kullanıcıya bildir
```
