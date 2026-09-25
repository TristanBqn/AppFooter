# Checklist M11 — passe accessibilité et vérifications sur appareil réel

> Propriétaire : mobile. Revue de code faite (M11, CA13) ; les cases restent à cocher sur un
> iPhone réel via Expo Go / dev build EAS (aucun simulateur iOS possible sous Windows, donc aucun
> point ci-dessous n'a pu être vérifié à l'exécution par l'agent mobile).
> Voir `docs/architecture.md` §9 (M11) et `docs/design/screens.md` (CA13).

## Santé (HealthKit) — risques identifiés en code, à trancher sur appareil

- [ ] **Filtre `HKWasUserEntered` (`src/health/HealthKitSource.ts`)** : avec des échantillons à la
      fois auto-enregistrés (iPhone/Apple Watch) et saisis à la main dans Santé, vérifier que
      `EXCLUDE_USER_ENTERED_FILTER` (`!=`) ne matche pas la clé absente comme "différente de true"
      côté NSComparisonPredicate. Comparer le total obtenu à la somme affichée par l'app Santé pour
      la même journée. Si sous-comptage confirmé : basculer sur le repli documenté dans
      `HealthKitSource.ts` (échantillons bruts + filtrage en JS).
- [ ] **Détection du refus d'autorisation** (`app/(auth)/consentement.tsx`,
      `app/(tabs)/accueil/index.tsx`) : HealthKit ne révèle pas côté app si l'utilisateur a refusé
      une autorisation de lecture (vie privée Apple) ; `requestAuthorization()` peut donc résoudre
      `true` même après un refus. Vérifier sur appareil le comportement réel après un refus
      explicite dans la feuille système, et que l'Accueil retombe bien sur l'état « Santé non
      connectée » plutôt que d'afficher une erreur.
- [ ] **Accès à Apple Santé, Paramètres** (`app/(tabs)/accueil/parametres.tsx`) : le statut affiché
      (« Connecté » / « Non autorisé ») est approximé à partir du consentement Footer
      (`me.healthConsentAt`), pas d'un vrai statut d'autorisation HealthKit (même limite Apple que
      ci-dessus). Vérifier que ça reste cohérent en pratique (ex. après une révocation dans
      Réglages > Santé sans repasser par Footer).

## Notifications push (M10)

- [ ] Permission demandée au bon moment (juste après connexion), jeton APNs envoyé à
      `PUT /me/devices`, sandbox en dev build (`src/notifications/environment.ts`).
- [ ] Toucher une notification (app fermée / en arrière-plan / au premier plan) ouvre le bon écran
      (`src/notifications/route.ts` — destinations choisies par l'agent mobile faute de spécification
      dans `screens.md`, à valider avec le lead/designer si besoin).

## Accessibilité générale (VoiceOver, Dynamic Type, réduction d'animations/transparence)

Composants partagés (`packages/ui`) déjà conçus accessibles par le designer (D3) : cette passe
porte sur l'usage qu'en fait le mobile (M4 → M10), pas sur les composants eux-mêmes.

- [ ] **VoiceOver, tous les écrans** : chaque élément interactif a un libellé pertinent (revue de
      code faite écran par écran ci-dessous ; à confirmer à l'oreille sur appareil, y compris
      l'ordre de lecture et le regroupement des lignes de liste).
- [ ] **Dynamic Type au réglage le plus grand** : aucune troncature hors cas prévus par
      `screens.md` (ex. anneau qui passe sous le texte, lignes de classement qui s'empilent —
      géré par `StepRing`/`RankRow`, à vérifier visuellement en conditions réelles).
- [ ] **Réduire les animations** : respecté nativement par les composants partagés
      (`StepRing`, `Skeleton`, `Toast`, `SegmentedControl`, `Chip`…) ; le mobile n'ajoute qu'une
      annonce VoiceOver supplémentaire au franchissement d'un seuil en direct (Accueil), sans
      animation propre à vérifier au-delà de celles déjà gérées par `@app/ui`.
- [ ] **Réduire la transparence** : idem, géré par `GlassCard`/`useReducedTransparency` ; aucune
      carte translucide ajoutée en dehors de `GlassCard` côté mobile.

### Points relevés pendant la revue de code (M11)

- Corrigé : `app/(tabs)/accueil/historique.tsx` appliquait `textSecondary` au titre (date) des
  jours sans donnée au lieu de laisser `ListRow` griser seulement la valeur « Pas de données ».
- Ajouté : annonce VoiceOver « Palier de X pas franchi » sur l'Accueil quand un seuil est franchi
  pendant que l'écran est ouvert (screens.md §4) ; le halo visuel décoratif associé n'a pas été
  implémenté (non accessibilité-critique, cf. rapport M5).
- Connu et assumé (signalé au designer, non bloquant) : `StatTile` (@app/ui) n'expose pas de prop
  `onPress`. La tuile « Rang du jour » de l'Accueil et les lignes du Classement restent donc
  atteignables seulement via les onglets, pas par un toucher direct comme le décrit `screens.md`.
- Pastille soleil de seuil franchi (Historique, `screens.md` §8) rendue en texte (« · Palier de
  10 000 franchi ») plutôt qu'en icône décorative séparée, faute d'emplacement dédié dans
  `ListRow` sans perdre l'affichage de la valeur (voir commentaire dans `historique.tsx`).
