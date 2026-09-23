# Brief V1 : Footer

Source : `Specs.txt` + arbitrages utilisateur du 2026-09-23. Les points marqués *(hypothèse lead)* sont des choix par défaut, modifiables.

## Problème
Marcher davantage est difficile à tenir seul. Les apps de fitness sont souvent sportives et culpabilisantes. Footer rend la marche ludique et sociale via une compétition amicale, privée et bienveillante entre proches.

## Utilisateurs
Particuliers possédant un iPhone, qui veulent se motiver avec famille et amis, sportifs ou non.

## Périmètre livré
- `apps/mobile` : app iPhone Expo (development build EAS : HealthKit, Sign in with Apple, notifications push APNs).
- `apps/api` : API Hono + PostgreSQL. Sert aussi la politique de confidentialité en page statique.
- **Pas d'`apps/web`.**
- Apple Santé derrière une interface `HealthSource` : implémentation HealthKit réelle dans le dev build, implémentation simulée en dev local et en tests (jamais active en build de production).

## Fonctionnalités V1 (liste fermée)
1. **Connexion avec Apple** : l'API vérifie le jeton d'identité Apple et émet sa propre session. Choix d'un pseudonyme unique à la première connexion. Une connexion de dev existe hors production uniquement.
2. **Lecture des pas et calories actives** depuis Apple Santé, **pas saisis manuellement exclus** (`HKWasUserEntered`). L'app envoie à l'API les totaux quotidiens (date locale + fuseau) ; resynchronisation des 30 derniers jours au premier lancement *(hypothèse lead)*.
3. **Accueil** : pas du jour, calories, progression vers le prochain seuil, rang du jour.
4. **Classement quotidien** entre amis acceptés (moi inclus), basé sur la date locale de chacun.
5. **Classement hebdomadaire** lundi → dimanche (somme des pas). Bascule quotidien/hebdo en un geste.
6. **Égalités** : même rang pour des totaux égaux, rang suivant sauté (1, 2, 2, 4) ; ordre d'affichage secondaire par pseudonyme.
7. **Ajout d'ami par pseudonyme exact** (pas de recherche partielle, pas d'annuaire).
8. **Demandes d'amitié** : envoi, acceptation, refus, annulation. Amitié réciproque uniquement.
9. **Activité des amis acceptés** : pas du jour et historique récent d'un ami.
10. **Encouragements prédéfinis** (catalogue fermé, ~6 messages), envoyés en une action, sans message libre.
11. **Notifications de seuils** : 5 000 / 10 000 / 15 000 pas *(hypothèse lead)* ; notification à soi-même, et aux amis si l'utilisateur l'autorise.
12. **Anti-spam et heures silencieuses** : 1 encouragement par ami et par jour *(hypothèse lead)* ; notifications non urgentes retenues pendant les heures silencieuses (22 h – 8 h par défaut, heure locale du destinataire, réglables).
13. **Historique quotidien** de sa propre activité (30 derniers jours).
14. **Retirer un ami, bloquer un utilisateur** (avec confirmation). Un utilisateur bloqué ne peut ni trouver le bloqueur, ni lui envoyer de demande, ni voir son activité.
15. **Paramètres** : confidentialité (afficher ou masquer mes calories, accepter les demandes d'amitié, partager mes seuils avec mes amis) et notifications (par type, heures silencieuses).
16. **Suppression complète du compte** (avec confirmation) : effacement de toutes les données serveur et révocation du jeton Apple.

## Hors périmètre V1
Badges, trophées, niveaux, avatars évolutifs, duels, équipes, objectifs collectifs, météo et ciel dynamiques, Apple Watch, dons, messages libres, web, Android, mode sombre, multilingue, paiement.

## Critères d'acceptation (testables)
- CA1 : sans session valide, toute route hors `/auth/*` et `/health` renvoie 401.
- CA2 : un pseudonyme déjà pris (insensible à la casse) est refusé ; format 3–20 caractères `[a-z0-9_.]`.
- CA3 : une synchro envoie des totaux quotidiens ; renvoyer le même jour remplace la valeur (idempotent), pas de doublon.
- CA4 : l'adaptateur HealthKit ignore les échantillons `HKWasUserEntered = true` (test unitaire sur l'agrégation).
- CA5 : le classement quotidien ne contient que moi et mes amis acceptés ; totaux égaux ⇒ même rang, rang suivant sauté.
- CA6 : le classement hebdomadaire agrège exactement lundi → dimanche.
- CA7 : l'ajout d'ami exige le pseudonyme exact ; un pseudo inconnu ou qui m'a bloqué renvoie la même réponse neutre (pas d'énumération).
- CA8 : l'activité d'un utilisateur n'est lisible que par lui et ses amis acceptés ; calories masquées si le paramètre le demande.
- CA9 : un 2ᵉ encouragement au même ami le même jour est refusé (429) ; aucun texte libre accepté par l'API.
- CA10 : aucune notification non urgente n'est émise pendant les heures silencieuses du destinataire.
- CA11 : bloquer supprime l'amitié et les demandes en cours, et empêche toute nouvelle interaction.
- CA12 : après suppression du compte, plus aucune ligne liée à l'utilisateur en base et la session est invalidée.
- CA13 : l'app affiche des états chargement / erreur / vide explicites sur Accueil, Classement, Amis ; tous les éléments interactifs ont un libellé VoiceOver ; l'UI supporte Dynamic Type et Réduire les animations.
- CA14 : les actions blocage, retrait d'ami et suppression du compte demandent une confirmation.

## Contraintes
- **Plateforme** : iPhone, iOS 17+. Development build EAS (compilation cloud, compatible Windows). Compte Apple Developer requis pour installer sur iPhone et pour APNs.
- **Paiement** : aucun.
- **RGPD** : les pas et calories peuvent constituer des données de santé (art. 9 RGPD) ⇒ consentement explicite et séparé avant toute synchro, minimisation (totaux quotidiens seulement, pas d'échantillons bruts), droit à l'effacement (F16), export des données à prévoir en V1.1, politique de confidentialité en ligne. Point ouvert : qualification HDS de l'hébergeur à confirmer avant la production (probablement non requise pour une app de bien-être hors parcours de soins, à valider).
- **Apple** : directives App Store 5.1.1 (suppression de compte dans l'app) et 5.1.3 (données HealthKit : pas de publicité ni de revente, pas de stockage iCloud) ; révocation du jeton Sign in with Apple à la suppression.
- **Sécurité** : secrets uniquement dans `.env` ; connexion de dev et source santé simulée désactivées en production.
