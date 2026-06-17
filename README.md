# BetNext — POC d'architecture (plateforme de paris e-sport multi-jeux)

Projet d'architecture logicielle (ESGI, 4e année). Objectif : démontrer, par un POC qui
tourne, une plateforme de paris e-sport **modulaire, scalable et multi-jeux**. Posture
d'architecte : chaque choix est justifié et chaque compromis assumé.

> Le dossier d'architecture complet (décisions, compromis, diagrammes, modèle de données) est dans
> [`docs/architecture/decisions.md`](docs/architecture/decisions.md),
> [`docs/architecture/diagrams.md`](docs/architecture/diagrams.md),
> [`docs/architecture/data-model.md`](docs/architecture/data-model.md) (tables + choix de conception) et
> [`livrables/analyse-microservices.md`](livrables/analyse-microservices.md)
> (validation « ready-to-split » : topologie cible + ordre d'extraction, BET-24).

## Architecture en bref

- **Monolithe modulaire NestJS « ready-to-split »** : 1 module Nest = 1 bounded context.
  **7 contextes** dans `src/contexts/` (`identity`, `wallet`, `compliance`, `catalog`,
  `betting`, `pricing`, `game-integration`) + un **Shared Kernel** (`src/shared-kernel/`,
  types purs + **ports** inter-contextes).
- **Frontières dures vérifiées au build** (`dependency-cruiser`, 5 règles) : un import inter-contexte
  casse la CI (`npm run boundaries` → *0 violation* sur 249 modules, BET-26).
- **Hexagonal** : la couche `domain` ne dépend ni de `application`, ni de `infrastructure`,
  ni d'un framework. Les use cases dépendent de **ports** (interfaces), pas d'adapters.
  Coutures inter-contextes via ports du Shared Kernel : `WalletDebitPort`/`WalletCreditPort`,
  `StakeGuardPort`, `MarketCreationPort`, `MarketSettlementPort`, `TokenVerifierPort`.
- **Pricing extrait** en service séparé (`src/pricing.main.ts`) qui communique **uniquement par
  le bus** (BullMQ/Redis) — jamais d'appel in-process : preuve du déploiement indépendant
  (contrainte 3) et de la cote **asynchrone** (BET-8).
- **Authentification + RBAC** (BET-20) : login JWT, rôles `PLAYER`/`MANAGER`, scoping
  anti-IDOR (un joueur ne lit que ses propres paris). L'autorité est 100 % serveur.
- **Game Integration** (BET-30) : **feed des matchs LoL pro à venir** (API LoL Esports derrière
  un **ACL** `EsportsScheduleProvider` + repli **fixtures**, timeout/retry) ingérés en marchés
  bettables via `MarketCreationPort`. Cotes = notre pricing. Résolution **manuelle** (BET-12).
- **Sécurité de l'argent** : chemin de pari atomique (une transaction), idempotence des
  consommateurs, ledger signé + réconciliation, compensations sans double-crédit
  (voir ADR-003/004/008/013).
- **Deux fronts Next.js** (BET-22, BET-27) : `web/apps/player` (:3001) et `web/apps/admin`
  (:3002), clients minces type-safe sur le contrat OpenAPI généré.

## Structure

```
src/
  shared-kernel/               Odds, DomainEvent, idempotence + ports inter-contextes
  contexts/
    identity/         auth JWT, RBAC, vérification de token (BET-20)
    wallet/           Wallet idempotent, ledger signé, réconciliation
    compliance/       plafond quotidien (Responsible Gaming)
    catalog/          SportEvent N-issues générique, création de marché
    betting/          domain (Bet, états) | application (PlaceBet, settlement, stats + ports) | infra
    pricing/          domain (OddsCalculator pari-mutuel) | pricing.module (extractible)
    game-integration/ feed matchs LoL pro à venir : ACL EsportsScheduleProvider + repli fixtures + ingestion (BET-30)
  read-model/                  read-model Redis des cotes + SSE
  messaging/                   Transactional Outbox + BullMQ + idempotence consommateur
  persistence/                 TypeORM / migrations (Postgres)
  app.module.ts                composition du monolithe
  main.ts                      bootstrap monolithe
  pricing.main.ts              bootstrap du service Pricing extrait
docs/architecture/             dossier d'architecture (ADR + diagrammes + analyse microservices)
web/                           monorepo front (apps/player :3001, apps/admin :3002)
livrables/                     livrables finaux (export)
```

## Prérequis

Node.js ≥ 20, npm.

## Commandes

```bash
npm ci                 # installe les dépendances (CI) ; en local : npm install
npm test               # tests unitaires (TDD) — domaine pur, sans framework ni I/O
npm run boundaries     # vérifie les frontières inter-contextes (5 règles ; ready-to-split)
npm run test:naming    # convention de nommage des tests (shouldXxx_WhenXxx — BET-26)
npm run lint           # ESLint
npm run format:check   # Prettier (vérification)
npm run build          # compilation TypeScript

# Démarrage du back (Postgres + AUTH_SECRET REQUIS depuis BET-19/20). main.ts ne charge pas
# .env lui-même → on le passe à Node (≥ 20.6) :
npm run db:up                              # docker compose : Postgres
cp .env.example .env                       # renseigner DATABASE_URL + AUTH_SECRET
npm run build && npm run db:seed           # migrations + données de démo (users, marchés)
node --env-file=.env dist/main.js          # monolithe sur :3000 (Swagger /docs) + relais Outbox si REDIS_URL
node --env-file=.env dist/pricing.main.js  # service Pricing extrait (bus-only ; exige REDIS_URL)

# Fronts (deux apps Next.js) — voir web/README.md
cd web && npm install
npm run dev:player     # http://localhost:3001 (login demo-player / changeme123)
npm run dev:admin      # http://localhost:3002 (login demo-manager / changeme123)

# Preuves money-safety & async sur infra réelle (CI)
npm run test:atomicity:pg        # zéro perte : débit + pari + events + outbox en 1 tx (18 cas)
npm run test:reconciliation:pg   # ledger signé Σ=solde, dérive injectée détectée (BET-15)
npm run test:bootstrap:pg        # schéma vierge → app fonctionnelle + seed (BET-19/29)
npm run test:pricing:redis       # Pricing bus-only : outbox→relais→bus→OddsUpdated
npm run test:readmodel:redis     # read-model : OddsUpdated→projecteur→lecture
```

## Lancer la démo — toute la stack en une commande (BET-9)

Le multi-process (back + worker + 2 fronts + infra) est fragile à lancer à la main pour une
soutenance. `scripts/demo-up.sh` monte **tout** de façon fiable (health-checks, détaché, logs +
PID sous `.demo/`), et `scripts/demo-down.sh` arrête **proprement et par cible** (PID puis port —
jamais de `pkill` large).

```bash
npm run demo:up        # infra (PG+Redis) → build → migrations+seed → back :3000 → worker → fronts
                       #   joueur :3001 · admin :3002 · API :3000 (Swagger /docs)
                       #   + ingère le feed et pré-règle un pari (stats non vides) — idempotent
npm run demo:down      # stoppe back + worker + fronts (laisse PG/Redis up). DOWN_INFRA=1 pour tout couper.
npm run demo:reset     # table rase + seed reproductible (à lancer juste avant la soutenance)
```

Comptes (mot de passe `changeme123`) : **`demo-player`** (PLAYER) et **`demo-manager`** (MANAGER).

**Scheduler auto (BET-33).** En mode live, le rafraîchissement auto du feed suit `.env`
(`ESPORTS_SCHEDULER_ENABLED`) : l'app reste « vivante » (ré-ingestion + synchro résultats
périodiques) sans clic.

**Mode Stripe (BET-17).** Sans `STRIPE_SECRET_KEY` → **PSP stub** déterministe (le dépôt crédite
directement, démo hors-ligne). Avec une clé `sk_test_…` → **Stripe réel (mode test)**, durci par
circuit breaker + timeout/retry. Idem feed esports : sans `ESPORTS_API_BASE_URL`, **fixtures**
déterministes (un match déjà terminé pour prouver le règlement auto).

**Variantes / instance isolée** (smoke, captures — ne touche ni `:3000` ni l'infra live) :

```bash
DEMO_ISOLATED=1 PG_PORT=55440 scripts/demo-up.sh     # ports 3300/3301/3302, PG dédié, sans Redis,
                                                     #   creds externes neutralisés (100 % hors-ligne)
DEMO_ISOLATED=1 PG_PORT=55440 DOWN_INFRA=1 PURGE_VOLUME=1 scripts/demo-down.sh
```

**Filet de secours.** Captures de secours des parcours clés dans
[`livrables/captures-demo/`](livrables/captures-demo/README.md) ; runbook + tests e2e dans
[`livrables/demo-soutenance.md`](livrables/demo-soutenance.md).

## API HTTP (BET-11, BET-20)

Lancer l'API en local : voir le bloc **Commandes** ci-dessus (Postgres + `AUTH_SECRET`
requis ; `node --env-file=.env dist/main.js`). Swagger sur `/docs`.

Depuis BET-20, les routes métier exigent un **token Bearer** (rôle `PLAYER` ou `MANAGER`).
On l'obtient via `/auth` :

```bash
# Santé (public)
curl http://localhost:3000/health
# → {"status":"ok","service":"betnext","timestamp":"..."}

# S'authentifier → renvoie un token JWT (champ `token`)
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo-player","password":"changeme123"}'
# → {"userId":"demo-player","role":"PLAYER","token":"eyJ…","expiresInSec":3600}

# Poser un pari (commande via CQRS) → 201. Idempotency-Key OBLIGATOIRE ; userId pris du token
# (jamais du corps → anti-usurpation).
curl -X POST http://localhost:3000/bets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJ…" \
  -H "Idempotency-Key: 3f9c-…" \
  -d '{"outcomeId":"o1","stake":20}'
# → {"betId":"...","lockedOdds":2,"potentialGain":40,"pricingProvisional":true}

# Sans token → 401 ; mauvais rôle (PLAYER sur route MANAGER) → 403
# Header Idempotency-Key absent → 400 ; forme invalide → 400 ; mise <= 0 → 422
# Même clé + même corps → MÊME betId ; même clé + corps différent → 409 ; concurrent non fini → 425
```

**Carte des endpoints** (routes métier sous Bearer ; *(M)* = rôle MANAGER requis) :

| Route | Rôle | Contexte |
|-------|------|----------|
| `POST /auth/register`, `POST /auth/login`, `GET /auth/me` | public / token | Identity |
| `GET /markets`, `GET /odds/:id`, `GET /streams/odds` (SSE) | public | Catalog / read-model |
| `POST /markets` *(M)*, `POST /markets/settle` *(M)* | MANAGER | Catalog / Betting |
| `POST /bets`, `GET /bets`, `GET /bets/:id`, `GET /bets/:id/events` | PLAYER (scopé) | Betting |
| `GET /bets/stats` | PLAYER (scopé) | Betting (read-model, BET-23) |
| `GET`/`PUT /responsible-gaming/daily-cap` | token | Compliance |
| `POST /wallet/open` *(M)*, `GET /admin/reconciliation` *(M)* | MANAGER | Wallet |
| `POST /wallet/deposit` (header `Idempotency-Key`), `GET /wallet/balance` | PLAYER (scopé) | Wallet (Stripe, BET-17) |
| `GET /game-integration/upcoming` | public | Game Integration (BET-30) |
| `POST /game-integration/esports/ingest` *(M)* | MANAGER | Game Integration (BET-30) |
| `POST /game-integration/esports/sync-results` *(M)* | MANAGER | Game Integration (BET-32) |

> La cote affichée et la cote figée au pari proviennent désormais d'une **source unique** :
> le read-model Redis (alimenté par Pricing), et la **cote d'ouverture** partagée
> (`shared-kernel`, valeur `2.0`) quand le marché n'a encore aucun volume — voir
> *Cotes d'ouverture (BET-28)* plus bas. Le wallet est **fictif par défaut** (solde incrémenté) ;
> le **dépôt par Stripe** (saga + compensation) est désormais implémenté en option (BET-17, voir
> *Dépôt de fonds* plus bas) — stub déterministe sans clé, adapter réel mode test avec `STRIPE_SECRET_KEY`.

## Persistance (BET-6)

Le pari est persisté avec sa **cote figée** et son **gain potentiel** (stockés, jamais
recalculés à la lecture) ; chaque transition alimente un **journal d'événements append-only**
(Event Sourcing ciblé sur le seul agrégat `Bet` — audit / rejeu).

Depuis **BET-19**, Postgres est le **store par défaut REQUIS** : `main.ts` refuse de
démarrer sans `DATABASE_URL` (et sans `AUTH_SECRET`). Les migrations sont jouées au
démarrage.

```bash
cp .env.example .env          # renseigner DATABASE_URL + AUTH_SECRET
npm run db:up                 # docker compose : Postgres
npm run build && npm run db:seed
node --env-file=.env dist/main.js
```

> L'**adapter en mémoire** existe toujours (sélectionné quand aucun `DataSource` n'est
> fourni) mais il est désormais **réservé aux tests** (e2e in-memory, scripts) — ce n'est
> plus un mode de lancement du monolithe.

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

## Idempotence HTTP (BET-18)

`POST /bets` exige un header **`Idempotency-Key`** (absent → 400). La clé + un **hash du corps**
sont réservés *atomiquement* (`INSERT … ON CONFLICT DO NOTHING`) **dans la même transaction** que
le pari (UoW réentrant) : réservation → débit + pari + events + outbox → enregistrement du résultat.

- **Même clé + même corps** → renvoie le **même `betId`** (réponse rejouée, ex. *réponse perdue*) ;
  **aucun 2e pari ni débit**.
- **Même clé + corps différent** → **409** (conflit, jamais un faux succès silencieux).
- **En concurrence**, le perdant **bloque** sur l'insert non commité du gagnant puis lit le résultat
  → **un seul pari** (garde-fou contrainte d'unicité).
- **Tentative échouée** → la clé est **libérée** (`release`) → un *retry corrigé* n'est jamais
  bloqué par un faux 409 (sur Postgres le rollback l'annule ; `release` couvre le mode sans tx).
- Distinct de l'idempotence **consommateur** (BET-7, dé-doublonnage d'events) : ici c'est
  l'idempotence d'**écriture côté API**.

Preuve sur **vrai Postgres** (`npm run test:atomicity:pg`, cas 9→12) : retry même clé → 1 pari/1
débit ; concurrent → 1 pari ; corps différent → conflit ; **retry après échec → clé non brûlée**.

> **Repoussé (tracé)** : pas de **TTL/purge** des clés (`createdAt` présent, table append-only qui
> croît) → tâche d'exploitation ultérieure, hors périmètre POC.

## Service Pricing extrait — cote asynchrone (BET-8)

Preuve concrète du **déploiement indépendant** (contrainte 3) et de la **cote asynchrone**. Pricing
ne communique que par le **bus** : aucun appel in-process, aucun import de Betting (frontière
`dependency-cruiser`). La cote sort donc du chemin d'écriture du pari.

```
Betting  --BetPlaced(outbox)-->  OutboxDispatcher (relais câblé au boot)
         --bus betnext.domain-events-->  Service Pricing (process séparé)
              recalcul pari-mutuel (état Redis partagé)  --bus betnext.odds-->  OddsUpdated
```

- **Relais câblé au boot** (`OutboxDispatcher`, comble le trou de BET-7) : tant que l'app tourne,
  l'outbox se **vide réellement** vers le bus (poll, at-least-once, actif si `DATABASE_URL` + `REDIS_URL`).
- **Pricing = process séparé** (`npm run start:pricing`) : consomme `BetPlaced`, maintient ses
  totaux, publie `OddsUpdated`. **Scale-out** : l'état vit dans **Redis partagé** (`PricingStore`)
  → cote correcte même à N répliques + durable au redémarrage.
- **Consommateur idempotent** : une re-livraison at-least-once n'incrémente pas deux fois (`markProcessed`).
- **Résilience** : **Pricing down → `placeBet` réussit** (la cote du pari est **figée** à la pose,
  jamais modifiée par un `OddsUpdated` ultérieur).

Preuves : e2e **en mémoire** (jest, sans Redis) pour la boucle `BetPlaced → recalcul → OddsUpdated`
+ « Pricing down » ; e2e **vrai Redis** en CI (`npm run test:pricing:redis`) pour la chaîne complète
`outbox → OutboxDispatcher → bus → Pricing → OddsUpdated` + idempotence en double-livraison.

## Read-model Redis — lecture de la cote (BET-10)

Ferme le côté **LECTURE** du CQRS. La cote courante n'est plus servie par le `StaticOddsProvider`
ni par la base d'écriture : elle vient d'un **read-model Redis** alimenté par `OddsUpdated`.

```
OddsUpdated (bus odds) → OddsProjectorService (worker FIFO câblé au boot) → read-model Redis (hash)
GET /odds/:id  → read-model (404 si froid)        PlaceBet → read-model (cote FIGÉE à la pose)
GET /bets/:id  → Postgres (read-your-writes)
```

- **Cote courante** : `GET /odds/:id` lit le read-model, jamais Postgres. Cold cache → **404
  explicite** (cohérence éventuelle observable). Au placement, cold → cote d'ouverture signalée
  `pricingProvisional: true` dans la réponse (la latence reste visible côté client).
- **Read-your-writes** : `GET /bets/:id` lit Postgres (store autoritatif) → le pari posé est visible
  immédiatement ; cote **figée** du snapshot, jamais recalculée.
- **Cote figée préservée** : une MAJ du read-model ne change pas un pari déjà posé (prouvé e2e).
- **Anti out-of-order** : projecteur FIFO (`concurrency: 1`) + **garde monotone** `occurredAt` → un
  snapshot plus ancien n'écrase pas une cote plus récente (jamais durablement fausse).

Preuves : e2e en mémoire (cold→404, read-your-writes, cote figée vs MAJ, `pricingProvisional`) +
garde monotone (unitaire) + **vrai Redis** en CI (`npm run test:readmodel:redis` : OddsUpdated →
projecteur → read-model → lecture, + out-of-order).

> **Repoussé (tracé)** : atomicité multi-réplique du read-model (compare-and-set Lua) inutile au POC
> mono-instance ; périmètre/ownership de lecture (auth) quand Identity sera implémenté.

## Règlement (settlement) — fermer la boucle poser → résoudre → payer (BET-12)

À la clôture d'un marché (`POST /markets/settle`), chaque pari en attente est résolu W/L/V via une
**SettlementStrategy** (Strategy + Factory — ADR-009) : `WinningOutcomeStrategy` est la 1re vraie
stratégie enregistrée ; **ajouter un type** de pari = un nouveau fichier de stratégie + 1
enregistrement, **zéro réécriture** du règlement.

```bash
curl -X POST http://localhost:3000/markets/settle \
  -H "Content-Type: application/json" \
  -d '{"outcomes":["A","B","draw"],"winningOutcomeId":"A"}'   # ou {"outcomes":[...],"voided":true}
# → {"settled":N,"won":..,"lost":..,"voided":..,"failed":..,"failedBetIds":[]}
```

Garanties money (mêmes que le débit) :

- **Atomique par pari** : marquer + append event immuable (`BetWon`/`BetLost`/`BetVoided`) + créditer
  dans **une transaction** ; un échec roule **tout** ce pari en arrière (reste `PENDING`, non crédité).
- **Résilient** : l'échec d'un pari ne bloque pas les autres (par pari, pas de head-of-line blocking) ;
  `failedBetIds` permet un rejeu ciblé.
- **Exactement-une-fois** : crédit idempotent par `opKey` (garde-fou `wallet_operations`) **+** index
  unique partiel `bet_events(betId)` sur les events terminaux → **rejeu/concurrence ⇒ 1 seul event,
  1 seul crédit**.
- **Annulation** = remboursement **exact** de la mise.

**Modèle de paiement (tranché, ADR-009)** : paiement à la **cote figée** (`payout = potentialGain`
stocké), cohérent avec le gel de la cote à la pose. P&L **fixed-odds** assumé, **borné** par le clamp
des cotes `[1.10, 5.00]` → liability max = mise × 5. Le pari-mutuel de Pricing fixe la cote *offerte* ;
une fois figée, le paiement est fixe → la maison porte le risque entre deux mises.

Preuves : e2e in-memory (WON/LOST/VOID, rejeu idempotent, 400) + unitaires (stratégie, factory, use
case) + **vrai Postgres** (`npm run test:atomicity:pg`, cas 13→16) : crédit exactement-une-fois
(rejeu = même solde), event `BetWon` journalisé, remboursement exact, atomique+résilient, **et
règlement concurrent → 1 seul event**.

> **Hypothèse non validée (signalée)** : le résultat est publié par le **gestionnaire** via
> `POST /markets/settle` ; l'alternative est un **event Game Integration** consommé sur le bus — la
> couture (`SettleMarket`) reste identique, seul l'adapter d'entrée changerait.

## Plafond quotidien — jeu responsable (BET-13)

Le contexte **Responsible Gaming** possède le plafond quotidien de mise. Le joueur le définit, et à
chaque pose un pari qui ferait dépasser le **total misé du jour** est refusé (**403**).

```bash
curl -X PUT http://localhost:3000/responsible-gaming/daily-cap \
  -H "Content-Type: application/json" -d '{"userId":"u1","cap":50}'   # → {"userId":"u1","dailyCap":50}
```

- **Règle externalisée (Open/Closed, ADR-010)** : le plafond est une **POLICY enfichable**
  (`DailyCapPolicy`, 1re vraie règle enregistrée). Ajouter une règle (plafond hebdo, cooling-off) =
  un nouveau fichier de policy + 1 entrée dans la liste `COMPLIANCE_POLICIES` du module — le registre
  et le use case `ReserveStake` restent **inchangés**.
- **Frontière** : Betting appelle la vérification via le **port partagé** `StakeGuardPort` ; aucun
  accès direct aux tables RG (et RG ne lit pas les tables Betting).
- **Atomique / anti-course** : la réservation tourne **dans la transaction de pose**, AVANT le débit ;
  `SELECT … FOR UPDATE` sur la ligne du jour sérialise les paris concurrents → **deux paris près du
  plafond ne peuvent pas le dépasser ensemble**. Un refus roule **tout** en arrière (ni débit ni pari).
- **Idempotence** : un retry (même `Idempotency-Key`) ne compte la mise qu'**une fois**.

Preuves : unitaires (policy, `ReserveStake`) + e2e in-memory (403 au-delà, cap ≤ 0 → 422, sans cap →
illimité) + **vrai Postgres** (`npm run test:atomicity:pg`, cas 17-18) : 2 paris concurrents près du
plafond → seul le total autorisé passe ; retry même clé → mise comptée une fois.

> **Hypothèses / limites (signalées)** : le « jour » = **date UTC** (reset minuit UTC), fuseau à
> trancher ; le total est **brut** — pas encore **net** des annulations/remboursements (un pari VOID
> ne libère pas le plafond ; nécessiterait que le règlement appelle un *release* RG → suivi séparé).

## Front (monorepo Next.js) — BET-14, BET-22 (épic)

**Monorepo front** (workspaces npm) dans `web/` : **deux apps Next.js séparées par rôle** —
`apps/player` (rôle PLAYER, :3001) et `apps/admin` (rôle MANAGER, :3002) — partageant le contrat
OpenAPI généré (`packages/api-contract`) et les composants communs (`packages/ui` : primitives
shadcn/ui, auth, client typé, coquille de rôle `<AppShell>`). App Router, TS strict, Tailwind. Ce sont
des **clients MINCES** : aucune logique métier (elle reste dans le domaine back). Détails : `web/README.md`.

**Client API typé GÉNÉRÉ** (jamais écrit à la main), pipeline reproductible :

```bash
npm run api:contract   # (racine) back → packages/api-contract/openapi.json → web/packages/api-contract/src/schema.d.ts
cd web && npm install
npm run dev:player     # http://localhost:3001   |   npm run dev:admin  # http://localhost:3002
```

- Contrat partagé : `packages/api-contract/openapi.json` (émis par le back via `@nestjs/swagger` ;
  Swagger UI sur `/docs`).
- Types : `web/packages/api-contract/src/schema.d.ts` (`openapi-typescript`) ; client `openapi-fetch`
  type-safe (`web/packages/ui/src/lib/api/client.ts`). Une **garde compile-time** (`contract.guard.ts`,
  vérifiée par le job CI `web-build`) prouve qu'un chemin hors-contrat est **rejeté à la compilation**.
- **Scoping par rôle** : chaque app guarde son rôle via `<AppShell>` (UX) ; l'**autorité reste 100 %
  serveur** (token BET-20 — un player qui forcerait l'app admin n'obtient que des 403 du back).
- **Frontière** : le front n'importe QUE le contrat généré, jamais le code interne du back ; les apps
  ne partagent QUE via `@betnext/ui` / `@betnext/api-contract` (zéro copier-coller inter-app).

**Incrément 1** — écran connecté : appelle `GET /health` (URL API via `NEXT_PUBLIC_API_BASE_URL`).

**Incrément 2** — 1er parcours joueur (poser un pari) : liste les marchés (`GET /markets`, 3 issues)
et leur cote courante (`GET /odds/:id`, « indisponible » si read-model froid) ; pose un pari
(`POST /bets`) avec un header **`Idempotency-Key`** généré par tentative et **réutilisé au retry**
(anti double-débit) ; **affiche** la cote FIGÉE et le gain renvoyés par l'API (jamais recalculés) +
un badge « cote d'ouverture » quand `pricingProvisional`. Endpoints `/markets`, `/odds/:id`,
`POST /bets` désormais **annotés** (DTO Swagger) → typés dans le contrat (plus de `never`).

**Incrément 3** — cotes en **direct (SSE)** : `GET /streams/odds` (NestJS `@Sse()`) STREAME les
`OddsUpdated` **réels** (projecteur → flux in-process `OddsStream`, **pas de polling**) ; le front
(`EventSource`) fait **bouger les cotes** de la liste en direct, gère la reconnexion + le read-model
froid, et ferme le flux au démontage (cleanup). **Contraste cote-figée** : un pari posé garde sa cote
(`lockedOdds`) affichée **à côté** de la cote live du marché (qui bouge). Payload SSE **typé**
(`OddsLiveEventDto`, généré dans le contrat ; réponse `text/event-stream` — OpenAPI n'exprimant pas
le SSE nativement). Désabonnement par client géré par Nest ; flux complété au shutdown.

**Incrément 4** — historique &amp; plafond : **historique** des paris (`GET /bets`) avec leur
**timeline d'états** (`GET /bets/:id/events`, posé → gagné/perdu/annulé) lue depuis le **journal
d'événements** du back (Event Sourcing **visible** ; le front affiche, ne reconstruit pas) ;
**plafond quotidien** consulté/défini (`GET`/`PUT /responsible-gaming/daily-cap`) ; le **403** de
dépassement (BET-13) est mappé en feedback **clair** dans la pose. DTO de ces routes annotés (plus
de `never`). **Dette tracée** : sans Identity, la liste `/bets` n'est **pas scopée** par joueur (le
front ne simule pas d'auth).

**Incrément 5** — parcours **gestionnaire** (vue `/manager`, distincte du joueur) : **créer un marché**
**générique N-issues** (`POST /markets` — événement + N libellés d'issues, ≥ 2 ; le back valide et
assigne les ids) ; **régler** un marché (`POST /markets/settle` annoté) en choisissant l'issue gagnante
ou l'annulation → le back résout les paris (BET-12 : W/L/V, gains, events). Le front **envoie
l'action**, il ne réimplémente ni le règlement ni le payout. L'historique (en bas de la vue) se
rafraîchit après règlement → **boucle posé → gagné/perdu visible à l'écran**. Endpoints `POST /markets`
et `POST /markets/settle` typés.

**Incrément 6** — **polish** (aucune nouvelle fonctionnalité) : sur chaque vue (marchés, pose,
historique, plafond, créer/régler) un état **chargement** (skeletons), **vide** (message clair) et
**erreur** (message de l'API quand il existe — sinon « Impossible de joindre l'API » — + **réessayer**),
y compris les échecs **réseau** (try/catch). **Responsive** (`flex-wrap`, paddings adaptatifs).
**A11y** : régions `aria-live` persistantes / `role="alert"`, heure d'event via `<time dateTime>`,
labels reliés (`aria-describedby`/`aria-invalid`), focus visible. Un échec de cote **ne masque plus**
le marché (dégradation par issue → « cote indisponible »).

> **Épic BET-14 : 6/6 incréments livrés.** Dette tracée (à reprendre avec Identity) : ni l'historique
> ni le rôle gestionnaire ne sont scopés/authentifiés (le front ne simule pas d'auth) ; mineurs :
> `GET /odds` par issue + timelines en N+1 (à batcher si volume) ; le message d'erreur préfixe le code
> HTTP brut (cosmétique).

## Réconciliation argent — filet « zéro perte » (BET-15)

BET-5/7/12/18 garantissent l'absence de perte sur les chemins nominaux et de retry. La réconciliation
est le **filet** qui détecte toute dérive qui aurait malgré tout échappé.

```bash
curl http://localhost:3000/admin/reconciliation
# → {"checkedAt":"…","walletsChecked":3,"balanced":true,"drifts":[]}
```

- **Source autoritaire explicite = le ledger `wallet_operations`** (et non une estimation dérivée d'un
  autre contexte). Le ledger journalise désormais **tous** les mouvements signés (ouverture `OPENING`,
  débit `DEBIT` négatif, crédit `CREDIT`), chacun écrit **dans la même transaction** que le solde →
  invariant **`Σ(amount) == balance`** à chaque commit.
- **Détection + rapport, AUCUNE auto-correction** : le job est en **lecture seule** (donc rejouable —
  idempotent, pas de double-rapport) et liste les wallets en dérive (`expected` = Σ ledger, `actual` =
  solde, `difference`). Corriger de l'argent doit être une **action revue**, pas un effet de bord.
- **Frontière respectée** : la réconciliation reste **entièrement dans le contexte Wallet** (lit
  seulement `wallets` + `wallet_operations`, une **seule requête** = instantané cohérent). Aucune
  lecture cross-contexte.
- **« En vol » ≠ dérive** : l'asynchrone (Outbox/BullMQ) ne transporte que des **événements**, jamais
  l'argent ; un Outbox non drainé n'a bougé ni le solde ni le ledger → **aucun faux positif**.
- **Alimentation** : `POST /wallet/open` ouvre un wallet en écrivant atomiquement le solde **et** son
  entrée d'ouverture (origine du ledger).

Preuves : unitaires (`ReconcileWallets`, `InmemoryWalletAdapter`, `OpenWallet`) + **vrai Postgres**
(`npm run test:reconciliation:pg`) : ouverture, cycle complet open→pari→règlement (Σ=solde), **en vol**
(Outbox non drainé → balanced), **dérive injectée** (+50 hors ledger → détectée et rapportée sans
correction), **idempotence** (rejeu = rapport identique, 0 écriture), **multi-wallets** (seul le dérivé
rapporté). Non-régression money-safety : `npm run test:atomicity:pg` (18 cas, débit désormais journalisé).

> **Limites (tracées)** : pas d'**alerting** ni de workflow de correction (action manuelle) ; ouverture
> **unique** par wallet (pas de dépôts multiples) et `POST /wallet/open` **sans auth** (comme tout le
> POC, à durcir avec Identity) ; purge de `wallet_operations` à faire **sans casser l'invariant**
> (snapshot de solde requis).

## Postgres par défaut + Catalog persistant (BET-19)

Le monolithe tourne sur **Postgres** (store autoritaire). `main.ts` **échoue vite** si
`DATABASE_URL`/`AUTH_SECRET` manquent (pas de démarrage silencieux en mémoire). Le
**Catalog** est désormais persistant (`TypeOrmMarketCatalog`), au même titre que Betting,
Wallet et Compliance. Preuve : `npm run test:bootstrap:pg` (schéma vierge → migrations
idempotentes → app fonctionnelle → seed).

## Dépôt de fonds — Saga Stripe + compensation/recrédit + Circuit Breaker (BET-17, ADR-004)

Le joueur peut **déposer des fonds** qui créditent son wallet, via une **saga orchestrée**
money-critical (`DepositFunds`, contexte Wallet) : `charge PSP → crédit wallet (atomique,
journalisé au ledger) → étape aval optionnelle`. À **tout échec après la charge**, une
**compensation idempotente** rembourse : reverse du crédit (kind `REFUND`, signé négatif) **puis**
refund PSP, **+ notification** utilisateur via Outbox. L'ordre garantit que la plateforme n'est
**jamais** à la fois remboursée *et* créditée (zéro perte) ; le refund PSP est rejouable.

- **Port hexagonal `PaymentGateway`** (charge/refund) en **types domaine** — anti-corruption :
  aucun champ Stripe (`payment_intent`, `client_secret`…) ne franchit le port. Deux adapters
  sélectionnés **par ENV** (pattern Riot/esports) :
  - **sans `STRIPE_SECRET_KEY`** → `StubPaymentGateway` (déterministe, idempotent) : démo **et CI
    sans clé**, le dépôt crédite directement.
  - **avec `STRIPE_SECRET_KEY` (`sk_test_…`)** → `StripePaymentGateway` **réel (mode test)**,
    montants convertis en cents *dans* l'adapter, clé en `Authorization` uniquement (**jamais
    loggée, jamais en URL**), enveloppé par `ResilientPaymentGateway` (**Circuit Breaker + timeout
    + retry**, module partagé `shared/resilience`).
- **Exactly-once / money-safety** : clé d'idempotence sur la charge (pas de double-charge), `opKey`
  ledger `ON CONFLICT` (pas de double-crédit ni double-reverse), compensation rejouable (pas de
  double-refund). **0 changement de schéma** : réutilise `wallet_operations` (kinds `CREDIT`/
  `REFUND`) + `outbox`. Invariant `Σ(ledger) == solde` préservé → cohérent avec la réconciliation
  (BET-15).
- **API** : `POST /wallet/deposit` (header `Idempotency-Key`, scopé au joueur authentifié),
  `GET /wallet/balance`. **UI** joueur : panneau « Mon portefeuille » (solde + dépôt).
- **Tests** (TDD, money-path en CI) : happy path (charge→crédit, ledger correct), compensation
  (échec aval → refund/reverse idempotents + notif), idempotence (retry → pas de double-mouvement),
  circuit breaker (PSP down → fail-fast), non-fuite du format/secret Stripe.

> Vérif Stripe **réelle** = séparée : collez une clé de **test** dans `.env`
> (`STRIPE_SECRET_KEY=sk_test_…`) pour activer l'adapter réel. Aucune clé n'est committée.

## Authentification + RBAC + anti-IDOR (BET-20)

Le contexte **Identity** porte l'auth. Inscription/connexion (`/auth/register`,
`/auth/login`) émettent un **JWT** signé par `AUTH_SECRET` ; `GET /auth/me` renvoie
l'identité courante. Deux rôles : **`PLAYER`** et **`MANAGER`**.

- **Garde d'authentification** (`JwtAuthGuard`) sur toutes les routes métier ; un appel
  sans token valide → **401**.
- **Garde de rôle** (`RolesGuard` + `@Roles('MANAGER')`) sur les écritures sensibles :
  `POST /markets`, `POST /markets/settle`, `POST /wallet/open`, `GET /admin/reconciliation`,
  écritures Game Integration → un `PLAYER` obtient **403**.
- **Scoping anti-IDOR** : `userId` provient **du token**, jamais du corps ni de l'URL. La
  liste/lecture des paris (`GET /bets`, `/bets/:id`, `/bets/:id/events`, `/bets/stats`) est
  **filtrée par le joueur authentifié** — un pari non possédé renvoie **404** (pas de fuite
  d'existence). Le port partagé `TokenVerifierPort` (Shared Kernel) garde la vérification
  côté frontière.

> L'autorité reste **100 % serveur** : le scoping par rôle côté front (`<AppShell>`) n'est
> qu'une UX ; un client forgé n'obtient que des 401/403 du back.

## Game Integration — feed des matchs LoL pro à venir + résultats auto (BET-30, BET-32)

Deux sources de marchés alimentent la plateforme : (1) l'**ajout manuel** par le gestionnaire
(« Ouvrir un marché » → Catalog/`CreateMarket`) et (2) le **feed auto** des matchs LoL pro à
venir (ci-dessous). Le contexte **Game Integration** ne connaît ni Catalog ni Betting en
direct : il passe par les **ports du Shared Kernel** (`MarketCreationPort`, `MarketSettlementPort`).
La **résolution** des marchés du feed est désormais **automatique** (BET-32) : on récupère le
résultat des matchs terminés (ACL résultats LoL Esports) et on règle marchés + paris
**exactly-once** via le moteur `SyncMatchResult` → `MarketSettlementPort` → `SettleMarket`. Le
règlement **manuel** (« Régler un marché » = BET-12) reste disponible pour les marchés ouverts à
la main.

- **Feed matchs pro à venir** : `POST /game-integration/esports/ingest` *(MANAGER)* ingère les
  **gros matchs LoL pro à venir** (LEC/LCK/LPL/MSI…) en marchés bettables. Source derrière un
  **ACL** : port `EsportsScheduleProvider` + adapter API **non-officielle** LoL Esports (base
  URL + clé en **ENV**, jamais en dur ni loggée) + adapter **fixtures** (démo/mode dégradé). Le
  format externe ne fuit pas dans le domaine (`ScheduledMatch` neutre).
- **Résilience + repli** : `ResilientScheduleProvider` (timeout + retry) ; `FallbackEsportsScheduleProvider`
  bascule **automatiquement** sur les fixtures si la source live échoue et **signale** le mode
  via `source: 'live' | 'fixtures'`. L'app ne casse jamais : feed down → 0 nouveau marché,
  l'existant intact.
- **Ingestion idempotente** : `IngestUpcomingMatches` réutilise la brique `IngestMatchMarket`
  (→ `MarketCreationPort` + lien match↔marché, clé = id externe). Un re-pull ne duplique pas
  les marchés. **Cotes = notre pricing** (cote d'ouverture BET-28 + volume ; aucune cote
  externe). `GET /game-integration/upcoming` (public) sert au joueur le **badge ligue + kickoff**.
  Le lien porte le **mapping côté→issue**, consommé au règlement.
- **Résultats auto + règlement** (BET-32) : `POST /game-integration/esports/sync-results` *(MANAGER)*
  → `SyncFeedResults` parcourt les matchs ingérés, va chercher le résultat via l'**ACL résultats**
  (`EsportsResultProvider` → LoL Esports `getEventDetails` ; équipe gagnante → côté **par index**,
  ordre vérifié identique à l'ingestion → issue gagnante via le mapping du lien) et déclenche
  `SyncMatchResult` → règlement **exactly-once** (rejeu = no-op, pas de double-crédit). **Money-safety** :
  jamais de bascule live→fixtures côté résultats (on ne règle pas sur de fausses données) ; source
  down → `PENDING`, on réessaie. Résilience timeout/retry/circuit-breaker + **rate-limit léger**.
  En mode fixtures, un match **déjà terminé** (G2 vs Fnatic) prouve le règlement auto en démo.
- **Rafraîchissement auto** (BET-33) : un **scheduler léger** (`EsportsFeedScheduler`, adapter
  entrant « horloge ») rend l'app **vivante** façon Winamax — périodiquement et **sans clic**, il
  ré-ingère les matchs à venir puis synchronise les résultats. Il ne fait que **déclencher les use
  cases existants** (ingestion idempotente + règlement **exactly-once**) : **aucune logique money
  ajoutée**, pas de double-règlement. Implémenté sur le cycle de vie Nest
  (`OnApplicationBootstrap`/`OnModuleDestroy` + `setInterval`, idiome de l'`OutboxDispatcher` — **zéro
  nouvelle dépendance**). Gardes : **gate ENV** `ESPORTS_SCHEDULER_ENABLED` (**OFF par défaut → jamais
  armé en test/CI** ni sans opt-in), intervalle `ESPORTS_SCHEDULER_INTERVAL_MS` (défaut 5 min) +
  rate-limit propre à la synchro résultats, **anti-chevauchement** (un tick lent ne se superpose pas)
  et **isolation des erreurs** (feed down → run journalisé, l'app ne crashe pas, le tick suivant
  réessaie). Pas de nouvel endpoint exposé → **zéro drift de contrat**.

Voir **ADR-016**, **ADR-017** et **ADR-018**.

## Cotes d'ouverture — source unique (BET-28)

Tant qu'un marché n'a **aucun volume**, le modèle pari-mutuel ne produit pas de cote (pas de
division par zéro). La **cote d'ouverture** est alors servie depuis une **source unique
partagée** (`src/shared-kernel/domain/OpeningOdds.ts`, valeur `2.0`), consommée **à la fois**
par la cote affichée (read-model) et par la cote figée au pari (Betting) :
`afficher == figer`. Quand cette valeur d'ouverture est utilisée, la réponse de pose porte
`pricingProvisional: true` (latence/cohérence éventuelle **observable** côté client). En
shared-kernel car Betting ne peut pas importer Pricing (frontière).

## Statistiques joueur scopées (BET-23)

`GET /bets/stats` renvoie des **agrégats du joueur authentifié uniquement** (nombre de paris,
mises, gains, P&L…) calculés côté **read-model** (chemin LECTURE du CQRS), jamais sur le
chemin d'écriture. Le panneau « Mes statistiques » du front les affiche. Scoping anti-IDOR
identique au reste de Betting (par token).

## Conventions & CI durcie (BET-26)

- **Nommage des tests** : convention `shouldXxx_WhenXxx` + structure AAA/GWT, vérifiée par un
  gate CI dédié (`npm run test:naming`).
- **Frontières durcies** : les 5 règles `dependency-cruiser` (`no-cross-context`,
  `domain-stays-pure`, `domain-no-tech`, `application-no-infra`, `application-no-tech`)
  cassent le build à toute violation.
- **Pipeline** (`.github/workflows/ci.yml`) : `format:check` → `lint` → `boundaries` →
  `test:naming` → `test` → `build` → scripts Postgres réels (atomicité, réconciliation,
  bootstrap) → scripts Redis réels (outbox, pricing, read-model) → **build des 2 fronts**
  (typecheck + lint + build, garde de contrat incluse).

## Front — vraie app de paris en français (BET-22, BET-27)

Deux apps Next.js séparées par rôle (détails : section *Front* ci-dessous et `web/README.md`).
**BET-27** a transformé l'UI en **vraie app sportsbook entièrement en français** (parcours
joueur et gestionnaire, libellés, états). Les deux apps partagent le contrat OpenAPI généré
et `@betnext/ui` — zéro logique métier côté front.

## Démo de soutenance — les 4 scénarios (BET-25)

Quatre parcours empaquètent la soutenance ; chacun **prouve la valeur d'un choix d'archi** et est
**verrouillé par un test e2e** (`src/demo-scenarios.e2e.spec.ts`, in-memory, < 3 s, hors-ligne).
Le **runbook pas-à-pas** (UI + API, comptes, données seed, résultats attendus) est dans
[`livrables/demo-soutenance.md`](livrables/demo-soutenance.md).

| # | Scénario | Archi prouvée | Test e2e |
|---|----------|---------------|----------|
| 1 | **Ajouter un jeu** | Open/Closed — Catalog générique N-issues : un jeu inédit (`Valorant`) traverse créer→parier→régler **sans une ligne de code propre au jeu** | `shouldRunFullBettingLifecycleForBrandNewGame_When…` |
| 2 | **Ajouter un type de pari** | Open/Closed — `SettlementStrategy` + Factory : **`ExactScoreStrategy`** ajoutée = +1 fichier + 1 enregistrement DI, **0 réécriture** du moteur | `shouldSettleViaNewExactScoreStrategy_When…` |
| 3 | **Changer une règle joueur** | Conformité externalisée (`DailyCapPolicy`, BET-13) : le plafond quotidien prend effet **immédiatement**, à la hausse comme à la baisse | `shouldEnforceTheNewCapImmediately_When…` |
| 4 | **Refund sur erreur de paiement** | Money-safety — Saga + compensation (BET-17/ADR-004) : échec aval → **refund PSP idempotent**, jamais de charge sans crédit, ni double mouvement au rejeu | `shouldRefundChargeIdempotently_When…` |

```bash
npx jest src/demo-scenarios.e2e.spec.ts   # rejoue les 4 scénarios bout en bout
```

> Le scénario 2 illustre concrètement la couture d'ADR-009 : ajouter `EXACT_SCORE` n'a touché
> **ni** `WinningOutcomeStrategy`, **ni** `SettlementStrategyFactory`, **ni** `SettleMarket` — seul
> le point d'enregistrement (`betting.module.ts`) change, exactement comme promis (« extension
> additive et localisée, sans réécriture »).

## Approche TDD

Les règles de domaine sont écrites en **test-first** et restent indépendantes du framework :
cote pari-mutuel bornée (`OddsCalculator`), cote **figée** à la pose et transitions gardées
(`Bet`), idempotence du wallet (`Wallet`), modèle générique **N-issues** (`SportEvent`).
La pyramide de tests et la stratégie complète restent à étoffer (voir CI).

## Statut

POC pédagogique. Les **7 contextes** sont implémentés (Identity/auth, Wallet, Compliance,
Catalog, Betting, Pricing, Game Integration) sur adapters **Postgres/Redis/BullMQ réels** ;
le cœur (pari-mutuel, cote figée, idempotence, frontières, money-safety) est testé sur
infra réelle. Le **dépôt par paiement externe Stripe** (Saga orchestrée + compensation/recrédit
idempotent + Circuit Breaker) est **implémenté** (BET-17 : stub sans clé, adapter réel mode test).
Restent **conçus, non implémentés** (calibrage POC, voir ADR) : `BetTypeStrategy` au placement et
payout `PARTIAL`. La couture `SettlementStrategy` est démontrée par **deux** stratégies réelles
(`WINNING_OUTCOME` + `EXACT_SCORE`, BET-25). Les **4 scénarios de soutenance** sont empaquetés
(e2e + runbook) — voir *Démo de soutenance* ci-dessus.

**BET-11 livré** : `placeBet` exposé en HTTP via une commande CQRS (`POST /bets`) + `GET /health` ;
l'app est lançable (`npm start`) et couverte par un test e2e (santé + 201/400/422).

**BET-6 livré** : persistance Postgres (TypeORM) du snapshot `Bet` (cote + gain figés) + journal
d'événements append-only ; migrations idempotentes ; bascule en mémoire sans `DATABASE_URL`.

**BET-5 livré** : pose de pari **atomique** (débit wallet + pari + événements en une transaction,
tout-ou-rien), wallet via port partagé ; « zéro perte » prouvée sur **vrai Postgres**
(`npm run test:atomicity:pg`).

**BET-7 livré** : **Transactional Outbox** (event écrit dans la même tx que le pari → fenêtre de
perte fermée) + relais vers **BullMQ** + **consommateur idempotent** (`processed_messages`, effet
1 fois même en double-livraison) ; prouvé sur vrai Postgres + vrai Redis (CI / docker-compose).

**BET-18 livré** : **idempotence HTTP** (`Idempotency-Key`) sur `POST /bets` — réservation dans la
même tx que le pari, retry → même `betId`, corps différent → 409, concurrence → 1 pari, retry après
échec → clé non brûlée ; prouvé sur **vrai Postgres** (`npm run test:atomicity:pg`, cas 9→12).

**BET-8 livré** : **Pricing extrait** en process **bus-only** (consomme `BetPlaced`, publie
`OddsUpdated`) + **relais Outbox câblé au boot** (`OutboxDispatcher`) + **cote asynchrone** (état
Redis partagé, scale-out) + consommateur idempotent ; Pricing down → `placeBet` OK (cote figée).
Prouvé en mémoire (jest) et sur **vrai Redis** en CI (`npm run test:pricing:redis`).

**BET-10 livré** : côté **LECTURE** du CQRS — cote courante servie depuis le **read-model Redis**
(`GET /odds/:id`, alimenté par `OddsUpdated`, jamais la base d'écriture) ; **read-your-writes**
joueur sur Postgres (`GET /bets/:id`) ; cote **figée** préservée ; cold cache → 404 /
`pricingProvisional` ; anti out-of-order (FIFO + garde monotone). Prouvé en mémoire (jest) et sur
**vrai Redis** en CI (`npm run test:readmodel:redis`).

**BET-12 livré** : **règlement** W/L/V via couture **Strategy** (1re stratégie enregistrée) — crédit
**exactement-une-fois** (`opKey` + index unique partiel), **atomique par pari**, **résilient**
(`failedBetIds`), **annulation = remboursement exact**, events terminaux **immuables** (journal posé
→ réglé), paiement à **cote figée** (P&L fixed-odds borné). Prouvé sur **vrai Postgres** (cas 13→16,
dont **règlement concurrent → 1 seul event**).

**BET-13 livré** : **plafond quotidien** (Responsible Gaming) via **couture Policy injectée**
(`DailyCapPolicy` = 1re règle ; ajouter une règle = fichier + 1 entrée, zéro réécriture) ; vérif via
**port partagé** (frontière) ; **atomique / anti-course** (`FOR UPDATE`, dans la tx de pose) → **403**
au dépassement ; idempotent. Prouvé sur **vrai Postgres** (cas 17-18). Limites signalées : « jour »
UTC, total **brut** (net-of-void = suivi).

**BET-14 livré (épic 6/6)** : front Next.js (App Router, TS strict, Tailwind + shadcn/ui) type-safe
sur le **contrat OpenAPI généré** ; parcours joueur (marchés N-issues, cote live SSE, pose à cote figée,
historique/timeline, plafond) et gestionnaire (créer/régler) ; états loading/vide/erreur + responsive.

**BET-15 livré** : **réconciliation argent** — le ledger `wallet_operations` journalise désormais
**tous** les mouvements **signés** (ouverture/débit/crédit, dans la même tx que le solde) → invariant
**`Σ(amount) == balance`** ; `GET /admin/reconciliation` produit un **rapport** (lecture seule,
idempotent, **sans auto-correction**), **intra-Wallet** (frontière), insensible à l'async **en vol**.
Prouvé sur **vrai Postgres** (`npm run test:reconciliation:pg` : dérive injectée détectée sans
correction, idempotence, multi-wallets) + non-régression `test:atomicity:pg` (débit journalisé).

**BET-19 livré** : **Postgres store par défaut** (démarrage refusé sans `DATABASE_URL`) +
**Catalog persistant** (`TypeOrmMarketCatalog`) ; bootstrap d'un schéma vierge prouvé
(`npm run test:bootstrap:pg`).

**BET-20 livré** : **authentification JWT + RBAC** (`PLAYER`/`MANAGER`, `JwtAuthGuard` +
`RolesGuard`) + **scoping anti-IDOR** (`userId` issu du token ; paris non possédés → 404) ;
vérification de token via port partagé `TokenVerifierPort`.

**BET-21** : **Game Integration** — le **moteur de règlement-par-résultat** (`SyncMatchResult` +
`MarketSettlementPort`, exactly-once) est en place ; son ACL résultat est désormais l'**ACL LoL
Esports** (BET-32). L'ancien ACL Riot Match-V5 (placeholder) a été **retiré** (remplacé par
`EsportsResultProvider`, qui implémente le même port `GameProvider`).

**BET-22 livré** : front scindé en **deux apps Next.js** (joueur :3001 / admin :3002) +
packages partagés (`@betnext/ui`, `@betnext/api-contract`) ; ESLint des apps autonome en CI.

**BET-23 livré** : **stats joueur scopées** (`GET /bets/stats`, read-model CQRS) + panneau
« Mes statistiques » côté front.

**BET-26 livré** : **conventions + CI durcie** — nommage des tests `shouldXxx_WhenXxx`
(gate `test:naming`), 5 règles `dependency-cruiser`, pipeline durci.

**BET-27 livré** : **UI vraie app de paris**, entièrement **en français** (parcours joueur +
gestionnaire).

**BET-28 livré** : **cotes d'ouverture** servies depuis une **source unique** partagée
(`shared-kernel`, `2.0`) — `afficher == figer` ; champ de contrat `pricingProvisional`.

**BET-29** : **flux « featured par ID » + UI de sync manuel** — **retiré au recentrage BET-30**
(redondant avec l'ajout manuel + le feed auto). La brique de création de marché est conservée,
renommée `IngestMatchMarket` (mécanisme d'ingestion, plus un « featured » utilisateur) ; le moteur
de règlement, lui, est conservé (cf. BET-21 ci-dessus).

**BET-30 livré** : **feed des matchs LoL pro à venir** (API LoL Esports non-officielle derrière
un **ACL** `EsportsScheduleProvider` + adapter **fixtures** de repli) ingérés en marchés bettables
(`POST /game-integration/esports/ingest` *MANAGER*, brique `IngestMatchMarket` → `MarketCreationPort`)
— **idempotent**, **non bloquant** (repli auto + `source` live/fixtures), **cotes = notre pricing** ;
UI joueur `GET /game-integration/upcoming` avec **badge ligue + kickoff**. Voir **ADR-016**.

**BET-32 livré** : **résultats auto du feed → règlement auto**. ACL résultats
(`EsportsResultProvider` → LoL Esports `getEventDetails`, + fixtures déterministes) implémentant
`GameProvider` ; `POST /game-integration/esports/sync-results` *(MANAGER)* → `SyncFeedResults`
règle marchés + paris **exactly-once** (rejeu = no-op, prouvé en e2e). **Money-safety** : aucune
bascule sur de fausses données (source down → `PENDING`) ; résilience timeout/retry/circuit-breaker
+ rate-limit léger. Bouton admin « Synchroniser les résultats » ; les paris passent Gagné/Perdu.
Un fixture **déjà terminé** prouve le règlement auto en démo. Voir **ADR-017**.

**BET-17 livré** : **dépôt de fonds par Stripe** — **Saga orchestrée** `DepositFunds`
(`charge PSP → crédit wallet atomique → étape aval`) + **compensation/recrédit idempotent**
(reverse signé + refund PSP + notif Outbox) + **Circuit Breaker/timeout/retry**. Port hexagonal
`PaymentGateway` (types domaine, **anti-corruption**) ; sélection **par ENV** : `StubPaymentGateway`
(sans clé, déterministe) ou `StripePaymentGateway` **réel mode test** (`STRIPE_SECRET_KEY`, clé
jamais loggée). Money-safety prouvée par tests (pas de double-charge/crédit/refund, charge-sans-
crédit → remboursé, circuit ouvert → fail-fast). `POST /wallet/deposit` + `GET /wallet/balance` ;
UI « Mon portefeuille ». **0 changement de schéma** (réutilise `wallet_operations` + `outbox`).
Voir **ADR-004**.
