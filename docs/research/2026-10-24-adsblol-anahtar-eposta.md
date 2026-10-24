# adsb.lol'e API anahtarı isteği (taslak, 2026-10-24)

Kullanıcı gönderir (ACTIVATION "adsb.lol'e API anahtarı isteği (e-posta)"; D-122). Ajan e-posta göndermez.

- **Kimden:** info@airline.live
- **Kime:** info@adsb.lol
- **Konu:** API key or higher rate limit for Airline.live

Göndermeden önce `<version>` yerine `https://api.airline.live/version`'ın verdiği sürümü yaz (ör. 0.28.1).

---

Hello,

Airline.live (https://airline.live) is a public flight tracker with a focus on Istanbul Airport (IST). It shows airline traffic only: aircraft flying under a known airline callsign. Military, state, private and unidentified aircraft are never shown. We wrote to you on 15 October to introduce the site.

Live data comes only from adsb.lol, fetched by one server-side worker. Browsers never call your API.

From 20 October, when live aircraft went public, our worker sent about 0.1 requests per second and ran into your daily limit (500 per day per IP, as your x-ratelimit headers show). We are sorry for the extra load. Since version 0.28.1 the worker reads those headers and stays under the limit:

- at most 480 requests in any 24 hours, one /v2/point request about every 180 seconds
- two 250 NM circles over Türkiye, in turns
- a shared counter, so restarts and deploys do not add requests

The ADSB.lol attribution with a link to the ODbL 1.0 licence is shown with the live data on the map. Every live API response also carries the licence ("ODbL-1.0") and the source ("ADSB.lol").

With one request every few minutes, aircraft positions on the map are mostly estimated. Could you give us an API key, or a higher limit for our server, for example 0.2 requests per second? Any level that suits you would help. If you prefer another way to use your data, please let us know.

- User-Agent: `Airline.live/<version> (+https://airline.live; info@airline.live)`
- Server IP: 72.62.53.122
- Contact: info@airline.live

We do not run a receiver yet. We plan to set one up and feed adsb.lol as soon as we can.

Thank you for running adsb.lol.

Best regards,
Airline.live
info@airline.live
