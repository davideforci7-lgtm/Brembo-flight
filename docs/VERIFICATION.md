# Verifica BREMBO FLIGHT 0.2

Resoconto in aggiornamento durante lo sviluppo. Non indica una versione finale verificata finché il run CI collegato nella PR non è concluso.

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
