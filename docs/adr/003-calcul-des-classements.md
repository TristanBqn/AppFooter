# ADR 003 : Classements calculés à la volée côté API, jour local de chaque participant

- Statut : accepté (2026-09-24)
- CA : CA5, CA6

## Contexte
Amis possiblement dans des fuseaux différents ; le brief impose la date locale de chacun, une semaine lundi → dimanche et des égalités « 1, 2, 2, 4 ». Volume faible (≤ `MAX_FRIENDS` = 200 participants par classement).

## Décision
- **Aucune table de classement ni cache** : calcul à chaque requête par une requête indexée sur `daily_activity (user_id, date)`.
- **Jour courant d'un participant** = date civile de `now` dans `users.time_zone` (dernier fuseau reçu en synchro), via `Intl.DateTimeFormat`. Participant sans ligne ⇒ 0 pas.
- **Quotidien** : pas du jour courant de chaque participant.
- **Hebdomadaire** : somme des pas de chaque participant du lundi au dimanche de *sa* semaine locale courante (`lundi = date − ((jourISO − 1))`).
- **Rang** : fonction pure `rankEntries` (module domaine de `apps/api`) : tri `steps` décroissant puis `username` croissant ; rang = 1 + nombre de participants ayant strictement plus de pas (« standard competition ranking »).
- Bornes `start`/`end` renvoyées dans le fuseau du demandeur.
- `/me/today` réutilise le même calcul pour `rank`.

## Conséquences
- Tests unitaires purs : égalités, fuseaux (Paris vs New York autour de minuit), semaine qui chevauche un changement de mois et un passage heure d'été/hiver.
- Aux alentours de minuit, deux amis peuvent comparer des jours civils différents : c'est le comportement voulu par le brief.
- Si le volume explose, matérialiser un agrégat hebdomadaire ; non nécessaire en V1.
