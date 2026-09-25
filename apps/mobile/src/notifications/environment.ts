// Environnement APNs attendu par `PUT /me/devices` (M10, CA10). Seul le profil EAS "production"
// utilise l'environnement APNs de production ; tout le reste (dev build, TestFlight interne,
// simulateur) est en sandbox (voir ADR 002 / src/env.ts pour la même détection de profil).
import type { RegisterDeviceRequest } from "@app/contracts";
import { getEasBuildProfile } from "../env";

export function resolvePushEnvironment(
  easBuildProfile: string | null = getEasBuildProfile(),
): RegisterDeviceRequest["environment"] {
  return easBuildProfile === "production" ? "production" : "sandbox";
}
