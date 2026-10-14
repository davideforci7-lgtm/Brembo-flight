// SPDX-License-Identifier: AGPL-3.0-only
import type { Settings } from "./core/settings";
const slider = (
  s: Settings,
  key: keyof Settings,
  label: string,
  min: number,
  max: number,
  step: number,
) =>
  `<label class="setting"><span>${label}<output for="${key}" id="value-${key}">${s[key]}</output></span><input id="${key}" data-setting="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${s[key]}"></label>`;
export function settingsMarkup(s: Settings) {
  return `<h3 class="settings-title">Immagine e prestazioni</h3><div class="settings-grid">
  <label class="setting">Qualità grafica<select id="quality" data-setting="quality">${[
    ["auto", "Automatica · conservativa"],
    ["eco", "Eco · meno pixel"],
    ["balanced", "Bilanciato"],
    ["high", "Alto · più dettaglio e ombra drone"],
  ]
    .map(
      ([v, t]) =>
        `<option value="${v}" ${s.quality === v ? "selected" : ""}>${t}</option>`,
    )
    .join("")}</select></label>
  <div><label class="check-setting"><input id="showFPS" data-setting="showFPS" type="checkbox" ${s.showFPS ? "checked" : ""}>Mostra FPS e risoluzione interna</label><label class="check-setting"><input id="showMap" data-setting="showMap" type="checkbox" ${s.showMap ? "checked" : ""}>Mostra minimappa</label></div></div>
  <h3 class="settings-title">Comandi</h3><div class="settings-grid">
  ${slider(s, "sensitivity", "Sensibilità (tutti gli input)", 0.5, 1.5, 0.05)}
  ${slider(s, "deadzone", "Deadzone controller", 0.04, 0.3, 0.01)}
  ${slider(s, "response", "Progressività stick controller", 1, 2.5, 0.1)}
  <label class="setting">Schema controller<select id="gamepadLayout" data-setting="gamepadLayout"><option value="game" ${s.gamepadLayout === "game" ? "selected" : ""}>Gioco · stesso schema del touch</option><option value="mode2" ${s.gamepadLayout === "mode2" ? "selected" : ""}>Drone Mode 2 · stick scambiati</option></select></label>
  ${slider(s, "touchSize", "Dimensione joystick", 0.8, 1.2, 0.05)}
  ${slider(s, "touchInset", "Distanza dai bordi (px)", 0, 40, 2)}</div>
  <p class="legal">Progressività 1 = lineare. Valori maggiori rendono delicato il centro, mantenendo la massima corsa. Sensibilità 1 conserva la risposta 0.1. La fisica del drone non cambia.</p>
  <h3 class="settings-title">Audio</h3><div class="settings-grid">${slider(s, "motorVolume", "Motori e vento", 0, 1, 0.05)}${slider(s, "effectsVolume", "Checkpoint ed effetti", 0, 1, 0.05)}</div>
  <button id="audio-toggle" class="text-button">Attiva audio</button><p class="legal">Suoni originali generati dal browser. Nessuna musica. L’audio richiede un tocco o un clic.</p>
  <div class="panel-actions"><button id="reset-settings" class="text-button">Ripristina impostazioni</button><button id="export-test" class="text-button">Scarica dati della prova</button></div>`;
}
