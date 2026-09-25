# Checklist M11 — passe accessibilité et vérifications sur appareil réel

> Propriétaire : mobile. Alimentée au fil des tâches (M4 → M11) ; cochée pendant M11 sur un
> iPhone réel via Expo Go / dev build EAS (aucun simulateur iOS possible sous Windows).
> Voir `docs/architecture.md` §9 (M11) et `docs/design/screens.md` (CA13).

## Santé (HealthKit)

- [ ] **Filtre `HKWasUserEntered` (`src/health/HealthKitSource.ts`)** : vérifier sur appareil réel,
      avec des échantillons à la fois auto-enregistrés (iPhone/Apple Watch) et saisis à la main
      dans Santé, que `EXCLUDE_USER_ENTERED_FILTER` (`!=`) ne matche pas la clé absente comme
      "différente de true" côté NSComparisonPredicate. Comparer le total obtenu à la somme
      affichée par l'app Santé pour la même journée. Si sous-comptage confirmé : basculer sur le
      repli documenté dans `HealthKitSource.ts` (échantillons bruts + filtrage en JS).
- [ ] **Détection du refus d'autorisation** (`app/(auth)/consentement.tsx`) : HealthKit ne révèle
      pas côté app si l'utilisateur a refusé une autorisation de lecture (vie privée Apple) ;
      `requestAuthorization()` peut donc résoudre `true` même après un refus. Vérifier sur
      appareil le comportement réel après un refus explicite dans la feuille système, et que
      l'Accueil (M5) retombe bien sur l'état « Santé non connectée » plutôt que d'afficher une
      erreur.

## Accessibilité générale (VoiceOver, Dynamic Type, réduction d'animations)

- [ ] Libellés VoiceOver présents et pertinents sur tous les éléments interactifs de M4→M10
      (à détailler au fil de chaque tâche).
- [ ] Dynamic Type jusqu'au réglage le plus grand : aucune troncature hors cas prévu par
      `screens.md`.
- [ ] « Réduire les animations » et « Réduire la transparence » respectés sur tous les écrans.
