# Reality Engine — Missione 2: consegna verificabile

16 ottobre 2026. Ramo `feat/photographic-pipeline`, [PR #4](https://github.com/davideforci7-lgtm/Brembo-flight/pull/4). Partenza `ff83f0f`; PR #3 resta a `2a06c24`. Il simulatore resta giocabile nei test; **l'aspetto è ancora illustrativo**, non una ricostruzione fotografica completata.

## Modifiche e commit

| Commit | Risultato | File principali |
| --- | --- | --- |
| `360f72b` | Lavoro locale recuperato e salvato, filtro fotografico, inventario/diagnostiche, 81 campioni DTM e prime catture | `scripts/photo/pipeline.py`, `src/geo/photography.ts`, `scripts/geo/compare-dtm-samples.py`, `scripts/reality-capture.mjs` |
| `bb15596` | Superfici aderenti alla griglia e audit esaustivo DBGT | `src/geo/surfaces.ts`, `src/geo/streamer.ts`, `scripts/geo/audit-dbgt-associations.py`, `docs/research/dbgt/excluded-review.json`, test superfici/audit |
| `2049834` | GPS JPEG numerico senza ExifTool, matching privato, preparatore GLB/LOD, controlli privacy/coordinate/budget | `scripts/photo/match.py`, `scripts/photo/prepare-mesh.mjs`, `tests/mesh-pipeline.test.ts`, `tests/photo/test_matching.py`, template e dipendenze offline |

Nessuna variazione a fisica, comandi, BOOST, modalità, checkpoint, terreno o collisioni OSM originali. Tutte le scritture GitHub sono sul ramo della PR #4. Main, PR #2/#3 e anteprime precedenti non modificati; nessun merge o servizio a pagamento. Dopo la chiusura del codice e su richiesta esplicita, creata una nuova anteprima privata separata di `2049834`, solo proprietario; nessuna pubblicazione ad accesso pubblico.

## Geografia e grafica realmente migliorate

- **DBGT:** riesaminati i 475 volumi centrali; ogni caso ora ha una classificazione. Dei 439 esclusi, molti sono sottovolumi di sagome OSM più ampie. Quattordici gruppi coincidono bene in pianta ma hanno altezze differenti: una sola altezza sarebbe inventata. Conservate le 36 associazioni già provate, senza cambiare sagome/basi/fallback. Nessuna area geografica aggiunta.
- **Superfici:** strade/corsi d'acqua seguono celle e diagonali dello stesso terreno usato dalle collisioni. Corretto lo scavalcamento/intersezione tra vertici distanti. Nei punti interni del test sull'intero settore lo scarto massimo, tolto l'offset visivo, passa da 4,1994 m a 0,000140 m rispetto alla griglia. Il valore finale è numerico, non accuratezza topografica. Ponti e larghezze non rilevate restano semplificati.
- **Filtro fotografico:** mipmap e anisotropia 2/4/8 limitata all'hardware, cancellazione della decodifica per tessere non più richieste. Strato fotografico ancora disattivato in assenza di immagini autorizzate.

[Confronto prima/dopo, stessa camera](reality-captures/mission2/README.md), con PNG autentici, matrici e diagnostica. Differenza generale ancora modesta. Nella vista Alto 1280×720: 209.686 → 252.416 triangoli (+20,4%), **122 draw call in entrambi**, zero errori JS/caricamento. Il costo aggiunto è dichiarato; nessuna prova di 60 FPS/4K o di prestazioni termiche su iPhone. Tempi di caricamento locali da singole esecuzioni non sono un benchmark comparativo.

## DTM: confronto concluso come diagnosi, sostituzione bloccata

[81 campioni e metodo](research/DTM-COMPARISON.md): media DTM5−TINITALY di gioco −3,979 m, RMSE differenze 7,957 m, estremi −27,963 / +8,188 m. Non è errore misurato su verità a terra. TINITALY originale documenta MSL; mancano prove sulla realizzazione verticale locale e sulla compatibilità con DTM5. Non applicato alcun offset né cambiato terreno/collisioni. Il download regionale completo non è stato ottenuto; i campioni numerici pubblici sono invece archiviati e riproducibili.

## Strumenti preparati, senza fotografie inventate

[Pipeline e budget](PHOTO-TOOLS.md): inventario privato → raggruppamento → tutte le coppie fino a 30 JPG con ORB/RANSAC. Le corrispondenze aiutano a valutare un lotto, non provano percentuali di sovrapposizione o copertura 3D. JPG GPS provati con EXIF in file di test; DJI XMP e DNG reali restano da verificare.

Da un **GLB già ricostruito e posizionato localmente**: LOD 100k/30k/5k triangoli, texture fino a 2K/1K/512, candidato collisioni 2k senza texture. Limiti hard, semplificazione con bordi bloccati, validazione Khronos, hash, metadati privati rimossi e originali immutati. Output esclusivamente privato, nessuna attivazione/distribuzione automatica. Le fixture numeriche hanno verificato gli strumenti; non sono risultati fotogrammetrici su Brembilla.

Non sono stati eseguiti SfM/MVS, prodotte foto/mesh reali, convalidati tetti/facciate, integrato un caricatore runtime di GLB o risolto il datum con un rilievo. Nessuna nuova ortofoto contemporanea con diritti sufficienti è disponibile in questo incremento. Mancano ancora originali di Bruno, permessi per i derivati e controlli geografici indipendenti.

## Test effettivi

- Locale Linux: installazione pulita `npm ci`, **53 TypeScript, 23 Python**, typecheck/build e controllo asset pubblici superati.
- Chromium 153/SwiftShader locale: 2 prove fotografiche touch (19,2 s) e, dopo le superfici, 5 prove settore touch (36,7 s), incluse orientazioni, BOOST multitouch, dati mancanti, fallback DBGT e recupero WebGL. Screenshot della build ispezionati.
- CI `ff83f0f`: tutti i job passati, 48 TypeScript / 16 Python / 37 browser. CI `360f72b` tutta verde.
- CI `bb15596`: tutti i job passati, 51 TypeScript / 20 Python / 37 browser, nessun retry; [run e durate](research/ci-bb15596.json).
- **CI dell'ultimo codice `2049834`: tutti i sei job verdi**, 53 TypeScript / 23 Python / 37 browser, 14 esclusioni per profilo, nessun retry. [Run 38904148835 e tempi dai log](research/ci-2049834.json). Job più lungo: desktop UI 432,7 s; replay 126,0 s. Nessuna correzione necessaria.
- Anteprima privata separata: build/typecheck e controllo asset rieseguiti; 76 file del gioco identici alla build di `2049834`, 2.512.213 byte. Distribuzione Sites conclusa con successo, accesso solo al proprietario. Nessun nuovo test browser sul sito ospitato; nessuna pretesa di collaudo fisico.

WebKit iPhone su runner Linux è una simulazione. Nessun nuovo test fisico su iPhone 12 mini, DualSense, Android, PC con GPU o condizioni termiche/batteria reali. Il giudizio di Davide sul feeling precedente resta separato dai test della nuova build.

## Punto preciso di ripresa

**Ricevere privatamente 15–30 JPG originali sovrapposti di un solo isolato**, con eventuali DNG associati e consenso all'elaborazione. Lo sviluppo eseguirà inventario → assess → matching e revisione delle superfici osservate; poi sceglierà un gruppo DBGT tra i 14 candidati e deciderà se il lotto consente un primo SfM. Bruno e Davide non devono installare software o usare terminali.

In parallelo, prima di fondere quote o collisioni nuove: ottenere specifiche verticali dei prodotti e checkpoint indipendenti. Se le foto non bastano, restituire una lista concreta delle viste mancanti. Dopo una ricostruzione accettata: conversione locale, GLB/LOD privati, controllo UV/silhouette/coordinate e collisioni, quindi integrazione del caricatore. Qualsiasi pubblicazione o sostituzione delle anteprime richiede una nuova autorizzazione.
