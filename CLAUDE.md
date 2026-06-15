# Projet : BetNext — POC d'architecture multi-jeux (posture d'ARCHITECTE logiciel)

## Contexte
Projet d'architecture logicielle (ESGI, 4e année Ingénierie du Web). Auteur : Baptiste
Fournel. Objectif : concevoir une plateforme de paris e-sport modulaire, scalable et
multi-jeux, et le DÉMONTRER par un POC qui tourne. C'est un exercice de posture
d'architecte : chaque choix doit être justifié et chaque compromis assumé.

## Livrable confirmé (périmètre tranché par le prof)
- POC DE DÉMONSTRATION de l'architecture, construit FROM SCRATCH (pas de migration de
  l'ancien monolithe). Le code Symfony existant sert UNIQUEMENT de référence du domaine
  (règles métier, modèle de pari) — on ne le réutilise pas.
- Stack imposée : NestJS / TypeScript, choisie pour la maintenabilité et l'évolutivité.
- + un plan de formation des développeurs (livrable noté à part entière, voir plus bas).
- + une interface Web pour démontrer les parcours.

## Référence du domaine (à lire au début de chaque session, dans reference/)
1. Le PDF du sujet — 3 contraintes, 4 défis, plan de formation, bénéfices, étapes.
2. Mon analyse .docx — diagnostic du code legacy et mapping défi→pattern : à utiliser
   comme compréhension du domaine et réservoir d'arguments, PAS comme plan de migration
   (caduc depuis le « from scratch »).

## Architecture cible (NE PAS réinventer)
Style : MONOLITHE MODULAIRE NestJS « ready-to-split ». Un module Nest = un bounded
context. Frontières dures imposées (Nx module boundaries / eslint-plugin-boundaries /
dependency-cruiser cassant le build à toute violation), Hexagonal (ports/adapters),
communication inter-modules par bus + Transactional Outbox. Pour PROUVER concrètement
le « déploiement indépendant » (contrainte 3), extraire UN module en microservice NestJS
(transporter) dans le POC — typiquement Pricing ou Game Integration — le reste restant
en monolithe. Microservices complets = hors de portée et inutile à démontrer ici.

8 bounded contexts : Identity, Wallet, Responsible Gaming/Compliance, Catalog
(jeux/événements/marchés), Betting, Pricing, Game Integration, Shared Kernel.

## Mapping défi → pattern → implémentation NestJS (le cœur de la démo)
- Maintenabilité / évolutivité → Modular Monolith (modules Nest = contexts) + Hexagonal
  + frontières vérifiées en CI.
- Scalabilité (contrainte 1) → CQRS (@nestjs/cqrs : CommandBus/QueryBus) + read-model
  Redis + pricing ASYNCHRONE via file (BullMQ/Redis) + workers + scale-out horizontal.
- Déploiement indépendant (contrainte 3) → frontières « ready-to-split » + feature flags
  + 1 module extrait en microservice pour la preuve.
- Défi 1, lecture/écriture → CQRS : placeBet = INSERT pari + event (chemin d'écriture
  minimal) ; lecture/reporting via read-model Redis. La cote est calculée HORS du chemin
  d'écriture ; au moment du pari elle est FIGÉE (lockedOdds) → un recalcul concurrent ne
  change jamais un pari déjà posé. Concurrence BDD : verrou optimiste + transaction sur
  le débit du wallet.
- Défi 2, traçabilité → Event Sourcing CIBLÉ sur le seul agrégat Bet (events immuables,
  table append-only / EventStore) → HISTORIQUE DES PARIS + audit + rejeu.
- Défi 3, résilience + sécurité de l'argent → exigence ZÉRO ERREUR sur l'argent : si
  l'user paie et qu'une étape échoue, il faut corriger, l'informer, et RECRÉDITER son
  solde. Implémentation : Saga (orchestration) + Transactional Outbox + clés
  d'idempotence + transactions compensatoires (recrédit wallet) + notification user.
  Circuit Breaker (opossum) + Timeout/Retry sur les intégrations externes (Stripe, Riot).
- Défi 4, extensibilité → Strategy + Factory pour (a) les TYPES DE PARIS (ajouter un type
  sans toucher l'existant) et (b) les JEUX (GameProviderInterface en plugin + ACL).
  Modèle Catalog GÉNÉRIQUE : un événement a N issues, pas teamA/teamB binaire.
- Legal / conformité → contexte dédié, règles de gestion EXTERNALISÉES (Strategy /
  table de règles / config) pour pouvoir suivre une législation mouvante SANS réécrire le
  code (Open/Closed). Plafond quotidien de mise configurable PAR LE JOUEUR.

## Périmètre fonctionnel à couvrir dans le POC
- Rôle GESTIONNAIRE : consulte les événements à venir, crée un pari (marché) sur un
  événement.
- Marchés à 3 issues : victoire A / victoire B / match nul (via le modèle N-issues).
- Joueur : place un pari sur une cote figée ; consulte son historique ; définit son
  plafond quotidien.
- Reporting (côté query/read-model).
- Interface Web démontrant ces parcours.
- Cote calculée en asynchrone, figée au pari ; gestion des accès concurrents BDD.
- Sécurité argent : aucune perte ; correction + info + recrédit en cas d'erreur.
- Stripe : OPTIONNEL (stretch goal si le temps le permet). Par défaut, wallet fictif
  (solde incrémenté). Ne pas le mettre sur le chemin critique de la démo.

## Plan de formation des développeurs (livrable à part entière)
- Objectif pédagogique : expliquer l'architecture — comment elle a été pensée, ce qu'elle
  apporte, comment la prendre en main, COMMENT AJOUTER UN NOUVEAU JEU, et comment gérer
  l'impact d'un changement.
- Estimer la formation EN TEMPS (durée par module).
- Proposer un PLAN DE FORMATION ÉTALÉ DANS LE TEMPS (séquencement / calendrier).
- Produire le support du DÉBUT de la formation (la partie architecture) tenable en
  15 à 30 minutes de présentation.

## Calibrage (équipe junior — ne pas sur-concevoir)
Event Sourcing confiné au seul agrégat Bet. File Redis (BullMQ) avant tout broker lourd
type Kafka. Un seul module réellement extrait en service pour la preuve, pas huit. POC
démontrable > exhaustivité.

## Hypothèses encore à valider avec le prof (signaler, ne pas trancher seul)
- Charge cible chiffrée du « pic de compétition » (pour justifier l'async/CQRS) : à poser
  comme hypothèse argumentée si non fournie.
- Types de paris supplémentaires attendus au-delà des 3 issues (score exact, etc.).
- Interface Web : SPA séparée (React/Angular/Vue) ou UI minimale suffisante pour la démo.

## Méthode
Pour toute proposition : ancre-la dans une preuve (référence domaine ou code du POC),
explicite le compromis (gain/perte/condition), produis un diagramme quand c'est
pertinent. Pose tes questions AVANT d'exécuter si un point ci-dessus est flou.