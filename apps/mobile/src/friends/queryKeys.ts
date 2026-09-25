// Clés TanStack Query partagées (M7) : écran Amis, écran Classement (navigation) et fiche ami.
export const FRIENDS_QUERY_KEY = ["friends"] as const;
export const FRIEND_REQUESTS_QUERY_KEY = ["friendRequests"] as const;

export function friendActivityQueryKey(userId: string) {
  return ["friendActivity", userId] as const;
}
