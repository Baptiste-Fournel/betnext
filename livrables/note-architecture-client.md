# BetNext — Ce que change la nouvelle architecture (note pour l'équipe BetNext)

> Note **fonctionnelle** : pourquoi nous avons refondu les fondations de la plateforme, ce que cela
> corrige par rapport à la version précédente, et ce que vous y gagnez. La technique n'est présentée
> qu'« en gros ».

---

## En une phrase

La première version fonctionnait, mais elle **calculait les cotes au mauvais moment**, restait **figée
sur un match « équipe A contre équipe B »**, et **ne garantissait pas l'argent** en cas d'incident. La
nouvelle plateforme corrige ces trois points par conception : **rapide sous forte affluence**,
**ouverte à de nouveaux jeux**, et **sûre sur l'argent**.

---

## Pourquoi refondre ? Les limites de l'ancienne plateforme

En termes simples, l'ancienne version (Symfony) avait quatre faiblesses **fonctionnelles** :

1. **Lenteur potentielle au pic.** À chaque pari posé, la plateforme **recalculait toutes les cotes
   dans la foulée**, en interrogeant la base. Quand beaucoup de monde parie en même temps (une finale),
   ce travail s'accumule **sur le chemin du pari** et peut le ralentir, voire le bloquer.
2. **Format de match rigide.** Un événement était obligatoirement **« équipe A vs équipe B »**. Ajouter
   un format différent (match nul, plusieurs équipes, autre type de pari, autre jeu) demandait de
   retoucher le cœur du système.
3. **Risque sur l'argent en cas d'incident.** Les remboursements et gains n'avaient **pas de garde-fou
   solide contre le double paiement** (rejeu, double-clic, traitement relancé), et un seul paiement en
   échec pouvait **bloquer le règlement de tous les autres** paris du match.
4. **Historique pauvre.** On connaissait l'**état final** d'un pari (gagné/perdu), mais pas son
   **historique** détaillé — peu pratique pour l'audit, le support client ou un litige.

---

## Ce qui change — avant / maintenant

| Sujet | Avant (ancienne plateforme) | Maintenant (BetNext) | Ce que vous y gagnez |
| --- | --- | --- | --- |
| **Cotes & affluence** | Cotes recalculées **pendant** la pose du pari | Cotes calculées **à côté**, en continu ; **figées** au moment du pari | Parier reste **rapide et stable** même en pleine finale ; la cote affichée au pari est celle qui s'applique |
| **Nouveaux jeux / formats** | Match figé **A vs B** | Modèle **générique à N issues** (2, 3 issues ou plus) | **Ajouter un jeu ou un format = sans refonte** (souvent une simple création de marché) |
| **Sécurité de l'argent** | Pas de garde anti-double-paiement ; un échec bloque tout | **Aucune perte par conception** : chaque paiement compté **une seule fois**, paris réglés **indépendamment**, + un **contrôle de cohérence** qui détecte tout écart | **Confiance** : l'argent des joueurs est protégé, les incidents sont signalés |
| **Historique d'un pari** | État final seulement | **Journal complet et inviolable** de la vie de chaque pari | **Audit, support et litiges** facilités |
| **Évolutivité** | Tout est lié, dur à faire grandir | Découpé en **modules indépendants**, dont un peut tourner **séparément** | **Évolutions plus sûres** et montée en charge ciblée |

---

## Les grands choix d'architecture (en clair)

- **Une plateforme en modules étanches.** Le système est découpé en domaines clairs — *paris*,
  *portefeuille*, *jeu responsable*, *catalogue de matchs*, *cotes*. Ils communiquent par messages, pas
  en se mélangeant. **Bénéfice** : une modification dans un domaine ne casse pas les autres — c'est
  vérifié automatiquement à chaque livraison.

- **Le calcul des cotes mis « à côté ».** Le moteur de cotes a été **sorti du parcours de pari** et peut
  même tourner sur sa propre machine. S'il ralentit, **on peut quand même parier** (la cote a été figée).
  **Bénéfice** : robustesse et capacité à encaisser les pics.

- **L'argent d'abord (« zéro perte »).** Poser un pari (débit + enregistrement) se fait en **un seul
  geste tout-ou-rien** : soit tout réussit, soit rien n'est débité. Les gains et remboursements ne
  peuvent **pas** être payés deux fois. En plus, un **contrôle de réconciliation** vérifie en
  permanence que *la somme des mouvements = le solde* et **signale** toute anomalie (sans toucher
  l'argent automatiquement — une correction reste une décision humaine). **Bénéfice** : sécurité
  financière démontrable.

- **Tout l'historique d'un pari est gardé.** Chaque étape (posé → gagné/perdu/annulé) est inscrite dans
  un **journal inviolable**. **Bénéfice** : traçabilité totale pour l'audit et le support.

- **Conçu pour grandir et s'étendre.** Ajouter un **type de pari** ou une **règle de jeu responsable**
  se fait en **ajoutant un petit module**, sans réécrire l'existant. **Bénéfice** : le produit évolue
  vite et à moindre risque.

---

## Concrètement : ajouter un nouveau jeu

Grâce au modèle générique, **ajouter un jeu se résume souvent à créer son marché** (le match et ses
issues possibles) — **sans développement**. Si ce jeu introduit une **mécanique de pari inédite**, on
ajoute un petit module de règlement dédié, **sans toucher** au reste. (Le détail pas-à-pas est dans le
*plan de formation*, atelier « ajouter un jeu ».)

---

## Ce qui est déjà en place vs à venir (transparence)

**Déjà en place et démontré** : gestion des comptes / connexion (authentification + rôles), pose de
pari rapide et sûre, cotes en direct et figées, règlement (gagné / perdu / annulé), portefeuille avec
contrôle de cohérence, historique, plafond quotidien (jeu responsable), **connexion à un fournisseur de
matchs** (feed LoL Esports : événements à venir + résultats, avec règlement automatique), **dépôt par
carte** (prestataire Stripe), interface web des parcours joueur et gestionnaire.

**Conçu, prévu pour plus tard** (à durcir avant la production) :

- le **dépôt par carte** tourne aujourd'hui par défaut en mode démonstration (prestataire simulé) ; la
  vraie passerelle Stripe (mode test) s'active avec une clé ;
- la **connexion au fournisseur de matchs** tourne par défaut sur des données de démonstration
  (fixtures) ; le flux externe réel s'active avec son URL d'API.

---

## En résumé

La refonte ne change pas *ce que fait* la plateforme — elle change **comment elle le fait** : plus
**rapide** quand il y a du monde, **ouverte** à de nouveaux jeux et formats, et **sûre sur l'argent**,
avec un historique complet. Les fondations sont posées pour que les prochaines fonctionnalités
(nouveaux jeux, nouveaux types de paris, montée en charge) s'ajoutent **sans tout reconstruire**.
