// Demandes d'amitié et amis (F7-F9, CA7, CA8, ADR 005). Réponse neutre à l'ajout d'ami : le
// pipeline de notification (« demande reçue », « demande acceptée ») sera branché en B9.
import type {
  AcceptFriendRequestResponse,
  CreateFriendRequestResponse,
  Friend,
  FriendActivityResponse,
  FriendRequestsResponse,
  FriendsResponse,
} from "@app/contracts";
import { FRIEND_HISTORY_DAYS, MAX_FRIENDS, MAX_PENDING_OUTGOING_REQUESTS } from "@app/contracts";
import type { Db } from "@app/db";
import { schema } from "@app/db";
import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { addDaysToLocalDate, localDate } from "../../domain/local-date";
import { AppError } from "../../errors";
import { isUniqueViolation } from "../../lib/db-errors";

interface UserRow {
  id: string;
  username: string | null;
  timeZone: string;
  lastSyncAt: Date | null;
}

const userColumns = {
  id: schema.users.id,
  username: schema.users.username,
  timeZone: schema.users.timeZone,
  lastSyncAt: schema.users.lastSyncAt,
};

async function findUserByUsername(db: Db, username: string): Promise<UserRow | undefined> {
  const [row] = await db.select(userColumns).from(schema.users).where(eq(schema.users.username, username));
  return row;
}

async function findUserById(db: Db, userId: string): Promise<UserRow | undefined> {
  const [row] = await db.select(userColumns).from(schema.users).where(eq(schema.users.id, userId));
  return row;
}

async function isBlocking(db: Db, blockerId: string, blockedId: string): Promise<boolean> {
  const [row] = await db
    .select({ blockerId: schema.blocks.blockerId })
    .from(schema.blocks)
    .where(and(eq(schema.blocks.blockerId, blockerId), eq(schema.blocks.blockedId, blockedId)));
  return !!row;
}

async function areFriends(db: Db, userId: string, friendId: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: schema.friendships.userId })
    .from(schema.friendships)
    .where(and(eq(schema.friendships.userId, userId), eq(schema.friendships.friendId, friendId)));
  return !!row;
}

async function countFriends(db: Db, userId: string): Promise<number> {
  const rows = await db.select({ friendId: schema.friendships.friendId }).from(schema.friendships).where(eq(schema.friendships.userId, userId));
  return rows.length;
}

async function acceptsFriendRequests(db: Db, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ acceptFriendRequests: schema.userSettings.acceptFriendRequests })
    .from(schema.userSettings)
    .where(eq(schema.userSettings.userId, userId));
  return row?.acceptFriendRequests ?? true;
}

async function buildFriendView(db: Db, meId: string, meTimeZone: string, friendId: string, friendsSince: Date, now: Date): Promise<Friend> {
  const friendUser = await findUserById(db, friendId);
  if (!friendUser || friendUser.username === null) throw new AppError("NOT_FOUND", "Ami introuvable");

  const friendToday = localDate(now, friendUser.timeZone);
  const [activity] = await db
    .select({ steps: schema.dailyActivity.steps })
    .from(schema.dailyActivity)
    .where(and(eq(schema.dailyActivity.userId, friendId), eq(schema.dailyActivity.date, friendToday)));

  const myToday = localDate(now, meTimeZone);
  const [encouraged] = await db
    .select({ id: schema.encouragements.id })
    .from(schema.encouragements)
    .where(
      and(
        eq(schema.encouragements.senderId, meId),
        eq(schema.encouragements.recipientId, friendId),
        eq(schema.encouragements.senderLocalDate, myToday),
      ),
    );

  return {
    userId: friendUser.id,
    username: friendUser.username,
    todaySteps: activity?.steps ?? 0,
    friendsSince: friendsSince.toISOString(),
    encouragedToday: !!encouraged,
  };
}

/**
 * POST /friend-requests (CA7, ADR 005) : réponse toujours `{ status: "requested" }`, quel que
 * soit le résultat réel (pseudo inconnu, cible bloquante, refus, demande réellement créée) —
 * seules exceptions : 422 CANNOT_TARGET_SELF, 409 TARGET_BLOCKED (si *je* bloque la cible).
 */
export async function createFriendRequest(db: Db, senderId: string, targetUsername: string, now: Date): Promise<CreateFriendRequestResponse> {
  const target = await findUserByUsername(db, targetUsername);
  if (!target) return { status: "requested" }; // pseudo inconnu : rien n'est créé.

  if (target.id === senderId) {
    throw new AppError("CANNOT_TARGET_SELF", "Impossible de s'ajouter soi-même");
  }
  if (await isBlocking(db, senderId, target.id)) {
    throw new AppError("TARGET_BLOCKED", "Tu as bloqué cet utilisateur");
  }
  if (await areFriends(db, senderId, target.id)) {
    return { status: "requested" }; // déjà amis : no-op silencieux.
  }

  // Demande inverse en attente et visible ⇒ acceptation automatique (ADR 005).
  const [reverse] = await db
    .select({ id: schema.friendRequests.id })
    .from(schema.friendRequests)
    .where(
      and(
        eq(schema.friendRequests.senderId, target.id),
        eq(schema.friendRequests.recipientId, senderId),
        eq(schema.friendRequests.hidden, false),
      ),
    );
  if (reverse) {
    const [senderCount, targetCount] = await Promise.all([countFriends(db, senderId), countFriends(db, target.id)]);
    // Au-delà de la limite : la demande inverse reste en attente, réponse neutre inchangée.
    if (senderCount < MAX_FRIENDS && targetCount < MAX_FRIENDS) {
      await db.transaction(async (tx) => {
        await tx.delete(schema.friendRequests).where(eq(schema.friendRequests.id, reverse.id));
        await tx.insert(schema.friendships).values([
          { userId: senderId, friendId: target.id, createdAt: now },
          { userId: target.id, friendId: senderId, createdAt: now },
        ]);
      });
    }
    return { status: "requested" };
  }

  const pendingOutgoing = await db
    .select({ id: schema.friendRequests.id })
    .from(schema.friendRequests)
    .where(eq(schema.friendRequests.senderId, senderId));
  if (pendingOutgoing.length >= MAX_PENDING_OUTGOING_REQUESTS) {
    return { status: "requested" }; // borne de sécurité (pas de pagination en V1), pas d'erreur exposée.
  }

  // Cachée si la cible me bloque ou refuse les demandes : jamais notifiée ni visible d'elle ;
  // l'expéditeur ne distingue donc pas « bloqué / refuse » de « en attente ».
  const hidden = (await isBlocking(db, target.id, senderId)) || !(await acceptsFriendRequests(db, target.id));

  try {
    await db.insert(schema.friendRequests).values({ senderId, recipientId: target.id, hidden, createdAt: now });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err; // demande déjà en attente : idempotent.
  }

  return { status: "requested" };
}

export async function listFriendRequests(db: Db, userId: string): Promise<FriendRequestsResponse> {
  const incomingRows = await db
    .select({ id: schema.friendRequests.id, senderId: schema.friendRequests.senderId, createdAt: schema.friendRequests.createdAt })
    .from(schema.friendRequests)
    .where(and(eq(schema.friendRequests.recipientId, userId), eq(schema.friendRequests.hidden, false)))
    .orderBy(desc(schema.friendRequests.createdAt));

  // Vue de l'expéditeur : toutes ses demandes sortantes, y compris cachées (indistinguable pour lui, ADR 005).
  const outgoingRows = await db
    .select({ id: schema.friendRequests.id, recipientId: schema.friendRequests.recipientId, createdAt: schema.friendRequests.createdAt })
    .from(schema.friendRequests)
    .where(eq(schema.friendRequests.senderId, userId))
    .orderBy(desc(schema.friendRequests.createdAt));

  const otherIds = [...new Set([...incomingRows.map((r) => r.senderId), ...outgoingRows.map((r) => r.recipientId)])];
  const users = otherIds.length
    ? await db.select({ id: schema.users.id, username: schema.users.username }).from(schema.users).where(inArray(schema.users.id, otherIds))
    : [];
  const usersById = new Map(users.map((u) => [u.id, u] as const));

  const incoming = incomingRows
    .filter((r) => usersById.get(r.senderId)?.username)
    .map((r) => ({
      id: r.id,
      from: { userId: r.senderId, username: usersById.get(r.senderId)!.username! },
      createdAt: r.createdAt.toISOString(),
    }));
  const outgoing = outgoingRows
    .filter((r) => usersById.get(r.recipientId)?.username)
    .map((r) => ({
      id: r.id,
      to: { userId: r.recipientId, username: usersById.get(r.recipientId)!.username! },
      createdAt: r.createdAt.toISOString(),
    }));

  return { incoming, outgoing };
}

/** 404 si la demande ne m'est pas adressée (visible) — jamais 403 (ADR 005). */
export async function acceptFriendRequest(db: Db, userId: string, requestId: string, now: Date): Promise<AcceptFriendRequestResponse> {
  const [request] = await db
    .select()
    .from(schema.friendRequests)
    .where(
      and(
        eq(schema.friendRequests.id, requestId),
        eq(schema.friendRequests.recipientId, userId),
        eq(schema.friendRequests.hidden, false),
      ),
    );
  if (!request) throw new AppError("NOT_FOUND", "Demande introuvable");

  const [senderCount, recipientCount] = await Promise.all([countFriends(db, request.senderId), countFriends(db, userId)]);
  if (senderCount >= MAX_FRIENDS || recipientCount >= MAX_FRIENDS) {
    throw new AppError("FRIEND_LIMIT_REACHED", "Limite d'amis atteinte");
  }

  await db.transaction(async (tx) => {
    await tx.delete(schema.friendRequests).where(eq(schema.friendRequests.id, requestId));
    await tx.insert(schema.friendships).values([
      { userId, friendId: request.senderId, createdAt: now },
      { userId: request.senderId, friendId: userId, createdAt: now },
    ]);
  });

  const me = await findUserById(db, userId);
  if (!me) throw new AppError("UNAUTHENTICATED", "Utilisateur introuvable");
  const friend = await buildFriendView(db, userId, me.timeZone, request.senderId, now, now);
  return { friend };
}

export async function declineFriendRequest(db: Db, userId: string, requestId: string): Promise<void> {
  const [request] = await db
    .select({ id: schema.friendRequests.id })
    .from(schema.friendRequests)
    .where(
      and(
        eq(schema.friendRequests.id, requestId),
        eq(schema.friendRequests.recipientId, userId),
        eq(schema.friendRequests.hidden, false),
      ),
    );
  if (!request) throw new AppError("NOT_FOUND", "Demande introuvable");
  await db.delete(schema.friendRequests).where(eq(schema.friendRequests.id, requestId));
}

export async function cancelFriendRequest(db: Db, userId: string, requestId: string): Promise<void> {
  const [request] = await db
    .select({ id: schema.friendRequests.id })
    .from(schema.friendRequests)
    .where(and(eq(schema.friendRequests.id, requestId), eq(schema.friendRequests.senderId, userId)));
  if (!request) throw new AppError("NOT_FOUND", "Demande introuvable");
  await db.delete(schema.friendRequests).where(eq(schema.friendRequests.id, requestId));
}

export async function removeFriend(db: Db, userId: string, friendId: string): Promise<void> {
  if (!(await areFriends(db, userId, friendId))) throw new AppError("NOT_FOUND", "Ami introuvable");
  await db.transaction(async (tx) => {
    await tx.delete(schema.friendships).where(and(eq(schema.friendships.userId, userId), eq(schema.friendships.friendId, friendId)));
    await tx.delete(schema.friendships).where(and(eq(schema.friendships.userId, friendId), eq(schema.friendships.friendId, userId)));
  });
}

/** GET /friends, trié par pseudonyme (4 requêtes bornées : amitiés, utilisateurs, activité, encouragements). */
export async function listFriends(db: Db, userId: string, now: Date): Promise<FriendsResponse> {
  const friendships = await db
    .select({ friendId: schema.friendships.friendId, createdAt: schema.friendships.createdAt })
    .from(schema.friendships)
    .where(eq(schema.friendships.userId, userId));
  if (friendships.length === 0) return { friends: [] };

  const friendIds = friendships.map((f) => f.friendId);
  const users = await db.select(userColumns).from(schema.users).where(inArray(schema.users.id, [userId, ...friendIds]));
  const usersById = new Map(users.map((u) => [u.id, u] as const));
  const me = usersById.get(userId);
  if (!me) throw new AppError("UNAUTHENTICATED", "Utilisateur introuvable");

  const todayByUser = new Map(friendIds.map((id) => [id, localDate(now, usersById.get(id)?.timeZone ?? me.timeZone)] as const));
  const dates = [...todayByUser.values()];
  const minDate = dates.reduce((min, d) => (d < min ? d : min), dates[0]!);
  const maxDate = dates.reduce((max, d) => (d > max ? d : max), dates[0]!);

  const activityRows = await db
    .select({ userId: schema.dailyActivity.userId, date: schema.dailyActivity.date, steps: schema.dailyActivity.steps })
    .from(schema.dailyActivity)
    .where(and(inArray(schema.dailyActivity.userId, friendIds), gte(schema.dailyActivity.date, minDate), lte(schema.dailyActivity.date, maxDate)));
  const stepsByUser = new Map<string, number>();
  for (const row of activityRows) {
    if (row.date === todayByUser.get(row.userId)) stepsByUser.set(row.userId, row.steps);
  }

  const myToday = localDate(now, me.timeZone);
  const encouragedRows = friendIds.length
    ? await db
        .select({ recipientId: schema.encouragements.recipientId })
        .from(schema.encouragements)
        .where(
          and(
            eq(schema.encouragements.senderId, userId),
            inArray(schema.encouragements.recipientId, friendIds),
            eq(schema.encouragements.senderLocalDate, myToday),
          ),
        )
    : [];
  const encouragedSet = new Set(encouragedRows.map((r) => r.recipientId));

  const friends: Friend[] = friendships
    .map((f) => usersById.get(f.friendId))
    .filter((u): u is UserRow & { username: string } => !!u && u.username !== null)
    .map((u) => ({
      userId: u.id,
      username: u.username,
      todaySteps: stepsByUser.get(u.id) ?? 0,
      friendsSince: friendships.find((f) => f.friendId === u.id)!.createdAt.toISOString(),
      encouragedToday: encouragedSet.has(u.id),
    }))
    .sort((a, b) => (a.username < b.username ? -1 : a.username > b.username ? 1 : 0));

  return { friends };
}

/** GET /friends/:userId/activity : 404 si non ami, jamais 403 (CA8, ADR 005). */
export async function getFriendActivity(db: Db, requesterId: string, friendId: string, now: Date): Promise<FriendActivityResponse> {
  if (requesterId === friendId || !(await areFriends(db, requesterId, friendId))) {
    throw new AppError("NOT_FOUND", "Ami introuvable");
  }

  const friendUser = await findUserById(db, friendId);
  if (!friendUser || friendUser.username === null) throw new AppError("NOT_FOUND", "Ami introuvable");

  const [settings] = await db
    .select({ showCalories: schema.userSettings.showCalories })
    .from(schema.userSettings)
    .where(eq(schema.userSettings.userId, friendId));
  const showCalories = settings?.showCalories ?? true;

  const today = localDate(now, friendUser.timeZone);
  const minDate = addDaysToLocalDate(today, -(FRIEND_HISTORY_DAYS - 1));

  const rows = await db
    .select({ date: schema.dailyActivity.date, steps: schema.dailyActivity.steps, activeCalories: schema.dailyActivity.activeCalories })
    .from(schema.dailyActivity)
    .where(and(eq(schema.dailyActivity.userId, friendId), gte(schema.dailyActivity.date, minDate), lte(schema.dailyActivity.date, today)))
    .orderBy(desc(schema.dailyActivity.date));

  const toDay = (row: { date: string; steps: number; activeCalories: number }) => ({
    date: row.date,
    steps: row.steps,
    activeCalories: showCalories ? row.activeCalories : null,
  });

  const history = rows.map(toDay);
  const todayEntry = history.find((d) => d.date === today) ?? { date: today, steps: 0, activeCalories: showCalories ? 0 : null };

  return {
    user: { userId: friendUser.id, username: friendUser.username },
    today: todayEntry,
    history,
    lastSyncAt: friendUser.lastSyncAt?.toISOString() ?? null,
  };
}
