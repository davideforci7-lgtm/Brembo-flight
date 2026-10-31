# Missione 4 — settore pilota, stato di consegna

Base verificata: PR #5, `a1b81e8e387f6d0825dfa28f3bba52f1603ed712`.
Branch nuovo: `feat/mission4-visual-pro-pilot`; base PR: `feat/mission3-visual-fidelity`.
Lettura della ricerca allegata completata; le sue indicazioni non sostituiscono le licenze dei singoli prodotti.

## Incremento realizzato

- Terreno: grana originale condivisa 128×128 con mipmap, due scale spaziali e attenuazione nel settore pilota. Mantiene confini OSM, griglia TINITALY e collisioni. Non è una fotografia né aggiunge informazioni geografiche.
- Edifici: coperture con tinte illustrative variate, giunti filtrati orientati lungo il lato reale dell'impronta; cornici e davanzali illustrativi filtrati, passo delle finestre variato. Nessuna nuova forma della chiesa o falda non rilevata; quote e sagome restano identiche.
- Natura: chiome meno spigolose nell'illuminazione, variazioni deterministiche e LOD su un massimo di 128 alberi del settore pilota. Bilanciato/Alto usano chiome più articolate vicino al settore, Eco conserva il numero di triangoli delle chiome precedenti. Ombre della vegetazione pilota soltanto quando il preset permette già le ombre. Posizioni e inviluppi delle collisioni invariati.

Centro del pilota: media dei vertici dell'impronta OSM `way/127912869`, “Chiesa parrocchiale”, x=198,90 m, z=295,65 m. Raggio coperture 300 m; vegetazione 350 m; terreno pieno effetto entro 250 m e transizione fino a 400 m. Il riferimento resta EPSG:32632, origine E546280/N5074440/H400. Territorio totale invariato.

## Fonti e limiti verificati il 30–31 ottobre 2026

Si riusano esclusivamente i dati già distribuiti nella PR #5, senza nuovi download geografici:

| Dato | Licenza | Uso |
| --- | --- | --- |
| OpenStreetMap, estrazione archiviata ottobre 2026 | ODbL 1.0, © OpenStreetMap contributors | Impronte, strade, idrografia, poligoni del suolo; alberi illustrativi nelle aree boscate |
| TINITALY 1.1 / INGV | CC BY 4.0 | Terreno esistente 20 m derivato dalla sorgente 10 m |
| Regione Lombardia DBGT Edificato | CC BY 4.0 | Le stesse 36 altezze relative già validate, trasformazione orizzontale documentata EPSG:7791 → 32632 |
| Codice dei materiali e chiome | AGPL-3.0-only | Nuovi dettagli illustrativi originali, non rilievi |

Fonti primarie: [OSM](https://www.openstreetmap.org/copyright), [TINITALY](https://tinitaly.pi.ingv.it/), [DBGT](https://www.geoportale.regione.lombardia.it/metadati?_detailSheetMetadata_WAR_gptmetadataportlet_identifier=r_lombar%3A3493af32-587c-4bca-92a4-ea717ea1a617&_jsfBridgeRedirect=true&p_p_id=detailSheetMetadata_WAR_gptmetadataportlet&p_p_lifecycle=0&p_p_mode=view&p_p_state=normal).

La [distribuzione regionale AGEA/MASAF](https://www.geoportale.regione.lombardia.it/consultazione-e-distribuzione) distingue la consultazione dalle copie riservate a PA e incaricati: non è stata dimostrata la redistribuibilità delle immagini nel gioco. Nessuna ortofoto integrata. DTM5 resta escluso: il precedente confronto documenta RMSE delle differenze 7,957 m e compatibilità verticale non risolta. Copernicus non sostituisce il terreno più dettagliato esistente. Nessuna fotografia di Bruno, texture Google/Bing o codice GTA Varese/MOFO utilizzati.

## Misure e verifica

La ricompilazione della baseline ha prodotto 79 file, 2.861.343 byte, tutti identici all'artefatto verificato della PR #5. Nessuna suite della baseline ripetuta.

Nuova grana: 87.382 byte RGBA8 con mipmap stimati, una sola texture condivisa generata in memoria, zero richieste di rete. Il budget della mappa del suolo resta 5.592.406 byte Eco/Bilanciato e 22.369.622 byte Alto; la diagnostica espone separatamente `detailTextureBytes`.

Vegetazione: un batch aggiuntivo per separare le chiome pilota; massimo 15.360 triangoli aggiuntivi delle chiome in Bilanciato/Alto, zero in Eco. Il passaggio ombre Alto può aggiungere un ulteriore draw. Quantità realmente visibili e peso finale vanno letti dagli artefatti di confronto, non dedotti dal solo limite teorico.

58 test TypeScript e build/typecheck superati localmente durante l'incremento. Python locale non eseguito correttamente per dipendenze GIS mancanti; verificare la CI del nuovo commit. Browser Work: WebGL disabilitato, errore di creazione contesto prima dell'avvio; nessuna modifica al gioco per aggirarlo.

CI configurata per build, TypeScript/Python e prove Chromium desktop/touch e WebKit iPhone simulato. Aggiunto controllo del budget della grana al cambio preset e al recupero WebGL. Il confronto usa due build reali, ingresso identico, 100 passi fissi e verifica matrici della telecamera. Screenshot/JSON esclusivamente negli artefatti CI; il passo screenshot è facoltativo e non blocca la consegna.

Nessun FPS su iPhone fisico dichiarato; i tempi Linux/SwiftShader non sono benchmark hardware mobile. Il salto visivo deve essere valutato sulle immagini e sul dispositivo, non sul conteggio dei file. Mancano ancora tetti rilevati e facciate fotografiche: questa versione non è una ricostruzione fotorealistica.

## Punto di ripresa

I primi tre incrementi sono salvati su GitHub: `b6b6bde`, `2dd0581`, `99819f6`. Corrispondono agli alberi Git dei commit locali `60a9791`, `04c6669`, `7d212e5`; gli SHA differiscono perché il push nativo non dispone delle credenziali e il salvataggio usa l'integrazione GitHub.

Completare salvataggio LOD/QA, aprire PR dedicata, attendere CI sul suo esatto HEAD, ispezionare i confronti disponibili e confezionare nuova anteprima privata. La modalità panoramica assistita “Esplora Brembilla” è rimandata per concentrarsi su grafica e verifica; il volo libero preesistente resta disponibile.

Nessun merge, modifica a main/PR #5/vecchie anteprime/link di Bruno. Cartella Sites nuova `/workspace/sites/brembo-flight-mission4-pro`, non ancora registrata né pubblicata al momento di questo punto di ripresa.
