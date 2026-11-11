// Prove della logica: node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRESETS, preparaSimulazione, calcolaPunteggio, ricostruisci, unisciEventi, applicaVoto, romeDate, addDays,
  ripartisci, validaCarte, eventiInTesto, testoInEventi, percorsoRegistro, materiaKey, prossimoRitorno,
  normalizza, coppiaDaCarta, scegliScrittura, votoScrittura, paroleDifficili,
  lunedi, lezioni, catena, regolaDueGiorni, avanzamentoManuale, riepilogoSettimana, scadenze, quantoManca, lezioniDaJson, MANUALE,
  palestraDi, statCodice, ordineOpzioni,
} from '../js/core.js';

const MAT = { o: 'Ordinamento dell\'Agenzia delle Entrate', d: 'Diritto amministrativo', p: 'Pubblico impiego', i: 'Informatica', e: 'Inglese', s: 'ASMEL specifiche', c: 'ASMEL comuni', m: 'Metodo' };
const deckMateria = Object.fromEntries(Object.entries(MAT).map(([k, v]) => [k, v]));
function carte(conti) {
  const out = [];
  for (const [deck, n] of Object.entries(conti)) for (let i = 0; i < n; i++) out.push({ id: `${deck}-${i}`, deck, kind: 'quiz', options: ['a', 'b', 'c', 'd'], answer: 0, front: `${deck}${i}` });
  return out;
}
const conta = (queue, deck) => queue.filter((id) => id.startsWith(`${deck}-`)).length;

test('Agenzia: 20/10/10/5/5 esatti e nessun avviso', () => {
  const r = preparaSimulazione('ade', carte({ o: 100, d: 100, p: 100, i: 100, e: 100, m: 50 }), deckMateria);
  assert.equal(r.queue.length, 50);
  assert.deepEqual(['o', 'd', 'p', 'i', 'e'].map((k) => conta(r.queue, k)), [20, 10, 10, 5, 5]);
  assert.equal(conta(r.queue, 'm'), 0);
  assert.deepEqual(r.avvisi, []);
  assert.equal(new Set(r.queue).size, 50);
});
test('Breve: 8/4/4/2/2 esatti', () => {
  const r = preparaSimulazione('breve', carte({ o: 50, d: 50, p: 50, i: 50, e: 50 }), deckMateria);
  assert.deepEqual(['o', 'd', 'p', 'i', 'e'].map((k) => conta(r.queue, k)), [8, 4, 4, 2, 2]);
  assert.equal(r.queue.length, 20);
});
test('ASMEL: 30 specifiche, 25 comuni, 5 inglese e informatica', () => {
  const r = preparaSimulazione('asmel', carte({ s: 100, c: 20, d: 20, p: 20, i: 20, e: 20, o: 50 }), deckMateria);
  assert.equal(r.queue.length, 60);
  assert.equal(conta(r.queue, 's'), 30);
  assert.equal(conta(r.queue, 'c') + conta(r.queue, 'd') + conta(r.queue, 'p'), 25);
  assert.equal(conta(r.queue, 'i') + conta(r.queue, 'e'), 5);
  assert.equal(conta(r.queue, 'o'), 0, 'Ordinamento Agenzia non è materia ASMEL');
});
test('Materia con poche carte: riempie con le altre e avvisa', () => {
  const r = preparaSimulazione('ade', carte({ o: 3, d: 100, p: 100, i: 100, e: 100 }), deckMateria);
  assert.equal(r.queue.length, 50);
  assert.equal(conta(r.queue, 'o'), 3);
  assert.equal(r.avvisi.length, 1);
  assert.match(r.avvisi[0], /Ordinamento Agenzia 3 su 20/);
  assert.match(r.avvisi[0], /aggiungo 17/);
  assert.equal(new Set(r.queue).size, 50, 'mai due volte la stessa domanda');
});
test('Poche carte in tutto: prova più corta, avviso chiaro, fuori programma come ultima risorsa', () => {
  const r = preparaSimulazione('ade', carte({ m: 10 }), deckMateria);
  assert.equal(r.queue.length, 10);
  assert.equal(r.incompleta, true);
  assert.ok(r.avvisi.some((a) => /fuori programma/.test(a)));
  assert.ok(r.avvisi.some((a) => /10 domande su 50/.test(a)));
});
test('Solo una materia scelta: niente carte dalle altre', () => {
  const r = preparaSimulazione('ade', carte({ o: 10, d: 100 }), deckMateria, ['ordinamento']);
  assert.equal(conta(r.queue, 'd'), 0);
  assert.equal(r.queue.length, 10);
});
test('Le quote sommano sempre al totale', () => {
  for (const [k, p] of Object.entries(PRESETS)) assert.equal(p.gruppi.reduce((a, g) => a + g.n, 0), p.n, k);
  assert.deepEqual(ripartisci([20, 10], 50), [33, 17]);
});
test('Punteggi dei tre formati', () => {
  const lista = (r, w, b) => [...Array(r).fill('right'), ...Array(w).fill('wrong'), ...Array(b).fill('blank')];
  assert.deepEqual(calcolaPunteggio('ade', lista(34, 9, 7)), { right: 34, wrong: 9, blank: 7, score: 19.77, passed: true });
  assert.equal(calcolaPunteggio('ade', lista(30, 0, 20)).score, 18);
  assert.equal(calcolaPunteggio('ade', lista(30, 0, 20)).passed, true);
  assert.equal(calcolaPunteggio('ade', lista(30, 1, 19)).passed, false);
  assert.equal(calcolaPunteggio('ade', lista(50, 0, 0)).score, 30);
  assert.equal(calcolaPunteggio('asmel', lista(42, 18, 0)).score, 42);
  assert.equal(calcolaPunteggio('asmel', lista(42, 18, 0)).passed, true);
  assert.equal(calcolaPunteggio('breve', lista(12, 0, 8)).score, 7.2);
  assert.equal(calcolaPunteggio('breve', lista(12, 0, 8)).passed, true);
});

const ev = (id, at, c, g, d = 'x') => ({ id, t: 'v', at, c, d, g });
test('Intervalli come nel sorgente: 1, 3, 7, 14, 30, 60, 120', () => {
  let s, t = new Date('2026-11-02T10:00:00Z');
  const attesi = [3, 7, 14, 30, 60, 120, 120];
  for (const a of attesi) {
    s = applicaVoto(s, 2, t.toISOString());
    assert.equal(s.due, addDays(romeDate(t), a));
    t = new Date(`${s.due}T10:00:00Z`);
  }
  const sb = applicaVoto(s, 0, t.toISOString());
  assert.equal(sb.box, 0); assert.equal(sb.due, addDays(romeDate(t), 1)); assert.equal(sb.lapses, 1);
  const diff = applicaVoto({ box: 3, due: romeDate(t), reps: 1, lapses: 0 }, 1, t.toISOString());
  assert.equal(diff.box, 3); assert.equal(diff.due, addDays(romeDate(t), 1));
  assert.equal(prossimoRitorno({ box: 2, due: '2026-11-02' }, 2, '2026-11-02'), 14);
});
test('PC e telefono nello stesso giorno: stesso risultato, nessuna doppia promozione', () => {
  const tel = [ev('t1', '2026-11-02T08:00:00.000Z', 'a', 2), ev('t2', '2026-11-02T08:01:00.000Z', 'b', 0)];
  const pc = [ev('p1', '2026-11-02T18:00:00.000Z', 'a', 2), ev('p2', '2026-11-02T18:01:00.000Z', 'c', 2)];
  const x = ricostruisci(unisciEventi(tel, pc)), y = ricostruisci(unisciEventi(pc, tel));
  assert.deepEqual(x, y, 'ordine di unione irrilevante');
  assert.equal(x.progress.a.box, 1, 'la carta fatta su due dispositivi sale una volta sola');
  assert.equal(x.progress.a.reps, 2, 'ma entrambe le risposte restano contate');
  assert.equal(x.progress.b.box, 0);
  assert.equal(x.progress.c.box, 1);
});
test('Sbagliata su un dispositivo dopo giusta sull\'altro: conta l\'ultima in ordine di tempo', () => {
  const x = ricostruisci(unisciEventi([ev('t', '2026-11-02T08:00:00.000Z', 'a', 2)], [ev('p', '2026-11-02T09:00:00.000Z', 'a', 0)]));
  assert.equal(x.progress.a.box, 0);
  assert.equal(x.progress.a.lapses, 1);
});
test('Unione: copie doppie eliminate e file riletto uguale', () => {
  const a = ev('1', '2026-11-02T08:00:00.000Z', 'a', 2);
  assert.equal(unisciEventi([a], [a]).length, 1);
  assert.deepEqual(testoInEventi(eventiInTesto([a])), [a]);
  assert.deepEqual(testoInEventi('{"id":"1"}\nriga rotta\n'), [{ id: '1' }]);
  assert.equal(percorsoRegistro({ at: '2026-10-31T23:30:00.000Z' }, 'pc-1'), 'registro/2026-11/pc-1.jsonl', 'il mese segue l\'ora italiana');
});
test('Azzeramento di un mazzo: tocca solo quel mazzo e le risposte dopo restano', () => {
  const x = ricostruisci([ev('1', '2026-11-01T08:00:00Z', 'a', 2, 'A'), ev('2', '2026-11-01T08:00:00Z', 'b', 2, 'B'), { id: '3', t: 'a', at: '2026-11-02T08:00:00Z', deck: 'A' }, ev('4', '2026-11-02T09:00:00Z', 'c', 2, 'A')]);
  assert.equal(x.progress.a, undefined); assert.ok(x.progress.b); assert.ok(x.progress.c);
});
test('Mezzanotte italiana, non UTC', () => {
  assert.equal(romeDate(new Date('2026-11-02T23:30:00Z')), '2026-11-03');
  assert.equal(addDays('2026-03-28', 1), '2026-03-29');
  assert.equal(addDays('2026-03-29', 1), '2026-03-30');
});
test('Controllo del JSON delle carte', () => {
  const ok = validaCarte({ decks: [{ id: 'd', name: 'D' }], cards: [{ id: 'd-1', deck: 'd', kind: 'quiz', front: 'x', options: ['a', 'b'], answer: 1 }, { id: 'd-2', deck: 'd', kind: 'flash', front: 'x', back: 'y' }] });
  assert.deepEqual(ok.errori, []);
  const ko = validaCarte({ cards: [{ id: 'd 1', deck: 'z', kind: 'quiz', front: '', options: ['a'], answer: 4 }] });
  assert.ok(ko.errori.length >= 4);
  assert.equal(materiaKey("Ordinamento dell'Agenzia delle Entrate"), 'ordinamento');
  assert.equal(materiaKey('ASMEL'), 'asmelComuni');
});
const fl = (n, p, d = 'cf') => ({ id: `${d}-${n}`, deck: d, kind: 'flash', front: n, back: p, tags: ['numero-parola'] });
const qz = (n, p, d = 'cf') => ({ id: `${d}-q${n}`, deck: d, kind: 'quiz', front: `Che numero è "${p}"?`, options: ['14', n, '42', '40'], answer: 1, tags: ['parola-numero'] });
test('Scrivere: accenti e maiuscole non contano, le lettere sì', () => {
  assert.equal(normalizza('Tè'), normalizza('te'));
  assert.equal(normalizza(' Città '), 'citta');
  assert.equal(normalizza('falò'), normalizza('FALO'));
  assert.notEqual(normalizza('mucca'), normalizza('muca'));
  assert.equal(normalizza('37'), '37');
});
test('Scrivere: le coppie si ricavano solo dalle carte giuste', () => {
  assert.deepEqual(coppiaDaCarta(fl('41', 'ruota')), { numero: '41', parola: 'ruota', senso: 'np' });
  assert.deepEqual(coppiaDaCarta(qz('41', 'ruota')), { numero: '41', parola: 'ruota', senso: 'pn' });
  assert.equal(coppiaDaCarta({ kind: 'flash', front: '01 51', back: 'x', tags: ['storie'] }), null);
  assert.equal(coppiaDaCarta({ kind: 'quiz', front: 'x' }), null);
});
test('Scrivere: prima in scadenza, poi nuove, poi le altre; il senso filtra', () => {
  const carte = [fl('10', 'a'), fl('11', 'b'), fl('12', 'c'), qz('13', 'd')];
  const progress = { 'cf-10': { box: 2, due: '2026-12-01' }, 'cf-12': { box: 1, due: '2026-11-01' } };
  assert.deepEqual(scegliScrittura(carte, 'np', progress, '2026-11-06', 10).map((c) => c.id), ['cf-12', 'cf-11', 'cf-10']);
  assert.deepEqual(scegliScrittura(carte, 'pn', progress, '2026-11-06', 10).map((c) => c.id), ['cf-q13']);
  assert.equal(scegliScrittura(carte, 'misto', progress, '2026-11-06', 2).length, 2);
});
test('Scrivere: il voto dipende dal tempo solo se la barra è attiva', () => {
  assert.equal(votoScrittura(false, 100, true), 0);
  assert.equal(votoScrittura(true, 2500, true), 1);
  assert.equal(votoScrittura(true, 1500, true), 2);
  assert.equal(votoScrittura(true, 9000, false), 2);
});
test('Scrivere: rodaggio, più di 3 errori o esitazioni sommati nei due sensi', () => {
  const cards = { 'cf-37': fl('37', 'mucca'), 'cf-q37': qz('37', 'mucca'), 'cf-40': fl('40', 'razzo') };
  const v = (c, g, ms, k = 'scrivi') => ({ t: 'v', c, g, ms, k });
  const ev = [v('cf-37', 0), v('cf-q37', 0), v('cf-37', 2, 4000), v('cf-q37', 2, 1000), v('cf-40', 0), v('cf-40', 0), v('cf-40', 0)];
  assert.deepEqual(paroleDifficili(ev, cards), []);
  assert.deepEqual(paroleDifficili([...ev, v('cf-37', 0, 0, 'flash')], cards), [{ numero: '37', parola: 'mucca', volte: 4 }]);
});

// ---------- Rotta ----------
// Ore 12 italiane del giorno g: così il giorno non dipende dal fuso del computer che fa le prove.
const ora = (g, h = 12) => new Date(`${g}T${String(h - 1).padStart(2, '0')}:00:00Z`).toISOString();
let nid = 0;
const ses = (g, extra = {}) => ({ id: `s${nid++}`, t: 's', at: ora(g), kind: 'flash', total: 10, right: 8, answers: [{ c: 'da-fonti-001', ok: true }], ...extra });
const voti = (g, n, c = null) => Array.from({ length: n }, (_, i) => ({ id: `v${nid++}`, t: 'v', at: ora(g), c: c || `c${i}`, d: 'd', g: 2, k: 'flash' }));
const lez = (g, da, a, extra = {}) => ({ id: `l${nid++}`, t: 'l', at: ora(g), giorno: g, arg: 'L. 241/1990', ...(da ? { da, a } : {}), ...extra });

test('Rotta: lunedì e venti settimane fino alla domenica di questa settimana', () => {
  assert.equal(lunedi('2026-11-08'), '2026-11-02'); // domenica
  assert.equal(lunedi('2026-11-02'), '2026-11-02');
  const c = catena([], '2026-11-04');
  assert.equal(c.giorni.length, 140);
  assert.equal(c.giorni[0].giorno, addDays('2026-11-02', -133));
  assert.equal(c.giorni.at(-1).giorno, '2026-11-08');
  assert.ok(c.giorni.at(-1).futuro && !c.giorni.find((g) => g.giorno === '2026-11-04').futuro);
});
test('Rotta: chiaro con una sessione o 10 risposte, pieno con una lezione', () => {
  const ev = [ses('2026-11-02'), ...voti('2026-11-03', 10), ...voti('2026-11-04', 9), lez('2026-11-05')];
  const c = catena(ev, '2026-11-06'), liv = (g) => c.giorni.find((x) => x.giorno === g).livello;
  assert.deepEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'].map(liv), [1, 1, 0, 2, 0]);
});
test('Rotta: la serie resta viva fino a stasera, il record ricorda la corsa più lunga', () => {
  const ev = [ses('2026-10-01'), ses('2026-10-02'), ses('2026-10-03'), ses('2026-10-04'), ses('2026-11-06'), ses('2026-11-07')];
  let c = catena(ev, '2026-11-08');
  assert.equal(c.serie, 2, 'oggi ancora niente: conta da ieri');
  assert.equal(c.record, 4);
  c = catena([...ev, ses('2026-11-08')], '2026-11-08');
  assert.equal(c.serie, 3);
  c = catena(ev, '2026-11-09');
  assert.equal(c.serie, 0, 'saltato un giorno intero: la serie si rompe');
});
test('Rotta: il giorno si calcola in ora italiana', () => {
  // 22:30 UTC è lunedì alle 23:30 in Italia; 23:30 UTC è già martedì alle 00:30.
  const e = { id: 'z', t: 's', at: '2026-11-02T22:30:00Z', kind: 'flash', answers: [{ c: 'da-fonti-001', ok: true }] };
  assert.equal(catena([e], '2026-11-03').giorni.find((g) => g.giorno === '2026-11-02').livello, 1);
  assert.equal(catena([{ ...e, at: '2026-11-02T23:30:00Z' }], '2026-11-03').giorni.find((g) => g.giorno === '2026-11-03').livello, 1);
});
test('Rotta: regola dei due giorni', () => {
  assert.equal(regolaDueGiorni([], '2026-11-08'), null, 'nessuna storia: nessun richiamo');
  assert.equal(regolaDueGiorni([ses('2026-11-07')], '2026-11-08'), null);
  assert.equal(regolaDueGiorni([ses('2026-11-05')], '2026-11-08'), 'minimo');
  assert.equal(regolaDueGiorni([ses('2026-11-05'), ses('2026-11-08')], '2026-11-08'), 'salva');
});
test('Rotta: lezioni cancellate spariscono, il giorno della chat vale più dell\'ora di incollaggio', () => {
  const a = lez('2026-11-05', 1, 10), b = { ...lez('2026-11-04', 11, 20), at: ora('2026-11-07') };
  const lista = lezioni([a, b, { id: 'x1', t: 'lx', at: ora('2026-11-07'), ref: a.id }]);
  assert.deepEqual(lista.map((l) => l.giorno), ['2026-11-04']);
  assert.equal(catena([b], '2026-11-07').giorni.find((g) => g.giorno === '2026-11-04').livello, 2);
});
test('Rotta: avanzamento del manuale senza contare due volte le stesse pagine', () => {
  const r = avanzamentoManuale([{ da: 1, a: 20 }, { da: 15, a: 30 }, { da: 180, a: 190 }, { da: null, a: null }, { da: 300, a: 400 }]);
  assert.equal(r.tot, 306);
  assert.equal(r.lette, 30 + 11 + 7);
  assert.deepEqual(r.libri.map((b) => [b.lette, b.tot]), [[33, 182], [8, 34], [0, 28], [7, 62]]);
  assert.equal(MANUALE.libri.reduce((t, b) => t + b.a - b.da + 1, 0), 306);
});
test('Rotta: riepilogo della settimana da lunedì a domenica', () => {
  const ev = [ses('2026-11-01'), ...voti('2026-11-01', 5), ses('2026-11-02'), ...voti('2026-11-03', 12), lez('2026-11-04', 1, 5),
    ses('2026-10-20', { kind: 'sim', preset: 'ade', score: 18.5 }), ses('2026-11-05', { kind: 'sim', preset: 'ade', score: 21.1 })];
  const r = riepilogoSettimana(ev, '2026-11-08');
  assert.equal(r.da, '2026-11-02'); assert.equal(r.a, '2026-11-08');
  assert.equal(r.attivi, 4);
  assert.equal(r.lezioni, 1);
  assert.equal(r.carte, 12);
  assert.equal(r.risposte, 12);
  const stessa = riepilogoSettimana([...voti('2026-11-03', 5, 'uguale')], '2026-11-08');
  assert.deepEqual([stessa.carte, stessa.risposte], [1, 5], 'la stessa carta rifatta 5 volte conta una carta');
  assert.equal(r.ultimaSim.score, 21.1);
});
test('Rotta: conti alla rovescia con giorno, mese o data da fissare', () => {
  let s = scadenze([]);
  assert.deepEqual(s.map((x) => [x.chiave, x.data]), [['asmel', '2027-01'], ['ade335', null]]);
  assert.deepEqual(quantoManca('2027-01', '2026-11-08'), { giorni: 54, almeno: true });
  assert.deepEqual(quantoManca('2027-01-20', '2026-11-08'), { giorni: 73, almeno: false });
  assert.equal(quantoManca(null, '2026-11-08'), null);
  s = scadenze([{ id: 'a', t: 'sc', at: ora('2026-11-08', 9), chiave: 'ade335', data: '2027-03-15' }, { id: 'b', t: 'sc', at: ora('2026-11-08', 10), chiave: 'asmel', data: '2027-01-31' }, { id: 'c', t: 'sc', at: ora('2026-11-08', 11), chiave: 'asmel', data: 'gennaio' }]);
  assert.deepEqual(s.map((x) => x.data), ['2027-01-31', '2027-03-15'], 'una data scritta male non sovrascrive quella buona');
  s = scadenze([{ id: 'd', t: 'sc', at: ora('2026-11-09'), chiave: 'ade335', data: null }]);
  assert.equal(s[1].data, null); assert.equal(s[1].nota, 'Quando esce il bando');
});
test('Rotta: lezioni incollate da una chat, controllate e senza doppioni', () => {
  const at = ora('2026-11-08');
  const r = lezioniDaJson({ lezioni: [{ giorno: '2026-11-07', argomento: 'Responsabile del procedimento', da: 12, a: 20 }, { argomento: 'Ripasso generale' }, { argomento: 'x', da: 30, a: 10 }, { argomento: 'y', da: 5 }, { giorno: '2026-11-09', argomento: 'z' }, { argomento: '' }] }, '2026-11-08', at);
  assert.equal(r.trovate, 6);
  assert.equal(r.eventi.length, 2);
  assert.equal(r.errori.length, 4);
  assert.deepEqual([r.eventi[0].giorno, r.eventi[0].da, r.eventi[0].a, r.eventi[0].fonte], ['2026-11-07', 12, 20, 'chat']);
  assert.equal(r.eventi[1].giorno, '2026-11-08'); assert.ok(!('da' in r.eventi[1]));
  const di_nuovo = lezioniDaJson({ lezione: { giorno: '2026-11-07', argomento: 'Responsabile del procedimento', da: 12, a: 20 } }, '2026-11-08', ora('2026-11-09'));
  assert.equal(di_nuovo.eventi[0].id, r.eventi[0].id, 'stesso testo, stesso id');
  assert.equal(unisciEventi(r.eventi, di_nuovo.eventi).length, 2);
  assert.equal(lezioniDaJson({ decks: [], cards: [] }, '2026-11-08', at).trovate, 0);
});
test('Rotta: i nuovi eventi non toccano progressi e sessioni', () => {
  const ev = [lez('2026-11-04', 1, 5), { id: 'k', t: 'sc', at: ora('2026-11-04'), chiave: 'asmel', data: '2027-01-20' }, { id: 'q', t: 'lx', at: ora('2026-11-05'), ref: 'nessuna' }];
  const r = ricostruisci(ev);
  assert.deepEqual(r.progress, {}); assert.deepEqual(r.sessions, []);
});

// ---------- Due palestre ----------
test('Palestre: un mazzo è del codice se è "Metodo" o comincia con cf-', () => {
  assert.equal(palestraDi({ id: 'cf-parole-0', materia: 'Metodo' }), 'codice');
  assert.equal(palestraDi({ id: 'cf-nuovo', materia: 'Altro' }), 'codice');
  assert.equal(palestraDi({ id: 'met-x', materia: 'Metodo' }), 'codice');
  assert.equal(palestraDi({ id: 'da-fonti', materia: 'Diritto amministrativo' }), 'materie');
  assert.equal(palestraDi({ id: 'x' }), 'materie');
});
test('Rotta: un giorno di solo codice non conta, ma resta segnato', () => {
  const cod = (g, n) => Array.from({ length: n }, (_, i) => ({ id: `k${nid++}`, t: 'v', at: ora(g), c: `cf-parole-0-00${i}`, d: 'cf-parole-0', g: 2, k: 'scrivi' }));
  const ev = [
    ...cod('2026-11-02', 40), { id: 'sc1', t: 's', at: ora('2026-11-02'), kind: 'scrivi', answers: [{ c: 'cf-parole-0-001', ok: true }] },
    { id: 'fl1', t: 's', at: ora('2026-11-03'), kind: 'flash', answers: [{ c: 'cf-parole-1-001', ok: true }] },
    ...cod('2026-11-04', 5), ...voti('2026-11-04', 10),
    { id: 'mix', t: 's', at: ora('2026-11-05'), kind: 'flash', answers: [{ c: 'cf-parole-1-001', ok: true }, { c: 'da-fonti-002', ok: false }] },
  ];
  const c = catena(ev, '2026-11-05'), g = (x) => c.giorni.find((y) => y.giorno === x);
  assert.deepEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'].map((x) => g(x).livello), [0, 0, 1, 1]);
  assert.equal(g('2026-11-02').codice, 40, 'il codice si vede anche se non conta');
  assert.equal(g('2026-11-04').risposte, 10);
  assert.equal(c.serie, 2); assert.equal(c.record, 2);
  // Con l'elenco vero dei mazzi: un mazzo "Metodo" senza prefisso cf- è codice.
  const opz = { codice: (d) => d === 'met-x', mazzoDi: (id) => (id.startsWith('met-x') ? 'met-x' : id) };
  const c2 = catena([{ id: 'm1', t: 's', at: ora('2026-11-05'), kind: 'flash', answers: [{ c: 'met-x-001', ok: true }] }], '2026-11-05', 20, opz);
  assert.equal(c2.giorni.find((y) => y.giorno === '2026-11-05').livello, 0);
  assert.equal(regolaDueGiorni(cod('2026-11-04', 30), '2026-11-06'), null, 'solo codice nella storia: nessun richiamo');
  const r = riepilogoSettimana(ev, '2026-11-08');
  assert.equal(r.attivi, 2); assert.equal(r.risposte, 10, 'nel riepilogo contano solo le carte delle materie');
});
test('Codice: parole fissate, tempi e più lente', () => {
  const cards = {};
  const coppia = (n, parola) => {
    cards[`cf-${n}-np`] = { id: `cf-${n}-np`, deck: 'cf', kind: 'flash', front: n, back: parola, tags: ['numero-parola'] };
    cards[`cf-${n}-pn`] = { id: `cf-${n}-pn`, deck: 'cf', kind: 'quiz', front: `Che numero è "${parola}"?`, options: [n, '99', '98', '97'], answer: 0, tags: ['parola-numero'] };
  };
  coppia('01', 'Sid'); coppia('02', 'zanna'); coppia('13', 'Tom'); coppia('5', 'aglio');
  const sc = (c, g, ms, giorno, h = 12) => ({ id: `w${nid++}`, t: 'v', at: ora(giorno, h), c, d: 'cf', g, k: 'scrivi', ms });
  const ev = [
    sc('cf-01-np', 2, 900, '2026-11-08'), sc('cf-01-pn', 2, 1500, '2026-11-08'), // fissata
    sc('cf-02-np', 2, 900, '2026-11-08'), sc('cf-02-pn', 2, 2600, '2026-11-08'), // lenta in un senso: non fissata
    sc('cf-13-np', 2, 3000, '2026-11-07'), sc('cf-13-np', 2, 3400, '2026-11-08'), sc('cf-13-pn', 0, 1200, '2026-11-08'),
    sc('cf-5-np', 2, 800, '2026-10-01'), sc('cf-5-pn', 2, 800, '2026-10-01'), // fissata, fuori dalla settimana
    sc('cf-01-np', 0, 500, '2026-11-01'), // vecchia e sbagliata: conta l'ultima
  ];
  const r = statCodice(ev, cards, '2026-11-08');
  assert.equal(r.parole, 4); assert.equal(r.fissate, 2);
  assert.deepEqual([r.decine[0].tot, r.decine[0].fissate, r.decine[0].iniziata, r.decine[1].fissate, r.decine[2].iniziata], [2, 1, true, 0, false]);
  assert.equal(r.iniziate, 2);
  assert.equal(r.perGiorno.length, 7); assert.equal(r.perGiorno.at(-1).giorno, '2026-11-08');
  assert.equal(r.perGiorno.at(-1).ms, 1500, 'tempo tipico (mediana); le sbagliate non contano');
  assert.equal(r.perGiorno.at(-2).ms, 3000); assert.equal(r.perGiorno[0].ms, null);
  assert.equal(r.perSenso.pn, Math.round((1500 + 2600) / 2));
  const pausa = statCodice([...ev, sc('cf-01-np', 2, 30000, '2026-11-08', 13)], cards, '2026-11-08');
  assert.ok(pausa.medioMs < 3000, 'una pausa di 30 secondi non falsa il tempo tipico');
  assert.ok(!pausa.lente.some((x) => x.numero === '02'), 'una parola lenta una volta sola non è tra le più lente');
  assert.deepEqual(r.lente.map((x) => [x.numero, x.parola, x.ms]), [['13', 'Tom', 3200]]);
});

test('ordineOpzioni: permutazione valida, ferma nella sessione, diversa tra sessioni', () => {
  const a = ordineOpzioni('ade-natura-001', 1000, 3);
  assert.deepEqual([...a].sort(), [0, 1, 2]);
  assert.deepEqual(ordineOpzioni('ade-natura-001', 1000, 3), a);
  const visti = new Set();
  for (let s = 0; s < 60; s++) visti.add(ordineOpzioni('ade-natura-001', s, 3).join(''));
  assert.ok(visti.size >= 5, `ordini diversi: ${visti.size}`);
  const primi = [0, 0, 0];
  for (let s = 0; s < 3000; s++) primi[ordineOpzioni('x', s, 3)[0]]++;
  for (const n of primi) assert.ok(n > 800 && n < 1200, `distribuzione: ${primi}`);
  assert.deepEqual(ordineOpzioni('y', 1, 0), []);
});
