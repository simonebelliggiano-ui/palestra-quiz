// Prove della logica: node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRESETS, preparaSimulazione, calcolaPunteggio, ricostruisci, unisciEventi, applicaVoto, romeDate, addDays,
  ripartisci, validaCarte, eventiInTesto, testoInEventi, percorsoRegistro, materiaKey, prossimoRitorno,
  normalizza, coppiaDaCarta, scegliScrittura, votoScrittura, paroleDifficili,
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
