# Missione 2 — ripresa e consolidamento, 16 ottobre 2026

Verificati i commit già salvati sulla PR #4: `6151770` (pipeline), `722f674` (replay CI), `ff83f0f` (36 altezze DBGT). **CI dell’ultimo commit `ff83f0f` tutta verde**, non soltanto quella precedente: [run 38866727073](https://github.com/davideforci7-lgtm/Brembo-flight/actions/runs/38866727073), 48 test TypeScript, 16 Python, 37 prove browser passate e 14 esclusioni per profilo. [Tempi reali dai log](research/ci-ff83f0f.json): build 21,3 s, replay 193,6 s, desktop UI 351,6 s, WebKit 202,1 s, touch 288,6 s. Nessuna nuova regressione del timeout.

Salvato il lavoro locale rimasto dalla sessione precedente, dopo nuove verifiche:

- Inventario privato arricchito con metadati DJI, diagnostica relativa nitidezza/esposizione e comando `assess` per gruppi camera/focale/data/dimensioni. GPS non usato per dichiarare sovrapposizione o accuratezza; nessuna foto ricevuta.
- Filtro anisotropico fotografico limitato alle capacità GPU e al preset (2/4/8), mipmap esplicite, cancellazione della decodifica quando la tessera non serve. Strato foto ancora disattivato.
- [81 campioni DTM5 e decisione sul datum](research/DTM-COMPARISON.md): scarto medio −3,979 m, RMSE differenze 7,957 m; terreno preservato. TINITALY documentato MSL, realizzazione verticale locale non ancora dimostrata compatibile.
- [Screenshot autentici e misure](reality-captures/README.md), stessa camera PR #3 / DBGT: 122 draw call e 209.686 triangoli in entrambi; cambiamento modesto alle altezze, nessuna superficie fotografica nuova.
- [Roadmap separata dei suggerimenti di Bruno](BRUNO-ROADMAP.md), nessuna modifica al gameplay.

Verifica locale ripetuta: **49 test TypeScript, 18 Python, typecheck e build superati; 2 test touch del caricatore fotografico passati in 19,2 s**. Chromium 153/Linux/SwiftShader; pattern diagnostici nei test, non fotografie. WebKit/iPhone fisico non eseguiti localmente. La CI di questo incremento sarà riportata separatamente.

Punto di ripresa: classificare analiticamente i 439 volumi DBGT non importati, correggere eventuali difetti dimostrabili di aderenza delle strade al terreno e completare gli strumenti privati per il primo lotto di Bruno. Nessuna estensione geografica o sostituzione del DTM approvata dai dati finora raccolti. Main, PR #2/#3, fisica e anteprime intatti.

---

# Reality Engine — 16 ottobre 2026

Primo incremento sulla PR #4: [diagnosi CI e verifiche](REALITY-CI.md). Artifact e log esaminati: il replay avanzava verso l’ottavo checkpoint ma il rendering software con screencast superava il budget. Ottimizzato esclusivamente il test, separati i replay dai controlli desktop UI senza eliminare verifiche o aumentare timeout. Due replay locali passati, 13 test Python e typecheck passati. Correzione della quarta banda GeoTIFF salvata insieme.

In corso: campione pubblico DBGT di 475 unità nel centro (800×800 m), confronto con OSM; acquisizione/confronto DTM5; nessuna fotografia di Bruno ricevuta e nessuna nuova anteprima pubblicata. Le sezioni sottostanti descrivono gli incrementi precedenti, non il risultato finale della missione.


Secondo incremento: [campione DBGT e confronto riproducibile](research/dbgt/README.md). 475 volumi pubblici acquisiti, 391 con sovrapposizione OSM, 36 associazioni conservative integrate usando soltanto l’altezza relativa UN_VOL_AV. Sagome e basi originali conservate; stesso aggiornamento per rendering/collisioni; fallback completo se dati mancanti o incompatibili. Nessuna nuova fotografia o quota assoluta importata. 48 test TypeScript, 16 Python, build e due prove browser mirate superati localmente. Un primo test aggiunto sulle collisioni era troppo vicino al tetto (entro il raggio del drone di 0,65 m); corretto il punto di verifica senza cambiare le collisioni.

**CI del commit `722f674` tutta verde:** [run 38865666638](https://github.com/davideforci7-lgtm/Brembo-flight/actions/runs/38865666638). 44 unit test + 13 Python di quel commit; 34 prove browser passate, 14 esclusioni previste. Job replay 183,4 s, desktop UI 260,7 s, WebKit 255,0 s, touch 285,4 s. [Tempi dai log](research/ci-722f674.json). Il nuovo incremento DBGT deve ancora completare la propria CI.

---

# Aggiornamento: preparazione fotografica e fusione geospaziale — 15 ottobre 2026

[PR #4](https://github.com/davideforci7-lgtm/Brembo-flight/pull/4), ramo nuovo `feat/photographic-pipeline`, base esatta PR #3 `2a06c243f497436e9f7846f174f9fe1dbce940d9`. I resoconti precedenti sono conservati più sotto come storico. Davide ha ora collaudato il settore e conferma che le posizioni delle case sono una buona base; la criticità prioritaria è l'aspetto artificiale.

## Preparato concretamente

- Analisi del renderer e dei dati esistenti; nessuna modifica alla fisica, ai checkpoint o ai file del settore distribuito.
- [Ricerca fonti e licenze](PHOTO-SOURCES.md), con [risposte delle query sul settore reale](research/brembilla-source-probe-2026-10-15.json). DBGT: 3.710 unità volumetriche con altezze, 1.639 rappresentazioni edificio, nessun elemento nel livello coperture. Sette livelli del catalogo LiDAR: zero intersezioni con il settore; non implica assenza di qualsiasi altro rilievo.
- [Strategia di fusione](PHOTOREALISM.md): ortofoto/OSM/DBGT/DTM/DSM/foto, riferimento metrico comune, assi, datum, date, precisione, conflitti e provenienza per elemento. Operazione EPSG:7791→32632 con accuratezza dichiarata 1 m, non centimetri. Quote sconosciute non accettate per fusione 3D.
- [Pipeline offline](../scripts/photo/README.md): inventario privato JPG/DNG e duplicati, controlli indipendenti XY/Z, rapporti con hash, export GeoTIFF→tessere WebP con LOD e attribuzioni dopo verifica diritti/privacy. Originali e rapporti privati esclusi dal repository.
- Caricatore Three.js opzionale per ortofoto: 512/1024, massimo due richieste, budget 8/12/16 tessere, verifica hash/dimensioni, fallback sul terreno, rilascio risorse. Attribuzione e diagnostica. **Non attivato nel settore esistente.**
- [Specifiche semplici per Bruno](BRUNO-CAPTURE.md), esempi di controllo e rilascio, percorso ODM/COLMAP→GLB documentato.
- CI estesa con i test Python e controllo sugli asset pubblici; mantiene le suite precedenti. Aggiunta la base PR #3 al filtro dei rami per verificare la nuova PR separata.

## Verifiche eseguite durante l'incremento

- 44 test TypeScript passati, inclusi coordinate/UV, diagonali della griglia, budget/LOD, crediti e manifest non validi.
- 13 test Python passati: inventario/duplicati, riservatezza dei percorsi, proiezione lon/lat, scarti non corretti di nascosto, blocco datum sconosciuto, checkpoint degeneri, permessi/hash, export riproducibile, EXIF rimossi, nodata non inventato, rifiuto di una quarta banda infrarossa scambiata per alpha.
- Typecheck e build Vite passati; Three.js resta il chunk principale (~575 kB minificati, ~145 kB gzip), senza nuove dipendenze browser.
- Suite browser locale mirata: **11 passati, 1 esclusione prevista**, Chromium desktop e touch su Linux/SwiftShader. Strato fotografico con pattern diagnostico (non foto reali), errore 404 con volo ancora utilizzabile, settore geografico, orientamenti, BOOST multitouch e recupero WebGL. Screenshot del pattern ispezionato. Queste non sono prove su iPhone fisico.
- Primo avvio locale dei browser bloccato da un vecchio eseguibile incompleto; ripristinato Chromium 153 da pacchetto disponibile e ripetuti i test con successo. Il download Playwright standard locale ha restituito archivi incompleti. Nessun errore dell'app mascherato come test passato.
- Dopo l’ultimo affinamento al download: 4 prove fotografiche locali ripetute e superate, incluso il cambio Eco/Alto. La successiva correzione della quarta banda riguarda soltanto la pipeline Python; i file browser rimangono identici.
- I risultati della verifica **GitHub Actions del commit finale** sono riportati nella descrizione/Checks della nuova PR, distinguendoli da questa verifica locale. Nessun deploy è parte di questo lavoro.

## Limiti ancora reali

Non è stata creata una Brembilla fotorealistica: non sono arrivati gli originali di Bruno e non sono stati ottenuti diritti di redistribuzione per ortofoto recenti AGEA/MASAF. Ortofoto 1975 non rappresentano il paesaggio contemporaneo. Nessuna falsa texture fotografica è distribuita.

Restano: audit del datum verticale, importazione/confronto geometrico DBGT e DTM5, fusione per elemento e maschere terreno/strade/mesh, ricostruzione SfM/MVS, conversione e LOD GLB reali, prova prestazioni/memoria/temperatura su iPhone 12 mini e PC. I budget GPU documentati sono stime delle texture, non FPS o memoria totale misurata.

**Prossimo passo:** ricevere privatamente una selezione coerente di Bruno con diritti e metadati, inventariarla, scegliere un piccolo sito e verificare copertura/allineamento prima della ricostruzione pilota. Non occorrono operazioni tecniche da Davide. Nessun merge, nessun servizio a pagamento, nessuna modifica a PR #3, main o anteprime.

---

# Storico dell'incremento PR #3

# BREMBO FLIGHT — avanzamento verso la 1.0

Aggiornato il 14 ottobre 2026. **Incremento giocabile in revisione, non versione finale.** Questo documento è il punto di ripresa per altre sessioni di sviluppo e revisione.

## Ramo e protezione della 0.2

- Ramo di lavoro: `feat/v1-brembilla-sector`, derivato dal commit 0.2 `f7f384d0f981bd6446e57d80b34b31afc11d4cf6`.
- [PR #3](https://github.com/davideforci7-lgtm/Brembo-flight/pull/3), nuova e separata, con base `feat/v0.2-multiplatform`. La PR #2 rimane aperta e il suo ramo non viene modificato.
- Nessun merge in `main`, nessun nuovo deploy, nessuna sostituzione dell'anteprima privata 0.2, nessun servizio a pagamento.
- I dati e il codice di questo incremento sono salvati nel commit `fd71bf5d8fe1cd8884dab32ed0029a972d7604b9` del ramo GitHub; non occorre recuperare file da un Codespace personale.

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
- **GitHub Actions del codice `fd71bf5`: tutta verde** — [esecuzione 38618313323](https://github.com/davideforci7-lgtm/Brembo-flight/actions/runs/38618313323). Installazione pulita, 39 test automatici, build e **28 prove browser superati**: Chromium desktop 11, Chromium touch 10, WebKit 7. 14 esclusioni previste per profilo, nessun fallimento o retry.
- Job più lungo **8 min 37 s**, inferiore al limite 15 minuti; i test desktop richiedono 8,0 minuti, inferiori al limite di step 11 minuti. Nessun controllo rimosso e nessun aumento arbitrario dei timeout.
- L’ultimo aggiornamento di questa documentazione aggiunge risultati e collegamenti; il codice verificato rimane esattamente quello del commit `fd71bf5`. Dettagli in [VERIFICATION-1.0.md](VERIFICATION-1.0.md).
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
