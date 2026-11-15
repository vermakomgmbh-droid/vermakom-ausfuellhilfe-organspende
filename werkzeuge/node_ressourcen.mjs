// Lädt für Node (Tests, Probe) genau die Dateien, die auch der Browser nutzt: Vorlagen, Schrift, fontkit aus site/.
import { readFileSync } from 'node:fs';
import { VORLAGEN } from '../site/lib/organspende.js';

const wurzel = new URL('../', import.meta.url);
export const lesen = (pfad) => new Uint8Array(readFileSync(new URL(pfad, wurzel)));

/** fontkit-UMD-Datei wie im Browser auswerten (dort per <script>, setzt window.fontkit). */
export function fontkitLaden() {
  const quelle = readFileSync(new URL('site/vendor/fontkit.umd.min.js', wurzel), 'utf8');
  const modul = { exports: {} };
  new Function('module', 'exports', quelle)(modul, modul.exports);
  return modul.exports;
}

export function ressourcen() {
  const vorlagen = Object.fromEntries(Object.entries(VORLAGEN).map(([n, v]) => [n, lesen(`site/vorlagen/${v.datei}`)]));
  return { vorlagen, schrift: lesen('site/vendor/schrift/DejaVuSans.ttf'), fontkit: fontkitLaden() };
}
