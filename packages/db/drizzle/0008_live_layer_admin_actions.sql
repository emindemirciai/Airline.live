-- Canlı katman anahtarı ve yönetici işlem kaydı (Parça 1 M7d.1, D-115). live_layer_state tek
-- satırdır (id = 1); satır yoksa katman açıktır, bu yüzden tohum satırı yoktur. admin_actions
-- kim, ne zaman, ne yaptı ve isteğe bağlı nedeni tutar; silinmez, IP adresi yazılmaz.
CREATE TABLE "admin_actions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "admin_actions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"reason" text,
	CONSTRAINT "admin_actions_action_check" CHECK ("admin_actions"."action" in ('live_layer_on', 'live_layer_off')),
	CONSTRAINT "admin_actions_reason_check" CHECK (char_length("admin_actions"."reason") <= 500)
);
--> statement-breakpoint
CREATE TABLE "live_layer_state" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"enabled" boolean NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"updated_by" text NOT NULL,
	CONSTRAINT "live_layer_state_singleton_check" CHECK ("live_layer_state"."id" = 1)
);
--> statement-breakpoint
CREATE INDEX "admin_actions_at_idx" ON "admin_actions" USING btree ("at");