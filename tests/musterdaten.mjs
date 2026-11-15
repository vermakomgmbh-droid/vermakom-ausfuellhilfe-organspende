// Erfundene Musterdaten (keine echten Personen).
// HANS = exakt die Daten aus uebernahme/referenz (Board-Probedruck) -> Vergleich mit dem Sollbild.
// ERZSI = Sonderzeichen-Probe (ő, ű, ö, ü, é, í, ó) für HU und AT.
export const HANS = {
  vorname: 'Hans', nachname: 'Muster', geburtsname: '', geschlecht: 'm', gebdat: '02.11.1959', gebort: 'Köln',
  staat: 'deutsch', mutterNach: 'Becker', mutterVor: 'Anna', strasse: 'Fő utca', hausnr: '12', land: 'HU', plz: '8360',
  ort: 'Keszthely', taj: '987 654 321', ausweisart: 'Personalausweis', ausweisnr: 'L01X00T48', svAt: '',
};

export const ERZSI = {
  vorname: 'Erzsébet', nachname: 'Müller-Kővári', geburtsname: 'Szűcs', geschlecht: 'w', gebdat: '17.04.1962', gebort: 'Győr',
  staat: 'deutsch', mutterNach: 'Fűzfa', mutterVor: 'Ilona', strasse: 'Rózsa utca', hausnr: '5/A', land: 'HU', plz: '8380',
  ort: 'Hévíz', taj: '123456789', ausweisart: 'Reisepass', ausweisnr: 'C01X00T47', svAt: '',
};

export const ERSTELLT = new Date(2026, 10, 12);   // 12.11.2026, wie der Board-Probedruck
