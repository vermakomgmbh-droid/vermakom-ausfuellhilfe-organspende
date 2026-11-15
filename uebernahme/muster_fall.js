// Erfundene Musterdaten (keine echten Kunden) im Fallformat der Offline-App, ergänzt um die neuen Stammdatenfelder.
// Werte wie in der Python-Probe (fuellen_probe.py), damit sich beide Probedrucke vergleichen lassen.
import { NEUE_STAMMFELDER as F } from '../app/lib/organspende.js';

const ab = (A, B, beide = '') => ({ A, B, beide });

export const MUSTER_FALL = {
  stamm: {
    'Nachname, Vorname': ab('Muster, Hans', 'Muster, Erika'),
    'Geburtsname (falls abweichend)': ab('', ''),
    'Geburtsdatum': ab('02.11.1959', '17.04.1962'),
    'Geburtsort': ab('Köln', 'Mönchengladbach'),
    'Staatsangehörigkeit': ab('', '', 'deutsch'),
    'Geburtsname der Mutter': ab('Becker, Anna', 'Schmitz, Maria'),
    'Straße, Hausnummer': ab('', '', 'Fő utca 12'),
    'Land - PLZ, Ort': ab('', '', 'HU - 8360 Keszthely'),
    'Nummer der TAJ-Karte': ab('987 654 321', '123 456 789'),
    'Personalausweis-/Reisepassnummer': ab('L01X00T48', 'C01X00T47'),
    [F.geschlecht]: ab('m', 'w'),
    [F.ausweisart]: ab('Personalausweis', 'Reisepass'),
    [F.svAt]: ab('', ''),
    [F.staatHu]: ab('', '', 'német'),
    [F.mutterNach]: ab('Becker', 'Schmitz'),
    [F.mutterVor]: ab('Anna', 'Maria'),
  },
  fam: { A: 'verheiratet', B: 'verheiratet' },
  organspende: { A: { at: true }, B: { at: true } },   // AT ausdrücklich gewählt; HU ergibt sich aus V02|K065
  docs: { V02: { opt: { 'V02|K065': { A: true, B: true } }, pers: {}, extra: {} } },
};

export const MUSTER_ERSTELLT = new Date(2026, 10, 12);   // 12.11.2026, wie die Python-Probe
