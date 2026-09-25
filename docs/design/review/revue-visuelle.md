# Revue visuelle (phase 3)

> Designer, 2026-09-25. Référentiel : `DESIGN.md` (prioritaire), `screens.md`, `packages/ui/src/tokens.ts`.
> Captures : `screens/*.png` (aperçu web Expo, Chromium 390 × 844 @3x, fr-FR, Europe/Paris, source santé simulée, API `start:e2e` peuplée par le script). `*-complet.png` = page entière.
> Reproduire : voir l'en-tête de `capture-screens.mjs` (export web puis `node docs/design/review/capture-screens.mjs <dist>`). L'API est arrêtée en fin de script.

## Synthèse

| Gravité | Total | `[mobile]` | `[designer]` |
|---|---|---|---|
| Bloquant | 1 | 1 | 0 |
| Majeur | 12 | 10 | 2 (corrigés) |
| Mineur | 9 | 7 | 2 (1 corrigé, 1 accepté) |

Correctifs `[designer]` appliqués dans `packages/ui` (`pnpm --filter @app/ui check` vert, 132 tests) et vérifiés sur une seconde passe de captures.

## Limites de l'aperçu web (non comptées comme écarts, à vérifier sur appareil avec `apps/mobile/docs/checklist-m11.md`)
- Grands titres natifs (`headerLargeTitle` + `headerTransparent`) superposés au contenu (« Classement », « Amis », pseudo de la fiche ami) : non pris en charge par le web ; sur iOS, `contentInsetAdjustmentBehavior="automatic"` décale le contenu.
- SF Symbols absents (icônes d'onglets, engrenage de l'Accueil), libellés d'onglets rognés en bas, en-têtes de pile blancs opaques.
- Interrupteurs : pouce vert sarcelle = rendu par défaut de react-native-web ; `thumbColor` est appliqué sur iOS.
- Bouton Sign in with Apple remplacé par un bouton `primary` ; `pageerror` expo-notifications (module natif).
- Dynamic Type, Réduire les animations/la transparence et VoiceOver : non observables ici.

---

## Bloquant

### B1. Accueil : « Autoriser l'accès » enregistre le consentement santé en un toucher `[mobile]`
- Captures : `05-accueil-sans-consentement.png` → `05-accueil-sans-ami.png` (après un seul toucher, le consentement est enregistré et la synchro démarre).
- Constat : `onAuthorizeHealth` (`app/(tabs)/accueil/index.tsx`) appelle directement `api.me.setHealthConsent({ granted: true })`. L'utilisateur qui avait choisi « Pas maintenant » consent sans voir la liste des données ni activer la case explicite. Contraire à screens.md §1/§4 (« consentement absent → écran de consentement ») et au consentement explicite RGPD art. 9.
- Correctif : l'action ouvre l'écran de consentement (`/(auth)/consentement` ou une copie dans la pile Accueil) ; aucun `PUT /me/consents/health` hors de cet écran. L'appel direct à HealthKit reste réservé au cas « consentement Footer donné, accès HealthKit refusé » (écran d'information Réglages du §1).

## Majeur

### M1. Onboarding sans illustration `[mobile]`
- Captures : `01-onboarding-page1.png`, `01-onboarding-page2.png` (grand vide au-dessus du titre).
- Correctif : `<Illustration kind="sunrise" />` (page 1) et `<Illustration kind="together" />` (page 2) au-dessus du titre (screens.md §1).

### M2. Connexion sans logo `[mobile]`
- Capture : `02-connexion.png` (mot « Footer » seul, sans symbole).
- Correctif : remplacer le titre texte par `<Logo />` de `@app/ui` (symbole nuage + pas, VoiceOver « Footer ») (screens.md §2, §11).

### M3. Toast « Pas maintenant » jamais visible `[mobile]`
- Capture : `04-consentement-pas-maintenant-toast.png` (Accueil sans toast 1 s après le choix).
- Cause : `showToast` est appelé sur l'écran de consentement, démonté par la navigation.
- Correctif : `emitGlobalToast(DECLINE_MESSAGE, "info")` dans `onDecline`, et `useEffect(() => onGlobalToast(showToast), [showToast])` dans l'Accueil (comme Amis/Classement).

### M4. Accueil : état « consentement absent » affiché pendant le chargement de `/me` `[mobile]`
- Capture : `18-accueil-chargement.png` (« Bonjour » sans pseudo + carte « Connecte Apple Santé » alors que le consentement existe).
- Cause : `hasConsent = Boolean(me?.healthConsentAt)` vaut `false` tant que `me` n'est pas chargé ; le squelette prévu n'apparaît jamais.
- Correctif : si `me === undefined`, `view.kind = "loading"` (squelette anneau + 2 tuiles, VoiceOver « Chargement de ton activité ») ; masquer « Bonjour » tant que le pseudo est inconnu ou afficher un `Skeleton` à sa place.

### M5. Erreur de synchro sans bandeau `[mobile]`
- Capture : `18-accueil-erreur-synchro.png` (`PUT /me/activity` en échec : écran identique au cas nominal).
- Cause : `syncError` de `useActivitySync` n'est pas lu par l'Accueil.
- Correctif : passer `syncError` à `buildTodayViewModel` ; si présent, bandeau `warningSoft` « Tes amis verront ce total dès que la connexion revient. » au-dessus de l'anneau (screens.md §4).

### M6. Erreur `/me/today` : tuile « Ajoute un ami » alors que l'utilisateur a 4 amis `[mobile]`
- Capture : `18-accueil-erreur.png`.
- Correctif : rang inconnu pour cause d'erreur ≠ aucun ami. Utiliser `leaderboardQuery.data` (en cache ou chargé) pour le rang ; sinon tuile « Rang du jour » / « — » non pressable. « Ajoute un ami » seulement si la liste d'amis est effectivement vide. Le bandeau doit avoir le fond `warningSoft` (ici texte ambre sur verre blanc).

### M7. Tuile rang sans « ex æquo » `[mobile]`
- Captures : `09-accueil-complet.png` (« 2e sur 5 ») vs `12-classement-jour.png` (tom et sam.b « 2e ex æquo »).
- Correctif : `formatRankLabel(rank, tied)` avec `tied` calculé par `markTies` sur les entrées du classement du jour → « 2e ex æquo » (screens.md §4.3).

### M8. Pastille numérique absente sur l'onglet Amis `[mobile]`
- Constat (code, l'icône n'est pas rendue sur le web) : aucun `tabBarBadge` dans `app/(tabs)/_layout.tsx` ; le commentaire « sera ajoutée (M7) » est resté.
- Correctif : `tabBarBadge: incoming.length || undefined` (requête `GET /friend-requests` partagée), `tabBarBadgeStyle` fond `accent`, texte blanc ; libellé VoiceOver « Amis, 2 demandes » (screens.md §0).

### M9. Amis vide : deux actions principales `[mobile]`
- Capture : `07-amis-vide.png` (« Ajouter » et « Partager mon pseudo » tous deux `primary`).
- Correctif : `action={{ label: "Partager mon pseudo", onPress, variant: "secondary" }}` (prop ajoutée à `EmptyState`, voir D-M1 ci-dessous). Une seule action principale par écran (screens.md §0, §6).

### M10. Fiche ami : chiffre trop large pour l'anneau de 160 `[mobile]`
- Capture : `13-profil-ami-complet.png` (« 5 364 pas » en `title1` occupe tout le diamètre intérieur ; « 12 345 pas » débordera).
- Correctif : au centre, chiffre seul en `title2` (`5 364`) puis `footnote textSecondary` « pas aujourd'hui » ; `numberOfLines={1}` + `adjustsFontSizeToFit` sur le chiffre. Grand texte : `StepRing` place déjà le contenu sous l'anneau.

### D-M1. Nuages décoratifs sous les titres `[designer]` (corrigé)
- Captures avant correction : `04-consentement.png` (« utilise » sur un nuage), `16-comptes-bloques-vide-toast.png` (« Tu n'as bloqué personne. » sur un nuage), `09-accueil.png` (« Bonjour »). Contraire à la règle « aucun texte posé sur un nuage décoratif ».
- Correctif appliqué : `SkyBackground` confine les deux nuages à la bande de la barre d'état (0–44 pt) et aux bords. Vérifié sur la seconde passe (`04-consentement.png`, `12-classement-jour.png`).
- Ajout lié : `EmptyState.action.variant` (`primary` | `secondary`) pour M9.

### D-M2. Bouton « Ajouter » qui déborde du champ `[designer]` (corrigé)
- Capture avant correction : `07-amis-vide.png` (pastille qui dépasse le contour à droite).
- Correctif appliqué (`TextField`) : `minWidth: 0` sur le champ, marge droite réduite quand `trailing` est présent, contour navigateur supprimé (le focus reste marqué par la bordure 2 px `focus`, cf. double contour de `03-pseudo-saisie-minuscules.png`).

## Mineur

### m1. Fiche ami : bouton « Bloquer » `[mobile]`
- Capture : `13-profil-ami-complet.png`. Bouton `destructive` plein libellé « Bloquer », plus visible que « Retirer » ; spec : `ghost` couleur `danger` « Bloquer lea ».
- Correctif : `Button variant="ghost"` avec texte `danger` (ou `destructive` conservé si le lead le préfère, mais libellé `Bloquer ${username}`).

### m2. Fiche ami : titres et états incomplets `[mobile]`
- Captures : `13-profil-ami-complet.png`, `22-profil-ami-chargement.png`, `22-profil-ami-erreur.png`.
- Correctifs : titre `headline` « Ses 7 derniers jours » sur la carte historique ; squelette des puces (3 `Skeleton` arrondis 36 pt) sous l'anneau pendant le chargement ; en erreur, garder `Monogram` + pseudo et les actions « Retirer » / « Bloquer » sous l'`ErrorState`.

### m3. Accueil : carte encouragements sans titre, lien historique hors carte `[mobile]`
- Capture : `09-accueil-complet.png`.
- Correctifs : titre `headline` « Encouragements reçus » en tête de carte ; « Tes 30 derniers jours » dans une `GlassCard` comme les autres blocs.

### m4. Paramètres : détails `[mobile]`
- Capture : `15-parametres-complet.png`.
- Correctifs : bandeau « Les notifications sont désactivées… » sur fond `warningSoft` (rayon `md`, padding 12) ; « Fin 8 h 00 » (pas de zéro initial : `formatQuietHour`) ; en-têtes `APPLE SANTÉ`, `COMPTES BLOQUÉS` sur les cartes concernées ; pied `footnote` avec la version de l'app.

### m5. Classement : ponctuation du bandeau `[mobile]`
- Capture : `12-classement-jour.png` (« … pour dépasser lea. »). Spec et Accueil sans point final : harmoniser (retirer le point).

### m6. Squelettes en rectangles pleins `[mobile]`
- Captures : `19-classement-chargement.png`, `20-amis-chargement.png`.
- Correctif : utiliser `SkeletonRow` (nouveau, `@app/ui` : pastille 40 + 2 lignes) à la place des `Skeleton height={64}`.

### m7. Source santé simulée quasi constante `[mobile]`
- Capture : `11-historique-complet.png` (4 164 pas chaque jour, toutes les barres pleines ; `SunBadge` et échelle relative non vérifiables).
- Cause : `pseudoRandom` (hash ×31 sans mélange final) varie de quelques unités sur 2³² d'un jour à l'autre.
- Correctif (hors production) : ajouter un mélange final type murmur3 `fmix32` (`h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16`) avant la division. Le script de captures reprend le même calcul : le mettre à jour ensuite (`[designer]`).

### D-m1. Pastilles `Monogram` `[designer]` (corrigé)
- Captures avant correction : `06-classement-vide.png`, `12-classement-jour.png` (initiale de ma ligne quasi invisible sur le surlignage) ; `13-profil-ami-complet.png` (initiale `headline` trop petite dans la pastille 64).
- Correctif appliqué : `Monogram tone="surface"` utilisé par `RankRow` pour ma ligne ; initiale en `title2` à partir de 56 pt.

### D-m2. Classement : « tom » + « toi » sur deux lignes `[designer]` (accepté)
- Capture : `12-classement-jour.png`. Le passage à la ligne évite toute troncature du pseudo (règle Dynamic Type §0) ; hauteur de ligne légèrement supérieure. Aucune action.

## Écrans conformes (hors écarts ci-dessus)
Pseudo (aide, erreurs de format et « déjà pris »), consentement (case désactivée par défaut, bouton inactif), classement vide et semaine, amis (demandes reçues/envoyées, toasts), confirmations de retrait/blocage/suppression, comptes bloqués et état vide, suppression du compte et son erreur, erreurs classement / amis / historique (titre doux + « Réessayer »). Ton : tutoiement partout, aucun terme culpabilisant relevé.
