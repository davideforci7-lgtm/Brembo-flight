# BREMBO FLIGHT — candidata 1.0

Gioco di drone 3D gratuito e open source, Three.js + TypeScript + Vite. Prosegue la **0.2 apprezzata da Davide su iPhone**, senza modificare quel ramo o la sua anteprima.

**È una candidata da collaudare, non la versione 1.0 definitiva.** Il primo settore geografico è giocabile; accuratezza visiva locale, prestazioni e nuovi comandi sul telefono fisico devono ancora essere validati.

## Cosa si può fare

- **Volo tranquillo**, predefinito: esplorazione senza tempo, velocità moderata, arresto al rilascio, quota minima assistita e arresto sugli ostacoli. Nessun BOOST.
- **Volo Sport**: stessi parametri e stessa risposta della 0.2. BOOST, freno, checkpoint e recupero. Nessuna simulazione aeronautica certificata.
- Entrambi possono esplorare o affrontare gli **8 checkpoint**, nello stesso mondo. Record distinti per mondo, profilo e impostazioni.
- **Settore reale di Brembilla**: DTM INGV e geometrie OSM, territorio 4 × 4 km / area di volo centrale 3,5 × 3,5 km. Centro, Cadelfoglia, Laxolo e parti dei versanti vicini. Non tutta la Val Brembilla.
- **Valle dimostrativa conservata**, accessibile dal collegamento nel menù iniziale.
- Due schede culturali facoltative, con fonti, per San Giovanni Battista e San Gottardo. Nessuna finestra che interrompe automaticamente il volo.
- Touch, tastiera, controller standard/DualSense, telecamere esterna/FPV, audio procedurale, Eco/Bilanciato/Alto/Automatico e FPS opzionali.

## Correzione touch

Acceleratore e movimento a sinistra, quota/rotazione a destra. **BOOST è ora a destra e si attiva con un tocco**, quindi il pollice destro può tornare a sterzare mentre il sinistro mantiene l'acceleratore. Un altro tocco lo spegne; rilascio/cancellazione del joystick sinistro, FRENO, pausa, cambio orientamento e perdita di focus lo annullano. FRENO rimane a pressione a sinistra. La modalità Tranquillo nasconde BOOST.

Tastiera: WASD/frecce movimento, R/F quota, Q/E rotazione, Shift BOOST, Spazio freno, C telecamera, P/Esc pausa, X recupero, I scheda vicina. Gamepad: stick, R2/R1 BOOST, L2/L1 freno, triangolo/Y camera, Options/Start pausa. Controller fisico su Safari iOS ancora da verificare.

## Dati veri e rappresentazione artistica

Rilievo TINITALY 1.1 (10 m sorgenti, griglia di gioco a 20 m) e sagome/tracciati OSM. Altezze prive di rilievo, finestre, tetti, materiali e singoli alberi sono illustrativi. Non è fotogrammetria e non sostituisce cartografia tecnica. Fonti, coordinate, licenze, limiti e importatore: [GEOGRAPHY-1.0](docs/GEOGRAPHY-1.0.md), oltre al collegamento Fonti sempre disponibile nel gioco.

Codice AGPL-3.0-only. Dati INGV CC BY 4.0 e derivati OSM ODbL 1.0: licenze separate nella cartella dei dati. Nessuna API a pagamento, chiave o risorsa cartografica remota durante la partita.

## Collaudo

Nessun nuovo hosting è attivato automaticamente. La precedente anteprima privata 0.2 rimane invariata. Per aggiornare o creare un nuovo link serve l'autorizzazione del proprietario. [Resoconto della candidata](docs/VERIFICATION-1.0.md).

Per sviluppatori / CI (non richiesto al giocatore):

```sh
npm ci
npm test
npm run build
npx playwright install --with-deps chromium webkit
npm run test:e2e
```

`npm run dev` serve `/Brembo-flight/`; `?scenario=demo` seleziona la valle artistica conservata. `npm run package:playtest` prepara il pacchetto statico e i launcher locali già presenti nella 0.2. Le istruzioni tecniche della [prova locale](docs/PLAYTEST.md) rimangono disponibili per chi le preferisce, ma non sono necessarie con un link ospitato e autorizzato.

GitHub Actions verifica unità, build e i tre profili browser separati. Pages resta esclusivamente manuale con conferma esplicita. Nessun merge in main.

## Stato e passi successivi

[Stato di avanzamento e punto di ripresa](docs/PROGRESS.md).

Prima di definire 1.0 finale: collaudo Safari/iPhone e PC reali, riconoscibilità del centro con Davide, controllo di ponti e landmark, revisione delle esclusioni GIS, misure FPS/temperature e regolazione del caricamento. Il settore può poi crescere per tessere, con fonti verificabili e senza appesantire l'avvio.

[Resoconto 0.2](docs/VERIFICATION.md) · [README storico 0.2](docs/README-0.2.md) · [Scheda pilota](docs/PILOT-TEST.md)

## Preparazione fotografica (ramo separato)

[Fonti e licenze](docs/PHOTO-SOURCES.md), [architettura e fusione geospaziale](docs/PHOTOREALISM.md), [prima consegna di Bruno](docs/BRUNO-CAPTURE.md) e [pipeline offline](scripts/photo/README.md). La PR #3 resta la base giocabile: nessuna nuova fotografia è attivata e nessuna anteprima viene sostituita da questo lavoro.
