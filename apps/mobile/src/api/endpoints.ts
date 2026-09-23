// Client API typé : un point d'entrée par route du contrat (@app/contracts), regroupé par
// domaine. Aucun format n'est redéfini ici, uniquement des schémas déjà exportés par le contrat.
import type { ZodType } from "zod";
import {
  API_ROUTES,
  PUBLIC_ROUTES,
  type ApiRouteName,
  type AppleSignInRequest,
  type DevSignInRequest,
  SignInResponseSchema,
  MeSchema,
  SettingsSchema,
  type SetUsernameRequest,
  type UpdateSettingsRequest,
  type HealthConsentRequest,
  HealthConsentResponseSchema,
  type RegisterDeviceRequest,
  type SyncActivityRequest,
  SyncActivityResponseSchema,
  type ActivityHistoryQuery,
  ActivityHistoryResponseSchema,
  TodayResponseSchema,
  LeaderboardResponseSchema,
  FriendsResponseSchema,
  FriendActivityResponseSchema,
  FriendRequestsResponseSchema,
  type CreateFriendRequest,
  CreateFriendRequestResponseSchema,
  AcceptFriendRequestResponseSchema,
  BlocksResponseSchema,
  type BlockUserRequest,
  type SendEncouragementRequest,
  SendEncouragementResponseSchema,
  ReceivedEncouragementsResponseSchema,
  type UserId,
} from "@app/contracts";
import { apiRequest, type HttpMethod, type QueryParams } from "./http";
import { API_BASE_URL } from "./env";

function parseRoute(name: ApiRouteName): { method: HttpMethod; template: string } {
  const [method, template] = API_ROUTES[name].split(" ") as [HttpMethod, string];
  return { method, template };
}

function fillPath(template: string, params: Record<string, string>): string {
  return template.replace(/:([a-zA-Z]+)/g, (_match, key: string) => {
    const value = params[key];
    if (value === undefined) throw new Error(`Paramètre de route manquant : ${key}`);
    return encodeURIComponent(value);
  });
}

type CallOptions<TResponse> = {
  params?: Record<string, string>;
  query?: QueryParams;
  body?: unknown;
  responseSchema?: ZodType<TResponse>;
};

function call<TResponse = void>(name: ApiRouteName, options: CallOptions<TResponse> = {}): Promise<TResponse> {
  const { method, template } = parseRoute(name);
  const path = options.params ? fillPath(template, options.params) : template;
  const auth = !PUBLIC_ROUTES.includes(name);
  return apiRequest<TResponse>({
    method,
    path,
    auth,
    query: options.query,
    body: options.body,
    responseSchema: options.responseSchema,
  });
}

/** Page statique servie par l'API (CA : ouverte dans un navigateur intégré, jamais fetchée en JSON). */
export const PRIVACY_URL = `${API_BASE_URL}/privacy`;

export const api = {
  auth: {
    signInApple: (body: AppleSignInRequest) => call("signInApple", { body, responseSchema: SignInResponseSchema }),
    signInDev: (body: DevSignInRequest) => call("signInDev", { body, responseSchema: SignInResponseSchema }),
    logout: () => call("logout"),
  },
  me: {
    get: () => call("me", { responseSchema: MeSchema }),
    deleteAccount: () => call("deleteMe"),
    setUsername: (body: SetUsernameRequest) => call("setUsername", { body, responseSchema: MeSchema }),
    getSettings: () => call("getSettings", { responseSchema: SettingsSchema }),
    updateSettings: (body: UpdateSettingsRequest) => call("updateSettings", { body, responseSchema: SettingsSchema }),
    setHealthConsent: (body: HealthConsentRequest) =>
      call("healthConsent", { body, responseSchema: HealthConsentResponseSchema }),
    registerDevice: (body: RegisterDeviceRequest) => call("registerDevice", { body }),
  },
  activity: {
    sync: (body: SyncActivityRequest) => call("syncActivity", { body, responseSchema: SyncActivityResponseSchema }),
    history: (query?: Partial<ActivityHistoryQuery>) =>
      call("activityHistory", { query, responseSchema: ActivityHistoryResponseSchema }),
  },
  today: () => call("today", { responseSchema: TodayResponseSchema }),
  leaderboards: {
    daily: () => call("leaderboardDaily", { responseSchema: LeaderboardResponseSchema }),
    weekly: () => call("leaderboardWeekly", { responseSchema: LeaderboardResponseSchema }),
  },
  friends: {
    list: () => call("friends", { responseSchema: FriendsResponseSchema }),
    remove: (userId: UserId) => call("removeFriend", { params: { userId } }),
    activity: (userId: UserId) => call("friendActivity", { params: { userId }, responseSchema: FriendActivityResponseSchema }),
  },
  friendRequests: {
    list: () => call("friendRequests", { responseSchema: FriendRequestsResponseSchema }),
    create: (body: CreateFriendRequest) =>
      call("createFriendRequest", { body, responseSchema: CreateFriendRequestResponseSchema }),
    accept: (id: string) => call("acceptFriendRequest", { params: { id }, responseSchema: AcceptFriendRequestResponseSchema }),
    decline: (id: string) => call("declineFriendRequest", { params: { id } }),
    cancel: (id: string) => call("cancelFriendRequest", { params: { id } }),
  },
  blocks: {
    list: () => call("blocks", { responseSchema: BlocksResponseSchema }),
    block: (body: BlockUserRequest) => call("block", { body }),
    unblock: (userId: UserId) => call("unblock", { params: { userId } }),
  },
  encouragements: {
    send: (body: SendEncouragementRequest) =>
      call("sendEncouragement", { body, responseSchema: SendEncouragementResponseSchema }),
    received: () => call("receivedEncouragements", { responseSchema: ReceivedEncouragementsResponseSchema }),
  },
};
