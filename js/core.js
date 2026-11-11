// Logica pura di Palestra Quiz: nessun accesso a schermo, rete o memoria.
// Tutto ciò che decide progressi e punteggi sta qui, così si può provare in Node.

export const INTERVALS = [1, 3, 7, 14, 30, 60, 120]; // giorni per scatola 0..6
export const CONSOLIDATA_DA = 3; // una carta è consolidata dalla scatola 3 (ripasso ogni 14 giorni o più)

// ---------- date (sempre ora italiana, così PC e telefono calcolano lo stesso giorno) ----------
const fmtRome = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' });
export const romeDate = (d = new Date()) => fmtRome.format(d instanceof Date ? d : new Date(d));
export const addDays = (ymd, n) => {
  const [y, m, g] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, g + n)).toISOString().slice(0, 10);
};
export const daysBetween = (a, b) => {
  const u = (s) => { const [y, m, g] = s.split('-').map(Number); return Date.UTC(y, m - 1, g); };
  return Math.round((u(b) - u(a)) / 864e5);
};

// ---------- materie ----------
export const MATERIE = {
  ordinamento: 'Ordinamento Agenzia',
  dirAmm: 'Diritto amministrativo',
  pubblico: 'Pubblico impiego',
  informatica: 'Informatica',
  inglese: 'Inglese',
  asmelSpec: 'ASMEL specifiche',
  asmelComuni: 'ASMEL comuni',
  metodo: 'Metodo',
};
// Riconosce la materia anche se scritta per esteso ("Ordinamento dell'Agenzia delle Entrate").
export function materiaKey(nome) {
  const s = String(nome || '').toLowerCase();
  if (s.includes('ordinamento')) return 'ordinamento';
  if (s.includes('amministrativo')) return 'dirAmm';
  if (s.includes('impiego')) return 'pubblico';
  if (s.includes('informatica')) return 'informatica';
  if (s.includes('inglese')) return 'inglese';
  if (s.includes('asmel')) return s.includes('specific') ? 'asmelSpec' : 'asmelComuni';
  if (s.includes('metodo')) return 'metodo';
  return 'altro';
}

export const ORDINE_MATERIE = ['ordinamento', 'dirAmm', 'pubblico', 'informatica', 'inglese', 'asmelSpec', 'asmelComuni', 'metodo', 'altro'];

// ---------- formati di simulazione ----------
export const PRESETS = {
  ade: {
    label: 'Agenzia delle Entrate', n: 50, min: 60, right: 0.6, wrong: -0.07, blank: 0, pass: 18, max: 30,
    gruppi: [
      { id: 'ordinamento', label: 'Ordinamento Agenzia', short: 'Ordinamento', n: 20, materie: ['ordinamento'] },
      { id: 'dirAmm', label: 'Diritto amministrativo', short: 'Dir. amm.', n: 10, materie: ['dirAmm'] },
      { id: 'pubblico', label: 'Pubblico impiego', short: 'Pubblico impiego', n: 10, materie: ['pubblico'] },
      { id: 'informatica', label: 'Informatica', short: 'Informatica', n: 5, materie: ['informatica'] },
      { id: 'inglese', label: 'Inglese', short: 'Inglese', n: 5, materie: ['inglese'] },
    ],
  },
  asmel: {
    label: 'ASMEL', n: 60, min: 60, right: 1, wrong: 0, blank: 0, pass: 42, max: 60,
    gruppi: [
      { id: 'specifiche', label: 'Materie specifiche', short: 'Specifiche', n: 30, materie: ['asmelSpec'] },
      { id: 'comuni', label: 'Materie comuni', short: 'Comuni', n: 25, materie: ['asmelComuni', 'dirAmm', 'pubblico'] },
      { id: 'lingue', label: 'Inglese e informatica', short: 'Inglese e informatica', n: 5, materie: ['inglese', 'informatica'] },
    ],
  },
  breve: {
    label: 'Allenamento breve', n: 20, min: 20, right: 0.6, wrong: -0.07, blank: 0, pass: 7.2, max: 12,
    gruppi: [
      { id: 'ordinamento', label: 'Ordinamento Agenzia', short: 'Ordinamento', n: 8, materie: ['ordinamento'] },
      { id: 'dirAmm', label: 'Diritto amministrativo', short: 'Dir. amm.', n: 4, materie: ['dirAmm'] },
      { id: 'pubblico', label: 'Pubblico impiego', short: 'Pubblico impiego', n: 4, materie: ['pubblico'] },
      { id: 'informatica', label: 'Informatica', short: 'Informatica', n: 2, materie: ['informatica'] },
      { id: 'inglese', label: 'Inglese', short: 'Inglese', n: 2, materie: ['inglese'] },
    ],
  },
};

export const shuffle = (a, rnd = Math.random) => {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

// Divide "totale" in parti proporzionali ai pesi, con somma esatta (metodo dei resti più grandi).
export function ripartisci(pesi, totale) {
  const somma = pesi.reduce((a, b) => a + b, 0);
  if (!somma) return pesi.map(() => 0);
  const quote = pesi.map((p) => (p * totale) / somma);
  const base = quote.map(Math.floor);
  let resto = totale - base.reduce((a, b) => a + b, 0);
  const ordine = quote.map((q, i) => [q - Math.floor(q), i]).sort((a, b) => b[0] - a[0]);
  for (const [, i] of ordine) { if (resto <= 0) break; base[i]++; resto--; }
  return base;
}

// Pesca a giro dai mazzi, così un mazzo grande non schiaccia gli altri della stessa materia.
function pescaAGiro(pool, n, rnd) {
  const perMazzo = new Map();
  for (const c of shuffle(pool, rnd)) { if (!perMazzo.has(c.deck)) perMazzo.set(c.deck, []); perMazzo.get(c.deck).push(c); }
  const mazzi = [...perMazzo.values()], out = [];
  while (out.length < n && mazzi.some((m) => m.length)) {
    for (const m of mazzi) { if (out.length >= n) break; if (m.length) out.push(m.pop()); }
  }
  return out;
}

// Prepara le domande di una simulazione rispettando le quote dell'esame.
// Se una materia ha poche carte, riempie con le altre e lo segnala.
// scelti: id dei gruppi selezionati, oppure null per tutte le materie.
export function preparaSimulazione(presetKey, carte, deckMateria, scelti = null, rnd = Math.random) {
  const p = PRESETS[presetKey];
  const quiz = carte.filter((c) => c.kind === 'quiz');
  const chiave = (c) => materiaKey(deckMateria[c.deck]);
  const attivi = scelti && scelti.length ? p.gruppi.filter((g) => scelti.includes(g.id)) : p.gruppi;
  const limitato = attivi.length < p.gruppi.length;
  const quote = limitato ? ripartisci(attivi.map((g) => g.n), p.n) : attivi.map((g) => g.n);

  const usate = new Set(), righe = [];
  const gruppoDi = (c) => attivi.find((g) => g.materie.includes(chiave(c)));
  attivi.forEach((g, i) => {
    const pool = quiz.filter((c) => gruppoDi(c) === g);
    const prese = pescaAGiro(pool, quote[i], rnd);
    prese.forEach((c) => usate.add(c.id));
    righe.push({ id: g.id, label: g.label, attese: quote[i], disponibili: pool.length, carte: prese, riempite: [] });
  });

  // Riempimento: prima dalle altre materie del formato, in proporzione a quante ne sono rimaste.
  const mancanti = () => righe.reduce((a, r) => a + r.attese - r.carte.length - r.riempite.length, 0);
  let riempimento = [];
  if (mancanti() > 0) {
    const resti = attivi.map((g) => quiz.filter((c) => gruppoDi(c) === g && !usate.has(c.id)));
    const parti = ripartisci(resti.map((r) => r.length), Math.min(mancanti(), resti.reduce((a, r) => a + r.length, 0)));
    resti.forEach((r, i) => { riempimento.push(...pescaAGiro(r, parti[i], rnd)); });
    riempimento.forEach((c) => usate.add(c.id));
  }
  // Ultima risorsa, solo se non hai scelto tu di limitare le materie: carte fuori programma (es. Metodo).
  let fuoriProgramma = [];
  const ancora = () => mancanti() - riempimento.length;
  if (ancora() > 0 && !limitato) {
    fuoriProgramma = pescaAGiro(quiz.filter((c) => !usate.has(c.id) && !gruppoDi(c)), ancora(), rnd);
  }

  const avvisi = [];
  const corte = righe.filter((r) => r.carte.length < r.attese);
  if (corte.length) {
    const elenco = corte.map((r) => `${r.label} ${r.carte.length} su ${r.attese}`).join(', ');
    const riempite = riempimento.length + fuoriProgramma.length;
    avvisi.push(`Carte insufficienti: ${elenco}.` + (riempite ? ` Ne aggiungo ${riempite} dalle altre materie.` : ''));
  }
  if (fuoriProgramma.length) avvisi.push(`${fuoriProgramma.length} domande sono fuori programma (per esempio Metodo).`);
  const tutte = [...righe.flatMap((r) => r.carte), ...riempimento, ...fuoriProgramma];
  const incompleta = tutte.length < p.n;
  if (incompleta && tutte.length) avvisi.push(`La prova avrà ${tutte.length} domande su ${p.n}: il punteggio non è confrontabile con l'esame.`);
  const proporzioneRispettata = !corte.length && !limitato;

  return {
    queue: shuffle(tutte, rnd).map((c) => c.id),
    avvisi,
    incompleta,
    proporzioneRispettata,
    quote: righe.map((r) => ({ id: r.id, label: r.label, attese: r.attese, prese: r.carte.length, disponibili: r.disponibili })),
  };
}

export function calcolaPunteggio(presetKey, risposte) {
  const p = PRESETS[presetKey];
  let right = 0, wrong = 0, blank = 0;
  for (const r of risposte) { if (r === 'right') right++; else if (r === 'wrong') wrong++; else blank++; }
  const score = Math.round((right * p.right + wrong * p.wrong + blank * p.blank) * 100) / 100;
  return { right, wrong, blank, score, passed: score >= p.pass };
}

// ---------- registro: ogni risposta è un evento che non si cancella mai ----------
// Ogni dispositivo scrive solo nel proprio file. Le due copie non possono entrare in conflitto:
// lo stato si ricalcola sempre rileggendo tutti gli eventi in ordine di tempo.
export const ordinaEventi = (eventi) => eventi.slice().sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

export function unisciEventi(...liste) {
  const m = new Map();
  for (const l of liste) for (const e of l) if (e && e.id) m.set(e.id, e);
  return ordinaEventi([...m.values()]);
}

export const percorsoRegistro = (ev, device) => `registro/${romeDate(ev.at).slice(0, 7)}/${device}.jsonl`;
export const eventiInTesto = (eventi) => ordinaEventi(eventi).map((e) => JSON.stringify(e)).join('\n') + '\n';
export function testoInEventi(testo) {
  const out = [];
  for (const riga of String(testo || '').split('\n')) {
    if (!riga.trim()) continue;
    try { out.push(JSON.parse(riga)); } catch { /* una riga rovinata non deve bloccare le altre */ }
  }
  return out;
}

// Applica un voto allo stato di una carta. Voti: 0 sbagliata, 1 difficile, 2 la sapevo.
export function applicaVoto(stato, voto, at) {
  const oggi = romeDate(at);
  const s = stato ? { ...stato } : { box: 0, reps: 0, lapses: 0 };
  const dovuta = !s.due || s.due <= oggi;
  s.reps = (s.reps || 0) + 1;
  s.last = voto;
  s.lastAt = at;
  if (voto === 0) { s.box = 0; s.lapses = (s.lapses || 0) + 1; s.due = addDays(oggi, 1); }
  else if (voto === 1) { s.due = addDays(oggi, 1); }
  else if (dovuta) {
    // Sale di scatola solo se la carta era davvero in scadenza. Così rifarla lo stesso giorno
    // sull'altro dispositivo non la promuove due volte.
    s.box = Math.min(INTERVALS.length - 1, (s.box || 0) + 1);
    s.due = addDays(oggi, INTERVALS[s.box]);
  }
  return s;
}

// Ricostruisce progressi e sessioni dagli eventi.
export function ricostruisci(eventi) {
  const progress = {}, sessions = [];
  for (const e of ordinaEventi(eventi)) {
    if (e.t === 'v') { progress[e.c] = { ...applicaVoto(progress[e.c], e.g, e.at), d: e.d }; }
    else if (e.t === 'p') { progress[e.c] = { box: e.box || 0, due: e.due, reps: e.reps || 0, lapses: e.lapses || 0, last: e.last, lastAt: e.at, d: e.d }; }
    else if (e.t === 'a') { for (const k of Object.keys(progress)) if (progress[k].d === e.deck) delete progress[k]; }
    else if (e.t === 's') { sessions.push(e); }
  }
  sessions.sort((a, b) => (a.at > b.at ? -1 : 1));
  return { progress, sessions };
}

// ---------- calcoli per le schermate ----------
export const inScadenza = (c, progress, oggi) => { const p = progress[c.id]; return !!(p && p.due && p.due <= oggi); };
export const maiVista = (c, progress) => !progress[c.id];
export const consolidata = (c, progress) => (progress[c.id]?.box ?? 0) >= CONSOLIDATA_DA;

// In quanti giorni torna la carta per ciascun voto (per le etichette dei bottoni).
export function prossimoRitorno(stato, voto, oggi) {
  const s = applicaVoto(stato, voto, new Date(`${oggi}T12:00:00+01:00`).toISOString());
  return daysBetween(oggi, s.due);
}
export const testoGiorni = (n) => (n <= 0 ? 'oggi' : n === 1 ? 'domani' : `tra ${n} giorni`);

export function ordinaQuiz(pool, progress, oggi, modo, rnd = Math.random) {
  const a = shuffle(pool, rnd);
  if (modo === 'weak') {
    a.sort((x, y) => (progress[y.id]?.lapses || 0) - (progress[x.id]?.lapses || 0) || (progress[x.id]?.box ?? -1) - (progress[y.id]?.box ?? -1));
  } else if (modo === 'due') {
    a.sort((x, y) => (inScadenza(x, progress, oggi) ? 0 : 1) - (inScadenza(y, progress, oggi) ? 0 : 1));
  }
  return a;
}

// Controlla un JSON di carte prima di scriverlo. Stesse regole del formato dell'app.
const idValido = (s) => /^[A-Za-z0-9_\-.~:@+]{1,200}$/.test(s || '');
export function validaCarte(data, mazziNoti = []) {
  const decks = Array.isArray(data?.decks) ? data.decks : [];
  const cards = Array.isArray(data?.cards) ? data.cards : [];
  const errori = [];
  decks.forEach((d, i) => { if (!idValido(d.id) || !d.name) errori.push(`mazzo ${i + 1}: id o name mancante`); });
  const noti = new Set([...mazziNoti, ...decks.map((d) => d.id)]);
  cards.forEach((c, i) => {
    const nome = c.id || i + 1;
    if (!idValido(c.id)) errori.push(`carta ${i + 1}: id non valido`);
    if (!c.deck) errori.push(`carta ${nome}: deck mancante`);
    else if (!noti.has(c.deck)) errori.push(`carta ${nome}: il mazzo "${c.deck}" non esiste`);
    if (!c.front) errori.push(`carta ${nome}: front mancante`);
    if (c.kind === 'quiz') {
      if (!Array.isArray(c.options) || c.options.length < 2) errori.push(`carta ${nome}: options mancanti`);
      if (!(Number.isInteger(c.answer) && c.answer >= 0 && c.answer < (c.options || []).length)) errori.push(`carta ${nome}: answer fuori range`);
    } else if (c.kind === 'flash') {
      if (!c.back) errori.push(`carta ${nome}: back mancante`);
    } else errori.push(`carta ${nome}: kind deve essere quiz o flash`);
  });
  return { decks, cards, errori };
}

export const fmt = (n, d = 2) => (Math.round(n * 100) / 100).toFixed(d).replace('.', ',');
export const fmtMin = (n) => (Number.isInteger(n) ? String(n) : fmt(n)); // 1 e 0, ma 0,60 e 0,07
export const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

// ---------- allenamento "Scrivi a memoria" sul codice fonetico ----------
export const LIMITE_MS = 2000; // barra facoltativa: la soglia di lavoro, non un dato scientifico
export const ESITAZIONE_MS = 3000; // oltre questo, anche senza barra, conta come esitazione

// Accenti, maiuscole e spazi non contano: "tè" = "te", "Città" = "citta".
export const normalizza = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Dalla carta ricava numero, parola e senso. Ritorna null se la carta non è di questo allenamento.
export function coppiaDaCarta(c) {
  if (!c?.tags) return null;
  if (c.kind === 'flash' && c.tags.includes('numero-parola')) return { numero: String(c.front), parola: c.back, senso: 'np' };
  if (c.kind === 'quiz' && c.tags.includes('parola-numero')) {
    const m = String(c.front).match(/"(.+)"/);
    return m ? { numero: String(c.options[c.answer]), parola: m[1], senso: 'pn' } : null;
  }
  return null;
}

// Prima le carte in scadenza, poi le nuove, poi le altre.
export function scegliScrittura(carte, senso, progress, oggi, n, rnd = Math.random) {
  const pool = carte.filter((c) => { const p = coppiaDaCarta(c); return p && (senso === 'misto' || p.senso === senso); });
  const peso = (c) => (inScadenza(c, progress, oggi) ? 0 : maiVista(c, progress) ? 1 : 2);
  return shuffle(pool, rnd).sort((a, b) => peso(a) - peso(b)).slice(0, n);
}

export function votoScrittura(ok, ms, conTempo) {
  if (!ok) return 0;
  return conTempo && ms > LIMITE_MS ? 1 : 2;
}

// Parole sbagliate o esitate più di 3 volte: la regola del rodaggio. Decide sempre Simone.
export function paroleDifficili(eventi, cards) {
  const conti = new Map();
  for (const e of eventi) {
    if (e.t !== 'v') continue;
    const c = cards[e.c], p = coppiaDaCarta(c);
    if (!p) continue;
    if (e.g === 0 || (e.k === 'scrivi' && e.ms > ESITAZIONE_MS)) {
      const r = conti.get(p.numero) || { numero: p.numero, parola: p.parola, volte: 0 };
      r.volte++;
      conti.set(p.numero, r);
    }
  }
  return [...conti.values()].filter((r) => r.volte > 3).sort((a, b) => b.volte - a.volte);
}

// ---------- Due palestre: materie del concorso e codice fonetico ----------
// Un mazzo è del codice se la sua materia è "Metodo" o se il suo id comincia con "cf-".
export const palestraDi = (deck) => (materiaKey(deck?.materia) === 'metodo' || String(deck?.id || '').startsWith('cf-') ? 'codice' : 'materie');
// Senza l'elenco dei mazzi basta il prefisso: gli id delle carte cominciano con l'id del mazzo.
const codicePerPrefisso = (id) => String(id || '').startsWith('cf-');

// Statistiche dello Scrivi a memoria per la palestra del codice.
// Una parola è "fissata" se l'ultima volta l'hai scritta giusta e in meno di 2 secondi, in tutti e due i sensi.
export function statCodice(eventi, cards, oggi) {
  const coppie = new Map(); // numero -> { parola, carte: { np, pn } }
  for (const c of Object.values(cards)) {
    const p = coppiaDaCarta(c);
    if (!p) continue;
    const x = coppie.get(p.numero) || { numero: p.numero, parola: p.parola, carte: {} };
    x.carte[p.senso] = c.id;
    if (p.senso === 'np') x.parola = p.parola;
    coppie.set(p.numero, x);
  }
  const ultimo = new Map(), giornoDiE = (e) => romeDate(e.at);
  const da7 = addDays(oggi, -6), da14 = addDays(oggi, -13);
  const sette = [], quattordici = new Map(), provate = new Set();
  for (const e of ordinaEventi(eventi)) {
    if (e.t !== 'v' || e.k !== 'scrivi' || !cards[e.c]) continue;
    const p = coppiaDaCarta(cards[e.c]);
    if (!p) continue;
    ultimo.set(e.c, e); provate.add(p.numero);
    const g = giornoDiE(e);
    if (e.g > 0 && Number.isFinite(e.ms) && g <= oggi) {
      if (g >= da7) sette.push({ g, ms: e.ms, senso: p.senso });
      if (g >= da14) { const l = quattordici.get(p.numero) || []; l.push(e.ms); quattordici.set(p.numero, l); }
    }
  }
  const presa = (id) => { const e = id && ultimo.get(id); return !!e && e.g > 0 && Number.isFinite(e.ms) && e.ms <= LIMITE_MS; };
  const fissata = (x) => !!(x.carte.np && x.carte.pn) && presa(x.carte.np) && presa(x.carte.pn);
  const tutte = [...coppie.values()];
  const decine = Array.from({ length: 10 }, (_, d) => {
    const qui = tutte.filter((x) => x.numero.length === 2 && x.numero[0] === String(d));
    return { da: `${d}0`, a: `${d}9`, tot: qui.length, fissate: qui.filter(fissata).length, iniziata: qui.some((x) => provate.has(x.numero)) };
  });
  // Tempo tipico: la mediana, così una pausa lunga (il telefono posato) non falsa il conto.
  const media = (l) => { if (!l.length) return null; const o = [...l].sort((a, b) => a - b), m = o.length >> 1; return o.length % 2 ? o[m] : Math.round((o[m - 1] + o[m]) / 2); };
  const perGiorno = Array.from({ length: 7 }, (_, i) => { const g = addDays(da7, i); return { giorno: g, ms: media(sette.filter((x) => x.g === g).map((x) => x.ms)) }; });
  const lente = [...quattordici.entries()].map(([n, l]) => ({ numero: n, parola: coppie.get(n)?.parola || '', ms: media(l), volte: l.length }))
    .filter((x) => x.volte >= 2 && x.ms > LIMITE_MS).sort((a, b) => b.ms - a.ms).slice(0, 5);
  return {
    parole: tutte.length, fissate: tutte.filter(fissata).length, decine,
    iniziate: decine.filter((d) => d.iniziata).length,
    medioMs: media(sette.map((x) => x.ms)), perGiorno,
    perSenso: { np: media(sette.filter((x) => x.senso === 'np').map((x) => x.ms)), pn: media(sette.filter((x) => x.senso === 'pn').map((x) => x.ms)) },
    lente,
  };
}

// ---------- Rotta: costanza, lezioni e manuale ----------
// Manuale EdiSES del concorso 622: 306 pagine in quattro libri.
export const MANUALE = {
  pagine: 306,
  libri: [
    { n: 'I', nome: 'Diritto amministrativo', da: 1, a: 182 },
    { n: 'II', nome: 'Pubblico impiego', da: 183, a: 216 },
    { n: 'III', nome: 'Ordinamento AdE', da: 217, a: 244 },
    { n: 'IV', nome: 'Inglese e Informatica', da: 245, a: 306 },
  ],
};
// Un giorno conta se chiudi almeno una sessione o dai almeno 10 risposte.
export const RISPOSTE_GIORNO_MINIMO = 10;
export const SETTIMANE_CATENA = 20;
const ymdValido = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && romeDate(`${s}T12:00:00Z`) === s;
const giornoDi = (e) => (e.t === 'l' && ymdValido(e.giorno) ? e.giorno : romeDate(e.at));
// Lunedì della settimana di un giorno.
export const lunedi = (ymd) => addDays(ymd, -((new Date(`${ymd}T12:00:00Z`).getUTCDay() + 6) % 7));

// Lezioni segnate, tolte quelle cancellate. Le più recenti prima.
export function lezioni(eventi) {
  const tolte = new Set(eventi.filter((e) => e.t === 'lx').map((e) => e.ref));
  return ordinaEventi(eventi.filter((e) => e.t === 'l' && !tolte.has(e.id)))
    .map((e) => ({ id: e.id, giorno: giornoDi(e), arg: e.arg || '', da: e.da ?? null, a: e.a ?? null, fonte: e.fonte || 'app', at: e.at }))
    .sort((x, y) => (x.giorno < y.giorno ? 1 : x.giorno > y.giorno ? -1 : x.at < y.at ? 1 : -1));
}

// Cosa è successo in ogni giorno. Conta solo lo studio delle materie: il codice fonetico si segna a parte e non fa catena.
// opz.codice(idMazzo) dice se un mazzo è del codice; opz.mazzoDi(idCarta) trova il mazzo di una carta.
export function attivitaGiorni(eventi, opz = {}) {
  const codice = opz.codice || codicePerPrefisso, mazzoDi = opz.mazzoDi || ((id) => id);
  const m = new Map(), voce = (g) => { if (!m.has(g)) m.set(g, { sessioni: 0, risposte: 0, lezioni: 0, codice: 0 }); return m.get(g); };
  // Una sessione è di studio se almeno una risposta è su una carta delle materie. La simulazione lo è sempre.
  const sessioneStudio = (e) => e.kind === 'sim' || (e.kind !== 'scrivi' && (e.answers || []).some((a) => !codice(mazzoDi(a.c) ?? a.c)));
  for (const e of eventi) {
    if (e.t === 's') { if (sessioneStudio(e)) voce(romeDate(e.at)).sessioni++; }
    else if (e.t === 'v') {
      if (codice(e.d ?? mazzoDi(e.c) ?? e.c)) voce(romeDate(e.at)).codice++;
      else voce(romeDate(e.at)).risposte++;
    }
  }
  for (const l of lezioni(eventi)) voce(l.giorno).lezioni++;
  return m;
}
// 0 niente, 1 giorno minimo, 2 giorno pieno (c'è una lezione).
export const livelloGiorno = (g) => (!g ? 0 : g.lezioni > 0 ? 2 : g.sessioni > 0 || g.risposte >= RISPOSTE_GIORNO_MINIMO ? 1 : 0);

export function catena(eventi, oggi, settimane = SETTIMANE_CATENA, opz = {}) {
  const att = attivitaGiorni(eventi, opz), liv = (g) => livelloGiorno(att.get(g));
  const fine = addDays(lunedi(oggi), 6), inizio = addDays(lunedi(oggi), -7 * (settimane - 1));
  const giorni = [];
  for (let g = inizio; g <= fine; g = addDays(g, 1)) giorni.push({ giorno: g, livello: g > oggi ? 0 : liv(g), futuro: g > oggi, ...(att.get(g) || { sessioni: 0, risposte: 0, lezioni: 0, codice: 0 }) });
  // La serie resta viva fino a stasera: se oggi non hai ancora fatto nulla, conta da ieri.
  let serie = 0;
  for (let g = liv(oggi) ? oggi : addDays(oggi, -1); liv(g); g = addDays(g, -1)) serie++;
  let record = 0, corsa = 0, prec = null;
  for (const g of [...att.keys()].filter((x) => x <= oggi && liv(x)).sort()) {
    corsa = prec && daysBetween(prec, g) === 1 ? corsa + 1 : 1;
    record = Math.max(record, corsa); prec = g;
  }
  return { giorni, serie, record, oggiFatto: liv(oggi) > 0, ieriFatto: liv(addDays(oggi, -1)) > 0, haStoria: [...att.values()].some((v) => livelloGiorno(v)) };
}

// Regola dei due giorni: mai saltare due giorni di fila.
export function regolaDueGiorni(eventi, oggi, opz = {}) {
  const c = catena(eventi, oggi, 1, opz);
  if (!c.haStoria || c.ieriFatto) return null;
  return c.oggiFatto ? 'salva' : 'minimo';
}

// Pagine del manuale coperte dalle lezioni. Una pagina rifatta due volte conta una volta.
export function avanzamentoManuale(lista) {
  const lette = new Set();
  for (const l of lista) {
    if (!Number.isInteger(l.da) || !Number.isInteger(l.a)) continue;
    for (let p = Math.max(1, l.da); p <= Math.min(MANUALE.pagine, l.a); p++) lette.add(p);
  }
  const libri = MANUALE.libri.map((b) => {
    let n = 0;
    for (let p = b.da; p <= b.a; p++) if (lette.has(p)) n++;
    return { ...b, lette: n, tot: b.a - b.da + 1 };
  });
  return { lette: lette.size, tot: MANUALE.pagine, libri };
}

// Settimana da lunedì a domenica.
export function riepilogoSettimana(eventi, oggi, opz = {}) {
  const da = lunedi(oggi), a = addDays(da, 6), dentro = (g) => g >= da && g <= a;
  const att = attivitaGiorni(eventi, opz), codice = opz.codice || codicePerPrefisso, mazzoDi = opz.mazzoDi || ((id) => id);
  const studio = eventi.filter((e) => e.t === 'v' && dentro(romeDate(e.at)) && !codice(e.d ?? mazzoDi(e.c) ?? e.c));
  let attivi = 0;
  for (let g = da; g <= a && g <= oggi; g = addDays(g, 1)) if (livelloGiorno(att.get(g))) attivi++;
  const sims = eventi.filter((e) => e.t === 's' && e.kind === 'sim').sort((x, y) => (x.at > y.at ? -1 : 1));
  return {
    da, a, attivi,
    lezioni: lezioni(eventi).filter((l) => dentro(l.giorno)).length,
    carte: new Set(studio.map((e) => e.c)).size, // carte diverse delle materie, non risposte
    risposte: studio.length,
    ultimaSim: sims[0] || null,
  };
}

// Conti alla rovescia. La data può essere un giorno (2027-01-20) o solo un mese (2027-01).
export const SCADENZE_BASE = [
  { chiave: 'asmel', nome: 'ASMEL', data: '2027-01', nota: 'Giorno da confermare' },
  { chiave: 'ade335', nome: 'Bando 335 Agenzia Entrate', data: null, nota: 'Quando esce il bando' },
];
const dataScadenzaValida = (s) => s == null || s === '' || ymdValido(s) || (/^\d{4}-(0[1-9]|1[0-2])$/.test(s));
export function scadenze(eventi) {
  const m = new Map(SCADENZE_BASE.map((s) => [s.chiave, { ...s }]));
  for (const e of ordinaEventi(eventi)) {
    if (e.t !== 'sc' || !e.chiave || !dataScadenzaValida(e.data)) continue;
    const prima = m.get(e.chiave) || { chiave: e.chiave, nome: e.chiave, nota: '' };
    m.set(e.chiave, { ...prima, nome: e.nome || prima.nome, data: e.data || null, nota: e.data ? '' : prima.nota });
  }
  return [...m.values()];
}
// Giorni che mancano. Con solo il mese si conta fino al primo del mese: "almeno".
export function quantoManca(data, oggi) {
  if (!data) return null;
  if (ymdValido(data)) return { giorni: daysBetween(oggi, data), almeno: false };
  return { giorni: daysBetween(oggi, `${data}-01`), almeno: true };
}

// Lezioni scritte da una chat del progetto (FINE SESSIONE) e incollate nell'app.
// Lo stesso testo incollato due volte produce lo stesso id, quindi non si duplica.
const impronta = (s) => { let h = 2166136261; for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); };
export function validaLezione(l, oggi) {
  const arg = String(l?.argomento ?? l?.arg ?? '').trim();
  const giorno = l?.giorno ?? oggi;
  const da = l?.da == null || l.da === '' ? null : Number(l.da), a = l?.a == null || l.a === '' ? null : Number(l.a);
  const errori = [];
  if (!arg || arg.length > 200) errori.push("manca l'argomento");
  if (!ymdValido(giorno)) errori.push('giorno non valido (AAAA-MM-GG)');
  else if (giorno > oggi) errori.push('il giorno è nel futuro');
  if ((da == null) !== (a == null)) errori.push('servono tutte e due le pagine, da e a');
  else if (da != null && !(Number.isInteger(da) && Number.isInteger(a) && da >= 1 && a <= MANUALE.pagine && da <= a)) errori.push(`le pagine vanno da 1 a ${MANUALE.pagine} e "da" non può superare "a"`);
  return { lezione: { giorno, arg, da, a }, errori };
}
export function lezioniDaJson(data, oggi, at) {
  const lista = Array.isArray(data) ? data : Array.isArray(data?.lezioni) ? data.lezioni : data?.lezione ? [data.lezione] : (data?.argomento || data?.arg) ? [data] : [];
  const eventi = [], errori = [];
  lista.forEach((x, i) => {
    const { lezione: l, errori: e } = validaLezione(x, oggi);
    if (e.length) { errori.push(`lezione ${i + 1}: ${e.join(', ')}`); return; }
    eventi.push({ id: `chat-${impronta(`${l.giorno}|${l.arg}|${l.da}|${l.a}`)}`, t: 'l', at, giorno: l.giorno, arg: l.arg, ...(l.da != null ? { da: l.da, a: l.a } : {}), fonte: 'chat' });
  });
  return { eventi, errori, trovate: lista.length };
}
