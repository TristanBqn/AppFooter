# Écrans V1 : Footer

> Propriétaire : designer. Directives prioritaires : `DESIGN.md`. Composants et tokens : `@app/ui` (`packages/ui`).
> Références visuelles : `refs/accueil.svg|png`, `refs/classement.svg|png` (taille de texte par défaut, iPhone 390 × 844 pt ; rendu PNG en police de repli, la police réelle est SF Pro / SF Pro Rounded).
> Les données viennent de `@app/contracts` ; ce document ne définit aucun format d'API.

## 0. Règles communes

### Structure
- Fond : `SkyBackground` (`sky` pour les onglets, `dawn` pour onboarding et états vides). Décor masqué à VoiceOver ; nuages confinés à la bande de la barre d'état (0–44 pt), jamais sous un texte.
- Contenu en `GlassCard` (rayon 24, voile blanc 62 %, flou 30, ombre `soft`). Marge d'écran 20 pt, 16 pt entre cartes, 20 pt de padding interne.
- Titres d'onglet en `largeTitle` (grand titre iOS, rétréci au défilement). Un seul titre `header` par écran.
- **Une seule action principale** (`Button` `primary`) par écran au maximum ; les autres en `secondary` ou `ghost`.
- Barre d'onglets native (Expo Router `Tabs`), fond verre `glassStrong`, 3 onglets : **Accueil** (`house`), **Classement** (`chart.bar`), **Amis** (`person.2`). Onglet actif : `accent` ; inactif : `textSecondary`. Pastille numérique sur Amis si demandes reçues.
- Paramètres : bouton engrenage 44 × 44 en haut à droite de l'Accueil, ouvre une pile (push).
- Icônes : SF Symbols (via `expo-symbols`), trait régulier, toujours décoratives si un texte les accompagne.

### Tokens clés (voir `packages/ui/src/tokens.ts`)
| Rôle | Token | Valeur |
|---|---|---|
| Texte principal | `text` | `#0B2545` (≥ 11:1 sur ciel) |
| Texte secondaire | `textSecondary` | `#3A5578` (≥ 5,5:1 sur ciel et verre) |
| Accent / bouton principal | `accent` | `#1859B0` (texte blanc 6,8:1 ; en texte ≥ 4,9:1 sur ciel et verre) |
| Progression | `progressStart → progressEnd` | `#2F7BDD → #1859B0` (≥ 3,7:1 sur verre) |
| Succès / attention / danger doux | `success` / `warning` / `danger` | vert sauge, ambre, rose profond (AA) |
| Premier rang | `sun` | `#FFE08A` (pastille seulement) |

Règle : aucun texte gris clair, aucun texte posé directement sur un nuage décoratif. Les contrastes sont testés automatiquement (`tokens.test.ts`), verre composité sur chaque teinte du ciel, flou ignoré (cas le plus défavorable).

### Accessibilité (CA13)
- **VoiceOver** : chaque élément interactif a un `accessibilityLabel` en français ; lignes de liste regroupées en un seul élément (« 2e ex æquo, tom, toi, 8 450 pas ») ; illustrations masquées ; retours d'action annoncés (`announce`).
- **Dynamic Type** : tous les textes suivent la taille système. Seuls `hero` (×1,4), `largeTitle`/`title1` (×2) sont plafonnés. À partir d'un facteur 1,3 (`LARGE_TEXT_SCALE`) : le chiffre du jour passe sous l'anneau, les lignes de classement passent sur deux lignes (nom, puis pas), les paires d'indicateurs s'empilent. Aucune troncature de nom sauf une ligne en taille standard.
- **Réduire les animations** : anneau et bascule sans transition, squelettes figés, feuilles en fondu, pas de mise à l'échelle au toucher (`useReducedMotion`, `motion.reduced`).
- **Réduire la transparence** : cartes opaques `surfaceOpaque` (`useReducedTransparency`).
- Zones tactiles ≥ 44 pt ; focus clavier complet (Accès clavier complet iOS) géré nativement par `Pressable`.

### Retours immédiats
- Toucher : état pressé (fond plus soutenu + échelle 0,97) ; retour haptique léger (`expo-haptics`, `impactLight`) pour envoi d'encouragement, acceptation d'ami, bascule de période — à implémenter côté mobile.
- Mise à jour optimiste pour : accepter/refuser/annuler une demande, encourager, basculer un réglage. En cas d'échec, retour à l'état précédent + `Toast` `error` qui dit quoi faire.
- `Toast` en bas, au-dessus de la barre d'onglets, 2,6 s, jamais d'action dedans.
- Rafraîchissement : tirer pour actualiser (`RefreshControl`, teinte `accent`) sur Accueil, Classement, Amis, Profil ami, Historique ; resynchronisation Santé automatique au retour au premier plan.

### Textes (tutoiement, jamais culpabilisants)
- Chiffres : `formatSteps` / `formatKcal` (espace insécable, « 8 450 pas »). Rangs : `formatRankLabel` (« 1er », « 2e ex æquo »).
- Écarts : toujours formulés vers le haut. « Encore 1 201 pas pour dépasser lea » (`stepsToOvertake` = ses pas − les miens + 1). Jamais « tu es dernier », « tu as perdu », « retard ».
- Erreurs : un titre doux + ce qu'il faut faire. Titre par défaut : « Petit nuage sur la connexion ».

### Squelette des états (appliqué à chaque écran)
| État | Composant | Règle |
|---|---|---|
| Chargement initial | `LoadingState` + `Skeleton` à la forme du contenu (listes : `SkeletonRow`, pastille + 2 lignes) | Libellé VoiceOver « Chargement de … ». Au-delà de 10 s : passer en erreur. |
| Rafraîchissement | `RefreshControl` | Contenu précédent conservé. |
| Vide | `EmptyState` (`illustration` : `sunrise`, `together`, `privacy`, `calm`, `offline`, `farewell` ; 1 action max, `action.variant: "secondary"` si l'écran a déjà son action principale) | Rassurant, propose l'étape suivante. |
| Erreur | `ErrorState` + « Réessayer » | Dit quoi faire. Si des données en cache existent : les afficher + bandeau discret « Dernière mise à jour à 14 h 05 ». |

---

## 1. Onboarding (2 pages) + consentement santé

**But** : comprendre Footer en 20 secondes, puis consentir explicitement au traitement des pas (RGPD art. 9) avant toute synchro.

Fond `SkyBackground dawn`. Pagination horizontale (points de page, VoiceOver « Page 1 sur 2 »), bouton `primary` en bas, « Passer » (`ghost`) en haut à droite. Le consentement n'est pas une page de l'onboarding : c'est un écran dédié, affiché après la connexion et le pseudonyme.

| Page | Illustration | Titre (`title1`) | Texte (`callout`) | Action |
|---|---|---|---|---|
| 1 | `Illustration sunrise` | Marche, tout simplement | Footer compte tes pas et te propose une petite compétition amicale avec tes proches. | Continuer |
| 2 | `Illustration together` | Entre proches, sans pression | Tu ne vois que tes amis, et eux ne voient que toi. Pas de classement public. | Continuer |
| Consentement (écran dédié) | `Illustration privacy` | Ce que Footer utilise | voir ci-dessous | J'accepte et je continue |

**Consentement santé (écran dédié, séparé des CGU, après connexion et pseudonyme)**
- `GlassCard` avec liste à puces :
  - « Tes pas et tes calories actives de chaque jour, lus dans Apple Santé. »
  - « Seulement les totaux quotidiens, jamais le détail de tes mouvements. »
  - « Les pas saisis à la main ne comptent pas. »
  - « Tes amis acceptés voient tes pas (et tes calories si tu le veux). »
  - « Tu peux tout effacer à tout moment depuis les Paramètres. »
- Lien `ghost` « Lire la politique de confidentialité » (ouvre la page statique de l'API dans un navigateur intégré).
- Case à cocher explicite (`SwitchRow`) : « J'accepte que Footer traite mes données de pas et de calories » — **désactivée par défaut**. Le bouton principal reste désactivé tant qu'elle n'est pas activée (VoiceOver : « J'accepte et je continue, désactivé. Active d'abord l'accord ci-dessus. »).
- Au clic : demande système HealthKit. Si l'utilisateur refuse l'accès dans la feuille iOS : écran d'information « Footer a besoin de tes pas pour fonctionner. Tu peux l'autoriser dans Réglages > Santé > Accès aux données > Footer. » + bouton `secondary` « Ouvrir Réglages » + `ghost` « Plus tard » (l'app reste utilisable, Accueil en état vide « Santé non connectée »).
- Refus du consentement Footer : bouton « Pas maintenant » (`ghost`) ; aucune synchro, aucun appel HealthKit. Retour à l'**Accueil** (pas à l'onboarding) avec `Toast tone="info"` rassurant « Pas de souci. Footer ne lira pas tes pas sans ton accord. Tu peux l'activer quand tu veux. » ; l'Accueil s'affiche en état vide « consentement absent » (§4), dont l'action « Autoriser l'accès » rouvre cet écran. Le choix n'est pas redemandé automatiquement à chaque lancement.

**Ordre du flux** : Onboarding 1–2 → Connexion Apple → Pseudonyme → Consentement → Accueil (accord ou « Pas maintenant »). Consentement après la connexion pour l'horodater côté serveur (décision lead).

## 2. Connexion avec Apple

- Fond `dawn`, `Logo` centré (symbole nuage + deux pas, mot « Footer » en `largeTitle` ; VoiceOver « Footer »), sous-titre « Marche un peu plus, ensemble. »
- Bouton **Sign in with Apple** natif (`expo-apple-authentication`, style noir ou blanc imposé par Apple : **blanc avec contour** pour rester dans la palette ; hauteur 52, rayon 26). C'est l'action principale unique.
- Mention `footnote` : « En continuant, tu acceptes les conditions d'utilisation et la politique de confidentialité. » (liens).
- Hors production uniquement : bouton `ghost` « Connexion de développement » sous un séparateur, libellé préfixé « DEV ».
- **Chargement** : bouton en `loading` (`accessibilityState.busy`), écran non bloqué visuellement.
- **Erreur** : annulation par l'utilisateur → aucun message. Échec réseau/serveur → `Toast error` « Connexion impossible pour l'instant. Vérifie ta connexion puis réessaie. »

## 3. Choix du pseudonyme (première connexion)

- Titre `title1` « Choisis ton pseudo » ; texte « C'est ce que tes amis taperont pour t'ajouter. »
- `TextField` label « Pseudo », `autoCapitalize="none"`, `autoCorrect={false}`, `textContentType="username"`, `maxLength={20}`, saisie forcée en minuscules à la frappe.
- Aide permanente : « 3 à 20 caractères : lettres minuscules, chiffres, _ et . »
- Validation locale immédiate (format) ; disponibilité vérifiée à la soumission (pas de vérification à chaque frappe, pour éviter l'énumération).
- Bouton `primary` « C'est parti », désactivé tant que le format est invalide.
- Erreurs (`TextField.error`, annoncées) :
  - format : « Utilise seulement des lettres minuscules, des chiffres, _ ou . (3 à 20). »
  - déjà pris : « Ce pseudo est déjà pris. Essaie une variante, par exemple tom.marche. »
  - réseau : `Toast error` « Impossible de vérifier pour l'instant. Réessaie dans un instant. »
- Succès : transition vers le consentement (fondu si animations réduites).

## 4. Accueil (onglet 1) — référence `refs/accueil.png`

**Hiérarchie** : 1) pas du jour, 2) progression vers le prochain seuil, 3) calories et rang, 4) prochain ami à dépasser.

1. **En-tête** : date `subheadline textSecondary` (« Jeudi 24 septembre ») ; `largeTitle` « Bonjour {pseudo} » ; bouton engrenage (VoiceOver « Paramètres »).
2. **Carte anneau** (`GlassCard` + `StepRing` 240 pt) :
   - centre : `hero` « 8 450 » + `body textSecondary` « pas aujourd'hui » ;
   - sous l'anneau : `headline` « Encore 1 550 pas pour 10 000 » (`nextMilestone` et `stepsToNextMilestone` de `/me/today` ; fraction de l'anneau via `progressToNext(steps, STEP_MILESTONES)`) ;
   - tous les seuils franchis : anneau plein + « Tous les paliers du jour sont franchis. Bravo ! » ;
   - 0 pas : « Ta journée commence. Chaque pas compte. » ;
   - VoiceOver anneau : label « Progression vers 10 000 pas », valeur « 8 450 pas sur 10 000 ».
   - Franchissement d'un seuil pendant que l'écran est ouvert : léger halo soleil autour de l'anneau (`celebrate`, 900 ms) + annonce « Palier de 10 000 pas franchi ». Aucun effet si animations réduites (annonce conservée).
3. **Carte indicateurs** : deux `StatTile` côte à côte (empilés en grand texte) : « Calories actives » / « 312 kcal » ; « Rang du jour » / « 2e sur 5 » (ou « 2e ex æquo »). Toucher la tuile rang → onglet Classement (`StatTile onPress`, chevron discret, hint « Ouvre le classement »). Sans ami : tuile « Rang du jour » remplacée par « Amis » / « Ajoute un ami » (→ onglet Amis, hint « Ouvre tes amis »). La tuile calories n'est pas pressable.
4. **Carte « prochain ami »** (`ListRow` pressable + `Monogram`) : « Encore 1 201 pas » / « pour dépasser lea » → Classement. Si je suis 1er seul : « Tu mènes la journée » / « Profite de ta balade ». Si 1er ex æquo : « Tu partages la tête avec sam.b ». Masquée sans ami.
5. **Encouragements reçus** (carte visible s'il y en a aujourd'hui) : `ListRow` + `Monogram` « lea » / « Bravo pour ta marche ! » (3 derniers) ; lien `ghost` « Tout voir » → liste des encouragements reçus (7 derniers jours, même format, état vide `calm` « Aucun encouragement pour l'instant. Et si tu en envoyais un ? »).
6. **Lien historique** : `ListRow` « Tes 30 derniers jours » → Historique.

**États**
- Chargement : squelette anneau (cercle `Skeleton` 240) + 2 tuiles. VoiceOver « Chargement de ton activité ».
- Santé non connectée / consentement absent : `EmptyState` soleil « Connecte Apple Santé pour voir tes pas », message « Footer ne lit rien sans ton accord. », action « Autoriser l'accès » (consentement absent → écran de consentement ; accès HealthKit refusé → écran d'information Réglages du §1).
- Aucune donnée aujourd'hui (Santé connectée) : anneau vide + « Ta journée commence. Chaque pas compte. » (pas un état d'erreur).
- Erreur de synchro : on affiche les pas lus localement dans Santé + bandeau `warningSoft` « Tes amis verront ce total dès que la connexion revient. » ; erreur totale : `ErrorState` « Vérifie ta connexion puis tire vers le bas pour réessayer. »

## 5. Classement (onglet 2) — référence `refs/classement.png`

1. `largeTitle` « Classement ».
2. `SegmentedControl` « Aujourd'hui » / « Cette semaine » (VoiceOver groupe « Période du classement », onglets « sélectionné »). Bascule instantanée, données des deux périodes préchargées ; balayage horizontal sur la liste = même bascule.
3. Contexte `subheadline textSecondary` : « Jeudi 24 septembre · toi et 4 amis » ou « Du lundi 21 au dimanche 27 septembre ».
4. **Bandeau bienveillant** (`GlassCard` teinte `sunGlow`) : « Encore 1 201 pas pour dépasser lea » ; 1er : « Tu mènes la semaine. Belle régularité ! » ; ex æquo en tête : « Tu partages la tête avec sam.b ».
5. **Liste** dans une `GlassCard` : `RankRow` pour chaque participant, dans l'ordre de l'API (rang, puis pseudo). Égalités : `markTies` → « ex æquo » sous le rang, rang suivant sauté (1, 2, 2, 4). Ma ligne : surlignage `highlight`, `Monogram tone="surface"` (lisible sur le surlignage), étiquette « toi », pas en `accentText`. 1er : pastille soleil. **Aucun traitement négatif** pour les derniers (pas de couleur, pas de mention).
6. Toucher la ligne d'un ami → Profil ami. Ma ligne : non pressable.
7. Pied : `footnote` « Tire vers le bas pour actualiser. »

**États**
- Chargement : 5 lignes squelette. VoiceOver « Chargement du classement ».
- Vide (aucun ami accepté) : `EmptyState` `together` « Le classement se remplit avec tes amis » / « Ajoute un proche avec son pseudo pour marcher ensemble. » / action « Ajouter un ami » (→ Amis, champ focalisé). Ma propre ligne reste affichée au-dessus.
- Tout le monde à 0 (début de journée) : liste normale, tous « 1er ex æquo », bandeau « La journée commence pour tout le monde. »
- Erreur : `ErrorState` « Le classement n'a pas pu se charger. Vérifie ta connexion puis réessaie. »

## 6. Amis (onglet 3)

1. `largeTitle` « Amis ».
2. **Ajouter un ami** (`GlassCard`) : `TextField` « Pseudo de ton ami » (minuscules, sans correction), `trailing` bouton compact `primary` « Ajouter » (action principale de l'écran). Aide : « Tape son pseudo exact. » Pas de suggestions ni d'autocomplétion.
   - Réponse de l'API toujours neutre (ADR 005, `202 requested`) : champ vidé, `Toast` « Demande envoyée si ce pseudo existe », liste « Envoyées » rafraîchie. Aucun message ne distingue pseudo inconnu, bloquant ou demandes désactivées.
   - Vérifications locales avant envoi (sans appel réseau, donc sans énumération) : pseudo déjà dans « Mes amis » → erreur champ « {pseudo} fait déjà partie de tes amis. » ; déjà dans « Envoyées » → « Ta demande à {pseudo} est déjà en attente. » ; mon propre pseudo → « C'est ton propre pseudo. »
   - `409 TARGET_BLOCKED` (c'est moi qui bloque) : « Tu as bloqué {pseudo}. Débloque ce compte dans Paramètres > Comptes bloqués pour l'ajouter. »
   - `429` : « Tu as envoyé beaucoup de demandes aujourd'hui. Réessaie demain. » ; format invalide : message de format du §3.
3. **Demandes reçues** (section visible s'il y en a, en premier) : `ListRow` + `Monogram`, `trailing` : `Button compact secondary` « Accepter » et `ghost` « Refuser » (VoiceOver « Accepter la demande de lea »). Retour optimiste : la ligne glisse vers « Mes amis » (fondu si animations réduites) + `Toast` « lea fait maintenant partie de tes amis ». Refus : ligne retirée, sans toast culpabilisant (annonce VoiceOver « Demande refusée »).
4. **Demandes envoyées** : `ListRow` « {pseudo} » / « En attente », `trailing` `ghost` « Annuler ».
5. **Mes amis** : `ListRow` pressable, `Monogram`, titre pseudo, sous-titre « 8 450 pas aujourd'hui » → Profil ami. Tri alphabétique.

**États**
- Chargement : squelette de 3 lignes (le champ d'ajout reste utilisable).
- Vide total : `EmptyState` soleil « Marcher, c'est mieux à plusieurs » / « Demande à un proche son pseudo Footer et ajoute-le ci-dessus. Ton pseudo : {moi} » + bouton `secondary` « Partager mon pseudo » (feuille de partage iOS, texte : « Ajoute-moi sur Footer : {pseudo} »).
- Erreur : `ErrorState` sous le champ d'ajout.

## 7. Profil d'un ami + encouragements

Push depuis Classement ou Amis. Titre de navigation : pseudo.

1. **Carte activité** : `Monogram` 64, pseudo `title2`, `StepRing` 160 (progression de l'ami vers son prochain seuil) avec « 6 120 pas aujourd'hui » ; « 210 kcal » si l'ami partage ses calories, sinon rien (pas de mention « masqué »).
2. **Encourager** (`GlassCard`) : titre `headline` « Envoie-lui un mot » ; grille de `Chip` issus de `ENCOURAGEMENT_CATALOG` (`@app/contracts`). Un toucher = envoi (action principale, pas de confirmation). Après envoi dans la session : la puce envoyée passe `selected`, les autres `disabled`. Si `encouragedToday` (`FriendSchema`, GET /friends) est vrai à l'ouverture : toutes les puces `disabled` (le message envoyé n'est pas connu), même sous-texte. Dans les deux cas, sous-texte « Envoyé aujourd'hui. Tu pourras l'encourager à nouveau demain. » ; `Toast` « Encouragement envoyé à marc_d » + haptique. Erreur 429 (déjà envoyé) : même état « Envoyé aujourd'hui… » sans ton d'erreur.
   - Catalogue (contrat) : « Bravo pour ta marche ! », « Allez, encore un petit tour ! », « Belle journée pour marcher », « Tu m'inspires ! », « On marche ensemble demain ? », « Quelle régularité ! ». VoiceOver : « Envoyer à marc_d : Bravo pour ta marche ! ».
3. **Historique récent** (7 derniers jours) : 7 `ProgressBar` horizontales (jour abrégé + pas), échelle relative au meilleur jour de la période.
4. **Actions sensibles** (bas de page, séparées) : `ghost` « Retirer de mes amis » et `ghost` couleur `danger` « Bloquer {pseudo} ». Chacune ouvre un `ConfirmSheet` (CA14) :
   - Retirer : titre « Retirer lea de tes amis ? » ; message « Vous ne verrez plus vos activités respectives. Tu pourras l'ajouter à nouveau plus tard. » ; « Retirer ».
   - Bloquer : titre « Bloquer lea ? » ; message « lea ne pourra plus te trouver, t'envoyer de demande ni voir ton activité. Aucune notification ne lui sera envoyée. » ; « Bloquer ».
   - Après confirmation : retour à la liste Amis + `Toast` « {pseudo} ne fait plus partie de tes amis » / « Blocage effectué pour {pseudo} » (formulations non genrées).

**États** : chargement (squelette anneau + chips) ; erreur (`ErrorState`) ; ami sans données aujourd'hui : « Pas encore de pas aujourd'hui » (neutre).

## 8. Historique (mes 30 derniers jours)

Push depuis l'Accueil. Titre « Ton historique ».

1. **Résumé** (`GlassCard`) : « Moyenne : 7 830 pas / jour » ; « Meilleur jour : 14 210 pas, le 12 septembre ». Jamais de « série perdue ».
2. **Liste** : 30 `ListRow` (jour récent en haut) : titre « Jeudi 24 sept. », valeur « 8 450 pas », sous-titre « 312 kcal » ; `ProgressBar` fine sous chaque ligne (relative au meilleur jour). Seuil de 10 000 franchi : `ListRow leading={<SunBadge />}` + `leadingLabel="palier de 10 000 franchi"` (pastille masquée à VoiceOver, sens ajouté au libellé de la ligne). Jours sans palier : pas de `leading` (le texte reste aligné, pas d'emplacement vide).
3. Jours sans donnée : « Pas de données » en `textSecondary` (pas « 0 pas » si Santé n'a rien renvoyé).

**États** : chargement (8 lignes squelette) ; vide (`calm`) « Ton historique se construit jour après jour » ; erreur standard.

## 9. Paramètres

Push depuis l'engrenage de l'Accueil. Titre « Paramètres ». Liste groupée en `GlassCard`, sections avec en-tête `footnote` majuscules.

**Mon compte** : `ListRow` « Pseudo » / valeur « tom » (lecture seule en V1) ; `ListRow` « Se déconnecter » (couleur `accentText`, sans confirmation : action réversible).

**Confidentialité**
- `SwitchRow` « Afficher mes calories à mes amis » / « Tes amis voient seulement tes pas si c'est désactivé. »
- `SwitchRow` « Accepter les demandes d'amitié » / « Désactivé : personne ne peut t'ajouter. »
- `SwitchRow` « Partager mes paliers avec mes amis » / « Tes amis sont prévenus quand tu franchis 5 000, 10 000 ou 15 000 pas. »
- `ListRow` « Politique de confidentialité » → page statique.

**Notifications**
- Si les notifications iOS sont refusées : bandeau `warningSoft` « Les notifications sont désactivées pour Footer. » + `ghost` « Ouvrir Réglages ». Interrupteurs désactivés.
- `SwitchRow` « Mes paliers de pas », « Paliers de mes amis », « Encouragements reçus », « Demandes d'amitié ».
- `SwitchRow` « Heures silencieuses » / « Aucune notification non urgente pendant ces heures. » ; si actif : deux `ListRow` « Début 22 h 00 » / « Fin 8 h 00 » ouvrant un sélecteur d'heure natif (`DateTimePicker` mode `time`, affichage compact iOS). Texte d'aide : « Les notifications retenues arrivent à la fin de la période. »

**Apple Santé** : `ListRow` « Accès à Apple Santé » / « Connecté » ou « Non autorisé » → Réglages iOS.

**Comptes bloqués** : `ListRow` « Comptes bloqués » / valeur « 2 » → liste (`ListRow` pseudo + `trailing` `ghost` « Débloquer » ; déblocage sans confirmation, `Toast` « {pseudo} est débloqué. Tu peux de nouveau l'ajouter. »). Vide (`calm`) : « Tu n'as bloqué personne. »

**Zone sensible** (carte séparée, en bas) : `ListRow` titre couleur `danger` « Supprimer mon compte » → écran 10. Pied : version de l'app (`footnote`).

Chaque bascule est optimiste ; échec → retour à l'état précédent + `Toast error` « Réglage non enregistré. Vérifie ta connexion puis réessaie. »

## 10. Suppression du compte

Push depuis Paramètres. Titre « Supprimer mon compte ».

1. `Illustration farewell` (nuages qui s'éloignent, décorative).
2. Texte : « Nous allons effacer définitivement ton compte, ton pseudo, ton historique, tes amis et tes encouragements. Ta connexion Apple sera révoquée. Tes données dans Apple Santé ne sont pas touchées. »
3. Bouton `destructive` « Supprimer mon compte » (action unique) → `ConfirmSheet` : titre « Tout effacer définitivement ? » ; message « Cette action est irréversible. » ; « Supprimer définitivement » / « Annuler ».
4. Pendant la suppression : bouton en `loading`, retour arrière bloqué.
5. Succès : retour à l'écran de connexion + message « Ton compte a été supprimé. Merci d'avoir marché avec nous. »
6. Erreur : `Toast error` « La suppression n'a pas abouti. Rien n'a été effacé ; réessaie dans un instant. » (à confirmer avec le backend : suppression atomique).

---

## 11. Identité : icône, logo, illustrations (D4)

| Fichier (`packages/ui/assets/`) | Usage | Format |
|---|---|---|
| `icon.png` | `expo.icon` (iOS) | 1024 × 1024, RVB **sans** transparence, coins carrés (iOS applique le masque) |
| `splash-icon.png` | plugin `expo-splash-screen` : `image`, `imageWidth: 200`, `backgroundColor: "#EEF7FF"` | 1024 × 1024, fond transparent |
| `favicon.png` | `expo.web.favicon` (aperçu web) | 48 × 48 |
| `icon.svg`, `logo-mark.svg` | sources vectorielles | SVG |

- Chemins depuis `apps/mobile/app.json` : `"../../packages/ui/assets/icon.png"` etc.
- **Icône** : ciel `sky400 → sky100`, soleil `sun`, nuage blanc, deux empreintes `accent` qui avancent. Lisible à 29 pt (vérifié à 60 px).
- **Logo** (`Logo`, React Native) : même symbole avec nuage `accentSoft` pour fonds clairs, mot « Footer » en SF Pro Rounded gras. Écran de connexion uniquement.
- **Illustrations** (`Illustration kind`, 200 × 120, décoratives) : `sunrise` (onboarding 1, Santé non connectée), `together` (onboarding 2, amis/classement vides), `privacy` (consentement), `calm` (vides génériques, historique), `offline` (erreurs), `farewell` (suppression du compte).
- Revue visuelle web : `pnpm --filter @app/ui gallery` construit la galerie des composants avec react-native-web et écrit `docs/design/review/gallery*.png` (normal, feuille ouverte, animations réduites).

## Points ouverts
1. ~~Ordre consentement / connexion~~ : réglé, consentement après connexion et pseudonyme ; « Pas maintenant » → Accueil (§1).
2. ~~Catalogue et seuils~~ : réglé (`ENCOURAGEMENT_CATALOG`, `STEP_MILESTONES`, `encouragedToday` dans `@app/contracts`). `encouragedToday` n'est pas sur les entrées du classement : non nécessaire, le profil ami le lit depuis GET /friends.
3. ~~Demandes désactivées~~ : réglé par l'ADR 005 (réponse 202 neutre, demande cachée).
4. ~~Logo~~ : livré (D4), voir §11.
5. Dépendances à prévoir côté mobile : `expo-blur`, `expo-linear-gradient`, `react-native-svg` (peer deps de `@app/ui`), `expo-symbols`, `expo-haptics`, `expo-apple-authentication`, `react-native-safe-area-context` (marges des feuilles et toasts).
