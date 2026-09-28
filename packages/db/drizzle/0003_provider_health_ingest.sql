CREATE TABLE "provider_health_hourly" (
	"provider" text NOT NULL,
	"hour" timestamp with time zone NOT NULL,
	"requests" integer DEFAULT 0 NOT NULL,
	"successes" integer DEFAULT 0 NOT NULL,
	"rate_limited" integer DEFAULT 0 NOT NULL,
	"server_errors" integer DEFAULT 0 NOT NULL,
	"network_errors" integer DEFAULT 0 NOT NULL,
	"other_errors" integer DEFAULT 0 NOT NULL,
	"freshness_p95_max_s" real,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_health_hourly_provider_hour_pk" PRIMARY KEY("provider","hour")
);
--> statement-breakpoint
CREATE TABLE "provider_status_changes" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "provider_status_changes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"provider" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"reason" text
);
--> statement-breakpoint
ALTER TABLE "provider_health" ADD COLUMN "rps" real;--> statement-breakpoint
ALTER TABLE "provider_health" ADD COLUMN "circuit" text DEFAULT 'closed' NOT NULL;--> statement-breakpoint
ALTER TABLE "provider_health" ADD COLUMN "backoff_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "provider_health" ADD COLUMN "freshness_p95_s" real;--> statement-breakpoint
ALTER TABLE "provider_health" ADD COLUMN "error_ratio_60s" real;--> statement-breakpoint
ALTER TABLE "provider_health" ADD COLUMN "requests_60s" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "provider_status_changes_provider_at_idx" ON "provider_status_changes" USING btree ("provider","at");