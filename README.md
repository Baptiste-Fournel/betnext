# BetNext — POC d'architecture (plateforme de paris e-sport multi-jeux)

Projet d'architecture logicielle (ESGI, 4e année). Objectif : démontrer, par un POC qui
tourne, une plateforme de paris e-sport **modulaire, scalable et multi-jeux**. Posture
d'architecte : chaque choix est justifié et chaque compromis assumé.

> Le dossier d'architecture complet (décisions, compromis, diagrammes, modèle de données) est dans
> [`docs/architecture/decisions.md`](docs/architecture/decisions.md),
> [`docs/architecture/diagrams.md`](docs/architecture/diagrams.md) et
> [`docs/architecture/data-model.md`](docs/architecture/data-model.md) (tables + choix de conception).

## Architecture en bref

- **Monolithe modulaire NestJS « ready-to-split »** : 1 module Nest = 1 bounded context.
- **Frontières dures vérifiées au build** (`dependency-cruiser`) : un import inter-contexte
  casse la CI.
- **Hexagonal** : la couche `domain` ne dépend ni de `application`, ni de `infrastructure`,
  ni d'un framework. Les use cases dépendent de **ports** (interfaces), pas d'adapters.
- **Pricing extrait** en service séparé (`src/pricing.main.ts`) qui communique **uniquement par
  le bus** (BullMQ/Redis) — jamais d'appel in-process : preuve du déploiement indépendant
  (contrainte 3) et de la cote **asynchrone** (BET-8).
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
npm start              # démarre le monolithe (port 3000) + relais Outbox si REDIS_URL
npm run start:pricing  # démarre le service Pricing extrait (worker bus-only ; exige REDIS_URL)
npm run test:pricing:redis  # e2e Pricing sur vrai Redis (CI) : outbox→relais→bus→OddsUpdated
npm run test:readmodel:redis # e2e read-model sur vrai Redis (CI) : OddsUpdated→projecteur→lecture
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

# Poser un pari (commande via CQRS) → 201. Le header Idempotency-Key est OBLIGATOIRE.
curl -X POST http://localhost:3000/bets \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 3f9c-…" \
  -d '{"userId":"u1","outcomeId":"o1","stake":20}'
# → {"betId":"...","lockedOdds":2,"potentialGain":40}

# Header Idempotency-Key absent → 400
# Forme invalide (champ manquant / type) → 400
# Mise <= 0 (invariant métier, levé par le domaine) → 422
# Même clé + même corps → MÊME betId (aucun 2e pari ni débit)
# Même clé + corps différent → 409 (conflit) ; tentative concurrente non finie → 425
```

> **Valeurs par défaut de POC — NON tranchées, faciles à changer** : la cote vient d'un
> `StaticOddsProvider` figé à **2.0** (sera remplacé par le read-model alimenté par Pricing —
> ADR-006/007) ; wallet et catalogue sont des stubs en mémoire.

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

## Front (Next.js) — BET-14 (épic)

App **Next.js** (App Router, TS strict, Tailwind + shadcn/ui) dans `web/`, à côté du back. C'est un
**client MINCE** : aucune logique métier (elle reste dans le domaine back). Détails : `web/README.md`.

**Client API typé GÉNÉRÉ** (jamais écrit à la main), pipeline reproductible :

```bash
npm run api:contract   # (racine) back → packages/api-contract/openapi.json → web/src/lib/api/schema.d.ts
cd web && npm install && npm run dev   # http://localhost:3001
```

- Contrat partagé : `packages/api-contract/openapi.json` (émis par le back via `@nestjs/swagger` ;
  Swagger UI sur `/docs`).
- Types : `web/src/lib/api/schema.d.ts` (`openapi-typescript`) ; client `openapi-fetch` type-safe
  (`web/src/lib/api/client.ts`). Une **garde compile-time** (`contract.guard.ts`, vérifiée par le job
  CI `web-typecheck`) prouve qu'un chemin hors-contrat est **rejeté à la compilation**.
- **Frontière** : le front n'importe QUE le contrat généré, jamais le code interne du back.

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
