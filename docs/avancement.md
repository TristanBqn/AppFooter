# Avancement (tenu par le lead)

> Pas d'outil de liste de tâches partagé dans cette équipe : ce fichier fait foi pour reprendre (`/equipe reprendre`).
> Définition des tâches : `docs/architecture.md` §9. Mis à jour : 2026-09-25, reprise : backend et mobile relancés.

## Phase en cours : 2 (construction)
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
| B9 pipeline de notifications | en cours | — |
| B10 → B12 | à faire | — |
| M1 scaffolding mobile + aperçu web | terminé | fb60949 |
| M2 client API et session | terminé | 7aa4b20 |
| M3 HealthSource | terminé | e7255e6 |
| M4 connexion Apple, pseudonyme, consentement | terminé | 6845cb6 |
| M5 synchro et Accueil | terminé | 49738d1 |
| M6 classement | terminé | 7f5666f |
| M7 amis, demandes, fiche ami | en cours | — |
| M8 → M11 | à faire | — |
| D1–D4 design system, écrans, icône | terminé | 5da5750, f2ce3a1, df0a072 |
| Compléments UI (StatTile.onPress, SunBadge, screens.md consentement) | terminé, designer arrêté jusqu'en phase 3 | 96a1e40 |
| R1–R3 | phase 3 | — |

## Demandes du lead encore ouvertes
- **backend** : test MAX_FRIENDS (limite injectable) : rappelé après B8, à livrer avant B9.
- **mobile**, reports de M5 : carte « prochain ami » (M7), encouragements reçus (M8), engrenage Paramètres (M9), animation de seuil (M11).

## Décisions utilisateur et arbitrages (en plus de brief.md et des ADR)
- Pas d'app web ; aperçu web Expo réservé au rendu visuel et aux captures (pas de simulateur iOS sous Windows).
- Dev build EAS + source santé simulée hors production.
- Pas de synchro en arrière-plan en V1 (report V1.1) ; « mis à jour il y a X » via `lastSyncAt`.
- Consentement santé après la connexion Apple ; « dépasser » = écart + 1.
- Politique de confidentialité : premier jet dans `docs/legal/privacy.md`, champs `[À COMPLÉTER]` à remplir par l'utilisateur et relecture juridique.
- Tests mobiles : vitest (logique) ; accessibilité vérifiée par la checklist M11 et la revue visuelle.
- `GET /me/today` et classements : 403 `USERNAME_REQUIRED` sans pseudonyme (routes sociales).
- Refus du consentement santé (« Pas maintenant ») ⇒ Accueil avec message rassurant.

## En attente de l'utilisateur
- `ios.bundleIdentifier` = `fr.tristanbqn.footer` (provisoire, à revoir plus tard ; projet personnel : aucune référence professionnelle). Le reporter dans `APPLE_BUNDLE_ID` côté API. Team ID Apple à fournir avant tout build EAS.
- Validation de l'icône (`packages/ui/assets/icon.png`).
- Compte Apple Developer pour le dev build sur iPhone.

## Pour reprendre
1. `claude --model opus` dans ce dossier, puis `/equipe reprendre`.
2. Relancer `backend` sur la tâche en cours du tableau (travail non commité éventuel : `git status`), puis les suivantes jusqu’à B12.
3. Relancer `mobile` sur M4 → M11, avec les deux demandes ouvertes ci-dessus.
4. Relancer `designer` seulement s'il est sollicité par le mobile, sinon en phase 3 pour la revue visuelle.
