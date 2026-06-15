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

## API HTTP (BET-11)

Lancer l'API en local :

```bash
npm install      # 1re fois
npm run build
npm start        # http://localhost:3000
```

Endpoints :

```bash
# Santé
curl http://localhost:3000/health
# → {"status":"ok","service":"betnext","timestamp":"..."}

# Poser un pari (commande via CQRS) → 201
curl -X POST http://localhost:3000/bets \
  -H "Content-Type: application/json" \
  -d '{"userId":"u1","outcomeId":"o1","stake":20}'
# → {"betId":"...","lockedOdds":2,"potentialGain":40}

# Forme invalide (champ manquant / type) → 400
# Mise <= 0 (invariant métier, levé par le domaine) → 422
```

> **Valeurs par défaut de POC — NON tranchées, faciles à changer** : la cote vient d'un
> `StaticOddsProvider` figé à **2.0** (sera remplacé par le read-model alimenté par Pricing —
> ADR-006/007) ; wallet et catalogue sont des stubs en mémoire.
>
> **Limites assumées à ce stade** (tickets suivants) : pas d'atomicité réelle débit + pari
> (BET-5) ; pas de clé d'idempotence fournie par le client → un *retry HTTP* recrée un pari
> (BET-8).

## Persistance (BET-6)

Le pari est persisté avec sa **cote figée** et son **gain potentiel** (stockés, jamais
recalculés à la lecture) ; chaque transition alimente un **journal d'événements append-only**
(Event Sourcing ciblé sur le seul agrégat `Bet` — audit / rejeu).

Deux modes, pilotés par `DATABASE_URL` :

```bash
# Mode Postgres (migrations jouées au démarrage)
cp .env.example .env          # renseigner DATABASE_URL
npm run db:up                 # docker compose : Postgres
npm run build && npm start

# Mode sans DB (POC rapide) — DATABASE_URL vide → adapter en mémoire
npm start
```

- Adapter derrière un **port hexagonal** (`BetRepository`) : aucune fuite TypeORM dans le
  domaine ni les use cases.
- `bet_events` **append-only** : garanti au niveau base par un trigger (migration) et au niveau
  adapter par des insertions uniquement.
- **Couture BET-5** prête : `UnitOfWork` + `TransactionContext` permettent d'envelopper débit
  wallet + pari + événements dans une seule transaction (non câblé dans `PlaceBet` à ce stade).

## Atomicité du chemin argent (BET-5)

Le débit du wallet, l'INSERT du pari et l'append des événements s'exécutent dans **UNE seule
transaction** (tout-ou-rien). Le wallet est débité via son **port partagé** (Shared Kernel),
jamais par accès direct à ses tables (frontière de contexte respectée, même en monolithe).

Preuve sur **vrai Postgres** (sans Docker, via `embedded-postgres`) :

```bash
npm run test:atomicity:pg
```

→ un échec en milieu de transaction roule **tout** en arrière : **solde inchangé, aucun pari,
aucun événement** (le script couvre aussi le chemin nominal et l'échec du save du pari).

> **Compromis (défi 3)** : tant que le monolithe est mono-DB, une **transaction locale** suffit.
> Dès que Wallet sera **extrait** en service, le débit devient une étape distante → bascule en
> **Saga + compensation** (recrédit sur erreur : « user paie → erreur → remboursement »).
> L'idempotence de la clé client (anti double-débit au **retry HTTP**) reste **BET-8**.

## Approche TDD

Les règles de domaine sont écrites en **test-first** et restent indépendantes du framework :
cote pari-mutuel bornée (`OddsCalculator`), cote **figée** à la pose et transitions gardées
(`Bet`), idempotence du wallet (`Wallet`), modèle générique **N-issues** (`SportEvent`).
La pyramide de tests et la stratégie complète restent à étoffer (voir CI).

## Statut

POC pédagogique. Les contextes Identity / Compliance / Game Integration et les adapters
Postgres/Redis/BullMQ sont volontairement des **stubs documentés** à ce stade ; le cœur
(pari-mutuel, cote figée, idempotence, frontières) est implémenté et testé.

**BET-11 livré** : `placeBet` exposé en HTTP via une commande CQRS (`POST /bets`) + `GET /health` ;
l'app est lançable (`npm start`) et couverte par un test e2e (santé + 201/400/422).

**BET-6 livré** : persistance Postgres (TypeORM) du snapshot `Bet` (cote + gain figés) + journal
d'événements append-only ; migrations idempotentes ; bascule en mémoire sans `DATABASE_URL`.

**BET-5 livré** : pose de pari **atomique** (débit wallet + pari + événements en une transaction,
tout-ou-rien), wallet via port partagé ; « zéro perte » prouvée sur **vrai Postgres**
(`npm run test:atomicity:pg`).
