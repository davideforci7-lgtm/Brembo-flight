# Architettura fotografica e fusione geospaziale

Stato 2026-10-15: nuova preparazione sul ramo `feat/photographic-pipeline`, dalla PR #3 (`2a06c24`). **Nessuna fotografia reale nuova o ricostruzione fotogrammetrica è già presente nel gioco. Aggiornamento 16 ottobre: integrate 36 altezze relative DBGT, con basi/sagome originali e fallback; vedi [confronto](research/dbgt/README.md).** I test usano soltanto pattern sintetici esplicitamente identificati, fuori dagli asset distribuiti. Main, PR #3, fisica e anteprime non vengono aggiornati.

## Decisione tecnica

Estendere Three.js con un sistema ibrido: **DTM + ortofoto a tessere + edifici DBGT con texture vere + piccoli siti fotogrammetrici**. Le collisioni restano una rappresentazione leggera separata. La mappa rimane il mondo del gioco, con volo, percorsi e interfaccia esistenti.

| Soluzione | Valutazione per questo progetto |
| --- | --- |
| Three.js, tessere locali, glTF/GLB e LOD | Scelta per il primo settore: conserva controlli e fisica; asset statici, nessuna API a pagamento, budget espliciti |
| 3D Tiles 1.1 | Formato utile per estensione futura e grandi mesh; richiede tiler, selezione per errore a schermo e integrazione del caricatore. Il contratto di provenienza/coordinate va conservato. Non serve migrare adesso tutto il gioco a Cesium |
| Una mesh fotogrammetrica monolitica | Troppa memoria, caricamento iniziale e costo collisioni su telefono; suddividere per quartiere/luogo |
| Gaussian splatting / NeRF | Interessanti per viste, ma integrazione di collisioni, trasparenze, memoria e LOD richiede prove ulteriori. Non sono la strada più breve verso un gioco stabile multipiattaforma |

Il codice attuale ha una griglia di 201×201 vertici (80.000 triangoli), dati vettoriali JSON su 64 tessere, richieste concorrenti limitate a due e geometrie aggregate. Edifici con coperture piatte/materiali procedurali; altezze in gran parte illustrative. Il terreno è già in coordinate locali metriche. Non esistevano tessere fotografiche né streaming di texture. Questi sono i punti di estensione, senza alterare la fisica.

## Contratto comune di coordinate, tempo e precisione

1. **Conservare l'originale**: CRS, ordine assi, unità, epoca/data di acquisizione, datum verticale, GSD/densità, accuratezza dichiarata, extent/nodata, licenza, URL, hash. `unknown` è un'informazione, non zero errore.
2. **Riferimento orizzontale di lavoro**: mantenere EPSG:32632 e origine E546280/N5074440/H400 della PR #3. OSM usa lon/lat EPSG:4326; DBGT EPSG:7791 non va semplicemente rietichettato. Trasformare con PROJ `always_xy`, senza ballpark o download silenzioso di griglie; registrare operazione, versione e accuratezza. Verifica locale: PROJ propone RDN2008→WGS84 con accuratezza dichiarata **1 m**, non centimetri. EPSG:4326→UTM ha precisione matematica dell'operazione, non del rilievo GPS.
3. **Quote separate**: GNSS ellissoidiche, altitudine relativa al decollo, quote ortometriche e datum locali non sono intercambiabili. Il datum verticale di TINITALY oggi è irrisolto. `H = h − N` è applicabile solo con geoid model e riferimenti compatibili; non usare una costante stimata per nascondere gli scarti. Una trasformazione 2D non corregge le quote.
4. **Registrazione**: scegliere punti stabili e ben visibili (spigoli al suolo, segnaletica permanente, manufatti), distribuendoli sull'area e sulle quote. Controlli usati per orientare/registrare e checkpoint indipendenti devono essere distinti. Evitare alberi, ombre, acqua e bordi di tetto come controllo del terreno. RANSAC/trasformazioni di similarità possono individuare errori grossi nel progetto fotogrammetrico; non deformare il DBGT per farlo coincidere con una foto non ortorettificata.
5. **Verifica indipendente implementata**: almeno tre punti di controllo indipendenti non allineati; RMSE, massimo, percentile 95 empirico e bias E/N; residui Z solo per datum dichiarato identico e verificato. Nessun offset viene corretto automaticamente. Hash lega il rapporto all'asset. Limiti espliciti scelti per l'uso, non presentati come standard topografico. Tre punti sono un minimo software, non un rilievo adeguato per l'intera valle.
6. **Consegna locale**: `x=E−546280`, `z=5074440−N`, `y=H−400`. glTF Y-up; verificare assi, unità, eventuale origine/offset dell'esportatore e matrice di trasformazione, con almeno tre punti noti prima dell'importazione. Non inviare coordinate UTM di milioni di metri direttamente ai vertici GPU.

## Strategia di fusione, per elemento

| Elemento | Fonte prioritaria e confronto | Gestione dei conflitti |
| --- | --- | --- |
| Suolo | DTM regionale/INGV; futuro LiDAR classificato terreno se disponibile | Confrontare bias e residui su suolo nudo, risoluzione e datum; mantenere il vecchio terreno finché non validato |
| Tetti | Mesh fotogrammetrica validata, eventuale DBGT coperture / DSM locale | DSM−DTM solo dopo co-registrazione, stessa quota e controllo vegetazione; non ogni picco è un edificio. Nel catalogo interrogato il livello coperture è vuoto nel settore |
| Edifici | Sagome e unità volumetriche DBGT confrontate con OSM e immagini datate | Associazione per sovrapposizione/intersezione e distanza, non solo punto centrale; revisione di fusioni/suddivisioni. Distinguere altezza da quota di estrusione e parti sospese. Nessuna media automatica fra basi incompatibili |
| Facciate | Foto terrestri/oblique o mesh con viste convergenti | Una ortofoto non contiene le pareti. Parti invisibili rimangono semplificate e dichiarate, mai inventate come fotografie autentiche |
| Strade/acqua | DBGT/OSM per topologia, ortofoto per aspetto | Date diverse, ponti e corsi coperti richiedono revisione. Non proiettare i ponti sul fondovalle; non interpretare una linea centrale come bordo rilevato |
| Boschi/prati | Immagini e copertura reale; alberi istanziati come rappresentazione artistica | Evitare doppio volume tra DSM delle chiome e alberi sintetici; maschere per fondere con terreno e mesh |

Ogni elemento derivato dovrà riportare `sourceIds`, versioni/hash, data, trasformazione, precisione e classificazione `surveyed / photographic / inferred / artistic`. Conservare i livelli separati e la decisione di sostituzione; non fondere ciecamente gli obblighi ODbL delle derivazioni OSM con altri dataset. Il grafo di associazione e la fusione automatica delle geometrie **non sono implementati in questo incremento**: mancano campioni fotografici e verifica verticale affidabile.

## Quanto è implementato

- `scripts/photo/pipeline.py`: inventario JPG/DNG con checksum/deduplicazione, metadati e avvisi; originali/rapporti privati obbligatoriamente fuori dal repository. ExifTool opzionale per metadati più completi; Pillow non sviluppa i RAW.
- Comando `align`: controlli numerici in CRS comune, no ballpark, separazione XY/Z, rapporto riproducibile e soglie esplicite. Datum sconosciuto o differente blocca l'accettazione verticale. Non effettua un aggiustamento fotogrammetrico né una conversione di datum verticale.
- Comando `tiles`: RGB/RGBA GeoTIFF **già ortorettificato e riproiettato nel CRS del settore**, validazione permesso/privacy/hash/rapporto; tessere 100/200/400 m allineate alla griglia di 20 m, WebP 512/1024, attribuzione HTML e manifest. Non esporta tessere con nodata. Memoria di ricampionamento per tessera, non per ortomosaico intero. Pubblica solo i derivati richiesti, senza EXIF/XMP; nessun upload.
- `src/geo/photography.ts`: manifest opzionale `photoManifestURL`, validazione CRS/griglia/LOD, massimo due richieste, checksum e dimensioni, sRGB, orientamento nord corretto, geometria coincidente con il terreno, rilascio di texture/geometrie fuori budget. Errori ripiegano sul terreno esistente; ritento dopo 30 secondi. I modelli GIS continuano a essere mostrati.
- Foto mostrate con materiale non riluminato, per evitare di raddoppiare illuminazione/ombre già presenti nelle fotografie. Il terreno fotografico **non rende automaticamente fotografiche le facciate**. Strade/edifici esistenti possono ancora coprire parti dell'immagine: maschere di fusione vanno progettate sul materiale reale.
- Attribuzione accessibile dal gioco solo quando uno strato fotografico è configurato. Stato, numero tessere, errori e stima memoria nell'esportazione diagnostica.
- Protezione CI contro RAW, sorgenti GeoTIFF pubbliche e EXIF/XMP nei raster distribuiti. Non rileva da sola persone, targhe o interni: revisione visiva obbligatoria.

Nessun `photoManifestURL` è aggiunto al settore distribuito: funzionamento/paesaggio corrente restano quelli della PR #3 fino a una nuova integrazione approvata.

## LOD e limiti di memoria

Budget **implementati per le sole ortofoto**, non prestazioni misurate su iPhone:

| Preset | Tessere residenti | Texture/tessera | Stima GPU RGBA8 con mipmap | Raggio massimo |
| --- | ---: | ---: | ---: | ---: |
| Eco / automatico mobile | 8 | 512² | 10,7 MiB | 500 m |
| Bilanciato | 12 | 1024² | 64 MiB | 700 m |
| Alto | 16 | 1024² | 85,3 MiB | 1.000 m |

Due caricamenti in corso, immagini decodificate CPU, framebuffer, geometrie e driver richiedono memoria aggiuntiva; il formato WebP riduce i byte scaricati, **non** la memoria RGBA sulla GPU. Il conteggio riportato è una stima, non una misurazione del browser. Il numero tessere è il limite prevalente: il raggio non garantisce copertura fotografica completa. Finché mancano tessere si vede il terreno originale.

Il settore intero 4×4 km a 20 cm avrebbe 400 milioni di pixel: circa 2 GiB GPU con mipmap, prima del resto. Serve streaming. Con tessere 200 m, 512/1024 pixel corrispondono a circa 39/20 cm per pixel, solo se la fonte contiene quel dettaglio. La griglia altimetrica resta 20 m: una foto nitida non migliora automaticamente scarpate o muri.

Budget iniziali **proposti, non implementati né misurati**, per un luogo fotogrammetrico: LOD vicino 50–100 mila triangoli, medio 15–30 mila, lontano 2–5 mila; atlanti 1K mobile, fino a 2K PC, poche superfici/materiali. Rivedere con silhouette, errore a schermo e collaudo. KTX2/Basis e Meshopt valutabili dopo un primo GLB reale; il runtime attuale non include ancora questi decoder. Collisioni semplificate separate. Compressione del file e riduzione dei triangoli sono interventi distinti.

## Pipeline fotogrammetrica prevista

OpenDroneMap per il primo piccolo lotto aereo, COLMAP come alternativa per facciate/fotografie terrestri eterogenee; Blender per pulizia, maschere, atlanti e conversione GLB. Software open source eseguibile offline, nessun servizio a pagamento richiesto. Non sono stati installati o eseguiti ODM/COLMAP/Blender né ricostruiti modelli in questa fase.

1. Inventario privato; conferma diritti, controllo sfocatura/esposizione/duplicati e copertura. Sviluppare DNG con impostazioni uniformi registrate, conservando originali e calibrazione; non usare filtri generativi. Dividere camere/sessioni incompatibili.
2. Rilevamento/matching, SfM e bundle adjustment; leggere numero immagini orientate, distribuzione, residui e punti scartati. GPS EXIF è un vincolo iniziale, non una misura al centimetro. Integrare GCP con CRS/datum/precisione dichiarati; riservare checkpoint indipendenti.
3. MVS e mesh, ortomosaico e DSM. DTM da classificazione solo se il suolo è osservabile. Fotografie solo nadirali non ricostruiscono bene facciate nascoste; video compressi sono una riserva, non equivalenti a scatti originali sovrapposti.
4. Controllo metrico, confronto DBGT/OSM/DTM, maschere di persone/targhe/dettagli privati. I dati discordanti non entrano automaticamente nel gioco.
5. Suddivisione in piccoli GLB; retopologia/decimazione con verifica silhouette, bake delle texture vere, LOD separati. Correggere offset e assi esplicitamente. Solo dopo i controlli: esportazione GLB e verifica con glTF Validator; per esempio glTF Transform `optimize ... --texture-compress webp` su copie dei derivati. Versioni, parametri, hash input/output e rapporto conservati. Nessun originale nel repository pubblico.
6. Primo pacchetto locale di confronto, poi PR dei soli derivati autorizzati. Una nuova anteprima o una sostituzione delle attuali richiede autorizzazione separata.

L'elaborazione densa può richiedere ore e molta RAM; dipende da immagini, risoluzione e geometria. Prima misurare un lotto piccolo sul calcolo disponibile, senza attivare servizi cloud o promettere che il piano ChatGPT includa una workstation fotogrammetrica.

Riferimenti tecnici primari: [PROJ/pyproj](https://pyproj4.github.io/pyproj/stable/api/transformer.html), [ODM precisione](https://docs.opendronemap.org/map-accuracy/), [ODM output](https://docs.opendronemap.org/outputs/), [ODM parametri](https://docs.opendronemap.org/arguments/), [glTF Transform](https://gltf-transform.dev/cli), [3D Tiles 1.1](https://docs.ogc.org/cs/22-025r4/22-025r4.html), [Three.js texture](https://threejs.org/docs/pages/Texture.html).
