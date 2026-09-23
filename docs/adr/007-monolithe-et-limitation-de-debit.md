# ADR 007 : Monolithe Hono, limitation de débit en mémoire, anti-spam en base

- Statut : accepté (2026-09-24)
- CA : CA9

## Contexte
Public restreint (cercles d'amis), pas de besoin chiffré de montée en charge. Deux mécanismes distincts : quotas métier (1 encouragement / ami / jour) et protection HTTP (force brute, énumération).

## Décision
- Une seule API Hono (`@app/api`), modules : `auth`, `me`, `activity`, `leaderboards`, `social` (amis, demandes, blocages), `encouragements`, `notifications`. Drizzle + PostgreSQL (PGlite en dev/test). Pas de cache, pas de file, pas de microservice.
- **Quota métier en base** (exact, survit aux redémarrages) : index unique `encouragements (sender_id, recipient_id, sender_local_date)` ; conflit ⇒ 429 `ENCOURAGEMENT_LIMIT`. Quota de demandes d'amitié : comptage des lignes du jour local de l'expéditeur.
- **Débit HTTP en mémoire** (fenêtre glissante d'une minute) : `/auth/*` par IP, reste par utilisateur, `PUT /me/username` renforcé ; constantes dans `@app/contracts`. Réponse 429 `RATE_LIMITED` + en-tête `Retry-After`.

## Conséquences
- Le limiteur en mémoire n'est exact qu'en instance unique ; au-delà, passer à un stockage partagé (PostgreSQL ou Redis) — non nécessaire en V1.
- IP réelle derrière proxy : lire `X-Forwarded-For` seulement si `TRUST_PROXY=true`.
