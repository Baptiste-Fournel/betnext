// capture-demo.mjs — produit les captures de secours de la démo en pilotant un Chrome headless
// via le Chrome DevTools Protocol (aucune dépendance npm : fetch + WebSocket natifs Node ≥ 20.6).
// À lancer contre une INSTANCE ISOLÉE (cf. scripts/demo-up.sh DEMO_ISOLATED=1) — JAMAIS la live.
//
//   API=http://localhost:3300 PLAYER=http://localhost:3301 ADMIN=http://localhost:3302 \
//     CDP=9223 OUT=livrables/captures-demo node scripts/capture-demo.mjs
//
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const API = process.env.API || 'http://localhost:3300';
const PLAYER = process.env.PLAYER || 'http://localhost:3301';
const ADMIN = process.env.ADMIN || 'http://localhost:3302';
const CDP = process.env.CDP || '9223';
const OUT = process.env.OUT || 'livrables/captures-demo';
const PWD = 'changeme123';
const TOKEN_KEY = 'betnext.token';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function apiLogin(username) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: PWD }),
  });
  const json = await res.json();
  if (!json.token) throw new Error(`login ${username} KO: ${JSON.stringify(json)}`);
  return json.token;
}

async function apiGet(path, token) {
  const res = await fetch(`${API}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return res.json();
}

async function apiBet(token, outcomeId, stake, idem) {
  const res = await fetch(`${API}/bets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'Idempotency-Key': idem },
    body: JSON.stringify({ outcomeId, stake }),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

// --- Client CDP minimal -----------------------------------------------------
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)) {
        const { resolve: res, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? reject(new Error(JSON.stringify(m.error))) : res(m.result);
      }
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    return new Promise((res, reject) => {
      this.pending.set(id, { resolve: res, reject });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
}

async function connect() {
  const ver = await (await fetch(`http://127.0.0.1:${CDP}/json/version`)).json();
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  return new Cdp(ws);
}

async function newPage(cdp) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1024, deviceScaleFactor: 2, mobile: false }, sessionId);
  return sessionId;
}

async function evaluate(cdp, s, expression) {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, s);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}

async function goto(cdp, s, url) {
  await cdp.send('Page.navigate', { url }, s);
  for (let i = 0; i < 60; i++) {
    if ((await evaluate(cdp, s, 'document.readyState')) === 'complete') break;
    await sleep(200);
  }
}

async function waitFor(cdp, s, expr, label, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await evaluate(cdp, s, `(()=>{try{return !!(${expr})}catch{return false}})()`)) return true;
    await sleep(250);
  }
  console.warn(`  ! attente dépassée: ${label}`);
  return false;
}

async function authenticate(cdp, s, base, token) {
  await goto(cdp, s, base + '/');
  await evaluate(cdp, s, `localStorage.setItem(${JSON.stringify(TOKEN_KEY)}, ${JSON.stringify(token)})`);
  await goto(cdp, s, base + '/');
}

// Rect (coords document) de la carte dont le titre vaut exactement `title`.
const cardRect = (title) =>
  `(()=>{const t=[...document.querySelectorAll('*')].find(e=>e.children.length===0&&e.textContent.trim()===${JSON.stringify(title)});const c=t&&t.closest('.rounded-lg');if(!c)return null;c.scrollIntoView({block:'center'});const r=c.getBoundingClientRect();return {x:Math.max(0,r.x+scrollX-12),y:Math.max(0,r.y+scrollY-12),width:r.width+24,height:r.height+24};})()`;
const selRect = (sel) =>
  `(()=>{const c=document.querySelector(${JSON.stringify(sel)});if(!c)return null;c.scrollIntoView({block:'start'});const r=c.getBoundingClientRect();return {x:Math.max(0,r.x+scrollX-12),y:Math.max(0,r.y+scrollY-12),width:r.width+24,height:r.height+24};})()`;

async function shot(cdp, s, name, rectExpr) {
  const file = resolve(OUT, name);
  let clip = null;
  if (rectExpr) {
    const r = await evaluate(cdp, s, rectExpr);
    if (r && r.width > 0) clip = { ...r, scale: 1 };
  }
  await sleep(400);
  const { data } = await cdp.send(
    'Page.captureScreenshot',
    { format: 'png', captureBeyondViewport: true, ...(clip ? { clip } : {}) },
    s,
  );
  writeFileSync(file, Buffer.from(data, 'base64'));
  console.log(`  ✓ ${name}`);
}

// --- Scénario ---------------------------------------------------------------
(async () => {
  console.log(`Captures → ${OUT} (API ${API}, player ${PLAYER}, admin ${ADMIN})`);
  const playerTok = await apiLogin('demo-player');
  const managerTok = await apiLogin('demo-manager');

  // Pré-place un pari joueur sur le match LEC « terminé » (G2 gagne) → la synchro résultats
  // côté admin pourra le régler en GAGNÉ devant la caméra.
  const upcoming = await apiGet('/game-integration/upcoming', null);
  const lec = upcoming.find((u) => u.matchId === 'esports-fixture-lec-g2-fnc');
  if (lec) {
    const markets = await apiGet('/markets', null);
    const lecMarket = markets.find((m) => m.id === lec.marketId);
    const g2 = lecMarket?.outcomes.find((o) => /G2/i.test(o.label));
    if (g2) {
      const r = await apiBet(playerTok, g2.id, 15, 'capture-lec-g2');
      console.log(`  • pari LEC pré-placé sur ${g2.label} → ${r.status}`);
    }
  }

  const cdp = await connect();

  // 1) Joueur
  const p = await newPage(cdp);
  await goto(cdp, p, PLAYER + '/');
  await waitFor(cdp, p, "document.querySelector('input')", 'écran de connexion');
  await shot(cdp, p, '01-connexion.png');

  await authenticate(cdp, p, PLAYER, playerTok);
  await waitFor(cdp, p, "document.querySelector('section[aria-label=\\\"Marchés\\\"]')", 'feed joueur');
  await waitFor(cdp, p, "document.body.innerText.includes('LEC')||document.body.innerText.includes('Major')", 'cartes marchés');
  await sleep(800);
  await shot(cdp, p, '02-feed-matchs-a-venir.png', selRect('section[aria-label="Marchés"]'));

  // Statistiques (le pari gagné de l'enrichissement est déjà là)
  await shot(cdp, p, '04-stats-joueur.png', cardRect('Mes statistiques'));
  // Portefeuille : on dépose 50 € (Stripe stub) puis on capture le solde crédité
  await evaluate(cdp, p, "[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Déposer')?.click()");
  await waitFor(cdp, p, "document.body.innerText.includes('Dépôt crédité')", 'dépôt crédité');
  await shot(cdp, p, '05-wallet-depot-stripe.png', cardRect('Mon portefeuille'));

  // Coupon : sélectionner une issue puis placer → cote figée + gain potentiel
  await evaluate(cdp, p, "document.querySelector('button[aria-pressed]')?.click()");
  await waitFor(cdp, p, "[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Placer le pari'))", 'coupon ouvert');
  await evaluate(cdp, p, "[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Placer le pari')?.click()");
  await waitFor(cdp, p, "document.body.innerText.includes('Cote figée')", 'coupon posé');
  await shot(cdp, p, '03-coupon-cote-figee.png', cardRect('Coupon'));

  // 2) Admin
  const a = await newPage(cdp);
  await authenticate(cdp, a, ADMIN, managerTok);
  await waitFor(cdp, a, "document.body.innerText.includes('Console gestionnaire')", 'console admin');
  await sleep(800);
  await shot(cdp, a, '06-admin-creer-regler.png');

  // Synchroniser les résultats du feed → le pari LEC sur G2 passe GAGNÉ
  await evaluate(cdp, a, "[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Synchroniser les résultats'))?.click()");
  await waitFor(cdp, a, "document.body.innerText.includes('réglé')||document.body.innerText.includes('gagnés')", 'synchro faite', 20000);
  await sleep(600);
  await shot(cdp, a, '07-admin-sync-resultats.png', cardRect('Résultats des matchs du feed'));

  // 3) Historique joueur après la synchro → le pari LEC est Gagné
  const p2 = await newPage(cdp);
  await authenticate(cdp, p2, PLAYER, playerTok);
  await waitFor(cdp, p2, "document.body.innerText.includes('Gagné')||document.body.innerText.includes('Historique')", 'historique joueur');
  await sleep(800);
  await shot(cdp, p2, '08-historique-pari-gagne.png', cardRect('Historique des paris'));

  console.log('Captures terminées.');
  process.exit(0);
})().catch((e) => {
  console.error('ECHEC capture:', e?.stack || e);
  process.exit(1);
});
