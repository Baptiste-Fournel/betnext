# BetNext — Architecture cible : décisions & compromis (ADR)

> Statut : **figé pour la soutenance** (sous réserve des hypothèses marquées « À VALIDER »).
> Posture : architecte. Chaque choix est ancré sur une preuve (code legacy de référence ou raisonnement adversarial) et chaque compromis est explicité en *gain / perte / condition*.
> Méthode du jour : architecture cible passée au feu d'un **challenge adversarial à 6 agents** (chacun mandaté pour *attaquer*, pas valider), puis réconciliée.

## 0. Contexte, méthode et preuves

Le repo POC est vide (construction *from scratch*). Le monolithe Symfony fourni sert **uniquement de référence du domaine** ; il n'est pas réutilisé. Toutes les références `fichier:ligne` ci-dessous ont été **lues et vérifiées** dans `symfony_paris_sportif-main/` (et non reprises de mémoire).

Faits de domaine établis depuis le code legacy (réservoir d'arguments) :

- **Pari-mutuel.** La cote est `total_misé_événement / total_misé_issue`, bornée à `[1.10 ; 5.00]` (`src/Service/OddsCalculatorService.php:44-45`, constantes `:11-13`). Le recalcul lit **tous les paris `PENDING`** d'une issue (`:51-59`) → coût `O(nb paris)`, et il est exécuté **en synchrone, dans la transaction de pari** (`src/Service/BettingService.php:62`).
- **`placeBet` est atomique** : un seul `flush()` Doctrine couvre INSERT pari + débit wallet + recalcul (`BettingService.php:56-64`). La cote est **figée** à la pose (`lockedOdds`, `BettingService.php:54`, `Bet.php:26-30`).
- **Settlement binaire** : `resolveWinners()` est une boucle `Outcome::isWinner()` → `WON`/`LOST` uniquement, aucun `VOID`/nul/score/résultat partiel (`BettingService.php:72-95`). L'annulation rembourse les paris `PENDING` (`:100-118`) **sans clé d'idempotence**.
- **Wallet** = solde scalaire + journal de `Transaction` (DEPOSIT/BET/WIN/REFUND) ; `debit/credit/refund` n'ont **aucune idempotence** et s'appuient sur le `flush()` de l'appelant (`src/Service/WalletService.php:27-64`).
- **Modèle binaire codé en dur** : `SportEvent` porte `teamA`/`teamB` obligatoires (`src/Entity/SportEvent.php:44-52`) *en plus* d'une collection générique `outcomes` (`:85`) ; l'ingestion LoL force tout flux entrant dans `teamA`/`teamB` (`src/Service/LoLEsportsService.php:82-103`).
- **Règles légales compilées** : le délai légal de **48 h** pour relever un plafond est codé en dur (`src/Service/ResponsibleGamingService.php:135`) ; le plafond quotidien est une **somme de paris** depuis minuit (`:152-157`), non nette des remboursements.

**Charge cible — déduite (le sujet ne fournit aucun chiffre, on le dérive).** Ancrage sourcé : le pic de la finale LoL Worlds 2024 a atteint **6,94 M de spectateurs simultanés** (hors plateformes chinoises), ~**50 M** Chine incluse ([Esports Charts](https://escharts.com/news/2024-league-legends-worlds-record), [Insider Gaming](https://insider-gaming.com/lol-worlds-2024-hit-50-million-peak-viewers/)). Entonnoir d'hypothèses explicites (toutes « hypothèse », à affiner) : part captée par une plateforme régionale/nouvelle p ≈ 0,5–2 % → ~35–140 k utilisateurs simultanés ; fraction pariant activement b ≈ 20–50 % → ~7–70 k parieurs ; k ≈ 1–3 paris sur une fenêtre d'~10 min autour du lock. → **pic dérivé ≈ 2 000–6 000 paris/min (~33–100/s)** en scénario attendu ; bas ≈ 700/min ; haut/stretch ~20 000/min. Lectures (~20:1) ≈ 40–120 k req/min, cible **< 300 ms p95** sur la pose. Le nombre critique n'est pas le débit brut mais la **concentration sur UN événement à 3 issues** (contention d'écriture) et la **fraîcheur de cote**. Paliers d'adaptation : **ADR-012**.

## 1. Synthèse du challenge adversarial

Six rôles critiques ont attaqué l'architecture. Objections les plus fortes retenues :

| Agent | Objection la plus forte | Verdict après réconciliation |
|---|---|---|
| **Avocat microservices** | Un monolithe se déploie en un artefact : la contrainte 3 n'est satisfaite que sur **1 frontière /8** ; « ready-to-split » est non vérifiable tant que BDD + bus restent partagés. | Reformuler C3 en *capacité de découpe à la demande* ; la prouver en extrayant **un service avec sa propre frontière réseau + Outbox**. → ADR-001, ADR-002. |
| **Auditeur argent** | En séparant Wallet et Betting, la cible **casse l'atomicité** que le legacy avait (`flush()` unique) → dual-write, livraison *at-least-once*, compensation ≠ rollback → fenêtres de **perte / double-crédit**. | Garder le **chemin argent atomique dans une seule base Postgres** ; idempotence **côté consommateur** ; transitions d'état gardées ; job de réconciliation. → ADR-003, ADR-004, ADR-008. |
| **Sceptique scalabilité** | Le goulot est le **chemin d'écriture** (contention sur l'événement chaud), pas la lecture ; le read-model Redis crée un lag « où est mon pari ? » et un SPOF ; async = YAGNI sans chiffres. | CQRS comme *couture logique* ; async justifié par le **découplage d'écriture** (preuve, pas perf) ; **Postgres source de vérité** + read-your-writes ; Redis = cache reconstructible. → ADR-006, ADR-007. |
| **Faisabilité junior** | ES + Saga + Outbox + microservice + Hexagonal + frontières CI + UI *from scratch* en ~1 semaine ≈ **18-22 j estimés** → hors budget ; la démo multi-process est fragile le jour J. | **Couper la Saga orchestrée** (chemin argent atomique + test de rollback), Outbox **polling** (pas de CDC), **un seul** outil de frontières, UI minimale, `docker-compose` + captures de secours. → ADR-004, ADR-008, ADR-011. |
| **Gardien évolutivité** | « Zéro code » est un mythe : un type de pari touche aussi validation + projection + migration + **settlement** (que la Strategy n'enrobe pas) ; le « N-issues » fuit au règlement ; « légal sans redéploiement » faux si la règle est du code. | Promettre « **extension additive et localisée, sans réécriture** » ; rendre le **settlement polymorphe** + statut d'issue ; 2 niveaux pour le légal (paramètres vs logique). → ADR-009, ADR-010. |
| **Examinateur soutenance** | Contradiction « équipe junior / ne pas sur-concevoir » vs la pile de patterns ; la cote async pour **une division** s'effondre sous une question ; l'**ES** vs un simple journal append-only que le legacy a déjà. | Distinguer *build-time* / *run-time* ; rejustifier l'async par le découplage d'écriture ; **dégrader l'ES en journal append-only** sans état reconstruit faisant autorité. → ADR-005, ADR-007. |

**Fil rouge :** l'architecture initiale était dimensionnée pour un problème dont l'ampleur n'est pas chiffrée, alors que la preuve du domaine plaide pour plus de **sobriété**. La réconciliation **garde la thèse** (modularité ready-to-split, async scalable, traçabilité, déploiement indépendant prouvé) mais **resserre l'implémentation** et **assume les compromis**.

## 2. Décisions tranchées (questions ouvertes)

| # | Question ouverte | Décision | ADR |
|---|---|---|---|
| D1 | Quel module extraire en microservice ? | **Pricing** (composant chaud, quasi-stateless, justifie C1 *et* C3 sans toucher l'atomicité argent) | ADR-002 |
| D2 | Stockage de l'Event Sourcing ? | **Table append-only dans le même Postgres** (« ES light » : journal + ligne d'état courant faisant autorité) | ADR-005 |
| D3 | Read-model Redis vs Postgres ? | **Hybride** : Postgres source de vérité + read-your-writes ; Redis = cache du **marché chaud** (cotes/totaux/reporting public) | ADR-006 |
| D4 | Bus + Outbox : techno & relais ? | **Outbox Postgres + relais polling** publiant sur **BullMQ** ; `@nestjs/cqrs` in-process en intra-module ; idempotence consommateur | ADR-008 |
| D5 | Front : SPA vs UI minimale ? | **Tranché : UI minimale** (évolutive) suffisante pour les 4 parcours, async **rendu observable** | ADR-011 |
| D6 | Périmètre de la Saga (induit) | **Chemin argent atomique par défaut** ; Saga orchestrée *conçue* pour le paiement externe (Stripe) ; recrédit idempotent *démontré* via l'annulation d'événement | ADR-004 |

---

## 3. ADRs

### ADR-001 — Style : monolithe modulaire NestJS « ready-to-split »

**Décision.** Un monolithe modulaire NestJS, 1 module = 1 bounded context (Identity, Wallet, Responsible Gaming/Compliance, Catalog, Betting, Pricing, Game Integration, Shared Kernel). Frontières dures vérifiées en CI (build cassé à toute violation). Hexagonal (ports/adapters). Communication inter-contextes par événements + Outbox. La contrainte 3 (« déploiement indépendant ») est **reformulée** : *capacité de découpe à la demande là où le besoin métier le justifie*, prouvée par l'extraction effective d'**un** service (ADR-002).

**Alternatives écartées.** (a) *Microservices complets (8 services)* : hors budget junior/1 semaine, et inutile à démontrer — multiplie les dual-writes (cf. ADR-003) sans bénéfice pédagogique. (b) *Monolithe non modulaire* : ne prouve ni les frontières ni C3.

**Compromis.**
- **Gain** : un seul artefact à opérer, atomicité possible sur le chemin argent (ADR-003), frontières testables statiquement, coût d'évolution maîtrisé.
- **Perte** : C3 n'est nativement satisfaite que sur la frontière extraite (1/8) ; le reste reste co-déployé/co-versionné.
- **Condition** : la découpe doit être *falsifiable* — frontière réseau réelle + Outbox + (idéalement) base/schéma isolé pour le module extrait, sinon « ready-to-split » est un slogan.

**Ancrage.** Objection avocat microservices ; faisabilité junior. Frontières vérifiées par outillage (ADR-008).

---

### ADR-002 — Module extrait pour la preuve : **Pricing**

**Décision.** Extraire **Pricing** en microservice NestJS (transporter). Pricing ne lit jamais la base Betting : il **consomme les événements `BetPlaced`** (issue + montant), maintient ses **propres totaux par issue**, et **republie `OddsUpdated`** que le read-model et le Catalog consomment.

**Alternatives écartées.** *Game Integration* : bon candidat (ACL d'un tiers, isolement de l'API Riot — déjà caché/temporisé dans le legacy, `LoLEsportsService.php:20-31`), mais il est I/O-bound sur un tiers ; l'extraire prouve l'*isolation d'une intégration*, pas la *scalabilité indépendante d'un composant interne chaud* (moins aligné sur C1).

**Compromis.**
- **Gain** : prouve C1 (scale-out du composant chaud) **et** C3 (déploiement indépendant) d'un même geste ; Pricing tombant n'arrête pas `placeBet` (cote figée sur la dernière valeur publiée) ; n'altère pas l'atomicité argent (ADR-003).
- **Perte** : Pricing a besoin des totaux de mises → introduction d'un **contrat d'événements** (`BetPlaced`/`OddsUpdated`) et d'un état dérivé dans Pricing ; cohérence éventuelle des cotes affichées.
- **Condition** : Pricing s'alimente **uniquement** par événements (jamais la BDD de Betting) ; les cotes restent **indicatives jusqu'au lock** (cf. ADR-007) ; idempotence sur `BetPlaced` (ADR-008).

**Ancrage.** Le legacy calcule la cote en lisant `BetRepository` (`OddsCalculatorService.php:51-59`) **dans** la transaction de pari (`BettingService.php:62`) : c'est précisément ce couplage écriture↔pricing qu'on rompt.

---

### ADR-003 — Atomicité du chemin argent : Wallet + Bet + Outbox dans **une seule transaction Postgres**

**Décision.** Sur le chemin critique de la pose de pari, **Wallet, l'agrégat Bet (état + événement) et la ligne Outbox vivent dans la même base Postgres et sont écrits dans une seule transaction**. Le débit du solde, l'INSERT du pari, l'écriture de l'événement `BetPlaced` et l'écriture Outbox **commitent ensemble ou pas du tout**. Aucune écriture d'argent ne traverse une frontière réseau de façon synchrone.

**Alternatives écartées.** (a) *Wallet en service séparé dès le POC* : recrée le dual-write (débit ici, pari là-bas) → fenêtre de perte sous crash ; rejeté. (b) *Saga à réservation de fonds (`reserve`/`confirm`)* : nécessaire **seulement** si l'argent est dans un autre service/un tiers async → repoussé au cas Stripe (ADR-004).

**Compromis.**
- **Gain** : conserve la garantie « zéro perte » que le legacy avait par construction (`flush()` unique, `BettingService.php:56-64`) ; supprime la fenêtre de dual-write sur l'argent ; démontrable simplement (un test qui *fait échouer* une étape et vérifie le rollback).
- **Perte** : couple physiquement Wallet et Betting à la même base → ces deux contextes ne sont **pas** indépendamment déployables (assumé : la frontière de preuve C3 est Pricing, pas Wallet).
- **Condition** : ne **jamais** mettre une étape réseau/async **après** le débit dans la même unité logique ; si un jour l'argent passe par un tiers async, basculer ce flux précis en Saga (ADR-004).

**Ancrage.** Objection auditeur argent (régression d'atomicité). `WalletService.debit` ne `flush()` pas lui-même (`:27-38`) → déjà conçu pour être atomique avec l'appelant.

---

### ADR-004 — Saga & compensation : périmètre POC

**Décision.** Deux régimes explicites :
1. **Wallet fictif (défaut démo)** : pas d'orchestrateur. Le chemin argent est atomique (ADR-003). La **compensation/recrédit idempotent** est néanmoins *démontrée* via le parcours **« événement annulé → remboursement des paris en attente »** (équivalent de `cancelBetsForEvent`, `BettingService.php:100-118`), rendu **idempotent**.
2. **Paiement externe (Stripe, stretch)** : *conçu* en **Saga orchestrée** + Outbox + idempotence + **transactions compensatoires** (recrédit) + **notification** utilisateur + Circuit Breaker/timeout/retry (opossum). C'est le flux du diagramme « placeBet en erreur de paiement » (voir `diagrams.md`).

**Alternatives écartées.** *Saga orchestrée généralisée à tout pari dès le POC* : ~2-3 j de plomberie pour un chemin qui n'a **aucune étape externe async** par défaut → gold-plating (faisabilité). *Chorégraphie événementielle pure* : plus dure à raisonner/auditer pour une équipe junior sur de l'argent.

**Compromis.**
- **Gain** : « zéro perte » prouvé sans moteur de saga ; budget préservé ; la Saga reste **présentée** (slide + diagramme) comme la réponse au cas externe, montrant la maîtrise.
- **Perte** : la démo n'exécute pas une vraie saga multi-étapes (seulement la compensation) → le jury pourrait la vouloir live (cf. risques).
- **Condition** : la promesse publique devient **« zéro perte après réconciliation »** (un job vérifie : Σ transactions = solde ; tout `Bet` débité a sa contrepartie) ; idempotence consommateur obligatoire (ADR-008) ; transition `PENDING → COMPENSATING` en **CAS atomique** pour interdire le double-crédit si le pari a déjà évolué.

**Ancrage.** Auditeur (compensation ≠ rollback, double-crédit si le pari a avancé entre-temps) + faisabilité (coupe). Le legacy rembourse sans garde d'idempotence (`:100-118`) → faille à corriger explicitement.

---

### ADR-005 — Traçabilité : journal d'événements **append-only** sur Bet (ES ciblé, sans état reconstruit faisant autorité)

**Décision.** L'agrégat **Bet** émet des **événements immuables** (`BetPlaced`, `BetWon`, `BetLost`, `BetVoided`, `BetRefunded`, `BetCompensated`) dans une **table append-only** du même Postgres. Cette table est **l'audit/historique** (défi 2) et permet le **rejeu pour reconstruire les projections** (read-model). **Mais** l'état courant fait autorité via une **ligne de snapshot** (`status`, `lockedOdds`) : on n'exige pas la reconstruction par rejeu pour lire/régler un pari.

**Alternatives écartées.** (a) *Event Sourcing complet (état = pur rejeu d'événements)* : impose versionnage/upcasting et reconstruction systématique → coût élevé pour une équipe junior, pour un seul agrégat (examinateur). (b) *Simple ledger sans événements de cycle de vie* : le legacy a déjà un journal `Transaction` (`WalletService`) mais il ne trace pas le **cycle de vie du pari** ni ne permet le rejeu de projections.

**Compromis.**
- **Gain** : audit complet + rejeu des projections **sans** payer le coût du full-ES ; atomicité événement+état+Outbox dans une transaction (ADR-003) ; rejeu simple (`SELECT … ORDER BY seq`).
- **Perte** : double écriture *logique* (événement + snapshot) à garder cohérente ; pas de subscriptions/projections natives (à coder).
- **Condition** : ES **confiné à Bet** ; colonnes `eventType` + `version` + un **upcaster** dès le départ ; le snapshot est dérivable du journal (invariant testé).

**Ancrage.** Examinateur (ES = pattern de CV si le besoin de rejeu n'est pas nommé) ; défi 2 du sujet (historique/audit/rejeu) ; ledger existant (`WalletService.php:40-64`).

---

### ADR-006 — CQRS & lecture : Postgres source de vérité + read-your-writes ; Redis = cache du marché chaud

**Décision.** CQRS comme **couture logique** : `@nestjs/cqrs` (CommandBus/QueryBus) sépare écriture et lecture sans imposer deux stores partout. **Postgres reste la source de vérité.** Les **données propres au joueur** (son pari fraîchement posé, son solde, son historique, son plafond) sont lues **en read-your-writes sur Postgres**. **Redis** porte uniquement le **read-model du marché chaud** : cotes courantes, totaux par issue, reporting public agrégé, alimenté par le flux `OddsUpdated` (ADR-002).

**Alternatives écartées.** (a) *Tout en read-model Redis* : lag → bug « où est mon pari ? », SPOF, et risque de lire un **solde** périmé (inacceptable sur l'argent). (b) *Pas de CQRS du tout* : perd l'argument d'architecture et la voie de scale-out de la lecture chaude.

**Compromis.**
- **Gain** : pas de « où est mon pari ? » (lecture joueur cohérente) ; l'argent n'est jamais lu depuis un cache ; la lecture chaude publique se scale via Redis ; CommandBus/QueryBus ≈ coût nul.
- **Perte** : deux chemins de lecture (Postgres + Redis) → un peu plus de code ; cohérence éventuelle assumée **sur les seules données publiques**.
- **Condition** : Redis traité comme **cache reconstructible** (rejouable depuis le journal Bet / Postgres), **jamais autoritatif**, **jamais** pour le solde.

**Ancrage.** Sceptique scalabilité (lag, SPOF, read-your-writes) ; auditeur (source de vérité argent = Postgres).

---

### ADR-007 — Pricing **asynchrone** (BullMQ) : justifié par le découplage du chemin d'écriture, cote figée, pré-match

**Décision.** Le calcul de cote sort du chemin d'écriture : `placeBet` n'attend pas le recalcul. La pose émet `BetPlaced` ; **Pricing** (workers BullMQ) recalcule **hors transaction** et publie `OddsUpdated`. La cote est **figée (`lockedOdds`) à la pose** : un recalcul concurrent ne modifie jamais un pari déjà posé. Le POC reste **pré-match** (pas de live).

**Alternatives écartées.** (a) *Recalcul synchrone (comme le legacy)* : sérialise les écritures sur l'événement chaud (`BettingService.php:62`) → contention au pic. (b) *Async + acceptation de cotes périmées en live* : ouvre le **latency betting** (un parieur plus rapide que le recalcul mise à une cote invalide). 

**Compromis.**
- **Gain** : `placeBet` court (INSERT + débit + Outbox), insensible au coût `O(nb paris)` du recalcul ; scale-out des workers indépendant de l'API (et du monolithe).
- **Perte** : fenêtre de **cote affichée périmée** pendant le recalcul ; cohérence éventuelle des cotes.
- **Condition** : argument de soutenance = **découplage d'écriture** (pas « accélérer une division ») ; en **pré-match**, le risque de cote périmée est quasi nul → l'assumer explicitement ; pour un futur **live**, imposer *suspension du marché pendant recalcul matériel* **ou** rejet si dérive `|odds_live − lockedOdds| > seuil`. L'async est défendu comme **preuve d'architecture**, pas comme nécessité de perf chiffrée (hypothèse de charge non validée).

**Ancrage.** Sceptique + examinateur (la cote est « une division », `OddsCalculatorService.php:44`) ; faisabilité (rendre l'attente **observable** dans l'UI, ADR-011).

---

### ADR-008 — Communication : Transactional Outbox (polling) + BullMQ ; **idempotence côté consommateur**

**Décision.** Écritures inter-contextes via **Transactional Outbox** : l'événement est inséré dans la table Outbox **dans la même transaction** que le changement d'état (ADR-003/005). Un **relais par polling** lit l'Outbox et publie sur **BullMQ** (Redis), y compris vers le service Pricing extrait. En intra-module, bus `@nestjs/cqrs` in-process. **Tout consommateur est idempotent** : table `processed_messages(messageId UNIQUE)` écrite **dans la même transaction** que l'effet métier.

**Alternatives écartées.** (a) *CDC/Debezium* : composant supplémentaire à opérer → coût injustifié pour le POC (faisabilité). (b) *EventEmitter in-process pour tout* : aucune durabilité, casse à l'extraction de Pricing. (c) *Idempotence côté producteur seule* : insuffisante — la livraison **at-least-once** duplique côté consommateur.

**Compromis.**
- **Gain** : livraison durable *at-least-once* qui survit au crash et franchit la frontière du service extrait ; aucune infra au-delà de Redis (déjà présent).
- **Perte** : latence de polling (faible) ; obligation d'idempotence partout (discipline).
- **Condition** : clé d'idempotence = **identifiant de commande/message unique par tentative** (jamais dérivée de données métier), **sans expiration** sur le chemin argent ; relais Outbox au moins *at-least-once* + dédup consommateur.

**Ancrage.** Auditeur (at-least-once ⇒ idempotence consommateur ; clés sans expiration sur l'argent) ; faisabilité (polling, pas CDC).

---

### ADR-009 — Extensibilité : Strategy + Factory **+ Settlement polymorphe + statut d'issue** ; Catalog N-issues générique

**Décision.** Points d'extension explicites : `BetTypeStrategy` (calcul/validation d'un type de pari), `GameProviderInterface` + **ACL par fournisseur** (intégration d'un jeu), **et surtout `SettlementStrategy`** (règlement) avec un **statut d'issue riche** (`WON`/`LOST`/`VOID`/`PARTIAL`) au lieu d'un booléen. Le Catalog est **générique N-issues** : un événement porte une liste de **participants/issues**, **sans** `teamA`/`teamB`. La promesse publique est **« extension additive et localisée, sans réécriture de l'existant »** — pas « zéro code ».

**Alternatives écartées.** (a) *Strategy sur le seul calcul de cote* (promesse « zéro code ») : **mythe** — un nouveau type touche aussi validation, projection read-model, migration et **settlement** ; le modèle « N-issues » fuit au règlement (void/nul/score/dead-heat). (b) *Garder `teamA`/`teamB`* : binaire, non multi-jeux.

**Compromis.**
- **Gain** : ajouter un type de pari ou un jeu = **N fichiers nouveaux + 1 ligne d'enregistrement**, zéro réécriture du moteur existant ; corrige le settlement binaire du legacy.
- **Perte** : un point d'enregistrement (factory/module DI) est **toujours touché** (pas littéralement zéro) ; l'**ACL est bespoke par fournisseur** (coût réel par jeu) ; versionnage d'événements quand un type change la structure (upcaster, ADR-005).
- **Condition** : settlement + validation + projection + ingestion doivent **tous** être des points d'extension polymorphes ; statut d'issue explicite dès le modèle.

**Ancrage.** Gardien évolutivité : settlement binaire (`BettingService.php:80`), `teamA`/`teamB` en dur (`SportEvent.php:44-52`) coexistant avec `outcomes` (`:85`), ingestion LoL qui force le binaire (`LoLEsportsService.php:90-102`).

---

### ADR-010 — Conformité légale : paramètres déclaratifs à chaud **vs** logique = code + déploiement

**Décision.** Contexte **Compliance** dédié. Distinguer deux niveaux :
1. **Paramètres déclaratifs** (seuils de plafond, **durée du délai légal**, activation/désactivation d'une règle existante) → table de configuration **validée par schéma (JSON-Schema)**, rechargée à chaud, **auditée et versionnée**. *Vrai* « sans redéploiement ».
2. **Logique nouvelle** (nouvelle catégorie de contrôle, KYC, nouvelle mécanique) → **code + déploiement**, assumé.

Plafond quotidien configurable **par joueur**, calculé **net des annulations/remboursements**.

**Alternatives écartées.** (a) *Règles = Strategies TypeScript* uniquement : changer « 48 h → 24 h » impose un **redéploiement** → contredit la promesse. (b) *Moteur de règles / DSL Turing-complet en config* : porte dérobée non testée, risque sécurité supérieur au gain pour une équipe junior.

**Compromis.**
- **Gain** : suit une législation mouvante **sur ses paramètres** sans redéploiement ; auditable ; sûr.
- **Perte** : une *nouvelle* règle reste un déploiement (promesse nuancée, pas absolue).
- **Condition** : validation stricte (schéma) + audit + qui/quand ; ne pas promettre « toute la conformité sans redéploiement ».

**Ancrage.** Gardien évolutivité : 48 h codé en dur (`ResponsibleGamingService.php:135`), plafond = somme brute de paris (`:152-157`) → à recalculer net des `CANCELLED`.

---

### ADR-011 — Interface web minimale, async **observable**

**Décision.** UI **minimale** (server-rendered ou React léger servi par le monolithe) couvrant les 4 parcours : gestionnaire crée un marché **3 issues** (victoire A / victoire B / **nul**) ; joueur pose un pari sur **cote figée**, consulte son **historique**, définit son **plafond quotidien** ; reporting. L'attente du recalcul est **rendue visible** (badge « cote en recalcul → figée »). **Tranché** : UI minimale au départ, **évolutive** — une SPA pourra la remplacer plus tard sans toucher au back grâce à la séparation API/CQRS.

**Alternatives écartées.** *SPA séparée complète (React/Angular/Vue)* : ~plusieurs jours hors budget, déplace l'effort hors de la thèse d'architecture (faisabilité).

**Compromis.**
- **Gain** : budget concentré sur la démonstration backend ; l'async devient une **feature démontrée** et non un bug perçu.
- **Perte** : pas de vitrine SPA/séparation front-API ; UI sobre.
- **Condition** : l'UI doit exposer clairement les 4 parcours et l'observabilité de l'async ; sinon le message « scalable » ne passe pas.

**Ancrage.** Faisabilité (coupe SPA, async observable, captures de secours pour la démo live).

---

### ADR-012 — Modèle de charge déduit & paliers de montée en charge

**Décision.** Le sujet ne donne aucun chiffre : on le **déduit** d'un ancrage sourcé (pic finale LoL Worlds 2024 — 6,94 M spectateurs simultanés hors Chine, ~50 M Chine incluse) via l'entonnoir d'hypothèses de la §0, puis on dimensionne par **paliers** et on adapte les leviers à chacun :

- **Palier 0 — démo/soutenance (≤ ~50 paris/min, 1 instance).** Monolithe mono-instance + 1 worker Pricing. CQRS/async présents comme *preuve d'architecture*, pas par nécessité de charge.
- **Palier 1 — pic dérivé attendu (~2 000–6 000 paris/min, ~33–100/s ; ~40–120 k lectures/min).** Chemin d'écriture **append-only** (INSERT pari + événement + outbox en une transaction, aucun UPDATE de ligne chaude) → ~100 tx/s tiennent sur un seul Postgres bien indexé ; **Pricing en N workers** (recalcul débouncé par événement) scale indépendamment ; **read-model Redis** absorbe les lectures publiques ; lectures joueur en read-your-writes. Palier que le POC vise à *illustrer*.
- **Palier 2 — stretch / multi-finales (~20 000 paris/min, ~350/s).** Partitionnement Postgres par événement + pgBouncer, relais Outbox parallélisé, davantage de workers Pricing, réplicas de lecture + cache edge des cotes publiques. **Seuil de bascule du bus** : remplacer BullMQ/Redis par un log partitionné (Kafka/Redpanda) **seulement ici** (calibrage junior : pas avant).

**Principe d'adaptation.** L'architecture est **élastique en débit sur les axes lecture et pricing** (scale-out sans état) et **anti-contention sur l'axe écriture** (append-only + cote figée + wallet par utilisateur). Le seul point non scalable par ajout d'instances — la sérialisation d'écriture sur l'événement chaud — est supprimé par conception (c'est exactement ce que le legacy faisait mal, `BettingService.php:62`).

**Alternatives écartées.** *Dimensionner pour le palier 2 d'emblée* (Kafka, sharding) : sur-ingénierie hors charge dérivée et hors calibrage junior. *Ignorer la charge* (« ça suffira ») : indéfendable en soutenance.

**Compromis.** Gain : justification chiffrée, traçable, et montée en charge par leviers identifiés. Perte : les coefficients de l'entonnoir (pénétration, taux de pari) restent des hypothèses. Condition : présenter l'entonnoir **et ses hypothèses** + les seuils de bascule, pas un chiffre unique « magique ».

**Ancrage.** Pic spectateurs sourcé (Esports Charts, repris par plusieurs médias) ; entonnoir = hypothèses marquées ; axe critique (contention écriture / fraîcheur cote) issu du challenge scalabilité.

---

### ADR-013 — Réconciliation argent : ledger autoritaire **signé** + rapport **sans auto-correction** (BET-15)

**Décision.** Le **filet** de la promesse « zéro perte **après réconciliation** » (condition d'ADR-004/008) est **implémenté**. Le ledger `wallet_operations` devient le **journal autoritaire de TOUS les mouvements signés** (ouverture `OPENING`, débit `DEBIT` négatif, crédit/remboursement `CREDIT`), chaque ligne écrite **dans la même transaction** que l'`UPDATE` du solde → invariant **`Σ(amount) == balance`** vrai à chaque commit. Un job **sur demande** (`GET /admin/reconciliation`, schedulable) compare, pour chaque wallet, Σ(ledger) au solde stocké (**une seule requête** = instantané cohérent) et **rapporte** les écarts. **Aucune auto-correction** : le job est en **lecture seule** (rejouable, idempotent, pas de double-rapport) ; corriger de l'argent est une action **revue**, pas un effet de bord.

**Alternatives écartées.** (a) *Solde attendu dérivé des events de pari (Betting)* : franchit la frontière Wallet→Betting, c'est une **estimation** d'un autre contexte (le sujet veut une source autoritaire) et ignore les mouvements non-pari → rejeté au profit du ledger **propre au Wallet**. (b) *Réconciliation crédits-seuls (l'état antérieur)* : ne couvrait pas les débits → ne prouve pas Σ=solde → non autoritaire. (c) *Auto-correction du solde par le job* : effet de bord qui déplace de l'argent sans revue → interdit.

**Compromis.**
- **Gain** : source autoritaire **explicite et locale** (zéro lecture cross-contexte → frontière respectée) ; dérive **détectable**, y compris causée par une corruption hors application ; insensible à l'**async en vol** — l'Outbox/BullMQ ne transporte que des événements, jamais l'argent, donc un Outbox non drainé n'a bougé ni le solde ni le ledger (aucun faux positif).
- **Perte** : le **débit passe sur le chemin chaud journalisé** (un INSERT de plus par pose) et devient exactement-une-fois ; une dérive détectée exige une **action manuelle** (pas d'alerting ni de workflow de correction dans le POC) ; l'invariant n'est qu'une **égalité de sommes** — il ne vérifie pas que *chaque débit de pari a sa contrepartie de règlement* (contrôle par-pari distinct, **non implémenté**).
- **Condition** : tout mouvement DOIT écrire sa ligne ledger **dans la transaction** du solde (sinon faux écart) ; toute **purge** de `wallet_operations` doit préserver l'invariant (snapshot de solde requis) ; l'ouverture de wallet écrit son **entrée d'ouverture**.

**Preuve.** `npm run test:reconciliation:pg` sur **vrai Postgres** : ouverture, cycle open→pari→règlement (Σ=solde), **en vol** (Outbox non drainé → balanced), **dérive injectée** (+50 hors ledger → détectée/rapportée, **non corrigée**), **idempotence** (rejeu = rapport identique, 0 écriture), **multi-wallets**. Non-régression money-safety : `test:atomicity:pg` (18 cas, débit désormais journalisé). Arbitrage de la **source autoritaire** tranché explicitement avec le porteur du projet.

**Ancrage.** Auditeur argent (compensation ≠ rollback, double-crédit) ; condition posée par ADR-004/ADR-008 ; ledger legacy `WalletService.php:40-64` qui ne tracait pas le cycle de vie.

---

## 4. Risques résiduels & questions probables du jury

### 4.1 Risques résiduels (fragile / à valider)

- **Coefficients de l'entonnoir de charge à affiner** : l'ancrage spectateurs est sourcé, mais la pénétration (p) et le taux de pari (b) sont des hypothèses. Le dimensionnement suit des **paliers** (ADR-012) ; l'async se défend d'abord par le **découplage d'écriture** (preuve), pas par la perf brute.
- **C3 satisfaite sur 1 frontière** : Wallet/Betting restent co-déployés (choix d'atomicité, ADR-003). Assumé, mais c'est l'angle d'attaque n°1.
- **Cohérence éventuelle des cotes** (ADR-007) : en pré-match seulement ; **non tenable tel quel en live** (latency betting) — extension live = travail supplémentaire (suspension/seuil).
- **Idempotence & réconciliation** : la garantie « zéro perte » devient « zéro perte **après réconciliation** ». Le **job existe désormais** (BET-15 / ADR-013 : `GET /admin/reconciliation`, invariant `Σ(ledger) == solde` prouvé sur vrai Postgres) et la dédup consommateur aussi (`processed_messages`). Résiduel : pas d'**alerting** ni de **correction** automatisée (action manuelle revue), et l'invariant est une **égalité de sommes** — le contrôle *par-pari* « tout débit a sa contrepartie » reste à ajouter.
- **Snapshot vs journal** (ADR-005) : invariant « snapshot dérivable du journal » à tester, sinon divergence silencieuse.
- **Démo multi-process fragile** : Postgres + Redis + workers + service Pricing → `docker-compose` unique + **captures vidéo de secours** de chaque parcours.
- **Charge cognitive junior** : le **plan de formation** doit séquencer les patterns ; risque réel si un seul développeur doit tout maintenir.
- **Settlement** : `WON`/`LOST`/`VOID` **livrés** (BET-12, couture Strategy, crédit exactement-une-fois, remboursement exact) ; `PARTIAL` reste un **statut** que la couture peut produire, **sans** logique de partial-payout implémentée (ADR-009).

### 4.2 Questions que le jury posera (et la ligne de défense)

1. **« Un monolithe, et vous parlez de déploiement indépendant ? »** → C3 reformulée en *capacité de découpe* ; **preuve falsifiable** : Pricing extrait avec contrat réseau + Outbox + état propre. Les workers BullMQ se scalent déjà indépendamment.
2. **« Pourquoi l'asynchrone pour une simple division ? »** → Pas le CPU : le legacy recalcule **dans la transaction de pari** (`BettingService.php:62`) et **sérialise** les écritures sur l'événement chaud. L'async protège `placeBet`. Charge **déduite** (entonnoir sourcé) et dimensionnement par **paliers** (ADR-012).
3. **« Où l'argent peut-il se perdre ? »** → Nulle part sur le chemin par défaut : **atomique en une transaction Postgres** (ADR-003). Et en **filet** : la **réconciliation est implémentée** (BET-15 / ADR-013) — ledger signé autoritaire, invariant `Σ(ledger) == solde`, dérive **détectée et rapportée sans auto-correction** (prouvé sur vrai Postgres, dérive injectée comprise). Pour le paiement externe : Saga + idempotence consommateur + compensation gardée. « Zéro perte **après réconciliation** » — désormais démontrable, pas seulement promis.
4. **« Event Sourcing : surdimensionné ? »** → ES **ciblé sur Bet**, **light** (journal + snapshot autoritatif) ; on nomme le besoin de **rejeu** (reconstruction de projections, litige à T) ; sinon on aurait gardé un simple ledger.
5. **« Ajouter un jeu/type de pari = vraiment zéro code ? »** → Non : **additif et localisé**. On montre `BetTypeStrategy` + `SettlementStrategy` + statut d'issue ; on assume le point d'enregistrement et l'ACL par fournisseur.
6. **« Changer une règle légale sans redéployer ? »** → Oui pour les **paramètres** (table validée, hot-reload, audit — ex. 48 h) ; non pour une **logique nouvelle** (code + déploiement).
7. **« Équipe junior et toute cette pile ? »** → Distinction *build-time/run-time* : seuls 2-3 patterns sont sur le chemin de la démo ; ES/Saga/microservice sont des **démonstrateurs isolés** ; coût cognitif chiffré dans le plan de formation ; coupes assumées (ADR-004).
8. **« Le lag du read-model ne casse-t-il pas l'UX ? »** → Données joueur en **read-your-writes Postgres** ; Redis ne porte que le marché public ; l'argent n'y est jamais lu.

---

*Sources internes (code de référence vérifié) :* `symfony_paris_sportif-main/src/Service/{BettingService,OddsCalculatorService,ResponsibleGamingService,WalletService,LoLEsportsService}.php`, `src/Entity/{SportEvent,Bet}.php`. *Méthode :* challenge adversarial à 6 agents (avocat microservices, auditeur argent, sceptique scalabilité, faisabilité junior, gardien évolutivité, examinateur soutenance).
