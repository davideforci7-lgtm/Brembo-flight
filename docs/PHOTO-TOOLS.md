# Strumenti privati pronti per il primo lotto

Stato Missione 2, 16 ottobre 2026. Nessun originale di Bruno ricevuto, nessuna ricostruzione SfM/MVS realmente eseguita. Questi strumenti sono stati collaudati con fixture numeriche generate nei test e cancellate: non costituiscono una dimostrazione fotografica del paese.

## Dal lotto al candidato fotogrammetrico

1. `pipeline.py inventory`: hash, duplicati, metadati camera/GPS/DJI quando leggibili; coordinate GPS numeriche anche dal fallback Pillow, senza ExifTool, diagnosi relativa di nitidezza/esposizione. Nessun originale modificato.
2. `pipeline.py assess`: separazione camera, focale, dimensioni e data; quote DJI/EXIF distinte. GPS non diventa una garanzia di precisione o sovrapposizione.
3. **`match.py`**: tutte le coppie di un lotto di 2–30 JPG unici, massimo 1280 px sul lato lungo e 2.500 feature ORB per immagine. Matching reciproco con ratio test, verifica geometrica RANSAC su omografia, distribuzione delle corrispondenze e componenti connesse. Report privato con versioni, parametri e hash.

Un'omografia verifica struttura proiettiva condivisa, **non** misura una percentuale affidabile di copertura 3D. Una facciata inclinata, vegetazione, riflessi o parallasse possono invalidarla; ripetizioni possono creare falsi positivi. Una rete connessa non prova una mesh completa. Rimangono necessari ispezione visiva, baseline adeguate, SfM, calibrazione e checkpoint indipendenti. I DNG non vengono finti JPG: prima sviluppo coerente su copie, poi nuovo inventario con provenienza conservata.

Riferimento del metodo: [OpenCV, matching e omografia](https://docs.opencv.org/4.x/d1/de0/tutorial_py_feature_homography.html). Implementazione ORB limitata al primo esame, non sostituto di [OpenDroneMap](https://docs.opendronemap.org/outputs/) o [COLMAP](https://colmap.github.io/tutorial.html).

## Da una ricostruzione vera a GLB/LOD

**`prepare-mesh.mjs`** parte da un GLB già ricostruito, texturizzato e posizionato in metri locali (X est, Y alto, Z sud), non da fotografie isolate. Un OBJ ODM deve prima essere convertito conservando CRS, offset, unità e orientamento; il formato OBJ da solo non definisce questi riferimenti. È vietato ricentrare automaticamente il modello e perdere l'origine geografica.

Il comando richiede hash del GLB, consenso all'elaborazione privata e riferimento esplicito. Può preparare derivati **privati per revisione** anche con datum ancora sconosciuto, segnalandone l'allineamento non accettato. Per accettare XY/Z serve il rapporto indipendente esistente, legato allo stesso hash e riferimento. `runtimeEligible` e `redistributionApproved` rimangono comunque falsi: nessun output entra da solo nel gioco o nel repository.

| Derivato per singolo piccolo luogo | Triangoli massimi | Texture, lato massimo | File massimo |
| --- | ---: | ---: | ---: |
| Vicino / PC | 100.000 | 2.048 | 16 MB |
| Medio / mobile | 30.000 | 1.024 | 8 MB |
| Lontano | 5.000 | 512 | 2 MB |
| Candidato collisioni | 2.000 | nessuna | 1 MB |

Input: massimo 100 MB, 2 milioni di triangoli, 8 draw call, 4 texture, una scena statica. URL esterni e formati/estensioni non supportati sono rifiutati. Nessun decoder nuovo nel runtime. glTF Transform + Meshoptimizer eseguono weld/semplificazione con bordi bloccati e errore relativo limitato: se il target non è raggiungibile il comando fallisce, non forza la deformazione. La soglia relativa riguarda il raggio della mesh, non la precisione topografica.

Le texture vengono ridotte dai pixel forniti, senza ingrandimenti o generazione; EXIF/XMP rimossi, nomi/extras glTF rimossi, materiali fotografici con illuminazione già impressa convertiti in `KHR_materials_unlit` per evitare doppia illuminazione. GLB verificati con [Khronos glTF Validator](https://github.com/KhronosGroup/glTF-Validator); hash, triangoli, draw call, bounds, dimensioni texture e memoria stimata con mipmap nel rapporto. Conservati eventuali copyright dell'asset: la pulizia metadata non cancella gli obblighi di attribuzione.

Con quattro texture al limite, stima RGBA+mipmap: circa 85,3 MiB vicino, 21,3 MiB medio, 5,3 MiB lontano **per asset**, prima di terreno, framebuffer, decodifica e driver. Servono piccoli luoghi e caricamento limitato. Queste non sono misure su iPhone. Le texture JPEG/PNG qui riducono traffico, non memoria GPU; KTX2 rimane rinviato finché un caso reale ne dimostra il vantaggio.

Il GLB collisioni è soltanto un candidato: non prova tenuta della mesh o sicurezza dei passaggi, non sostituisce l'indice edifici/terreno funzionante. Il caricatore di mesh e la selezione LOD nel mondo devono essere integrati **dopo** un primo sito validato, con test di memoria, bordi e collisioni. Il caricatore di ortofoto già esistente rimane distinto.

## Verifiche effettive

- GPS JPEG: lettura effettiva dei tag EXIF, emisferi sud/ovest e quota negativa preservati, originali immutati; il datum non diventa verificato.
- Matching: fixture trasformata riconosciuta, immagine uniforme senza falsi collegamenti, originali cambiati e lotti oltre 30 rifiutati; nessuna ricostruzione dichiarata.
- GLB: riduzione su mesh numerica di 20.000 triangoli, quattro export validati, bounds conservati, texture senza EXIF, nomi/extras privati rimossi, source immutata; nessuna approvazione GIS automatica.
- Rifiuto di input senza consenso, hash errato, URL esterni, percorso dentro checkout anche via symlink, sovrascrittura output.
- Dipendenze solo offline/dev; la build del gioco resta identica dopo la loro aggiunta.

**Primo passo sui file reali:** ricevere privatamente 15–30 originali coerenti e il permesso di elaborazione, eseguire inventario → assess → matching, controllare visivamente un solo isolato. Scegliere poi un gruppo DBGT da confrontare e decidere se le immagini bastano per un primo SfM. Nessun terminale o software richiesto a Davide o Bruno.
