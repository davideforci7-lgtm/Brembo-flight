# Fonti fotografiche e geografiche per Brembilla

Verifica del **15 ottobre 2026**, sul rettangolo del settore PR #3: EPSG:32632 E 544280–548280, N 5072440–5076440. Aggiornamento 16 ottobre: [36 altezze DBGT integrate conservativamente](research/dbgt/README.md); i raster e le fotografie rimangono non attivati. Metadati, risoluzione nominale e disponibilità di un servizio non dimostrano da soli accuratezza o diritto di ridistribuzione.

| Fonte autentica | Risoluzione / contenuto | Copertura e riutilizzo | Decisione |
| --- | --- | --- | --- |
| **DBGT Lombardia, Tema 0201 Edificato** | Sagome, unità volumetriche, altezze, particolari architettonici; CRS RDN2008/UTM32N EPSG:7791 | Metadati del tema: CC BY 4.0. Query locale: 3.710 unità volumetriche, 1.639 rappresentazioni edificio, 27 particolari; zero elementi di copertura | Migliore candidato per sostituire progressivamente i volumi illustrativi, dopo controllo geometrico, temporale e verticale |
| **DTM Lombardia 5×5 m, edizione 2015** | Griglia 5 m; provenienza mista DBT/LiDAR/dati meno fini, non LiDAR uniforme | Metadati correnti: CC BY 4.0; estensione regionale comprende il settore. Raster locale non ancora scaricato/verificato | Confrontare con TINITALY senza cambiare automaticamente collisioni o quote |
| **TINITALY 1.1 / INGV** | DTM nativo 10 m, oggi campionato a 20 m nel gioco | Già presente e verificato nella PR #3; CC BY 4.0. Datum verticale del file non identificato con certezza | Conservare come base e fallback; nessuna precisione centimetriche dedotta dal GPS |
| **OSM** | Sagome, viabilità, idrografia, nomi; precisione variabile | Già presente, ODbL 1.0 + attribuzione. Completezza non garantita | Semantica e fallback, non fonte fotografica; mantenere l'estratto e le derivazioni distinguibili |
| **Ortofoto AGEA/MASAF recenti, incluso 2024** | Prodotto 2024 nominalmente 20 cm; RGB/CIR, non confondere CIR con colori naturali | Il catalogo regionale distingue consultazione da distribuzione. Sublicenze istituzionali per enti pubblici/contraenti non equivalgono a permesso per un videogioco distribuibile | **Non incorporare né aggirare con hotlink WMS/WMTS** senza autorizzazione esplicita del titolare; copertura pixel locale ancora da controllare |
| **ALIFOTO 1975** | Bianco e nero, scansioni circa 30 cm; possibili zone senza dati, ortorettifica storica | Metadati CC BY 4.0; estensione regionale, effettiva tessera locale non controllata | Solo eventuale modalità storica esplicitamente datata; inadatta a descrivere l'aspetto attuale |
| **Catalogo coperture LiDAR regionale + PST** | Rilievi eterogenei; alcuni dati regionali richiedibili anche da privati | Query dei sette livelli di copertura: **zero intersezioni con il settore**. Non prova l'assenza di altri rilievi non censiti | Non promettere un DSM/LiDAR locale disponibile; chiedere eventualmente conferma del catalogo, specifiche e licenza del prodotto preciso |
| **Originali di Bruno** | Foto nadirali/oblique e terrestri, eventuali RTK/GCP, RAW e video originali | Non ancora ricevuti. Diritti e precisione da documentare per lotto | Fonte prioritaria per l'aspetto contemporaneo e fotogrammetria locale |

## Evidenza locale, non soltanto un elenco di cataloghi

[Query e risposte archiviate](research/brembilla-source-probe-2026-10-15.json). I conteggi sono elementi che **intersecano il rettangolo**, non una certificazione di copertura completa. I livelli DBGT 3 e 5 sono rappresentazioni della stessa classe: non si sommano. Tutte le 3.710 unità hanno `UN_VOL_AV` positivo e inferiore a 200 m nella query, ma ciò non dimostra l'esattezza di ogni valore. Tre record campione riportano circa 5,576 / 7,195 / 4,053 m, estrusione di tipo altezza, scala 1:2.000 e inizio validità 2011-03-01. Non estendere la data del campione a tutto il settore. `HasZ=true` non identifica il datum verticale. `UN_VOL_QE` non va interpretato come altezza senza leggere `UN_VOL_EX`.

Nessun endpoint è interrogato dal browser del giocatore. Nessuna foto è stata prelevata da Google Earth/Maps o da mod di simulatori. La licenza del codice AGPL non sostituisce quelle dei dati o delle fotografie.

## Fonti primarie

- [Regione: archivio, ortofoto e condizioni di distribuzione](https://www.geoportale.regione.lombardia.it/consultazione-e-distribuzione).
- [DBGT Tema Edificato: metadati/licenza](https://www.geoportale.regione.lombardia.it/metadati?_detailSheetMetadata_WAR_gptmetadataportlet_identifier=r_lombar%3A3493af32-587c-4bca-92a4-ea717ea1a617&_jsfBridgeRedirect=true&p_p_id=detailSheetMetadata_WAR_gptmetadataportlet&p_p_lifecycle=0&p_p_mode=view&p_p_state=normal); [servizio e schema](https://www.cartografia.servizirl.it/arcgis5/rest/services/BaseMap/DBGT_Tema0201_Edificato/MapServer/0).
- [DTM 5 m: metadati/licenza](https://www.geoportale.regione.lombardia.it/en/metadati?_detailSheetMetadata_WAR_gptmetadataportlet_identifier=r_lombar%3Adfc98d60-5f02-4a2b-8113-5ad24cc53a9c&_jsfBridgeRedirect=true&p_p_id=detailSheetMetadata_WAR_gptmetadataportlet&p_p_lifecycle=0&p_p_mode=view&p_p_state=normal).
- [ALIFOTO 1975: metadati/licenza](https://www.geoportale.regione.lombardia.it/en/metadati?_detailSheetMetadata_WAR_gptmetadataportlet_identifier=r_lombar%3A2fde1d01-6314-4dac-ad50-37305cd875c6&_jsfBridgeRedirect=true&p_p_id=detailSheetMetadata_WAR_gptmetadataportlet&p_p_lifecycle=0&p_p_mode=view&p_p_state=normal).
- [Catalogo LiDAR interrogato](https://www.cartografia.servizirl.it/arcgis1/rest/services/territorio/copertura_lidar/MapServer).
- [Condizioni ortofoto 2024, esempio ufficiale provinciale](https://www.provinciasondrio.it/sites/default/files/contents/modulistica_procedimenti/9892/condizioni-utilizzo.pdf): chiarisce il regime di sublicenza; non dimostra copertura di Brembilla.
- [TINITALY](https://tinitaly.pi.ingv.it/), [OSM: copyright e licenza](https://www.openstreetmap.org/copyright), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

Non sono stati ottenuti permessi aggiuntivi né contattati enti o Bruno. Le pagine e i servizi possono cambiare: archiviare licenza e hash del prodotto preciso quando lo si acquisisce.
