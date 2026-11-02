# Palestra Quiz

App personale per allenarsi ai concorsi: ripasso a intervalli, quiz con correzione, simulazione a tempo. Si installa su iPhone e funziona anche senza rete.

Questo repository contiene **solo il codice**. Carte, progressi e sessioni stanno in un repository privato separato. Il token di accesso si inserisce nell'app, su ogni dispositivo, e resta su quel dispositivo: non va mai scritto qui.

## Installarla su iPhone
1. Apri il link dell'app con Safari.
2. Tocca Condividi, poi "Aggiungi alla schermata Home".
3. Apri l'app dall'icona, vai in Gestione, inserisci repository privato e token.

## Come funzionano i dati
- Ogni dispositivo scrive solo nel proprio file `registro/<anno-mese>/<dispositivo>.jsonl`.
- Ogni risposta è una riga che non si cancella mai. I progressi si ricalcolano rileggendo tutte le righe in ordine di tempo.
- Per questo PC e telefono possono lavorare nello stesso giorno, anche offline, senza conflitti e senza perdere nulla.

## Prove
```
npm test
GLOBAL_NODE_MODULES=$(npm root -g) node test/e2e.mjs /percorso/screenshot
```
La prova completa usa Playwright, un PC e un iPhone simulati e un GitHub finto. Nessun dato vero.

## Licenze
Font Manrope: SIL Open Font License, vedi `fonts/LICENSE-Manrope.txt`.
