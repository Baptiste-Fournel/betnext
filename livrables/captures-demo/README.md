# Captures de secours — démo de soutenance (BET-9)

> **Filet de secours visuel.** Si la démo live casse (réseau, port occupé, conteneur), ces
> captures prouvent les mêmes parcours. Elles ont été prises sur une **instance isolée** et
> **déterministe hors-ligne** (`DEMO_ISOLATED=1 scripts/demo-up.sh` → fixtures esports + PSP Stripe
> stub), donc reproductibles à l'identique. Pour les régénérer : voir le bas de ce fichier.
>
> Le second filet, complémentaire, reste les tests e2e (`npx jest src/demo-scenarios.e2e.spec.ts`)
> — cf. [`../demo-soutenance.md`](../demo-soutenance.md).

| # | Capture | Parcours prouvé |
|---|---------|-----------------|
| 1 | [`01-connexion.png`](01-connexion.png) | **Connexion** joueur — comptes de démo pré-remplis (`demo-player` / `changeme123`). |
| 2 | [`02-feed-matchs-a-venir.png`](02-feed-matchs-a-venir.png) | **Feed « matchs à venir »** — marché manuel + matchs LoL pro ingérés (badges ligue LEC/LCK/LPL + kickoff), cotes figées à l'ouverture. |
| 3 | [`03-coupon-cote-figee.png`](03-coupon-cote-figee.png) | **Pose de pari + coupon** — pari posé, **cote figée** + gain potentiel (vue d'ensemble joueur : feed, coupon, wallet, stats, historique). |
| 4 | [`04-stats-joueur.png`](04-stats-joueur.png) | **Statistiques joueur** scopées (paris, gagnés, mise totale, gains nets, taux de réussite) — non vides grâce au pari déjà réglé. |
| 5 | [`05-wallet-depot-stripe.png`](05-wallet-depot-stripe.png) | **Wallet + dépôt Stripe** (mode stub déterministe) — solde crédité après dépôt, mention saga « aucune perte ». |
| 6 | [`06-admin-creer-regler.png`](06-admin-creer-regler.png) | **Console gestionnaire** — créer un marché, ingérer le feed, régler à la main. |
| 7 | [`07-admin-sync-resultats.png`](07-admin-sync-resultats.png) | **Synchro des résultats** du feed → **règlement auto** : `1 pari réglé · 1 gagné · 1 match terminé`. |
| 8 | [`08-historique-pari-gagne.png`](08-historique-pari-gagne.png) | **Historique joueur** (event-sourcing) — le pari LEC passe **Gagné** après la synchro (`Posé → Gagné`). |

## Régénérer ces captures (instance isolée — ne touche ni :3000 ni l'infra live)

```bash
# 1) Stack isolée hors-ligne (ports 3300/3301/3302, Postgres dédié, fixtures + Stripe stub)
DEMO_ISOLATED=1 PG_PORT=55440 scripts/demo-up.sh

# 2) Chrome headless pour le pilotage CDP (aucune dépendance npm)
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --remote-debugging-port=9223 "--remote-allow-origins=*" \
  --user-data-dir=/tmp/betnext-cap-profile about:blank &

# 3) Génère les 8 PNG dans ce dossier
API=http://localhost:3300 PLAYER=http://localhost:3301 ADMIN=http://localhost:3302 \
  CDP=9223 OUT=livrables/captures-demo node scripts/capture-demo.mjs

# 4) Arrêt propre
DEMO_ISOLATED=1 PG_PORT=55440 DOWN_INFRA=1 PURGE_VOLUME=1 scripts/demo-down.sh
```
