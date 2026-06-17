---
marp: true
theme: default
paginate: true
---

<!--
Support « début de formation » — partie ARCHITECTURE. Cible : 15–30 min (≈ 22 min de parole).
Format Marp : chaque `---` = une slide ; les blocs en commentaire sont les NOTES + TIMING de l'orateur.
Ancré sur le système réellement implémenté ; ce qui est conçu-non-codé est marqué « (stub) ».
-->

# BetNext — Architecture du POC

### Plateforme de paris e-sport multi-jeux, modulaire & money-safe

Formation développeurs — partie architecture (≈ 20 min)

<!-- 0:30 — Pitch : pourquoi on est là. À la fin de ces 20 min, vous saurez situer chaque brique et pourquoi elle existe. Le détail pratique vient dans les modules suivants. -->

---

## Le problème

- Une plateforme de paris **e-sport**, **multi-jeux**, qui doit tenir un **pic de compétition**.
- 3 contraintes du sujet : **scalable**, **maintenable/évolutive**, **déployable indépendamment**.
- 4 défis : **lecture/écriture** sous charge · **traçabilité** des paris · **résilience + zéro perte
  d'argent** · **extensibilité** (nouveaux jeux / types de paris).

<!-- 1:30 — Insister : le fil rouge de toute l'archi, c'est "zéro perte d'argent" + "ajouter un jeu sans tout réécrire". Garder ces deux phrases en tête. -->

---

## La décision de style

**Monolithe modulaire NestJS « ready-to-split »** — 1 module = 1 *bounded context*.

- **Pourquoi pas microservices d'emblée ?** Coût/junior + multiplie les *dual-writes* sur l'argent.
- **Pourquoi pas un monolithe classique ?** Il ne prouve ni les frontières ni le « déploiement
  indépendant ».
- Contrainte « déploiement indépendant » **reformulée** en *capacité de découpe* — prouvée en extrayant
  **un** service (Pricing).

<!-- 3:00 — C'est une posture d'architecte : on assume le compromis. "Ready-to-split" = on garde les frontières d'un microservice sans en payer le coût opérationnel maintenant. (ADR-001/002) -->

---

## Les bounded contexts (réels)

**7 contextes implémentés** + un Shared Kernel :

`Identity` (auth/RBAC) · `Wallet` · `Compliance` (Responsible Gaming) · `Catalog` ·
`Betting` · `Pricing` · `Game Integration` (ACL LoL Esports)

- Communication **inter-contexte par ports + événements** (Shared Kernel + Outbox/bus),
  **jamais** par import direct (`dependency-cruiser`, 0 violation).
- Coutures clés : `Wallet*Port`, `StakeGuardPort`, `MarketCreationPort`, `MarketSettlementPort`,
  `TokenVerifierPort`, `PaymentGateway`, `GameProvider`.

<!-- 4:30 — Montrer src/contexts/. Honnêteté : 7 contextes réels sur infra réelle. On ne survend pas. -->

---

## Hexagonal + frontières **vérifiées en CI**

- Chaque contexte : `domain` (pur) → `application` (ports) → `infrastructure` (adapters).
- Le **domaine ne dépend de rien** (ni framework, ni I/O).
- **`dependency-cruiser`** casse le build à toute violation (`npm run boundaries`) :
  pas d'import inter-contexte, pas de domaine qui touche l'infra.

> La frontière n'est pas une convention : c'est un **test** qui échoue.

<!-- 6:30 — C'est LE garde-fou de maintenabilité : le rayon d'impact d'un changement est borné par construction. Démo possible : provoquer une violation → build rouge. -->

---

## CQRS — séparer écriture et lecture

- **Écriture minimale** sur le chemin critique : `placeBet` = INSERT pari + événement (rien de lourd).
- **Lecture** servie par un **read-model Redis** (cotes courantes) — jamais la base d'écriture.
- Données joueur (solde, historique) en **read-your-writes** sur Postgres.

> Redis = **cache reconstructible**, jamais autoritaire, **jamais** l'argent.

<!-- 9:00 — CQRS ici = couture LOGIQUE (CommandBus/QueryBus), pas deux bases partout. Justifié par le découplage d'écriture, pas par la perf brute. (ADR-006) -->

---

## La cote : pari-mutuel **asynchrone**, **figée** à la pose

- **Pari-mutuel générique N-issues** : `cote(issue) = total événement / total issue`, bornée `[1.10,
  5.00]`.
- Recalcul **hors du chemin d'écriture** : `BetPlaced` → service **Pricing extrait** (bus-only) →
  `OddsUpdated`.
- À la pose, la cote est **figée** (`lockedOdds`) : un recalcul concurrent **ne change jamais** un pari
  déjà posé.

<!-- 11:00 — C'est le module extrait (preuve du "déploiement indépendant"). Pricing tombe ? placeBet marche quand même (cote figée). Scale-out : état partagé Redis. -->

---

## Money-safety (1/2) — rien ne se perd sur le chemin nominal

- **Une seule transaction Postgres** : débit wallet + pari + événements + **ligne Outbox** → tout-ou-rien.
- **Transactional Outbox** : l'événement est écrit *dans la même tx* → pas de *dual-write*.
- **Idempotence** : `Idempotency-Key` HTTP (anti double-débit au retry) + consommateur idempotent
  (`processed_messages`).

<!-- 14:00 — "Où l'argent peut-il se perdre ? Nulle part sur le chemin par défaut." Prouvé sur vrai Postgres : test:atomicity:pg (18 cas). (ADR-003/004/008) -->

---

## Money-safety (2/2) — le **filet** : ledger + réconciliation

- `wallet_operations` = **journal autoritaire signé** de **tous** les mouvements (ouverture/débit/crédit),
  écrit *dans la même tx* que le solde → invariant **Σ(mouvements) = solde**.
- `GET /admin/reconciliation` : compare, **rapporte** les dérives, **lecture seule**, **sans
  auto-correction**.
- Insensible à l'**async en vol** (l'Outbox porte des *events*, pas l'argent).

> « Zéro perte **après réconciliation** » — démontré (dérive injectée détectée, `test:reconciliation:pg`).

<!-- 16:30 — C'est le follow-up BET-15. Corriger de l'argent = action revue, pas un effet de bord. (ADR-013) -->

---

## Traçabilité — Event Sourcing **ciblé sur le pari**

- Chaque transition du pari émet un **événement immuable** (`bet_events`, append-only via **trigger**).
- L'**état courant** (snapshot) fait autorité pour lecture/règlement ; le journal sert d'**audit & de
  rejeu**.
- **Ciblé** sur le seul agrégat `Bet` (pas d'ES global) : calibrage junior.

<!-- 18:00 — Défi 2 (historique/audit). On a évité le full-ES : journal + snapshot. Cycle PENDING→WON/LOST/VOID. (ADR-005) -->

---

## Extensibilité — **trois coutures** additives

- **Règlement** : `SettlementStrategy` + `SettlementStrategyFactory` → +1 type de pari = 1 stratégie + 1
  enregistrement, `SettleMarket` inchangé.
- **Compliance** : `CompliancePolicyRegistry` → +1 règle = 1 policy + 1 entrée.
- **Catalog N-issues générique** : un événement = une **liste** d'issues (pas de `teamA/teamB` figé).

<!-- 19:30 — Défi 4. "Extension additive et localisée, sans réécriture" — pas un mythe "zéro code", mais un point d'enregistrement unique. -->

---

## Ajouter un jeu — aperçu (atelier dédié)

- **Niveau 1 — aujourd'hui, zéro code** : un « jeu » = un attribut ; créer son marché N-issues via
  `POST /markets`. Cotes, pose, règlement W/L/V : **génériques**, fonctionnent tels quels.
- **Niveau 2 — nouveau type de pari** : +1 `SettlementStrategy` enregistrée.
- **Niveau 3 — ingestion auto fournisseur** (`GameProvider`/ACL) : **implémenté pour LoL Esports**
  (BET-30/32) — feed des matchs pro à venir (`MarketCreationPort` → Catalog) + **règlement auto**
  sur résultats (`MarketSettlementPort` → Betting, exactly-once). Un **nouveau** fournisseur = un
  adapter `EsportsScheduleProvider`/`GameProvider` + son ACL, sans toucher le cœur.

<!-- 21:00 — Renvoyer à l'atelier M8. Honnêteté : LoL Esports est branché (ACL + résilience + repli fixtures). Ajouter un AUTRE fournisseur = un adapter de plus. -->

---

## Ce qui est **prouvé** vs ce qui est **conçu**

| Prouvé (tests réels) | Conçu, non implémenté |
| --- | --- |
| Atomicité argent (PG, 18 cas) | `BetTypeStrategy` au **placement** + payout `PARTIAL` |
| Réconciliation Σ=solde (PG) | Pricing **multi-marchés** simultanés (totaux par issue) |
| Cote async + idempotence (Redis) | — |
| Frontières (boundaries CI, 0 violation) | |
| Auth JWT + RBAC + anti-IDOR (BET-20) | |
| Game Integration / LoL Esports : feed + règlement auto (BET-30/32) | |
| Dépôt Stripe : Saga + compensation + Circuit Breaker (BET-17) | |
| Settlement : 2 stratégies réelles (`WINNING_OUTCOME` + `EXACT_SCORE`) | |

<!-- 22:00 — Message de clôture : la valeur du POC = savoir distinguer prouvé / conçu / à faire. C'est ça, la posture d'architecte. Identity, Game Integration et Stripe sont passés du "conçu" au "prouvé" ; ne restent conçus que le placement par type de pari et le pricing multi-marchés. -->

---

## Récap

1. **Monolithe modulaire ready-to-split** — frontières testées.
2. **CQRS** + cote **async** & **figée** (Pricing extrait).
3. **Money-safety** : 1 tx atomique + Outbox + idempotence **+ ledger/réconciliation**.
4. **ES ciblé** sur le pari (audit/rejeu).
5. **3 coutures** d'extensibilité → **ajouter un jeu** sans réécrire.

### Questions ?

<!-- 22:30 — Garder ~5 min de marge pour les questions dans le créneau 15–30 min. Enchaîner sur M0 (prise en main). -->
