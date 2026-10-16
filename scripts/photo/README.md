# Pipeline offline — istruzioni per lo sviluppo

Questa cartella prepara asset, non pubblica siti. Non richiede accessi a servizi aziendali né API. I comandi sono per chi sviluppa, non operazioni richieste a Davide/Bruno.

## Ambiente riproducibile

Python 3.12; dipendenze principali fissate in `requirements.txt`. Creare l'ambiente e la cartella di lavoro **fuori dal checkout**:

```sh
python3 -m venv /tmp/brembo-photo-env
/tmp/brembo-photo-env/bin/pip install -r scripts/photo/requirements.txt
/tmp/brembo-photo-env/bin/python -m unittest discover -s tests/photo -v
```

Le versioni di PROJ/GDAL e l'operazione sono registrate nei rapporti; binari/grid di trasformazione possono variare tra sistemi. Per riproduzione bit per bit conservare anche `pip freeze`, versioni ExifTool/RAW developer, parametri, log e hash in archivio privato. Nessuna griglia di datum viene scaricata automaticamente.

## 1. Ricezione privata

```sh
python scripts/photo/pipeline.py inventory /private/brembo/originals /private/brembo/inventory.json
```

Non modifica né copia gli originali. JPG/DNG: hash, duplicati, metadati, controlli elementari. ExifTool opzionale aumenta i metadati leggibili; senza, Pillow legge camera e coordinate GPS EXIF ma resta parziale per DJI XMP e DNG non viene sviluppato. `readyForReconstruction` resta falso: copertura e qualità non sono deducibili dal conteggio. Il rapporto può contenere posizione e orari: privato. Sono rifiutati percorsi originali/report interni al repository, compresi symlink risolti.

Prima valutazione automatica privata:

```sh
python scripts/photo/pipeline.py assess /private/brembo/inventory.json /private/brembo/assessment.json
```

Raggruppa camera, dimensioni, focale e data; riporta distanze GPS consecutive solo se numeriche e valide. L’ordine dei file non prova la traiettoria. Diagnostiche su thumbnail (varianza Laplaciano, frazioni scure/chiare) aiutano la revisione comparativa, senza soglie universali di nitidezza. Altitudine DJI assoluta/relativa ed EXIF rimangono separate. Senza ExifTool la lettura resta parziale. `overlapVerified`, `verticalDatumVerified` e `readyForReconstruction` rimangono falsi finché non esistono verifiche reali.

## 2. Ricostruzione e preparazione GIS

Questa fase richiede fotografie adeguate e **non è stata eseguita**. Procedura e scelta ODM/COLMAP in [PHOTOREALISM](../../docs/PHOTOREALISM.md). Con ODM, organizzare un progetto privato `project/images/`, eventuale `gcp_list.txt` con CRS esplicito; utilizzare una versione/digest fissata del motore e registrare tutti i parametri. Conservare gli output ortofoto/DSM/mesh e il rapporto. I checkpoint indipendenti non vanno usati nel bundle adjustment.

L'export delle tessere richiede un **RGB/RGBA uint8 GeoTIFF ortorettificato nel CRS EPSG:32632**. Un JPEG con tag GPS non è un'ortofoto. Se l'input è EPSG:7791 o altro, scegliere una trasformazione PROJ documentata, verificare griglie/accuratezza ed eseguire la riproiezione con GDAL/QGIS fuori dal gioco; il comando `tiles` non sceglie silenziosamente una seconda trasformazione. RGB e CIR vanno distinti; NoData/alpha mantenuti.

Per mesh ODM georeferenziate conservare il CRS/offset associato: `.obj` da solo non è un contratto geodetico completo. Pulizia e decimazione Blender, trasformazione locale esplicita, atlanti e GLB con verifica glTF. I futuri GLB richiedono **accettazione XY e Z**; il controllo ortofoto qui implementato richiede soltanto XY perché non introduce nuove quote.

## 3. Controlli di allineamento

Copiare `docs/photo-templates/checks.example.json` **fuori dal repo**, sostituire l'esempio sintetico con punti misurati e hash dell'asset controllato, dichiarare precisione/soglie/datum. `source` e `reference` usano x/y nell'ordine e unità del rispettivo CRS; target deve essere metrico. Le quote rimangono separate.

```sh
python scripts/photo/pipeline.py align /private/brembo/checks.json /private/brembo/alignment.json
```

Il rapporto distingue `horizontalAccepted` da `verticalAccepted`; il processo esce 2 se XY fallisce. Un exit 0 **non approva la quota**. Sorgenti verticali sconosciute/diverse rimangono bloccate. Verificare che i punti siano indipendenti e distribuiti sull'intera area, che il datum dichiarato sia documentato e che il confronto temporale sia sensato. Limiti di esempio 1/2 m non sono garanzie di accuratezza né standard di rilievo. Non stimiamo automaticamente shift o trasformazioni per far passare il test.

## 4. Derivati e permesso di distribuzione

Compilare privatamente `release.example.json`, con hash del GeoTIFF e del rapporto, licenza/attribuzione/data, permesso e revisione privacy effettivi. Un operatore autorizzato deve verificare le evidenze: i booleani non costituiscono da soli una licenza. L'evidenza privata non viene copiata nella distribuzione.

```sh
python scripts/photo/pipeline.py tiles /private/brembo/approved.tif /private/brembo/release.json /private/brembo/export-001
```

La directory di output deve essere nuova. Esporta soltanto tessere integralmente coperte; fallisce se nessuna lo è. Ridurre `tileMeters` a 100 per un'area piccola, senza fingere copertura nei buchi. 512/1024 pixel derivano dallo stesso raster; non inventano dettaglio se la fonte è più grossolana. Output: WebP senza EXIF/XMP, hash/dimensioni, `manifest.json`, `credits.html`. Verificare immagini e licenza prima di copiare **solo questo export** in `public/geo/brembilla-centro/photos/<release>/` su una nuova PR. Il settore abilita lo strato con `photoManifestURL: "photos/<release>/manifest.json"`. Questo campo non è stato aggiunto ai dati correnti.

## 5. Verifica e rilascio

```sh
python scripts/photo/check-public-assets.py
npm test
npm run build
npm run test:e2e
```

Il controllo usa i file **tracciati da git**: eseguirlo anche dopo lo staging. Blocca RAW e raster sorgente pubblici, ma non certifica diritti, anonimizzazione visiva o qualità geografica. Nessun originale o dato privato nei test; pattern artificiali sono solo fixture diagnostiche generate in memoria. Il caricatore mantiene il terreno esistente se manifest, hash o immagini falliscono.

Il runtime implementa ortofoto con LOD e budget. Implementa inoltre altezze DBGT conservative e preparazione GLB/LOD offline privata (vedi sotto). Non implementa ancora fusione di sottovolumi, ricostruzione SfM/MVS, caricamento runtime GLB o streaming 3D Tiles: serviranno un primo lotto reale e relativi test. Non usare questa pipeline come prova che il fotorealismo sia già realizzato.

## Missione 2: matching e preparazione GLB realmente implementati

[Metodi, budget e limiti verificati](../../docs/PHOTO-TOOLS.md). Comandi esclusivamente per lo sviluppo:

```sh
python scripts/photo/match.py /private/brembo/originals /private/brembo/inventory.json /private/brembo/pairs.json
node scripts/photo/prepare-mesh.mjs /private/brembo/mesh-job.json /private/brembo/mesh-review-001
```

`match.py` include OpenCV headless nelle dipendenze Python fissate; legge soltanto i JPG con hash coincidente all'inventario, massimo 30. `prepare-mesh.mjs` usa le devDependencies del lockfile npm; copiare il template `docs/photo-templates/mesh-job.example.json` fuori dal checkout e compilare dati reali. Il GLB sorgente deve essere già ricostruito e riferito al sistema locale; il comando non avvia ODM, COLMAP, Blender né servizi esterni. Output privato obbligatorio, nessun upload, nessuna attivazione automatica. Validazione e budget falliscono esplicitamente se incompatibili.

La preparazione GLB non sostituisce le verifiche SfM/metriche, la revisione visuale della privacy, i permessi di redistribuzione o il futuro caricatore runtime. Un esito positivo non significa che la mesh sia fedele a Brembilla. I file sorgenti devono restare privati; nel gioco entreranno soltanto derivati autorizzati e verificati in una revisione successiva.
