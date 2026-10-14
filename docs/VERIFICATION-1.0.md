# Verifiche della candidata 1.0 — primo settore Brembilla

Data: 14 ottobre 2026. Ramo `feat/v1-brembilla-sector`, base 0.2 `f7f384d`. Questo incremento non è pubblicato e non sostituisce l'anteprima 0.2.

## Risultati verificati localmente

- `npm test`: **39/39 superati**, inclusi i test originali e 9 casi del settore reale / Tranquillo.
- `npm run build`: typecheck TypeScript e build Vite superati.
- `npm run package:playtest`: superato, con dati geografici e licenze compresi nel pacchetto statico.
- Test browser mirato «two thumbs keep forward, steering and latched BOOST together; cancel, brake and blur reset it»: **superato**, Chromium touch 812 × 375, contatti nativi iniettati tramite CDP. Verifica anche velocità oltre 78 km/h con entrambi gli stick attivi. Non è una misura FPS.
- Il difetto trovato era nella sequenza del test: `touchEnd` deve indicare il contatto da sollevare. Rilasciare il contatto sinistro, come faceva il test precedente, disattiva intenzionalmente BOOST.
- `git diff --check`: superato.

Ambiente: Linux, Node 24.19.0, Playwright 1.58.2, Chromium headless 153 disponibile nel runtime, SwiftShader. Il binario locale del browser era stato trovato troncato dopo la ripresa; è stato ripristinato dal pacchetto già presente prima di ripetere la prova. Questo problema dell'ambiente non è stato aggirato modificando il gioco.

## Matrice completa

**Suite locale completa Chromium desktop/touch: 21 prove superate, 7 esclusioni previste, zero fallimenti, zero test flaky.** Report Playwright: 28 casi totali, `ok: true`.

| Gruppo | Superati | Esclusi per profilo |
| --- | ---: | ---: |
| Replay intero percorso demo e Brembilla | 2 | 2 |
| Avvio, input, collisioni, errori, storage | 7 | 3 |
| Responsive, gamepad e audio della 0.2 | 5 | 1 |
| Settore reale, BOOST, dati mancanti, recupero WebGL | 7 | 1 |

I replay completano tutti gli 8 checkpoint tramite input standard, senza teletrasportare il drone; usano un clock accelerato che non misura prestazioni hardware. Le esclusioni separano i controlli desktop e quelli touch: non sono fallimenti nascosti.

GitHub Actions deve ancora verificare installazione pulita e l’intera matrice, inclusa WebKit. I risultati verranno aggiornati dopo il completamento; gli stati non conclusi non sono considerati superati.

CI conserva tutti i controlli della 0.2: un job build e tre job browser indipendenti. Limite 15 minuti per job, 11 per i test; un worker per profilo e nessun fail-fast fra browser. Il pacchetto finale viene allegato solo dopo il successo dei tre profili. Nessun workflow Pages viene avviato.

## Limiti

Non sono stati provati fisicamente iPhone/Safari iOS, Android, iPad, Windows/macOS, TV o un DualSense. WebKit Linux non equivale a Safari su iPhone. Non sono dichiarati FPS, latenza, temperatura o autonomia reali.

Rimane l'avviso di build per il chunk Three.js di circa 575 kB minificati / 145 kB gzip. Il settore geografico e il caricamento richiedono ancora una prova prolungata su rete mobile e hardware modesto. Verifica visiva locale, ponti e architetture caratteristiche restano aperti; vedere [PROGRESS.md](PROGRESS.md) e [GEOGRAPHY-1.0.md](GEOGRAPHY-1.0.md).
