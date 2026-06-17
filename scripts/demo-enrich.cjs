/* eslint-disable */
// demo-enrich.cjs — enrichit l'état de démo SUR L'INSTANCE QUI TOURNE (via HTTP, donc à travers le
// vrai domaine : auth, CQRS, event-sourcing, ledger — aucun bricolage SQL). Idempotent :
//   1. ingère le feed des matchs pro à venir (BET-30) → marchés « matchs à venir » bettables ;
//   2. pose un pari côté joueur sur le marché « clôturé » puis le règle côté manager
//      → un pari GAGNÉ + des statistiques joueur non vides pour la démo.
// Rejouable sans effet de bord : Idempotency-Key fixe sur le pari, ingestion idempotente par
// externalId, et règlement déjà fait → on tolère le second passage.
const { DEMO_PASSWORD, DEMO_SETTLED_MARKET_ID } = require('./seed.cjs');

const BASE = process.env.BASE_URL || 'http://localhost:3000';

async function req(method, path, { token, idem, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (idem) headers['Idempotency-Key'] = idem;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

async function login(username) {
  const { status, json } = await req('POST', '/auth/login', {
    body: { username, password: DEMO_PASSWORD },
  });
  if (status !== 200 || !json || !json.token) {
    throw new Error(`login ${username} → ${status} ${JSON.stringify(json)}`);
  }
  return json.token;
}

(async () => {
  const manager = await login('demo-manager');
  const player = await login('demo-player');
  console.log('✓ tokens demo-manager / demo-player');

  // 1) Feed → marchés « matchs à venir » (fixtures déterministes hors-ligne, ou live si clé fournie)
  const ingest = await req('POST', '/game-integration/esports/ingest', { token: manager });
  if (ingest.status !== 200) throw new Error(`ingest → ${ingest.status} ${JSON.stringify(ingest.json)}`);
  const s = ingest.json || {};
  console.log(`✓ feed ingéré : source=${s.source} ingested=${s.ingested} skipped=${s.skipped} (total ${s.total})`);

  // 2) Pari joueur sur le marché « clôturé » (issue gagnante = G2) — clé idempotente fixe
  const winning = `${DEMO_SETTLED_MARKET_ID}-1`;
  const bet = await req('POST', '/bets', {
    token: player,
    idem: 'demo-enrich-won-bet',
    body: { outcomeId: winning, stake: 10 },
  });
  if (![200, 201].includes(bet.status)) {
    throw new Error(`pose pari → ${bet.status} ${JSON.stringify(bet.json)}`);
  }
  console.log(`✓ pari posé : betId=${bet.json.betId} cote figée=${bet.json.lockedOdds} gain potentiel=${bet.json.potentialGain}`);

  // 3) Règlement par le manager (issue gagnante = G2) → le pari passe WON, gain crédité.
  //    Rejeu : le marché est déjà réglé → on tolère un 2e passage sans le compter comme un échec.
  const settle = await req('POST', '/markets/settle', {
    token: manager,
    body: {
      outcomes: [`${DEMO_SETTLED_MARKET_ID}-1`, `${DEMO_SETTLED_MARKET_ID}-2`, `${DEMO_SETTLED_MARKET_ID}-3`],
      winningOutcomeId: winning,
    },
  });
  if (settle.status === 200) {
    console.log(`✓ marché réglé : ${JSON.stringify(settle.json)}`);
  } else {
    console.log(`• règlement déjà appliqué (rejeu) → ${settle.status} ${JSON.stringify(settle.json)}`);
  }

  // 4) Vérification : les stats joueur ne sont plus vides
  const stats = await req('GET', '/bets/stats', { token: player });
  console.log(`✓ stats joueur : ${JSON.stringify(stats.json)}`);

  console.log('\nEnrichissement de démo OK.');
  process.exit(0);
})().catch((e) => {
  console.error('ECHEC enrich:', e && e.message ? e.message : e);
  process.exit(1);
});
