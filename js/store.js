// Memoria sul dispositivo (IndexedDB) e sincronizzazione con il repository privato.
import { eventiInTesto, percorsoRegistro, testoInEventi, unisciEventi } from './core.js';

// ---------- memoria locale ----------
const DB = 'palestra-quiz', STORE = 'kv';
let dbp;
const apri = () => (dbp ||= new Promise((res, rej) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(STORE);
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
}));
export async function kvGet(k, d = null) {
  const db = await apri();
  return new Promise((res, rej) => {
    const q = db.transaction(STORE).objectStore(STORE).get(k);
    q.onsuccess = () => res(q.result === undefined ? d : q.result);
    q.onerror = () => rej(q.error);
  });
}
export async function kvSet(k, v) {
  const db = await apri();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, 'readwrite');
    t.objectStore(STORE).put(v, k);
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  });
}
export async function kvDel(k) {
  const db = await apri();
  return new Promise((res) => { const t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).delete(k); t.oncomplete = () => res(); });
}

// ---------- base64 con accenti ----------
export const aB64 = (testo) => {
  const b = new TextEncoder().encode(testo);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
};
export const daB64 = (b64) => {
  const s = atob(String(b64).replace(/\s/g, ''));
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return new TextDecoder().decode(b);
};

// ---------- errori comprensibili ----------
export class ErroreSync extends Error {
  constructor(tipo, msg) { super(msg); this.tipo = tipo; }
}
function spiega(status, path) {
  if (status === 401) return new ErroreSync('token', 'Il token non è valido o è scaduto.');
  if (status === 403) return new ErroreSync('permessi', 'Il token non ha il permesso di scrivere in questo repository, oppure GitHub ha limitato le richieste.');
  if (status === 404) return new ErroreSync('repo', 'Repository non trovato: controlla il nome, oppure il token non ha accesso a questo repository.');
  return new ErroreSync('rete', `GitHub ha risposto ${status} per ${path}.`);
}

// ---------- GitHub ----------
const API = 'https://api.github.com';
export class Github {
  constructor({ repo, token }) { this.repo = repo; this.token = token; this.branch = 'main'; }
  async req(path, { method = 'GET', body, headers = {} } = {}) {
    let r;
    try {
      r = await fetch(`${API}${path}`, {
        method, cache: 'no-store',
        headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch { throw new ErroreSync('rete', 'Nessuna connessione con GitHub.'); }
    return r;
  }
  async verifica() {
    const r = await this.req(`/repos/${this.repo}`);
    if (!r.ok) throw spiega(r.status, 'il repository');
    const j = await r.json();
    this.branch = j.default_branch || 'main';
    return j;
  }
  async albero(etag) {
    const r = await this.req(`/repos/${this.repo}/git/trees/${encodeURIComponent(this.branch)}?recursive=1`, { headers: etag ? { 'If-None-Match': etag } : {} });
    if (r.status === 304) return { invariato: true, etag };
    if (r.status === 409 || r.status === 404) return { voci: [], etag: null }; // repository ancora vuoto
    if (!r.ok) throw spiega(r.status, "l'elenco dei file");
    const j = await r.json();
    return { voci: (j.tree || []).filter((v) => v.type === 'blob').map((v) => ({ path: v.path, sha: v.sha })), etag: r.headers.get('ETag') };
  }
  async blob(sha) {
    const r = await this.req(`/repos/${this.repo}/git/blobs/${sha}`);
    if (!r.ok) throw spiega(r.status, 'un file');
    return daB64((await r.json()).content);
  }
  async leggi(path) {
    const r = await this.req(`/repos/${this.repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(this.branch)}`);
    if (r.status === 404) return null;
    if (!r.ok) throw spiega(r.status, path);
    const j = await r.json();
    return { sha: j.sha, testo: j.content ? daB64(j.content) : await this.blob(j.sha) };
  }
  // Ritorna il nuovo sha, oppure null se qualcun altro ha scritto nel frattempo (si riprova).
  async scrivi(path, testo, sha, messaggio) {
    const r = await this.req(`/repos/${this.repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'PUT',
      body: { message: messaggio, content: aB64(testo), branch: this.branch, ...(sha ? { sha } : {}) },
    });
    if (r.status === 409 || r.status === 422) return null;
    if (!r.ok) throw spiega(r.status, path);
    return (await r.json()).content.sha;
  }
  async cancella(path, sha, messaggio) {
    const r = await this.req(`/repos/${this.repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'DELETE', body: { message: messaggio, sha, branch: this.branch },
    });
    if (r.status === 409 || r.status === 422) return false;
    if (!r.ok && r.status !== 404) throw spiega(r.status, path);
    return true;
  }
}

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- archivio: unisce file del repository e risposte ancora da inviare ----------
export class Archivio {
  constructor() {
    this.cfg = null; this.device = null; this.files = {}; this.pending = []; this.etag = null;
    this.gh = null; this.inCorso = null;
    this.stato = { fase: 'mai', quando: null, errore: null, tipoErrore: null };
    this.onChange = () => {};
  }
  async carica() {
    this.cfg = await kvGet('cfg');
    this.device = await kvGet('device');
    if (!this.device) {
      this.device = /iPhone|iPad|Android/i.test(navigator.userAgent) ? 'telefono-' : 'pc-';
      this.device += crypto.randomUUID().slice(0, 8);
      await kvSet('device', this.device);
    }
    this.files = (await kvGet('files')) || {};
    this.pending = (await kvGet('pending')) || [];
    this.etag = await kvGet('etag');
    this.stato.quando = await kvGet('ultimaSync');
    if (this.cfg?.token && this.cfg?.repo) this.gh = new Github(this.cfg);
  }
  collegato() { return !!this.gh; }
  async collega(repo, token) {
    const gh = new Github({ repo, token });
    await gh.verifica();
    const cambiato = this.cfg?.repo !== repo;
    this.cfg = { repo, token };
    this.gh = gh;
    await kvSet('cfg', this.cfg);
    if (cambiato) { this.files = {}; this.etag = null; await kvSet('files', {}); await kvDel('etag'); }
  }
  async scollega() { this.cfg = null; this.gh = null; await kvDel('cfg'); this.stato.fase = 'mai'; }

  // Tutti gli eventi noti: quelli nel repository più quelli non ancora inviati.
  eventi() {
    const daFile = Object.entries(this.files).filter(([p]) => p.startsWith('registro/')).map(([, f]) => testoInEventi(f.testo));
    return unisciEventi(...daFile, this.pending);
  }
  // Mazzi e carte: ogni file in carte/ ha la forma {decks:[], cards:[]}.
  contenuti() {
    const decks = {}, cards = {};
    for (const [p, f] of Object.entries(this.files).sort(([a], [b]) => (a < b ? -1 : 1))) {
      if (!p.startsWith('carte/') || !p.endsWith('.json')) continue;
      try {
        const j = JSON.parse(f.testo);
        for (const d of j.decks || []) decks[d.id] = d;
        for (const c of j.cards || []) cards[c.id] = c;
      } catch { this.fileRovinati = (this.fileRovinati || new Set()).add(p); }
    }
    return { decks, cards };
  }
  // Un evento è salvato sul dispositivo PRIMA che lo schermo vada avanti.
  async aggiungi(ev) {
    const nuovi = Array.isArray(ev) ? ev : [ev];
    this.pending.push(...nuovi);
    await kvSet('pending', this.pending);
  }
  nuovoId() { return `${this.device}-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 6)}`; }

  sincronizza() {
    if (!this.gh) return Promise.resolve(false);
    if (navigator.onLine === false) { this.stato.fase = 'offline'; this.onChange(false); return Promise.resolve(false); }
    // Un solo giro alla volta. Se altre schede sono aperte, navigator.locks le mette in fila.
    if (this.inCorso) return this.inCorso;
    const giro = () => this._giro();
    const run = navigator.locks ? navigator.locks.request('palestra-sync', giro) : giro();
    this.inCorso = run.finally(() => { this.inCorso = null; });
    return this.inCorso;
  }

  async _giro() {
    this.stato.fase = 'in-corso'; this.stato.errore = null; this.stato.tipoErrore = null; this.onChange();
    try {
      await this.gh.verifica();
      let cambiato = await this._scarica();
      if (await this._invia()) cambiato = await this._scarica(true) || true;
      this.stato.fase = 'ok';
      this.stato.quando = new Date().toISOString();
      await kvSet('ultimaSync', this.stato.quando);
      this.onChange(cambiato);
      return true;
    } catch (e) {
      this.stato.fase = 'errore';
      this.stato.errore = e.message || 'Errore sconosciuto.';
      this.stato.tipoErrore = e.tipo || 'rete';
      this.onChange(false);
      return false;
    }
  }

  async _scarica(forza = false) {
    const a = await this.gh.albero(forza ? null : this.etag);
    if (a.invariato) return false;
    let cambiato = false;
    const presenti = new Set();
    for (const v of a.voci) {
      if (!/^(carte|registro)\//.test(v.path)) continue;
      presenti.add(v.path);
      if (this.files[v.path]?.sha === v.sha) continue;
      let testo = await this.gh.blob(v.sha);
      // GitHub può mostrare per un attimo una copia vecchia: per il registro si unisce, mai si sostituisce.
      if (v.path.startsWith('registro/') && this.files[v.path]) {
        testo = eventiInTesto(unisciEventi(testoInEventi(this.files[v.path].testo), testoInEventi(testo)));
      }
      this.files[v.path] = { sha: v.sha, testo };
      cambiato = true;
    }
    // Solo le carte si possono davvero cancellare; il registro non si toglie mai.
    for (const p of Object.keys(this.files)) if (p.startsWith('carte/') && !presenti.has(p)) { delete this.files[p]; cambiato = true; }
    this.etag = a.etag;
    await kvSet('files', this.files);
    if (a.etag) await kvSet('etag', a.etag); else await kvDel('etag');
    return cambiato;
  }

  // Invia le risposte in attesa nel file di QUESTO dispositivo: nessun altro ci scrive.
  async _invia() {
    if (!this.pending.length) return false;
    const perFile = new Map();
    for (const e of this.pending) {
      const p = percorsoRegistro(e, this.device);
      if (!perFile.has(p)) perFile.set(p, []);
      perFile.get(p).push(e);
    }
    for (const [path, nuovi] of perFile) {
      let sha = this.files[path]?.sha, testoRemoto = this.files[path]?.testo || '';
      for (let tentativo = 0; ; tentativo++) {
        const unione = eventiInTesto(unisciEventi(testoInEventi(testoRemoto), nuovi));
        const nuovoSha = testoRemoto === unione ? sha : await this.gh.scrivi(path, unione, sha, `Registro ${this.device}: ${nuovi.length} risposte`);
        if (nuovoSha) {
          this.files[path] = { sha: nuovoSha, testo: unione };
          const inviati = new Set(nuovi.map((e) => e.id));
          this.pending = this.pending.filter((e) => !inviati.has(e.id));
          // Prima il file, poi la coda: se l'app si chiude qui, al massimo si reinvia una copia già unita.
          await kvSet('files', this.files);
          await kvSet('pending', this.pending);
          break;
        }
        if (tentativo >= 5) throw new ErroreSync('rete', 'GitHub è occupato: riprovo più tardi. Le risposte restano salvate qui.');
        await pausa(300 * (tentativo + 1));
        const att = await this.gh.leggi(path);
        sha = att?.sha; testoRemoto = att?.testo || '';
      }
    }
    return true;
  }

  // ---------- carte: un file per mazzo, carte/<id mazzo>.json ----------
  async scriviMazzo(deck, cards) {
    if (!this.gh) throw new ErroreSync('repo', 'Prima collega il repository.');
    const path = `carte/${deck.id}.json`;
    const testo = JSON.stringify({ decks: [deck], cards }, null, 1) + '\n';
    for (let t = 0; t < 5; t++) {
      const att = await this.gh.leggi(path);
      const sha = await this.gh.scrivi(path, testo, att?.sha, `Carte: ${deck.name}`);
      if (sha) { this.files[path] = { sha, testo }; await kvSet('files', this.files); return; }
      await pausa(300 * (t + 1));
    }
    throw new ErroreSync('rete', 'GitHub è occupato: riprova tra poco.');
  }
  // Toglie un mazzo da ogni file che lo contiene.
  async cancellaMazzo(id) {
    if (!this.gh) throw new ErroreSync('repo', 'Prima collega il repository.');
    let n = 0;
    for (const [path, f] of Object.entries(this.files)) {
      if (!path.startsWith('carte/')) continue;
      let j; try { j = JSON.parse(f.testo); } catch { continue; }
      const carte = (j.cards || []).filter((c) => c.deck !== id), mazzi = (j.decks || []).filter((d) => d.id !== id);
      n += (j.cards || []).length - carte.length;
      if (carte.length === (j.cards || []).length && mazzi.length === (j.decks || []).length) continue;
      if (!carte.length && !mazzi.length) { await this.gh.cancella(path, f.sha, `Elimina mazzo ${id}`); delete this.files[path]; }
      else {
        const testo = JSON.stringify({ decks: mazzi, cards: carte }, null, 1) + '\n';
        const sha = await this.gh.scrivi(path, testo, f.sha, `Elimina mazzo ${id}`);
        if (!sha) throw new ErroreSync('rete', 'Il file è cambiato nel frattempo: sincronizza e riprova.');
        this.files[path] = { sha, testo };
      }
    }
    await kvSet('files', this.files);
    return n;
  }
}
