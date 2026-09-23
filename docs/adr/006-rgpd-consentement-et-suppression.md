# ADR 006 : Consentement santé enregistré, suppression par cascade SQL

- Statut : accepté (2026-09-24)
- CA : CA12 ; directives App Store 5.1.1 et 5.1.3

## Contexte
Pas et calories = données de santé potentielles (art. 9 RGPD). Il faut un consentement explicite et séparé, la minimisation et un effacement complet vérifiable.

## Décision
- **Minimisation** : on stocke `apple_sub`, pseudonyme, fuseau, paramètres, totaux quotidiens, relations sociales, jetons APNs. Ni e-mail, ni nom, ni échantillons bruts, ni localisation. Journaux : identifiant interne seulement, jamais de pseudonyme, jeton ou valeur de santé.
- **Consentement** : `PUT /me/consents/health { granted }` horodate `users.health_consent_at` ; `PUT /me/activity` renvoie 403 `HEALTH_CONSENT_REQUIRED` sans lui. Retrait ⇒ effacement de `daily_activity` et `milestone_events` de l'utilisateur.
- **Suppression** `DELETE /me` : (1) révocation Apple (best effort, 5 s max, échec journalisé sans PII) ; (2) `DELETE FROM users WHERE id = $1` dans une transaction. **Toutes** les clés étrangères vers `users` sont `ON DELETE CASCADE` (y compris l'acteur des notifications en attente et les demandes cachées) ; les sessions disparaissent donc avec l'utilisateur. Réponse 204.
- **Test CA12** : après suppression, un test parcourt toutes les tables du schéma et vérifie qu'aucune colonne `*_id` ne contient l'identifiant supprimé ; un appel avec l'ancien jeton renvoie 401.
- Politique de confidentialité servie par l'API (`GET /privacy`, HTML statique).

## Conséquences
- Toute nouvelle table liée à un utilisateur doit déclarer sa FK en cascade (règle de revue).
- Export des données (V1.1) : non implémenté.
- Sauvegardes de l'hébergeur : durée de rétention à documenter dans la politique de confidentialité. Qualification HDS : point ouvert du brief.
