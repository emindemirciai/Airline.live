-- Kapsama raporu (Parça 1 M7b.2, D-098): rapor satırları tablosu ve istasyonun 7 günlük kapsama
-- sütunları. Tablo admin isteğini kuyruğa alır (queued), worker üstlenir (running) ve sonucu yazar
-- (done/failed). Tekil kısmi dizin aynı anda tek etkin rapora izin verir. stations'a eklenen
-- sütunlar boş bırakılabilir ve varsayılansızdır (yalnızca katalog değişikliği).
CREATE TABLE "arrival_coverage_reports" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "arrival_coverage_reports_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"status" text DEFAULT 'queued' NOT NULL,
	"hours" integer NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"window_start" timestamp with time zone,
	"window_end" timestamp with time zone,
	"error" text,
	"result" jsonb,
	"markdown" text,
	"definition_version" smallint,
	CONSTRAINT "arrival_coverage_reports_status_check" CHECK ("arrival_coverage_reports"."status" in ('queued', 'running', 'done', 'failed')),
	CONSTRAINT "arrival_coverage_reports_hours_check" CHECK ("arrival_coverage_reports"."hours" between 1 and 168)
);
--> statement-breakpoint
ALTER TABLE "stations" ADD COLUMN "coverage_arrivals_7d" integer;--> statement-breakpoint
ALTER TABLE "stations" ADD COLUMN "coverage_updated_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "arrival_coverage_reports_requested_at_idx" ON "arrival_coverage_reports" USING btree ("requested_at");--> statement-breakpoint
CREATE UNIQUE INDEX "arrival_coverage_reports_single_active_idx" ON "arrival_coverage_reports" USING btree ((true)) WHERE "arrival_coverage_reports"."status" in ('queued', 'running');