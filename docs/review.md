# Revue R3 (reviewer) : E2E CA12, sécurité, performance

Périmètre examiné : `apps/api` (surface HTTP complète), `apps/mobile` (stockage du jeton, source
santé, bundle), dépendances (`pnpm audit --prod`). Méthode : lecture de code + preuves d'exécution
(`pnpm test:e2e`, `pnpm check`). Rien n'a été corrigé ici (hors périmètre reviewer) : chaque
anomalie devient une tâche `[owner]`.

## E2E (Playwright, `tests/e2e/`)

33/33 verts, aucune anomalie : `pnpm test:e2e` (webServer sur le port fixe 4000, arrêté après le
run). CA12 ajouté ce cycle (`tests/e2e/ca12-account-deletion.spec.ts`) : jeton invalidé (401),
amitié disparue chez l'ami restant, pseudonyme et `apple_sub` (`dev:<clé>`) entièrement libérés.
La vérification exhaustive « 0 ligne dans toutes les tables » est déjà couverte côté intégration
(`apps/api/src/modules/me/delete-account.test.ts`, parcourt dynamiquement toutes les FK vers
`users.id` — pas de liste codée en dur) : les deux se complètent, pas de doublon inutile.

`pnpm check` (global) : vert — 223 tests `api`, 106 `mobile`, 132 `ui`, 15 `contracts`.

## Constats

| Gravité | Constat | Preuve | Fichier:ligne | Propriétaire |
|---|---|---|---|---|
| mineur | `uuid` (< 11.1.1, dépassement de tampon si un buffer est fourni) et `decode-uri-component` (< 0.5.0, ReDoS) vulnérables, via la chaîne d'outillage Expo/EAS (`xcode`, `expo-router` build-time) — jamais exécutés dans le binaire iOS livré ni dans l'API. | `pnpm audit --prod` (2 modérées) | `apps/mobile/package.json` (dépendances transitives `expo` → `@expo/config-plugins` → `xcode` → `uuid` ; `expo-router` → `query-string` → `decode-uri-component`) | [mobile] mettre à jour `expo`/`@expo/cli` si un correctif amont existe ; sinon documenter l'acceptation du risque (outillage de build, pas de code exécuté en prod) dans `apps/mobile/package.json` ou `docs/avancement.md` |
| à confirmer | `hono/secure-headers()` est monté avec ses réglages par défaut, sans vérification explicite que HSTS est bien émis en production (l'API est probablement derrière un reverse proxy TLS en prod — non testé ici faute d'environnement de prod). | lecture `apps/api/src/app.ts:70`, pas de test dédié | `apps/api/src/app.ts:70` | [backend] à confirmer : ajouter un test d'intégration qui vérifie la présence de `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options` sur une réponse |
| à confirmer | `ApnsHttp2Client.post` (client HTTP/2 maison) n'a pas de délai d'expiration explicite sur la session/la requête : une session Apple qui ne répond jamais (ni `response`, ni `error`) bloquerait indéfiniment l'envoi d'une notification (pas de fuite de données, disponibilité seulement). | lecture de code, pas reproduit en charge | `apps/api/src/modules/notifications/apns-http2-client.ts:14-45` | [backend] à confirmer : ajouter un timeout (`AbortSignal`/`session.setTimeout`) comme pour `AppleTokenClient` (5 s, `token-client.ts:9`) |

## Points contrôlés, sans anomalie

- **BOLA (API1)** : `getFriendActivity`, `listFriends`, `acceptFriendRequest`, `declineFriendRequest`,
  `cancelFriendRequest` vérifient systématiquement la relation (amitié ou destinataire) avant toute
  lecture/écriture, 404 uniforme (`apps/api/src/modules/friends/service.ts`), jamais 403 — conforme
  ADR 005. `removeFriend`, `blockUser`/`unblockUser` idem.
- **Anti-énumération (ADR 005, CA7)** : `createFriendRequest` renvoie toujours `{status:"requested"}`
  sauf `CANNOT_TARGET_SELF` et `TARGET_BLOCKED` (uniquement si *je* bloque) ; demandes cachées si la
  cible bloque ou refuse les demandes — vérifié en E2E (`ca7-friend-requests.spec.ts`).
- **Markdown → HTML (`/privacy`)** : `escapeHtml` appliqué avant toute interprétation `**gras**` sur
  tout texte inline (titres, paragraphes, listes, cellules de tableau) — pas d'injection possible
  même si le contenu source changeait. Entrée exclusivement statique (`docs/legal/privacy.md`),
  jamais de texte utilisateur en pratique.
- **Chiffrement des jetons Apple** : AES-256-GCM, IV aléatoire par appel, tag d'authentification
  vérifié au déchiffrement, longueur de clé contrôlée (`apps/api/src/lib/secret-box.ts`) —
  implémentation correcte.
- **Révocation Apple / suppression** : `deleteAccount` déchiffre puis révoque en best effort (jamais
  bloquant), puis supprime en cascade même si Apple échoue ou si la clé a changé
  (`apps/api/src/modules/me/delete-service.ts`) — conforme ADR 001/006, App Store 5.1.1.
- **Sessions** : jeton opaque 32 octets aléatoires (`randomBytes`), seul le SHA-256 est stocké,
  expiration glissante 90 j mise à jour au plus 1×/jour (`session.ts`) — pas de JWT côté client,
  pas de rejeu possible après `DELETE /me` (jeton supprimé de la table, confirmé par CA12 E2E).
- **Garde de production** : `assertProductionReady` (`apps/api/src/env.ts`) refuse le démarrage si
  PGlite, `ENABLE_DEV_LOGIN`, transport `console`, ou `E2E_AUTH_RATE_LIMIT` sont actifs en
  production, ou si un secret Apple/APNs manque — complet vis-à-vis de la section 8 de
  `architecture.md`.
- **Débit `/auth/*`** : par IP, `X-Forwarded-For` ignoré sauf `TRUST_PROXY=true`
  (`apps/api/src/lib/client-ip.ts`) — non usurpable par défaut. `E2E_AUTH_RATE_LIMIT` correctement
  exclu de la production par `assertProductionReady`.
- **Secrets** : aucune clé privée, jeton ou valeur sensible commitée (`.env.example` ne contient que
  des placeholders vides) ; aucune référence dans le bundle mobile (`EXPO_PUBLIC_*` ne porte que des
  valeurs publiques : URL d'API, sélecteur de source santé).
- **Mobile — stockage du jeton** : `expo-secure-store` (trousseau natif iOS) en production ; le
  repli en mémoire n'existe que pour la cible web de prévisualisation (jamais en production,
  iPhone uniquement) — `apps/mobile/src/api/session.ts:1-30`.
- **Mobile — source santé simulée** : `EXPO_PUBLIC_HEALTH_SOURCE=simulated` explicitement refusé en
  profil EAS `production` (`apps/mobile/src/health/env.ts`).
- **RGPD** : retrait du consentement santé efface `daily_activity` et `milestone_events` en
  transaction (`apps/api/src/modules/me/consent-service.ts`) avant de marquer le consentement
  retiré — pas de fenêtre où les données restent lisibles sans consentement.
- **Performance** : classements et `/me/today` bornés à 3 requêtes SQL indexées (amitiés, users,
  activité — une seule requête bornée par la fenêtre de dates la plus large,
  `apps/api/src/modules/leaderboards/service.ts`), pas de N+1 ; `GET /friends` à 4 requêtes bornées.
  `daily_activity` a pour clé primaire `(user_id, date)`, utilisée par toutes ces requêtes
  (`packages/db`, section 2 de `architecture.md`) — pas d'index manquant identifié. Pas de mesure de
  charge distincte effectuée (hors périmètre outillage disponible) : latences p95 non mesurées en
  conditions réelles, à valider en environnement de préproduction.

## Anomalies à corriger

Aucune anomalie bloquante ni majeure. Deux points mineurs/à confirmer, non bloquants pour la
livraison :

- `[mobile] mettre à jour la chaîne d'outillage expo (xcode/uuid, query-string/decode-uri-component) ou documenter l'acceptation du risque` (outillage de build EAS, pas de code exécuté en production)
- `[backend] ajouter un timeout explicite sur ApnsHttp2Client.post (apps/api/src/modules/notifications/apns-http2-client.ts) pour éviter un blocage indéfini si Apple ne répond jamais`
