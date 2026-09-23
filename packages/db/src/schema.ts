// Schéma Drizzle (docs/architecture.md §2). Toutes les FK vers `users.id` sont ON DELETE CASCADE
// (CA12, ADR 006) : supprimer un utilisateur efface toute trace de lui dans les autres tables.
// Horodatages en `timestamptz` (UTC) ; dates locales (jour civil) en `date`.
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Identifiant Apple (`sub`) ou `dev:<clé>` pour la connexion de dev (ADR 001). */
    appleSub: text("apple_sub").notNull(),
    /** Toujours déjà en minuscules (CA2) ; null tant que non choisi. */
    username: text("username"),
    timeZone: text("time_zone").notNull().default("Europe/Paris"),
    /** Refresh token Apple chiffré (AES-256-GCM), utilisé uniquement pour la révocation. */
    appleRefreshTokenEnc: text("apple_refresh_token_enc"),
    healthConsentAt: timestamp("health_consent_at", { withTimezone: true }),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("users_apple_sub_key").on(table.appleSub),
    uniqueIndex("users_lower_username_key").on(sql`lower(${table.username})`),
  ],
);

export const userSettings = pgTable("user_settings", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  showCalories: boolean("show_calories").notNull().default(true),
  acceptFriendRequests: boolean("accept_friend_requests").notNull().default(true),
  shareMilestones: boolean("share_milestones").notNull().default(true),
  notifyMilestones: boolean("notify_milestones").notNull().default(true),
  notifyFriendMilestones: boolean("notify_friend_milestones").notNull().default(true),
  notifyEncouragements: boolean("notify_encouragements").notNull().default(true),
  notifyFriendRequests: boolean("notify_friend_requests").notNull().default(true),
  quietEnabled: boolean("quiet_enabled").notNull().default(true),
  /** Minutes depuis minuit local, bornes par défaut 22:00–08:00 (ADR 004). */
  quietStartMin: integer("quiet_start_min").notNull().default(1320),
  quietEndMin: integer("quiet_end_min").notNull().default(480),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** SHA-256 du jeton opaque ; le jeton en clair n'est jamais stocké (ADR 001). */
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("sessions_token_hash_key").on(table.tokenHash), index("sessions_user_id_idx").on(table.userId)],
);

export const pushDevices = pgTable(
  "push_devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Déconnexion (session supprimée) ⇒ l'appareil ne reçoit plus de push. */
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    apnsToken: text("apns_token").notNull(),
    environment: text("environment", { enum: ["sandbox", "production"] }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("push_devices_apns_token_key").on(table.apnsToken)],
);

export const dailyActivity = pgTable(
  "daily_activity",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    steps: integer("steps").notNull(),
    activeCalories: integer("active_calories").notNull(),
    timeZone: text("time_zone").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.date] }),
    check("daily_activity_steps_check", sql`${table.steps} >= 0`),
    check("daily_activity_active_calories_check", sql`${table.activeCalories} >= 0`),
  ],
);

export const milestoneEvents = pgTable(
  "milestone_events",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    threshold: integer("threshold").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.date, table.threshold] })],
);

export const friendships = pgTable(
  "friendships",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    friendId: uuid("friend_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.friendId] }),
    index("friendships_friend_id_idx").on(table.friendId),
    check("friendships_no_self_check", sql`${table.userId} <> ${table.friendId}`),
  ],
);

export const friendRequests = pgTable(
  "friend_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipientId: uuid("recipient_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Demande « fantôme » (cible bloquante ou refusant les demandes) : visible du seul expéditeur (ADR 005). */
    hidden: boolean("hidden").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("friend_requests_sender_recipient_key").on(table.senderId, table.recipientId),
    index("friend_requests_recipient_id_idx").on(table.recipientId),
  ],
);

export const blocks = pgTable(
  "blocks",
  {
    blockerId: uuid("blocker_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedId: uuid("blocked_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.blockerId, table.blockedId] }), index("blocks_blocked_id_idx").on(table.blockedId)],
);

export const encouragements = pgTable(
  "encouragements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipientId: uuid("recipient_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Identifiant du catalogue fermé (`ENCOURAGEMENT_MESSAGE_IDS` de @app/contracts) ; aucun texte libre. */
    messageId: text("message_id").notNull(),
    /** Jour local de l'expéditeur au moment de l'envoi : clé du quota (CA9). */
    senderLocalDate: date("sender_local_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("encouragements_sender_recipient_date_key").on(table.senderId, table.recipientId, table.senderLocalDate),
    index("encouragements_recipient_created_idx").on(table.recipientId, table.createdAt.desc()),
  ],
);

export const pendingNotifications = pgTable(
  "pending_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipientId: uuid("recipient_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "cascade" }),
    /** Valeurs : `NotificationType` de @app/contracts. */
    type: text("type").notNull(),
    payload: jsonb("payload").notNull(),
    deliverAfter: timestamp("deliver_after", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("pending_notifications_deliver_after_idx").on(table.deliverAfter)],
);
