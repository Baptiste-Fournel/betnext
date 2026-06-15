# BetNext — POC d'architecture (plateforme de paris e-sport multi-jeux)

Projet d'architecture logicielle (ESGI, 4e année). Objectif : démontrer, par un POC qui
tourne, une plateforme de paris e-sport **modulaire, scalable et multi-jeux**. Posture
d'architecte : chaque choix est justifié et chaque compromis assumé.

> Le dossier d'architecture complet (décisions, compromis, diagrammes) est dans
> [`docs/architecture/decisions.md`](docs/architecture/decisions.md) et
> [`docs/architecture/diagrams.md`](docs/architecture/diagrams.md).

## Architecture en bref

- **Monolithe modulaire NestJS « ready-to-split »** : 1 module Nest = 1 bounded context.
- **Frontières dures vérifiées au build** (`dependency-cruiser`) : un import inter-contexte
  casse la CI.
- **Hexagonal** : la couche `domain` ne dépend ni de `application`, ni de `infrastructure`,
  ni d'un framework. Les use cases dépendent de **ports** (interfaces), pas d'adapters.
- **Pricing extractible** en microservice (`src/pricing.main.ts`) : preuve du déploiement
  indépendant (contrainte 3).
- **Sécurité de l'argent** : chemin de pari atomique (une transaction), idempotence des
  consommateurs, compensations sans double-crédit (voir ADR-003/004/008).

## Structure

```
src/
  shared-kernel/domain/        Odds (VO), DomainEvent — partagés entre contextes
  contexts/
    pricing/    domain (OddsCalculator pari-mutuel) | pricing.module (extractible)
    betting/    domain (Bet, états) | application (PlaceBet + ports) | infrastructure (adapters)
    wallet/     domain (Wallet idempotent)
    catalog/    domain (SportEvent N-issues, Outcome)
  app.module.ts                composition du monolithe
  main.ts                      bootstrap monolithe
  pricing.main.ts              bootstrap du service Pricing extrait
docs/architecture/             dossier d'architecture (ADR + diagrammes)
livrables/                     livrables finaux (export)
```

## Prérequis

Node.js ≥ 20, npm.

## Commandes

```bash
npm ci                 # installe les dépendances (CI) ; en local : npm install
npm test               # tests unitaires (TDD) — domaine pur, sans framework ni I/O
npm run boundaries     # vérifie les frontières inter-contextes (ready-to-split)
npm run lint           # ESLint
npm run format:check   # Prettier (vérification)
npm run build          # compilation TypeScript
npm start              # démarre le monolithe (port 3000)
npm run start:pricing  # démarre le service Pricing extrait (TCP 3001)
```

## Approche TDD

Les règles de domaine sont écrites en **test-first** et restent indépendantes du framework :
cote pari-mutuel bornée (`OddsCalculator`), cote **figée** à la pose et transitions gardées
(`Bet`), idempotence du wallet (`Wallet`), modèle générique **N-issues** (`SportEvent`).
La pyramide de tests et la stratégie complète restent à étoffer (voir CI).

## Statut

POC pédagogique. Les contextes Identity / Compliance / Game Integration et les adapters
Postgres/Redis/BullMQ sont volontairement des **stubs documentés** à ce stade ; le cœur
(pari-mutuel, cote figée, idempotence, frontières) est implémenté et testé.
