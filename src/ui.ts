// SPDX-License-Identifier: AGPL-3.0-only
import type { FlightSimulation } from './core/flight';
import type { TerrainProvider } from './core/terrain';
import { distance } from './core/math';

export const icon = (name: 'mountain' | 'camera' | 'pause' | 'help' | 'reset' | 'expand' | 'arrow' | 'sound' | 'muted' | 'code') => {
  const paths = {
    mountain: '<path d="m2 19 7-13 5 8 3-5 5 10H2Z"/><path d="m7 10 2 2 2-2"/>',
    camera: '<path d="M3 7h4l2-3h6l2 3h4v13H3z"/><circle cx="12" cy="13" r="4"/>',
    pause: '<path d="M9 5v14M15 5v14"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4M12 16h.01"/>',
    reset: '<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>',
    expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
    arrow: '<path d="M5 19 19 5M5 5h14v14"/>',
    sound: '<path d="m11 4-6 5H2v6h3l6 5V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
    muted: '<path d="m11 4-6 5H2v6h3l6 5V4Zm5 5 6 6m0-6-6 6"/>',
    code: '<path d="m8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
};
export const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}.${Math.floor(seconds * 10 % 10)}`;
export function mountUI() {
  document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
    <canvas id="world" aria-label="Valle alpina tridimensionale: usa i comandi per pilotare il drone"></canvas>
    <div class="vignette" aria-hidden="true"></div>
    <header class="topbar">
      <a class="brand" href="./" aria-label="Brembo Flight, pagina iniziale">${icon('mountain')}<span>BREMBO <b>FLIGHT</b><small>ESPLORA. RESPIRA. VOLA.</small></span></a>
      <div class="flight-tag"><i></i> <span>VALLE ALPINA</span><span class="tag-divider">/</span><span class="muted">DEMO 01</span></div>
      <nav class="toolbar" aria-label="Opzioni di volo">
        <button id="camera-button" class="icon-button" aria-label="Cambia telecamera" title="Telecamera (C)">${icon('camera')}<span id="camera-mode">ESTERNA</span></button>
        <button id="sound-button" class="icon-button" aria-label="Attiva audio" title="Audio sintetizzato">${icon('muted')}</button>
        <button id="help-button" class="icon-button" aria-label="Mostra comandi" title="Comandi (H)">${icon('help')}</button>
        <button id="pause-button" class="icon-button only-flight" aria-label="Pausa" title="Pausa (P)">${icon('pause')}</button>
        <button id="fullscreen-button" class="icon-button" aria-label="Schermo intero" title="Schermo intero">${icon('expand')}</button>
      </nav>
    </header>
    <div class="mission only-flight">
      <span class="eyebrow">PERCORSO ESPLORAZIONE</span>
      <div class="mission-line"><strong id="checkpoint-count">01 <em>/ 08</em></strong><span id="checkpoint-name">Decollo</span></div>
      <div class="progress-track"><div id="progress-bar"></div></div>
      <div class="mission-meta"><span>PROSSIMO <b id="distance">68 m</b></span><span id="timer">00:00.0</span></div>
    </div>
    <div class="compass only-flight" aria-label="Direzione"><span>O</span><span>·</span><span id="heading">N 000°</span><span>·</span><span>E</span><i></i></div>
    <div id="target-marker" class="only-flight" aria-hidden="true"><span>◇</span><b id="target-distance"></b></div>
    <div id="crosshair" class="only-flight" aria-hidden="true"><i></i><i></i></div>
    <aside class="map-card only-flight" aria-label="Mappa del percorso">
      <div class="map-heading"><span>LA TUA LINEA</span><span>N ↑</span></div><canvas id="minimap" width="320" height="320"></canvas>
      <div class="map-footer"><i></i> TRACCIATO DEMO</div>
    </aside>
    <div class="telemetry only-flight">
      <div><span class="eyebrow">VELOCITÀ</span><strong id="speed">0<small>km/h</small></strong><div class="meter"><i id="speed-meter"></i></div></div>
      <div class="telemetry-divider"></div>
      <div><span class="eyebrow">DAL SUOLO</span><strong id="altitude">9<small>m</small></strong><span id="flight-state" class="flight-state">VOLO ASSISTITO</span></div>
    </div>
    <div class="desktop-hint only-flight"><kbd>W A S D</kbd> muovi <span>·</span> <kbd>R / F</kbd> quota <span>·</span> <kbd>Q / E</kbd> ruota <span>·</span> <kbd>SPAZIO</kbd> frena</div>
    <div class="touch-controls only-flight">
      <div class="stick-group"><span class="stick-label">MUOVI</span><div id="move-stick" class="stick" role="group" aria-label="Joystick movimento"><div class="stick-cross"></div><span class="stick-up">AVANTI</span><div class="stick-thumb"></div></div></div>
      <div class="touch-actions"><button id="boost-button" class="hold-button" aria-label="Tieni premuto per accelerare">BOOST</button><button id="brake-button" class="hold-button brake" aria-label="Tieni premuto per frenare">FRENO</button></div>
      <div class="stick-group"><span class="stick-label">QUOTA / RUOTA</span><div id="look-stick" class="stick" role="group" aria-label="Joystick quota e rotazione"><div class="stick-cross"></div><span class="stick-up">SALI</span><div class="stick-thumb"></div></div></div>
    </div>
    <div id="notice" role="status" aria-live="polite"></div>
    <div id="modal-layer"></div>
    <footer class="footer"><span>TERRENO DIMOSTRATIVO <span class="footer-long">· NON GEOGRAFICO</span></span><a href="https://github.com/davideforci7-lgtm/Brembo-flight" target="_blank" rel="noopener noreferrer">${icon('code')} OPEN SOURCE <span>↗</span></a></footer>
  `;
}
export function bestTime(): number | null {
  try { const n = Number(localStorage.getItem('brembo-flight-best-v1')); return Number.isFinite(n) && n > 0 ? n : null; } catch { return null; }
}
export function saveBest(time: number): boolean {
  const best = bestTime();
  if (best === null || time < best) {
    try { localStorage.setItem('brembo-flight-best-v1', time.toString()); } catch { /* Private mode: flight still works. */ }
    return true;
  }
  return false;
}
export class HUD {
  private map = document.querySelector<HTMLCanvasElement>('#minimap')!;
  private context = this.map.getContext('2d')!;
  private mapBackground = document.createElement('canvas');
  private elements = Object.fromEntries(['checkpoint-count','checkpoint-name','progress-bar','distance','timer','heading','speed','speed-meter','altitude','flight-state','target-marker','target-distance'].map(id => [id, document.getElementById(id)!]));
  private noticeTimer = 0;
  constructor(terrain: TerrainProvider) {
    this.mapBackground.width = 160; this.mapBackground.height = 160;
    const ctx = this.mapBackground.getContext('2d')!;
    for (let y = 0; y < 160; y += 2) for (let x = 0; x < 160; x += 2) {
      const height = terrain.heightAt(x / 160 * 800 - 400, y / 160 * 900 - 630);
      ctx.fillStyle = height < 1.8 ? '#6dada3' : `hsl(151 12% ${18 + Math.min(height, 140) * 0.16}%)`;
      ctx.fillRect(x, y, 2, 2);
    }
  }
  update(flight: FlightSimulation) {
    const e = this.elements, gate = flight.checkpoints[flight.nextCheckpoint];
    e['checkpoint-count'].innerHTML = `${Math.min(flight.nextCheckpoint + 1, 8).toString().padStart(2, '0')} <em>/ 08</em>`;
    e['checkpoint-name'].textContent = gate?.label ?? 'Percorso completato';
    e['progress-bar'].style.width = `${flight.nextCheckpoint / flight.checkpoints.length * 100}%`;
    e.distance.textContent = gate ? `${Math.round(distance(flight.position, gate.position))} m` : 'ARRIVO';
    e.timer.textContent = formatTime(flight.scoreTime);
    const heading = ((-flight.yaw * 180 / Math.PI) % 360 + 360) % 360;
    const cardinal = ['N','NE','E','SE','S','SO','O','NO'][Math.round(heading / 45) % 8];
    e.heading.textContent = `${cardinal} ${Math.round(heading).toString().padStart(3, '0')}°`;
    e.speed.innerHTML = `${Math.round(flight.speed * 3.6)}<small>km/h</small>`;
    e['speed-meter'].style.width = `${flight.speed / 36 * 100}%`;
    e.altitude.innerHTML = `${Math.round(Math.max(0, flight.altitude))}<small>m</small>`;
    const atEdge = Math.abs(flight.position.x) > 660 || Math.abs(flight.position.z) > 660;
    e['flight-state'].textContent = atEdge ? 'LIMITE DELLA MAPPA' : flight.position.y > 260 ? 'QUOTA MASSIMA 270 m' : flight.altitude < 4 ? 'TERRENO VICINO' : 'VOLO ASSISTITO';
    e['flight-state'].classList.toggle('warning', flight.altitude < 4 || atEdge);
    document.querySelector('#app')!.setAttribute('data-checkpoint', flight.nextCheckpoint.toString());
    this.drawMap(flight);
  }
  target(x: number, y: number, behind: boolean, meters: number) {
    const marker = this.elements['target-marker'];
    const outside = behind || Math.abs(x) > 0.82 || Math.abs(y) > 0.72;
    if (behind) { x = x > 0 ? -0.82 : 0.82; y = 0; }
    marker.style.left = `${(Math.max(-0.82, Math.min(0.82, x)) * 0.5 + 0.5) * 100}%`;
    marker.style.top = `${(-Math.max(-0.72, Math.min(0.72, y)) * 0.5 + 0.5) * 100}%`;
    marker.classList.toggle('offscreen', outside);
    marker.firstElementChild!.textContent = outside ? (x < 0 ? '‹' : '›') : '◇';
    this.elements['target-distance'].textContent = `${outside ? 'ANELLO ' : ''}${Math.round(meters)} m`;
    marker.style.visibility = 'visible';
  }
  hideTarget() { this.elements['target-marker'].style.visibility = 'hidden'; }
  notify(message: string) {
    const el = document.getElementById('notice')!; el.textContent = message; el.classList.add('show');
    window.clearTimeout(this.noticeTimer); this.noticeTimer = window.setTimeout(() => el.classList.remove('show'), 3300);
  }
  private drawMap(flight: FlightSimulation) {
    const ctx = this.context, scale = 2;
    ctx.setTransform(scale, 0, 0, scale, 0, 0); ctx.clearRect(0, 0, 160, 160); ctx.drawImage(this.mapBackground, 0, 0);
    const xy = (x: number, z: number) => [(x + 400) / 800 * 160, (z + 630) / 900 * 160];
    ctx.beginPath(); flight.checkpoints.forEach((gate, i) => { const [x, y] = xy(gate.position.x, gate.position.z); if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
    ctx.strokeStyle = '#f3c69399'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
    flight.checkpoints.forEach((gate, i) => {
      const [x, y] = xy(gate.position.x, gate.position.z); ctx.beginPath(); ctx.arc(x, y, i === flight.nextCheckpoint ? 3.8 : 2, 0, Math.PI * 2);
      ctx.fillStyle = i < flight.nextCheckpoint ? '#90d2b4' : i === flight.nextCheckpoint ? '#ffac70' : '#c5c7b9'; ctx.fill();
    });
    const [px, py] = xy(flight.position.x, flight.position.z);
    ctx.save(); ctx.translate(Math.max(6, Math.min(154, px)), Math.max(6, Math.min(154, py))); ctx.rotate(-flight.yaw);
    ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(3.6, 4); ctx.lineTo(0, 2); ctx.lineTo(-3.6, 4); ctx.closePath(); ctx.fillStyle = '#fff7df'; ctx.fill(); ctx.restore();
  }
}
