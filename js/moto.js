// Movimento e vibrazioni. Nessun dato passa da qui: se un'animazione fallisce, l'app continua a funzionare.

export const fermo = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- vibrazioni ----------
// iPhone non ha un comando per vibrare dal web: il tocco di un interruttore di sistema produce
// un piccolo colpo (iOS 18 e successivi). Altrove si usa navigator.vibrate, se c'è.
let attive = true;
export const impostaVibrazioni = (v) => { attive = v; };
function colpoIos() {
  const label = document.createElement('label');
  label.setAttribute('aria-hidden', 'true');
  label.style.display = 'none';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  label.appendChild(input);
  document.head.appendChild(label);
  label.click();
  label.remove();
}
function colpo(schema) {
  if (!attive) return;
  try {
    if (typeof navigator.vibrate === 'function') { navigator.vibrate(schema.map((x, i) => (i % 2 ? x : 10))); return; }
    schema.forEach((_, i) => { if (i % 2 === 0) setTimeout(colpoIos, schema.slice(0, i).reduce((a, b) => a + b, 0)); });
  } catch { /* la vibrazione è un di più */ }
}
export const vibra = {
  tocco: () => colpo([0]),
  ok: () => colpo([0, 90, 0]),
  no: () => colpo([0, 70, 0, 70, 0]),
};

// ---------- effetti puntuali ----------
export async function uscita(selettore, classe, ms, app) {
  const el = document.querySelector(selettore);
  if (!el || fermo()) return;
  app.style.pointerEvents = 'none';
  el.classList.add(classe);
  await pausa(ms);
  app.style.pointerEvents = '';
}
export function rimbalzo(el, da = 0.93) {
  if (!el || fermo() || !el.animate) return;
  el.animate([{ scale: da }, { scale: 1.04, offset: 0.55 }, { scale: 1 }], { duration: 320, easing: 'cubic-bezier(.3,.7,.3,1)' });
}
// Il numero sale fino al valore finale. Il testo giusto è già nella pagina: questo è solo l'ingresso.
export function contaFino(el, testo) {
  if (!el || fermo()) return;
  const fine = Number(el.dataset.conta), dec = Number(el.dataset.dec || 0), t0 = performance.now(), dur = 850;
  const scrivi = (v) => { el.textContent = v.toFixed(dec).replace('.', ','); };
  const passo = (t) => {
    if (!el.isConnected) return;
    const k = Math.min(1, (t - t0) / dur);
    scrivi(fine * (1 - (1 - k) ** 3));
    if (k < 1) requestAnimationFrame(passo); else el.textContent = testo;
  };
  scrivi(0);
  requestAnimationFrame(passo);
}

// ---------- barra in basso: una goccia elastica che segue il dito ----------
const K = 240, C = 21; // molla: elastica, con un piccolo rimbalzo
export class BarraLiquida {
  constructor(nav, voci, suScelta) {
    this.nav = nav; this.voci = voci; this.suScelta = suScelta;
    this.corrente = -1; this.x = 0; this.v = 0; this.bersaglio = 0; this.premuta = 0; this.spinta = 0;
    this.dito = null; this.corsa = false; this.ultimoT = 0; this.vicina = -1; this.sopprimi = false;
    nav.innerHTML = `<span class="goccia" aria-hidden="true"></span>${voci.map(([k, t, svg]) => `<a href="#${k}" data-k="${k}">${svg}<span>${t}</span></a>`).join('')}`;
    this.goccia = nav.querySelector('.goccia');
    this.link = [...nav.querySelectorAll('a')];
    nav.addEventListener('pointerdown', (e) => this.giu(e));
    nav.addEventListener('pointermove', (e) => this.muovi(e));
    nav.addEventListener('pointerup', (e) => this.su(e));
    nav.addEventListener('pointercancel', () => this.annulla());
    nav.addEventListener('click', (e) => { if (this.sopprimi) { e.preventDefault(); this.sopprimi = false; } });
    nav.addEventListener('dragstart', (e) => e.preventDefault());
    addEventListener('resize', () => { this.misura(); this.salta(); });
  }
  misura() {
    const r = this.link[0]?.getBoundingClientRect();
    if (!r || !r.width) return;
    this.w = r.width; this.gap = this.link[1].getBoundingClientRect().left - r.left;
    this.sx = this.nav.getBoundingClientRect().left + this.nav.clientLeft + (this.nav.clientWidth - this.gap * (this.voci.length - 1) - this.w) / 2;
    this.goccia.style.width = `${this.w}px`;
    this.goccia.style.height = `${r.height}px`;
  }
  xDi(i) { return i * (this.gap || 0); }
  salta() { this.x = this.bersaglio = this.xDi(Math.max(0, this.corrente)); this.v = 0; this.disegna(); }
  // Chiamata a ogni cambio di schermata.
  imposta(nome, visibile) {
    const nav = this.nav;
    nav.classList.toggle('fuori', !visibile);
    nav.toggleAttribute('inert', !visibile);
    const i = this.voci.findIndex(([k]) => k === nome);
    if (!visibile || i < 0) return;
    this.link.forEach((a, j) => { if (j === i) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    const prima = this.corrente < 0;
    this.corrente = i;
    if (!this.w) this.misura();
    if (prima || fermo()) { this.salta(); return; }
    if (!this.dito) { this.bersaglio = this.xDi(i); this.avvia(); }
  }
  giu(e) {
    if (e.button) return;
    this.misura();
    this.dito = { id: e.pointerId, x0: e.clientX, mosso: false };
    this.spinta = 1; this.vicina = this.corrente; this.avvia();
    try { this.nav.setPointerCapture(e.pointerId); } catch { /* non indispensabile */ }
  }
  aCursore(cx) { return Math.max(0, Math.min(this.xDi(this.voci.length - 1), cx - this.sx - this.w / 2)); }
  piuVicina(x) { return Math.max(0, Math.min(this.voci.length - 1, Math.round(x / this.gap))); }
  muovi(e) {
    const d = this.dito;
    if (!d || e.pointerId !== d.id) return;
    if (!d.mosso && Math.abs(e.clientX - d.x0) < 6) return;
    d.mosso = true;
    this.bersaglio = this.aCursore(e.clientX);
    const n = this.piuVicina(this.bersaglio);
    if (n !== this.vicina) { this.vicina = n; vibra.tocco(); }
    this.avvia();
  }
  su(e) {
    const d = this.dito;
    if (!d || e.pointerId !== d.id) return;
    this.dito = null; this.spinta = 0; this.sopprimi = true;
    setTimeout(() => { this.sopprimi = false; }, 400);
    const i = this.piuVicina(d.mosso ? this.bersaglio : this.aCursore(e.clientX));
    this.bersaglio = this.xDi(i);
    this.avvia();
    vibra.tocco();
    this.suScelta(this.voci[i][0], i !== this.corrente);
  }
  annulla() { this.dito = null; this.spinta = 0; this.bersaglio = this.xDi(this.corrente); this.avvia(); }
  avvia() {
    if (this.corsa) return;
    this.corsa = true; this.ultimoT = performance.now();
    requestAnimationFrame((t) => this.fotogramma(t));
  }
  fotogramma(t) {
    const dt = Math.min(0.032, (t - this.ultimoT) / 1000 || 0.016);
    this.ultimoT = t;
    // Col dito sopra la goccia segue più da vicino; lasciata, rimbalza in posizione.
    const k = this.dito?.mosso ? 900 : K, c = this.dito?.mosso ? 52 : C;
    this.v += (-k * (this.x - this.bersaglio) - c * this.v) * dt;
    this.x += this.v * dt;
    this.premuta += (this.spinta - this.premuta) * Math.min(1, dt * 16);
    this.disegna();
    const ferma = Math.abs(this.x - this.bersaglio) < 0.2 && Math.abs(this.v) < 3 && Math.abs(this.spinta - this.premuta) < 0.01 && !this.dito;
    if (ferma) { this.x = this.bersaglio; this.v = 0; this.premuta = this.spinta; this.disegna(); this.corsa = false; return; }
    requestAnimationFrame((n) => this.fotogramma(n));
  }
  disegna() {
    // Più corre, più si allunga e si schiaccia: è questo a darle l'aspetto di una goccia.
    const a = Math.min(Math.abs(this.v) / 1500, 0.34);
    const sx = 1 + a + this.premuta * 0.08, sy = 1 - a * 0.42 + this.premuta * 0.1;
    this.goccia.style.transform = `translate3d(${this.x.toFixed(2)}px,0,0) scale(${sx.toFixed(3)},${sy.toFixed(3)})`;
    this.goccia.style.setProperty('--luce', `${(a * 60 + this.premuta * 18).toFixed(0)}%`);
    if (!this.gap) return;
    this.link.forEach((l, i) => {
      const p = Math.max(0, 1 - Math.abs(this.x - this.xDi(i)) / this.gap);
      l.style.setProperty('--p', p.toFixed(3));
    });
  }
}
