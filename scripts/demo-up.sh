#!/usr/bin/env bash
#
# demo-up.sh — lance TOUTE la stack de démo BetNext en une commande, de façon fiable :
#   infra (Postgres + Redis via docker compose) → build → migrations + seed → back NestJS
#   → worker pricing → 2 fronts Next.js → enrichissement runtime (feed + pari gagné).
#
# Tout est lancé EN DÉTACHÉ avec health-checks ; logs et PID écrits sous .demo/<projet>/.
# Arrêt ciblé : scripts/demo-down.sh (par PID puis par port — JAMAIS de pkill large).
#
# Modes (tout est surchargeable par variable d'env) :
#   scripts/demo-up.sh                 # LIVE : ports 3000/3001/3002, PG 5432, Redis 6379, .env tel quel
#   DEMO_ISOLATED=1 scripts/demo-up.sh # ISOLÉ : ports 3300/3301/3302, PG 55432, Redis 56379, creds
#                                      #         externes neutralisés (fixtures + PSP stub hors-ligne).
#                                      #         Redis + worker pricing locaux → cotes live recalculées.
#                                      #         Ne touche NI :3000 NI l'infra live.
#   DEMO_RESET=1   scripts/demo-up.sh  # repart d'un état propre (TRUNCATE) avant le seed.
#   SKIP_FRONTS=1  scripts/demo-up.sh  # back + infra seulement (utile pour les captures).
#
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env}"

ISOLATED="${DEMO_ISOLATED:-0}"
if [ "$ISOLATED" = "1" ]; then
  : "${BACK_PORT:=3300}"; : "${PLAYER_PORT:=3301}"; : "${ADMIN_PORT:=3302}"
  : "${PG_PORT:=55432}"; : "${REDIS_PORT:=56379}"
  : "${COMPOSE_PROJECT_NAME:=betnext-demo}"
  : "${WITH_REDIS:=1}"
  # Démo isolée = 100 % déterministe et hors-ligne : aucune dépendance externe.
  export ESPORTS_API_BASE_URL="" ESPORTS_API_KEY="" RIOT_API_KEY="" STRIPE_SECRET_KEY=""
  : "${ESPORTS_SCHEDULER_ENABLED:=false}"; export ESPORTS_SCHEDULER_ENABLED
else
  : "${BACK_PORT:=3000}"; : "${PLAYER_PORT:=3001}"; : "${ADMIN_PORT:=3002}"
  : "${PG_PORT:=5432}"; : "${REDIS_PORT:=6379}"
  : "${COMPOSE_PROJECT_NAME:=betnext}"
  : "${WITH_REDIS:=1}"
fi
export COMPOSE_PROJECT_NAME PG_PORT REDIS_PORT

: "${DATABASE_URL:=postgres://betnext:betnext@localhost:${PG_PORT}/betnext}"
if [ "$WITH_REDIS" = "1" ]; then : "${REDIS_URL:=redis://localhost:${REDIS_PORT}}"; else REDIS_URL=""; fi
export DATABASE_URL REDIS_URL
export PORT="$BACK_PORT"

RUN_DIR="$ROOT/.demo/$COMPOSE_PROJECT_NAME"
LOG_DIR="$RUN_DIR/logs"
mkdir -p "$LOG_DIR"

log()  { printf '\033[1;36m▸ %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
fail() { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

[ -f "$ENV_FILE" ] || fail "$ENV_FILE introuvable. Copiez .env.example en .env (AUTH_SECRET requis)."

wait_http() { # url label timeout
  local url="$1" label="$2" deadline=$(( SECONDS + ${3:-60} ))
  while [ "$SECONDS" -lt "$deadline" ]; do
    if curl -fsS -o /dev/null "$url" 2>/dev/null; then ok "$label prêt ($url)"; return 0; fi
    sleep 1
  done
  fail "$label injoignable après ${3:-60}s ($url) — voir $LOG_DIR"
}

start_bg() { # name "command..." -- lance en détaché, écrit le PID
  local name="$1"; shift
  nohup bash -c "$*" >"$LOG_DIR/$name.log" 2>&1 &
  echo $! >"$RUN_DIR/$name.pid"
  ok "$name démarré (pid $(cat "$RUN_DIR/$name.pid"), log $LOG_DIR/$name.log)"
}

log "Mode : $([ "$ISOLATED" = 1 ] && echo 'ISOLÉ (hors-ligne, ports décalés)' || echo 'LIVE') — projet docker '$COMPOSE_PROJECT_NAME'"
log "Ports : back :$BACK_PORT · player :$PLAYER_PORT · admin :$ADMIN_PORT · PG :$PG_PORT$([ "$WITH_REDIS" = 1 ] && echo " · Redis :$REDIS_PORT")"

# 1) Infra (idempotent : réutilise les conteneurs déjà up)
log "Infra docker compose…"
if [ "$WITH_REDIS" = "1" ]; then docker compose up -d postgres redis; else docker compose up -d postgres; fi
log "Attente Postgres (health-check)…"
deadline=$(( SECONDS + 60 ))
until docker compose exec -T postgres pg_isready -U betnext -d betnext >/dev/null 2>&1; do
  [ "$SECONDS" -lt "$deadline" ] || fail "Postgres pas prêt après 60s"
  sleep 1
done
ok "Postgres prêt (:$PG_PORT)"
if [ "$WITH_REDIS" = "1" ]; then
  until [ "$(docker compose exec -T redis redis-cli ping 2>/dev/null | tr -d '\r')" = "PONG" ]; do
    [ "$SECONDS" -lt "$deadline" ] || fail "Redis pas prêt"
    sleep 1
  done
  ok "Redis prêt (:$REDIS_PORT)"
fi

# 2) Build
log "Build TypeScript…"; npm run build >/dev/null; ok "Build OK"

# 3) Migrations + seed (idempotent ; DEMO_RESET=1 → table rase avant)
if [ "${DEMO_RESET:-0}" = "1" ]; then
  log "Reset (TRUNCATE) + migrations + seed…"; node scripts/demo-reset.cjs
else
  log "Migrations + seed (idempotent)…"; node scripts/seed.cjs
fi
ok "Base prête (comptes demo-player/demo-manager, wallets, marchés)"

# 4) Back + worker
start_bg back "exec node --env-file='$ENV_FILE' dist/main.js"
[ "$WITH_REDIS" = "1" ] && start_bg worker "exec node --env-file='$ENV_FILE' dist/pricing.main.js"
wait_http "http://localhost:$BACK_PORT/health" "API back" 60

# 5) Enrichissement runtime : feed ingéré + un pari déjà GAGNÉ (stats non vides)
log "Enrichissement de l'état de démo (feed + pari gagné)…"
BASE_URL="http://localhost:$BACK_PORT" node scripts/demo-enrich.cjs || fail "Enrichissement KO (voir ci-dessus)"

# 6) Fronts (Next.js dev) — l'URL d'API est injectée à la volée (aucun fichier modifié)
if [ "${SKIP_FRONTS:-0}" != "1" ]; then
  start_bg player "cd '$ROOT/web/apps/player' && NEXT_PUBLIC_API_BASE_URL='http://localhost:$BACK_PORT' NEXT_PUBLIC_ADMIN_URL='http://localhost:$ADMIN_PORT' exec ../../node_modules/.bin/next dev -p $PLAYER_PORT"
  start_bg admin  "cd '$ROOT/web/apps/admin'  && NEXT_PUBLIC_API_BASE_URL='http://localhost:$BACK_PORT' NEXT_PUBLIC_PLAYER_URL='http://localhost:$PLAYER_PORT' exec ../../node_modules/.bin/next dev -p $ADMIN_PORT"
  wait_http "http://localhost:$PLAYER_PORT" "Front joueur" 120
  wait_http "http://localhost:$ADMIN_PORT" "Front admin" 120
fi

printf '\n\033[1;32m=== Stack de démo BetNext prête ===\033[0m\n'
printf '  API back    : http://localhost:%s  (Swagger /docs)\n' "$BACK_PORT"
if [ "${SKIP_FRONTS:-0}" != "1" ]; then
  printf '  Front joueur: http://localhost:%s  (demo-player  / changeme123)\n' "$PLAYER_PORT"
  printf '  Front admin : http://localhost:%s  (demo-manager / changeme123)\n' "$ADMIN_PORT"
fi
printf '  Logs        : %s\n' "$LOG_DIR"
printf '  Arrêt       : DEMO_ISOLATED=%s scripts/demo-down.sh\n\n' "$ISOLATED"
