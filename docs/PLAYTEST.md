# Provare BREMBO FLIGHT 0.2 senza pubblicarlo

Non è stato creato un sito pubblico. Il repository è pubblico: codice e PR sono leggibili da chiunque. Il gioco gira interamente nel browser; Node serve solo sul computer personale che ospita la prova.

## Sul tuo PC o sul PC del pilota

Opzione più semplice dopo che la CI è verde: apri il run GitHub Actions della PR 0.2, scarica l’artefatto **brembo-flight-demo**, estrailo. Richiede un account GitHub per scaricare l’artefatto e Node.js 24 sul computer ospitante, non sul telefono.

- Windows: apri `AVVIA-WINDOWS.bat`.
- macOS / Linux: apri un terminale nella cartella estratta ed esegui `sh avvia.sh`.
- Apri `http://localhost:4173/` e inserisci il codice mostrato nel terminale.
- Lascia aperto il terminale. Ctrl+C termina la sessione e invalida il codice.

Alternativa dal sorgente, con Git e Node 24:

```sh
git clone --branch feat/v0.2-multiplatform https://github.com/davideforci7-lgtm/Brembo-flight.git
cd Brembo-flight
npm ci
npm run playtest
```

Non serve installare il gioco. Non ci sono account nel gioco, telemetria o acquisti.

## iPhone, Android o tablet sulla stessa Wi-Fi

1. Sul computer personale, avvia dalla cartella estratta `node scripts/playtest.mjs --host 0.0.0.0`. Dal sorgente: `npm run playtest -- --host 0.0.0.0`.
2. Il terminale mostra l’indirizzo locale del computer, ad esempio `http://192.168.1.50:4173/` (esempio, non indirizzo assegnato al tuo PC).
3. Aprilo in Safari / Chrome sul telefono e inserisci il codice. Usa una rete privata; il firewall del PC deve consentire il collegamento dalla rete locale.
4. Ruota il telefono. Apri `?` per joystick, grafica e audio. Il controller potrebbe non essere disponibile su HTTP: per il collaudo mobile del gamepad usa HTTPS.

Per il solo touch HTTP su rete fidata è la via più semplice. Il codice limita l’accesso ma **HTTP non cifra il traffico**. Nessuna porta del router va aperta: non è un server pubblico di produzione.

## HTTPS locale per collaudare il DualSense su iPhone

Passaggio facoltativo, da eseguire esclusivamente sui tuoi dispositivi di prova. Richiede la configurazione iniziale di un certificato locale attendibile. Non è stato eseguito sul tuo iPhone.

1. Installa il progetto gratuito [mkcert](https://github.com/FiloSottile/mkcert) sul PC personale seguendo le istruzioni del suo sistema operativo.
2. Crea una CA locale con `mkcert -install`. In una cartella **fuori dal repository**, genera il certificato, sostituendo l’IP con quello reale del PC:

```sh
mkcert -cert-file brembo-cert.pem -key-file brembo-key.pem localhost 127.0.0.1 192.168.1.50
```

3. Segui la sezione “Mobile devices” di mkcert per installare sul tuo iPhone il solo `rootCA.pem` e abilitare la fiducia. Non condividere mai `rootCA-key.pem` né la chiave del server. Rimuovi il profilo di prova quando non serve più.
4. Avvia `node scripts/playtest.mjs --host 0.0.0.0 --cert /percorso/brembo-cert.pem --key /percorso/brembo-key.pem`.
5. Apri `https://IP-DEL-PC:4173/` in Safari. Il certificato deve risultare attendibile; ignorare un avviso non equivale a un contesto correttamente configurato.
6. [Abbina il DualSense secondo Apple](https://support.apple.com/en-us/111100), premi un tasto e controlla lo stato in `?`. Se il browser non lo espone, resta disponibile il touch.

Il supporto del sistema operativo al DualSense non prova automaticamente il funzionamento della Gamepad API in quella combinazione di browser, versione e connessione.

## Amico a distanza e link

Senza pubblicare nulla, il pilota può scaricare il pacchetto e aprirlo sul proprio PC. Per una prova dal suo telefono serve un computer ospitante nella sua rete, oppure un hosting HTTPS con controllo accessi da scegliere e autorizzare separatamente.

**Un link GitHub Pages non sarebbe privato**: chiunque conosca o trovi l’URL può aprirlo, anche senza promozione. Nessun servizio cloud, tunnel o Codespace è stato attivato. Eventuali quote gratuite di questi servizi non sono considerate una garanzia di costo zero.

Il workflow Pages della 0.2 è solo manuale e richiede la conferma esplicita “publish_publicly”. Non avviarlo per una prova riservata.

## Collaudo breve

- Primo giro in Eco/Automatico, poi confronta Bilanciato e Alto con FPS attivi.
- Prova verticale e orizzontale; regola dimensione e distanza dei joystick.
- Prova il controller a velocità ridotta, disconnettilo e verifica la pausa.
- Usa **Scarica dati della prova** nelle impostazioni e compila [PILOT-TEST.md](PILOT-TEST.md).
- I dati restano locali; il JSON contiene browser, controller e impostazioni, quindi condividilo volontariamente con Davide.
