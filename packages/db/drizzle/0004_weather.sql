CREATE TABLE "weather_metar" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "weather_metar_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"station_icao" text NOT NULL,
	"report_type" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"raw_text" text NOT NULL,
	"qnh_hpa" real,
	"flight_category" text,
	"fetched_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weather_metar_station_icao_check" CHECK ("weather_metar"."station_icao" ~ '^[A-Z0-9]{4}$'),
	CONSTRAINT "weather_metar_report_type_check" CHECK ("weather_metar"."report_type" in ('METAR', 'SPECI'))
);
--> statement-breakpoint
CREATE TABLE "weather_sources" (
	"kind" text PRIMARY KEY NOT NULL,
	"origin" text NOT NULL,
	"disabled_reason" text,
	"checked_at" timestamp with time zone,
	"station_count" integer,
	"report_count" integer,
	"skipped_count" integer,
	"last_error" text,
	"last_error_at" timestamp with time zone,
	"blocked_until" timestamp with time zone,
	"blocked_kind" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weather_taf" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "weather_taf_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"station_icao" text NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_to" timestamp with time zone NOT NULL,
	"raw_text" text NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weather_taf_station_icao_check" CHECK ("weather_taf"."station_icao" ~ '^[A-Z0-9]{4}$'),
	CONSTRAINT "weather_taf_valid_range_check" CHECK ("weather_taf"."valid_to" > "weather_taf"."valid_from")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "weather_metar_station_observed_type_idx" ON "weather_metar" USING btree ("station_icao","observed_at" DESC NULLS FIRST,"report_type" DESC NULLS FIRST);--> statement-breakpoint
CREATE UNIQUE INDEX "weather_taf_station_issued_idx" ON "weather_taf" USING btree ("station_icao","issued_at" DESC NULLS FIRST);