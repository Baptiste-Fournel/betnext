# BetNext — Guide d'utilisation & d'exploitation

> **Pas-à-pas** pour lancer, utiliser et exploiter le POC. Pendant *visuel/architectural* :
> [Architecture & design patterns](architecture-et-design-patterns.md). Pour la trame de
> soutenance, voir [`demo-soutenance.md`](demo-soutenance.md) ; pour le détail endpoint par
> endpoint, le [`README.md`](../README.md).

---

## 1. Lancer

### 1.1 Prérequis

| Outil | Version | Pourquoi |
|---|---|---|
| **Docker** (+ Compose) | récent | PostgreSQL + Redis (`docker-compose.yml`) |
| **Node.js** | **≥ 20** (`.nvmrc`) | back NestJS, scripts, fronts Next.js (`--env-file` natif) |
| **npm** | fourni avec Node | installation & scripts |

```bash
nvm use                 # aligne sur .nvmrc
npm install             # dépendances du back
cp .env.example .env    # puis renseigner AUTH_SECRET (cf. ci-dessous)
```

**`.env` — le minimum vital** (les autres clés sont optionnelles, cf. §3) :

| Variable | Obligatoire | Défaut / note |
|---|---|---|
| `DATABASE_URL` | **oui** | `postgres://betnext:betnext@localhost:5432/betnext` |
| `AUTH_SECRET` | **oui** | secret JWT — générer : `openssl rand -hex 32` |
| `PORT` | non | `3000` |
| `REDIS_URL` | non | vide = relais/worker inactifs (POC sans Redis) |
| `STRIPE_SECRET_KEY` | non | vide = PSP **stub** ; `sk_test_…` = Stripe réel (test) |
| `ESPORTS_API_BASE_URL` / `ESPORTS_API_KEY` | non | vides = **fixtures** déterministes |
| `ESPORTS_SCHEDULER_ENABLED` | non | vide/`false` = refresh auto **OFF** |

> ⚠️ `main.ts` **ne charge pas** `.env` tout seul — il est passé à Node via `--env-file`. Les
> scripts de démo le font pour vous ; en lancement manuel, **ne l'oubliez pas** (sinon
> `AUTH_SECRET` manque → 401, cf. §4).

### 1.2 Le plus simple — toute la stack en une commande

```bash
npm run demo:reset     # (optionnel) table rase + seed reproductible
npm run demo:up        # infra + back :3000 + worker + fronts :3001/:3002, en détaché
                       #   ingère le feed et pré-règle un pari → stats non vides d'entrée
# … utilisation / démo …
npm run demo:down      # arrêt ciblé par PID/port ; DOWN_INFRA=1 pour couper aussi PG/Redis
```

`demo:up` affiche en sortie les URLs + comptes ; les logs vont dans `.demo/<projet>/logs/`.
Variantes utiles (surchargeables par variable d'env) :

| Commande | Effet |
|---|---|
| `DEMO_ISOLATED=1 npm run demo:up` | ports décalés (3300/3301/3302, PG 55432), **hors-ligne**, ne touche ni :3000 ni l'infra live |
| `DEMO_RESET=1 npm run demo:up` | repart d'un état propre (TRUNCATE) avant le seed |
| `SKIP_FRONTS=1 npm run demo:up` | back + infra seulement (captures) |

### 1.3 Lancement manuel (étape par étape)

```bash
# Back
npm run db:up                                # Postgres via docker compose
npm run build && npm run db:seed             # migrations + données de démo
node --env-file=.env dist/main.js            # monolithe sur :3000 (Swagger sur /docs)
node --env-file=.env dist/pricing.main.js    # worker Pricing extrait (si REDIS_URL défini)

# Fronts (deux apps Next.js)
cd web && npm install
npm run dev:player     # http://localhost:3001  (demo-player  / changeme123)
npm run dev:admin      # http://localhost:3002  (demo-manager / changeme123)
```

### 1.4 Vérifs (la stack est-elle vivante ?)

```bash
curl :3000/health                      # → {"status":"ok","service":"betnext",...}
open http://localhost:3000/docs        # Swagger (contrat OpenAPI)
open http://localhost:3001             # front joueur
open http://localhost:3002             # front gestionnaire
npx jest src/demo-scenarios.e2e.spec.ts  # filet : les 4 scénarios bout en bout, < 3 s
```

**Comptes seed** (mot de passe `changeme123`) :

| Compte | Rôle | Usage |
|---|---|---|
| `demo-player` | PLAYER | parie, fixe son plafond, dépose |
| `demo-manager` | MANAGER | crée/règle les marchés, ouvre les wallets, ingère le feed |

---

## 2. Utiliser

> Les exemples API utilisent un token JWT (`POST /auth/login` → champ `token`). Posez
> `PLY="Bearer <token player>"` et `MGR="Bearer <token manager>"`. Le `userId` est **toujours**
> dérivé du token — jamais du corps (anti-IDOR).

### 2.1 Parcours joueur (front :3001)

| Étape | UI | API équivalente |
|---|---|---|
| **Se connecter** | écran de login | `POST /auth/login {username,password}` |
| **Voir les matchs à venir** | liste des marchés publics | `GET /markets` · `GET /game-integration/upcoming` |
| **Parier (cote figée)** | coupon → mise → valider | `POST /bets` (header `Idempotency-Key` **obligatoire**) |
| **Déposer (wallet / Stripe)** | écran wallet → déposer | `POST /wallet/deposit` (`Idempotency-Key`) |
| **Consulter ses stats / historique** | onglet stats | `GET /bets/stats` · `GET /bets` · `GET /bets/:id/events` |
| **Fixer son plafond quotidien** | jeu responsable | `PUT /responsible-gaming/daily-cap {cap}` |

```bash
# Parier 10 € sur une issue, à NOTRE cote figée
curl -X POST :3000/bets -H "Authorization: $PLY" -H 'Idempotency-Key: bet-1' \
  -H 'Content-Type: application/json' -d '{"outcomeId":"<id issue>","stake":10}'
# → 201 {betId, lockedOdds, potentialGain, pricingProvisional}
```

> La cote affichée est **figée** à l'instant du pari (`lockedOdds`) : un recalcul async
> ultérieur ne touche pas votre pari.

### 2.2 Parcours gestionnaire (front :3002)

| Étape | UI | API équivalente |
|---|---|---|
| **Créer un marché manuel** | formulaire marché (jeu + issues) | `POST /markets {name,game,outcomes[]}` |
| **Ingérer le feed** | bouton « ingérer le feed » | `POST /game-integration/esports/ingest` |
| **Régler un marché** | écran règlement → issue gagnante | `POST /markets/settle {outcomes[],winningOutcomeId[,strategyKey]}` |
| **Synchroniser les résultats** | bouton « synchro résultats » | `POST /game-integration/esports/sync-results` |
| **Ouvrir un wallet joueur** | gestion wallet | `POST /wallet/open` |

```bash
# Créer un marché pour un jeu jamais vu (Catalog générique N-issues)
curl -X POST :3000/markets -H "Authorization: $MGR" -H 'Content-Type: application/json' \
  -d '{"name":"VCT — Sentinels vs Fnatic","game":"Valorant","outcomes":["SEN","FNC","nul"]}'

# Régler le marché (issue gagnante = SEN) ; strategyKey optionnel (défaut WINNING_OUTCOME)
curl -X POST :3000/markets/settle -H "Authorization: $MGR" -H 'Content-Type: application/json' \
  -d '{"outcomes":["<id SEN>","<id FNC>","<id nul>"],"winningOutcomeId":"<id SEN>"}'
# → 200 {settled, won, lost, voided, failed}
```

> **Règlement exactly-once :** régler deux fois le même marché est un no-op (index unique
> partiel sur `bet_events`). La synchro des résultats du feed s'appuie sur le même garde.

---

## 3. Gérer / exploiter

### 3.1 Scheduler auto du feed (on/off + intervalle)

| Variable | Valeur | Effet |
|---|---|---|
| `ESPORTS_SCHEDULER_ENABLED` | `true`/`1`/`yes`/`on` | refresh auto **ON** (ré-ingère + synchronise sans clic) |
| | vide / autre | **OFF** (défaut → jamais armé en test/CI) |
| `ESPORTS_SCHEDULER_INTERVAL_MS` | entier > 0 | intervalle (défaut **300000** = 5 min) |
| `ESPORTS_SYNC_MIN_INTERVAL_MS` | entier ≥ 0 | throttle entre deux synchros résultats (défaut 3000) |

Le scheduler ne fait que **rappeler** les use cases existants (ingestion idempotente +
règlement exactly-once) : aucune logique argent, anti-chevauchement, erreurs isolées (un tick
KO ne casse pas l'app, le suivant réessaie).

### 3.2 Stripe : stub vs réel

| `STRIPE_SECRET_KEY` | Comportement |
|---|---|
| vide | **StubPaymentGateway** déterministe — dépôt qui crédite directement (démo & CI hors-ligne) |
| `sk_test_…` | adapter **Stripe réel** (mode test), durci par circuit breaker + timeout + retry |

La clé est **secrète** : jamais en dur, jamais loggée, jamais committée. `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
(`pk_test_…`) est publique par design (front), utile seulement si l'on branche Stripe Elements.

### 3.3 Feed : live vs fixtures

| `ESPORTS_API_BASE_URL` + `ESPORTS_API_KEY` | Comportement |
|---|---|
| vides | **fixtures** déterministes (LEC/LCK…, dont un match « terminé » pour démontrer le règlement auto) |
| renseignées | source **live** durcie ; ingestion bascule sur fixtures si KO, **mais les résultats ne basculent jamais** (on ne règle pas sur de fausses données) |

### 3.4 Seed / reset

```bash
npm run db:seed        # migrations + données de démo (idempotent)
npm run demo:reset     # build + table rase (TRUNCATE) + seed reproductible
npm run demo:enrich    # enrichit l'état runtime (feed ingéré + un pari déjà gagné)
```

### 3.5 Réconciliation argent (filet « zéro perte »)

```bash
curl :3000/admin/reconciliation -H "Authorization: $MGR"
# → {checkedAt, walletsChecked, balanced, drifts:[]}
```

Lecture seule, **sans auto-correction** : compare Σ(ledger signé) au solde et **rapporte** les
dérives. Une correction d'argent reste une action **revue**, pas un effet de bord (ADR-013).

### 3.6 Dépannage

| Symptôme | Cause probable | Remède |
|---|---|---|
| **401** sur tout | `.env` non chargé (`AUTH_SECRET` absent) | lancer avec `node --env-file=.env …` ou via `npm run demo:up` |
| **App ne démarre pas** | `DATABASE_URL` / `AUTH_SECRET` manquants | renseigner `.env` (cf. §1.1) |
| **Port occupé** (3000/3001/3002) | instance déjà lancée | `npm run demo:down`, ou `DEMO_ISOLATED=1 npm run demo:up` (ports décalés) |
| **Feed vide / down** | API esports injoignable | normal : repli **fixtures** ; vérifier `ESPORTS_API_*` si live attendu |
| **Cote reste « provisoire »** | worker Pricing / Redis absent | définir `REDIS_URL` + lancer `dist/pricing.main.js` (la cote figée du pari reste valide) |
| **Dépôt en 422 « remboursé »** | wallet non ouvert (échec aval) | `POST /wallet/open` côté MANAGER avant le dépôt |
| **Logs ?** | — | `.demo/<projet>/logs/` (back, worker, player, admin) |

---

## 4. Aller plus loin

- **Preuves money-safety sur infra réelle :** `npm run test:atomicity:pg`,
  `npm run test:reconciliation:pg`.
- **Frontières en CI :** `npm run boundaries` (0 violation attendue).
- **Contrat d'API :** `npm run api:contract` (régénère l'OpenAPI + les types front).
- **Comprendre les choix :** [ADR](../docs/architecture/decisions.md) ·
  [diagrammes détaillés](../docs/architecture/diagrams.md) ·
  [synthèse visuelle](architecture-et-design-patterns.md).
