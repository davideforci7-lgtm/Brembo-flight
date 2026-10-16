# Reality Engine — diagnosi CI del 16 ottobre 2026

Esecuzione iniziale: [38743208183](https://github.com/davideforci7-lgtm/Brembo-flight/actions/runs/38743208183), commit `6151770`.

## Evidenza esaminata

Log completo del job desktop `116450153757`, artifact `11977222770` (77.482.429 byte), entrambi gli `error-context.md` e le tracce Playwright (tentativo iniziale e retry). L'asserzione `finished` scade dopo 150.000 ms: stato ancora `flying`, sette checkpoint superati, ottavo a 40 / 35 metri, tempo simulato 01:15.1 / 01:15.4, velocità 60 km/h. Le tracce mostrano avanzamento ordinato dei checkpoint 0→7; nessuna pausa o collisione nel risultato, nessun errore console registrato. Strato fotografico `disabled`, zero tessere/errori fotografici.

Il replay consuma 0,1 secondi simulati per frame ma attende il rendering software. Il runner completava circa 5 frame/s del test: non è una misura del gioco su hardware del giocatore. Le tracce contengono 540 / 543 immagini screencast. La scadenza è avvenuta mentre il replay continuava ad avanzare, non dopo un mancato checkpoint o un blocco della simulazione. Il secondo tentativo ha poi consumato il budget dello step desktop (11 minuti); il limite del job resta 15 minuti. Non emerge evidenza di una regressione fotografica o di esaurimento memoria.

## Correzione e verifica

- Solo replay: viewport 480×270 invece di 800×450, preset Eco invariato. Le prove layout/risoluzione e le tre dimensioni del menù finale rimangono intatte.
- Traccia del replay: azioni e snapshot DOM conservati, screencast continuo disattivato; screenshot di errore e finale conservati. Le altre suite mantengono la registrazione originale.
- CI: replay in un job desktop separato dai test UI; stessi test, un'esecuzione per test desktop, stessi retry e timeout. Un retry lungo non impedisce l'esecuzione degli altri controlli.
- Nessuna modifica a simulazione, input, percorso o rendering di produzione in questo incremento.

Confronto locale, Linux Chromium 153/SwiftShader: replay Brembilla precedente superato in circa 1,5 minuti; corretto circa 1,0 minuto. Entrambi i replay corretti superati (demo 32,7 s, Brembilla circa 1 min; suite circa 1,7 min), inclusi arrivo a 8 checkpoint, rotazioni del menù finale e ripartenza. Il confronto non isola il costo delle due ottimizzazioni: dimostra la riduzione combinata del lavoro del test. Nessun FPS iPhone dedotto.

Nello stesso incremento: 13 test Python superati e typecheck passato. Inclusa la correzione già locale che rifiuta GeoTIFF a quattro bande se la quarta è spettrale invece di alpha. La CI del nuovo commit è da leggere separatamente nei Checks della PR #4; questi risultati locali non la sostituiscono.
