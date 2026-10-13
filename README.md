# BREMBO FLIGHT

Un drone, otto anelli e una valle alpina da esplorare. Prima demo giocabile in **Three.js, TypeScript e Vite**, pensata per PC e iPhone, gratuita e open source.

**Il terreno è interamente dimostrativo. Non rappresenta la Val Brembana reale.** Non usare questa demo per navigazione, addestramento o pianificazione di voli reali.

## Cosa contiene

- Valle 3D procedurale con montagne, fiume, boschi e piazzola; tutti gli elementi sono generati dal codice.
- Drone con volo assistito: accelerazione graduale, inerzia, arresto automatico al rilascio dei comandi, boost e freno.
- Telecamera esterna e FPV, mappa, quota **dal suolo/acqua**, velocità, direzione e indicatore del prossimo anello.
- Otto checkpoint sequenziali, cronometro, completamento e miglior tempo locale.
- Collisioni con terreno, acqua, alberi (volumi semplificati) e bordo dell'anello attivo. Recupero davanti all'anello successivo con penalità di 5 secondi.
- Due joystick touch simultanei, pausa quando si cambia scheda/finestra, preset grafico Eco/Alta.
- Audio sintetizzato facoltativo, attivato esclusivamente da un gesto dell'utente.
- Nessun account, pagamento, API key, analytics, pubblicità, asset remoto o backend. Il primo caricamento richiede Internet quando il gioco è ospitato online. Non è una PWA offline.

## Avvio locale

Richiede **Node.js 22.12+**; Node.js 24 è utilizzato dalla CI. Le versioni delle dipendenze sono bloccate in `package-lock.json`.

```sh
npm ci
npm run dev
```

Apri `http://localhost:5173/Brembo-flight/`.

Per provare dal telefono nella stessa rete Wi-Fi, usa l'indirizzo LAN del computer mostrato da Vite, con il percorso `/Brembo-flight/`. Questo passaggio è facoltativo: la versione pubblicata funziona direttamente tramite un link HTTPS.

```sh
npm run build
npm run preview
```

La build è in `dist/`; anteprima in `http://localhost:4173/Brembo-flight/`. Aprire `index.html` direttamente come `file://` non avvia il gioco.

## Comandi

| Azione | PC | Touch |
| --- | --- | --- |
| Avanti / indietro / laterale | W A S D oppure frecce | Joystick sinistro |
| Sali / scendi | R / F | Joystick destro su / giù |
| Ruota a sinistra / destra | Q / E | Joystick destro sinistra / destra |
| Frena | Spazio | Tieni FRENO |
| Boost | Shift | Tieni BOOST |
| Telecamera | C | Pulsante telecamera |
| Pausa / riprendi | P oppure Esc | Pulsante pausa |
| Recupera al prossimo anello (+5 s) | X | Dopo un urto: Ritorna in volo |
| Guida e qualità grafica | H | Pulsante ? |

La freccia della mappa indica il drone. Attraversa l'anello **arancione** dal lato del checkpoint precedente. Il primo è dritto davanti a te: basta avanzare. Rilascia i joystick per stabilizzare il volo. Il recupero aggiunge 5 secondi; ricominciare azzera la partita.

Su iPhone è consigliata la modalità orizzontale e la qualità **Eco** (predefinita sui dispositivi touch). È richiesto **WebGL 2**. Schermo intero viene mostrato solo dove supportato; in Safari su iPhone non è necessario. Il tempo si ferma quando il gioco va in pausa. Il record dipende dallo storage del browser e può sparire se vengono cancellati i dati del sito.

## Verifiche

```sh
npm test                          # simulazione e terreno, nessun browser richiesto
npm run build                    # TypeScript rigoroso + build produzione
npx playwright install --with-deps chromium webkit
npm run test:e2e                  # build già generata, browser automatizzati
npm run check                    # tutta la sequenza
```

La suite della simulazione verifica stabilità a frame rate diversi, freno, boost, limite mappa/quota, terreno coerente con la mesh, collisioni, ripartenza, attraversamenti veloci, ordine e completamento di tutti gli otto anelli con comandi di volo.

I test browser usano la **build di produzione nel sottopercorso di GitHub Pages**, verificano avvio, telecamera, pausa, tastiera, collisione/ripresa, eventi dei joystick, layout verticale/orizzontale, storage bloccato e fallback WebGL. L'emulazione WebKit non equivale a una prova su un iPhone fisico. Il resoconto delle verifiche effettivamente eseguite è in [`docs/VERIFICATION.md`](docs/VERIFICATION.md).

## Pubblicare su GitHub Pages

La pubblicazione è predisposta, non implicita nell'esistenza di questo README.

1. Nel repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Integra il ramo `feat/first-playable-demo` in `main`, per esempio tramite la pull request preparata.
3. Il workflow **Publish GitHub Pages** esegue test, build e prove browser, quindi pubblica `dist/`.
4. Controlla il workflow verde in **Actions** e apri l'URL riportato nel deployment.

URL previsto dopo una pubblicazione riuscita: **https://davideforci7-lgtm.github.io/Brembo-flight/**. Non considerarlo attivo finché il deployment non è stato verificato.

Il workflow di sola verifica gira anche sul ramo della demo e allega il pacchetto `brembo-flight-demo`. I permessi di pubblicazione sono limitati al job di deploy. Per hosting sotto un altro nome, aggiorna `base` in `vite.config.ts` e l'URL base dei test.

## Struttura e futura geografia reale

```text
src/core/terrain.ts   TerrainProvider, quote e ostacoli deterministici
src/core/flight.ts    Fisica a passi fissi da 1/120 s e stati della partita
src/core/course.ts    Percorso e attraversamento degli anelli
src/world.ts         Scena Three.js, drone, camera, rendering
src/input.ts         Tastiera, multitouch, rilascio/cancellazione input
src/ui.ts            HUD, minimappa, record locale
src/main.ts          Ciclo principale e interfaccia
tests/               Test unitari e browser
```

`TerrainProvider` è il punto d'ingresso per sostituire il terreno sintetico con un DEM autorizzato e correttamente attribuito. Attualmente il campionamento segue **gli stessi triangoli renderizzati**, evitando scostamenti tra grafica e collisioni. Le coordinate sono locali in metri: Y verso l'alto, −Z verso nord.

Per la Val Brembana serviranno: scegliere dati e licenze; trasformare coordinate geografiche in un sistema metrico locale; gestire origine e quota; usare tile/livelli di dettaglio; adattare fiume, vegetazione, percorso, collisioni e minimappa. Il renderer della demo usa una griglia regolare e non è ancora un motore GIS o streaming geografico.

## Limiti della prima versione

Volo arcade assistito, senza simulazione aerodinamica realistica, vento, batteria o modalità acrobatica. Alberi con collisioni conservative; anelli futuri/passati non solidi. Limite di mappa ±690 m e quota massima 270 m rispetto all'origine locale. La camera resta sopra il terreno ma può attraversare chiome. Prestazioni e gestione termica su hardware iPhone reale vanno provate. Nessun supporto controller o multiplayer in questa versione.

## Licenza

Il progetto mantiene la licenza **GNU AGPL v3** già presente nel repository: [`LICENSE`](LICENSE). Software senza garanzia. Three.js è MIT; le dipendenze mantengono le rispettive licenze. I modelli, il terreno, i suoni e l'interfaccia sono generati dal codice del progetto.
