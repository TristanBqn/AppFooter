// Provisionne une fois, avant toute suite, les comptes de dev réutilisés par les tests sociaux
// (CA5-CA9, CA11) : minimise le nombre total de POST /auth/dev sur tout le run face au débit par
// IP (ADR 007) — la base PGlite en mémoire n'offre aucune remise à zéro entre tests. Chaque relation
// (amitiés, blocages, réglages) reste construite explicitement dans le test qui en a besoin ; seule
// l'identité (connexion + pseudonyme) est mutualisée ici.
//
// Rôles et usages :
// - alice  : moi (CA5/6), amie de bob et carol ; self-404 (CA8)
// - bob    : ami d'alice (CA5/6 égalité) ; fiche activité + masquage calories (CA8)
// - carol  : amie d'alice (CA5/6 égalité) ; destinataire quota encouragement (CA9)
// - dave   : étranger à alice (CA5/6 exclusion, CA8 404) ; ami d'erin (CA11a)
// - erin   : amie de dave, bloquée par lui (CA11a : amitié détruite par le blocage)
// - frank  : envoie une demande à grace, non acceptée (CA11b)
// - grace  : bloque frank avant d'accepter (CA11b : demande en attente supprimée)
// - henry  : envoie des demandes neutres (CA7)
// - iris   : bloque henry avant sa demande (CA7 : demande cachée)
// - jules  : n'accepte pas les demandes (CA7 : demande cachée), puis cible bloquée (TARGET_BLOCKED)
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { request } from "@playwright/test";
import { type Actor, POOL_FIXTURE_FILE, POOL_ROLES, randomDevUserKey, signInWithUsername } from "./support/api";

export default async function globalSetup(): Promise<void> {
  const baseURL = "http://127.0.0.1:4000";
  const context = await request.newContext({ baseURL });
  const pool: Record<string, Actor> = {};
  try {
    for (const role of POOL_ROLES) {
      pool[role] = await signInWithUsername(context, randomDevUserKey(`pool_${role}`), `e2e${role}`);
    }
  } finally {
    await context.dispose();
  }
  mkdirSync(dirname(POOL_FIXTURE_FILE), { recursive: true });
  writeFileSync(POOL_FIXTURE_FILE, JSON.stringify(pool, null, 2));
}
