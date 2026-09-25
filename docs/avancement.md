# Avancement (tenu par le lead)

> Pas d'outil de liste de tâches partagé dans cette équipe : ce fichier fait foi pour reprendre (`/equipe reprendre`).
> Définition des tâches : `docs/architecture.md` §9. Mis à jour : 2026-09-25, reprise : backend et mobile relancés.

## Phase en cours : 3 (contrôle)
Phase 2 terminée le 2026-09-25 (B1–B12, M1–M11).
Validation humaine n°1 obtenue le 2026-09-24.

| Tâche | Statut | Commit |
|---|---|---|
| B1 scaffolding api + db | terminé | 55e25f4 |
| B2 schéma et migrations | terminé | ac9246a |
| B3 sessions, dev login, /me, pseudonyme | terminé | f4b686e |
| B4 Sign in with Apple | terminé | voir git log |
| B5 paramètres, consentement, synchro, historique | terminé (WIP relu, complet, 109 tests verts) | 9b78061 |
| B6 classements et accueil | terminé | 8fb10a6 |
| B7 demandes d'amitié et amis | terminé (test MAX_FRIENDS à livrer avec B8) | 8ce34d8 |
| B8 blocages (test encouragement 404 en B10) | terminé | b7c174c |
| B9 pipeline de notifications (+ MAX_FRIENDS injectable, quota demandes en base) | terminé | voir B10 |
| B10 encouragements (+ test encouragement 404 après blocage) | terminé | voir git log |
| B11 suppression de compte, confidentialité | terminé (209 tests) | voir git log |
| B-e2e limite auth réglable (E2E_AUTH_RATE_LIMIT, start:e2e seulement) | terminé (223 tests), backend arrêté | d47210c |
| B12 transport APNs | terminé (220 tests, fichiers inclus dans le commit de B11) | 66d89cf |
| M1 scaffolding mobile + aperçu web | terminé | fb60949 |
| M2 client API et session | terminé | 7aa4b20 |
| M3 HealthSource | terminé | e7255e6 |
| M4 connexion Apple, pseudonyme, consentement | terminé | 6845cb6 |
| M5 synchro et Accueil | terminé | 49738d1 |
| M6 classement | terminé | 7f5666f |
| M7 amis, demandes, fiche ami | terminé (reliquats M5 demandés : carte prochain ami, tuile Rang, SunBadge, toast) | 0b94662 |
| M8 encouragements | terminé (reliquats M5/M7 toujours ouverts, exigés avant M9) | 45f05e4 |
| M9 paramètres, retrait, blocage, suppression | terminé (bandeau notifications désactivées reporté en M10) | 1c29aad |
| Reliquats accueil (tuiles Rang/Amis pressables, prochain ami, SunBadge, toast refus) | terminé, mobile arrêté (plus de tâche en phase 2) | 2f66a64 |
| M10 notifications push | terminé (routage par type de push : choix documenté dans src/notifications/route.ts) | 87b4220 |
| M11 passe accessibilité | terminé (revue de code ; checklist à dérouler sur appareil : apps/mobile/docs/checklist-m11.md) | a6f89cd |
| D1–D4 design system, écrans, icône | terminé | 5da5750, f2ce3a1, df0a072 |
| Compléments UI (StatTile.onPress, SunBadge, screens.md consentement) | terminé | 96a1e40 |
| Revue visuelle par captures (docs/design/review/revue-visuelle.md) | terminé : 54 captures, 22 écarts (1 bloquant, 12 majeurs, 9 mineurs) | 83314f0 |
| Boucle 1 [mobile] B1 consentement, M1–M10, m1–m7 | terminé (2e passe : 20/22) | 527cd27 |
| Boucle 2 [mobile] M3 toast, n1 squelette, m7 seuil simulé | terminé, vérification captures en cours (designer-2) | 36bc220, 6893272 |
| R1 config Playwright + E2E CA1–CA3 | terminé (12/12) | 1037f3e |
| R2 E2E social CA5–CA9, CA11 | terminé (32/32, aucune anomalie) | voir git log |
| R3 E2E CA12 + revue sécurité | terminé (33/33 E2E, verdict livrable, 0 bloquant/majeur) | ba8e195 |
| Boucle 1 [backend] timeout APNs + audit dépendances | terminé : timeout 10 s, override uuid borné, decode-uri-component en dette | d5a6066 |

## Demandes du lead encore ouvertes
- **Sécurité dépendances** : exclusion `minimumReleaseAgeExclude` retirée ; expo-notifications épinglé en 57.0.20, conforme à la politique (fbf3c18). `pnpm install` repasse.

## Décisions utilisateur et arbitrages (en plus de brief.md et des ADR)
- Pas d'app web ; aperçu web Expo réservé au rendu visuel et aux captures (pas de simulateur iOS sous Windows).
- Dev build EAS + source santé simulée hors production.
- Pas de synchro en arrière-plan en V1 (report V1.1) ; « mis à jour il y a X » via `lastSyncAt`.
- Consentement santé après la connexion Apple ; « dépasser » = écart + 1.
- Politique de confidentialité : premier jet dans `docs/legal/privacy.md`, champs `[À COMPLÉTER]` à remplir par l'utilisateur et relecture juridique.
- Tests mobiles : vitest (logique) ; accessibilité vérifiée par la checklist M11 et la revue visuelle.
- `GET /me/today` et classements : 403 `USERNAME_REQUIRED` sans pseudonyme (routes sociales).
- Refus du consentement santé (« Pas maintenant ») ⇒ Accueil avec message rassurant.

## Dette acceptée (arbitrage lead)
- `decode-uri-component@0.2.2` (CVE ReDoS, modérée), via `query-string@7` ← `expo-router` : **embarqué dans l'app** (pas seulement l'outillage). Surface : URL ou lien profond malformé traité par le routeur, impact limité à un gel local de l'app. La version 0.5 est ESM pur, incompatible avec `require()` de query-string@7. À réévaluer à la prochaine mise à jour d'expo-router.
- Vérifications sur appareil réel : `apps/mobile/docs/checklist-m11.md` (HealthKit `HKWasUserEntered`, refus HealthKit, VoiceOver sur la pastille de l'onglet Amis, rendu natif des grands titres, icônes, interrupteurs).

## En attente de l'utilisateur
- `ios.bundleIdentifier` = `fr.tristanbqn.footer` (provisoire, à revoir plus tard ; projet personnel : aucune référence professionnelle). Le reporter dans `APPLE_BUNDLE_ID` côté API. Team ID Apple à fournir avant tout build EAS.
- Validation de l'icône (`packages/ui/assets/icon.png`).
- Compte Apple Developer pour le dev build sur iPhone.

## Pour reprendre
1. `claude --model opus` dans ce dossier, puis `/equipe reprendre`.
2. Phase 3 : relancer `reviewer` sur la tâche R ouverte du tableau et `designer` si la revue visuelle n'est pas faite.
3. Relancer `backend` ou `mobile` seulement pour corriger les anomalies `[owner]` remontées (2 boucles au maximum).
