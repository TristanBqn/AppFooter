// Carte des routes V1. Toutes exigent `Authorization: Bearer <token>` sauf PUBLIC_ROUTES (CA1).
// Les routes sociales (classements, amis, demandes, blocages, encouragements) exigent en plus
// un pseudonyme choisi (403 USERNAME_REQUIRED).
export const API_ROUTES = {
  health: "GET /health",
  privacy: "GET /privacy",
  signInApple: "POST /auth/apple",
  signInDev: "POST /auth/dev",
  logout: "POST /auth/logout",
  me: "GET /me",
  deleteMe: "DELETE /me",
  setUsername: "PUT /me/username",
  getSettings: "GET /me/settings",
  updateSettings: "PATCH /me/settings",
  healthConsent: "PUT /me/consents/health",
  registerDevice: "PUT /me/devices",
  syncActivity: "PUT /me/activity",
  activityHistory: "GET /me/activity",
  today: "GET /me/today",
  leaderboardDaily: "GET /leaderboards/daily",
  leaderboardWeekly: "GET /leaderboards/weekly",
  friends: "GET /friends",
  removeFriend: "DELETE /friends/:userId",
  friendActivity: "GET /friends/:userId/activity",
  friendRequests: "GET /friend-requests",
  createFriendRequest: "POST /friend-requests",
  acceptFriendRequest: "POST /friend-requests/:id/accept",
  declineFriendRequest: "POST /friend-requests/:id/decline",
  cancelFriendRequest: "DELETE /friend-requests/:id",
  blocks: "GET /blocks",
  block: "POST /blocks",
  unblock: "DELETE /blocks/:userId",
  sendEncouragement: "POST /encouragements",
  receivedEncouragements: "GET /encouragements/received",
} as const;

export type ApiRouteName = keyof typeof API_ROUTES;

/** Routes accessibles sans session. `POST /auth/logout` exige une session. */
export const PUBLIC_ROUTES: readonly ApiRouteName[] = ["health", "privacy", "signInApple", "signInDev"];
