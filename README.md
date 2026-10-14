# BREMBO FLIGHT 0.2

Gioco 3D di drone gratuito e open source, direttamente nel browser. **Three.js + TypeScript + Vite**, nessun servizio a pagamento o asset remoto a runtime. Licenza **AGPL-3.0-only**, mantenuta dal repository originale.

Questa fase parte dalla PR #1, commit `f31bea5`, sul ramo dedicato `feat/v0.2-multiplatform`. Nessun merge in `main` e nessuna pubblicazione automatica.

## Cosa cambia

- Interfaccia mobile-first, safe area, menù scorrevoli, joystick adattivi e regolabili. BOOST e FRENO ai lati; minimappa opzionale.
- Gamepad API standard: DualSense e altri controller riconosciuti dal browser. Deadzone radiale, sensibilità e curva progressive, pausa su collegamento/scollegamento durante il volo e riarmo a stick centrati.
- Eco, Bilanciato, Alto e Automatico; budget di pixel, antialiasing se disponibile, aggiornamento canvas su resize/orientamento, campo visivo adattato agli schermi bassi e FPS opzionali.
- Drone più leggibile e rifinito, illuminazione morbida del terreno, crinali connessi, vegetazione ricolorata, acqua animata; ombra dinamica del drone solo in Alto.
- Motori a più componenti, vento ed effetti procedurali; volumi separati e mute totale, attivazione tramite gesto.
- Esplorazione libera oltre agli 8 checkpoint. Impostazioni persistenti, report di prova JSON scaricabile, scheda per il pilota.

**Fisica preservata:** 21 m/s, 34 con BOOST, verticale 11 m/s, rotazione 1,4 rad/s, smorzamento 3 s⁻¹ / 10 s⁻¹ in frenata e passo fisso 1/120 s. La sensibilità predefinita è 1; nessuna modalità avanzata imposta. Il volo è assistito, non una simulazione aeronautica certificata. Cambiare sensibilità/curva modifica gli input, non le equazioni. I record sono separati per impostazioni e le prove con comandi modificati a metà giro non creano record.

## Provarlo

La guida [PLAYTEST](docs/PLAYTEST.md) spiega pacchetto pronto, prova locale su PC, telefono nella stessa Wi-Fi, HTTPS per controller mobile e limiti di riservatezza. Il giocatore usa solo il browser. Il computer personale ospitante richiede Node.

```sh
npm ci
npm run dev
```

Apri l’indirizzo mostrato da Vite, con percorso `/Brembo-flight/`. Per provare la build con codice di accesso:

```sh
npm run playtest
```

Per preparare il pacchetto condivisibile in locale: `npm run package:playtest`. Il workflow CI allega lo stesso pacchetto come artefatto, senza creare un sito pubblico.

## Comandi

| Azione        | Tastiera       | Touch                    | Controller standard / DualSense              |
| ------------- | -------------- | ------------------------ | -------------------------------------------- |
| Movimento     | WASD / frecce  | Stick sinistro           | Stick sinistro                               |
| Sali / scendi | R / F          | Stick destro verticale   | Stick destro verticale                       |
| Ruota         | Q / E          | Stick destro orizzontale | Stick destro orizzontale                     |
| Boost / freno | Shift / Spazio | Tieni BOOST / FRENO      | R2 o R1 / L2 o L1                            |
| Telecamera    | C              | Pulsante camera          | Triangolo / Y                                |
| Pausa         | P / Esc        | Pulsante pausa           | Options / Start                              |
| Recupero      | X              | Menù dopo un urto        | Conferma nel menù                            |
| Menù          | Tab, Invio     | Tocca                    | Croce: naviga/regola; Croce PS / A: conferma |

Schema opzionale “Drone Mode 2”: gli stick si scambiano; sinistro quota/rotazione, destro movimento. È comunque un drone con quota assistita, non un throttle reale da radiocomando. Le mappature non standard vengono segnalate e ignorate. Il freno ha priorità sul boost; tastiera/touch attivi hanno priorità per asse sul controller.

Su iPhone 12 mini **Davide ha completato la demo 0.1** e l’ha giudicata reattiva e piacevole dopo apprendimento. Questo riscontro non è una verifica hardware della 0.2. **DualSense su Safari iOS e prestazioni sui dispositivi fisici restano da collaudare.**

## Grafica

| Preset     | DPR massimo |         Budget buffer | Ombra dinamica             |
| ---------- | ----------: | --------------------: | -------------------------- |
| Eco        |           1 | 1,25 milioni di pixel | No; ombra semplice a terra |
| Bilanciato |         1,5 |           2,2 milioni | No; ombra semplice a terra |
| Alto       |           2 |           4,2 milioni | Drone, mappa 1024²         |

Il budget può ridurre il DPR sui monitor grandi. Automatico parte da Eco su touch/schermi piccoli, Bilanciato sugli altri; dopo almeno 8 secondi consecutivi osservati sotto 42 FPS passa a Eco. Non torna continuamente su e giù e non cambia una scelta manuale. Gli FPS misurano la cadenza del browser, non solo il tempo GPU. Obiettivo 60 FPS dove possibile, **nessuna garanzia su hardware non misurato**.

La minore definizione segnalata in orizzontale aveva due fattori nel codice 0.1: antialiasing disattivato / DPR limitato e FOV verticale fisso, con meno pixel sull’oggetto quando l’altezza diminuisce. La 0.2 corregge questi fattori; il miglioramento percepito sull’iPhone va confrontato fisicamente. La telecamera esterna inquadra il drone più in alto per lasciare libera la zona dei pollici; FPV e collisioni sono invariati.

## Verifiche e limiti

```sh
npm test
npm run build
npx playwright install --with-deps chromium webkit
npm run test:e2e
```

Risultati reali e limiti in [VERIFICATION](docs/VERIFICATION.md). Le prove simulate non equivalgono a test su iPhone, Android o DualSense fisici. Scheda ripetibile: [PILOT-TEST](docs/PILOT-TEST.md).

Il paesaggio resta artistico. [GEOGRAPHY](docs/GEOGRAPHY.md) documenta le fondamenta tecniche, DTM Lombardia / TINITALY / OSM, licenze e media autorizzati per una prima zona reale limitata di Val Brembilla. Streaming e importazione GIS non sono ancora implementati.

## Pubblicazione

Il workflow Pages della 0.2 è **esclusivamente manuale**, con conferma `publish_publicly`; nessuna pubblicazione avviene con push o merge. Non è stato eseguito. GitHub Pages produrrebbe un link accessibile a chiunque, non una prova privata. Il repository e le PR sono già pubblici.

## Struttura

- `src/core/`: simulazione, terreno, checkpoint, input gamepad e budget grafici testabili senza WebGL.
- `src/input.ts`: tastiera/touch/Gamepad API e perdita di focus.
- `src/world.ts`: scena e rendering; `src/audio.ts`: sintesi locale.
- `src/ui.ts`, `src/settings-ui.ts`, `src/main.ts`: HUD, menù e ciclo applicazione.
- `src/geo/contracts.ts`: contratti futuri di coordinate/provenienza/tessere, senza dati inventati.
- `scripts/playtest.mjs`: server locale facoltativo con codice di accesso per sessione.
- `tests/`: test automatici e integrazione browser; `docs/`: collaudo e decisioni.
