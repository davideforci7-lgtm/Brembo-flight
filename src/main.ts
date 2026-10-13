// SPDX-License-Identifier: AGPL-3.0-only
import './style.css';
import { DemoTerrain, createTrees } from './core/terrain';
import { createCourse } from './core/course';
import { FlightSimulation } from './core/flight';
import { distance } from './core/math';
import { FlightWorld } from './world';
import { Controls } from './input';
import { FlightAudio } from './audio';
import { mountUI, icon, HUD, formatTime, bestTime, saveBest } from './ui';

mountUI();
const app = document.querySelector<HTMLDivElement>('#app')!;
const modal = document.getElementById('modal-layer')!;
const canvas = document.querySelector<HTMLCanvasElement>('#world')!;

function boot() {
  const terrain = new DemoTerrain(), course = createCourse(terrain), trees = createTrees(terrain);
  const flight = new FlightSimulation(terrain, course, trees);
  const world = new FlightWorld(canvas, terrain, trees, course);
  const hud = new HUD(terrain), sound = new FlightAudio();
  let helpOpen = false, contextLost = false;
  const controls = new Controls(command => {
    if (command === 'pause') togglePause();
    if (command === 'camera') toggleCamera();
    if (command === 'respawn' && !helpOpen) { flight.respawn(); world.resetCamera(); sync(); }
    if (command === 'help') showHelp();
  }, () => {
    flight.pause(); controls.clear(); sync();
  });
  const bind = (id: string, action: () => void) => document.getElementById(id)?.addEventListener('click', action);
  function closeModal() { modal.innerHTML = ''; helpOpen = false; }
  function modalShell(content: string, variant = '') {
    modal.innerHTML = `<section class="panel ${variant}" role="dialog" aria-modal="true" aria-labelledby="panel-title">${content}</section>`;
    if (variant !== 'intro') modal.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
  }
  function showIntro() {
    const best = bestTime();
    modalShell(`<div class="panel-kicker"><span>01</span> IL TUO PRIMO VOLO</div>
      <h1 id="panel-title">Prenditi<br>il <em>cielo.</em></h1>
      <p class="intro-copy">Segui il fiume. Sfiora le cime.<br>Trova la tua linea tra le montagne.</p>
      <div class="intro-specs"><span><b>8</b> CHECKPOINT</span><span><b>∞</b> TENTATIVI</span><span><b>3D</b> LIBERTÀ</span></div>
      <button id="start-button" class="primary">Inizia il volo ${icon('arrow')}</button>
      <div class="intro-bottom"><button id="intro-help" class="text-button">Come si pilota? <span>↗</span></button><span>${best ? `RECORD ${formatTime(best)}` : 'NESSUNA INSTALLAZIONE'}</span></div>
      <div class="intro-note">Scenario alpino inventato. La Val Brembana reale arriverà in una versione futura.</div>`, 'intro');
    bind('start-button', () => { closeModal(); flight.start(); world.resetCamera(); sync(); hud.notify('Attraversa gli anelli arancioni. Rilascia i comandi per stabilizzarti.'); });
    bind('intro-help', showHelp);
  }
  function showHelp() {
    if (helpOpen) { closeHelp(); return; }
    flight.pause(); controls.clear(); helpOpen = true; controls.enabled = false;
    modalShell(`<div class="panel-kicker">SCUOLA DI VOLO</div><h2 id="panel-title">Trova il tuo equilibrio.</h2>
      <p>Attraversa gli <b>8 anelli in ordine</b>, dal lato del precedente. Quello arancione è il prossimo: segui il segnale e la mappa.</p>
      <div class="controls-grid"><div><h3>TASTIERA</h3><dl><dt>W A S D / frecce</dt><dd>Avanti, indietro, laterale</dd><dt>R / F</dt><dd>Sali / scendi</dd><dt>Q / E</dt><dd>Ruota a sinistra / destra</dd><dt>Spazio / Shift</dt><dd>Freno / boost</dd><dt>C · P · X</dt><dd>Telecamera · pausa · recupera</dd></dl></div>
      <div><h3>TOUCH</h3><p><b>Joystick sinistro:</b> movimento.<br><b>Joystick destro:</b> su/giù per la quota, destra/sinistra per ruotare.</p><p>Tieni premuto <b>FRENO</b> o <b>BOOST</b>. In orizzontale hai più spazio.</p></div></div>
      <div class="help-note">Volo assistito: senza comandi il drone rallenta e mantiene la quota. Terreno, acqua, alberi e anello attivo causano urti. Recupero: +5 s al tempo.</div>
      <label class="quality-label">Qualità grafica <select id="quality"><option value="eco" ${world.quality === 'eco' ? 'selected' : ''}>Eco · consigliata su iPhone</option><option value="high" ${world.quality === 'high' ? 'selected' : ''}>Alta · maggiore risoluzione</option></select></label>
      <button id="close-help" class="primary">${flight.status === 'ready' ? 'Torna al decollo' : 'Torna al volo'} ${icon('arrow')}</button>
      <p class="legal">Gratuito · AGPL-3.0 · senza garanzia. <a href="https://github.com/davideforci7-lgtm/Brembo-flight/blob/feat/first-playable-demo/LICENSE" target="_blank" rel="noopener noreferrer">Licenza e sorgenti ↗</a></p>`, 'help');
    bind('close-help', closeHelp);
    document.querySelector<HTMLSelectElement>('#quality')!.addEventListener('change', event => world.setQuality((event.target as HTMLSelectElement).value as 'eco' | 'high'));
    app.dataset.status = flight.status;
  }
  function closeHelp() { closeModal(); flight.resume(); sync(); }
  function togglePause() {
    if (helpOpen) { closeHelp(); return; }
    if (flight.status === 'paused') { closeModal(); flight.resume(); }
    else flight.pause();
    controls.clear(); sync();
  }
  function toggleCamera() {
    world.toggleCamera();
    document.getElementById('camera-mode')!.textContent = world.mode === 'chase' ? 'ESTERNA' : 'FPV';
    app.dataset.camera = world.mode;
    (document.activeElement as HTMLElement | null)?.blur();
  }
  function sync() {
    app.dataset.status = flight.status;
    app.classList.toggle('in-flight', flight.status !== 'ready');
    controls.enabled = flight.status === 'flying' && !helpOpen && !contextLost;
    if (!controls.enabled) controls.clear();
    sound.update(flight.speed, controls.enabled);
    if (helpOpen || contextLost) return;
    if (flight.status === 'ready') showIntro();
    else if (flight.status === 'paused') {
      modalShell(`<div class="panel-kicker">PRENDITI UN RESPIRO</div><h2 id="panel-title">Il cielo ti aspetta.</h2><p>Volo in pausa. Il tempo è fermo.</p><button id="resume-button" class="primary">Riprendi il volo ${icon('arrow')}</button><div class="panel-actions"><button id="restart-button" class="text-button">Ricomincia da zero</button><button id="pause-help" class="text-button">Comandi e qualità</button></div>`);
      bind('resume-button', togglePause); bind('restart-button', restart); bind('pause-help', showHelp);
    } else if (flight.status === 'crashed') {
      modalShell(`<div class="panel-kicker">${flight.crashReason.toUpperCase()}</div><h2 id="panel-title">Si riparte, pilota.</h2><p>Ritorna davanti al prossimo anello.<br>Il percorso resta salvato. Penalità: <b>5 secondi</b>.</p><button id="recover-button" class="primary">Ritorna in volo ${icon('reset')}</button><button id="restart-button" class="text-button secondary-action">Ricomincia da zero</button>`);
      bind('recover-button', () => { closeModal(); flight.respawn(); world.resetCamera(); sync(); }); bind('restart-button', restart);
    } else if (flight.status === 'finished') {
      const record = saveBest(flight.scoreTime);
      modalShell(`<div class="panel-kicker">PERCORSO COMPLETATO · 8 / 8</div><h2 id="panel-title">La valle è tua.</h2><div class="result-time">${formatTime(flight.scoreTime)}</div><p>${record ? 'Il tuo nuovo miglior tempo.' : `Record personale: ${formatTime(bestTime() ?? flight.scoreTime)}`}<br>${flight.crashes} urti · ${flight.penalties} s di penalità.</p><button id="restart-button" class="primary">Un altro giro ${icon('arrow')}</button><p class="legal">Il record è salvato solo su questo browser, se disponibile.</p>`); bind('restart-button', restart);
    } else closeModal();
  }
  function restart() { closeModal(); flight.restart(); controls.clear(); world.resetCamera(); sync(); }
  bind('camera-button', toggleCamera); bind('help-button', showHelp); bind('pause-button', togglePause);
  bind('sound-button', () => {
    void sound.toggle().then(enabled => {
      const button = document.getElementById('sound-button')!;
      button.innerHTML = icon(enabled ? 'sound' : 'muted'); button.setAttribute('aria-label', enabled ? 'Disattiva audio' : 'Attiva audio');
      (document.activeElement as HTMLElement | null)?.blur();
    }).catch(() => hud.notify('Audio non disponibile in questo browser.'));
  });
  const fullscreen = document.getElementById('fullscreen-button')!;
  if (!document.documentElement.requestFullscreen) fullscreen.hidden = true;
  else bind('fullscreen-button', () => {
    const request = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    void request.catch(() => hud.notify('Schermo intero non disponibile. Puoi continuare a giocare.'));
  });
  // Keep keyboard focus inside a displayed dialog.
  document.addEventListener('keydown', event => {
    if (event.key !== 'Tab' || !modal.firstElementChild) return;
    const focusable = Array.from(modal.querySelectorAll<HTMLElement>('button, a, select'));
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
  });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault(); contextLost = true; flight.pause(); controls.enabled = false; controls.clear(); sound.update(0, false);
    modalShell('<div class="panel-kicker">GRAFICA INTERROTTA</div><h2 id="panel-title">Ricarica il paesaggio.</h2><p>Il browser ha interrotto la grafica 3D. Ricarica per tornare al decollo.</p><button id="reload-button" class="primary">Ricarica</button>'); bind('reload-button', () => location.reload());
  });
  let previous = performance.now(), lastHUD = 0;
  function frame(now: number) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - previous) / 1000, 0.1); previous = now;
    if (contextLost || document.hidden) return;
    const event = flight.update(dt, controls.read());
    if (event === 'checkpoint') { sound.chime(); hud.notify(`Anello ${flight.nextCheckpoint} / 8 · ${course[flight.nextCheckpoint].label}`); }
    if (event === 'finished') { sound.chime(); sync(); }
    if (event === 'collision') sync();
    world.render(flight, dt);
    sound.update(flight.speed, flight.status === 'flying');
    if (now - lastHUD > 100) {
      hud.update(flight); lastHUD = now;
      const gate = course[flight.nextCheckpoint];
      if (gate) { const target = world.projectTarget(gate.position); hud.target(target.x, target.y, target.behind, distance(flight.position, gate.position)); }
      else hud.hideTarget();
    }
  }
  sync(); hud.update(flight); requestAnimationFrame(frame);
}
try { boot(); }
catch (error) {
  console.error('BREMBO FLIGHT: avvio non riuscito', error);
  app.dataset.status = 'error';
  modal.innerHTML = `<section class="panel" role="alert"><div class="panel-kicker">GRAFICA 3D NON DISPONIBILE</div><h1>Impossibile decollare.</h1><p>La demo richiede WebGL 2. Prova Safari o Chrome aggiornato e verifica che l’accelerazione grafica sia attiva. Se sei nel browser interno di un’app, apri il link in Safari.</p><button class="primary" id="reload-button">Riprova</button></section>`;
  document.getElementById('reload-button')!.addEventListener('click', () => location.reload());
}
