# BetNext — Plan de formation des développeurs

> Livrable BET-16. Objectif : rendre une équipe (juniors inclus) **autonome** sur l'architecture
> BetNext — la comprendre, la prendre en main, **y ajouter un jeu**, et **gérer l'impact d'un
> changement** sans casser les garanties (frontières, money-safety).
>
> **Ancrage** : ce plan décrit le système **réellement implémenté** (POC). Tout ce qui est *conçu mais
> non codé* est explicitement marqué « **(conçu, non implémenté)** ». Les références pointent vers le
> code et `docs/architecture/`.

---

## 1. Public, pré-requis, objectifs

**Public.** Développeurs reprenant le POC (profil mixte, juniors inclus). 1 à 4 personnes.

**Pré-requis.** TypeScript, notions de Node ; bases SQL ; Git. **Pas** de pré-requis DDD/CQRS : la
formation les introduit.

**Objectifs de sortie (mesurables).** À l'issue, un développeur sait :

1. expliquer le **style** (monolithe modulaire « ready-to-split ») et **pourquoi** (les 3 contraintes /
   4 défis du sujet) ;
2. naviguer les **5 bounded contexts** réels et la couche hexagonale (domain / application / infra) ;
3. lancer le projet, les tests, et lire les **gates CI** ;
4. **ajouter un jeu** (et, si besoin, un nouveau **type de pari**) via les coutures existantes, sans
   réécrire l'existant ;
5. **évaluer le rayon d'impact** d'un changement et savoir quels garde-fous le protègent.

---

## 2. Méthode pédagogique

- **Théorie courte, pratique sur le vrai code.** Chaque module = un exposé bref + un exercice sur le
  dépôt (lire un flux, écrire un test, ajouter une stratégie…).
- **Le code et les tests sont la source de vérité.** On s'appuie sur `docs/architecture/` (ADR,
  data-model, diagrammes) et sur les tests exécutables (`npm test`, `test:atomicity:pg`,
  `test:reconciliation:pg`) plutôt que sur des slides abstraites.
- **« Preuve, pas promesse ».** On montre une garantie en **faisant échouer** un test ou en lisant la
  sortie d'un script (ex. réconciliation qui détecte une dérive injectée).

---

## 3. Modules & estimation en temps

Durées = temps **animé** (hors auto-formation). « Pratique » = atelier guidé sur le dépôt.

| # | Module | Contenu (ancré dans le code) | Théorie | Pratique | Total |
| --- | --- | --- | --- | --- | --- |
| M0 | **Onboarding / prise en main** | Cloner, `npm ci`, lancer (`npm start`), `npm test`, tour du dépôt (`src/contexts/*`, `web/`), lire la CI (`.github/workflows/ci.yml`) | 0h30 | 1h00 | **1h30** |
| M1 | **Vision & décisions (ADR)** | Le style monolithe modulaire « ready-to-split » ; les 3 contraintes / 4 défis ; lecture guidée de `decisions.md` (ADR-001/002) | 1h00 | 0h30 | **1h30** |
| M2 | **Hexagonal & frontières** | domain/application/infra ; ports & adapters ; frontières vérifiées par `dependency-cruiser` (`npm run boundaries`) → build cassé à toute violation | 1h00 | 1h00 | **2h00** |
| M3 | **CQRS & cote asynchrone** | `@nestjs/cqrs` (Command/Query) ; read-model Redis (lecture) ; **Pricing extrait bus-only** ; **pari-mutuel** générique N-issues, cote **figée** à la pose | 1h30 | 1h00 | **2h30** |
| M4 | **Money-safety (le cœur)** | Atomicité « 1 transaction » (débit + pari + events + Outbox) ; **Transactional Outbox** + BullMQ ; idempotence HTTP & consommateur ; **ledger signé + réconciliation** | 2h00 | 1h30 | **3h30** |
| M5 | **Event Sourcing ciblé (Bet)** | Journal append-only immuable (trigger) ; snapshot autoritaire ; rejeu ; cycle de vie `PENDING→WON/LOST/VOID` (+ états `COMPENSATING`/`REFUNDED` côté Saga, non exercés) | 1h00 | 0h30 | **1h30** |
| M6 | **Extensibilité (coutures)** | Strategy/Factory de **règlement** ; **Policy** compliance ; Catalog **N-issues** générique | 1h00 | 0h30 | **1h30** |
| M7 | **Le front (Next.js)** | Contrat **OpenAPI généré** (zéro type à la main) ; SSE des cotes ; états loading/vide/erreur | 0h45 | 0h45 | **1h30** |
| M8 | **Atelier : AJOUTER UN JEU** | Walkthrough concret (§5) : nouveau marché N-issues → (option) nouvelle stratégie de règlement → vérif end-to-end | 0h30 | 2h00 | **2h30** |
| M9 | **Gérer l'impact d'un changement** | Rayon d'impact borné par contexte/port ; gates CI ; ES & upcasting ; invariants money à préserver | 1h00 | 0h30 | **1h30** |

**Total animé ≈ 19,5 h** (somme du tableau), **réparti** sur ~3 semaines (voir calendrier §4) — pas en
continu, hors auto-formation et lectures. Le **support de la partie architecture** (livrable séparé
`support-archi.md`) condense M1 + l'essentiel de M2/M3/M4 en une présentation de **15–30 min** (le
« début de la formation »).

> **Hypothèse (à valider)** : durées calibrées pour une **équipe junior** découvrant CQRS/DDD. Une
> équipe déjà familière compresse M1–M3 d'environ 30 %.

---

## 4. Calendrier étalé (séquencement)

Format proposé : **demi-journées** animées + auto-formation entre les sessions, étalé sur **~3
semaines** (laisse le temps d'assimiler et de pratiquer sur le vrai code). Hypothèse de cadence — à
adapter au plan de charge réel.

| Semaine | Séance | Modules | Livrable de fin de séance |
| --- | --- | --- | --- |
| **S1** | J1 matin | M0 + **M1** | Environnement qui tourne ; sait situer les contextes |
| **S1** | J1 après-midi | M2 | A provoqué (et corrigé) une violation de frontière en local |
| **S1** | J2 matin | M3 | Sait lire le flux cote async + cote figée |
| **S2** | J3 matin | **M4** | Sait expliquer « où l'argent ne peut pas se perdre » + lance les scripts PG |
| **S2** | J3 après-midi | M5 + M6 | Lit le journal d'un pari ; identifie les 3 coutures |
| **S2** | J4 | **M8 (atelier ajouter un jeu)** | A ajouté un marché d'un nouveau jeu + (option) une stratégie, tests verts |
| **S3** | J5 matin | M7 | Sait régénérer le contrat et relier un écran |
| **S3** | J5 après-midi | M9 + revue | Sait estimer le rayon d'impact d'un ticket type |

> Le **kick-off** (S1/J1) s'ouvre sur la présentation **15–30 min** (`support-archi.md`) avant M0/M1.

---

## 5. Atelier « AJOUTER UN JEU » (walkthrough concret, vérifié contre le code)

C'est l'objectif le plus scruté du sujet. **Point clé honnête** : dans le modèle implémenté, un « jeu »
n'est pas un plugin technique — c'est un **attribut générique** d'un marché. Il existe **deux niveaux**.

### 5.1 Niveau 1 — Ajouter un jeu **aujourd'hui** : zéro code (modèle générique)

Le modèle Catalog est **N-issues générique** : `SportEvent` porte un `game: string` et une **liste**
d'issues (pas de `teamA/teamB` codé en dur).
Réf. : `src/contexts/catalog/domain/SportEvent.ts` (« permet d'ajouter un jeu non-binaire … sans
toucher le modèle »), `src/contexts/catalog/application/CreateMarket.ts` (validation : `game` requis,
**≥ 2 issues**), `CatalogController` (`POST /markets`).

Ajouter un marché d'un nouveau jeu = **un appel HTTP**, aucune ligne de code :

```bash
curl -X POST http://localhost:3000/markets -H "Content-Type: application/json" -d '{
  "name": "Valorant Champions — DRX vs EDG",
  "game": "Valorant",
  "outcomes": ["Victoire DRX", "Victoire EDG"]
}'
```

Et **tout le reste fonctionne sans modification**, car les briques en aval sont **génériques par
issue** :

- **Cotes** : le pari-mutuel calcule `cote(issue) = total événement / total issue`, borné `[1.10,
  5.00]`, pour un **nombre quelconque d'issues** — `src/contexts/pricing/domain/OddsCalculator.ts`. La
  cote se met à jour en asynchrone à chaque pari (`RecalculateOddsOnBetPlaced`).
  **⚠ Limite POC (cf. §8)** : le Pricing tient des **totaux globaux par issue, un seul marché** — un
  2e marché simultané partagerait le même pool. L'isolation par `eventId` est une évolution flaggée
  (`RecalculateOddsOnBetPlaced.ts`) ; pour la démo « ajouter un jeu », régler le marché courant avant
  d'en ouvrir un autre, ou implémenter le groupement par marché.
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
`SettleMarket`.

Couture réelle : `SettlementStrategy` (interface domaine pure : `key` + `decide(bet, result)`) et
`SettlementStrategyFactory` (registre par clé).
Réf. : `src/contexts/betting/domain/settlement/SettlementStrategy.ts`,
`src/contexts/betting/application/SettlementStrategyFactory.ts` (« Ajouter un type de pari = un nouveau
fichier de stratégie + 1 enregistrement ici — `SettleMarket` ne change pas »).

Recette :

1. **Créer** `src/contexts/betting/domain/settlement/ExactScoreStrategy.ts` implémentant
   `SettlementStrategy` (un `key` unique + la logique `decide`). Domaine **pur** → testable sans I/O.
2. **Enregistrer** la stratégie dans la `SettlementStrategyFactory` (la factory prend une liste de
   stratégies ; on ajoute la nouvelle au tableau — **1 ligne**).
3. **Sélectionner** la stratégie au règlement via `strategyKey` (déjà porté par `SettleMarketInput` /
   `SettleMarketCommand`).
4. **Tester** la stratégie en isolation (comme `WinningOutcomeStrategy.spec.ts`).

`SettleMarket`, le crédit exactement-une-fois, l'atomicité par pari et le journal **restent inchangés**
(critère « extension additive et localisée »).

> **Limite honnête (à signaler)** : le **placement** (`PlaceBet`) est aujourd'hui **générique** (mise
> sur un `outcomeId`). Un type de pari nécessitant une **validation/saisie spécifique à la pose** (ex.
> saisir un score) demanderait d'étendre **aussi** le chemin de pose — il n'existe pas encore de couture
> « BetTypeStrategy » côté placement (**conçu dans l'esprit ADR-009, non implémenté**). Le statut
> `PARTIAL` existe dans le type `SettlementKind` mais **aucune logique de partial-payout** n'est codée.

### 5.3 Niveau 3 — Intégration **automatisée** d'un fournisseur (Riot/LoL Esports) : **conçu, non implémenté**

Le sujet et les ADR prévoient un **`GameProviderInterface` en plugin + ACL** (anti-corruption layer) et
un **contexte Game Integration** pour **ingérer automatiquement** événements/scores d'un fournisseur
externe et alimenter Catalog/règlement par **événements**.

> **État réel** : **non présent dans le code** (pas de contexte `game-integration`, pas d'interface
> `GameProvider`). C'est le point d'extension **cible**. Où il se brancherait : un nouveau bounded
> context exposant un **port** `GameProvider` (un adapter concret par fournisseur), un **ACL** traduisant
> le modèle externe vers le modèle interne N-issues, publiant des événements (Outbox/bus) consommés par
> Catalog (création de marchés) et par le règlement (résultats). À **implémenter** si l'automatisation
> de l'ingestion devient nécessaire ; le modèle générique (§5.1) la rend additive.

---

## 6. Gérer l'impact d'un changement

Le but : savoir, avant de toucher au code, **jusqu'où** un changement se propage et **quels garde-fous**
le retiennent.

- **Rayon d'impact borné par le bounded context.** `dependency-cruiser` interdit les imports
  inter-contextes et garde le domaine pur (`.dependency-cruiser.cjs`, `npm run boundaries`) : une
  modification interne à un contexte **ne peut pas** fuir ailleurs sans casser le build. La communication
  inter-contexte passe par **événements** (Outbox/bus), pas par imports.
- **Hexagonal = changement d'infra isolé.** Remplacer un adapter (Postgres ↔ mémoire, Redis…) ne touche
  ni le domaine ni l'application (qui ne dépendent que des **ports**). Ex. : `WALLET_DEBIT_PORT`,
  `MARKET_CATALOG`, `ODDS_READ_MODEL`.
- **Contrat front protégé.** Le client front est **généré** depuis l'OpenAPI (`npm run api:contract`) ;
  un changement d'API cassant fait **échouer le typecheck** du front (job CI `web-typecheck`).
- **Argent : invariants à préserver.** Toute évolution du chemin argent doit garder verts
  `test:atomicity:pg` (18 cas) et `test:reconciliation:pg` (Σ ledger = solde) — ce sont les gardiens.
- **Event Sourcing & upcasting.** Le journal `bet_events` est **immuable** (trigger append-only) :
  changer la structure d'un événement impose un **upcaster** / versionnage (ADR-005), pas une réécriture
  du passé.
- **Réflexe « gates ».** Avant merge : `lint`, `format:check`, **`boundaries`**, `test`, `build`, puis
  les scripts PG/Redis (CI). Un changement n'est « fini » que lorsque ces gates sont verts.

**Exercice (M9).** Estimer le rayon d'impact de 3 tickets types : (a) ajouter une policy compliance
(plafond hebdo) → 1 fichier policy + 1 entrée registre, contexte Compliance seul ; (b) changer le calcul
de cote → contexte Pricing seul, consommateurs via contrat d'event inchangé ; (c) ajouter un champ à
`BetPlaced` → Pricing + read-model + upcaster ES → rayon plus large, gates à surveiller.

---

## 7. Ressources & points d'entrée

- `docs/architecture/decisions.md` — ADR (style, atomicité, CQRS, Outbox, extensibilité, charge,
  **réconciliation ADR-013**).
- `docs/architecture/data-model.md` — schéma relationnel + choix (ledger signé, garde-fous DB).
- `docs/architecture/diagrams.md` — C4, flux `placeBet`, cycle de vie `Bet`, invariant réconciliation.
- `README.md` — commandes, et l'état livré par ticket (BET-5/6/7/8/10/11/12/13/14/15/18).
- Code : `src/contexts/{betting,wallet,catalog,compliance,pricing}`, `web/`.

---

## 8. Périmètre & limites assumées (pour ne rien survendre en formation)

- **Identity / auth : absent.** Pas de scoping utilisateur réel ; le front ne simule pas d'auth.
- **Game Integration / `GameProvider` : conçu, non implémenté** (cf. §5.3).
- **Stripe / paiement externe : stretch non implémenté** (Saga conçue, ADR-004 ; wallet fictif par
  défaut).
- **`PARTIAL`, type de pari à placement spécifique : non implémentés** (cf. §5.2).
- **Pricing : un seul marché global** dans le POC (totaux par issue) ; le multi-événements est une
  évolution flaggée (`RecalculateOddsOnBetPlaced`).

Ces limites sont **volontaires** (calibrage POC / équipe junior) et constituent une partie du discours
de formation : *savoir ce qui est prouvé, ce qui est conçu, et ce qui reste à faire.*
