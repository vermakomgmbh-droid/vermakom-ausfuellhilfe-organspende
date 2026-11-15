// Node-Probe für den Vergleich mit uebernahme/referenz/: gleiche Musterdaten (Hans) und gleiches Datum (12.11.2026)
// wie der Board-Probedruck. Danach: python3 -I werkzeuge/vergleich.py
import { mkdirSync, writeFileSync } from 'node:fs';
import { huPaket, atFormular, personAusEingaben } from '../site/lib/organspende.js';
import { ressourcen } from './node_ressourcen.mjs';
import { HANS, ERSTELLT } from '../tests/musterdaten.mjs';

const aus = new URL('../probe/vergleich/', import.meta.url);
mkdirSync(aus, { recursive: true });
const basis = { ...ressourcen(), erstellt: ERSTELLT, person: personAusEingaben(HANS) };
writeFileSync(new URL('Vergleich_HU_Hans.pdf', aus), (await huPaket(basis)).pdf);
writeFileSync(new URL('Vergleich_AT_Hans.pdf', aus), (await atFormular(basis)).pdf);
console.log('probe/vergleich/Vergleich_HU_Hans.pdf, Vergleich_AT_Hans.pdf geschrieben');
