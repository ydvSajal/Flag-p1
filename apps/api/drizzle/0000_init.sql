CREATE TABLE "profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"role" text DEFAULT 'tester' NOT NULL,
	"wave" smallint NOT NULL,
	"consented_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_role_check" CHECK ("profiles"."role" in ('tester','creator')),
	CONSTRAINT "profiles_wave_check" CHECK ("profiles"."wave" in (1,2,3))
);
--> statement-breakpoint
CREATE TABLE "responses" (
	"set_result_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"signal" text NOT NULL,
	CONSTRAINT "responses_set_result_id_variant_id_pk" PRIMARY KEY("set_result_id","variant_id"),
	CONSTRAINT "responses_signal_check" CHECK ("responses"."signal" in ('pick','yes','no'))
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tester_id" text NOT NULL,
	"module" text NOT NULL,
	"layout" text NOT NULL,
	"target_count" smallint NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "sessions_layout_check" CHECK ("sessions"."layout" in ('grid','swipe','this_or_that','yes_no')),
	CONSTRAINT "sessions_target_check" CHECK ("sessions"."target_count" between 1 and 20)
);
--> statement-breakpoint
CREATE TABLE "set_results" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"set_id" uuid NOT NULL,
	"tester_id" text NOT NULL,
	"layout" text NOT NULL,
	"duration_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "set_results_tester_set_unique" UNIQUE("tester_id","set_id"),
	CONSTRAINT "set_results_duration_check" CHECK ("set_results"."duration_ms" between 0 and 600000)
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"email" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"is_anonymous" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "variant_sets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"creator_id" text,
	"module" text NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "variant_sets_module_check" CHECK ("variant_sets"."module" in ('thumbnails','captions','reel_captions','visuals')),
	CONSTRAINT "variant_sets_title_check" CHECK (char_length("variant_sets"."title") between 1 and 120),
	CONSTRAINT "variant_sets_status_check" CHECK ("variant_sets"."status" in ('active','deleted'))
);
--> statement-breakpoint
CREATE TABLE "variants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"set_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"image_key" text,
	"text" text,
	"position" smallint NOT NULL,
	CONSTRAINT "variants_set_position_unique" UNIQUE("set_id","position"),
	CONSTRAINT "variants_kind_check" CHECK ("variants"."kind" in ('image','text')),
	CONSTRAINT "variants_text_check" CHECK ("variants"."text" is null or char_length("variants"."text") between 1 and 280),
	CONSTRAINT "variants_position_check" CHECK ("variants"."position" between 0 and 3),
	CONSTRAINT "variants_payload_check" CHECK (("variants"."kind" = 'image' and "variants"."image_key" is not null) or ("variants"."kind" = 'text' and "variants"."text" is not null))
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responses" ADD CONSTRAINT "responses_set_result_id_set_results_id_fk" FOREIGN KEY ("set_result_id") REFERENCES "public"."set_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responses" ADD CONSTRAINT "responses_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_tester_id_user_id_fk" FOREIGN KEY ("tester_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_results" ADD CONSTRAINT "set_results_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_results" ADD CONSTRAINT "set_results_set_id_variant_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."variant_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_results" ADD CONSTRAINT "set_results_tester_id_user_id_fk" FOREIGN KEY ("tester_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_sets" ADD CONSTRAINT "variant_sets_creator_id_user_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_set_id_variant_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."variant_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_one_open_idx" ON "sessions" USING btree ("tester_id","module") WHERE "sessions"."completed_at" is null;--> statement-breakpoint
CREATE INDEX "sessions_last_seen_idx" ON "sessions" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "set_results_set_idx" ON "set_results" USING btree ("set_id");--> statement-breakpoint
CREATE INDEX "set_results_session_idx" ON "set_results" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "variant_sets_module_status_idx" ON "variant_sets" USING btree ("module","status");