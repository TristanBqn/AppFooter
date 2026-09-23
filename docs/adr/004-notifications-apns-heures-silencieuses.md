# ADR 004 : Notifications via APNs direct, point d'entrée unique, file retenue en base

- Statut : accepté (2026-09-24)
- CA : CA9, CA10

## Contexte
Notifications : seuils 5k/10k/15k (soi et amis si partagé), encouragements, demandes d'amitié. Les heures silencieuses (heure locale du destinataire) doivent retenir les notifications non urgentes. Aucune file de messages sans besoin chiffré.

## Décision
- **Transport** : interface `PushTransport.send(device, notification)`. `ApnsTransport` (HTTP/2, jeton JWT ES256 `.p8`, bibliothèque maintenue type `apns2` ou `node:http2` + `jose`, choix du backend après vérification) ; `ConsoleTransport` (dev/test) journalise et garde une boîte d'envoi en mémoire inspectable par les tests. Sélection par `PUSH_TRANSPORT=apns|console`. Pas de service Expo Push (un sous-traitant de moins) : le mobile envoie le jeton APNs natif.
- **Point d'entrée unique** `notify(recipientId, type, payload)` dans le module `notifications` de l'API ; aucun autre code n'appelle le transport. Il applique dans l'ordre :
  1. préférence du destinataire pour ce type (sinon abandon) et absence de blocage entre acteur et destinataire ;
  2. `isQuietTime(now, tz, quietHours)` (fonction pure, gère la plage qui chevauche minuit) : si vrai et type non urgent (V1 : tous), insertion dans `pending_notifications` avec `deliver_after` = fin de la plage et `expires_at` = +24 h ; sinon envoi immédiat.
- **Vidage** : `flushDueNotifications(now)` envoie les lignes dues (`SELECT … FOR UPDATE SKIP LOCKED`), supprime les expirées, et ne garde qu'une notification par (destinataire, type, acteur). Appelé par un `setInterval` de 60 s dans le processus API (désactivé si `APP_ENV=test`), et directement par les tests avec une horloge injectée.
- **Seuils** : à l'upsert du jour courant local seulement, seuils franchis = `prev < s ≤ new` et absents de `milestone_events` (clé unique `(user_id, date, threshold)`) ; seul le plus haut franchi est notifié. Rattrapage historique : aucune notification.
- **Jetons invalides** (APNs 410 / `BadDeviceToken`) : suppression de l'appareil.

## Conséquences
- CA10 testable en unitaire (`isQuietTime`) et en intégration (horloge injectée + `ConsoleTransport`).
- Le `setInterval` suppose une instance unique ou `SKIP LOCKED` (déjà prévu) : sûr en multi-instance.
- Textes des notifications générés côté API en français ; la charge `footer` suit `PushPayloadSchema`.
