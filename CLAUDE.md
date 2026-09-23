# Projet : protocole d'équipe (lu par le lead et tous les coéquipiers)

## Stack
Monorepo pnpm + Turborepo, TypeScript strict partout.

| Dossier | Contenu | Propriétaire |
|---|---|---|
| `apps/api` | Hono + Drizzle, PGlite en dev/test, PostgreSQL en prod | backend |
| `apps/mobile` | Expo (development build EAS) + Expo Router + NativeWind, iPhone uniquement | mobile |
| `packages/contracts` | Schémas Zod + types partagés : **seule source de vérité de l'API** | architect (v1), puis backend |
| `packages/ui` | Design tokens + composants partagés | designer |
| `packages/db` | Schéma Drizzle, migrations, client | backend |
| `tests/e2e` | Tests Playwright (API via `request`, pas de web) | reviewer |

Pas d’application web dans ce projet (décision utilisateur, voir `docs/brief.md`).

La carte de propriété fait foi : `.claude/ownership.json`. Un hook bloque toute écriture hors périmètre.

## Commandes
- `pnpm check` : typecheck + tests de tout le dépôt. `pnpm --filter <pkg> check` pour un seul paquet.
- `pnpm build`, `pnpm test:e2e`.
- Ajouter une dépendance : `pnpm --filter <ton-paquet> add <dep>`, jamais à la racine sauf le backend.

## Règles d'équipe (non négociables)
1. **Écrire uniquement dans son périmètre.** Pour une modification ailleurs, envoyer un message au propriétaire (SendMessage) avec le changement précis souhaité.
2. **Le contrat avant le code.** Les formats d'échange viennent de `@app/contracts` ; aucun type d'API n'est redéfini à la main. Un changement cassant du contrat passe par le lead.
3. **Tâches** :
   - sujet préfixé par le propriétaire (`[backend] …`) ;
   - passer la tâche en `in_progress` en la commençant ;
   - la marquer `completed` seulement quand `pnpm --filter <tes-paquets> check` est vert ; le hook `TaskCompleted` le vérifie et refuse sinon ;
   - ensuite, prendre la prochaine tâche non bloquée à son nom.
4. **Git** : **seul le lead commit.** Les coéquipiers ne lancent ni `git commit`, ni `git checkout`, ni `git stash`, ni `git reset`.
5. **Pas de serveurs longs.** Aucun `pnpm dev` ni serveur laissé tourner. On vérifie avec `build`, les tests et le `webServer` de Playwright. Port fixe : API 4000.
6. **Secrets** : uniquement dans `.env` (non commité). Documenter chaque variable dans `.env.example`.
7. **Blocage** : prévenir le lead au bout de 2 tentatives infructueuses. Ne jamais contourner en silence (test désactivé, `any`, `@ts-ignore`, mock de production).
8. **Communication brève** : messages factuels, en français. Compte rendu de fin de tâche en 5 lignes maximum : fait, fichiers, tests, points ouverts.

## Documents de référence
`docs/brief.md` (besoin, lead) · `docs/architecture.md` et `docs/adr/` (architect) · `docs/design/DESIGN.md` (directives de l'utilisateur, prioritaires) · `docs/design/screens.md` (designer) · `docs/review.md` (reviewer).
