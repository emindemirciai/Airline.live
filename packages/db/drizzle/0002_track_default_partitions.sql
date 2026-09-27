-- İz tablolarının DEFAULT partition'ları (infra.md → Migration). Her zaman boş tutulur; satır
-- düşerse bakım işi uyarı verir. Günlük partition'ları migrate sonrası ve günlük iş açar
-- (packages/db/src/partitions.ts). İdempotenttir.
CREATE TABLE IF NOT EXISTS "track_points_sampled_default" PARTITION OF "track_points_sampled" DEFAULT;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "track_points_fine_default" PARTITION OF "track_points_fine" DEFAULT;
