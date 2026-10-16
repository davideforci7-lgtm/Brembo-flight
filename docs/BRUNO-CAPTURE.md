# Prima consegna di Bruno

L'obiettivo iniziale è un solo luogo riconoscibile del centro di Brembilla e il suo intorno, non tutta la valle. Prima valutiamo quello che Bruno possiede già; eventuali nuove riprese saranno decise con lui, nel rispetto delle autorizzazioni applicabili. Non gli chiediamo di installare programmi o elaborare la ricostruzione.

## File utili

- **JPG originali a piena risoluzione**: evitare screenshot, ritagli, filtri e compressione WhatsApp/Instagram. Conservare nomi e EXIF. DNG originali benvenuti insieme ai JPG associati; lo sviluppo RAW avverrà su copie con impostazioni uniformi.
- Un gruppo **contiguo e sovrapposto dello stesso luogo**, includendo vista dall'alto e oblique da direzioni diverse. Per un primo esame bastano 15–30 file originali rappresentativi; per ricostruire può servire l'intera sequenza, spesso centinaia di scatti. Nessun numero di foto garantisce una mesh completa.
- Per nuove acquisizioni, obiettivo iniziale di lavoro circa **80% sovrapposizione lungo la traiettoria e 75% laterale**, da adattare a rilievo/vegetazione/camera e verificare sulle immagini. Facciate e tetti devono comparire in più viste convergenti; fotografare lo stesso punto da una sola direzione non basta.
- Preferire immagini nitide, esposizione coerente, camera/focale stabili, luce senza forti variazioni tra scatti. Non mescolare sessioni di anni/stagioni diversi nello stesso blocco senza identificarle.
- Video originali MP4/MOV e sidecar SRT/XMP possono aiutare per riferimenti o estrazione selettiva, ma compressione, mosso e intervalli tra fotogrammi spesso li rendono meno adatti dei JPG. Conservare codec, risoluzione e data originali.
- Se già disponibili: RTK/PPK, log di volo, calibrazione, punti rilevati al suolo con **CRS, datum verticale, metodo e precisione**. Segnalare se l'altitudine è relativa al decollo. Nessun dato GPS viene dato per centimetricamente accurato.
- Per ogni lotto: autore/titolare, luogo, data, drone/camera/lente, modifiche effettuate, consenso a elaborare e condizioni di distribuzione di texture/mesh derivate. Nome pubblico da usare nell'attribuzione concordato con Bruno.

## DJI Mini 5 Pro e primo esame

Conservare i file originali della camera, senza convertire i tag GPS o confondere altitudine relativa al decollo e quota assoluta. I metadati sono indizi per l’orientamento iniziale, non un rilievo RTK certificato. Non dedurre precisione topografica dalla precisione di hovering o dai sensori anticollisione del drone. La pipeline legge separatamente i campi DJI disponibili; i DNG richiedono sviluppo coerente e una versione del decoder che riconosca la camera.

I 15–30 file servono a valutare il materiale: non garantiscono un modello. L’esame include gruppi camera/sessione, diagnostica relativa di nitidezza/esposizione, verifica visiva e successivo matching. Nessuna sovrapposizione viene dichiarata soltanto perché le coordinate GPS sono vicine.

## Riservatezza e licenza

Ricezione tramite canale privato concordato: **nessun originale allegato a issue/PR pubbliche**. Prima della distribuzione verificare persone identificabili, targhe, interni, proprietà private e altri dettagli sensibili. Un semplice assenso a “collaborare” non definisce automaticamente una licenza per redistribuire tutti gli originali.

Separare: autorizzazione a elaborare privatamente; permesso/licenza per i derivati web scaricabili; eventuale permesso per gli originali. Preferire una licenza dei derivati compatibile con il progetto aperto, concordata con il titolare (per esempio CC BY 4.0, se accettata). Non cambiare unilateralmente la licenza delle immagini. Il sito può limitare gli accessi, ma gli asset inviati al browser non sono tecnicamente incopiabili.

Il consenso e i dettagli personali restano fuori dal repository. Nei pacchetti pubblicabili entrano attribuzione concordata, licenza, data del rilievo, provenienza e derivati controllati, senza EXIF/GPS dei file di scatto. Le coordinate geografiche del territorio ricostruito sono invece parte intenzionale del modello.

## Cosa faremo appena arrivano i file

1. Inventario privato e hash; verifica metadati, nitidezza, duplicati e copertura. Comunichiamo quali superfici risultano realmente osservate e quali viste mancano.
2. Scegliamo un piccolo blocco coerente, circa un isolato o un edificio con intorno. Stabiliamo controllo geografico e verticale prima dell'allineamento.
3. Ricostruzione pilota offline se il materiale è adatto; rapporto sulle immagini orientate e sui checkpoint indipendenti. Se le foto sono isolate, usiamole solo dove consentono texture/proporzioni verificabili, senza dichiarare una mesh completa.
4. Confronto con DBGT, OSM e DTM, correzione documentata dei conflitti; preparazione dei LOD e pacchetto Three.js limitato.
5. Verifica browser e poi iPhone fisico, confronto visivo con Bruno. Nuova PR verificabile; pubblicazione/anteprima solo su autorizzazione.

Queste operazioni saranno eseguite dallo sviluppo, non richiedono a Davide terminali, Codespaces o software da installare.

La strumentazione di inventario, gruppi di camera, matching e preparazione GLB è descritta in [PHOTO-TOOLS.md](PHOTO-TOOLS.md). È pronta per il primo esame privato; non dimostra una ricostruzione in assenza delle fotografie.
