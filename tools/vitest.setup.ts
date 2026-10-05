import { installLocalOnlyFetch } from './src/live/test/adsblol-stub'

// Her test dosyasından önce: global fetch yalnızca localhost / 127.0.0.1 / [::1]'e gider. Canlı
// araçların testleri sahte adsb.lol sunucusunu 127.0.0.1'de açar; başka bir adrese (ör.
// api.adsb.lol) giden istek ağa çıkmadan hata verir.
installLocalOnlyFetch()
