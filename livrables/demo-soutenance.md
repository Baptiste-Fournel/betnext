# Démo de soutenance — les 4 scénarios (BET-25)

> Runbook pas-à-pas pour la soutenance. Chaque scénario **prouve la valeur d'un choix
> d'architecture**, est jouable **à l'écran** (UI + API) et est **verrouillé par un test e2e**
> (`src/demo-scenarios.e2e.spec.ts`) qui rejoue le parcours bout en bout. Si la démo live casse
> (réseau, port occupé), les tests e2e sont le **filet de secours** : ils prouvent la même chose,
> hors-ligne et en < 3 s.

| # | Scénario | Choix d'archi prouvé | Couture | Test e2e |
|---|----------|----------------------|---------|----------|
| 1 | Ajouter un jeu | Open/Closed — Catalog **générique N-issues** | `MarketCreationPort` / `game` libre | `shouldRunFullBettingLifecycleForBrandNewGame_When…` |
| 2 | Ajouter un type de pari | Open/Closed — **Strategy + Factory** | `SettlementStrategy` (BET-25 : `ExactScoreStrategy`) | `shouldSettleViaNewExactScoreStrategy_When…` |
| 3 | Changer une règle joueur | Conformité **externalisée**, effet à chaud | `DailyCapPolicy` (BET-13) | `shouldEnforceTheNewCapImmediately_When…` |
| 4 | Erreur de paiement → refund | **Money-safety** — Saga + compensation | `DepositFunds` (BET-17, ADR-004) | `shouldRefundChargeIdempotently_When…` |

---

## 0. Préparation (avant la soutenance)

**Le plus simple — toute la stack en une commande (BET-9) :**

```bash
npm run demo:reset     # table rase + seed reproductible (état propre garanti)
npm run demo:up        # infra + back :3000 + worker + fronts :3001/:3002 (health-checks, détaché)
                       #   ingère aussi le feed et pré-règle un pari → stats non vides d'entrée
# … soutenance …
npm run demo:down      # arrêt ciblé (PID/port). DOWN_INFRA=1 pour couper aussi PG/Redis.
```

`demo:up` mentionne en sortie les URLs + comptes ; logs sous `.demo/`. Le **scheduler auto**
(BET-33) garde le feed vivant ; **Stripe** est stub sans clé, réel (test) avec `sk_test_…` ; sans
`ESPORTS_API_BASE_URL`, le feed tourne sur **fixtures** (un match terminé → règlement auto démo-able).

<details><summary>Lancement manuel équivalent (si besoin de dérouler étape par étape)</summary>

```bash
# Back (Postgres + AUTH_SECRET requis — cf. README « Commandes »)
npm run db:up                              # Postgres via docker compose
cp .env.example .env                       # renseigner DATABASE_URL + AUTH_SECRET
npm run build && npm run db:seed           # migrations + données de démo (users, marchés)
node --env-file=.env dist/main.js          # monolithe sur :3000 (Swagger /docs)

# Fronts (deux apps Next.js — un front par rôle)
cd web && npm install
npm run dev:player     # http://localhost:3001  (login demo-player  / changeme123)
npm run dev:admin      # http://localhost:3002  (login demo-manager / changeme123)
```

</details>

**Captures de secours** (si la démo live casse) : screenshots nets des parcours clés dans
[`captures-demo/`](captures-demo/README.md) — connexion, feed, coupon (cote figée), stats, wallet,
admin créer/régler, synchro résultats → pari Gagné.

**Comptes seed** (mot de passe `changeme123`) :

| Compte | Rôle | Usage en démo |
|--------|------|----------------|
| `demo-player` | PLAYER | parie, fixe son plafond, dépose |
| `demo-manager` | MANAGER | crée/règle les marchés, ouvre les wallets, ingère le feed |

**État de référence atteint avant cette démo** (déjà livré) : auth + RBAC + anti-IDOR (BET-20),
wallet fictif + **dépôt Stripe** stub/réel (BET-17), **plafond quotidien** (BET-13), cotes
asynchrones figées au pari (BET-8/28), **stats joueur** scopées (BET-23), **feed LoL pro à venir**
+ règlement auto des résultats (BET-30/32). Sans `STRIPE_SECRET_KEY` ni `ESPORTS_API_BASE_URL`, la
démo tourne en **mode déterministe hors-ligne** (PSP stub idempotent, fixtures esports).

**Filet de secours — tout rejouer en une commande :**

```bash
npx jest src/demo-scenarios.e2e.spec.ts   # les 4 scénarios, bout en bout, < 3 s
```

> Astuce soutenance : laisser ce test tourner en projection pendant qu'on déroule l'UI. Le vert
> prouve que les 4 parcours sont reproductibles, pas une mise en scène.

---

## Scénario 1 — Ajouter un jeu (extensibilité, zéro réécriture)

**Pitch (30 s).** « Notre Catalog est **générique N-issues** : un jeu est une *donnée*, pas du code.
Ajouter Valorant, CS2 ou un jeu inédit ne touche **aucune ligne** du moteur de paris ni du
règlement. » Le `game` est un champ libre ; un marché porte une **liste d'issues** (pas de
`teamA`/`teamB` binaire).

**Pas-à-pas (UI).**
1. Front admin (`:3002`, `demo-manager`) → **Créer un marché** : nom `VCT — Sentinels vs Fnatic`,
   jeu **`Valorant`** (jamais vu), issues `SEN` / `FNC` / `nul`.
2. Front joueur (`:3001`, `demo-player`) → le marché Valorant apparaît dans la liste publique →
   **parier 10 €** sur `SEN` à **notre cote figée**.
3. Front admin → **Régler** le marché, issue gagnante `SEN`.
4. Front joueur → l'historique montre le pari **WON**, gain crédité.

**Équivalent API (fallback).**
```bash
# (MANAGER) créer le marché du jeu inédit
curl -X POST :3000/markets -H "Authorization: Bearer $MGR" -H 'Content-Type: application/json' \
  -d '{"name":"VCT — Sentinels vs Fnatic","game":"Valorant","outcomes":["SEN","FNC","nul"]}'
# → 201 { id, game:"Valorant", outcomes:[{id,label}…] }   (récupérer les id générés)

# (PLAYER) parier sur l'issue gagnante
curl -X POST :3000/bets -H "Authorization: Bearer $PLY" -H 'Idempotency-Key: val-1' \
  -H 'Content-Type: application/json' -d '{"outcomeId":"<id SEN>","stake":10}'   # → 201

# (MANAGER) régler
curl -X POST :3000/markets/settle -H "Authorization: Bearer $MGR" -H 'Content-Type: application/json' \
  -d '{"outcomes":["<id SEN>","<id FNC>","<id nul>"],"winningOutcomeId":"<id SEN>"}'  # → 200 {won:1}
```

**Résultat attendu.** Cycle complet (créer → parier → régler → gagner) **sans une ligne de code
propre au jeu**.

**Pour aller plus loin — le feed d'un nouveau jeu** (ce que la démo *n'exécute pas* mais que
l'archi permet) : intégrer le flux temps réel d'un nouveau jeu = **ajouter des fichiers** derrière
la couture `GameProvider` / `EsportsScheduleProvider`, sur le modèle de l'adapter LoL existant
(`infrastructure/esports/EsportsResultProvider.ts` + ACL confiné), puis **1 enregistrement** dans
`game-integration.module.ts`. Le cœur (Catalog, Betting, règlement) reste **inchangé** — cf.
ADR-009 et ADR-016/017.

---

## Scénario 2 — Ajouter un type de pari (couture SettlementStrategy)

**Pitch (30 s).** « Un nouveau type de pari = **un nouveau fichier de stratégie + 1 ligne
d'enregistrement**. Le moteur de règlement (`SettleMarket`), la factory et la stratégie 1N2
existante ne sont **pas réécrits** (Open/Closed). » Exemple livré : **`ExactScoreStrategy`**
(« score exact »).

**Ce qui a été ajouté (à montrer dans l'IDE) :**
- `src/contexts/betting/domain/settlement/ExactScoreStrategy.ts` *(nouveau fichier)*
- `src/contexts/betting/domain/settlement/ExactScoreStrategy.spec.ts` *(nouveau test unitaire)*
- **1 enregistrement** dans `src/contexts/betting/betting.module.ts` :
  ```ts
  new SettlementStrategyFactory([new WinningOutcomeStrategy(), new ExactScoreStrategy()])
  ```
- **0 modification** de `WinningOutcomeStrategy`, `SettlementStrategyFactory`, `SettleMarket`.

**Pas-à-pas (API — le type se sélectionne par `strategyKey`).**
```bash
# (PLAYER) deux paris « score exact » : une grille juste (2-1), une fausse (1-0)
curl -X POST :3000/bets -H "Authorization: Bearer $PLY" -H 'Idempotency-Key: es-1' \
  -H 'Content-Type: application/json' -d '{"outcomeId":"es-2-1","stake":10}'   # → 201
curl -X POST :3000/bets -H "Authorization: Bearer $PLY" -H 'Idempotency-Key: es-2' \
  -H 'Content-Type: application/json' -d '{"outcomeId":"es-1-0","stake":10}'   # → 201

# (MANAGER) régler avec la NOUVELLE stratégie
curl -X POST :3000/markets/settle -H "Authorization: Bearer $MGR" -H 'Content-Type: application/json' \
  -d '{"outcomes":["es-2-1","es-1-0","es-2-0","es-0-2"],"winningOutcomeId":"es-2-1","strategyKey":"EXACT_SCORE"}'
# → 200 { settled:2, won:1, lost:1 }
```

**Résultat attendu.** La grille exacte **WON**, la fausse **LOST**. Point clé : si `EXACT_SCORE`
n'était **pas** enregistrée, la factory **lèverait** → `settled:0, failed:2`. Le `won:1` **prouve**
que le type a été pris en compte **sans toucher** le moteur. La stratégie 1N2 par défaut reste
opérationnelle (mêmes paris sans `strategyKey`).

---

## Scénario 3 — Changer une règle joueur : le plafond quotidien (effet immédiat)

**Pitch (30 s).** « Le **jeu responsable** est une règle **externalisée** (`DailyCapPolicy`),
configurable **par le joueur**, appliquée sur le chemin d'écriture. La changer prend effet
**immédiatement**, sans redémarrage ni déploiement. »

**Pas-à-pas (UI).**
1. Front joueur (`:3001`, `demo-player`) → **Jeu responsable** : fixer le **plafond quotidien à
   40 €**.
2. Parier **30 €** → accepté. Parier encore **30 €** → **refusé** (60 > 40), message de plafond.
3. Relever le plafond à **80 €** → reparier **30 €** → **accepté immédiatement** (total 60 ≤ 80).
4. Abaisser le plafond à **50 €** → tenter **30 €** de plus → **refusé** (90 > 50).

**Équivalent API.**
```bash
curl -X PUT :3000/responsible-gaming/daily-cap -H "Authorization: Bearer $PLY" \
  -H 'Content-Type: application/json' -d '{"cap":40}'                 # → 200
curl … /bets … -d '{"outcomeId":"cap-o1","stake":30}'  # → 201
curl … /bets … -d '{"outcomeId":"cap-o1","stake":30}'  # → 403 (dépasse 40)
curl -X PUT … /daily-cap … -d '{"cap":80}'             # → 200
curl … /bets … -d '{"outcomeId":"cap-o1","stake":30}'  # → 201 (effet immédiat)
curl -X PUT … /daily-cap … -d '{"cap":50}'             # → 200
curl … /bets … -d '{"outcomeId":"cap-o1","stake":30}'  # → 403 (effet immédiat, sens inverse)
```

**Résultat attendu.** Chaque changement de plafond est respecté **dès le pari suivant**, à la
hausse comme à la baisse. La règle vit **dans la donnée/config**, pas dans une release.

---

## Scénario 4 — Refund sur erreur de paiement (money-safety, Saga)

**Pitch (45 s).** « Exigence **zéro perte sur l'argent**. Si le joueur paie et qu'une étape aval
échoue, la **Saga compense** : on **rembourse** la charge PSP, on n'encaisse **jamais** sans
créditer, et la compensation est **idempotente** (un retry ne double ni la charge ni le refund). »

**Mise en scène déterministe (sans clé Stripe → PSP stub).** On provoque l'échec aval en déposant
sur un wallet **non ouvert** : la charge réussit, le **crédit échoue** (wallet introuvable) → la
Saga rembourse (`CREDIT_FAILED`).

**Pas-à-pas (API).**
```bash
# Joueur SANS wallet ouvert (on n'appelle pas POST /wallet/open)
curl -X POST :3000/wallet/deposit -H "Authorization: Bearer $PLY" -H 'Idempotency-Key: dep-x' \
  -H 'Content-Type: application/json' -d '{"amount":50}'
# → 422  « Dépôt impossible : le paiement a été intégralement remboursé. »

curl :3000/wallet/balance -H "Authorization: Bearer $PLY"     # → { balance: null }  (rien encaissé)

# Rejeu du MÊME dépôt (retry réseau) → toujours 422, AUCUN double-charge / double-refund
curl -X POST :3000/wallet/deposit -H "Authorization: Bearer $PLY" -H 'Idempotency-Key: dep-x' \
  -H 'Content-Type: application/json' -d '{"amount":50}'      # → 422
```

**Ce que le test e2e vérifie en plus (invisible à l'API, lu sur le PSP stub).**
- `chargeCount == 1` puis **reste 1** au rejeu → **pas de double-charge**.
- `refundCount == 1` puis **reste 1** au rejeu → **l'argent est rendu, une seule fois** (refund
  idempotent par clé `refund:<depositId>`).
- solde **null** → jamais de crédit fantôme.

**Variante « happy path » à montrer juste avant** (contraste) : ouvrir le wallet (`POST
/wallet/open` côté MANAGER), déposer 50 € → **201 CREDITED**, solde +50, et un **rejeu** de la même
clé laisse le solde **inchangé** (idempotence du dépôt nominal — cf. `app.e2e.spec.ts`).

**Résultat attendu.** Aucune perte, aucun double mouvement, le joueur est remboursé et informé
(notification de compensation via Outbox). C'est la promesse **« zéro erreur sur l'argent »**
rendue exécutable. Détails : README *Dépôt de fonds — Saga Stripe* et ADR-004.

---

## Récapitulatif — lancer la preuve

```bash
npx jest src/demo-scenarios.e2e.spec.ts                 # les 4 scénarios (BET-25)
npx jest src/app.e2e.spec.ts src/game-integration.e2e.spec.ts   # parcours auth/feed associés
npm test                                                # toute la suite (domaine + e2e in-memory)
npm run test:atomicity:pg                               # money-safety sur Postgres réel (CI)
```

> Les e2e tournent **in-memory** (PSP stub, fixtures esports) : reproductibles, hors-ligne, sans
> Postgres ni Redis. Les preuves money-safety sur infra réelle (Postgres) restent couvertes par
> `test:atomicity:pg` / `test:reconciliation:pg`.
