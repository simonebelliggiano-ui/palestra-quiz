// Prova completa nel browser, con un PC e un iPhone 16 simulati e un GitHub finto.
// Uso: node test/e2e.mjs <cartella-screenshot>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(process.env.GLOBAL_NODE_MODULES + '/');
const { chromium, devices } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.argv[2] || '/tmp/pq-shots';
fs.mkdirSync(SHOTS, { recursive: true });

// ---------- piccolo server dei file dell'app ----------
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.png': 'image/png' };
const srv = http.createServer((q, r) => {
  const u = decodeURIComponent(new URL(q.url, 'http://x').pathname);
  const f = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
});
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${srv.address().port}/`;

// ---------- GitHub finto ----------
const sha = (t) => crypto.createHash('sha1').update(t).digest('hex');
const GH = { files: new Map(), versione: 0, rifiuta: 0, tokenValido: 'tok-ok', put: 0, conflitti: 0 };
function scrivi(p, t) { GH.files.set(p, { testo: t, sha: sha(t) }); GH.versione++; }
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization,content-type,if-none-match,x-github-api-version,accept', 'access-control-allow-methods': 'GET,PUT,DELETE,OPTIONS', 'access-control-expose-headers': 'etag' };
async function ghFinto(route) {
  const q = route.request(), u = new URL(q.url()), m = q.method();
  const json = (status, b, h = {}) => route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json', ...h }, body: b === undefined ? '' : JSON.stringify(b) });
  if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
  if (q.headers().authorization !== `Bearer ${GH.tokenValido}`) return json(401, { message: 'Bad credentials' });
  const p = u.pathname.replace('/repos/simone/dati', '');
  if (p === '') return json(200, { default_branch: 'main', private: true });
  if (p.startsWith('/git/trees/')) {
    const etag = `"v${GH.versione}"`;
    if (q.headers()['if-none-match'] === etag) return route.fulfill({ status: 304, headers: { ...CORS, etag } });
    return json(200, { tree: [...GH.files].map(([path, f]) => ({ path, sha: f.sha, type: 'blob' })) }, { etag });
  }
  if (p.startsWith('/git/blobs/')) {
    const f = [...GH.files.values()].find((x) => x.sha === p.split('/').pop());
    return f ? json(200, { content: Buffer.from(f.testo).toString('base64') }) : json(404, {});
  }
  if (p.startsWith('/contents/')) {
    const fp = decodeURIComponent(p.slice('/contents/'.length)), f = GH.files.get(fp);
    if (m === 'GET') return f ? json(200, { sha: f.sha, content: Buffer.from(f.testo).toString('base64') }) : json(404, {});
    const b = JSON.parse(q.postData() || '{}');
    if (GH.rifiuta > 0) { GH.rifiuta--; GH.conflitti++; return json(409, { message: 'conflict' }); }
    if ((f && b.sha !== f.sha) || (!f && b.sha)) { GH.conflitti++; return json(409, { message: 'sha mismatch' }); }
    if (m === 'PUT') { GH.put++; const t = Buffer.from(b.content, 'base64').toString(); scrivi(fp, t); return json(200, { content: { sha: sha(t) } }); }
    if (m === 'DELETE') { GH.files.delete(fp); GH.versione++; return json(200, {}); }
  }
  return json(404, {});
}

// ---------- carte di prova ----------
const MAZZI = [['o', "Ordinamento dell'Agenzia delle Entrate", 30], ['d', 'Diritto amministrativo', 30], ['p', 'Pubblico impiego', 30], ['i', 'Informatica', 12], ['e', 'Inglese', 12], ['s', 'ASMEL specifiche', 40], ['m', 'Metodo', 6]];
for (const [id, materia, n] of MAZZI) {
  const cards = [];
  for (let i = 1; i <= n; i++) cards.push({ id: `${id}-${String(i).padStart(3, '0')}`, deck: id, kind: 'quiz', front: `Domanda ${i} del mazzo ${materia}: qual è la risposta corretta secondo il testo della norma citata?`, options: ['Risposta giusta', 'Risposta errata uno', 'Risposta errata due', 'Risposta errata tre'], answer: 0, why: "Spiegazione con accenti: è così perché l'art. 2 lo dice.", mnem: 'Immagine di prova', ref: `art. ${i}`, tags: i === 1 ? ['trappola'] : [] });
  cards.push({ id: `${id}-f01`, deck: id, kind: 'flash', front: 'Quali sono i principi elencati?', back: 'Economicità, efficacia, imparzialità.', mnem: 'È Il Primo Test', ref: 'art. 1', tags: [] });
  if (id === 'm') cards.push({ id: 'm-f02', deck: 'm', kind: 'flash', front: '41', back: 'R + T/D', tags: [] });
  scrivi(`carte/${id}.json`, JSON.stringify({ decks: [{ id, name: `Mazzo ${materia}`, materia, desc: 'Descrizione del mazzo', order: id.charCodeAt(0) }], cards }, null, 1));
}
const totaleCarte = MAZZI.reduce((a, m) => a + m[2] + 1, 0) + 1;

// ---------- aiuti ----------
let esiti = 0, falliti = 0;
function ok(cond, msg) { esiti++; if (cond) console.log(`  ok  ${msg}`); else { falliti++; console.log(`  NO  ${msg}`); } }
const problemi = [];
async function dispositivo(browser, nome, opzioni) {
  const ctx = await browser.newContext({ ...opzioni, serviceWorkers: 'block' });
  const dev = { ctx, nome, rete: true };
  // Il finto GitHub risponde solo se il dispositivo ha davvero la rete.
  await ctx.route('https://api.github.com/**', (route) => (dev.rete ? ghFinto(route) : route.abort('internetdisconnected')));
  const page = await ctx.newPage();
  dev.page = page;
  page.on('pageerror', (e) => problemi.push(`${nome}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_INTERNET_DISCONNECTED/.test(m.text())) problemi.push(`${nome}: ${m.text()}`); });
  await page.goto(BASE);
  return dev;
}
const clic = (page, a, extra = '') => page.locator(`[data-a="${a}"]${extra}`).first().click();
async function collega(page) {
  await page.goto(`${BASE}#gestione`);
  await page.fill('#g-repo', 'simone/dati');
  await page.fill('#g-token', GH.tokenValido);
  await clic(page, 'salvaSync');
  await page.waitForFunction(() => document.querySelector('#toast')?.textContent === 'Sincronizzato', null, { timeout: 15000 });
}
const stato = (page) => page.evaluate(async () => {
  const c = await import('./js/core.js'), s = await import('./js/store.js');
  const files = (await s.kvGet('files')) || {}, pending = (await s.kvGet('pending')) || [];
  const ev = c.unisciEventi(...Object.entries(files).filter(([p]) => p.startsWith('registro/')).map(([, f]) => c.testoInEventi(f.testo)), pending);
  return { ...c.ricostruisci(ev), pending: pending.length, eventi: ev.length, device: await s.kvGet('device') };
});
const sincronizza = async (page) => {
  await page.goto(`${BASE}#gestione`); await page.reload();
  await page.waitForSelector('[data-a="salvaSync"]');
  await clic(page, 'salvaSync');
  await page.waitForFunction(() => document.querySelector('#toast')?.textContent === 'Sincronizzato', null, { timeout: 15000 });
};
async function foto(page, nome) { await page.waitForTimeout(150); await page.screenshot({ path: path.join(SHOTS, `${nome}.png`) }); }
async function senzaSforamenti(page, dove) {
  const r = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, v: innerWidth }));
  ok(r.w <= r.v, `${dove}: niente scorrimento orizzontale (${r.w}/${r.v})`);
}

const browser = await chromium.launch();
const iPhone16 = { viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices['iPhone 15'].userAgent };

console.log('\n1. Collegamento');
const tel = await dispositivo(browser, 'telefono', iPhone16);
const pc = await dispositivo(browser, 'pc', { viewport: { width: 1280, height: 800 } });
await foto(tel.page, '00-primo-avvio');
GH.tokenValido = 'tok-ok';
await tel.page.goto(`${BASE}#gestione`);
await tel.page.fill('#g-repo', 'simone/dati'); await tel.page.fill('#g-token', 'token-sbagliato'); await clic(tel.page, 'salvaSync');
await tel.page.waitForSelector('.avviso.errore');
ok(/non è valido/.test(await tel.page.locator('.avviso.errore').first().textContent()), 'token sbagliato: messaggio chiaro');
ok((await tel.page.inputValue('#g-token')) === 'token-sbagliato', 'token sbagliato: il campo non si svuota');
await collega(tel.page); await collega(pc.page);
ok((await tel.page.locator('.riga:has-text("Carte nel repository") b').textContent()) === String(totaleCarte), `telefono vede ${totaleCarte} carte`);
await foto(tel.page, '10-gestione');
await senzaSforamenti(tel.page, 'Gestione');
const idT = (await stato(tel.page)).device, idP = (await stato(pc.page)).device;
ok(idT.startsWith('telefono-') && idP.startsWith('pc-') && idT !== idP, `dispositivi distinti: ${idT}, ${idP}`);

console.log('\n2. Stessa giornata su due dispositivi, telefono senza rete');
await tel.page.goto(`${BASE}#ripasso`);
await foto(tel.page, '11-ripasso-scelta');
await clic(tel.page, 'tuttiMazzi');
await tel.page.locator('[data-a="toggleMazzo"]', { hasText: 'Metodo' }).click();
await tel.page.locator('[data-a="flModo"][data-v="new"]').click();
await tel.ctx.setOffline(true); tel.rete = false;
await clic(tel.page, 'iniziaFlash');
await foto(tel.page, '12-ripasso-domanda');
const carteViste = [];
for (let i = 0; i < 3; i++) {
  const fronte = await tel.page.locator('.carta').first().textContent();
  const quiz = await tel.page.locator('.carta .opz').count();
  if (quiz) await tel.page.locator('.opz').first().click(); else await clic(tel.page, 'mostraRisposta');
  if (i === 0) await foto(tel.page, '13-ripasso-risposta');
  await tel.page.locator('[data-a="vota"][data-v="2"]').click();
  carteViste.push(fronte);
  await tel.page.waitForTimeout(50);
}
await clic(tel.page, 'fermaFlash');
await foto(tel.page, '14-ripasso-fine');
await clic(tel.page, 'chiudiRun');
await tel.page.waitForTimeout(200);
let sT = await stato(tel.page);
ok(sT.pending >= 3, `offline: risposte salvate sul telefono (${sT.pending} in attesa)`);
const giaViste = Object.keys(sT.progress);
ok(giaViste.length === 3, `offline: tre carte progredite anche senza rete (${giaViste})`);

// Il PC, senza saperlo, rifà le stesse carte e altre.
await pc.page.goto(`${BASE}#quiz`);
await clic(pc.page, 'tuttiMazzi');
await pc.page.locator('[data-a="toggleMazzo"]', { hasText: 'Metodo' }).click();
await clic(pc.page, 'iniziaQuiz');
for (let i = 0; i < 4; i++) {
  await pc.page.locator('.opz').nth(i === 1 ? 1 : 0).click();
  if (i === 1) await foto(pc.page, '30-pc-quiz');
  await clic(pc.page, 'qzAvanti').catch(() => {});
  await pc.page.waitForTimeout(40);
  if (i >= 3) break;
}
await pc.page.waitForTimeout(100);
await pc.page.evaluate(() => { location.hash = 'quiz'; });
if (await pc.page.locator('[data-a="fermaQuiz"]').count()) await clic(pc.page, 'fermaQuiz');
await pc.page.waitForTimeout(300);
await clic(pc.page, 'chiudiRun').catch(() => {});

await tel.page.evaluate(() => { location.hash = 'oggi'; });
await tel.page.waitForTimeout(100);
ok(/Sei senza rete/.test(await tel.page.locator('#app').textContent()), 'offline: avviso "Sei senza rete" su Oggi');
ok((await tel.page.locator('.avviso.errore').count()) === 0, 'offline: niente allarmi rossi');
await foto(tel.page, '19-offline');
await tel.ctx.setOffline(false);
// Rete presente ma GitHub irraggiungibile: le risposte restano.
await tel.page.evaluate(() => { location.hash = 'gestione'; });
await tel.page.waitForSelector('[data-a="salvaSync"]');
await clic(tel.page, 'salvaSync');
await tel.page.waitForFunction(() => /Nessuna connessione/.test(document.body.textContent));
ok((await stato(tel.page)).pending >= 3, 'GitHub irraggiungibile: risposte ancora al sicuro');
tel.rete = true;
await sincronizza(tel.page);
await sincronizza(pc.page);
await sincronizza(tel.page);
sT = await stato(tel.page);
let sP = await stato(pc.page);
ok(sT.pending === 0 && sP.pending === 0, 'nessuna risposta rimasta in attesa');
ok(JSON.stringify(sT.progress) === JSON.stringify(sP.progress), `PC e telefono identici (${Object.keys(sT.progress).length} carte, ${sT.eventi} eventi)`);
ok(sT.sessions.length === sP.sessions.length && sT.sessions.length >= 2, `sessioni di entrambi visibili ovunque (${sT.sessions.length})`);
const registro = [...GH.files.keys()].filter((p) => p.startsWith('registro/'));
ok(registro.length === 2 && registro.some((p) => p.includes(idT)) && registro.some((p) => p.includes(idP)), `un file per dispositivo: ${registro.join(', ')}`);
ok(Math.max(...Object.values(sT.progress).map((x) => x.box)) <= 1, 'stessa carta sui due dispositivi: nessuna doppia promozione');

console.log('\n3. Scrittura contemporanea e conflitti con GitHub');
GH.rifiuta = 2;
const primaConf = GH.conflitti;
await pc.page.evaluate(async () => {
  const s = await import('./js/store.js');
  const pend = (await s.kvGet('pending')) || [];
  pend.push({ id: 'prova-conflitto', t: 'v', at: new Date().toISOString(), c: 'o-001', d: 'o', g: 1, k: 'quiz' });
  await s.kvSet('pending', pend);
});
await sincronizza(pc.page);
ok(GH.conflitti >= primaConf + 2, 'GitHub rifiuta due scritture');
ok((await stato(pc.page)).pending === 0, 'riprova da solo e alla fine salva');
ok([...GH.files].some(([p, f]) => p.startsWith('registro/') && f.testo.includes('prova-conflitto')), 'la risposta è nel repository');
// Due schede dello stesso dispositivo: stesso file, nessuna riga persa.
const scheda2 = await pc.ctx.newPage();
await scheda2.goto(BASE);
await Promise.all([pc, { page: scheda2 }].map((x, i) => x.page.evaluate(async (n) => {
  const s = await import('./js/store.js');
  const a = new s.Archivio(); await a.carica();
  await a.aggiungi({ id: `scheda-${n}`, t: 'v', at: new Date().toISOString(), c: 'o-002', d: 'o', g: 1, k: 'quiz' });
  await a.sincronizza();
}, i)));
await sincronizza(pc.page);
const fileP = [...GH.files].find(([p]) => p.includes(idP))[1].testo;
ok(fileP.includes('scheda-0') && fileP.includes('scheda-1'), 'due schede insieme: nessuna riga persa');
await scheda2.close();

console.log('\n4. Token scaduto');
GH.tokenValido = 'tok-nuovo';
await tel.page.evaluate(async () => {
  const s = await import('./js/store.js');
  const pend = (await s.kvGet('pending')) || [];
  pend.push({ id: 'dopo-scadenza', t: 'v', at: new Date().toISOString(), c: 'd-001', d: 'd', g: 2, k: 'quiz' });
  await s.kvSet('pending', pend);
});
await tel.page.goto(`${BASE}#oggi`); await tel.page.reload();
await tel.page.waitForSelector('.avviso.errore');
const av = await tel.page.locator('.avviso.errore').first().textContent();
ok(/scaduto/.test(av) && /non si perdono/.test(av), `avviso chiaro: "${av.trim()}"`);
await foto(tel.page, '15-token-scaduto');
await tel.page.goto(`${BASE}#gestione`);
await tel.page.fill('#g-token', 'tok-nuovo'); await clic(tel.page, 'salvaSync');
await tel.page.waitForFunction(() => document.querySelector('#toast')?.textContent === 'Sincronizzato');
ok((await stato(tel.page)).pending === 0 && [...GH.files].some(([, f]) => f.testo.includes('dopo-scadenza')), 'nuovo token: la risposta in attesa parte');
GH.tokenValido = 'tok-nuovo';
await pc.page.goto(`${BASE}#gestione`); await pc.page.fill('#g-token', 'tok-nuovo'); await clic(pc.page, 'salvaSync');
await pc.page.waitForFunction(() => document.querySelector('#toast')?.textContent === 'Sincronizzato');

console.log('\n5. Simulazione Agenzia delle Entrate sul telefono');
await tel.page.goto(`${BASE}#simulazione`);
await tel.page.waitForSelector('[data-a="avviaSim"]');
await foto(tel.page, '20-sim-avvio');
await senzaSforamenti(tel.page, 'Simulazione');
ok((await tel.page.locator('.formato').count()) === 3, 'tre formati');
const avvisoIniziale = await tel.page.locator('.avviso').count();
ok(avvisoIniziale === 0, 'carte sufficienti: nessun avviso');
await clic(tel.page, 'avviaSim');
await tel.page.waitForSelector('.quesito-box');
const run = () => tel.page.evaluate(async () => (await import('./js/store.js')).kvGet('run'));
await tel.page.waitForTimeout(150);
let r = await run();
const contaM = (q, d) => q.filter((id) => id.startsWith(`${d}-`)).length;
ok(r.queue.length === 50 && [['o', 20], ['d', 10], ['p', 10], ['i', 5], ['e', 5]].every(([d, n]) => contaM(r.queue, d) === n), `quote 20/10/10/5/5: ${['o', 'd', 'p', 'i', 'e'].map((d) => contaM(r.queue, d)).join('/')}`);
ok(r.ends - r.started === 3600000, '60 minuti');
await foto(tel.page, '21-sim-prova');
// 34 giuste, 9 sbagliate, 7 in bianco.
for (let i = 0; i < 43; i++) {
  await tel.page.locator('.opz').nth(i < 34 ? 0 : 1).click();
  await tel.page.waitForFunction((n) => document.querySelector('.riga span')?.textContent === `Domanda ${n} di 50`, i + 2);
  if (i === 16) { await tel.page.locator('[data-a="segna"]').click(); }
}
// A metà prova l'app si chiude: al riavvio la prova è lì, con il tempo che corre.
const tempoPrima = (await run()).ends;
await tel.page.reload();
await tel.page.waitForSelector('#app');
await tel.page.evaluate(() => { location.hash = 'simulazione'; });
await tel.page.waitForSelector('.quesito-box');
r = await run();
ok(r.ends === tempoPrima && Object.keys(r.picks).length === 43, 'riavvio: prova ripresa con risposte e tempo intatti');
ok(/Domanda 44 di 50/.test(await tel.page.locator('.riga span').first().textContent()), 'riavvio: stessa domanda');
await clic(tel.page, 'apriGriglia');
await foto(tel.page, '22-sim-griglia');
ok((await tel.page.locator('.griglia button').count()) === 50, 'griglia con 50 caselle');
ok(/Le 7 non date valgono 0/.test(await tel.page.locator('.foglio').textContent()), 'nota: 7 non date valgono 0');
await clic(tel.page, 'consegna');
ok(/Consegnare adesso/.test(await tel.page.locator('.foglio').textContent()), 'consegna con conferma');
await foto(tel.page, '23-sim-conferma');
await clic(tel.page, 'consegna');
await tel.page.waitForSelector('.punteggio');
const punteggio = (await tel.page.locator('.punteggio').textContent()).trim();
ok(punteggio.startsWith('19,77'), `punteggio 34×0,60 − 9×0,07 = ${punteggio}`);
ok(/Sopra l'idoneità \(18\)/.test(await tel.page.locator('.centro').first().textContent()), 'sopra idoneità 18');
await tel.page.waitForFunction(() => /Salvata nel repository/.test(document.body.textContent), null, { timeout: 8000 });
await foto(tel.page, '24-sim-esito');
await senzaSforamenti(tel.page, 'Esito');
const inRepo = [...GH.files].filter(([p]) => p.includes(idT)).map(([, f]) => f.testo).join('');
ok(/"t":"s","kind":"sim"/.test(inRepo) && /"score":19.77/.test(inRepo), 'sessione nel repository privato');
await clic(tel.page, 'vediCorrezione');
await foto(tel.page, '25-sim-correzione');
ok((await tel.page.locator('article.card').count()) === 50, 'correzione di tutte le 50 domande');
await clic(tel.page, 'chiudiCorrezione');
await clic(tel.page, 'chiudiRun');

console.log('\n6. Altri formati e avvisi');
await tel.page.goto(`${BASE}#simulazione`);
await tel.page.locator('[data-a="simPreset"][data-v="asmel"]').click();
await tel.page.waitForTimeout(100);
let testo = await tel.page.locator('#app').textContent();
ok(/30\/25\/5/.test(testo), 'ASMEL 30/25/5');
ok((await tel.page.locator('.avviso').count()) === 0, `ASMEL con carte sufficienti: nessun avviso`);
await foto(tel.page, '26-sim-asmel');
await clic(tel.page, 'avviaSim');
await tel.page.waitForTimeout(150);
r = await run();
ok(r.queue.length === 60 && contaM(r.queue, 's') === 30 && contaM(r.queue, 'd') + contaM(r.queue, 'p') === 25 && contaM(r.queue, 'i') + contaM(r.queue, 'e') === 5, `ASMEL: 30 specifiche, ${contaM(r.queue, 'd') + contaM(r.queue, 'p')} comuni, ${contaM(r.queue, 'i') + contaM(r.queue, 'e')} inglese e informatica`);
await clic(tel.page, 'apriGriglia');
ok(/conviene rispondere a tutte/.test(await tel.page.locator('.foglio').textContent()), 'ASMEL: niente penalità, invita a rispondere');
await clic(tel.page, 'abbandona'); await clic(tel.page, 'abbandona');
await tel.page.waitForTimeout(150);
await tel.page.goto(`${BASE}#simulazione`);
await tel.page.locator('[data-a="simPreset"][data-v="breve"]').click();
await clic(tel.page, 'avviaSim');
await tel.page.waitForTimeout(150);
r = await run();
ok(r.queue.length === 20 && [['o', 8], ['d', 4], ['p', 4], ['i', 2], ['e', 2]].every(([d, n]) => contaM(r.queue, d) === n), 'breve 8/4/4/2/2');
await clic(tel.page, 'apriGriglia'); await clic(tel.page, 'abbandona'); await clic(tel.page, 'abbandona');
await tel.page.waitForTimeout(150);
// Carte insufficienti: si tolgono quasi tutte quelle di Ordinamento.
const salvaO = GH.files.get('carte/o.json').testo;
const oRidotto = JSON.parse(salvaO); oRidotto.cards = oRidotto.cards.slice(0, 3);
scrivi('carte/o.json', JSON.stringify(oRidotto));
await sincronizza(tel.page);
await tel.page.goto(`${BASE}#simulazione`);
await tel.page.locator('[data-a="simPreset"][data-v="ade"]').click();
await tel.page.waitForSelector('.avviso');
testo = await tel.page.locator('.avviso').first().textContent();
ok(/Ordinamento Agenzia 3 su 20/.test(testo) && /aggiungo 17/.test(testo), `avviso: "${testo.trim()}"`);
await foto(tel.page, '27-sim-avviso');
await clic(tel.page, 'avviaSim');
await tel.page.waitForTimeout(150);
r = await run();
ok(r.queue.length === 50 && contaM(r.queue, 'o') === 3, `riempie: 50 domande, solo ${contaM(r.queue, 'o')} di Ordinamento`);
await clic(tel.page, 'apriGriglia'); await clic(tel.page, 'consegna'); await clic(tel.page, 'consegna');
await tel.page.waitForSelector('.punteggio');
ok(/Ordinamento Agenzia 3 su 20/.test(await tel.page.locator('#app').textContent()), 'avviso ripetuto anche sull\'esito');
ok(/Sotto l'idoneità/.test(await tel.page.locator('.centro').first().textContent()), 'tutte in bianco: 0, sotto idoneità');
await foto(tel.page, '28-sim-esito-avviso');
await clic(tel.page, 'chiudiRun');
scrivi('carte/o.json', salvaO);

console.log('\n7. Quiz, risultati, mazzi');
await sincronizza(tel.page);
await tel.page.goto(`${BASE}#quiz`);
await foto(tel.page, '16-quiz-scelta');
await clic(tel.page, 'tuttiMazzi');
await clic(tel.page, 'iniziaQuiz');
await tel.page.locator('.opz').nth(2).click();
await foto(tel.page, '17-quiz-correzione');
await senzaSforamenti(tel.page, 'Quiz');
await clic(tel.page, 'qzAvanti');
await clic(tel.page, 'fermaQuiz');
await foto(tel.page, '18-quiz-fine');
await clic(tel.page, 'chiudiRun');
await tel.page.goto(`${BASE}#oggi`);
await tel.page.waitForTimeout(150);
await foto(tel.page, '01-oggi');
await senzaSforamenti(tel.page, 'Oggi');
ok((await tel.page.locator('.tile').count()) === 4, 'quattro tile');
await tel.page.goto(`${BASE}#mazzi`); await foto(tel.page, '02-mazzi'); await senzaSforamenti(tel.page, 'Mazzi');
await tel.page.goto(`${BASE}#risultati`); await foto(tel.page, '03-risultati'); await senzaSforamenti(tel.page, 'Risultati');
testo = await tel.page.locator('#app').textContent();
ok(/19,77/.test(testo), 'storico con il punteggio 19,77');
ok(/Le carte che ti fregano/.test(testo) && /errori?/.test(testo), 'carte che fregano');
await tel.page.evaluate(() => scrollTo(0, 500)); await foto(tel.page, '04-risultati-sotto');

console.log('\n8. Importa, esporta, azzera, elimina');
await pc.page.goto(`${BASE}#gestione`);
await pc.page.reload();
await clic(pc.page, 'apri', '[data-v="import"]');
await pc.page.fill('#g-json', '{"cards":[{"id":"z 1"}]}');
await clic(pc.page, 'importa');
await pc.page.waitForTimeout(100);
ok(/Non importato/.test(await pc.page.locator('#g-esito').textContent()), 'JSON sbagliato: rifiutato con motivo');
await pc.page.fill('#g-json', JSON.stringify({ decks: [{ id: 'da-241', name: 'L. 241/1990 – Procedimento', materia: 'Diritto amministrativo', desc: 'Principi e termini', order: 10 }], cards: [{ id: 'da-241-001', deck: 'da-241', kind: 'quiz', front: 'Entro quanti giorni?', options: ['30 giorni', '60 giorni', '90 giorni', '180 giorni'], answer: 0, why: 'Art. 2, c. 2', ref: 'art. 2', tags: ['numeri'] }] }));
await clic(pc.page, 'importa');
await pc.page.waitForFunction(() => /Importati/.test(document.querySelector('#toast')?.textContent || ''));
ok(GH.files.has('carte/da-241.json') && JSON.parse(GH.files.get('carte/da-241.json').testo).cards[0].why === 'Art. 2, c. 2', 'import: scritto nel repository, un file per mazzo');
await sincronizza(pc.page);
const scarico = pc.page.waitForEvent('download');
await clic(pc.page, 'apri', '[data-v="export"]');
await clic(pc.page, 'esporta');
const dl = await scarico;
const backup = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
ok(backup.cards.length > 100 && backup.sessions.length >= 1 && Object.keys(backup.progress).length >= 1 && backup.events.length >= 1, `backup completo (${backup.cards.length} carte, ${backup.sessions.length} sessioni, ${backup.events.length} eventi)`);
await pc.page.reload();
await clic(pc.page, 'apri', '[data-v="azzera"]');
await pc.page.selectOption('#g-azz', 'd');
await clic(pc.page, 'azzera');
ok(/Sì, azzera/.test(await pc.page.locator('[data-a="azzera"]').textContent()), 'azzera chiede conferma');
await clic(pc.page, 'azzera');
await pc.page.waitForFunction(() => /azzerati/.test(document.querySelector('#toast')?.textContent || ''));
sP = await stato(pc.page);
ok(!Object.values(sP.progress).some((x) => x.d === 'd'), 'azzeramento: nessun progresso sul mazzo d');
ok(Object.values(sP.progress).some((x) => x.d !== 'd'), 'azzeramento: gli altri mazzi restano');
await pc.page.reload();
await clic(pc.page, 'apri', '[data-v="elimina"]');
await pc.page.selectOption('#g-del', 'da-241');
await clic(pc.page, 'elimina'); await clic(pc.page, 'elimina');
await pc.page.waitForFunction(() => /Eliminato/.test(document.querySelector('#toast')?.textContent || ''));
ok(!GH.files.has('carte/da-241.json'), 'mazzo eliminato dal repository');
await sincronizza(tel.page);
await sincronizza(pc.page);
ok(JSON.stringify((await stato(tel.page)).progress) === JSON.stringify((await stato(pc.page)).progress), 'dopo tutto, PC e telefono ancora identici');
await foto(pc.page, '31-pc-gestione');
await pc.page.goto(`${BASE}#oggi`); await foto(pc.page, '32-pc-oggi');

console.log('\n9. Offline vero e installazione');
const off = await browser.newContext({ ...iPhone16 });
await off.route('https://api.github.com/**', ghFinto);
const op = await off.newPage();
await op.goto(BASE);
await op.evaluate(async () => { const r = await navigator.serviceWorker.ready; return r.active?.state; });
await op.waitForTimeout(800);
await op.reload();
await collega(op);
await op.evaluate(() => { location.hash = 'oggi'; });
await off.setOffline(true);
await op.reload();
await op.waitForSelector('.tile');
ok((await op.locator('.tile').count()) === 4, 'senza rete l\'app si apre e mostra i dati');
ok(await op.evaluate(() => getComputedStyle(document.body).fontFamily.includes('Manrope') && document.fonts.check('700 16px Manrope')), 'font caricato anche offline');
await off.setOffline(false);
const man = await (await fetch(`${BASE}manifest.webmanifest`)).json();
ok(man.display === 'standalone' && man.icons.length === 2, 'manifest pronto per l\'installazione');
await off.close();

await browser.close();
srv.close();
console.log(`\nErrori nel browser: ${problemi.length}`);
problemi.slice(0, 10).forEach((p) => console.log('  ', p));
console.log(`\n${esiti - falliti}/${esiti} controlli superati`);
process.exit(falliti || problemi.length ? 1 : 0);
