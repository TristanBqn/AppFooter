# Architecture V1 : Footer

Entrées : `docs/brief.md` (F1–F16, CA1–CA14), `docs/design/DESIGN.md`. Décisions détaillées : `docs/adr/001` à `007`. Contrat d'API : `@app/contracts` (seule source de vérité ; ce document ne le recopie pas).

## 1. Vue d'ensemble

```
iPhone (apps/mobile, Expo dev build)                     apps/api (Hono, port 4000)            PostgreSQL
  HealthSource ─ HealthKit | Simulated                     auth · me · activity · leaderboards   (PGlite dev/test)
  Sign in with Apple ──identityToken + code + nonce──▶      social · encouragements ·            ▲
  Client typé @app/contracts ──Bearer session──▶            notifications ── PushTransport ──▶ APNs | Console
                                                          ▲ JWKS / token / revoke : appleid.apple.com
```

- **Monolithe modulaire** (ADR 007) : une API Hono, un schéma Drizzle (`packages/db`), aucun cache, file ni microservice.
- **Flux principaux** : (1) connexion Apple → session ; (2) consentement santé → synchro des totaux quotidiens (upsert) → détection de seuils → notifications ; (3) lecture accueil / classements / amis calculés à la volée ; (4) actions sociales (demandes, encouragements, blocage) ; (5) suppression du compte.
- **Pas d'app web.** `GET /privacy` sert la politique de confidentialité (HTML statique).

## 2. Modèle de données (`packages/db`)

Toutes les FK vers `users.id` sont `ON DELETE CASCADE` (CA12). Horodatages `timestamptz` UTC ; dates locales en `date`.

| Table | Colonnes clés | Contraintes / index |
|---|---|---|
| `users` | `id uuid`, `apple_sub` (ou `dev:<clé>`), `username` null (déjà en minuscules), `time_zone` (défaut `Europe/Paris`), `apple_refresh_token_enc` null, `health_consent_at` null, `last_sync_at`, `created_at` | unique `apple_sub` ; unique `lower(username)` (CA2) |
| `user_settings` | PK `user_id` ; `show_calories`, `accept_friend_requests`, `share_milestones`, `notify_milestones`, `notify_friend_milestones`, `notify_encouragements`, `notify_friend_requests` (défaut true) ; `quiet_enabled` true, `quiet_start_min` 1320, `quiet_end_min` 480 | créée avec l'utilisateur |
| `sessions` | `id`, `user_id`, `token_hash` (SHA-256), `expires_at`, `last_used_at`, `created_at` | unique `token_hash` ; index `user_id` |
| `push_devices` | `id`, `user_id`, `session_id`, `apns_token`, `environment` | unique `apns_token` ; FK `session_id` cascade (déconnexion ⇒ plus de push) |
| `daily_activity` | PK `(user_id, date)` ; `steps`, `active_calories`, `time_zone`, `updated_at` | CHECK ≥ 0 ; la PK sert l'historique et les classements |
| `milestone_events` | PK `(user_id, date, threshold)` | dédoublonnage des seuils |
| `friendships` | PK `(user_id, friend_id)`, `created_at` — **deux lignes par amitié** | index `friend_id` ; CHECK `user_id <> friend_id` |
| `friend_requests` | `id`, `sender_id`, `recipient_id`, `hidden` bool, `created_at` | unique `(sender_id, recipient_id)` ; index `recipient_id` |
| `blocks` | PK `(blocker_id, blocked_id)`, `created_at` | index `blocked_id` |
| `encouragements` | `id`, `sender_id`, `recipient_id`, `message_id`, `sender_local_date`, `created_at` | unique `(sender_id, recipient_id, sender_local_date)` (CA9) ; index `(recipient_id, created_at desc)` |
| `pending_notifications` | `id`, `recipient_id`, `actor_id` null, `type`, `payload jsonb`, `deliver_after`, `expires_at` | index `deliver_after` ; FK `actor_id` cascade |

## 3. Surface d'API

Routes, schémas et codes : `packages/contracts/src/routes.ts` et `errors.ts`. Règles transverses :
- **Authentification** : `Authorization: Bearer <jeton opaque>` ; sans session valide ⇒ 401 `UNAUTHENTICATED` partout sauf `PUBLIC_ROUTES` (`/health`, `/privacy`, `POST /auth/apple`, `POST /auth/dev`) (CA1). Routes sociales : pseudonyme requis (403 `USERNAME_REQUIRED`).
- **Validation** : chaque corps / requête / paramètre passe par le schéma Zod du contrat (objets stricts) ; échec ⇒ 400 `VALIDATION_ERROR`. Réponses validées par les mêmes schémas dans les tests.
- **Erreurs** : enveloppe unique `{ error: { code, message, issues? } }`, statut dérivé de `ERROR_STATUS`. 500 sans détail interne.
- **Pagination** : aucune en V1, toutes les listes sont bornées (`MAX_FRIENDS` 200, `HISTORY_MAX_DAYS` 30, `RECEIVED_ENCOURAGEMENTS_LIMIT` 50, `MAX_PENDING_OUTGOING_REQUESTS` 50).

### Authentification Apple (ADR 001)
1. L'app génère un nonce brut, passe `sha256hex(nonce)` à Apple, reçoit `identityToken` + `authorizationCode`, envoie les trois à `POST /auth/apple`.
2. L'API vérifie le JWT via le JWKS Apple (`jose` : `iss`, `aud = APPLE_BUNDLE_ID`, `exp`, nonce), crée ou retrouve l'utilisateur par `sub`, échange le code contre un refresh token (stocké chiffré AES-256-GCM).
3. L'API émet une session opaque (hash en base, 90 j glissants) ; `needsUsername` pilote l'écran de pseudonyme.
4. Suppression : `POST https://appleid.apple.com/auth/revoke` avec le refresh token, puis suppression en cascade.

### Classements (ADR 003)
Participants = moi + amis acceptés. Jour courant de chacun = date civile dans son `time_zone`. Quotidien = pas de ce jour ; hebdo = somme lundi → dimanche de sa semaine locale. Rang compétition (1, 2, 2, 4), tri secondaire par pseudonyme. Fonction pure `rankEntries` dans `apps/api/src/domain`.

### Anti-spam et heures silencieuses (ADR 004, 007)
- Encouragement : index unique (expéditeur, destinataire, jour local de l'expéditeur) ⇒ 429 `ENCOURAGEMENT_LIMIT`. Demandes d'amitié : `FRIEND_REQUESTS_PER_DAY`. Débit HTTP en mémoire.
- Heures silencieuses appliquées **uniquement** dans `notify()` (point d'entrée unique des notifications) : dans la plage locale du destinataire ⇒ `pending_notifications`, envoyées par `flushDueNotifications(now)` (intervalle 60 s, horloge injectable) à la fin de la plage, abandonnées après 24 h.

### Notifications (ADR 004)
Seuils `STEP_MILESTONES` franchis sur le jour courant local (`prev < s ≤ new`, dédoublonnés par `milestone_events`, seul le plus haut notifié) ⇒ `milestone_self` (si préférence) et `milestone_friend` à chaque ami (si `share_milestones` de l'auteur et préférence du destinataire). Aussi : encouragement reçu, demande reçue, demande acceptée. `PushTransport` : `ApnsTransport` (prod, dev build) | `ConsoleTransport` (dev/test, boîte d'envoi en mémoire).

## 4. Exigences non fonctionnelles
- p95 < 200 ms par route API (hors appels Apple) pour 200 amis et 31 jours d'historique ; toute requête de lecture ≤ 3 requêtes SQL indexées.
- Synchro d'un lot de 31 jours < 300 ms (upsert unique `INSERT … ON CONFLICT`).
- Démarrage API échoue si une variable requise en production manque ou si dev login / transport console / PGlite sont actifs avec `APP_ENV=production`.
- Mobile : accueil affiché depuis le cache (TanStack Query) puis rafraîchi ; états chargement / erreur / vide explicites (CA13).

## 5. Sécurité (OWASP API Top 10)

| Menace | Parade |
|---|---|
| API1 BOLA (lire l'activité d'un non-ami) | Contrôle d'amitié dans chaque requête SQL (jointure `friendships`), 404 sinon (CA8) ; calories nulles si `show_calories = false` |
| API2 authentification cassée | JWKS Apple via `jose`, nonce, jetons opaques hachés, expiration, dev login absent en prod |
| API3 exposition de propriétés | Réponses construites depuis les schémas du contrat : jamais `apple_sub`, jeton, e-mail |
| API4 consommation illimitée | Débit par IP / utilisateur, bornes Zod (31 jours, 4 ko de jeton), listes bornées |
| API5/6 fonctions et flux sensibles | Encouragements catalogue fermé (objet strict), quotas en base, blocage transactionnel (CA11) |
| Énumération (CA7) | Réponse 202 neutre + demandes cachées (ADR 005), débit sur pseudonyme |
| API8 configuration | Secrets dans `.env`, en-têtes de sécurité (`hono/secure-headers`), CORS désactivé (client natif), pas de trace en 500 |
| Secrets | Clés `.p8` et `APPLE_TOKEN_ENC_KEY` dans l'environnement uniquement ; refresh tokens Apple chiffrés au repos |

## 6. RGPD (ADR 006)
Minimisation (ni e-mail, ni nom, ni échantillons), consentement santé horodaté avant toute synchro, retrait ⇒ effacement de l'activité, suppression du compte en cascade + révocation Apple, journaux sans PII, pas d'iCloud ni de publicité (5.1.3). Export : V1.1.

## 7. Stratégie de tests
- **Unitaires vitest par paquet** : `contracts` (schémas) ; `api` domaine pur (`rankEntries`, jours locaux / semaine, `isQuietTime`, seuils) ; `mobile` logique pure (agrégation HealthKit CA4, garde de source simulée, client API).
- **Intégration api** (vitest + `app.request()` + PGlite en mémoire, horloge injectée, `ConsoleTransport`) : une suite par module ; CA10 et CA12 y sont couverts.
- **E2E Playwright** (`tests/e2e`, reviewer) : `request` uniquement, sans navigateur ; `webServer` lance `pnpm --filter @app/api start:e2e` (PGlite mémoire, `APP_ENV=test`, dev login, port 4000). Couvre CA1–3, CA5–9, CA11–12.
- CA13–14 : revue manuelle sur dev build + tests de composants là où c'est simple.

## 8. Variables d'environnement (`.env.example`, backend)

| Variable | Rôle | Requise en prod |
|---|---|---|
| `APP_ENV` | `development` \| `test` \| `production` | oui |
| `API_PORT` | 4000 | non |
| `DATABASE_URL` | vide ⇒ PGlite (interdit en prod) | oui |
| `ENABLE_DEV_LOGIN` | `true` active `/auth/dev` (refusé en prod) | — |
| `APPLE_BUNDLE_ID` | audience du jeton Apple, topic APNs | oui |
| `APPLE_TEAM_ID`, `APPLE_SIGNIN_KEY_ID`, `APPLE_SIGNIN_PRIVATE_KEY` | client_secret pour échange / révocation | oui |
| `APPLE_TOKEN_ENC_KEY` | 32 octets base64, chiffrement des refresh tokens | oui |
| `PUSH_TRANSPORT` | `apns` \| `console` | oui (`apns`) |
| `APNS_KEY_ID`, `APNS_PRIVATE_KEY` | jeton APNs (.p8) | oui |
| `TRUST_PROXY` | lire `X-Forwarded-For` | selon hébergeur |
| `EXPO_PUBLIC_API_URL` | URL de l'API (mobile) | oui |
| `EXPO_PUBLIC_HEALTH_SOURCE` | `healthkit` \| `simulated` (refusé en profil production) | — |

À retirer : `AUTH_SECRET`, `WEB_PORT`, `NEXT_PUBLIC_API_URL` (pas d'app web, sessions opaques).

## 9. Tâches phase 2

Format : identifiant · sujet · dépendances · CA · critères d'acceptation. Chaque tâche ≤ ½ journée ; terminée quand `pnpm --filter <paquets> check` est vert.

### Backend
- **B1 `[backend] Scaffolding apps/api (@app/api) et packages/db`** · — · CA1 (partiel). Hono sur 4000, `GET /health` 200, middleware d'erreur (enveloppe du contrat), 404 JSON ; `packages/db` : client Drizzle PGlite (mémoire / fichier) ou `pg` selon `DATABASE_URL`, config drizzle-kit ; scripts `typecheck`, `test`, `build`, `start`, `start:e2e` ; `.env.example` et `turbo.json` nettoyés (section 8) ; test vitest `/health`.
- **B2 `[backend] Schéma Drizzle complet et migrations`** · B1 · CA12. Tables de la section 2, index et CHECK ; migration générée ; test : création d'un utilisateur avec lignes dans toutes les tables puis `DELETE users` ⇒ 0 ligne restante (test générique sur toutes les tables).
- **B3 `[backend] Sessions, connexion de dev, /me et pseudonyme`** · B2 · CA1, CA2. Middleware Bearer (hash, expiration glissante), `POST /auth/dev` (garde prod), `POST /auth/logout`, `GET /me`, `PUT /me/username` (409 `USERNAME_TAKEN` insensible à la casse, `USERNAME_ALREADY_SET`), garde `USERNAME_REQUIRED`, limiteur de débit ; test : toutes les routes de `API_ROUTES` hors publiques ⇒ 401 sans jeton.
- **B4 `[backend] Sign in with Apple`** · B3 · CA1. `AppleIdentityVerifier` (`jose`, JWKS, iss/aud/exp/nonce), `AppleTokenClient` (échange du code, révocation, client_secret ES256), chiffrement AES-256-GCM ; tests avec clé locale : jeton valide, mauvais `aud`, expiré, mauvais nonce ⇒ 401 `APPLE_TOKEN_INVALID`.
- **B5 `[backend] Paramètres, consentement santé, synchro et historique`** · B3 · CA3, CA8. `GET/PATCH /me/settings`, `PUT /me/consents/health` (retrait ⇒ effacement), `PUT /me/activity` (upsert en une requête, fenêtre de dates, met à jour `time_zone`/`last_sync_at`), `GET /me/activity` ; tests : double envoi ⇒ 1 ligne remplacée, 403 sans consentement, `DATE_OUT_OF_RANGE`.
- **B6 `[backend] Classements et accueil`** · B5 · CA5, CA6. Module domaine (jour local, lundi local, `rankEntries`), `GET /leaderboards/daily|weekly`, `GET /me/today` ; tests purs : 1-2-2-4, tri secondaire, Paris/New York à minuit, semaine à cheval sur un mois et un changement d'heure ; test d'intégration : non-amis exclus.
- **B7 `[backend] Demandes d'amitié et amis`** · B6 · CA7, CA8. `POST/GET /friend-requests`, accept / decline / cancel, `GET /friends`, `DELETE /friends/:userId`, `GET /friends/:userId/activity` (404 non-ami, calories nulles si masquées) ; demandes cachées (ADR 005), acceptation croisée, `FRIEND_REQUESTS_PER_DAY`, `MAX_FRIENDS` ; test : corps et statut identiques pour inconnu / bloqué / refus.
- **B8 `[backend] Blocages`** · B7 · CA11. `POST/GET /blocks`, `DELETE /blocks/:userId`, transaction (amitié, demandes, notifications en attente) ; tests : après blocage, bloqué ⇒ 404 sur l'activité, demande neutre cachée, encouragement 404.
- **B9 `[backend] Pipeline de notifications (console)`** · B5 · CA10. `notify()`, `isQuietTime`, `pending_notifications`, `flushDueNotifications(now)` + intervalle, `ConsoleTransport`, `PUT /me/devices`, détection des seuils à la synchro ; tests : plage 22:00–08:00 dans plusieurs fuseaux, rien d'émis pendant la plage, émission à la fin, expiration 24 h, un seul seuil notifié.
- **B10 `[backend] Encouragements`** · B7, B9 · CA9. `POST /encouragements` (ami requis, quota unique en base ⇒ 429), `GET /encouragements/received`, notification ; tests : 2ᵉ envoi même jour ⇒ 429, clé `text` ⇒ 400, non-ami ⇒ 404.
- **B11 `[backend] Suppression de compte et page de confidentialité`** · B4, B8 · CA12. `DELETE /me` (révocation Apple best effort puis cascade), `GET /privacy` (HTML statique, texte fourni par le lead) ; test : 0 ligne restante toutes tables, ancien jeton ⇒ 401.
- **B12 `[backend] Transport APNs`** · B9 · CA10. `ApnsTransport` (JWT ES256, sandbox/production selon l'appareil, suppression des jetons 410), vérification au démarrage des variables prod ; test avec serveur HTTP/2 simulé ou client injecté.

### Mobile
- **M1 `[mobile] Scaffolding apps/mobile (@app/mobile) via create-expo-app`** · — · —. Expo Router, 3 onglets vides (Accueil, Classement, Amis), NativeWind, dépendance `@app/contracts` importable par Metro, `eas.json` (profils development / production, iOS 17+), scripts `typecheck` et `test` (vitest pour la logique pure) ; test trivial vert.
- **M2 `[mobile] Client API typé et session`** · M1 · CA1. Client `fetch` validant les réponses par les schémas du contrat, mappage `ErrorCode` → message FR, jeton dans `expo-secure-store`, 401 ⇒ retour à l'écran de connexion, TanStack Query ; tests vitest du client (fetch simulé).
- **M3 `[mobile] HealthSource : interface, source simulée, HealthKit`** · M1 · CA4. Spike prédicat `HKWasUserEntered` sur `@kingstinct/react-native-healthkit` (compte rendu au lead), `HealthKitSource`, `SimulatedHealthSource`, garde profil production ; tests : agrégation pure ignorant les saisies manuelles, jours locaux, garde prod.
- **M4 `[mobile] Connexion Apple, dev login, pseudonyme, consentement`** · M2, D2 · CA2. `expo-apple-authentication` avec nonce SHA-256, bouton dev hors production, écran pseudonyme (erreurs `USERNAME_TAKEN`/format), écran de consentement santé séparé puis autorisation HealthKit.
- **M5 `[mobile] Synchro et Accueil`** · M3, M4, D1, D2 · CA3, CA13. Synchro (30 j au premier lancement, puis 2 j ; lancement, premier plan, tirer-pour-rafraîchir), Accueil (`/me/today` : pas, calories, progression seuil, rang), historique 30 j ; états chargement / erreur / vide.
- **M6 `[mobile] Classement quotidien / hebdomadaire`** · M5 · CA5, CA6, CA13. Bascule en un geste (segmented control), rangs égaux affichés tels quels, formulations non culpabilisantes (DESIGN §5), états explicites.
- **M7 `[mobile] Amis, demandes et activité d'un ami`** · M5 · CA7, CA8, CA13. Liste, ajout par pseudo exact (message neutre « Demande envoyée si ce pseudo existe »), demandes entrantes / sortantes, fiche ami (calories masquées gérées).
- **M8 `[mobile] Encouragements`** · M7 · CA9. Feuille de choix du catalogue, envoi en une action, retour immédiat, 429 affiché avec bienveillance, liste des encouragements reçus.
- **M9 `[mobile] Paramètres, retrait, blocage, suppression du compte`** · M7 · CA11, CA12, CA14. Écran Paramètres (confidentialité, notifications, heures silencieuses), confirmations systématiques, déconnexion, suppression puis retour à l'accueil de connexion.
- **M10 `[mobile] Notifications push`** · M9 · CA10. Permission, `getDevicePushTokenAsync` ⇒ `PUT /me/devices` (environnement sandbox en dev build), routage au tap via `PushPayloadSchema`.
- **M11 `[mobile] Passe accessibilité`** · M6–M10 · CA13. Libellés VoiceOver sur tous les éléments interactifs, Dynamic Type sans troncature, Réduire les animations respecté ; liste de contrôle cochée dans le compte rendu.

### Designer
- **D1 `[designer] Tokens @app/ui et preset NativeWind`** · — · CA13. Couleurs, dégradés ciel, typographies SF (échelle Dynamic Type), espacements, rayons, ombres, verre ; preset Tailwind consommable par `apps/mobile` ; test vitest de contraste AA des paires texte/fond.
- **D2 `[designer] Écrans et états (docs/design/screens.md)`** · — · CA13, CA14. Connexion, pseudonyme, consentement, Accueil, Classement, Amis, fiche ami, Paramètres, confirmations ; états chargement / erreur / vide ; textes FR (tutoiement) ; libellés VoiceOver.
- **D3 `[designer] Composants partagés @app/ui`** · D1 · CA13. Carte verre, bouton, ligne de liste, anneau de progression, contrôle segmenté, avec `accessibilityLabel` obligatoires et variante animations réduites.
- **D4 `[designer] Icône, logo et illustrations`** · D1 · —. Thème pas / nuage, formats iOS, illustrations des états vides.

### Reviewer
- **R1 `[reviewer] Config Playwright API et E2E CA1–CA3`** · B5 · CA1, CA2, CA3.
- **R2 `[reviewer] E2E social CA5–CA9, CA11`** · B8, B10 · CA5–CA9, CA11.
- **R3 `[reviewer] E2E suppression CA12 et revue sécurité (docs/review.md)`** · B11 · CA12.
