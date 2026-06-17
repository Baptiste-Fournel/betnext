#!/usr/bin/env bash
#
# demo-down.sh — arrête proprement la stack lancée par demo-up.sh.
#   Arrêt CIBLÉ : d'abord par PID (fichiers .demo/<projet>/*.pid), puis filet par PORT précis
#   (lsof -ti tcp:<port>). JAMAIS de `pkill node` / `killall` large.
#
# Doit recevoir le MÊME mode que le up :
#   scripts/demo-down.sh                 # LIVE (3000/3001/3002)
#   DEMO_ISOLATED=1 scripts/demo-down.sh # ISOLÉ (3300/3301/3302, projet betnext-demo)
#   DOWN_INFRA=1 …                       # stoppe AUSSI les conteneurs PG/Redis du projet
#   DOWN_INFRA=1 PURGE_VOLUME=1 …        # … et supprime le volume (données effacées)
#
set -uo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

ISOLATED="${DEMO_ISOLATED:-0}"
if [ "$ISOLATED" = "1" ]; then
  : "${BACK_PORT:=3300}"; : "${PLAYER_PORT:=3301}"; : "${ADMIN_PORT:=3302}"
  : "${COMPOSE_PROJECT_NAME:=betnext-demo}"
else
  : "${BACK_PORT:=3000}"; : "${PLAYER_PORT:=3001}"; : "${ADMIN_PORT:=3002}"
  : "${COMPOSE_PROJECT_NAME:=betnext}"
fi
export COMPOSE_PROJECT_NAME
RUN_DIR="$ROOT/.demo/$COMPOSE_PROJECT_NAME"

ok()   { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
info() { printf '\033[1;36m▸ %s\033[0m\n' "$*"; }

kill_pid() { # pidfile label
  local f="$1" label="$2" pid
  [ -f "$f" ] || return 0
  pid="$(cat "$f" 2>/dev/null)"
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null && ok "$label arrêté (pid $pid)"
  fi
  rm -f "$f"
}

kill_port() { # port label -- filet ciblé sur LE port (process group inclus pour les fronts Next)
  local port="$1" label="$2" pids
  pids="$(lsof -ti "tcp:$port" -sTCP:LISTEN 2>/dev/null || true)"
  [ -n "$pids" ] || return 0
  for pid in $pids; do kill "$pid" 2>/dev/null && ok "$label libéré (:$port, pid $pid)"; done
}

info "Arrêt stack '$COMPOSE_PROJECT_NAME' (back :$BACK_PORT · player :$PLAYER_PORT · admin :$ADMIN_PORT)"
kill_pid "$RUN_DIR/player.pid" "Front joueur"
kill_pid "$RUN_DIR/admin.pid"  "Front admin"
kill_pid "$RUN_DIR/worker.pid" "Worker pricing"
kill_pid "$RUN_DIR/back.pid"   "API back"
# Filet : Next dev fork des enfants ; on libère explicitement chaque port connu (et rien d'autre).
kill_port "$PLAYER_PORT" "Front joueur"
kill_port "$ADMIN_PORT"  "Front admin"
kill_port "$BACK_PORT"   "API back"

if [ "${DOWN_INFRA:-0}" = "1" ]; then
  if [ "${PURGE_VOLUME:-0}" = "1" ]; then
    info "docker compose down -v (volume supprimé)…"; docker compose down -v
  else
    info "docker compose down (volume conservé)…"; docker compose down
  fi
  ok "Infra du projet '$COMPOSE_PROJECT_NAME' arrêtée"
else
  info "Infra PG/Redis laissée en place (DOWN_INFRA=1 pour la stopper)."
fi
ok "Stack arrêtée."
