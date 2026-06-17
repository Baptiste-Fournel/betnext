# BetNext — Front (monorepo Next.js)

Deux apps Next.js **séparées par rôle**, partageant le **contrat OpenAPI généré** et des **composants
communs**. Clients MINCES : **aucune logique métier** (elle reste dans le back), **type-safe** contre
le contrat du back (types GÉNÉRÉS, jamais écrits à la main).

```
web/                              workspace npm (@betnext/frontend)
├─ apps/
│  ├─ player/   @betnext/web-player   rôle PLAYER   → http://localhost:3001
│  └─ admin/    @betnext/web-admin    rôle MANAGER  → http://localhost:3002
└─ packages/
   ├─ ui/            @betnext/ui            primitives shadcn/ui, auth, client API typé,
   │                                        coquille de rôle <AppShell>, panneau d'historique
   └─ api-contract/  @betnext/api-contract  types GÉNÉRÉS depuis l'OpenAPI du back (source unique)
```

Pourquoi deux apps ? Séparation nette des parcours (joueur vs gestionnaire), surfaces déployables
indépendamment, et **scoping par rôle** côté front — l'autorité restant 100 % serveur (BET-20).

## Démarrer

```bash
# 1) Back (à la racine du repo) — fournit l'API sur http://localhost:3000 (Swagger : /docs)
npm start

# 2) Front (un seul install pour tout le workspace)
cd web
npm install

# Copier les exemples d'env (aucun secret : seulement des URLs publiques NEXT_PUBLIC_*)
cp apps/player/.env.example apps/player/.env.local
cp apps/admin/.env.example  apps/admin/.env.local

npm run dev:player     # app joueur  → http://localhost:3001  (login demo-player / changeme123)
npm run dev:admin      # app admin   → http://localhost:3002  (login demo-manager / changeme123)
```

## Contrat typé (reproductible, zéro type écrit à la main)

```bash
# À la racine du repo : régénère le spec (depuis le back) ET les types du front
npm run api:contract            # = openapi:generate (spec) + api:types (types front)

# Côté front uniquement (depuis le spec partagé déjà émis) :
cd web && npm run generate:api  # → packages/api-contract/src/schema.d.ts
```

- **Source de vérité** : `packages/api-contract/openapi.json` (racine, émise par le back).
- **Types générés** : `web/packages/api-contract/src/schema.d.ts` (jamais édités à la main).
- **Client** : `web/packages/ui/src/lib/api/client.ts` (`openapi-fetch`, typé contre `@betnext/api-contract`).
- Une garde de compilation (`contract.guard.ts`) casse le `typecheck` si la type-safety régresse.

## Vérifier

```bash
cd web
npm install
npm run generate:api     # régénère les types depuis le contrat (pas de drift)
npm run typecheck        # tsc --noEmit sur les 2 apps + les 2 packages
npm run lint             # next lint sur les 2 apps
npm run build            # next build des 2 apps
```

## Frontières (monorepo)

- Le front n'importe QUE le contrat généré — jamais le code interne du back.
- Les apps n'importent le commun QUE via `@betnext/ui` / `@betnext/api-contract` (pas de chemin
  inter-app, pas de copier-coller). Le seul composant métier partagé (`HistoryPanel`) vit dans `ui`.
- Aucun secret en dur : uniquement des variables `NEXT_PUBLIC_*` (URLs publiques) via `.env`.
