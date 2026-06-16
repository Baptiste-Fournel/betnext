# BetNext — Front (Next.js)

Client MINCE de l'API BetNext : **aucune logique métier** (elle reste dans le back), **type-safe**
contre le contrat OpenAPI du back (client GÉNÉRÉ, jamais écrit à la main).

## Démarrer

```bash
# 1) Démarrer le back (à la racine du repo)
npm start                       # API sur http://localhost:3000 (Swagger UI : /docs)

# 2) Démarrer le front
cd web
cp .env.example .env.local      # NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
npm install
npm run dev                     # http://localhost:3001  → écran "Connexion à l'API" (GET /health)
```

## Contrat typé (reproductible)

Le client est généré depuis l'OpenAPI du back, **pas écrit à la main** :

```bash
# À la racine : régénère le spec ET les types du front
npm run api:contract            # = openapi:generate (spec) + api:types (types front)

# Ou côté front uniquement (depuis le spec partagé) :
cd web && npm run generate:api  # packages/api-contract/openapi.json → src/lib/api/schema.d.ts
```

- Contrat partagé : `packages/api-contract/openapi.json` (source de vérité, émise par le back).
- Types générés : `web/src/lib/api/schema.d.ts` (jamais édités à la main).
- Client : `web/src/lib/api/client.ts` (`openapi-fetch`, type-safe contre `schema.d.ts`).

## Frontières (monorepo)

Le front n'importe QUE le contrat généré (`schema.d.ts`) — jamais le code interne du back.
