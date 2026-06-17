# BetNext — Plan de formation des développeurs

> Livrable BET-16. Objectif : rendre une équipe (juniors inclus) **autonome** sur l'architecture
> BetNext — la comprendre, la prendre en main, **y ajouter un jeu**, et **gérer l'impact d'un
> changement** sans casser les garanties (frontières, money-safety).
>
> **Ancrage** : ce plan décrit le système **réellement implémenté** (POC, état du `main`). Tout ce qui
> est *conçu mais non codé* est explicitement marqué « **(conçu, non implémenté)** ». Les références
> pointent vers le code et `docs/architecture/`. Le « début de la formation » (partie architecture,
> 15–30 min) est livré séparément dans [`support-archi.md`](support-archi.md).

---

## 1. Public, pré-requis, objectifs

**Public.** Développeurs reprenant le POC (profil mixte, juniors inclus). 1 à 4 personnes.

**Pré-requis.** TypeScript, notions de Node ; bases SQL ; Git. **Pas** de pré-requis DDD/CQRS : la
formation les introduit.

**Objectifs de sortie (mesurables).** À l'issue, un développeur sait :

1. expliquer le **style** (monolithe modulaire « ready-to-split ») et **pourquoi** (les 3 contraintes /
   4 défis du sujet) ;
2. naviguer les **7 bounded contexts** réels (`identity`, `wallet`, `compliance`, `catalog`, `betting`,
   `pricing`, `game-integration`) et la couche hexagonale (domain / application / infrastructure) ;
3. lancer le projet (Postgres + Redis), les tests, et lire les **gates CI** ;
4. **ajouter un jeu** (et, si besoin, un nouveau **type de pari** ou un nouveau **fournisseur de feed**)
   via les coutures existantes, sans réécrire l'existant ;
5. **évaluer le rayon d'impact** d'un changement et savoir quels garde-fous le protègent (frontières,
   RBAC/anti-IDOR, invariants argent).

---

## 2. Méthode pédagogique

- **Théorie courte, pratique sur le vrai code.** Chaque module = un exposé bref + un exercice sur le
  dépôt (lire un flux, écrire un test, ajouter une stratégie…).
- **Le code et les tests sont la source de vérité.** On s'appuie sur `docs/architecture/` (ADR,
  data-model, diagrammes) et sur les tests exécutables (`npm test`, `test:atomicity:pg`,
  `test:reconciliation:pg`, `test:pricing:redis`…) plutôt que sur des slides abstraites.
- **« Preuve, pas promesse ».** On montre une garantie en **faisant échouer** un test ou en lisant la
  sortie d'un script (ex. réconciliation qui détecte une dérive injectée ; circuit breaker qui
  *fail-fast*). Les **4 scénarios de soutenance** ([`demo-soutenance.md`](demo-soutenance.md), verrouillés
  par `src/demo-scenarios.e2e.spec.ts`) servent de fil rouge transverse.

---

## 3. Modules & estimation en temps

Durées = temps **animé** (hors auto-formation). « Pratique » = atelier guidé sur le dépôt.

| # | Module | Contenu (ancré dans le code) | Théorie | Pratique | Total |
| --- | --- | --- | --- | --- | --- |
| M0 | **Onboarding / prise en main** | Cloner, `npm ci`, lancer le back (Postgres + `AUTH_SECRET` requis → `node --env-file=.env dist/main.js`), `npm test`, tour du dépôt (`src/contexts/*`, `src/shared-kernel/`, `web/`), lire la CI (`.github/workflows/ci.yml`) | 0h30 | 1h00 | **1h30** |
| M1 | **Vision & décisions (ADR)** | Le style monolithe modulaire « ready-to-split » ; les 3 contraintes / 4 défis ; lecture guidée de `decisions.md` (ADR-001/002 + challenge adversarial) | 1h00 | 0h30 | **1h30** |
| M2 | **Hexagonal & frontières** | domain/application/infrastructure ; ports & adapters ; **5 règles** `dependency-cruiser` (`npm run boundaries`) → build cassé à toute violation (0/287 modules) | 1h00 | 1h00 | **2h00** |
| M3 | **CQRS & cote asynchrone** | `@nestjs/cqrs` (Command/Query) ; read-model Redis (lecture) + SSE ; **Pricing extrait bus-only** ; **pari-mutuel** générique N-issues, **cote d'ouverture** source unique, cote **figée** à la pose | 1h30 | 1h00 | **2h30** |
| M4 | **Money-safety (le cœur)** | Atomicité « 1 transaction » (débit + pari + events + Outbox) ; **Transactional Outbox** + BullMQ ; idempotence HTTP & consommateur ; **ledger signé + réconciliation** ; **Saga dépôt Stripe + compensation/recrédit + Circuit Breaker** | 2h00 | 1h30 | **3h30** |
| M5 | **Auth / RBAC / anti-IDOR** | Contexte `identity` : login JWT, rôles `PLAYER`/`MANAGER` (`JwtAuthGuard` + `RolesGuard`), scoping **anti-IDOR** (`userId` du token, jamais du corps), `TokenVerifierPort` ; autorité **100 % serveur** | 0h45 | 0h45 | **1h30** |
| M6 | **Event Sourcing ciblé (Bet)** | Journal append-only immuable (trigger) ; snapshot autoritaire ; rejeu ; cycle de vie `PENDING→WON/LOST/VOID` (+ états `COMPENSATING`/`REFUNDED` côté Saga dépôt) | 1h00 | 0h30 | **1h30** |
| M7 | **Extensibilité (coutures)** | Strategy/Factory de **règlement** (2 stratégies réelles : `WINNING_OUTCOME` + `EXACT_SCORE`) ; **Policy** compliance ; Catalog **N-issues** générique | 1h00 | 0h45 | **1h45** |
| M8 | **Game Integration & ACL** | Feed des matchs **LoL pro à venir** (ACL `EsportsScheduleProvider` + repli fixtures + résilience) ; **règlement auto** sur résultats (`GameProvider`/`EsportsResultProvider`, exactly-once) ; ports `MarketCreationPort`/`MarketSettlementPort` | 1h00 | 0h45 | **1h45** |
| M9 | **Le front (Next.js)** | **Deux apps** séparées par rôle (player :3001 / admin :3002) ; contrat **OpenAPI généré** (zéro type à la main) ; SSE des cotes ; états loading/vide/erreur, FR | 0h45 | 0h45 | **1h30** |
| M10 | **Atelier : AJOUTER UN JEU** | Walkthrough concret (§5) : marché N-issues d'un jeu inédit → (option) nouvelle stratégie de règlement → (option) nouveau fournisseur de feed → vérif end-to-end | 0h30 | 2h00 | **2h30** |
| M11 | **Gérer l'impact d'un changement** | Rayon d'impact borné par contexte/port ; gates CI ; ES & upcasting ; invariants money & RBAC à préserver | 1h00 | 0h30 | **1h30** |

**Total animé ≈ 23 h** (somme du tableau), **réparti** sur ~3–4 semaines (voir calendrier §4) — pas en
continu, hors auto-formation et lectures. Le **support de la partie architecture** (livrable séparé
[`support-archi.md`](support-archi.md)) condense M1 + l'essentiel de M2/M3/M4 en une présentation de
**15–30 min** (le « début de la formation »).

> **Hypothèse (à valider)** : durées calibrées pour une **équipe junior** découvrant CQRS/DDD. Une
> équipe déjà familière compresse M1–M3 d'environ 30 %.

---

## 4. Calendrier étalé (séquencement)

Format proposé : **demi-journées** animées + auto-formation entre les sessions, étalé sur **~4
semaines** (laisse le temps d'assimiler et de pratiquer sur le vrai code). Hypothèse de cadence — à
adapter au plan de charge réel.

| Semaine | Séance | Modules | Livrable de fin de séance |
| --- | --- | --- | --- |
| **S1** | J1 matin | M0 + **M1** | Environnement qui tourne ; sait situer les 7 contextes |
| **S1** | J1 après-midi | M2 | A provoqué (et corrigé) une violation de frontière en local |
| **S1** | J2 matin | M3 | Sait lire le flux cote async + cote figée + cote d'ouverture |
| **S2** | J3 matin | **M4** | Sait expliquer « où l'argent ne peut pas se perdre » + lance les scripts PG ; lit la Saga dépôt |
| **S2** | J3 après-midi | M5 + M6 | Comprend RBAC/anti-IDOR ; lit le journal d'un pari |
| **S2** | J4 matin | M7 + M8 | Identifie les coutures ; lit le feed LoL + le règlement auto |
| **S3** | J5 | **M10 (atelier ajouter un jeu)** | A ajouté un marché d'un nouveau jeu + (option) une stratégie, tests verts |
| **S4** | J6 matin | M9 | Sait régénérer le contrat et relier un écran (player/admin) |
| **S4** | J6 après-midi | M11 + revue | Sait estimer le rayon d'impact d'un ticket type |

> Le **kick-off** (S1/J1) s'ouvre sur la présentation **15–30 min** ([`support-archi.md`](support-archi.md))
> avant M0/M1.

---

## 5. Atelier « AJOUTER UN JEU » (walkthrough concret, vérifié contre le code)

C'est l'objectif le plus scruté du sujet. **Point clé honnête** : dans le modèle implémenté, un « jeu »
n'est pas un plugin technique — c'est un **attribut générique** d'un marché. Il existe **trois niveaux**,
et les **trois sont désormais implémentés** (le niveau 3 l'était « conçu seulement » dans la 1re version
de ce plan ; il ne l'est plus). C'est aussi le **scénario 1 de la démo de soutenance**
([`demo-soutenance.md`](demo-soutenance.md), test `shouldRunFullBettingLifecycleForBrandNewGame_When…`).

### 5.1 Niveau 1 — Ajouter un jeu **aujourd'hui** : zéro code (modèle générique)

Le modèle Catalog est **N-issues générique** : `SportEvent` porte un `game: string` et une **liste**
d'issues (pas de `teamA/teamB` codé en dur).
Réf. : `src/contexts/catalog/domain/SportEvent.ts`, `src/contexts/catalog/application/CreateMarket.ts`
(validation : `game` requis, **≥ 2 issues**), `CatalogController` (`POST /markets`, rôle **MANAGER**).

Ajouter un marché d'un nouveau jeu = **un appel HTTP** (sous token MANAGER), aucune ligne de code :

```bash
curl -X POST http://localhost:3000/markets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token MANAGER>" -d '{
  "name": "Valorant Champions — DRX vs EDG",
  "game": "Valorant",
  "outcomes": ["Victoire DRX", "Victoire EDG"]
}'
```

Et **tout le reste fonctionne sans modification**, car les briques en aval sont **génériques par
issue** :

- **Cotes** : le pari-mutuel calcule `cote(issue) = total événement / total issue`, borné `[1.10,
  5.00]`, pour un **nombre quelconque d'issues** — `src/contexts/pricing/domain/OddsCalculator.ts`. La
  cote se met à jour en asynchrone à chaque pari (`RecalculateOddsOnBetPlaced`). Tant qu'il n'y a aucun
  volume, c'est la **cote d'ouverture** (`src/shared-kernel/domain/OpeningOdds.ts`, `2.0`) qui est servie,
  *à l'identique* à l'affichage et au gel (`pricingProvisional: true`).
  **⚠ Limite POC (cf. §8)** : le Pricing tient des **totaux globaux par issue, un seul marché** — un
  2e marché simultané partagerait le même pool (`RecalculateOddsOnBetPlaced.ts` lit `store.totals()`
  global). L'isolation par marché est une évolution ; pour la démo « ajouter un jeu », régler le marché
  courant avant d'en ouvrir un autre.
- **Pose de pari** : `PlaceBet` mise sur un `outcomeId` quelconque, cote **figée** au moment de la pose
  — aucune notion de jeu spécifique.
- **Règlement** : `WinningOutcomeStrategy` règle **n'importe quel** marché N-issues
  (`src/contexts/betting/domain/settlement/WinningOutcomeStrategy.ts`) : issue gagnante → `WON` (cote
  figée), annulation → `VOID` (remboursement exact), sinon `LOST`.

> **Démonstration d'atelier** : créer le marché Valorant ci-dessus, poser un pari, régler via
> `POST /markets/settle`, vérifier l'historique (timeline) et le crédit. Aucune recompilation.

### 5.2 Niveau 2 — Si le nouveau jeu introduit un **nouveau type de pari** : +1 stratégie, zéro réécriture

Si le jeu apporte une mécanique de gain non « pick-the-winner » (ex. *score exact*, *over/under*,
*handicap*), on ajoute **une stratégie de règlement** et on l'**enregistre** — sans toucher
`SettleMarket`. **C'est déjà fait une 2e fois** : `ExactScoreStrategy` (BET-25) est une vraie stratégie
en plus de `WinningOutcomeStrategy` — c'est le **scénario 2 de la soutenance**
(`shouldSettleViaNewExactScoreStrategy_When…`).

Couture réelle : `SettlementStrategy` (interface domaine pure : `key` + `decide(bet, result)`) et
`SettlementStrategyFactory` (registre par clé).
Réf. : `src/contexts/betting/domain/settlement/SettlementStrategy.ts`,
`src/contexts/betting/application/SettlementStrategyFactory.ts`,
`src/contexts/betting/domain/settlement/ExactScoreStrategy.ts`.

Recette (vérifiée : ajouter `EXACT_SCORE` n'a touché **ni** `WinningOutcomeStrategy`, **ni** la factory,
**ni** `SettleMarket` — seul le point d'enregistrement `betting.module.ts` change) :

1. **Créer** `src/contexts/betting/domain/settlement/MaStrategy.ts` implémentant `SettlementStrategy`
   (un `key` unique + la logique `decide`). Domaine **pur** → testable sans I/O (cf.
   `ExactScoreStrategy.spec.ts`).
2. **Enregistrer** la stratégie dans le tableau injecté à la `SettlementStrategyFactory` au montage du
   module (`src/contexts/betting/betting.module.ts`) — **1 ligne**.
3. **Sélectionner** la stratégie au règlement via `strategyKey` (déjà porté par `SettleMarketInput` /
   `SettleMarketCommand`).
4. **Tester** la stratégie en isolation.

`SettleMarket`, le crédit exactement-une-fois, l'atomicité par pari et le journal **restent inchangés**
(critère « extension additive et localisée »).

> **Limite honnête (à signaler)** : le **placement** (`PlaceBet`) est aujourd'hui **générique** (mise
> sur un `outcomeId`). Un type de pari nécessitant une **validation/saisie spécifique à la pose** (ex.
> saisir un score) demanderait d'étendre **aussi** le chemin de pose — il n'existe pas encore de couture
> « BetTypeStrategy » côté placement (**conçu dans l'esprit ADR-009, non implémenté**). Le statut
> `PARTIAL` existe dans le type `SettlementKind` mais **aucune logique de partial-payout** n'est codée.

### 5.3 Niveau 3 — Intégration **automatisée** d'un fournisseur (LoL Esports) : **implémenté**

Le contexte **`game-integration`** ingère **automatiquement** des marchés depuis un fournisseur externe
et règle les paris sur les **résultats** réels — sans que Catalog ni Betting ne connaissent ce
fournisseur. C'est le `GameProviderInterface` + ACL prévus par le sujet, **réalisés** (ADR-016/017).

**Ce qui existe (à lire en atelier) :**

- **Feed des matchs LoL pro à venir** : `POST /game-integration/esports/ingest` *(MANAGER)* →
  `IngestUpcomingMatches` → `IngestMatchMarket` → `MarketCreationPort` (Catalog). Source derrière un
  **ACL** : port `EsportsScheduleProvider`
  (`src/contexts/game-integration/application/ports/EsportsScheduleProvider.ts`) ; adapter API
  non-officielle LoL Esports (`LolEsportsScheduleProvider`, base URL + clé en **ENV**) ; **repli
  fixtures** + bascule auto (`FallbackEsportsScheduleProvider`, expose `source: 'live' | 'fixtures'`) ;
  résilience timeout/retry (`ResilientScheduleProvider`). Le format externe ne fuit pas dans le domaine
  (`ScheduledMatch` neutre). **Cotes = notre pricing**, jamais la cote externe. Idempotent (clé = id
  externe) : un re-pull ne duplique pas les marchés.
- **Règlement auto sur résultats** : `POST /game-integration/esports/sync-results` *(MANAGER)* →
  `SyncFeedResults` → `SyncMatchResult` → `MarketSettlementPort` → `SettleMarket`, **exactly-once**
  (rejeu = no-op). Côté ACL résultats : port `GameProvider`
  (`src/contexts/game-integration/application/ports/GameProvider.ts`), adapter `EsportsResultProvider`
  (+ `FixtureEsportsResultProvider`), enveloppé `ResilientGameProvider`. **Money-safety** : **aucune**
  bascule live→fixtures côté résultats (on ne règle jamais sur de fausses données ; source down →
  `PENDING`, on réessaie).

**Pour ajouter un AUTRE fournisseur (autre jeu / autre API)** = **un adapter**, pas une réécriture :

1. Écrire un adapter implémentant `EsportsScheduleProvider` (planning) et/ou `GameProvider` (résultats),
   avec son **ACL** traduisant le modèle externe vers le modèle neutre interne
   (`ScheduledMatch` / `MatchReport`).
2. L'**enregistrer** dans `game-integration.module.ts` (éventuellement derrière les wrappers de
   résilience existants).
3. Le cœur (Catalog, Betting, règlement exactly-once) ne change pas : la communication passe par
   `MarketCreationPort` / `MarketSettlementPort` (Shared Kernel).

> **Exercice (M8/M10)** : lire le chemin `ingest → upcoming → sync-results` en mode **fixtures** (un
> match déjà terminé, G2 vs Fnatic, prouve le règlement auto hors-ligne), puis esquisser l'adapter d'un
> 2e fournisseur (squelette + 1 test).

---

## 6. Gérer l'impact d'un changement

Le but : savoir, avant de toucher au code, **jusqu'où** un changement se propage et **quels garde-fous**
le retiennent.

- **Rayon d'impact borné par le bounded context.** `dependency-cruiser` (5 règles : `no-cross-context`,
  `domain-stays-pure`, `domain-no-tech`, `application-no-infra`, `application-no-tech`) interdit les
  imports inter-contextes et garde le domaine pur (`.dependency-cruiser.cjs`, `npm run boundaries`) :
  une modification interne à un contexte **ne peut pas** fuir ailleurs sans casser le build. La
  communication inter-contexte passe par **ports + événements** (Shared Kernel + Outbox/bus), pas par
  imports.
- **Hexagonal = changement d'infra isolé.** Remplacer un adapter (Postgres ↔ mémoire, Redis, Stripe ↔
  stub, LoL Esports ↔ fixtures…) ne touche ni le domaine ni l'application (qui ne dépendent que des
  **ports**). Ex. : `WalletDebitPort`, `MarketCreationPort`, `PaymentGateway`, `GameProvider`,
  `TokenVerifierPort`.
- **RBAC & anti-IDOR à préserver.** Toute nouvelle route métier doit passer par `JwtAuthGuard`
  (+ `@Roles('MANAGER')` si écriture sensible) et tirer le `userId` **du token**, jamais du corps/URL
  (sinon fuite/usurpation). Un pari non possédé renvoie **404** (pas de fuite d'existence).
- **Argent : invariants à préserver.** Toute évolution du chemin argent doit garder verts
  `test:atomicity:pg` (18 cas) et `test:reconciliation:pg` (Σ ledger = solde), et — pour le dépôt —
  l'absence de double-charge/crédit/refund (Saga `DepositFunds`, ADR-004). Ce sont les gardiens.
- **Event Sourcing & upcasting.** Le journal `bet_events` est **immuable** (trigger append-only) :
  changer la structure d'un événement impose un **upcaster** / versionnage (ADR-005), pas une réécriture
  du passé.
- **Contrat front protégé.** Le client front est **généré** depuis l'OpenAPI (`npm run api:contract`) ;
  un changement d'API cassant fait **échouer le typecheck/la garde de contrat** des deux apps (jobs CI
  `web-*`).
- **Réflexe « gates ».** Avant merge : `format:check`, `lint`, **`boundaries`**, `test:naming`, `test`,
  `build`, puis les scripts PG/Redis et le build des 2 fronts (CI). Un changement n'est « fini » que
  lorsque ces gates sont verts.

**Exercice (M11).** Estimer le rayon d'impact de 4 tickets types : (a) ajouter une policy compliance
(plafond hebdo) → 1 fichier policy + 1 entrée registre, contexte Compliance seul ; (b) changer le calcul
de cote → contexte Pricing seul, consommateurs via contrat d'event inchangé ; (c) ajouter un champ à
`BetPlaced` → Pricing + read-model + upcaster ES → rayon plus large, gates à surveiller ; (d) ajouter un
fournisseur de feed → 1 adapter + 1 enregistrement dans `game-integration`, cœur inchangé.

---

## 7. Ressources & points d'entrée

- `docs/architecture/decisions.md` — ADR (style, atomicité, CQRS, Outbox, extensibilité, charge,
  **réconciliation ADR-013**, **ports inter-contextes ADR-014**, **RBAC/anti-IDOR ADR-015**, **feed
  ACL ADR-016**, **règlement auto ADR-017**).
- `docs/architecture/data-model.md` — schéma relationnel + choix (ledger signé, garde-fous DB).
- `docs/architecture/diagrams.md` — C4, flux `placeBet`, cycle de vie `Bet`, invariant réconciliation.
- `livrables/analyse-microservices.md` — validation « ready-to-split » (topologie cible + ordre
  d'extraction) ; `livrables/demo-soutenance.md` — les 4 scénarios + runbook ;
  `livrables/support-archi.md` — le support 15–30 min (kick-off).
- `README.md` — commandes, et l'état livré par ticket (BET-5→33).
- Code : `src/contexts/{identity,wallet,compliance,catalog,betting,pricing,game-integration}`,
  `src/shared-kernel/`, `src/{read-model,messaging,persistence}/`, `web/apps/{player,admin}`.

---

## 8. Périmètre & limites assumées (pour ne rien survendre en formation)

**Désormais implémenté** (ne plus présenter comme « conçu ») : **Identity / auth JWT + RBAC + anti-IDOR**
(BET-20), **Game Integration** (feed LoL pro à venir + règlement auto, BET-30/32), **dépôt Stripe**
(Saga + compensation/recrédit + Circuit Breaker, BET-17 — *stub déterministe sans clé, adapter réel mode
test avec `STRIPE_SECRET_KEY`*).

**Restent conçus / limités (volontairement, calibrage POC / équipe junior)** :

- **`BetTypeStrategy` au placement + payout `PARTIAL` : non implémentés** — le placement est générique
  (cf. §5.2).
- **Pricing : un seul marché global** dans le POC (totaux par issue, `store.totals()` global) ;
  l'isolation par marché est une évolution (cf. §5.1).
- **Plafond quotidien** : « jour » = date **UTC** ; total **brut** (un pari VOID ne libère pas le
  plafond — net-of-void = suivi séparé, BET-13).
- **Réconciliation** : rapport en lecture seule **sans alerting ni workflow de correction** (action
  manuelle revue) ; pas de TTL/purge des clés d'idempotence ni du ledger (croissance append-only).
- **Front** : clients minces ; le scoping de rôle côté UI est de l'UX — l'**autorité reste 100 %
  serveur** (un client forgé n'obtient que des 401/403).

Distinguer *ce qui est prouvé*, *ce qui est conçu* et *ce qui reste à faire* fait partie du discours de
formation : c'est la posture d'architecte.
