# ADR 001 : Sign in with Apple vérifié par l'API, sessions opaques en base

- Statut : accepté (2026-09-24)
- CA : CA1, CA12

## Contexte
L'app iPhone se connecte uniquement avec Apple (F1). L'API doit émettre sa propre session, révoquer le jeton Apple à la suppression (directive App Store 5.1.1) et ne stocker aucune donnée d'identité superflue (RGPD). Better Auth a été évalué : son modèle `user` exige un e-mail (Apple ne l'envoie qu'à la première autorisation, souvent en relais privé) et il ne gère pas la révocation Apple ; il faudrait le contourner sur les deux points structurants.

## Décision
- **Vérification Apple** par la bibliothèque `jose` : `createRemoteJWKSet("https://appleid.apple.com/auth/keys")` + `jwtVerify` avec `issuer = https://appleid.apple.com`, `audience = APPLE_BUNDLE_ID`, `exp` contrôlé, et `sha256hex(nonce brut) === claim nonce`. Aucun scope demandé (ni nom ni e-mail) : on ne conserve que `sub`.
- **Refresh token Apple** : l'`authorizationCode` est échangé à `POST https://appleid.apple.com/auth/token` (client_secret = JWT ES256 signé par la clé `.p8`, `jose`). Le refresh token est stocké chiffré (AES-256-GCM, `node:crypto`, clé `APPLE_TOKEN_ENC_KEY`), uniquement pour `POST /auth/revoke` à la suppression du compte.
- **Session** : jeton opaque de 32 octets aléatoires (`crypto.randomBytes`, base64url), seul son SHA-256 est stocké (`sessions.token_hash`). Transport `Authorization: Bearer`. Expiration glissante `SESSION_TTL_DAYS` (90 j), `last_used_at` mis à jour au plus une fois par jour. Côté mobile : `expo-secure-store`.
- **Connexion de dev** `POST /auth/dev` : montée seulement si `APP_ENV !== "production"` **et** `ENABLE_DEV_LOGIN=true` ; le démarrage échoue si `APP_ENV=production` et `ENABLE_DEV_LOGIN=true`. En production la route n'existe pas (404).
- Vérificateur Apple et client de jetons Apple derrière des interfaces (`AppleIdentityVerifier`, `AppleTokenClient`) ; les tests utilisent une paire de clés locale.

## Conséquences
- Pas de dépendance d'authentification tierce ; primitives cryptographiques uniquement issues de `jose` et `node:crypto` (aucun algorithme maison).
- Écart assumé avec le principe « Better Auth ou équivalent » : à valider par le lead.
- Rejeu possible d'un couple (identityToken, nonce) intercepté pendant sa durée de validité (~10 min) : risque faible sous TLS ; parade future : nonce émis par le serveur.
- Si l'échange du code échoue (Apple indisponible), la connexion réussit quand même ; la révocation sera tentée sans refresh token (journalisée) — à surveiller.
