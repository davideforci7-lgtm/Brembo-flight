# Verifica BREMBO FLIGHT 0.2

Aggiornamento del 14 ottobre 2026. L’esito dell’ultima esecuzione completa è riportato nei controlli e nel riepilogo della [PR #2](https://github.com/davideforci7-lgtm/Brembo-flight/pull/2). Non considerare verde un’esecuzione annullata o ancora in corso.

## Verifiche locali della correzione

- Installazione pulita `npm ci`: riuscita.
- `npm test`: **30 test superati**, inclusi i 17 test originali della fisica e gli scenari HTTP/HTTPS del server di prova.
- `npm run package:playtest`: compilazione TypeScript, build Vite e generazione pacchetto riuscite. Rimane l’avviso Vite per il modulo Three.js di circa 547 kB minificato / 136 kB gzip; non è stato nascosto.
- Le prove browser locali usano Chromium 153.0.8010.0 Linux headless con SwiftShader. In CI si usano Chromium 145.0.7632.6 e WebKit 26.0 forniti da Playwright 1.58.2.
- Dopo la correzione, replay completo e integrazione controller: **2/2 superati**, rispettivamente 42,8 s e 8,6 s in questa esecuzione locale. Sono durate dei test, non misure delle prestazioni del gioco su un telefono.

## Perché la prima CI si fermava a 15 minuti

La [prima esecuzione della PR](https://github.com/davideforci7-lgtm/Brembo-flight/actions/runs/38443461701) è stata **annullata per timeout**, non superata. Installazione, 29 test allora presenti, build e installazione browser erano riusciti. La suite eseguiva in sequenza tre profili browser nello stesso job: il replay completo richiedeva circa 2,6 minuti per tentativo e il test controller falliva. La CI ha terminato il job prima delle ultime prove WebKit e senza pacchetto finale.

Correzioni:

- Il controller simulato attende stati osservabili `centering` / `ready`, non un intervallo arbitrario di 150 ms. Anche il giocatore vede quando deve rilasciare stick e tasti dopo la pausa. Non si aggira la protezione contro gli input già premuti.
- Il replay mantiene tutti gli 8 checkpoint, gli stessi input standard e la verifica del menù finale a tre dimensioni. Esegue il volo a 800×450 / Eco per contenere il costo del rendering software; la matrice separata continua a verificare Alto e schermi fino a 4K.
- Tre job browser indipendenti, ciascuno con un solo worker, scaricano **la stessa build**. Tutti devono riuscire. `fail-fast: false` permette di completare gli altri controlli anche se uno fallisce.
- Limite di 11 minuti per ogni suite browser e 15 per job: rimane spazio per caricare report e tracce in caso di errore. Non è stato semplicemente aumentato il limite globale.
- Le PR attivano una sola esecuzione, eliminando la doppia CI push + PR sullo stesso ramo. Il push su main e l’avvio manuale rimangono disponibili.
- Il pacchetto `brembo-flight-demo` viene allegato solo dopo il successo di tutti i job browser. Nessun job distribuisce il gioco su un sito.

## Provenienza

Base PR #1 / `feat/first-playable-demo`, commit `f31bea5`. Prima dell’intervento sono stati verificati tutti i rami e le PR: nessun lavoro successivo. Nuovo ramo `feat/v0.2-multiplatform`; main e ramo 0.1 non modificati.

Il collaudo su iPhone 12 mini comunicato da Davide riguarda **0.1**: avvio e percorso completo, volo piacevole; criticità landscape, definizione drone, touch, HUD e audio. È una testimonianza dell’utente, non un test effettuato dall’agente. [Resoconto tecnico 0.1](VERIFICATION-0.1.md).

## Procedura 0.2

- Unit test: fisica e percorso originale, adattatore controller, configurazioni e budget grafici, modalità libera, contratto geografico e protezione file del server locale.
- Browser Chromium/WebKit: avvio, WebGL, JavaScript, input, controller simulato, menù, audio gestuale, download JSON, storage negato, resize e layout.
- Matrice viewport: 320×568, 360×640, 375×629, 667×375, 812×375, 768×1024, 1024×768, 1280×720, 1920×1080, 3840×2160. Gli inset di sicurezza aggiunti nei test sono simulati.
- Replay completo degli anelli con input Gamepad standard e orologio deterministico accelerato: valida integrazione e schermata finale, **non misura FPS reali**.

## Limiti da mantenere espliciti

Nessun DualSense fisico, nessun iPhone/Android/iPad/macOS/Windows reale disponibile all’agente. Chromium Linux headless con rendering software e WebKit emulato non attestano prestazioni GPU, latenza Bluetooth, audio percepito, consumi o temperature. Nessuna misura di “60 FPS garantiti”.

Il test audio verifica creazione dopo gesto e mute/volumi/assenza di errori; non è un ascolto su altoparlanti o cuffie. La qualità sonora richiede il parere del tester. Le mappature non standard sono escluse; niente trigger adattivi, vibrazione o sensori DualSense.

Il server locale non è un servizio internet di produzione. La procedura di certificato HTTPS su iPhone deve essere eseguita dal proprietario sui dispositivi di prova. Nessun hosting o account di terzi è stato configurato.

## Difetti rilevati durante lo sviluppo

- Telemetria inizialmente sopra il drone in verticale: riposizionata in alto e telecamera esterna rifinita.
- Massima distanza dei joystick e safe area simulate restringevano lo spazio centrale: clamp alla larghezza disponibile e pulsanti allineati all’esterno.
- Con safe area laterali la somma delle larghezze dei pannelli superava lo spazio utile: larghezze ora calcolate sull’area realmente disponibile, con test di non sovrapposizione.
- Il download Chromium standard nell’ambiente locale restituiva un archivio non valido: usato Chromium portatile per le prove locali. In CI si usa la distribuzione Playwright standard.
