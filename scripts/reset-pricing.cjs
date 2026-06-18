/* eslint-disable */
const { Client } = require('pg');
const { Redis } = require('ioredis');

const ODDS_KEY = 'readmodel:odds';
const TS_KEY = 'readmodel:odds:ts';
const PRICING = 'pricing';

(async () => {
  const pgUrl = process.env.DATABASE_URL;
  const redisUrl = process.env.REDIS_URL;
  if (!pgUrl || !redisUrl) { console.error('ECHEC: DATABASE_URL et REDIS_URL requis.'); process.exit(1); }

  const c = new Client({ connectionString: pgUrl });
  await c.connect();
  const markets = (await c.query(`SELECT id, outcomes FROM markets ORDER BY id`)).rows;
  await c.end();

  const redis = new Redis(redisUrl, { maxRetriesPerRequest: 3 });
  let stakeFields = 0;
  let oddsCleared = 0;
  for (const m of markets) {
    const outcomes = Array.isArray(m.outcomes) ? m.outcomes : JSON.parse(m.outcomes);
    for (const o of outcomes) {
      await redis.hset(`${PRICING}:stakes:${m.id}`, o.id, '0');
      await redis.hset(`${PRICING}:outcome-market`, o.id, m.id);
      stakeFields += 1;
      const a = await redis.hdel(ODDS_KEY, o.id);
      const b = await redis.hdel(TS_KEY, o.id);
      oddsCleared += a + b;
    }
  }
  console.log(`✓ pricing reset : ${markets.length} marchés, ${stakeFields} issues remises à stake=0 (issues conservées → cotes sœurs OK), ${oddsCleared} entrées read-model cotes purgées (→ cote d'ouverture).`);
  await redis.quit();
  process.exit(0);
})().catch((e) => { console.error('ECHEC:', e && e.stack ? e.stack : e); process.exit(1); });
