# Verifica della demo

Verifiche svolte il **13 ottobre 2026** sulla prima versione del ramo `feat/first-playable-demo`.

## Risultati locali confermati

| Verifica                                             | Esito                                                                                              |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `npm test`                                           | **17 test superati**                                                                               |
| `npm run build`                                      | **Superato**, TypeScript rigoroso e build Vite                                                     |
| Browser Chromium desktop, 1440 × 900 CSS px          | **3 scenari superati**: avvio/interfaccia, volo/urto/recupero, storage/WebGL                       |
| Browser Chromium touch, 375 × 629 e 812 × 375 CSS px | **4 scenari superati**: avvio/interfaccia, multitouch nativo, layout/rilascio input, storage/WebGL |
| Errori JavaScript non gestiti nei 7 scenari          | **Nessuno rilevato**                                                                               |
| Controllo visivo degli screenshot desktop e mobile   | **Eseguito**                                                                                       |
| `git diff --check`                                   | **Superato**                                                                                       |

Il comando browser ha concluso con **7 passed, 3 skipped**: i tre casi saltati sono scenari intenzionalmente non applicabili alla piattaforma (tastiera su touch, touch su desktop). Nessun test applicabile è stato escluso per far passare la suite.

La simulazione è stata completata dall'inizio all'ultimo anello tramite comandi di velocità, **senza teletrasportare il drone**. Questo è un test del motore: il test browser da tastiera attraversa il primo checkpoint, frena, scende fino all'urto e recupera mantenendo il progresso. Il multitouch nativo è stato iniettato con due contatti del browser Chromium tramite CDP; la suite aggiunge una prova di eventi PointerEvent per rilascio e cancellazione.

Le prove usano il contenuto di `dist/` sotto `/Brembo-flight/`, lo stesso sottopercorso previsto su GitHub Pages. Nessun test richiede hook di controllo o API di debug nel gioco.

## Ambiente e limiti

- Node.js **24.19.0**; Vite **8.3.4**; Three.js **0.186.1**; TypeScript **5.9.3**.
- Playwright **1.58.2** con Chromium headless **153.0.8010.0**, rendering software SwiftShader. Il browser portabile è stato usato solo nell'ambiente di verifica, non aggiunto alle dipendenze dell'applicazione.
- Il download Chromium standard di Playwright restituiva un archivio non valido nell'ambiente locale. La configurazione permette di indicare un eseguibile già disponibile con `BREMBO_CHROMIUM_EXECUTABLE`; la CI usa i browser standard di Playwright.
- **WebKit locale non eseguito**: il browser è stato scaricato, ma mancavano librerie GTK/GStreamer e altri componenti; l'ambiente non ha consentito l'installazione delle dipendenze di sistema. Non è un risultato positivo né un difetto dimostrato del gioco.
- **Nessuna prova su iPhone fisico**, Safari iOS reale, schermo con notch/safe area reale, prestazioni, consumo batteria, temperatura, audio percepito o sospensione del sistema operativo. L'emulazione non sostituisce queste prove.
- Il limite di 100 ms per fotogramma evita salti dopo sospensioni: sotto 10 fps il tempo simulato rallenta. Le prestazioni hardware non sono misurate da questi test.
- La build segnala un chunk Three.js oltre 500 kB minificato (circa **135 kB gzip**); avviso non bloccante. Gli asset iniziali compressi ammontano a circa **155 kB**, senza asset grafici remoti.

## GitHub Actions e pubblicazione

Il workflow `Verify playable demo` verifica anche WebKit in un ambiente GitHub Actions. Consultare il risultato del workflow sul commit corrente: il risultato locale sopra non implica che una nuova esecuzione remota sia riuscita.

La [prima esecuzione remota](https://github.com/davideforci7-lgtm/Brembo-flight/actions/runs/38400969461), sul commit `5abf2f3`, ha completato installazione, 17 test unitari, build e suite browser, compresi **tre scenari WebKit**. Il riepilogo browser è stato `9 passed, 1 flaky, 5 skipped`: il controllo del cronometro in pausa su Chromium touch è passato al secondo tentativo. Il log ha mostrato un aggiornamento tardivo di un decimo nel solo HUD. È stata quindi corretta la sincronizzazione dell'interfaccia: quando si entra in pausa, il tempo visualizzato viene aggiornato immediatamente. La PR riporta anche l'esito della successiva verifica sul commit finale.

La pubblicazione GitHub Pages è **predisposta ma non eseguita** da queste prove. La build richiede l'attivazione di Pages con sorgente GitHub Actions e l'integrazione in `main`, come descritto nel README. L'URL pubblico previsto non è una prova di deployment.

## Prova manuale consigliata su iPhone 12 mini

1. Apri il link pubblicato in Safari e ruota il telefono in orizzontale.
2. Avvia con qualità Eco. Muovi entrambi i joystick insieme: sinistro in avanti, destro verso l'alto.
3. Rilascia entrambi: il drone deve rallentare e mantenere la quota raggiunta.
4. Attraversa il primo anello; scendi fino al terreno e usa **Ritorna in volo**.
5. Cambia visuale, prova il freno e il boost, apri la guida e riprendi.
6. Cambia app e torna a Safari: il volo deve essere in pausa. Riprendi per continuare.
7. Prova una sessione di almeno 5 minuti e valuta fluidità e temperatura. Non è stato ancora verificato su hardware reale.
