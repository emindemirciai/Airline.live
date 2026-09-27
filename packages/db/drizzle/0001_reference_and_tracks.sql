CREATE TABLE "airline_overrides" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text,
	"icao" text,
	"iata" text,
	"note" text,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "airlines" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"icao" text,
	"iata" text,
	"positioning_flight_pattern" text,
	"charter_flight_pattern" text,
	"row_hash" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "airports" (
	"id" integer PRIMARY KEY NOT NULL,
	"ident" text NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"latitude_deg" double precision NOT NULL,
	"longitude_deg" double precision NOT NULL,
	"elevation_ft" integer,
	"iso_country" text NOT NULL,
	"iso_region" text NOT NULL,
	"municipality" text,
	"scheduled_service" boolean NOT NULL,
	"icao_code" text,
	"iata_code" text,
	"gps_code" text,
	"row_hash" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flights" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "flights_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"hex" text NOT NULL,
	"callsign" text,
	"registration" text,
	"type_code" text,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_health" (
	"provider" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"last_success_at" timestamp with time zone,
	"last_error_at" timestamp with time zone,
	"last_error" text,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reference_sources" (
	"source" text PRIMARY KEY NOT NULL,
	"origin" text NOT NULL,
	"etag" text,
	"last_modified" text,
	"checked_at" timestamp with time zone,
	"imported_at" timestamp with time zone,
	"row_count" integer,
	"skipped_count" integer,
	"last_error" text,
	"last_error_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runway_overrides" (
	"runway_id" integer PRIMARY KEY NOT NULL,
	"le_threshold_lat" double precision,
	"le_threshold_lon" double precision,
	"le_true_bearing_deg" real,
	"he_threshold_lat" double precision,
	"he_threshold_lon" double precision,
	"he_true_bearing_deg" real,
	"note" text,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runways" (
	"id" integer PRIMARY KEY NOT NULL,
	"airport_id" integer NOT NULL,
	"airport_ident" text NOT NULL,
	"length_ft" integer,
	"width_ft" integer,
	"surface" text,
	"lighted" boolean NOT NULL,
	"ends_are_thresholds" boolean DEFAULT false NOT NULL,
	"le_ident" text,
	"le_latitude_deg" double precision,
	"le_longitude_deg" double precision,
	"le_elevation_ft" integer,
	"le_heading_deg_t" real,
	"le_displaced_threshold_ft" integer,
	"le_true_bearing_deg" real,
	"le_bearing_source" text,
	"le_heading_mismatch" boolean DEFAULT false NOT NULL,
	"le_threshold_lat" double precision NOT NULL,
	"le_threshold_lon" double precision NOT NULL,
	"le_threshold_source" text NOT NULL,
	"he_ident" text,
	"he_latitude_deg" double precision,
	"he_longitude_deg" double precision,
	"he_elevation_ft" integer,
	"he_heading_deg_t" real,
	"he_displaced_threshold_ft" integer,
	"he_true_bearing_deg" real,
	"he_bearing_source" text,
	"he_heading_mismatch" boolean DEFAULT false NOT NULL,
	"he_threshold_lat" double precision NOT NULL,
	"he_threshold_lon" double precision NOT NULL,
	"he_threshold_source" text NOT NULL,
	"row_hash" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"icao" text NOT NULL,
	"iata" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"fetch_radius_nm" real DEFAULT 60 NOT NULL,
	"default_alert_distance_km" real DEFAULT 10 NOT NULL,
	"geoid_undulation_m" real,
	"coverage_ground_ratio_7d" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stations_icao_unique" UNIQUE("icao")
);
--> statement-breakpoint
CREATE TABLE "track_points_fine" (
	"flight_id" bigint NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"lat" double precision NOT NULL,
	"lon" double precision NOT NULL,
	"alt_baro_ft" integer,
	"alt_geom_ft" integer,
	"gs_kt" real,
	"track_deg" real,
	"vertical_rate_fpm" integer,
	"on_ground" boolean DEFAULT false NOT NULL,
	"source" smallint NOT NULL,
	CONSTRAINT "track_points_fine_flight_id_ts_pk" PRIMARY KEY("flight_id","ts")
) PARTITION BY RANGE ("ts");
--> statement-breakpoint
CREATE TABLE "track_points_sampled" (
	"flight_id" bigint NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"lat" double precision NOT NULL,
	"lon" double precision NOT NULL,
	"alt_baro_ft" integer,
	"alt_geom_ft" integer,
	"gs_kt" real,
	"track_deg" real,
	"vertical_rate_fpm" integer,
	"on_ground" boolean DEFAULT false NOT NULL,
	"source" smallint NOT NULL,
	CONSTRAINT "track_points_sampled_flight_id_ts_pk" PRIMARY KEY("flight_id","ts")
) PARTITION BY RANGE ("ts");
--> statement-breakpoint
ALTER TABLE "runways" ADD CONSTRAINT "runways_airport_id_airports_id_fk" FOREIGN KEY ("airport_id") REFERENCES "public"."airports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "airlines_icao_idx" ON "airlines" USING btree ("icao");--> statement-breakpoint
CREATE INDEX "airlines_iata_idx" ON "airlines" USING btree ("iata");--> statement-breakpoint
CREATE INDEX "airports_ident_idx" ON "airports" USING btree ("ident");--> statement-breakpoint
CREATE INDEX "airports_icao_code_idx" ON "airports" USING btree ("icao_code");--> statement-breakpoint
CREATE INDEX "airports_iata_code_idx" ON "airports" USING btree ("iata_code");--> statement-breakpoint
CREATE INDEX "flights_hex_last_seen_idx" ON "flights" USING btree ("hex","last_seen_at");--> statement-breakpoint
CREATE INDEX "flights_callsign_idx" ON "flights" USING btree ("callsign");--> statement-breakpoint
CREATE INDEX "flights_active_idx" ON "flights" USING btree ("last_seen_at") WHERE "flights"."status" = 'active';--> statement-breakpoint
CREATE INDEX "runways_airport_id_idx" ON "runways" USING btree ("airport_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stations_single_primary_idx" ON "stations" USING btree ("is_primary") WHERE "stations"."is_primary";--> statement-breakpoint
CREATE INDEX "track_points_fine_ts_brin" ON "track_points_fine" USING brin ("ts");--> statement-breakpoint
CREATE INDEX "track_points_sampled_ts_brin" ON "track_points_sampled" USING brin ("ts");