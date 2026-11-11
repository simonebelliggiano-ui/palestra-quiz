// Palestra Quiz: schermate e azioni. La logica sta in core.js, i dati in store.js.
import {
  PRESETS, MATERIE, ORDINE_MATERIE, romeDate, daysBetween, materiaKey, preparaSimulazione, calcolaPunteggio, ricostruisci,
  inScadenza, maiVista, consolidata, prossimoRitorno, testoGiorni, ordinaQuiz, validaCarte, shuffle, fmt, fmtMin, mmss,
  normalizza, coppiaDaCarta, scegliScrittura, votoScrittura, paroleDifficili, LIMITE_MS,
  lezioni, catena, regolaDueGiorni, avanzamentoManuale, riepilogoSettimana, scadenze, quantoManca, validaLezione, lezioniDaJson,
  SETTIMANE_CATENA, RISPOSTE_GIORNO_MINIMO, palestraDi, statCodice,
} from './core.js';
import { Archivio, kvGet, kvSet, kvDel } from './store.js';
import { BarraLiquida, vibra, impostaVibrazioni, uscita, rimbalzo, contaFino, fermo } from './moto.js';

const VERSIONE = '1.5';
const REPO_DEFAULT = 'simonebelliggiano-ui/palestra-quiz-dati';
const NOME = 'Simone';

const A = new Archivio();
const S = { decks: {}, cards: {}, progress: {}, sessions: [], run: null, prefs: {}, ui: { seg: {} }, tick: null, fx: null };
const app = document.getElementById('app'), nav = document.getElementById('nav'), toastEl = document.getElementById('toast');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plur = (n, uno, molti) => `${n} ${n === 1 ? uno : molti}`;
let toastT;
function toast(m) { toastEl.textContent = m; toastEl.classList.add('vedi'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('vedi'), 2800); }

// ---------- icone ----------
const ic = {
  x: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3C4454" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  ok: (s = 15) => `<svg aria-hidden="true" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>`,
  no: '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  lamp: '<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6.5 6.5 0 0 0-4 11.6V17h8v-2.4A6.5 6.5 0 0 0 12 3z"/><path d="M9.5 21h5"/></svg>',
  cap: '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3E66D9" stroke-width="2.4" stroke-linecap="round"><path d="M8 7v10M16 7v10M8 12h8M4.5 9.500v5M19.500 9.500v5"/></svg>',
  dx: (c = '#565D6B') => `<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>`,
  griglia: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="#3C4454"><rect x="3" y="3" width="5" height="5" rx="1.500"/><rect x="9.500" y="3" width="5" height="5" rx="1.500"/><rect x="16" y="3" width="5" height="5" rx="1.500"/><rect x="3" y="9.500" width="5" height="5" rx="1.500"/><rect x="9.500" y="9.500" width="5" height="5" rx="1.500"/><rect x="16" y="9.500" width="5" height="5" rx="1.500"/><rect x="3" y="16" width="5" height="5" rx="1.500"/><rect x="9.500" y="16" width="5" height="5" rx="1.500"/><rect x="16" y="16" width="5" height="5" rx="1.500"/></svg>',
  band: (c = '#3C4454') => `<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 21V4h12l-3 4.5L18 13H6"/></svg>`,
  att: '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v5M12 17h.01"/><circle cx="12" cy="12" r="9.500"/></svg>',
  sn: '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3C4454" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  ds: '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
};
const NAV = [
  ['oggi', 'Oggi', '<circle cx="12" cy="12" r="4.500"/><path d="M12 2.500V5M12 19v2.500M2.500 12H5M19 12h2.500M5.300 5.300L7 7M17 17l1.700 1.700M5.300 18.700L7 17M17 7l1.700-1.700"/>'],
  ['rotta', 'Rotta', '<circle cx="12" cy="12" r="9"/><path d="M15.500 8.500l-2.200 5.300-5.300 2.200 2.200-5.300z"/>'],
  ['mazzi', 'Mazzi', '<rect x="8" y="3" width="13" height="15" rx="3"/><path d="M4 7v11a3 3 0 0 0 3 3h9"/>'],
  ['risultati', 'Risultati', '<path d="M3.500 17L9 11l4 3.500L20.500 6"/><path d="M15.500 6h5v5"/>'],
  ['gestione', 'Gestione', '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2.200"/><circle cx="8" cy="17" r="2.200"/>'],
];
const svgNav = (p) => `<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.200" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;

// ---------- dati derivati ----------
function ricalcola() {
  const { decks, cards } = A.contenuti();
  S.decks = decks; S.cards = cards;
  const { progress, sessions } = ricostruisci(A.eventi());
  S.progress = progress; S.sessions = sessions;
}
const oggi = () => romeDate();
// Due palestre: le materie del concorso e il codice fonetico. L'interruttore in alto sceglie quale vedere.
const pal = () => (S.prefs.palestra === 'codice' ? 'codice' : 'materie');
const palMazzo = (id) => palestraDi(S.decks[id] || { id });
const opzRotta = () => ({ codice: (id) => palMazzo(id) === 'codice', mazzoDi: (cid) => S.cards[cid]?.deck });
const palSessione = (s) => (s.kind === 'sim' ? 'materie' : s.kind === 'scrivi' ? 'codice' : palMazzo(S.cards[s.answers?.[0]?.c]?.deck ?? s.decks?.[0] ?? s.answers?.[0]?.c ?? ''));
const tutteTutte = () => Object.values(S.cards);
const tutte = () => tutteTutte().filter((c) => palMazzo(c.deck) === pal());
const deckListTutti = () => Object.values(S.decks).sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || String(a.name).localeCompare(b.name));
const deckList = () => deckListTutti().filter((d) => palestraDi(d) === pal());
// Mazzi scelti in passato che appartengono all'altra palestra non contano.
const selPal = (k) => (S.prefs[k] || []).filter((id) => S.decks[id] && palMazzo(id) === pal());
const deckMateria = () => Object.fromEntries(Object.values(S.decks).map((d) => [d.id, d.materia]));
const nomeMateria = (m) => MATERIE[materiaKey(m)] || m || 'Altro';
function materie() {
  const v = [];
  for (const d of deckList()) { const n = nomeMateria(d.materia); if (!v.includes(n)) v.push(n); }
  const posto = (n) => { const i = ORDINE_MATERIE.findIndex((k) => MATERIE[k] === n); return i < 0 ? 99 : i; };
  return v.sort((a, b) => posto(a) - posto(b));
}
const mazziDi = (m) => deckList().filter((d) => nomeMateria(d.materia) === m).map((d) => d.id);
const carteDi = (ids) => tutte().filter((c) => !ids || ids.includes(c.deck));
const deckName = (id) => S.decks[id]?.name || id;
const salvaPrefs = () => kvSet('prefs', S.prefs);

// ---------- invio al repository ----------
let syncT;
function syncPresto(ms = 15000) {
  clearTimeout(syncT);
  syncT = setTimeout(() => { if (navigator.onLine) A.sincronizza(); }, ms);
}
function eventoVoto(c, g, k, at = new Date().toISOString(), ms) { return { id: A.nuovoId(), t: 'v', at, c: c.id, d: c.deck, g, k, ...(ms != null ? { ms } : {}) }; }
async function registra(eventi) {
  await A.aggiungi(eventi);
  ({ progress: S.progress, sessions: S.sessions } = ricostruisci(A.eventi()));
}
const salvaRun = () => (S.run ? kvSet('run', S.run) : kvDel('run'));

// ---------- percorso ----------
const VISTE = {};
const NAV_K = ['oggi', 'rotta', 'mazzi', 'risultati', 'gestione'];
const barraNav = new BarraLiquida(nav, NAV.map(([k, t, p]) => [k, t, svgNav(p)]), (nome, cambia) => { if (cambia) vai(nome); });
function vai(h) { if (location.hash === `#${h}`) route(); else location.hash = h; }
function route() {
  const h = (location.hash || '#oggi').slice(1);
  // Una prova in corso non si perde: qualsiasi indirizzo riporta alla prova.
  if (S.run && !S.run.finished && !['oggi'].includes(h) && h !== S.run.view) { location.hash = S.run.view; return; }
  const nome = VISTE[h] ? h : 'oggi';
  const principale = NAV.some(([k]) => k === nome);
  app.classList.toggle('sessione', !principale);
  const prima = S.ui.vista, y = prima === nome ? window.scrollY : 0;
  // L'effetto d'ingresso dipende da dove si arriva. Un ridisegno sulla stessa schermata resta fermo.
  if (!S.fx && prima !== nome) {
    const a = NAV_K.indexOf(prima), b = NAV_K.indexOf(nome);
    S.fx = a >= 0 && b >= 0 ? (b > a ? 'tab-d' : 'tab-s') : 'apri';
  }
  S.ui.vista = nome;
  // Rotta e Gestione sono comuni; il resto prende il colore della palestra scelta.
  const tinta = pal() === 'codice' && !['rotta', 'gestione'].includes(nome) ? 'codice' : 'materie';
  if (document.documentElement.dataset.palestra !== tinta) document.documentElement.dataset.palestra = tinta;
  VISTE[nome]();
  barraNav.imposta(nome, principale);
  dopoRender();
  window.scrollTo(0, y);
}
// Piccoli movimenti che servono solo a far sentire viva l'interfaccia.
function dopoRender() {
  const fx = fermo() ? '' : S.fx || '';
  S.fx = null;
  if (app.dataset.fx !== fx) app.dataset.fx = fx;
  // Pillola dei selettori a segmenti: parte dalla posizione precedente e scivola su quella nuova.
  document.querySelectorAll('.segmenti').forEach((seg) => {
    const bs = [...seg.querySelectorAll('button')], i = bs.findIndex((b) => b.getAttribute('aria-pressed') === 'true');
    const chiave = bs[0]?.dataset.a;
    if (i < 0 || !chiave) return;
    const t = document.createElement('i');
    t.className = 'seg-goccia';
    t.style.setProperty('--n', bs.length);
    const da = S.ui.seg[chiave] ?? i;
    t.style.transform = `translateX(${da * 100}%)`;
    seg.prepend(t);
    S.ui.seg[chiave] = i;
    if (da !== i && !fermo()) { t.getBoundingClientRect(); t.style.transform = `translateX(${i * 100}%)`; } else t.style.transform = `translateX(${i * 100}%)`;
  });
  if (S.ui.ultimo) {
    let el = null;
    try { el = app.querySelector(S.ui.ultimo); } catch { /* selettore non valido: nessun rimbalzo */ }
    if (el?.matches('.chip, .formato, .segnata, [data-a="segna"]')) rimbalzo(el);
    if (el?.matches('[data-a="passo"]')) rimbalzo(el.closest('.stepper')?.querySelector('b'), 0.8);
    S.ui.ultimo = null;
  }
  if (fx === 'esito') app.querySelectorAll('[data-conta]').forEach((el) => contaFino(el, el.textContent));
}
const mostra = (html) => { app.innerHTML = html; };

// ---------- pezzi riusati ----------
function bannerSync() {
  const st = A.stato, attesa = A.pending.length;
  if (!A.collegato()) return '';
  const salve = attesa ? ` ${plur(attesa, 'risposta è salvata', 'risposte sono salvate')} su questo dispositivo, non si perdono.` : '';
  if (st.fase === 'offline' && attesa) return `<div class="avviso">${ic.att}<span>Sei senza rete.${salve} Le invio appena torna.</span></div>`;
  if (st.fase === 'errore') {
    const rete = st.tipoErrore === 'rete';
    return `<div class="avviso ${rete ? '' : 'errore'}">${ic.att}<span>${esc(st.errore)}${salve}${rete ? '' : ' Controlla in Gestione.'}</span></div>`;
  }
  return '';
}
function testaSessione(titolo, chiudi, perc) {
  return `<div class="testa">
    <button class="tondo" data-a="${chiudi}" aria-label="Chiudi">${ic.x}</button>
    <div class="testa-centro"><div class="titolo num ${perc == null ? 'grande' : ''}">${titolo}</div>${perc == null ? '' : `<div class="progresso"><i style="width:${perc}%"></i></div>`}</div>
    <div class="fantasma"></div>
  </div>`;
}
const barra = (nome, destra, pct, colore) => `<div class="barra-riga"><div class="riga"><span>${esc(nome)}</span><span>${destra}</span></div><div class="barra"><i style="width:${Math.round(pct)}%${colore ? `;background:${colore}` : ''}"></i></div></div>`;
const pulsanteSegmento = (azione, val, attivo, testo) => `<button data-a="${azione}" data-v="${esc(val)}" aria-pressed="${attivo}">${esc(testo)}</button>`;

const selettorePalestra = () => `<div class="segmenti palestra" role="group" aria-label="Palestra">${pulsanteSegmento('palestra', 'materie', pal() === 'materie', 'Materie')}${pulsanteSegmento('palestra', 'codice', pal() === 'codice', 'Codice')}</div>`;
const sec = (ms) => (ms == null ? '–' : `${(ms / 1000).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`);

// ---------- OGGI ----------
VISTE.oggi = () => {
  if (S.run?.finished) { S.run = null; salvaRun(); }
  if (pal() === 'codice') return oggiCodice();
  const d = oggi(), all = tutte();
  const dovute = all.filter((c) => inScadenza(c, S.progress, d)).length;
  const nuove = all.filter((c) => maiVista(c, S.progress)).length;
  const sett = S.sessions.filter((s) => palSessione(s) === 'materie' && Date.now() - Date.parse(s.at) < 7 * 864e5);
  const giuste = sett.reduce((a, s) => a + (s.right || 0), 0), tot = sett.reduce((a, s) => a + (s.total || 0), 0);
  const ultimaSim = S.sessions.find((s) => s.kind === 'sim');
  const titolo = !all.length ? 'Palestra vuota' : dovute ? plur(dovute, 'carta da ripassare', 'carte da ripassare') : 'Niente da ripassare';
  const righe = materie().map((m) => {
    const cs = carteDi(mazziDi(m)), ok = cs.filter((c) => consolidata(c, S.progress)).length, du = cs.filter((c) => inScadenza(c, S.progress, d)).length;
    return barra(m, `${ok} su ${cs.length} · ${du} oggi`, cs.length ? (ok / cs.length) * 100 : 0);
  }).join('');
  const inCorso = S.run && !S.run.finished;
  const ev = A.eventi(), dueGiorni = regolaDueGiorni(ev, d, opzRotta());
  mostra(`
    ${selettorePalestra()}
    <div class="centro"><div class="saluto">${ic.cap}${saluto()}, ${NOME}</div><h1>${titolo}</h1></div>
    ${bannerSync()}
    ${dueGiorni === 'minimo' && !inCorso ? `<a class="minimo" href="#ripasso" data-a="giornoMinimo"><span><b>Oggi basta il giorno minimo: 10 minuti di ripasso</b><span>Ieri niente. Mai due giorni di fila: così la catena non si rompe.</span></span>${ic.dx('#2F4FAE')}</a>` : ''}
    ${domenica(d) ? cartaSettimana(riepilogoSettimana(ev, d, opzRotta()), 'La tua settimana') : ''}
    ${riprendi()}
    ${collegaDati()}
    <div class="tile-griglia">
      <a class="tile blu" href="#ripasso"><svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24"><rect x="3" y="6" width="13" height="15" rx="3" fill="#2F8FD6" opacity=".45"/><rect x="8" y="3" width="13" height="15" rx="3" fill="#2F8FD6"/></svg><span><b>Ripasso</b><span class="num">${dovute} in scadenza</span></span></a>
      <a class="tile marrone" href="#quiz" data-a="tileQuiz" data-v="due"><svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#B85CD0"/><path d="M7.500 12.500l3 3 6-6.500" fill="none" stroke="#fff" stroke-width="2.400" stroke-linecap="round" stroke-linejoin="round"/></svg><span><b>Quiz</b><span>con correzione subito</span></span></a>
      <a class="tile blu" href="#simulazione"><svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24"><rect x="9.500" y="1.500" width="5" height="3" rx="1.500" fill="#C9781A"/><circle cx="12" cy="14" r="9" fill="#C9781A"/><path d="M12 9v5l3 2" fill="none" stroke="#fff" stroke-width="2.200" stroke-linecap="round" stroke-linejoin="round"/></svg><span><b>Simulazione</b><span class="num">${PRESETS.ade.n} domande in ${PRESETS.ade.min} min</span></span></a>
      <a class="tile marrone" href="#quiz" data-a="tileQuiz" data-v="weak"><svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#D4497A"/><circle cx="12" cy="12" r="5.500" fill="#fff"/><circle cx="12" cy="12" r="2.500" fill="#D4497A"/></svg><span><b>Errori</b><span>prima le più sbagliate</span></span></a>
    </div>
    <div class="tre">
      <div><b>${nuove}</b><small>mai viste</small></div>
      <div><b>${tot ? `${Math.round((giuste / tot) * 100)}%` : '–'}</b><small>giuste in 7 giorni</small></div>
      <div><b>${ultimaSim ? fmt(ultimaSim.score) : '–'}</b><small>ultima simulazione</small></div>
    </div>
    ${righe ? `<section class="card"><h2>Carte consolidate, per materia</h2>${righe}</section>` : ''}
  `);
};
const saluto = () => { const ora = Number(new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: 'numeric', hour12: false }).format(new Date())); return ora < 13 ? 'Buongiorno' : ora < 18 ? 'Buon pomeriggio' : 'Buonasera'; };
const riprendi = () => { const nomi = { flash: 'il ripasso', quiz: 'il quiz', sim: 'la simulazione', scrivi: "l'allenamento" }; return S.run && !S.run.finished ? `<a class="azione" href="#${S.run.view}">Riprendi ${nomi[S.run.kind]}</a>` : ''; };
const collegaDati = () => (!A.collegato() ? `<div class="card"><h2>Collega i tuoi dati</h2><p class="piccolo">Carte e progressi stanno nel tuo repository privato. Basta farlo una volta per dispositivo.</p><a class="azione piccola" href="#gestione">Vai a Gestione</a></div>` : '');
// Oggi nella palestra del codice.
function oggiCodice() {
  const d = oggi(), all = tutte(), st = statCodice(A.eventi(), S.cards, d);
  const dovute = all.filter((c) => inScadenza(c, S.progress, d)).length;
  const titolo = !all.length ? 'Codice vuoto' : dovute ? plur(dovute, 'parola da ripassare', 'parole da ripassare') : 'Niente da ripassare';
  const storie = deckList().find((x) => x.id === 'cf-storie');
  const ico = (path) => `<svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#7A3E9D" stroke-width="2.200" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
  mostra(`
    ${selettorePalestra()}
    <div class="centro"><div class="saluto">Codice fonetico</div><h1>${titolo}</h1></div>
    ${bannerSync()}
    ${riprendi()}
    ${collegaDati()}
    <div class="tile-griglia">
      <a class="tile viola" href="#ripasso">${ico('<rect x="8" y="3" width="13" height="15" rx="3"/><path d="M4 7v11a3 3 0 0 0 3 3h9"/>')}<span><b>Ripasso</b><span class="num">${dovute} in scadenza</span></span></a>
      <a class="tile viola" href="#scrivi" data-a="scTutte">${ico('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>')}<span><b>Scrivi a memoria</b><span>numero e parola, nei due sensi</span></span></a>
      ${storie ? `<a class="tile viola" href="#ripasso" data-a="mazzoRipassa" data-v="cf-storie">${ico('<path d="M9 15 15 9"/><path d="M11 6l1.500-1.500a4 4 0 0 1 5.700 5.700L16.700 11.700M13 18l-1.500 1.500a4 4 0 0 1-5.700-5.700L7.300 12.300"/>')}<span><b>Storie a coppie</b><span>due parole, una scena</span></span></a>` : ''}
      <a class="tile viola" href="#scrivi" data-a="scriviLente">${ico('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.500 2M10 2h4"/>')}<span><b>Le più lente</b><span class="num">${st.lente.length ? plur(st.lente.length, 'parola', 'parole') + ' sopra i 2 s' : 'nessuna sopra i 2 s'}</span></span></a>
    </div>
    <div class="tre">
      <div><b class="num">${st.fissate}/${st.parole}</b><small>parole fissate</small></div>
      <div><b class="num">${sec(st.medioMs)}</b><small>tempo tipico</small></div>
      <div><b class="num">${st.iniziate}/10</b><small>decine iniziate</small></div>
    </div>
    <section class="card"><div class="riga"><h2>Le dieci decine</h2><span class="meta">parole fissate</span></div>
      <div class="decine">${st.decine.map((x) => `<button class="decina" data-a="decina" data-v="${x.da[0]}" aria-label="Allena da ${x.da} a ${x.a}: ${x.fissate} fissate su ${x.tot}"><b class="num">${x.da}-${x.a}</b><small class="num">${x.fissate}/${x.tot}</small><i><u style="width:${x.tot ? Math.round((x.fissate / x.tot) * 100) : 0}%"></u></i></button>`).join('')}</div>
      <p class="meta">Fissata vuol dire: l'ultima volta l'hai scritta giusta e in meno di 2 secondi, in tutti e due i sensi. Tocca una decina per allenarla.</p>
    </section>`);
}

// ---------- MAZZI ----------
VISTE.mazzi = () => {
  const d = oggi(), mat = materie(), filtro = S.ui.filtroMazzi && mat.includes(S.ui.filtroMazzi) ? S.ui.filtroMazzi : null;
  const carta = (dk) => {
    const cs = carteDi([dk.id]);
    const q = cs.filter((c) => c.kind === 'quiz').length, nw = cs.filter((c) => maiVista(c, S.progress)).length, du = cs.filter((c) => inScadenza(c, S.progress, d)).length, ok = cs.filter((c) => consolidata(c, S.progress)).length;
    return `<article class="card"><div style="font-size:16px;line-height:21px;font-weight:700">${esc(dk.name)}</div>
      ${dk.desc ? `<div class="meta">${esc(dk.desc)}</div>` : ''}
      <div class="meta num">${cs.length} carte · ${q} quiz · ${nw} nuove · ${du} oggi · ${ok} consolidate</div>
      <div class="barra"><i style="width:${cs.length ? Math.round((ok / cs.length) * 100) : 0}%"></i></div>
      <div class="scorciatoie ${cs.some((c) => coppiaDaCarta(c)) ? 'tre-bottoni' : ''}"><button class="azione tenue piccola" data-a="mazzoRipassa" data-v="${esc(dk.id)}">Ripassa</button><button class="azione tenue piccola" data-a="mazzoQuiz" data-v="${esc(dk.id)}" ${q ? '' : 'disabled'}>Quiz</button>${cs.some((c) => coppiaDaCarta(c)) ? `<button class="azione tenue piccola" data-a="mazzoScrivi" data-v="${esc(dk.id)}">Scrivi</button>` : ''}</div></article>`;
  };
  mostra(`${selettorePalestra()}<h1>${pal() === 'codice' ? 'Mazzi del codice' : 'Mazzi'}</h1><p class="sotto">${plur(tutte().length, 'carta', 'carte')}, un mazzo per argomento</p>
    ${mat.length > 1 ? `<div class="chips scorre"><button class="chip" data-a="filtroMazzi" data-v="" aria-pressed="${!filtro}">Tutti</button>${mat.map((m) => `<button class="chip" data-a="filtroMazzi" data-v="${esc(m)}" aria-pressed="${filtro === m}">${esc(m)}</button>`).join('')}</div>` : ''}
    ${(filtro ? [filtro] : mat).map((m) => `<h2 class="etichetta">${esc(m)}</h2>${deckList().filter((x) => nomeMateria(x.materia) === m).map(carta).join('')}`).join('') || '<div class="card vuoto">Ancora nessun mazzo. Le carte arrivano dalle lezioni con Claude.</div>'}`);
};

// ---------- scelta mazzi per ripasso e quiz ----------
function sceltaMazzi(chiave, lista = deckList()) {
  const sel = (S.prefs[chiave] || []).filter((id) => lista.some((d) => d.id === id));
  return `<h2 class="etichetta">Da quali mazzi</h2><div class="chips"><button class="chip" data-a="tuttiMazzi" data-v="${chiave}" aria-pressed="${!sel.length}">Tutti</button>${lista.map((d) => `<button class="chip" data-a="toggleMazzo" data-k="${chiave}" data-v="${esc(d.id)}" aria-pressed="${sel.includes(d.id)}">${esc(d.name)}</button>`).join('')}</div>`;
}
const stepper = (k, val, testo) => `<div class="card stepper"><h2>${testo}</h2><div><button class="tondo" data-a="passo" data-k="${k}" data-v="-5" aria-label="Meno 5"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3C4454" stroke-width="3" stroke-linecap="round"><path d="M5 12h14"/></svg></button><b>${val}</b><button class="tondo" data-a="passo" data-k="${k}" data-v="5" aria-label="Più 5"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3C4454" stroke-width="3" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button></div></div>`;

// ---------- RIPASSO ----------
VISTE.ripasso = () => {
  if (S.run?.view === 'ripasso') return S.run.finished ? fineFlash() : schermoFlash();
  const d = oggi(), sel = selPal('flDecks'), pool = carteDi(sel.length ? sel : null);
  const du = pool.filter((c) => inScadenza(c, S.progress, d)).length, nw = pool.filter((c) => maiVista(c, S.progress)).length;
  const modo = S.ui.flModo || (du || !nw ? 'due' : 'new');
  const n = S.prefs.flN || 30;
  mostra(`${testaSessione('Ripasso', 'home')}
    <h1>Le carte di oggi</h1>
    <p class="sotto">Tornano dopo 1, 3, 7, 14, 30, 60 e 120 giorni se le sai. Se le sbagli, ripartono da capo.</p>
    <div class="segmenti">${pulsanteSegmento('flModo', 'due', modo === 'due', `In scadenza (${du})`)}${pulsanteSegmento('flModo', 'new', modo === 'new', `Mai viste (${nw})`)}${pulsanteSegmento('flModo', 'all', modo === 'all', `Tutte (${pool.length})`)}</div>
    ${stepper('flN', n, 'Quante carte')}
    ${sceltaMazzi('flDecks')}
    <div class="piede"><button class="azione" data-a="iniziaFlash" data-v="${modo}">Inizia</button></div>`);
};
function corpoFronte(c, reveal, pick) {
  const numero = /^\d{1,3}( \d{1,3})?$/.test(String(c.front).trim()); // un numero, o una coppia come 01 51
  const trap = c.tags?.includes('trappola') ? '<span class="pill warn">trappola</span>' : '';
  const testa = `<div class="mazzo">${esc(deckName(c.deck))}${trap}</div>`;
  const opzioni = c.kind === 'quiz' ? `<div class="opzioni">${(c.options || []).map((o, i) => opzione(c, o, i, reveal, pick, 'flPick')).join('')}</div>` : '';
  if (!reveal) {
    const lunga = String(c.front).length > 110 || c.kind === 'quiz';
    return { testa, html: `<p class="fronte ${numero ? 'numero' : lunga ? 'lunga' : ''}">${esc(c.front)}</p>${opzioni}` };
  }
  const risposta = c.kind === 'quiz' ? opzioni : `<div class="sep"></div><p class="retro">${esc(c.back)}</p>`;
  return { testa, html: `<p class="domanda-su ${numero ? 'numero' : ''}">${esc(c.front)}</p>${risposta}
    ${c.why ? `<div class="perche"><p>${esc(c.why)}</p></div>` : ''}${c.mnem ? immagine(c.mnem) : ''}` };
}
const immagine = (t) => `<div class="imm"><div class="t">${ic.lamp}Immagine</div><p>${esc(t)}</p></div>`;
function opzione(c, o, i, reveal, pick, azione) {
  const lett = 'ABCD'[i] || String(i + 1);
  let cl = '', tag = '';
  if (reveal && i === c.answer) { cl = 'giusta'; tag = `<small>${ic.ok()}Giusta</small>`; }
  else if (reveal && i === pick) { cl = 'errata'; tag = `<small>${ic.no}La tua</small>`; }
  return `<button class="opz ${cl}" data-a="${azione}" data-v="${i}" ${reveal ? 'disabled' : ''}><b>${lett}</b><span>${esc(o)}</span>${tag}</button>`;
}
function schermoFlash() {
  const r = S.run;
  if (r.i >= r.queue.length) return fineFlash();
  const c = S.cards[r.queue[r.i]];
  if (!c) { r.i++; return schermoFlash(); }
  const p = S.progress[c.id], d = oggi();
  const info = p ? `Scatola ${p.box} · vista ${plur(p.reps, 'volta', 'volte')}` : 'Carta nuova';
  const { testa, html } = corpoFronte(c, r.shown, r.pick);
  const voti = [['Sbagliata', 0], ['Difficile', 1], ['La sapevo', 2]].map(([t, g]) => `<button class="voto v${g}" data-a="vota" data-v="${g}"><b>${t}</b><span>${testoGiorni(prossimoRitorno(p, g, d))}</span></button>`).join('');
  mostra(`${testaSessione(`Carta ${r.i + 1} di ${r.queue.length}`, 'fermaFlash', (r.i / r.queue.length) * 100)}
    <article class="carta ${r.shown ? '' : 'grande'}">${testa}${html}<div class="meta" ${r.shown ? '' : 'style="margin-top:auto"'}>${r.shown && c.ref ? esc(c.ref) : info}</div></article>
    <div class="piede">${r.shown ? `<div class="voti">${voti}</div>` : '<button class="azione" data-a="mostraRisposta">Mostra la risposta</button>'}</div>`);
}
function fineFlash() {
  const r = S.run; r.finished = true;
  const n = r.answers.length, ok = r.answers.filter((a) => a.ok).length, bad = r.answers.filter((a) => a.g === 0).length;
  if (n && !r.saved) {
    r.saved = true;
    registra({ id: A.nuovoId(), t: 's', kind: 'flash', decks: r.decks, at: new Date().toISOString(), dur: Math.round((Date.now() - r.started) / 1000), total: n, right: ok, wrong: bad, blank: 0, score: ok, max: n, answers: r.answers.map((a) => ({ c: a.c, g: a.g, ok: a.ok })) }).then(() => A.sincronizza());
  }
  salvaRun();
  const sbagliate = r.answers.filter((a) => a.g === 0).map((a) => S.cards[a.c]).filter(Boolean);
  mostra(`${testaSessione('Sessione finita', 'chiudiRun')}
    <div class="tre"><div><b>${n}</b><small>viste</small></div><div><b style="color:var(--ok)">${ok}</b><small>sapute</small></div><div><b style="color:var(--bad)">${bad}</b><small>tornano domani</small></div></div>
    ${sbagliate.length ? `<section class="card"><h2>Da rivedere</h2>${sbagliate.map((c) => `<div class="errori-riga"><b>${esc(c.front)}</b><div class="meta">${esc(c.kind === 'quiz' ? c.options?.[c.answer] : c.back)}${c.ref ? ` · ${esc(c.ref)}` : ''}</div></div>`).join('')}</section>` : ''}
    <div class="piede"><button class="azione" data-a="chiudiRun">Torna a Oggi</button></div>`);
}

// ---------- QUIZ ----------
VISTE.quiz = () => {
  if (S.run?.view === 'quiz') return S.run.finished ? fineQuiz() : schermoQuiz();
  const sel = selPal('qzDecks'), pool = carteDi(sel.length ? sel : null).filter((c) => c.kind === 'quiz');
  const modo = S.ui.qzModo || 'weak', n = S.prefs.qzN || 15;
  mostra(`${testaSessione('Quiz', 'home')}
    <h1>Allenamento con correzione</h1>
    <p class="sotto">Senza tempo. Le risposte aggiornano anche il ripasso.</p>
    <div class="segmenti">${pulsanteSegmento('qzModo', 'weak', modo === 'weak', 'Più sbagliate')}${pulsanteSegmento('qzModo', 'due', modo === 'due', 'In scadenza')}${pulsanteSegmento('qzModo', 'rand', modo === 'rand', 'A caso')}</div>
    ${stepper('qzN', n, 'Quante domande')}
    ${sceltaMazzi('qzDecks')}
    <div class="piede"><button class="azione" data-a="iniziaQuiz" ${pool.length ? '' : 'disabled'}>${pool.length ? 'Inizia' : 'Nessuna domanda disponibile'}</button></div>`);
};
function schermoQuiz() {
  const r = S.run;
  if (r.i >= r.queue.length) return fineQuiz();
  const c = S.cards[r.queue[r.i]];
  if (!c) { r.i++; return schermoQuiz(); }
  const risposto = r.pick !== null, giuste = r.answers.filter((a) => a.ok).length;
  const trap = c.tags?.includes('trappola') ? '<span class="pill warn">trappola</span>' : '';
  mostra(`${testaSessione(`Domanda ${r.i + 1} di ${r.queue.length} · ${plur(giuste, 'giusta', 'giuste')}`, 'fermaQuiz', ((r.i + (risposto ? 1 : 0)) / r.queue.length) * 100)}
    ${trap ? `<div>${trap}</div>` : ''}
    <p class="quesito">${esc(c.front)}</p>
    <div class="opzioni">${(c.options || []).map((o, i) => opzione(c, o, i, risposto, r.pick, 'qzPick')).join('')}</div>
    ${risposto ? `<div class="perche"><div class="t ${r.pick === c.answer ? 'giusto' : 'sbagliato'}">${r.pick === c.answer ? 'Giusto' : 'Sbagliato'}</div>${c.why ? `<p>${esc(c.why)}</p>` : ''}</div>${c.mnem ? immagine(c.mnem) : ''}${c.ref ? `<div class="rif">${esc(c.ref)}</div>` : ''}
      <div class="piede"><button class="azione" data-a="qzAvanti">${r.i + 1 < r.queue.length ? 'Avanti' : 'Vedi il risultato'}</button></div>` : ''}`);
}
function fineQuiz() {
  const r = S.run; r.finished = true;
  const n = r.answers.length, ok = r.answers.filter((a) => a.ok).length;
  if (n && !r.saved) {
    r.saved = true;
    registra({ id: A.nuovoId(), t: 's', kind: 'quiz', decks: r.decks, at: new Date().toISOString(), dur: Math.round((Date.now() - r.started) / 1000), total: n, right: ok, wrong: n - ok, blank: 0, score: ok, max: n, answers: r.answers.map((a) => ({ c: a.c, pick: a.pick, ok: a.ok })) }).then(() => A.sincronizza());
  }
  salvaRun();
  const errate = r.answers.filter((a) => !a.ok).map((a) => ({ a, c: S.cards[a.c] })).filter((x) => x.c);
  mostra(`${testaSessione('Risultato', 'chiudiRun')}
    <div class="centro"><div class="punteggio">${ok}<small> / ${n}</small></div><div class="piccolo num">${n ? Math.round((ok / n) * 100) : 0}% di risposte giuste</div></div>
    ${errate.length ? `<section class="card"><h2>Errori</h2>${errate.map(({ a, c }) => `<div class="errori-riga"><b>${esc(c.front)}</b><div class="meta">Hai detto: ${esc(c.options?.[a.pick])} · Giusta: ${esc(c.options?.[c.answer])}${c.ref ? ` · ${esc(c.ref)}` : ''}</div></div>`).join('')}</section>` : '<div class="card vuoto">Nessun errore.</div>'}
    <div class="piede colonna"><button class="azione" data-a="chiudiRun">Torna a Oggi</button>${errate.length ? '<button class="azione vetro" data-a="copiaErroriRun">Copia gli errori per Claude</button>' : ''}</div>`);
}

// ---------- SIMULAZIONE ----------
const regole = (p) => {
  const segno = (x) => (x > 0 ? '+' : x < 0 ? '−' : '') + fmtMin(Math.abs(x));
  return `${segno(p.right)} · ${segno(p.wrong)} · ${segno(p.blank)} — idoneità ${p.pass % 1 ? fmt(p.pass) : p.pass} su ${p.max}`;
};
VISTE.simulazione = () => {
  if (S.run?.view === 'simulazione') return S.run.finished ? (S.run.correzione ? correzioneSim() : esitoSim()) : prova();
  const pk = PRESETS[S.prefs.simPreset] ? S.prefs.simPreset : 'ade', p = PRESETS[pk];
  const sel = (S.prefs.simGruppi || {})[pk] || [];
  const anteprima = preparaSimulazione(pk, tutteTutte(), deckMateria(), sel.length ? sel : null);
  const avvisi = !tutteTutte().length ? ['Nessuna carta: collega il repository in Gestione.'] : !anteprima.queue.length ? ['Nessuna domanda a scelta multipla per questa scelta.'] : anteprima.avvisi;
  mostra(`${testaSessione('Simulazione', 'home')}
    <div><h1>Come il giorno della prova</h1><p class="sotto">Tempo fisso. Il risultato lo vedi solo alla fine.</p></div>
    <div role="radiogroup" aria-label="Formato" style="display:flex;flex-direction:column;gap:8px">
    ${Object.entries(PRESETS).map(([k, x]) => `<button class="formato" role="radio" aria-checked="${k === pk}" data-a="simPreset" data-v="${k}"><b>${esc(x.label)}${k === pk ? `<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#3E66D9"/><path d="M7.500 12.500l3 3 6-6.500" fill="none" stroke="#fff" stroke-width="2.400" stroke-linecap="round" stroke-linejoin="round"/></svg>` : ''}</b><span>${x.n} domande in ${x.min} minuti · ${x.gruppi.map((g) => g.n).join('/')}</span><em>${regole(x)}</em></button>`).join('')}
    </div>
    <h2 class="etichetta">Da quali materie</h2>
    <div class="chips"><button class="chip" data-a="simTutte" aria-pressed="${!sel.length}">Tutte</button>${p.gruppi.map((g) => `<button class="chip" data-a="simGruppo" data-v="${g.id}" aria-pressed="${sel.includes(g.id)}">${esc(g.short)}</button>`).join('')}</div>
    ${avvisi.map((a) => `<div class="avviso">${ic.att}<span>${esc(a)}</span></div>`).join('')}
    <div class="piede"><button class="azione" data-a="avviaSim" ${anteprima.queue.length ? '' : 'disabled'}>Avvia la simulazione</button></div>`);
};
function avviaTick() {
  clearInterval(S.tick);
  S.tick = setInterval(() => {
    const r = S.run;
    if (!r || r.view !== 'simulazione' || r.finished) { clearInterval(S.tick); return; }
    const left = Math.max(0, Math.round((r.ends - Date.now()) / 1000));
    document.querySelectorAll('.timer').forEach((t) => { t.textContent = mmss(left); t.classList.toggle('poco', left < 300); });
    if (left <= 0) finisciSim(true);
  }, 500);
}
function prova() {
  const r = S.run, c = S.cards[r.queue[r.i]];
  const left = Math.max(0, Math.round((r.ends - Date.now()) / 1000));
  const date = Object.keys(r.picks).length, tot = r.queue.length;
  const pick = r.picks[r.queue[r.i]];
  const sheet = r.sheet ? fogliGriglia(left, date, tot) : '';
  mostra(`<div class="testa" ${r.sheet ? 'style="visibility:hidden"' : ''}>
      <button class="tondo" data-a="apriGriglia" aria-label="Apri la griglia delle domande">${ic.griglia}</button>
      <div class="testa-centro"><div class="timer ${left < 300 ? 'poco' : ''}" role="timer">${mmss(left)}</div></div>
      <button class="tondo ${r.flags[r.queue[r.i]] ? 'segnata' : ''}" data-a="segna" aria-label="Segna per dopo" aria-pressed="${!!r.flags[r.queue[r.i]]}">${ic.band(r.flags[r.queue[r.i]] ? '#8A5200' : '#3C4454')}</button>
    </div>
    <div class="riga num" style="padding:0 4px;font-size:14px;line-height:20px;font-weight:700"><span>Domanda ${r.i + 1} di ${tot}</span><span style="font-weight:500;color:var(--ink2)">${date} date · ${tot - date} non date</span></div>
    ${c ? `<article class="quesito-box">${esc(c.front)}</article>
    <div class="opzioni" role="radiogroup" aria-label="Risposte" style="gap:8px">${(c.options || []).map((o, i) => `<button class="opz grande ${pick === i ? 'scelta' : ''}" role="radio" aria-checked="${pick === i}" data-a="simPick" data-v="${i}"><b>${'ABCD'[i] || i + 1}</b><span>${esc(o)}</span></button>`).join('')}</div>` : '<div class="card vuoto">Questa carta non esiste più.</div>'}
    <div class="piede" style="gap:10px;align-items:center">
      <button class="freccia" data-a="simPrec" aria-label="Domanda precedente" ${r.i === 0 ? 'disabled' : ''}>${ic.sn}</button>
      <button class="bianco" data-a="simBianco">Lascia in bianco</button>
      <button class="freccia avanti" data-a="simSucc" aria-label="Domanda successiva">${ic.ds}</button>
    </div>${sheet}`);
}
function fogliGriglia(left, date, tot) {
  const r = S.run, p = r.p, nonDate = tot - date;
  const nota = p.wrong < 0
    ? `${nonDate === 1 ? 'La non data vale' : `Le ${nonDate} non date valgono`} ${fmtMin(p.blank)}: nessuna penalità. Ogni risposta sbagliata toglie ${fmtMin(-p.wrong)}.`
    : `Le sbagliate non tolgono punti: conviene rispondere a tutte. ${nonDate ? `Ne mancano ${nonDate}.` : ''}`;
  const celle = r.queue.map((id, i) => {
    const cl = [r.flags[id] ? 'segn' : r.picks[id] != null ? 'data' : '', i === r.i ? 'ora' : ''].join(' ');
    return `<button class="${cl}" data-a="simVai" data-v="${i}" ${i === r.i ? 'aria-current="true"' : ''}>${i + 1}</button>`;
  }).join('');
  return `<div class="foglio-sfondo"></div><div class="foglio-tempo"><div class="timer ${left < 300 ? 'poco' : ''}" role="timer">${mmss(left)}</div></div>
    <section class="foglio" aria-label="Griglia delle domande"><div class="maniglia"></div>
      <div class="riga"><h2>Le tue risposte</h2><span class="piccolo num">${date} date su ${tot}</span></div>
      <div class="legenda"><span><i style="background:#3E66D9"></i>Data</span><span><i style="border:1.5px solid #AEB6C6"></i>In bianco</span><span><i style="background:#FCEFD6;box-shadow:inset 0 -4px 0 #C9781A"></i>Segnata</span></div>
      <div class="griglia">${celle}</div>
      <p class="piccolo">${nota}</p>
      ${r.conferma ? '<div class="avviso">Consegnare adesso? Poi non puoi più cambiare le risposte.</div>' : ''}
      <div class="bottoni"><button class="azione tenue" data-a="chiudiGriglia">Continua</button><button class="azione ${r.conferma ? 'pericolo' : ''}" data-a="consegna">${r.conferma ? 'Sì, consegna' : 'Consegna'}</button></div>
      <button class="link-basso" data-a="abbandona">${r.confermaAbb ? 'Tocca di nuovo per abbandonare senza salvare' : 'Abbandona la prova'}</button>
    </section>`;
}
async function finisciSim(tempoScaduto) {
  const r = S.run;
  if (!r || r.finished) return;
  clearInterval(S.tick);
  r.finished = true; r.tempoScaduto = tempoScaduto; r.sheet = false;
  const at = new Date().toISOString();
  r.results = r.queue.map((id) => {
    const c = S.cards[id], pick = r.picks[id];
    return { c: id, pick: pick ?? null, st: pick == null ? 'blank' : c && pick === c.answer ? 'right' : 'wrong' };
  });
  const pz = calcolaPunteggio(r.preset, r.results.map((x) => x.st));
  r.score = pz.score; r.conti = pz;
  r.dur = Math.min(r.p.min * 60, Math.round((Date.now() - r.started) / 1000));
  // Per materia, secondo i gruppi del formato.
  const dm = deckMateria();
  const per = r.p.gruppi.map((g) => ({ id: g.id, label: g.label, t: 0, r: 0 })), altre = { id: 'altre', label: 'Altre materie', t: 0, r: 0 };
  for (const x of r.results) {
    const c = S.cards[x.c], k = c ? materiaKey(dm[c.deck]) : 'altro';
    const gi = r.p.gruppi.findIndex((g) => g.materie.includes(k)), riga = gi >= 0 ? per[gi] : altre;
    riga.t++; if (x.st === 'right') riga.r++;
  }
  r.perGruppo = [...per, altre].filter((x) => x.t);
  const eventi = [];
  for (const x of r.results) {
    const c = S.cards[x.c];
    if (c && x.st !== 'blank') eventi.push(eventoVoto(c, x.st === 'right' ? 2 : 0, 'sim', at));
  }
  eventi.push({ id: A.nuovoId(), t: 's', kind: 'sim', preset: r.preset, decks: [], at, dur: r.dur, total: r.queue.length, right: pz.right, wrong: pz.wrong, blank: pz.blank, score: pz.score, max: r.p.max, pass: r.p.pass, timeUp: tempoScaduto, incompleta: r.incompleta, perGruppo: r.perGruppo, answers: r.results.map((x) => ({ c: x.c, pick: x.pick, ok: x.st === 'right', blank: x.st === 'blank' })) });
  await registra(eventi);
  salvaRun();
  A.sincronizza();
  if (pz.passed) vibra.ok(); else vibra.no();
  S.fx = 'esito';
  location.hash = 'simulazione';
  route();
}
function esitoSim() {
  const r = S.run, p = r.p, z = r.conti, passato = r.score >= p.pass;
  const formula = p.wrong < 0 ? `${z.right} × ${fmtMin(p.right)} − ${z.wrong} × ${fmtMin(-p.wrong)} = ${fmt(r.score)}` : `${z.right} giuste su ${r.queue.length}, nessuna penalità`;
  const salvata = A.collegato() && !A.pending.length && A.stato.fase === 'ok';
  mostra(`${testaSessione('Esito simulazione', 'chiudiRun')}
    <div class="centro">
      <div class="punteggio"><span data-conta="${r.score}" data-dec="${p.right === 1 ? 0 : 2}">${p.right === 1 ? r.score : fmt(r.score)}</span><small> / ${p.max}</small></div>
      <span class="pill ${passato ? 'ok' : 'bad'}" style="font-size:14px;line-height:20px">${passato ? ic.ok() : ic.no}${passato ? 'Sopra' : 'Sotto'} l'idoneità (${p.pass % 1 ? fmt(p.pass) : p.pass})</span>
      ${r.tempoScaduto ? '<span class="pill warn">Tempo scaduto</span>' : ''}
      <div class="meta num" style="color:var(--ink2);margin-top:2px">${formula}</div>
    </div>
    ${(r.avvisi || []).map((a) => `<div class="avviso">${ic.att}<span>${esc(a)}</span></div>`).join('')}
    <div class="tre quattro">
      <div><b style="color:var(--ok)">${z.right}</b><small>giuste</small></div><div><b style="color:var(--bad)">${z.wrong}</b><small>sbagliate</small></div><div><b>${z.blank}</b><small>in bianco</small></div><div><b>${mmss(r.dur)}</b><small>tempo</small></div>
    </div>
    <section class="card"><h2>Per materia</h2>${r.perGruppo.map((x) => barra(x.label, `${x.r} su ${x.t}`, x.t ? (x.r / x.t) * 100 : 0)).join('')}</section>
    <div class="centro"><div class="meta" style="color:var(--ink2);display:flex;gap:6px;align-items:center">${salvata ? `<span style="color:var(--ok);display:flex">${ic.ok()}</span>Salvata nel repository` : 'Salvata su questo dispositivo, la invio appena possibile'}</div></div>
    <div class="piede colonna"><button class="azione" data-a="vediCorrezione">Vedi la correzione</button><button class="azione vetro" data-a="copiaErroriSim">Copia gli errori per Claude</button></div>`);
}
function correzioneSim() {
  const r = S.run;
  mostra(`${testaSessione('Correzione', 'chiudiCorrezione')}
    ${r.results.map((x, i) => {
      const c = S.cards[x.c];
      if (!c) return '';
      const stato = x.st === 'right' ? '<span class="pill ok">Giusta</span>' : x.st === 'wrong' ? '<span class="pill bad">Sbagliata</span>' : '<span class="pill neutra">In bianco</span>';
      return `<article class="card"><div class="riga" style="align-items:center"><span class="meta num">${i + 1} · ${esc(deckName(c.deck))}</span>${stato}</div>
        <p style="font-size:15px;line-height:22px;font-weight:600;overflow-wrap:anywhere">${esc(c.front)}</p>
        <div class="opzioni">${(c.options || []).map((o, j) => opzione(c, o, j, true, x.pick, 'nulla')).join('')}</div>
        ${c.why ? `<p class="piccolo">${esc(c.why)}</p>` : ''}${c.mnem ? immagine(c.mnem) : ''}${c.ref ? `<div class="rif">${esc(c.ref)}</div>` : ''}</article>`;
    }).join('')}
    <div class="piede"><button class="azione" data-a="chiudiCorrezione">Torna all'esito</button></div>`);
}

function testoErrori(carte, risposte) {
  const righe = carte.map((c) => {
    const a = risposte.find((x) => x.c === c.id);
    const detta = c.kind === 'quiz' ? (a && a.pick != null ? c.options?.[a.pick] : '(non data)') : '(sbagliata)';
    return `- [${c.id}] ${c.front}\n  Ho risposto: ${detta}\n  Giusta: ${c.kind === 'quiz' ? c.options?.[c.answer] : c.back}${c.ref ? `\n  Rif.: ${c.ref}` : ''}`;
  }).join('\n');
  return `Errori dalla Palestra Quiz (${oggi()}):\n${righe || 'nessuno'}`;
}
async function copia(testo, msg) {
  try { await navigator.clipboard.writeText(testo); toast(msg); } catch { toast('Copia non riuscita su questo dispositivo'); }
}

// ---------- SCRIVI A MEMORIA ----------
const mazziScrittura = () => { const ids = new Set(tutteTutte().filter((c) => coppiaDaCarta(c)).map((c) => c.deck)); return deckListTutti().filter((d) => ids.has(d.id)); };
const carteScrittura = (ids) => tutteTutte().filter((c) => ids.includes(c.deck));
VISTE.scrivi = () => {
  if (S.run?.view === 'scrivi') return S.run.finished ? fineScrivi() : schermoScrivi();
  const senso = S.prefs.scSenso || 'np', n = S.prefs.scN || 20, conTempo = !!S.prefs.scTempo;
  const lista = mazziScrittura(), sel = (S.prefs.scDecks || []).filter((id) => lista.some((d) => d.id === id));
  const solo = S.ui.scSolo;
  const pool = solo ? tutteTutte().filter((c) => solo.includes(c.id)) : scegliScrittura(carteScrittura(sel.length ? sel : lista.map((d) => d.id)), senso, S.progress, oggi(), 1e6);
  const dure = paroleDifficili(A.eventi(), S.cards);
  mostra(`${testaSessione('Scrivi a memoria', 'home')}
    <h1>La scrivi, ti entra</h1>
    <p class="sotto">Se sbagli vedi la risposta e la riscrivi. L'app corregge da sola.</p>
    <div class="segmenti" role="group" aria-label="Senso">${pulsanteSegmento('scSenso', 'np', senso === 'np', 'Numero → parola')}${pulsanteSegmento('scSenso', 'pn', senso === 'pn', 'Parola → numero')}${pulsanteSegmento('scSenso', 'misto', senso === 'misto', 'Misto')}</div>
    ${solo ? `<div class="avviso">${ic.att}<span>Solo ${plur(solo.length, 'carta scelta', 'carte scelte')}, nei due sensi. <button class="link-piccolo" data-a="scTutte">Torna a tutte</button></span></div>` : stepper('scN', n, 'Quante')}
    <section class="card elenco"><button class="voce" role="switch" aria-checked="${conTempo}" data-a="scTempo"><span>Con il tempo<br><span class="meta">Barra di 2 secondi fino alla prima lettera</span></span><span class="interruttore" aria-hidden="true"><i></i></span></button></section>
    ${dure.length ? `<div class="avviso">${ic.att}<span>Da valutare nel rodaggio, sbagliate o esitate più di 3 volte: ${dure.slice(0, 8).map((d) => `${esc(d.numero)} ${esc(d.parola)}`).join(', ')}.</span></div>` : ''}
    ${solo ? '' : sceltaMazzi('scDecks', lista)}
    <div class="piede"><button class="azione" data-a="iniziaScrivi" ${pool.length ? '' : 'disabled'}>${pool.length ? 'Inizia' : 'Nessuna carta disponibile'}</button></div>`);
};
const SC = { t0: 0, t1: 0, rifai: false, fermo: false };
const voceScrivi = () => {
  const r = S.run, it = r.queue[r.i], c = it && S.cards[it], p = coppiaDaCarta(c);
  if (!p) return null;
  return { c, p, domanda: p.senso === 'np' ? p.numero : p.parola, giusta: p.senso === 'np' ? p.parola : p.numero };
};
function schermoScrivi() {
  const r = S.run;
  while (r.i < r.queue.length && !voceScrivi()) r.i++;
  if (r.i >= r.queue.length) return fineScrivi();
  // Il campo resta lo stesso per tutta la sessione: così su iPhone la tastiera non si chiude tra una carta e l'altra.
  mostra(`${testaSessione('', 'fermaScrivi', 0)}
    <article class="carta sc-carta"><div class="mazzo" id="sc-mazzo"></div><p class="sc-domanda" id="sc-domanda" aria-live="polite"></p><div class="sc-barra" id="sc-barra" ${r.conTempo ? '' : 'hidden'}><i></i></div></article>
    <label class="campo"><span class="sc-etichetta" id="sc-etichetta"></span><input id="sc-in" class="sc-in" type="text" ${r.senso === 'pn' ? 'inputmode="numeric"' : ''} autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="go"></label>
    <div id="sc-esito" class="sc-esito" role="status"></div>
    <div class="scorciatoie"><button class="azione tenue piccola" id="sc-nonso" data-a="scNonSo">Non lo so</button><button class="azione piccola" data-a="scControlla">Controlla</button></div>`);
  caricaScrivi();
  document.getElementById('sc-in').focus({ preventScroll: true });
}
function caricaScrivi() {
  const r = S.run, v = voceScrivi();
  if (!v) { r.i++; if (r.i >= r.queue.length) { vai('scrivi'); route(); return; } caricaScrivi(); return; }
  Object.assign(SC, { t0: performance.now(), t1: 0, rifai: false, fermo: false });
  app.querySelector('.titolo').textContent = `${r.i + 1} di ${r.queue.length}`;
  app.querySelector('.progresso i').style.width = `${(r.i / r.queue.length) * 100}%`;
  document.getElementById('sc-mazzo').textContent = deckName(v.c.deck);
  const d = document.getElementById('sc-domanda');
  d.textContent = v.domanda;
  d.classList.toggle('numero', v.p.senso === 'np');
  rimbalzo(d, 0.9);
  document.getElementById('sc-etichetta').textContent = v.p.senso === 'np' ? 'Scrivi la parola' : 'Scrivi il numero';
  document.getElementById('sc-esito').innerHTML = '';
  document.getElementById('sc-nonso').hidden = false;
  const i = document.getElementById('sc-in');
  i.value = ''; i.classList.remove('ok', 'no');
  const barra = document.querySelector('#sc-barra i');
  if (r.conTempo && barra) {
    barra.getAnimations().forEach((a) => a.cancel());
    barra.parentElement.classList.remove('finita');
    if (!fermo()) barra.animate([{ scale: '1 1' }, { scale: '0 1' }], { duration: LIMITE_MS, easing: 'linear', fill: 'forwards' }).onfinish = () => barra.parentElement.classList.add('finita');
  }
}
const prossimaScrivi = () => {
  const r = S.run;
  r.i++; salvaRun();
  if (r.i >= r.queue.length) { route(); return; }
  caricaScrivi();
};
async function esitoScrivi(ok, risposta) {
  const r = S.run, v = voceScrivi();
  if (!v || SC.fermo) return;
  const i = document.getElementById('sc-in'), box = document.getElementById('sc-esito');
  // Stai riscrivendo una risposta che hai appena visto: qui non si vota più, si ripete.
  if (SC.rifai) {
    if (!ok) { i.classList.remove('no'); void i.offsetWidth; i.classList.add('no'); vibra.tocco(); return; }
    SC.fermo = true; i.classList.remove('no'); i.classList.add('ok'); vibra.tocco();
    setTimeout(prossimaScrivi, 300);
    return;
  }
  const ms = Math.round((SC.t1 || performance.now()) - SC.t0);
  const primaVolta = !r.fatte[v.c.id];
  const lenta = ok && r.conTempo && ms > LIMITE_MS;
  r.fatte[v.c.id] = (r.fatte[v.c.id] || 0) + 1;
  SC.fermo = true;
  if (ok) vibra.ok(); else vibra.no();
  // Prima si salva la risposta, poi si va avanti.
  if (primaVolta) {
    const g = votoScrittura(ok, ms, r.conTempo);
    r.answers.push({ c: v.c.id, ok, ms, g });
    await registra(eventoVoto(v.c, g, 'scrivi', undefined, ms));
    syncPresto();
  }
  // Sbagliata o lenta: torna tra qualche carta, al massimo due volte.
  if ((!ok || lenta) && r.fatte[v.c.id] < 3) r.queue.splice(Math.min(r.i + 4, r.queue.length), 0, v.c.id);
  salvaRun();
  document.querySelector('#sc-barra i')?.getAnimations().forEach((a) => a.pause());
  if (ok) {
    i.classList.add('ok');
    box.innerHTML = `<span class="sc-bene">${ic.ok()}${lenta ? `Giusta, ma lenta: ${fmt(ms / 1000, 1)} s. Torna tra poco.` : 'Giusta'}</span>`;
    setTimeout(prossimaScrivi, lenta ? 900 : 320);
    return;
  }
  i.classList.add('no');
  const tuaRisp = risposta ? `<div class="meta">Hai scritto: ${esc(risposta)}</div>` : '';
  box.innerHTML = `<div class="perche"><div class="t sbagliato">Era: ${esc(v.giusta)}</div>${tuaRisp}${v.c.why ? `<p>${esc(v.c.why)}</p>` : ''}<p><b>Riscrivila per andare avanti.</b></p></div>`;
  document.getElementById('sc-nonso').hidden = true;
  i.value = ''; i.focus({ preventScroll: true });
  SC.rifai = true; SC.fermo = false;
}
document.addEventListener('input', (e) => {
  if (e.target.id !== 'sc-in' || !S.run || S.run.view !== 'scrivi') return;
  if (!SC.t1 && e.target.value) SC.t1 = performance.now();
  e.target.classList.remove('no');
  const v = voceScrivi();
  // Appena è giusta passa da sola, senza premere nulla.
  if (v && normalizza(e.target.value) === normalizza(v.giusta)) esitoScrivi(true);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'sc-in') { e.preventDefault(); AZ.scControlla(); }
});
function fineScrivi() {
  const r = S.run; r.finished = true;
  const n = r.answers.length, ok = r.answers.filter((a) => a.ok).length;
  if (n && !r.saved) {
    r.saved = true;
    registra({ id: A.nuovoId(), t: 's', kind: 'scrivi', decks: r.decks, at: new Date().toISOString(), dur: Math.round((Date.now() - r.started) / 1000), total: n, right: ok, wrong: n - ok, blank: 0, score: ok, max: n, senso: r.senso, conTempo: r.conTempo, answers: r.answers.map((a) => ({ c: a.c, ok: a.ok, ms: a.ms })) }).then(() => A.sincronizza());
  }
  salvaRun();
  const giuste = r.answers.filter((a) => a.ok);
  const media = giuste.length ? giuste.reduce((t, a) => t + a.ms, 0) / giuste.length / 1000 : 0;
  const etichetta = (a) => { const p = coppiaDaCarta(S.cards[a.c]); return p ? `${esc(p.numero)} · ${esc(p.parola)}` : esc(a.c); };
  const errate = r.answers.filter((a) => !a.ok);
  const lente = giuste.slice().sort((a, b) => b.ms - a.ms).slice(0, 5);
  const dure = paroleDifficili(A.eventi(), S.cards);
  mostra(`${testaSessione('Allenamento finito', 'chiudiRun')}
    <div class="tre"><div><b style="color:var(--ok)">${ok}</b><small>giuste</small></div><div><b style="color:var(--bad)">${n - ok}</b><small>da rifare</small></div><div><b>${giuste.length ? `${fmt(media, 1)} s` : '–'}</b><small>alla prima lettera</small></div></div>
    ${errate.length ? `<section class="card"><h2>Sbagliate</h2>${errate.map((a) => `<div class="errori-riga"><b>${etichetta(a)}</b></div>`).join('')}</section>` : ''}
    ${lente.length ? `<section class="card"><h2>Le più lente</h2>${lente.map((a) => `<div class="riga piccolo"><span>${etichetta(a)}</span><b class="num" style="color:var(--ink)">${fmt(a.ms / 1000, 1)} s</b></div>`).join('')}</section>` : ''}
    ${dure.length ? `<div class="avviso">${ic.att}<span>Da valutare nel rodaggio, sbagliate o esitate più di 3 volte: ${dure.slice(0, 8).map((d) => `${esc(d.numero)} ${esc(d.parola)}`).join(', ')}.</span></div>` : ''}
    <div class="piede"><button class="azione" data-a="chiudiRun">Torna a Oggi</button></div>`);
}

// ---------- RISULTATI ----------
function grafico(sims, p) {
  if (sims.length < 2) return `<p class="piccolo">${sims.length ? 'Serve una seconda simulazione per vedere l\'andamento.' : 'Nessuna simulazione ancora. La prima vale come punto di partenza, non come giudizio.'}</p>`;
  const ultime = sims.slice(0, 12).reverse(), offset = sims.length - ultime.length;
  const vals = ultime.map((s) => s.score);
  const min = Math.floor(Math.min(...vals, p.pass) - 1), max = Math.ceil(Math.max(...vals, p.pass) + 1);
  const W = 326, x0 = 34, x1 = 312, y0 = 108, y1 = 22;
  const X = (i) => x0 + (i * (x1 - x0)) / (ultime.length - 1), Y = (v) => y0 - ((v - min) * (y0 - y1)) / (max - min);
  const sel = Math.min(S.ui.punto ?? ultime.length - 1, ultime.length - 1);
  const griglia = [min, Math.round((min + max) / 2), max].map((v) => `<line x1="24" x2="${W}" y1="${Y(v)}" y2="${Y(v)}" stroke="#E6EAF2"/><text x="0" y="${Y(v) + 4}" font-size="12" font-weight="500" fill="#565D6B">${v}</text>`).join('');
  const passo = ultime.length > 7 ? Math.ceil(ultime.length / 6) : 1;
  const etic = ultime.map((_, i) => ((ultime.length - 1 - i) % passo === 0 ? `<text x="${X(i)}" y="128" font-size="12" font-weight="500" fill="#565D6B" text-anchor="middle">${offset + i + 1}ª</text>` : '')).join('');
  const punti = ultime.map((s, i) => `<g data-a="punto" data-v="${i}" style="cursor:pointer"><circle cx="${X(i)}" cy="${Y(s.score)}" r="20" fill="transparent"/><circle cx="${X(i)}" cy="${Y(s.score)}" r="${i === sel ? 6 : 5}" fill="#3E66D9" stroke="#fff" stroke-width="2"/></g>`).join('');
  const xs = X(sel), anc = xs > W - 40 ? 'end' : xs < 44 ? 'start' : 'middle';
  const ly = Y(ultime[sel].score) - 11;
  const etichettaSoglia = ultime.slice(0, 2).every((s) => Math.abs(Y(s.score) - Y(p.pass)) > 16);
  return `<svg role="img" aria-label="Punteggi delle simulazioni: ${vals.map((v) => fmt(v)).join('; ')}. Soglia di idoneità ${p.pass}." viewBox="0 0 ${W} 132" width="100%" style="display:block;font-family:Manrope,sans-serif">
    ${griglia}<line x1="24" x2="${W}" y1="${Y(p.pass)}" y2="${Y(p.pass)}" stroke="#8A5200" stroke-width="1.500" stroke-dasharray="4 4"/>
    ${etichettaSoglia ? `<text x="28" y="${Y(p.pass) - 6}" font-size="12" font-weight="700" fill="#8A5200">Idoneità ${p.pass % 1 ? fmt(p.pass) : p.pass}</text>` : ''}
    <polyline points="${ultime.map((s, i) => `${X(i)},${Y(s.score)}`).join(' ')}" fill="none" stroke="#3E66D9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    ${punti}<text x="${xs}" y="${ly}" text-anchor="${anc}" font-size="14" font-weight="800" fill="#15181E">${fmt(ultime[sel].score)}</text>${etic}</svg>`;
}
VISTE.risultati = () => {
  if (pal() === 'codice') return risultatiCodice();
  const sessioni = S.sessions.filter((s) => palSessione(s) === 'materie');
  const pk = S.ui.risPreset || 'ade', p = PRESETS[pk];
  const sims = S.sessions.filter((s) => s.kind === 'sim' && s.preset === pk);
  const perMazzo = {};
  sessioni.forEach((s) => (s.answers || []).forEach((a) => {
    const d = S.cards[a.c]?.deck;
    if (!d) return;
    perMazzo[d] ||= { t: 0, r: 0 }; perMazzo[d].t++; if (a.ok) perMazzo[d].r++;
  }));
  const righe = Object.entries(perMazzo).map(([d, v]) => ({ d, ...v, pct: v.r / v.t })).sort((a, b) => a.pct - b.pct).slice(0, 8);
  const colore = (x) => (x < 0.6 ? 'var(--bad-mark)' : x < 0.8 ? 'var(--warn-mark)' : 'var(--ok)');
  const fregano = tutte().map((c) => ({ c, s: S.progress[c.id] })).filter((x) => x.s?.lapses > 0).sort((a, b) => b.s.lapses - a.s.lapses || a.s.box - b.s.box).slice(0, 15);
  const nomi = { flash: 'Ripasso', quiz: 'Quiz', sim: 'Simulazione', scrivi: 'Scrivi a memoria' };
  const quando = (at) => new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'short', timeStyle: 'short' }).format(new Date(at));
  mostra(`${selettorePalestra()}<h1>Risultati</h1>
    <div class="segmenti" role="group" aria-label="Concorso">${pulsanteSegmento('risPreset', 'ade', pk === 'ade', 'Agenzia Entrate')}${pulsanteSegmento('risPreset', 'asmel', pk === 'asmel', 'ASMEL')}</div>
    <section class="card" style="gap:6px"><div class="riga"><h2>Andamento simulazioni</h2><span class="meta num">${sims.length ? `ultime ${Math.min(sims.length, 12)}, su ${p.max}` : ''}</span></div>${grafico(sims, p)}</section>
    <section class="card"><h2>Dove sbagli di più</h2>${righe.length ? righe.map((x) => barra(deckName(x.d), `<b style="color:var(--ink)">${Math.round(x.pct * 100)}%</b>`, x.pct * 100, colore(x.pct))).join('') : '<p class="piccolo">Ancora nessuna risposta registrata.</p>'}</section>
    <section class="card"><h2>Le carte che ti fregano</h2>
      ${fregano.length ? fregano.map(({ c, s }) => `<div class="tra"><div style="min-width:0"><div style="font-size:14px;line-height:19px;font-weight:600;overflow-wrap:anywhere">${esc(c.front)}</div><div class="meta">${esc(c.kind === 'quiz' ? c.options?.[c.answer] : c.back)}${c.ref ? ` · ${esc(c.ref)}` : ''}</div></div><span class="pill bad" style="flex:none">${plur(s.lapses, 'errore', 'errori')}</span></div>`).join('') + '<button class="azione tenue piccola" data-a="copiaFregano">Copia queste carte per Claude</button>' : '<p class="piccolo">Nessun errore registrato.</p>'}
    </section>
    <section class="card" style="gap:0"><h2 style="padding-bottom:6px">Tutte le sessioni</h2>${sessioni.length ? `<div class="tabella">${sessioni.slice(0, 40).map((s) => `<div><span>${esc(nomi[s.kind] || s.kind)}${s.kind === 'sim' ? ` ${esc(PRESETS[s.preset]?.label || '')}` : ''}<br><span class="meta">${quando(s.at)} · ${mmss(s.dur || 0)}</span></span><span></span><span>${s.kind === 'sim' ? `${fmt(s.score)}/${s.max}` : `${s.right}/${s.total}`}</span></div>`).join('')}</div>` : '<p class="piccolo">Nessuna sessione.</p>'}</section>`);
};

const tabellaSessioni = (sessioni) => {
  const nomi = { flash: 'Ripasso', quiz: 'Quiz', sim: 'Simulazione', scrivi: 'Scrivi a memoria' };
  const quando = (at) => new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'short', timeStyle: 'short' }).format(new Date(at));
  return `<section class="card" style="gap:0"><h2 style="padding-bottom:6px">Tutte le sessioni</h2>${sessioni.length ? `<div class="tabella">${sessioni.slice(0, 40).map((s) => `<div><span>${esc(nomi[s.kind] || s.kind)}<br><span class="meta">${quando(s.at)} · ${mmss(s.dur || 0)}</span></span><span></span><span>${s.right}/${s.total}</span></div>`).join('')}</div>` : '<p class="piccolo">Nessuna sessione.</p>'}</section>`;
};
// Risultati nella palestra del codice: velocità, i due sensi, le parole più lente.
function risultatiCodice() {
  const d = oggi(), st = statCodice(A.eventi(), S.cards, d);
  const sett = A.eventi().filter((e) => e.t === 'v' && palMazzo(e.d) === 'codice' && daysBetween(romeDate(e.at), d) < 7);
  const giuste = sett.filter((e) => e.g > 0).length;
  const tetto = 4000, alt = (ms) => (ms == null ? 0 : Math.max(4, Math.min(100, (ms / tetto) * 100)));
  const giorniBrevi = new Intl.DateTimeFormat('it-IT', { timeZone: 'UTC', weekday: 'short' });
  const barreSenso = [['Numero → parola', st.perSenso.np], ['Parola → numero', st.perSenso.pn]];
  mostra(`${selettorePalestra()}<h1>Risultati del codice</h1>
    <div class="tre">
      <div><b class="num">${sec(st.medioMs)}</b><small>tempo tipico</small></div>
      <div><b class="num">${st.fissate}/${st.parole}</b><small>parole fissate</small></div>
      <div><b class="num">${sett.length ? `${Math.round((giuste / sett.length) * 100)}%` : '–'}</b><small>giuste in 7 giorni</small></div>
    </div>
    <section class="card"><div class="riga"><h2>Tempo tipico, ultimi 7 giorni</h2><span class="meta">linea a 2 s</span></div>
      <div class="tempi" role="img" aria-label="Tempo medio per giorno in Scrivi a memoria">${st.perGiorno.map((g) => `<span class="${g.ms != null && g.ms <= LIMITE_MS ? 'ok' : ''}" style="height:${alt(g.ms)}%"></span>`).join('')}<i style="bottom:${(LIMITE_MS / tetto) * 100}%"></i></div>
      <div class="tempi-giorni">${st.perGiorno.map((g) => `<span>${giorniBrevi.format(dataUtc(g.giorno)).replace('.', '')}</span>`).join('')}</div>
      <p class="meta">Conta solo Scrivi a memoria, risposte giuste: il tempo fino alla prima lettera. È il valore di mezzo, così una pausa lunga non falsa il conto.</p>
    </section>
    <section class="card"><h2>Nei due sensi</h2>${barreSenso.map(([n, ms]) => barra(n, sec(ms), alt(ms))).join('')}</section>
    <section class="card"><div class="riga"><h2>Le più lente</h2><span class="meta">ultimi 14 giorni</span></div>
      ${st.lente.length ? st.lente.map((x) => `<div class="lenta"><b class="num">${esc(x.numero)}</b><span>${esc(x.parola)}</span><em class="num">${sec(x.ms)}</em></div>`).join('') + '<button class="azione tenue piccola" data-a="scriviLente">Allenale adesso</button>' : '<p class="piccolo">Nessuna parola sopra i 2 secondi.</p>'}
    </section>
    ${tabellaSessioni(S.sessions.filter((s) => palSessione(s) === 'codice'))}`);
}

// ---------- ROTTA ----------
const dataUtc = (ymd) => new Date(`${ymd}T12:00:00Z`);
const domenica = (ymd) => dataUtc(ymd).getUTCDay() === 0;
const fmtGiorno = new Intl.DateTimeFormat('it-IT', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
const fmtCorto = new Intl.DateTimeFormat('it-IT', { timeZone: 'UTC', day: 'numeric', month: 'short' });
const fmtMese = new Intl.DateTimeFormat('it-IT', { timeZone: 'UTC', month: 'long', year: 'numeric' });
const fmtMeseBreve = new Intl.DateTimeFormat('it-IT', { timeZone: 'UTC', month: 'short' });
const maiusc = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const giornoLungo = (ymd) => maiusc(fmtGiorno.format(dataUtc(ymd)));
const pagine = (l) => (l.da != null ? `pp. ${l.da}-${l.a}` : 'senza pagine');
function cartaSettimana(r, titolo) {
  const sim = r.ultimaSim;
  return `<section class="card settimana"><div class="riga"><h2>${titolo}</h2><span class="meta">${fmtCorto.format(dataUtc(r.da))} – ${fmtCorto.format(dataUtc(r.a))}</span></div>
    <div class="tre quattro"><div><b class="num">${r.attivi}/7</b><small>giorni attivi</small></div><div><b class="num">${r.lezioni}</b><small>${r.lezioni === 1 ? 'lezione' : 'lezioni'}</small></div><div><b class="num">${r.carte}</b><small>carte ripassate</small></div><div><b class="num">${sim ? fmt(sim.score) : '–'}</b><small>${sim ? `ultima simulazione, ${fmtCorto.format(dataUtc(romeDate(sim.at)))}` : 'nessuna simulazione'}</small></div></div></section>`;
}
function griglia(c, d) {
  const sel = S.ui.giornoSel && c.giorni.some((g) => g.giorno === S.ui.giornoSel && !g.futuro) ? S.ui.giornoSel : d;
  const settimane = [];
  for (let i = 0; i < c.giorni.length; i += 7) settimane.push(c.giorni.slice(i, i + 7));
  // Il nome del mese sopra la settimana in cui il mese comincia.
  const inizia = (w) => w.find((g) => g.giorno.endsWith('-01'));
  // La prima colonna prende il nome del suo mese solo se il mese dopo non comincia subito accanto.
  const mesi = settimane.map((w, i) => { const p = inizia(w) || (i === 0 && !settimane.slice(1, 3).some(inizia) ? w[0] : null); return `<span>${p ? fmtMeseBreve.format(dataUtc(p.giorno)).replace('.', '') : ''}</span>`; }).join('');
  const celle = c.giorni.map((g) => `<span class="cella l${g.livello}${!g.livello && g.codice && !g.futuro ? ' cod' : ''}${g.futuro ? ' futuro' : ''}${g.giorno === d ? ' oggi' : ''}${g.giorno === sel ? ' scelta' : ''}" ${g.futuro ? '' : `data-a="giorno" data-v="${g.giorno}"`}></span>`).join('');
  const attivi = c.giorni.filter((g) => g.livello).length;
  const g = c.giorni.find((x) => x.giorno === sel);
  const parti = [g.sessioni && plur(g.sessioni, 'sessione', 'sessioni'), g.risposte && plur(g.risposte, 'risposta', 'risposte'), g.lezioni && plur(g.lezioni, 'lezione', 'lezioni'), g.codice && `${g.codice} di codice`].filter(Boolean);
  const stato = g.livello === 2 ? 'giorno pieno' : g.livello === 1 ? 'giorno minimo' : g.codice ? 'solo codice, non conta per la catena' : g.giorno === d ? 'ancora niente' : 'nessuna attività';
  return `<div class="catena-mesi" aria-hidden="true"><span></span>${mesi}</div>
    <div class="catena" role="img" aria-label="Ultime ${SETTIMANE_CATENA} settimane: ${attivi} giorni attivi"><span>L</span><span></span><span>M</span><span></span><span>V</span><span></span><span>D</span>${celle}</div>
    <div class="legenda" aria-hidden="true"><span><i class="cella l0"></i>niente</span><span><i class="cella l0 cod"></i>solo codice, non conta</span><span><i class="cella l1"></i>giorno minimo</span><span><i class="cella l2"></i>con lezione</span></div>
    <p class="piccolo giorno-scelto"><b>${giornoLungo(sel)}</b>: ${stato}${parti.length ? ` · ${parti.join(', ')}` : ''}</p>`;
}
function cartaScadenza(s, d) {
  const q = quantoManca(s.data, d), mod = S.ui.scadMod === s.chiave;
  const quando = !s.data ? s.nota : s.data.length === 7 ? `${maiusc(fmtMese.format(dataUtc(`${s.data}-01`)))}${s.nota ? ` · ${s.nota.toLowerCase()}` : ''}` : `${giornoLungo(s.data)} ${s.data.slice(0, 4)}`;
  const conto = !q ? '–' : q.giorni < 0 ? 'passata' : q.giorni === 0 ? 'oggi' : `${q.almeno ? 'almeno ' : ''}${plur(q.giorni, 'giorno', 'giorni')}`;
  return `<div class="scadenza"><div class="tra"><div style="min-width:0"><div class="scad-nome">${esc(s.nome)}</div><div class="meta">${esc(quando)}</div></div><div class="scad-giorni num">${conto}</div></div>
    ${mod ? `<div class="scad-mod"><label class="campo">Data della prova<input id="sc-data-${esc(s.chiave)}" type="date" value="${s.data && s.data.length === 10 ? s.data : ''}" min="${d}"></label>
      <div class="scorciatoie"><button class="azione piccola" data-a="salvaScadenza" data-v="${esc(s.chiave)}">Salva</button><button class="azione tenue piccola" data-a="togliScadenza" data-v="${esc(s.chiave)}">Togli la data</button></div></div>`
    : `<button class="link-piccolo" data-a="modScadenza" data-v="${esc(s.chiave)}">${s.data ? 'Cambia la data' : 'Imposta la data'}</button>`}</div>`;
}
VISTE.rotta = () => {
  const d = oggi(), ev = A.eventi(), o = opzRotta(), c = catena(ev, d, SETTIMANE_CATENA, o), lista = lezioni(ev), man = avanzamentoManuale(lista), r = riepilogoSettimana(ev, d, o);
  const due = regolaDueGiorni(ev, d, o), form = S.ui.formLezione;
  const pct = (a, b) => (b ? (a / b) * 100 : 0);
  mostra(`<h1>Rotta</h1><p class="sotto">Conta solo lo studio delle materie</p>
    ${bannerSync()}
    ${due === 'minimo' ? `<a class="minimo" href="#ripasso" data-a="giornoMinimo"><span><b>Oggi basta il giorno minimo: 10 minuti di ripasso</b><span>Ieri niente. Mai due giorni di fila.</span></span>${ic.dx('#2F4FAE')}</a>` : ''}
    ${due === 'salva' ? `<div class="avviso ok">${ic.ok(16)}<span>Catena salva: ieri niente, ma oggi il giorno minimo è fatto.</span></div>` : ''}
    <div class="tre"><div><b class="num">${c.serie}</b><small>serie attuale</small></div><div><b class="num">${c.record}</b><small>record</small></div><div><b class="num">${r.attivi}/7</b><small>questa settimana</small></div></div>
    <section class="card"><div class="riga"><h2>Catena dei giorni</h2><span class="meta">${SETTIMANE_CATENA} settimane</span></div>${griglia(c, d)}
      <p class="meta">Un giorno conta se chiudi una sessione di Materie o dai ${RISPOSTE_GIORNO_MINIMO} risposte di Materie. Con una lezione segnata diventa pieno. Il codice fonetico si allena a parte.</p></section>
    ${form ? `<section class="card lezione-form"><h2>Lezione fatta</h2>
      <label class="campo">Argomento<input id="lz-arg" type="text" maxlength="200" autocomplete="off" placeholder="Es. L. 241/1990, responsabile del procedimento" value="${esc(form.arg || '')}"></label>
      <label class="campo">Giorno<input id="lz-giorno" type="date" max="${d}" value="${esc(form.giorno || d)}"></label>
      <div class="due-campi"><label class="campo">Pagine da<input id="lz-da" type="number" inputmode="numeric" min="1" max="306" placeholder="1" value="${esc(form.da ?? '')}"></label><label class="campo">a<input id="lz-a" type="number" inputmode="numeric" min="1" max="306" placeholder="306" value="${esc(form.a ?? '')}"></label></div>
      <p class="meta">Le pagine sono quelle del manuale EdiSES. Se la lezione non segue il manuale lasciale vuote.</p>
      <div class="scorciatoie"><button class="azione piccola" data-a="salvaLezione">Salva la lezione</button><button class="azione tenue piccola" data-a="chiudiLezione">Annulla</button></div></section>`
    : '<button class="azione" data-a="apriLezione">Lezione fatta</button>'}
    <section class="card"><div class="riga"><h2>Manuale EdiSES</h2><span class="meta num">${man.lette} di ${man.tot} pagine</span></div>
      <div class="barra grossa"><i style="width:${pct(man.lette, man.tot)}%"></i></div>
      ${man.libri.map((b) => barra(`Libro ${b.n} · ${b.nome}`, `${b.lette}/${b.tot}`, pct(b.lette, b.tot))).join('')}
      <p class="meta">Calcolato dalle pagine delle lezioni. Una pagina fatta due volte conta una volta.</p></section>
    <section class="card"><h2>Conti alla rovescia</h2>${scadenze(ev).map((s) => cartaScadenza(s, d)).join('')}</section>
    ${cartaSettimana(r, 'Questa settimana')}
    <section class="card"><div class="riga"><h2>Lezioni segnate</h2><span class="meta num">${lista.length}</span></div>
      ${lista.length ? lista.slice(0, S.ui.tutteLezioni ? 500 : 6).map((l) => `<div class="lez"><div style="min-width:0"><div class="lez-arg">${esc(l.arg)}</div><div class="meta">${giornoLungo(l.giorno)} · ${pagine(l)}${l.fonte === 'chat' ? ' · da una chat' : ''}</div></div>
        <button class="${S.ui.confLez === l.id ? 'azione pericolo piccola' : 'tondo piccolo'}" data-a="togliLezione" data-v="${esc(l.id)}" aria-label="Togli la lezione ${esc(l.arg)}">${S.ui.confLez === l.id ? 'Togli' : ic.x}</button></div>`).join('')
        + (lista.length > 6 && !S.ui.tutteLezioni ? '<button class="link-piccolo" data-a="tutteLezioni">Mostra tutte</button>' : '')
        : '<p class="piccolo">Ancora nessuna lezione. Segnala qui sopra o incollala da una chat.</p>'}
    </section>
    <section class="card elenco"><button class="voce" data-a="apri" data-v="incolla" aria-expanded="${S.ui.aperto === 'incolla'}">Incolla lezioni da una chat${ic.dx()}</button>
      ${S.ui.aperto === 'incolla' ? `<div class="aperto"><label class="campo">Il blocco che ti dà la chat a FINE SESSIONE<textarea id="lz-json" spellcheck="false" placeholder='{"lezioni":[{"giorno":"${d}","argomento":"…","da":12,"a":20}]}'></textarea></label><button class="azione piccola" data-a="incollaLezioni">Aggiungi</button><span class="meta" id="lz-esito"></span></div>` : ''}
    </section>`);
};
function jsonDaTesto(t) {
  const testo = String(t || '').trim();
  try { return JSON.parse(testo); } catch { /* può arrivare dentro un blocco di codice della chat */ }
  const i = testo.search(/[[{]/), j = Math.max(testo.lastIndexOf('}'), testo.lastIndexOf(']'));
  if (i < 0 || j < i) throw new Error('JSON non valido: controlla virgole e parentesi.');
  try { return JSON.parse(testo.slice(i, j + 1)); } catch { throw new Error('JSON non valido: controlla virgole e parentesi.'); }
}
// Aggiunge le lezioni arrivate da una chat. Lo stesso blocco incollato due volte non si duplica.
async function aggiungiLezioniChat(data) {
  const r = lezioniDaJson(data, oggi(), new Date().toISOString());
  const noti = new Set(A.eventi().map((e) => e.id));
  const nuove = r.eventi.filter((e) => !noti.has(e.id));
  if (nuove.length) { await registra(nuove); A.sincronizza(); }
  return { ...r, nuove: nuove.length, gia: r.eventi.length - nuove.length };
}
const testoLezioni = (r) => [r.nuove && `${plur(r.nuove, 'lezione aggiunta', 'lezioni aggiunte')}`, r.gia && `${plur(r.gia, 'era già segnata', 'erano già segnate')}`, r.errori.length && `scartate: ${r.errori.join(' · ')}`].filter(Boolean).join('. ');

// ---------- GESTIONE ----------
function chipStato() {
  const st = A.stato, att = A.pending.length;
  if (!A.collegato()) return '<span class="pill neutra">Non collegato</span>';
  if (st.fase === 'in-corso') return '<span class="pill neutra">Sincronizzo…</span>';
  if (st.fase === 'offline') return `<span class="pill warn">Senza rete${att ? ` · ${att} in attesa` : ''}</span>`;
  if (st.fase === 'errore') return `<span class="pill bad">${ic.no}Errore</span>`;
  if (att) return `<span class="pill warn">${att} in attesa</span>`;
  return `<span class="pill ok">${ic.ok(13)}Aggiornato</span>`;
}
function fa(iso) {
  if (!iso) return 'mai';
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return 'adesso';
  if (m < 60) return plur(m, 'minuto', 'minuti') + ' fa';
  return new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
}
VISTE.gestione = () => {
  const ap = S.ui.aperto, opzioniMazzi = deckListTutti().map((d) => `<option value="${esc(d.id)}">${esc(d.name)}</option>`).join('');
  const blocco = (id, titolo, rosso, corpo) => `<button class="voce ${rosso ? 'rosso' : ''}" data-a="apri" data-v="${id}" aria-expanded="${ap === id}">${titolo}${ic.dx(rosso ? '#A8401F' : '#565D6B')}</button>${ap === id ? `<div class="aperto">${corpo}</div>` : ''}`;
  mostra(`<h1>Gestione</h1>
    <section class="card" style="gap:12px;padding:16px">
      <div class="riga" style="align-items:center"><h2 style="font-size:16px;line-height:21px">Sincronizzazione</h2>${chipStato()}</div>
      ${A.stato.fase === 'errore' ? `<div class="avviso errore">${ic.att}<span>${esc(A.stato.errore)}</span></div>` : ''}
      <div class="piccolo" style="display:flex;flex-direction:column;gap:4px">
        <div class="riga"><span>Ultimo salvataggio</span><b style="color:var(--ink)">${fa(A.stato.quando)}</b></div>
        <div class="riga"><span>In attesa di invio</span><b style="color:var(--ink)" class="num">${plur(A.pending.length, 'risposta', 'risposte')}</b></div>
        <div class="riga"><span>Carte nel repository</span><b style="color:var(--ink)" class="num">${tutteTutte().length}</b></div>
        <div class="riga"><span>Questo dispositivo</span><b style="color:var(--ink)">${esc(A.device || '')}</b></div>
      </div>
      <label class="campo">Repository privato<input id="g-repo" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(A.cfg?.repo || REPO_DEFAULT)}"></label>
      <label class="campo">Token personale<input id="g-token" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="github_pat_…" value="${A.cfg?.token ? '••••••••••••••••' : ''}"></label>
      <button class="azione" style="min-height:48px;font-size:15px" data-a="salvaSync">${A.collegato() ? 'Sincronizza ora' : 'Collega e sincronizza'}</button>
    </section>
    <section class="card elenco">
      <button class="voce" role="switch" aria-checked="${S.prefs.vibra !== false}" data-a="vibrazioni">Vibrazioni<span class="interruttore" aria-hidden="true"><i></i></span></button>
      ${blocco('import', 'Importa carte da JSON', false, `<label class="campo">Incolla il JSON<textarea id="g-json" spellcheck="false" placeholder='{"decks":[...],"cards":[...]}'></textarea></label><button class="azione piccola" data-a="importa">Importa</button><span class="meta" id="g-esito"></span><p class="meta">Le carte con lo stesso id vengono sovrascritte: così si correggono. Serve la connessione. Se il blocco contiene anche "lezioni", finiscono in Rotta.</p>`)}
      ${blocco('export', 'Esporta il backup', false, `<p class="meta">Mazzi, carte, progressi e sessioni in un file JSON.</p><div class="scorciatoie"><button class="azione tenue piccola" data-a="esporta">Salva il file</button><button class="azione tenue piccola" data-a="esportaCopia">Copia</button></div>`)}
      ${blocco('azzera', 'Azzera i progressi di un mazzo', true, `<p class="meta">Le carte restano, tornano nuove. Le sessioni passate restano.</p><select id="g-azz" class="selezione">${opzioniMazzi}</select><button class="azione pericolo piccola" data-a="azzera">${S.ui.confAzz ? `Sì, azzera ${esc(deckName(S.ui.confAzz))}` : 'Azzera'}</button>`)}
      ${blocco('elimina', 'Elimina un mazzo', true, `<p class="meta">Cancella il mazzo e le sue carte dal repository. Fai prima un backup.</p><select id="g-del" class="selezione">${opzioniMazzi}</select><button class="azione pericolo piccola" data-a="elimina">${S.ui.confDel ? `Sì, elimina ${esc(deckName(S.ui.confDel))}` : 'Elimina'}</button>`)}
    </section>
    ${A.collegato() ? '<button class="link-basso" data-a="scollega">Scollega questo dispositivo</button>' : ''}
    <p class="meta" style="text-align:center">Palestra Quiz ${VERSIONE}</p>`);
};
function datiEsportati() {
  const { progress, sessions } = ricostruisci(A.eventi());
  return { exportedAt: new Date().toISOString(), decks: Object.values(S.decks), cards: tutteTutte(), progress, sessions, events: A.eventi() };
}
async function importaDati(data) {
  // Ripristino di un backup: progressi e sessioni diventano eventi del registro.
  const eventi = [];
  if (Array.isArray(data.events)) eventi.push(...data.events);
  else {
    const at = data.exportedAt || new Date().toISOString();
    for (const [c, p] of Object.entries(data.progress || {})) eventi.push({ id: A.nuovoId(), t: 'p', at, c, d: p.deck || p.d, box: p.box, due: p.due, reps: p.reps, lapses: p.lapses, last: p.last });
    for (const s of data.sessions || []) { const { id: _ignora, ...resto } = s; eventi.push({ ...resto, id: A.nuovoId(), t: 's' }); }
  }
  const noti = new Set(A.eventi().map((e) => e.id));
  const nuoviEventi = eventi.filter((e) => e.id && !noti.has(e.id));
  // Carte: un file per mazzo.
  const { decks, cards, errori } = validaCarte(data, Object.keys(S.decks));
  if (errori.length) return `Non importato. ${errori.slice(0, 5).join(' · ')}${errori.length > 5 ? ` (+${errori.length - 5})` : ''}`;
  const lz = data && !Array.isArray(data) && (data.lezioni || data.lezione) ? await aggiungiLezioniChat(data) : null;
  if (lz && !decks.length && !cards.length && !nuoviEventi.length) return testoLezioni(lz) || 'Nessuna lezione trovata.';
  const ids = new Set([...decks.map((d) => d.id), ...cards.map((c) => c.deck)]);
  for (const id of ids) {
    const deck = decks.find((d) => d.id === id) || S.decks[id];
    const base = new Map(tutteTutte().filter((c) => c.deck === id).map((c) => [c.id, c]));
    for (const c of cards) if (c.deck === id) base.set(c.id, { ...c, created: base.get(c.id)?.created || c.created || new Date().toISOString() });
    await A.scriviMazzo({ id: deck.id, name: deck.name, materia: deck.materia || 'Altro', desc: deck.desc || '', order: deck.order ?? 999 }, [...base.values()]);
  }
  if (nuoviEventi.length) await A.aggiungi(nuoviEventi);
  ricalcola();
  A.sincronizza();
  return `Importati ${plur(decks.length, 'mazzo', 'mazzi')} e ${plur(cards.length, 'carta', 'carte')}${nuoviEventi.length ? `, più ${nuoviEventi.length} eventi di progresso` : ''}.${lz ? ` ${testoLezioni(lz)}.` : ''}`;
}

// ---------- azioni ----------
const AZ = {
  home() { S.ui.flModo = null; vai('oggi'); },
  tileQuiz(el) { S.ui.qzModo = el.dataset.v; },
  filtroMazzi(el) { S.ui.filtroMazzi = el.dataset.v || null; route(); },
  mazzoRipassa(el) { S.prefs.flDecks = [el.dataset.v]; S.ui.flModo = null; salvaPrefs(); vai('ripasso'); },
  mazzoQuiz(el) { S.prefs.qzDecks = [el.dataset.v]; salvaPrefs(); vai('quiz'); },
  mazzoScrivi(el) { S.prefs.scDecks = [el.dataset.v]; salvaPrefs(); vai('scrivi'); },
  scSenso(el) { S.prefs.scSenso = el.dataset.v; salvaPrefs(); route(); },
  scTempo() { S.prefs.scTempo = !S.prefs.scTempo; salvaPrefs(); route(); },
  iniziaScrivi() {
    const senso = S.prefs.scSenso || 'np', lista = mazziScrittura(), sel = (S.prefs.scDecks || []).filter((id) => lista.some((d) => d.id === id));
    const solo = S.ui.scSolo;
    const scelte = solo ? shuffle(tutteTutte().filter((c) => solo.includes(c.id))) : scegliScrittura(carteScrittura(sel.length ? sel : lista.map((d) => d.id)), senso, S.progress, oggi(), S.prefs.scN || 20);
    if (!scelte.length) { toast('Nessuna carta per questa scelta'); return; }
    S.ui.scSolo = null;
    S.run = { view: 'scrivi', kind: 'scrivi', senso: solo ? 'misto' : senso, conTempo: !!S.prefs.scTempo, queue: scelte.map((c) => c.id), i: 0, answers: [], fatte: {}, started: Date.now(), decks: sel, finished: false };
    salvaRun(); route();
  },
  scControlla() {
    const i = document.getElementById('sc-in'), v = voceScrivi();
    if (!i || !v || !i.value.trim()) { i?.focus({ preventScroll: true }); return; }
    esitoScrivi(normalizza(i.value) === normalizza(v.giusta), i.value);
    i.focus({ preventScroll: true });
  },
  scNonSo() { esitoScrivi(false); },
  fermaScrivi() { const r = S.run; r.queue = r.queue.slice(0, r.i); r.i = r.queue.length; fineScrivi(); },
  tuttiMazzi(el) { S.prefs[el.dataset.v] = []; salvaPrefs(); route(); },
  toggleMazzo(el) {
    const k = el.dataset.k, id = el.dataset.v, cur = S.prefs[k] || [];
    S.prefs[k] = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    salvaPrefs(); route();
  },
  passo(el) {
    const k = el.dataset.k, def = { flN: 30, qzN: 15, scN: 20 }[k] || 15;
    S.prefs[k] = Math.max(5, Math.min(100, (S.prefs[k] || def) + Number(el.dataset.v)));
    salvaPrefs(); route();
  },
  flModo(el) { S.ui.flModo = el.dataset.v; route(); },
  qzModo(el) { S.ui.qzModo = el.dataset.v; route(); },
  iniziaFlash(el) {
    const modo = el.dataset.v, sel = selPal('flDecks'), d = oggi();
    let pool = carteDi(sel.length ? sel : null);
    if (modo === 'due') pool = pool.filter((c) => inScadenza(c, S.progress, d));
    if (modo === 'new') pool = pool.filter((c) => maiVista(c, S.progress));
    if (!pool.length) { toast('Nessuna carta per questa scelta'); return; }
    S.run = { view: 'ripasso', kind: 'flash', queue: shuffle(pool).slice(0, S.prefs.flN || 30).map((c) => c.id), i: 0, shown: false, pick: null, answers: [], started: Date.now(), decks: sel, finished: false };
    salvaRun(); route();
  },
  async mostraRisposta() {
    S.run.shown = true; salvaRun();
    await uscita('.carta', 'gira-via', 130, app);
    S.fx = 'gira-entra'; route();
  },
  flPick(el) {
    const r = S.run, c = S.cards[r.queue[r.i]];
    r.pick = Number(el.dataset.v); r.shown = true; salvaRun();
    if (r.pick === c?.answer) vibra.ok(); else vibra.no();
    S.fx = 'rivela'; route();
  },
  async vota(el) {
    const r = S.run, g = Number(el.dataset.v), c = S.cards[r.queue[r.i]];
    if (r.occupato) return; // un doppio tocco non deve contare due volte
    r.occupato = true;
    if (g === 2) vibra.ok(); else if (g === 0) vibra.no(); else vibra.tocco();
    // Prima si salva la risposta, poi parte l'animazione.
    await registra(eventoVoto(c, g, 'flash'));
    r.answers.push({ c: c.id, g, ok: g > 0, pick: r.pick });
    r.i++; r.shown = false; r.pick = null;
    salvaRun(); syncPresto();
    await uscita('.carta', g === 0 ? 'via-s' : g === 2 ? 'via-d' : 'via-su', 190, app);
    r.occupato = false;
    S.fx = 'carta-entra'; window.scrollTo(0, 0); route();
  },
  fermaFlash() { S.run.queue = S.run.queue.slice(0, S.run.i); fineFlash(); },
  chiudiRun() { S.run = null; salvaRun(); clearInterval(S.tick); vai('oggi'); },
  iniziaQuiz() {
    const sel = selPal('qzDecks'), modo = S.ui.qzModo || 'weak';
    const pool = carteDi(sel.length ? sel : null).filter((c) => c.kind === 'quiz');
    S.run = { view: 'quiz', kind: 'quiz', queue: ordinaQuiz(pool, S.progress, oggi(), modo).slice(0, S.prefs.qzN || 15).map((c) => c.id), i: 0, pick: null, answers: [], started: Date.now(), decks: sel, finished: false };
    salvaRun(); route();
  },
  async qzPick(el) {
    const r = S.run;
    if (r.pick !== null) return;
    const c = S.cards[r.queue[r.i]], pick = Number(el.dataset.v), ok = pick === c.answer;
    r.pick = pick; r.answers.push({ c: c.id, pick, ok });
    if (ok) vibra.ok(); else vibra.no();
    await registra(eventoVoto(c, ok ? 2 : 0, 'quiz'));
    salvaRun(); syncPresto(); S.fx = 'rivela'; route();
  },
  qzAvanti() { const r = S.run; r.i++; r.pick = null; salvaRun(); S.fx = 'q-d'; window.scrollTo(0, 0); route(); },
  fermaQuiz() { const r = S.run; r.queue = r.queue.slice(0, r.i + (r.pick !== null ? 1 : 0)); r.i = r.queue.length; fineQuiz(); },
  copiaErroriRun() {
    const r = S.run, errate = r.answers.filter((a) => !a.ok).map((a) => S.cards[a.c]).filter(Boolean);
    copia(testoErrori(errate, r.answers), 'Copiato: incollalo nella chat di correzione');
  },
  simPreset(el) { S.prefs.simPreset = el.dataset.v; salvaPrefs(); route(); },
  simTutte() { const k = S.prefs.simPreset || 'ade'; (S.prefs.simGruppi ||= {})[k] = []; salvaPrefs(); route(); },
  simGruppo(el) {
    const k = S.prefs.simPreset || 'ade', cur = (S.prefs.simGruppi ||= {})[k] || [], id = el.dataset.v;
    const nuovo = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    S.prefs.simGruppi[k] = nuovo.length === PRESETS[k].gruppi.length ? [] : nuovo;
    salvaPrefs(); route();
  },
  avviaSim() {
    const k = S.prefs.simPreset || 'ade', p = PRESETS[k], sel = (S.prefs.simGruppi || {})[k] || [];
    const prep = preparaSimulazione(k, tutteTutte(), deckMateria(), sel.length ? sel : null);
    if (!prep.queue.length) { toast('Nessuna domanda per questa scelta'); return; }
    const now = Date.now();
    S.run = { view: 'simulazione', kind: 'sim', preset: k, p, queue: prep.queue, i: 0, picks: {}, flags: {}, started: now, ends: now + p.min * 60000, avvisi: prep.avvisi, incompleta: prep.incompleta, finished: false, sheet: false };
    salvaRun(); avviaTick(); route();
  },
  simPick(el) {
    const r = S.run, id = r.queue[r.i];
    r.picks[id] = Number(el.dataset.v);
    salvaRun(); route();
    if (r.i < r.queue.length - 1) setTimeout(() => { if (S.run === r && r.queue[r.i] === id) { r.i++; salvaRun(); S.fx = 'q-d'; window.scrollTo(0, 0); route(); } }, 220);
  },
  simPrec() { S.run.i = Math.max(0, S.run.i - 1); salvaRun(); S.fx = 'q-s'; window.scrollTo(0, 0); route(); },
  simSucc() {
    const r = S.run;
    if (r.i >= r.queue.length - 1) { r.sheet = true; S.fx = 'foglio'; route(); return; }
    r.i++; salvaRun(); S.fx = 'q-d'; window.scrollTo(0, 0); route();
  },
  simBianco() { const r = S.run; delete r.picks[r.queue[r.i]]; AZ.simSucc(); },
  segna() { const r = S.run, id = r.queue[r.i]; r.flags[id] = !r.flags[id]; salvaRun(); route(); },
  apriGriglia() { S.run.sheet = true; S.run.conferma = false; S.run.confermaAbb = false; S.fx = 'foglio'; route(); },
  async chiudiGriglia() {
    await uscita('.foglio', 'via', 190, app);
    S.run.sheet = false; S.run.conferma = false; S.run.confermaAbb = false; route();
  },
  async simVai(el) {
    const r = S.run, i = Number(el.dataset.v);
    await uscita('.foglio', 'via', 170, app);
    r.i = i; r.sheet = false; r.conferma = false; salvaRun(); S.fx = 'q-d'; window.scrollTo(0, 0); route();
  },
  consegna() { const r = S.run; if (!r.conferma) { r.conferma = true; vibra.no(); route(); return; } finisciSim(false); },
  abbandona() {
    const r = S.run;
    if (!r.confermaAbb) { r.confermaAbb = true; route(); return; }
    clearInterval(S.tick); S.run = null; salvaRun(); vai('oggi');
  },
  vediCorrezione() { S.run.correzione = true; window.scrollTo(0, 0); route(); },
  chiudiCorrezione() { S.run.correzione = false; window.scrollTo(0, 0); route(); },
  copiaErroriSim() {
    const r = S.run, sbagliate = r.results.filter((x) => x.st !== 'right').map((x) => S.cards[x.c]).filter(Boolean);
    copia(testoErrori(sbagliate, r.results), 'Copiato: incollalo nella chat di correzione');
  },
  nulla() {},
  palestra(el) { if (S.prefs.palestra === el.dataset.v) return; S.prefs.palestra = el.dataset.v; S.ui.filtroMazzi = null; salvaPrefs(); route(); },
  decina(el) {
    const ids = tutteTutte().filter((c) => { const p = coppiaDaCarta(c); return p && p.numero.length === 2 && p.numero[0] === el.dataset.v; }).map((c) => c.id);
    if (!ids.length) { toast('Nessuna parola in questa decina'); return; }
    S.ui.scSolo = ids; vai('scrivi');
  },
  scriviLente() {
    const st = statCodice(A.eventi(), S.cards, oggi()), numeri = new Set(st.lente.map((x) => x.numero));
    const ids = tutteTutte().filter((c) => { const p = coppiaDaCarta(c); return p && numeri.has(p.numero); }).map((c) => c.id);
    if (!ids.length) { S.ui.scSolo = null; toast('Nessuna parola sopra i 2 secondi'); return; }
    S.ui.scSolo = ids; vai('scrivi');
  },
  scTutte() { S.ui.scSolo = null; if (S.ui.vista === 'scrivi') route(); },
  giornoMinimo() { S.ui.flModo = null; },
  giorno(el) { S.ui.giornoSel = el.dataset.v; route(); },
  apriLezione() { S.ui.formLezione = { giorno: oggi() }; route(); document.getElementById('lz-arg')?.focus({ preventScroll: true }); },
  chiudiLezione() { S.ui.formLezione = null; route(); },
  async salvaLezione() {
    const v = (id) => document.getElementById(id)?.value ?? '';
    const grezza = { argomento: v('lz-arg'), giorno: v('lz-giorno') || oggi(), da: v('lz-da').trim(), a: v('lz-a').trim() };
    const { lezione: l, errori } = validaLezione(grezza, oggi());
    if (errori.length) { S.ui.formLezione = grezza; toast(maiusc(errori[0])); vibra.no(); return; }
    await registra({ id: A.nuovoId(), t: 'l', at: new Date().toISOString(), giorno: l.giorno, arg: l.arg, ...(l.da != null ? { da: l.da, a: l.a } : {}), fonte: 'app' });
    S.ui.formLezione = null; S.ui.giornoSel = l.giorno; vibra.ok(); A.sincronizza(); route(); toast('Lezione segnata');
  },
  async togliLezione(el) {
    const id = el.dataset.v;
    if (S.ui.confLez !== id) { S.ui.confLez = id; route(); return; }
    await registra({ id: A.nuovoId(), t: 'lx', at: new Date().toISOString(), ref: id });
    S.ui.confLez = null; A.sincronizza(); route(); toast('Lezione tolta');
  },
  tutteLezioni() { S.ui.tutteLezioni = true; route(); },
  modScadenza(el) { S.ui.scadMod = el.dataset.v; route(); },
  async salvaScadenza(el) {
    const k = el.dataset.v, data = document.getElementById(`sc-data-${k}`)?.value || '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) { toast('Scegli un giorno'); return; }
    await registra({ id: A.nuovoId(), t: 'sc', at: new Date().toISOString(), chiave: k, data });
    S.ui.scadMod = null; A.sincronizza(); route();
  },
  async togliScadenza(el) {
    await registra({ id: A.nuovoId(), t: 'sc', at: new Date().toISOString(), chiave: el.dataset.v, data: null });
    S.ui.scadMod = null; A.sincronizza(); route();
  },
  async incollaLezioni() {
    const esito = document.getElementById('lz-esito');
    let data;
    try { data = jsonDaTesto(document.getElementById('lz-json').value); } catch (e) { esito.textContent = e.message; return; }
    const r = await aggiungiLezioniChat(data);
    const m = r.trovate ? testoLezioni(r) : 'Nessuna lezione nel blocco.';
    if (r.nuove) { S.ui.aperto = null; route(); toast(m); } else esito.textContent = m;
  },
  vibrazioni() { S.prefs.vibra = S.prefs.vibra === false; impostaVibrazioni(S.prefs.vibra); salvaPrefs(); if (S.prefs.vibra) vibra.ok(); route(); },
  risPreset(el) { S.ui.risPreset = el.dataset.v; S.ui.punto = null; route(); },
  punto(el) { S.ui.punto = Number(el.dataset.v); route(); },
  copiaFregano() {
    const carte = tutte().filter((c) => S.progress[c.id]?.lapses > 0).sort((a, b) => S.progress[b.id].lapses - S.progress[a.id].lapses).slice(0, 15);
    copia(testoErrori(carte, []), 'Copiato: incollalo nella chat di correzione');
  },
  apri(el) { S.ui.aperto = S.ui.aperto === el.dataset.v ? null : el.dataset.v; S.ui.confAzz = null; S.ui.confDel = null; route(); },
  async salvaSync() {
    const repo = document.getElementById('g-repo').value.trim().replace(/^https:\/\/github\.com\//, '').replace(/\/$/, '');
    const campo = document.getElementById('g-token').value.trim();
    const token = /^•+$/.test(campo) ? A.cfg?.token : campo;
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) { toast('Il repository si scrive così: utente/nome'); return; }
    if (!token) { toast('Incolla il token personale'); return; }
    try {
      if (repo !== A.cfg?.repo || token !== A.cfg?.token) await A.collega(repo, token);
      const ok = await A.sincronizza();
      if (ok) toast('Sincronizzato');
    } catch (e) {
      A.stato.fase = 'errore'; A.stato.errore = e.message; A.stato.tipoErrore = e.tipo;
      route();
      document.getElementById('g-repo').value = repo;
      document.getElementById('g-token').value = campo;
    }
  },
  async scollega() { await A.scollega(); toast('Dispositivo scollegato. I dati nel repository restano.'); route(); },
  async importa() {
    const esito = document.getElementById('g-esito');
    let data;
    try { data = jsonDaTesto(document.getElementById('g-json').value); } catch (e) { esito.textContent = e.message; return; }
    esito.textContent = 'Importo…';
    try { const m = await importaDati(data); S.ui.aperto = 'import'; route(); toast(m); document.getElementById('g-esito').textContent = m; } catch (e) { esito.textContent = e.message; }
  },
  async esporta() {
    const nome = `palestra-quiz-${oggi()}.json`, testo = JSON.stringify(datiEsportati(), null, 1);
    const file = new File([testo], nome, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: nome }); } catch { /* annullato */ }
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file); a.download = nome; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast('Backup pronto');
  },
  esportaCopia() { copia(JSON.stringify(datiEsportati()), 'Copiato'); },
  async azzera() {
    const id = document.getElementById('g-azz').value;
    if (!id) return;
    if (S.ui.confAzz !== id) { S.ui.confAzz = id; route(); document.getElementById('g-azz').value = id; return; }
    await registra({ id: A.nuovoId(), t: 'a', at: new Date().toISOString(), deck: id });
    S.ui.confAzz = null; A.sincronizza(); route(); toast('Progressi azzerati');
  },
  async elimina() {
    const id = document.getElementById('g-del').value;
    if (!id) return;
    if (S.ui.confDel !== id) { S.ui.confDel = id; route(); document.getElementById('g-del').value = id; return; }
    try {
      const n = await A.cancellaMazzo(id);
      await registra({ id: A.nuovoId(), t: 'a', at: new Date().toISOString(), deck: id });
      S.ui.confDel = null; ricalcola(); A.sincronizza(); route(); toast(`Eliminato il mazzo e ${plur(n, 'carta', 'carte')}`);
    } catch (e) { toast(e.message); }
  },
};
document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-a], a.tile, a.azione');
  if (!el || el.disabled) return;
  const az = el.dataset.a;
  // Queste azioni hanno una vibrazione propria; in simulazione nulla rivela se la risposta è giusta.
  if (!['vota', 'qzPick', 'flPick', 'consegna', 'vibrazioni', 'scControlla', 'scNonSo'].includes(az)) vibra.tocco();
  if (az) {
    S.ui.ultimo = `[data-a="${CSS.escape(az)}"]${el.dataset.v != null ? `[data-v="${CSS.escape(el.dataset.v)}"]` : ''}${el.dataset.k != null ? `[data-k="${CSS.escape(el.dataset.k)}"]` : ''}`;
    if (AZ[az]) AZ[az](el);
  }
});

// ---------- avvio ----------
A.onChange = (cambiato) => {
  if (cambiato) ricalcola();
  if (A.stato.fase === 'in-corso' && S.ui.vista !== 'gestione') return;
  const inProva = S.run && !S.run.finished;
  const v = S.ui.vista;
  if (inProva) return; // mai ridisegnare sotto le dita durante una sessione
  if (v === 'oggi' || v === 'mazzi' || v === 'risultati') { if (cambiato || A.stato.fase === 'errore' || A.stato.fase === 'offline') route(); }
  else if (v === 'rotta') {
    const scrive = S.ui.formLezione || S.ui.scadMod || ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) || document.getElementById('lz-json')?.value;
    if (!scrive && (cambiato || A.stato.fase === 'errore' || A.stato.fase === 'offline')) route();
  }
  else if (v === 'gestione') {
    // Non cancellare quello che stai scrivendo mentre la sincronizzazione lavora in sottofondo.
    const scrive = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) || document.getElementById('g-json')?.value;
    if (!scrive) route();
  } else if (v === 'simulazione' && S.run?.finished) route();
};
(async () => {
  await A.carica();
  S.prefs = (await kvGet('prefs')) || {};
  impostaVibrazioni(S.prefs.vibra !== false);
  document.addEventListener('touchstart', () => {}, { passive: true }); // su iPhone attiva lo stato "premuto" dei bottoni
  S.run = await kvGet('run');
  ricalcola();
  if (S.run && S.run.view === 'simulazione' && !S.run.finished) avviaTick();
  // Si ascolta l'indirizzo solo a dati caricati: prima, un ridisegno cancellerebbe quello che stai scrivendo.
  window.addEventListener('hashchange', route);
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  // Altezza vera dello schermo (su iPhone resta quella in verticale): serve alla regola del CSS per iOS 26.
  document.documentElement.style.setProperty('--schermo', `${Math.max(screen.height || 0, window.innerHeight)}px`);
  route();
  // All'apertura dall'icona iOS può partire con la pagina spostata e uno spazio vuoto sotto.
  // Nei primi istanti, appena le misure si assestano, la pagina torna in cima. Dopo non tocca più nulla.
  const avvio = Date.now(), inCima = () => { if (Date.now() - avvio < 2500 && window.scrollY !== 0) window.scrollTo(0, 0); };
  requestAnimationFrame(() => requestAnimationFrame(inCima));
  window.addEventListener('pageshow', inCima);
  window.visualViewport?.addEventListener('resize', inCima);
  if (A.collegato() && navigator.onLine) A.sincronizza();
  document.addEventListener('visibilitychange', () => {
    // Al ritorno scarica le novità; quando l'app va in secondo piano prova a inviare quello che ha.
    if (navigator.onLine && (document.visibilityState === 'visible' || A.pending.length)) A.sincronizza();
  });
  window.addEventListener('online', () => A.sincronizza());
  setInterval(() => { if (document.visibilityState === 'visible' && navigator.onLine) A.sincronizza(); }, 5 * 60000);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
