# ADR 005 : Réponse neutre à l'ajout d'ami et demandes « fantômes »

- Statut : accepté (2026-09-24)
- CA : CA7, CA8, CA11

## Contexte
CA7 : un pseudo inconnu ou qui m'a bloqué doit renvoyer la même réponse. Or la liste des demandes sortantes (nécessaire à l'annulation, F8) révélerait la différence entre « demande créée » et « rien créé ». Par ailleurs, l'existence d'un pseudonyme est déjà observable via le choix de pseudonyme (409 `USERNAME_TAKEN`, CA2).

## Décision
- `POST /friend-requests` renvoie toujours `202 { status: "requested" }` (sauf 400 format, 422 soi-même, 409 `TARGET_BLOCKED` si **je** bloque la cible, 429 débit).
- Cible bloquante ou `acceptFriendRequests = false` : création d'une demande **cachée** (`friend_requests.hidden = true`) visible par l'expéditeur seul, jamais notifiée ni montrée à la cible. L'expéditeur ne distingue donc pas « bloqué / refuse » de « en attente ».
- Pseudo inconnu : rien n'est créé (écart connu, non exploitable au-delà de CA2).
- Demande inverse en attente et visible : acceptation automatique (amitié créée).
- Autorisation par ressource : toute ressource d'un autre utilisateur (activité, demande, encouragement) inaccessible renvoie **404**, jamais 403.
- **Blocage** (transaction) : supprime amitié (2 lignes), demandes dans les deux sens, notifications en attente entre les deux ; ensuite toute interaction du bloqué vers le bloqueur est neutre (demande cachée) ou 404.

## Conséquences
- Limitation de débit sur `POST /friend-requests` (`FRIEND_REQUESTS_PER_DAY`) et sur `PUT /me/username` contre l'énumération massive.
- Tests E2E : réponses strictement identiques (statut + corps) pour inconnu / bloqué / refus.
