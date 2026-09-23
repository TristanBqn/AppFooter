CREATE TABLE "blocks" (
	"blocker_id" uuid NOT NULL,
	"blocked_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blocks_blocker_id_blocked_id_pk" PRIMARY KEY("blocker_id","blocked_id")
);
--> statement-breakpoint
CREATE TABLE "daily_activity" (
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"steps" integer NOT NULL,
	"active_calories" integer NOT NULL,
	"time_zone" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_activity_user_id_date_pk" PRIMARY KEY("user_id","date"),
	CONSTRAINT "daily_activity_steps_check" CHECK ("daily_activity"."steps" >= 0),
	CONSTRAINT "daily_activity_active_calories_check" CHECK ("daily_activity"."active_calories" >= 0)
);
--> statement-breakpoint
CREATE TABLE "encouragements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"message_id" text NOT NULL,
	"sender_local_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "friend_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "friendships" (
	"user_id" uuid NOT NULL,
	"friend_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "friendships_user_id_friend_id_pk" PRIMARY KEY("user_id","friend_id"),
	CONSTRAINT "friendships_no_self_check" CHECK ("friendships"."user_id" <> "friendships"."friend_id")
);
--> statement-breakpoint
CREATE TABLE "milestone_events" (
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"threshold" integer NOT NULL,
	CONSTRAINT "milestone_events_user_id_date_threshold_pk" PRIMARY KEY("user_id","date","threshold")
);
--> statement-breakpoint
CREATE TABLE "pending_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_id" uuid NOT NULL,
	"actor_id" uuid,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"deliver_after" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"apns_token" text NOT NULL,
	"environment" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"show_calories" boolean DEFAULT true NOT NULL,
	"accept_friend_requests" boolean DEFAULT true NOT NULL,
	"share_milestones" boolean DEFAULT true NOT NULL,
	"notify_milestones" boolean DEFAULT true NOT NULL,
	"notify_friend_milestones" boolean DEFAULT true NOT NULL,
	"notify_encouragements" boolean DEFAULT true NOT NULL,
	"notify_friend_requests" boolean DEFAULT true NOT NULL,
	"quiet_enabled" boolean DEFAULT true NOT NULL,
	"quiet_start_min" integer DEFAULT 1320 NOT NULL,
	"quiet_end_min" integer DEFAULT 480 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"apple_sub" text NOT NULL,
	"username" text,
	"time_zone" text DEFAULT 'Europe/Paris' NOT NULL,
	"apple_refresh_token_enc" text,
	"health_consent_at" timestamp with time zone,
	"last_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocker_id_users_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_id_users_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_activity" ADD CONSTRAINT "daily_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encouragements" ADD CONSTRAINT "encouragements_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encouragements" ADD CONSTRAINT "encouragements_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_friend_id_users_id_fk" FOREIGN KEY ("friend_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_events" ADD CONSTRAINT "milestone_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_notifications" ADD CONSTRAINT "pending_notifications_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_notifications" ADD CONSTRAINT "pending_notifications_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_devices" ADD CONSTRAINT "push_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_devices" ADD CONSTRAINT "push_devices_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "blocks_blocked_id_idx" ON "blocks" USING btree ("blocked_id");--> statement-breakpoint
CREATE UNIQUE INDEX "encouragements_sender_recipient_date_key" ON "encouragements" USING btree ("sender_id","recipient_id","sender_local_date");--> statement-breakpoint
CREATE INDEX "encouragements_recipient_created_idx" ON "encouragements" USING btree ("recipient_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "friend_requests_sender_recipient_key" ON "friend_requests" USING btree ("sender_id","recipient_id");--> statement-breakpoint
CREATE INDEX "friend_requests_recipient_id_idx" ON "friend_requests" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "friendships_friend_id_idx" ON "friendships" USING btree ("friend_id");--> statement-breakpoint
CREATE INDEX "pending_notifications_deliver_after_idx" ON "pending_notifications" USING btree ("deliver_after");--> statement-breakpoint
CREATE UNIQUE INDEX "push_devices_apns_token_key" ON "push_devices" USING btree ("apns_token");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_apple_sub_key" ON "users" USING btree ("apple_sub");--> statement-breakpoint
CREATE UNIQUE INDEX "users_lower_username_key" ON "users" USING btree (lower("username"));