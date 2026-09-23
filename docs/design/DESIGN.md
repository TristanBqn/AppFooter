# Directives de design

> Rempli par le lead à partir de `Specs.txt`, validé par l'utilisateur. Ces directives priment sur les préférences du designer.
> Mettre maquettes, captures et références dans `docs/design/refs/` : images PNG ou JPG, ou liens listés ci-dessous.

## 1. Intention
- Produit et public cible : Footer, app iPhone qui motive à marcher davantage par une compétition amicale entre proches (famille, amis). Grand public, tous âges, non sportifs inclus.
- Trois adjectifs : calme, aérien, ludique.
- Ce que l'utilisateur doit ressentir : légèreté et bienveillance ; envie de marcher un peu plus, jamais de culpabilité ni de pression sportive.

## 2. Références
- Univers : ciel, nuages, lumière. Matériaux « liquid glass » d'iOS (léger, pas de surcharge).
- À retenir des apps iOS natives (Santé, Météo) : lisibilité immédiate du chiffre principal, cartes, hiérarchie claire.
- Fichiers dans `refs/` : aucun pour l'instant. Le designer propose ; ses propositions sont validées en fin de phase 1.

## 3. Identité visuelle
- Couleurs : palette bleu clair et blanc. Dégradés de ciel doux autorisés. Les couleurs d'accent restent douces (pas de rouge agressif, pas de néon).
- Typographie : police système iOS (SF Pro, variante arrondie SF Pro Rounded acceptée pour les chiffres et titres). Doit respecter Dynamic Type.
- Logo et assets : à proposer par le designer (thème pas / nuage).
- Mode sombre : non en V1 (clair uniquement). Tokens structurés pour l'ajouter plus tard.

## 4. Style d'interface
- Densité : aérée.
- Coins : très arrondis.
- Profondeur : effets de verre légers (cartes translucides, flou discret), ombres très légères.
- Illustrations et icônes : illustrations douces (nuages, ciel, soleil) plutôt que sportives ; icônes SF Symbols ou équivalent linéaire arrondi.
- Animations : discrètes et non envahissantes ; désactivées ou réduites si « Réduire les animations » est actif.

## 5. Ton des textes
- Tutoiement ; français uniquement en V1.
- Style amical, encourageant, jamais culpabilisant (pas de « tu es dernier », préférer « encore 1 200 pas pour dépasser Léa »).

## 6. À éviter absolument
- Esthétique sportive ou agressive (noir/rouge, typographies condensées, chronos, podiums écrasants).
- Messages culpabilisants, classements humiliants, comparaisons négatives.
- Écrans chargés, actions multiples pour une tâche simple.
- Message libre entre utilisateurs (encouragements prédéfinis uniquement).

## 7. Contraintes
- Accessibilité : WCAG AA (contrastes, y compris sur fonds translucides) ; VoiceOver (libellés sur tous les éléments), Dynamic Type, Réduire les animations.
- Plateformes : iPhone (iOS 17+) uniquement. Pas de web, pas d'Android en V1.
- Navigation principale : 3 onglets, Accueil, Classement, Amis. Paramètres accessibles depuis l'Accueil.
- États d'erreur, de chargement et d'absence de données explicites et rassurants.
- Toute action sensible (blocage, suppression d'ami, suppression du compte) passe par une confirmation.
