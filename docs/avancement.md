# Avancement (tenu par le lead)

> Pas d'outil de liste de tâches partagé dans cette équipe : ce fichier fait foi pour reprendre (`/equipe reprendre`).
> Définition des tâches : `docs/architecture.md` §9. Mis à jour : 2026-09-24.

## Phase en cours : 2 (construction)
Validation humaine n°1 obtenue le 2026-09-24.

| Tâche | Statut | Commit |
|---|---|---|
| B1 scaffolding api + db | terminé | 55e25f4 |
| B2 schéma et migrations | terminé | ac9246a |
| B3 sessions, dev login, /me, pseudonyme | terminé | f4b686e |
| B4 Sign in with Apple | terminé | voir git log |
| B5 paramètres, consentement, synchro, historique | **en cours** | — |
| B6 → B12 | à faire | — |
| M1 scaffolding mobile + aperçu web | terminé | fb60949 |
| M2 client API et session | terminé | 7aa4b20 |
| M3 HealthSource | terminé | e7255e6 |
| M4 connexion Apple, pseudonyme, consentement | **en cours** (pas encore de fichiers) | — |
| M5 → M11 | à faire | — |
| D1–D4 design system, écrans, icône | terminé | 5da5750, f2ce3a1, df0a072 |
| R1–R3 | phase 3 | — |

## Demandes du lead encore ouvertes
- **mobile** (début de M4) : repli de stockage de session réservé au web (`src/api/session.ts`, `Platform.OS === "web"`), avec un test.
- **mobile** : commentaire dans `src/health/HealthKitSource.ts` sur le risque qu'un prédicat `!=` exclue les échantillons sans clé `HKWasUserEntered`, plus un point dans la checklist M11 (vérification sur appareil, repli prévu).

## Décisions utilisateur et arbitrages (en plus de brief.md et des ADR)
- Pas d'app web ; aperçu web Expo réservé au rendu visuel et aux captures (pas de simulateur iOS sous Windows).
- Dev build EAS + source santé simulée hors production.
- Pas de synchro en arrière-plan en V1 (report V1.1) ; « mis à jour il y a X » via `lastSyncAt`.
- Consentement santé après la connexion Apple ; « dépasser » = écart + 1.
- Politique de confidentialité : premier jet dans `docs/legal/privacy.md`, champs `[À COMPLÉTER]` à remplir par l'utilisateur et relecture juridique.
- Tests mobiles : vitest (logique) ; accessibilité vérifiée par la checklist M11 et la revue visuelle.

## En attente de l'utilisateur
- Confirmer `ios.bundleIdentifier` (placeholder `fr.tristanbqn.footer`) et le Team ID Apple, avant M4/M10 et tout build EAS.
- Validation de l'icône (`packages/ui/assets/icon.png`).
- Compte Apple Developer pour le dev build sur iPhone.

## Pour reprendre
1. `claude --model opus` dans ce dossier, puis `/equipe reprendre`.
2. Relancer `backend` sur la tâche en cours du tableau (travail non commité éventuel : `git status`), puis les suivantes jusqu’à B12.
3. Relancer `mobile` sur M4 → M11, avec les deux demandes ouvertes ci-dessus.
4. Relancer `designer` seulement s'il est sollicité par le mobile, sinon en phase 3 pour la revue visuelle.
