# Primo settore reale di Brembilla — candidata 1.0

Questo incremento parte dalla 0.2 (`f7f384d`) e conserva anche lo scenario inventato, selezionabile dal menù. Non ricostruisce tutta Val Brembilla e non include la mappa da 100 × 100 km.

## Estensione effettiva

- Griglia del terreno: **4 × 4 km**, 201 × 201 vertici, passo 20 m.
- Area centrale di volo: **3,5 × 3,5 km**; le features sono ritagliate a ±1.850 m.
- Sistema orizzontale **WGS84 / UTM 32N, EPSG:32632**; origine E=546280, N=5074440. +X est, −Z nord della griglia, +Y alto. Origine Y=400 m rispetto ai valori del DTM, nessuna esagerazione verticale. La bussola segue il nord della griglia, non una bussola magnetica.
- Centro di Brembilla e parrocchiale, asse del Torrente Brembilla, Cadelfoglia, Laxolo, Lera e parti dei versanti di Cavaglia; Camorone e Malentrata sono al margine orientale. La presenza del toponimo non equivale a un modello dettagliato dell'intera frazione.
- **1.633 sagome di edifici, 754 segmenti stradali/sentieri, 211 segmenti idrografici, 182 poligoni di uso del suolo, 42 toponimi**. Sono elementi GIS/segmenti, non 754 strade distinte.
- 64 tessere di features; circa 1,81 MB di JSON complessivi non compressi, incluso l'indice collisioni. Fonte completa e conteggi: `public/geo/brembilla-centro/manifest.json`.

## Fonti effettivamente usate

**TINITALY 1.1 — INGV, CC BY 4.0.** Tarquini S., Isola I., Favalli M., Battistini A., Dotta G. (2023). TINITALY, a digital elevation model of Italy with a 10 meters cell size (Version 1.1). DOI https://doi.org/10.13127/tinitaly/1.1. Fonte e licenza: https://tinitaly.pi.ingv.it/ e https://creativecommons.org/licenses/by/4.0/.

Richiesta WCS documentata nel manifesto: GeoTIFF EPSG:32632, bbox `544280,5072440,548280,5076440`, 401 × 401 pixel. La griglia risultante viene campionata bilinearmente ai centri dei pixel e poi quantizzata al decimetro sui vertici del gioco a 20 m. La collisione usa gli stessi triangoli renderizzati, senza una seconda superficie bilineare divergente. Non attribuiamo accuratezza di 10 cm ai rilievi: è solo il formato di memorizzazione.

Il GeoTIFF non dichiara un unico datum verticale riconoscibile: conserviamo i valori del dataset e documentiamo questo limite. Non sono stati mescolati dati GNSS/ellissoidici o altre fonti altimetriche. Un'integrazione successiva richiede risolvere esplicitamente i datum verticali.

**OpenStreetMap — © OpenStreetMap contributors, ODbL 1.0.** https://www.openstreetmap.org/copyright e https://opendatacommons.org/licenses/odbl/1-0/. Estratto API del 14 ottobre 2026, bbox WGS84 `9.570,45.805,9.623,45.841`. Completate sei relazioni forestali tramite endpoint `/relation/{id}/full` (URL e checksum nel manifesto). Nessuna tile raster OSM è caricata durante il gioco.

I dati derivati sono pubblicati come JSON scaricabili sotto ODbL: geometrie trasformate/ritagliate, fori dei poligoni conservati, linee densificate a ≤8 m, uso del suolo rasterizzato sul reticolo. Il codice è AGPL-3.0-only; le licenze dei dati rimangono separate e indicate anche nel gioco. Gli originali di transito non sono versionati: contengono dati superflui; i derivati distribuiti non includono nomi utente OSM, indirizzi privati o contatti. Tutte le geometrie effettivamente usate restano disponibili.

## Cosa è geografico, cosa è illustrativo

Geografici: morfologia del DTM, sagome OSM, tracciati, poligoni di bosco/prato/insediamento e coordinate dei luoghi. Non sono necessariamente aggiornati o completi: OSM e DTM possono avere epoche diverse.

Illustrativi: altezze dove assenti (`heightBasis`), altezze derivate dal numero di piani con convenzione 3 m/piano, tetti piatti, finestre, materiali, singoli alberi e larghezze dove non mappate (`widthBasis`). Le torri o le chiese sono volumi stilizzati sulle sagome, non modelli architettonici fedeli. I ponti hanno un rialzo grafico convenzionale; mancano spalle/strutture e la posizione verticale non è certificata. Niente neve artificiale o montagne procedurali aggiunte oltre il terreno reale.

12 multipoligoni incompleti rimasti sono esclusi, senza riempirli per ipotesi. Parte della copertura non classificata usa una tinta neutra, non la pretesa che ogni pendio sia un prato. Gli alberi sono distribuiti soltanto entro le aree di bosco mappate, con densità illustrativa limitata a 1.600 istanze. Le chiome sono un'interpretazione visiva. Percorso, anelli e indicatore di partenza sono aiuti di gioco, non itinerari autorizzati di volo reale.

## Importazione riproducibile (sviluppatori)

Non serve al giocatore. Nessun download upstream durante `npm ci`, build, test o partita. Gli aggiornamenti GIS sono deliberati, senza cron o API key.

1. Scaricare il GeoTIFF WCS e l'XML OSM dagli URL nel manifesto. Scaricare anche le sei relazioni integrative. Conservare i checksum delle risposte: le API OSM sono mutabili.
2. Ambiente Python con `numpy`, `rasterio`, `pyproj`, `shapely`.
3. Eseguire `python scripts/geo/prepare-sector.py --dem /percorso/terreno.tif --osm /percorso/settore.xml --osm-extra /percorso/osm-relation-*.xml`.
4. Verificare manifesto, checksum, esclusioni, conteggi, griglia e test. La procedura non pubblica niente.

## Caricamento e prestazioni

Terreno e indice collisioni completo sono pronti prima del decollo. I modelli visibili si caricano per tessere, due richieste contemporanee, in ordine di distanza. La zona iniziale viene attesa prima di abilitare il pulsante di volo. Eco conserva al massimo 24 tessere entro 850 m; Bilanciato/Alto al massimo 32 entro 1100/1400 m. Le geometrie uscite dal vicinato vengono rimosse e liberate. I file statici possono essere riutilizzati dalla cache HTTP del browser.

Le sagome degli edifici collidono anche quando la rispettiva tessera visiva non è ancora in memoria. Se manca la zona immediatamente vicina (180 m), il gioco va in pausa e permette di ritentare: niente voli attraverso edifici non caricati. Gli alberi hanno un indice spaziale per evitare di controllarli tutti a ogni passo fisico. Le facciate usano un pattern originale, leggero, sfumato in lontananza; nessuna texture fotografica o passaggio di riflessione.

Le impostazioni grafiche e il budget dei pixel della 0.2 restano disponibili. 30 FPS stabili sui telefoni modesti è un **obiettivo da misurare su hardware**, non un risultato certificato da Chromium software o WebKit Linux.

## Cultura

Due schede facoltative: San Giovanni Battista a Brembilla e San Gottardo a Laxolo. Appare solo un pulsante quando ci si avvicina; testo e pausa si aprono esclusivamente su richiesta. Schede originali brevi, senza foto copiate:

- Pro Loco Val Brembilla: https://www.valbrembilla.it/page.php/it/chiesa-di-brembilla/103?lang=it — Fornoni, consacrazione 1896, Scurolo.
- Lombardia Beni Culturali / Regione Lombardia: https://www.lombardiabeniculturali.it/istituzioni/schede/1500109/ — parrocchia autonoma dal 1919, consacrazione 1938, attestazione 1575.

## Dopo questo settore

Validare il centro con il collaudo locale di Davide. Correggere le differenze dimostrate usando fonti licenziate. Priorità successive: geometria e quota dei ponti, modello riconoscibile della parrocchiale/campanile, tetti misurati dove disponibili, continuità con le frazioni. Foto e filmati autorizzati possono guidare modelli originali; documentare autore, permesso, soggetti e licenza. Fotogrammetria solo ritagli leggeri, più LOD, con autorizzazione e rilievi coerenti. Per ampliare, scegliere piccoli settori adiacenti con bordi altimetrici condivisi e budget misurati, non un unico modello enorme.
