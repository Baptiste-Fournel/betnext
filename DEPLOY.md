# Déploiement en ligne — BetNext

Mise en ligne **sans changer l'architecture** : le monolithe modulaire reste un monolithe,
le module Pricing reste extrait en service séparé (preuve du « déploiement indépendant »).

```
  Vercel                         Railway
  ┌──────────────┐   HTTPS       ┌─────────────────────────────────────────┐
  │ web-player   │──────────────▶│  API  (node dist/main.js)  [public]      │
  │ (Next.js)    │               │   ├─ migrations TypeORM jouées au boot   │
  ├──────────────┤               │   └─ scheduler esports (opt-in)          │
  │ web-admin    │──────────────▶│                                          │
  │ (Next.js)    │   HTTPS        │  worker (node dist/pricing.main.js)      │
  └──────────────┘               │                                          │
        ▲                        │  Postgres (plugin)   Redis (plugin)      │
        │ NEXT_PUBLIC_API_BASE_URL└─────────────────────────────────────────┘
        └─────────── = URL publique de l'API Railway
```

- **2 fronts → Vercel** : `web/apps/player`, `web/apps/admin` (monorepo npm workspace `web/`).
- **back + worker → Railway** : une seule image Docker (`Dockerfile`), deux services qui ne
  diffèrent que par leur start command. L'**API** est publique ; le **worker** Pricing ne
  communique que par le bus (Redis), il n'expose aucun port.
- **Postgres + Redis → plugins Railway managés** (`DATABASE_URL` / `REDIS_URL`).
- **Migrations** : jouées **au boot de l'API** (`PersistenceModule`, `migrationsRun: true`).
  Aucune release command séparée n'est nécessaire — le premier déploiement de l'API crée le
  schéma sur une base vierge.

> ⚠️ **Aucun secret n'est committé.** Tous les exemples ci-dessous utilisent des **placeholders**
> (`...`, `sk_test_...`). C'est à Baptiste de poser les vraies valeurs via les CLI.

---

## 1. Variables d'environnement (référence complète)

### Back (services Railway : API + worker)

| Variable | Service | Nature | Requis | Où l'obtenir / valeur |
|---|---|---|---|---|
| `DATABASE_URL` | API | **managé** | ✅ | **Auto-fourni par le plugin Postgres Railway.** Le poser via la référence `${{Postgres.DATABASE_URL}}` (Railway l'injecte entre services du même projet) — rien à copier-coller à la main |
| `REDIS_URL` | API + **worker** | **managé** | ✅ (async) | **Auto-fourni par le plugin Redis Railway.** Référence `${{Redis.REDIS_URL}}` (injecté automatiquement aux services du projet) |
| `AUTH_SECRET` | API | **secret** | ✅ | **Générer soi-même** : `openssl rand -hex 32` (jamais committé) |
| `PORT` | API | **auto** | ✅ | **Injecté par Railway** — ne pas poser à la main |
| `DB_POOL_SIZE` | API | config | — | Défaut `10` |
| `OUTBOX_POLL_MS` | API | config | — | Cadence du relais Outbox, défaut `500` |
| `ESPORTS_API_BASE_URL` | API | config | — | **Valeur publique** (feed LoL Esports) : `https://esports-api.lolesports.com`. Vide → **fixtures déterministes** (démo hors-ligne) |
| `ESPORTS_API_KEY` | API | clé publique | — | **Clé publique** du front lolesports.com (`x-api-key`) : `0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z`. Requise seulement si `ESPORTS_API_BASE_URL` est renseignée |
| `ESPORTS_SYNC_MIN_INTERVAL_MS` | API | config | — | Throttle synchro résultats, défaut `3000` |
| `ESPORTS_SCHEDULER_ENABLED` | API | config | — | `true` pour armer le rafraîchissement auto (sinon inactif) |
| `ESPORTS_SCHEDULER_INTERVAL_MS` | API | config | — | Intervalle du scheduler, défaut `300000` (5 min) |
| `STRIPE_SECRET_KEY` | API | **secret** | — | Dashboard Stripe → **Developers ▸ API keys** : <https://dashboard.stripe.com/test/apikeys> (clé `sk_test_...`). Vide → PSP factice |
| `RIOT_API_KEY` | API | secret | — | **Non utilisé par le code actuel** (le feed lit `ESPORTS_API_KEY`). Si un jour activé : portail Riot <https://developer.riotgames.com/> |

### Fronts (projets Vercel : player + admin)

| Variable | Nature | Requis | Où l'obtenir / valeur |
|---|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | config (publique) | ✅ | **URL publique du service API Railway**, obtenue après déploiement via `railway domain` (ou Railway ▸ service API ▸ Settings ▸ Networking ▸ *Public Domain*), ex. `https://betnext-api.up.railway.app` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | config (publique) | — | Dashboard Stripe → **Developers ▸ API keys** : <https://dashboard.stripe.com/test/apikeys> (clé `pk_test_...`). Seulement si Stripe Elements branché |

---

## 2. Prérequis (machine de Baptiste)

```bash
npm i -g @railway/cli vercel     # CLIs
railway login                    # ouvre le navigateur
vercel login                     # ouvre le navigateur
```

---

## 3. Railway — Postgres, Redis, API, worker

### 3.1 Projet + bases managées

```bash
# Depuis la racine du repo
railway init                       # crée/relie un projet Railway (choisir un nom, ex. betnext)
railway add --database postgres    # plugin Postgres managé → fournit DATABASE_URL
railway add --database redis       # plugin Redis managé → fournit REDIS_URL
```

### 3.2 Service API (public, Dockerfile, migrations au boot)

Railway lit `railway.json` (builder Docker + start `node dist/main.js` + healthcheck `/health`).
Crée le service depuis le repo, puis pose ses variables :

```bash
# DATABASE_URL / REDIS_URL : AUTO-FOURNIS par les plugins Postgres/Redis Railway.
# On ne colle aucune valeur : la référence ${{...}} pointe le plugin du même projet,
# Railway résout et injecte l'URL réelle au démarrage.
railway variables --set 'DATABASE_URL=${{Postgres.DATABASE_URL}}'
railway variables --set 'REDIS_URL=${{Redis.REDIS_URL}}'

# AUTH_SECRET : à GÉNÉRER (aucune source externe) — openssl produit la valeur.
railway variables --set "AUTH_SECRET=$(openssl rand -hex 32)"

# (facultatif) Feed esports « vivant ». Valeurs PUBLIQUES (front lolesports.com) :
#   base = https://esports-api.lolesports.com ; clé publique = x-api-key ci-dessous.
railway variables --set 'ESPORTS_API_BASE_URL=https://esports-api.lolesports.com'
railway variables --set 'ESPORTS_API_KEY=0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z'
railway variables --set 'ESPORTS_SCHEDULER_ENABLED=true'

# (facultatif) Stripe mode test. Récupérer sk_test_... sur :
#   https://dashboard.stripe.com/test/apikeys  (Developers ▸ API keys ▸ Secret key)
railway variables --set 'STRIPE_SECRET_KEY=sk_test_...'
```

> Ne **pas** poser `PORT` : Railway l'injecte et l'API l'écoute déjà (`process.env.PORT`).

Déployer l'API :

```bash
railway up        # build l'image Docker et déploie le service courant
```

Récupérer l'URL publique (à générer dans l'onglet *Settings → Networking → Generate Domain*
si absente), puis la noter pour les fronts :

```bash
railway domain    # affiche / génère le domaine public de l'API
```

### 3.3 Service worker Pricing (bus-only, pas de port)

Créer un **second service** dans le même projet, branché sur le **même repo**. Il réutilise
le `Dockerfile` mais avec une autre start command, fournie par `railway.worker.json` :

- Dans *Settings → Config-as-code* du service worker, mettre le chemin : `railway.worker.json`
  (start command `node dist/pricing.main.js`, pas de healthcheck).
- Variables du worker (il ne parle qu'au bus) :

```bash
# (service worker sélectionné)
railway variables --set 'REDIS_URL=${{Redis.REDIS_URL}}'
railway up
```

> Le worker n'a besoin **ni** de `DATABASE_URL` **ni** de `AUTH_SECRET` : il consomme les
> événements de domaine sur Redis et publie les cotes recalculées. Les migrations ne le
> concernent pas (elles tournent au boot de l'API).

---

## 4. Vercel — les 2 fronts depuis le monorepo

Chaque app est un **projet Vercel distinct** pointant sur le **même repo**, différencié par sa
*Root Directory*. Le `vercel.json` de chaque app installe au **workspace root** (`web/`) puis
build l'app (`next build`).

### 4.1 Projet player

```bash
cd web/apps/player
vercel link                              # crée/relie le projet (ex. betnext-player)
# Réglage clé dans le dashboard OU au link : Root Directory = web/apps/player
vercel env add NEXT_PUBLIC_API_BASE_URL production
#   OÙ TROUVER LA VALEUR : URL publique de l'API Railway (étape 3.2) → `railway domain`
#   (ou Railway ▸ service API ▸ Settings ▸ Networking ▸ Public Domain),
#   ex. https://betnext-api.up.railway.app
vercel --prod                            # déploie
```

### 4.2 Projet admin

```bash
cd web/apps/admin
vercel link                              # projet ex. betnext-admin, Root Directory = web/apps/admin
vercel env add NEXT_PUBLIC_API_BASE_URL production
#   OÙ TROUVER LA VALEUR : même URL publique de l'API Railway (`railway domain`)
vercel --prod
```

> Stripe Elements (facultatif) : `vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production`,
> puis coller `pk_test_...` récupérée sur <https://dashboard.stripe.com/test/apikeys>
> (Developers ▸ API keys ▸ Publishable key).

> **Workspace install** : `vercel.json` lance `npm install --prefix ../..` (installe tout le
> monorepo `web/`, dont les packages partagés `@betnext/ui` et `@betnext/api-contract`), puis
> `npm run build` (= `next build`) dans le dossier de l'app. Le contrat typé est **committé**
> (`schema.d.ts`), donc aucune régénération n'est requise au build.

---

## 5. Relier le tout

1. L'API Railway active déjà CORS (`app.enableCors()`), les deux fronts Vercel peuvent donc
   l'appeler depuis leurs domaines.
2. `NEXT_PUBLIC_API_BASE_URL` (Vercel, **les deux** projets) = URL publique de l'API Railway.
   Après tout changement de cette URL, **redéployer** les fronts (`vercel --prod`) — c'est une
   variable de build inlinée dans le bundle.

---

## 6. Vérification post-déploiement

```bash
curl https://<API-RAILWAY>/health         # → 200
open  https://<API-RAILWAY>/docs           # Swagger UI
open  https://<PLAYER-VERCEL>              # parcours joueur
open  https://<ADMIN-VERCEL>               # parcours gestionnaire
```

- API : logs Railway → « BetNext démarré sur le port … (Postgres) » + migrations jouées.
- Worker : logs Railway → « Service Pricing démarré : consomme …, publie … ».
- Poser un pari côté joueur → la cote est recalculée par le worker (chemin async via Redis).

> Le seed de démo (`npm run db:seed`) n'est pas joué automatiquement en ligne. Au besoin,
> l'exécuter une fois contre la base managée : `railway run npm run db:seed`.
