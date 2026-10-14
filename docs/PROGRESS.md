# BREMBO FLIGHT — avanzamento verso la 1.0

Aggiornato il 14 ottobre 2026. **Incremento giocabile in revisione, non versione finale.** Questo documento è il punto di ripresa per altre sessioni di sviluppo e revisione.

## Ramo e protezione della 0.2

- Ramo di lavoro: `feat/v1-brembilla-sector`, derivato dal commit 0.2 `f7f384d0f981bd6446e57d80b34b31afc11d4cf6`.
- PR nuova e separata, con base `feat/v0.2-multiplatform`. La PR #2 rimane aperta e il suo ramo non viene modificato.
- Nessun merge in `main`, nessun nuovo deploy, nessuna sostituzione dell'anteprima privata 0.2, nessun servizio a pagamento.
- I dati e il codice di questo incremento sono salvati nel ramo GitHub; non occorre recuperare file da un Codespace personale.

## Completato in questo incremento

1. **BOOST touch ergonomico** a destra, attivabile con un tocco: il pollice sinistro mantiene l'acceleratore e quello destro torna sullo sterzo. Si spegne al rilascio del joystick sinistro, con FRENO, pausa, cancellazione, rotazione o perdita di focus. Tastiera e gamepad conservati.
2. **Problema del test multitouch isolato e corretto**: `Input.dispatchTouchEvent` con `touchEnd` elenca i contatti da rilasciare. Il vecchio test rilasciava il dito sinistro, spegnendo correttamente BOOST. Ora rilascia il contatto del pulsante e verifica che il joystick sinistro resti premuto; poi aziona anche il destro. Non sono state rimosse le protezioni sul rilascio.
3. **Primo settore geografico reale**: terreno 4 × 4 km / area di volo 3,5 × 3,5 km, centro di Brembilla, Cadelfoglia, Laxolo e porzioni dei versanti vicini. DTM TINITALY 1.1 / INGV e geometrie OpenStreetMap; 1.633 sagome di edifici, 754 segmenti stradali/sentieri, 211 segmenti idrografici, 64 tessere. Circa 1,81 MB di JSON non compressi.
4. **Volo tranquillo** stabilizzato e **Sport** con parametri di movimento della 0.2. Entrambi supportano esplorazione e 8 checkpoint. La valle artistica originale resta disponibile dal menù.
5. Caricamento progressivo delle tessere, indice collisioni degli edifici indipendente dal rendering, geometrie aggregate, alberi istanziati nelle aree di bosco mappate, impostazioni e budget grafici conservati.
6. Schede culturali facoltative di San Giovanni Battista e San Gottardo, con fonti. Nessuna apertura automatica durante il volo.
7. Recupero dopo ripristino del contesto WebGL e gestione esplicita degli errori di caricamento. Se una tessera vicina manca, la pausa mantiene disponibile il pulsante per ritentare.
8. Importatore GIS riproducibile, attribuzioni e licenze separate, manifesto con provenienza e checksum. Nessuna API cartografica richiesta durante la partita.

## Verifiche effettuate

- **39 test automatici superati**: suite della 0.2 conservata e 9 nuovi casi su dati, collisioni, percorso reale e profilo Tranquillo.
- **TypeScript, build Vite e confezionamento della prova locale superati.** Rimane l'avviso sul modulo Three.js di circa 575 kB minificati / 145 kB gzip.
- **Test multitouch nativo Chromium passato** a 812 × 375: contatto sinistro mantenuto, tocco BOOST, ritorno del secondo dito al joystick destro, movimento oltre la velocità normale, reset con cancellazione, freno e blur.
- **Suite browser locale completa Chromium desktop/touch: 21 prove superate, 7 esclusioni previste, zero fallimenti e zero retry.** Comprende tutti gli 8 checkpoint sia nel mondo demo sia nel settore reale, layout, controller simulato, audio, errori dati e recupero WebGL.
- Matrice GitHub Actions, inclusa WebKit e installazione pulita: da completare dopo il push. Consultare [VERIFICATION-1.0.md](VERIFICATION-1.0.md) e gli stati della PR; non è ancora dichiarata superata.
- I test locali usano Chromium headless su Linux con rendering software. Non sono prove fisiche di iPhone, DualSense o prestazioni del giocatore.

## Cosa manca alla 1.0 finale

- Collaudo fisico su iPhone 12 mini/Safari e altri dispositivi: nuovo BOOST, orientamenti, gamepad, audio, FPS sostenuti, temperatura e consumi. Il gradimento di Davide riguarda la 0.2 già provata, non questo incremento.
- Conferma locale della riconoscibilità del centro e delle frazioni. Le sagome sono GIS reali, ma altezze non rilevate, tetti, finestre, materiali, alberi individuali e larghezze non mappate sono illustrativi.
- Miglioramento verificato di parrocchiale/campanile e ponti. Quote dei ponti e corsi d'acqua sono rappresentazioni semplificate: nessuna pretesa di precisione architettonica o idraulica.
- Revisione dei 12 multipoligoni incompleti esclusi e del datum verticale, prima di mescolare nuovi rilievi. Estensione alle aree adiacenti solo con fonti e budget misurati.
- Autorizzazione separata prima di creare una nuova anteprima o aggiornare quella esistente. Al momento non esiste un nuovo link di gioco pubblicato da questo incremento.

## Dove proseguire

- [GEOGRAPHY-1.0.md](GEOGRAPHY-1.0.md): copertura, fonti, licenze, limiti e importazione.
- [VERIFICATION-1.0.md](VERIFICATION-1.0.md): prove effettive e ambiente.
- `src/input.ts`, `tests/browser/sector.spec.ts`: comportamento e regressione BOOST.
- `src/geo/`, `public/geo/brembilla-centro/`, `scripts/geo/`: dati e caricamento del settore.
- `src/core/flight.ts`, `tests/sector.test.ts`: profili, collisioni e percorso.
- [README storico 0.2](README-0.2.md) e [verifica 0.2](VERIFICATION.md): conservati come documentazione storica, non come risultati della nuova versione.
