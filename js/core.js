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
