# ADR 002 : Apple Santé derrière `HealthSource`, totaux quotidiens seulement

- Statut : accepté (2026-09-24)
- CA : CA3, CA4

## Contexte
HealthKit n'existe que sur iPhone réel en development build ; le dev local et les tests doivent tourner sans lui. Les pas saisis manuellement sont exclus. Un utilisateur avec iPhone + Apple Watch a des échantillons qui se chevauchent : les additionner double le total. RGPD : minimisation.

## Décision
- Interface mobile `HealthSource { isAvailable(); requestAuthorization(); getDailyTotals(from, to, timeZone): DailyTotal[] }` (type `DailyTotal` de `@app/contracts`).
- `HealthKitSource` (bibliothèque `@kingstinct/react-native-healthkit`, plugin Expo) :
  - requête statistique cumulée par jour local (`queryStatisticsCollectionForQuantity`, ancre minuit local, `HKQuantityTypeIdentifierStepCount` et `ActiveEnergyBurned`) : HealthKit déduplique les sources ;
  - exclusion des échantillons `HKMetadataKeyWasUserEntered = true` par prédicat de métadonnées si la bibliothèque le permet ; sinon lecture des échantillons de saisie manuelle et soustraction du total du jour ;
  - la logique d'exclusion/agrégation est une fonction pure testée (CA4) ; la faisabilité du prédicat est la première sous-tâche mobile (spike).
- `SimulatedHealthSource` : données déterministes paramétrables ; sélection par `EXPO_PUBLIC_HEALTH_SOURCE=simulated`, **refusée si le profil EAS est `production`** (garde au démarrage, test unitaire).
- L'app n'envoie que des totaux quotidiens (`PUT /me/activity`, 31 jours max, date locale + fuseau IANA). Synchro : au lancement, au retour au premier plan, au tirer-pour-rafraîchir ; 30 jours au premier lancement, puis les 2 derniers jours.
- Aucune synchro avant le consentement santé enregistré côté API (`PUT /me/consents/health`).

## Conséquences
- Upsert idempotent sur `(user_id, date)` : renvoyer un jour remplace la valeur.
- L'API rejette les dates hors fenêtre [aujourd'hui local − 31 j, aujourd'hui local + 1 j] (`DATE_OUT_OF_RANGE`).
- Pas de synchro en arrière-plan en V1 : les seuils et classements des amis ne bougent que quand ils ouvrent l'app (limite produit à confirmer).
