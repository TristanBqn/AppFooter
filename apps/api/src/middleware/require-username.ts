// Garde des routes sociales (classements, amis, encouragements…) : 403 USERNAME_REQUIRED tant
// que l'utilisateur n'a pas choisi de pseudonyme. À monter après `bearerAuth`.
import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../context";
import { AppError } from "../errors";

export const requireUsername: MiddlewareHandler<AppEnv> = async (c, next) => {
  const auth = c.get("auth");
  if (!auth || auth.username === null) {
    throw new AppError("USERNAME_REQUIRED", "Choisis un pseudonyme avant de continuer");
  }
  await next();
};
