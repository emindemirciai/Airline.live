-- İz tablolarına ham seen_pos (sn) ve ham baro_rate (fpm) eklenir (Parça 1 M7b.1, D-097): kapsama
-- raporu tanımları bu iki ham değeri ister. Sütunlar boş bırakılabilir ve varsayılansızdır; bu yüzden
-- partition'lı parent'ta yalnızca katalog değişikliğidir (tablo yeniden yazılmaz) ve günlük
-- partition'lara ve DEFAULT partition'a kendiliğinden geçer. Eski satırlar null kalır.
ALTER TABLE "track_points_fine" ADD COLUMN "seen_pos_s" real, ADD COLUMN "baro_rate_fpm" integer;--> statement-breakpoint
ALTER TABLE "track_points_sampled" ADD COLUMN "seen_pos_s" real, ADD COLUMN "baro_rate_fpm" integer;
