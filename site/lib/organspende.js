// Organspende-Widerspruch HU + AT – befüllt die amtlichen PDFs im Browser mit pdf-lib.
// Übernommen aus dem Mandanten-Board (organspende.js, Commit 766269b) und für die öffentliche Ausfüllhilfe angepasst:
//  - eine Person pro Durchgang, keine Paar-/Zeugen-Logik (beide Zeugenfelder bleiben leer, handschriftlich)
//  - Person kommt direkt aus dem Formular (personAusEingaben), nicht aus dem Board-Fallformat
//  - Koordinaten, AT-Feldnamen, Prüfsummen und Datumsformate unverändert aus dem Board
// Die Originale werden unverändert eingebettet (Prüfsumme wird vor dem Befüllen geprüft) und nur überschrieben/ausgefüllt.
// Läuft im Browser und in Node gleich. Keine Netzwerkzugriffe beim Befüllen; Vorlagen, Schrift und fontkit werden übergeben.
//
//  Ungarn (ein PDF):
//    1. Begleitschreiben HU (nur Seite 1, leere Seite 2 entfällt): Absender, Ort/Datum, eine Unterschriftslinie mit Namen
//    2. Protesterklärung (Tiltakozó nyilatkozat), Zeugenfelder leer. Datum jjjj.mm.tt
//    3. Einwilligungserklärung (2 Seiten)
//    4. Begleitschreiben DE als „Kopie für Ihre Unterlagen – nicht einsenden“
//  Österreich (ein PDF): Infoblatt + GÖG-Formular, nur Abschnitt A + Seite 5. Abschnitt B (Vertretung) bleibt unberührt.
//    Datum TT.MM.JJJJ
import { PDFDocument, PDFName, rgb } from '../vendor/pdf-lib.esm.min.js';

export const ZEUGEN_HINWEIS =
  'Unterschrift mit zwei volljährigen Zeugen (Ehepartner und Verwandte erlaubt; Name, Adresse, Ausweisnummer, blaue Tinte), sonst unwirksam';
export const KOPIE_VERMERK = ['KOPIE FÜR IHRE UNTERLAGEN', '– nicht einsenden –'];

/** Amtliche Originale mit SHA-256. Weicht eine Datei ab, wird nicht befüllt. */
export const VORLAGEN = {
  HU_Begleitschreiben_hu: { datei: 'HU_Begleitschreiben_hu.pdf', sha256: 'e215e3741ea0f25edad812f078684b3c99f577072dd36f7bb49a82985083848d' },
  HU_Begleitschreiben_de: { datei: 'HU_Begleitschreiben_de.pdf', sha256: '8fb47e02ddb0fe8790cae622769f1a0875a49b74bf84ee2f18921ce19835e52b' },
  HU_Widerspruch: { datei: 'HU_Widerspruch.pdf', sha256: '1fa9a793ed4dd476c8940d7a5803f253c613b98b96e8d5a225d7e8a6dd885650' },
  HU_Einwilligung: { datei: 'HU_Einwilligung.pdf', sha256: '2c279ad06c776de84e4e2a8791915c19b9d260ba8f513903a82be049bec1e196' },
  AT_Widerspruch: { datei: 'AT_Widerspruch.pdf', sha256: '6c3f88fdf13771d6c45c7637e4b14bd5b55cdffcd9b3de80a7f1511ac87fb66d' },
};
export const VORLAGEN_HU = ['HU_Begleitschreiben_hu', 'HU_Begleitschreiben_de', 'HU_Widerspruch', 'HU_Einwilligung'];
export const VORLAGEN_AT = ['AT_Widerspruch'];

/**
 * Staatsangehörigkeit (Auswahlliste): Schlüssel = deutsche Bezeichnung.
 *  hu: Ausgabe in der ungarischen Protesterklärung („német / deutsch“), at: Ausgabe im GÖG-Formular (Staat).
 * Neue Einträge: ungarische Bezeichnung vorher prüfen lassen.
 */
export const STAATSANGEHOERIGKEITEN = {
  deutsch: { hu: 'német', at: 'Deutschland' },
  österreichisch: { hu: 'osztrák', at: 'Österreich' },
  schweizerisch: { hu: 'svájci', at: 'Schweiz' },
  ungarisch: { hu: 'magyar', at: 'Ungarn' },
  niederländisch: { hu: 'holland', at: 'Niederlande' },
  belgisch: { hu: 'belga', at: 'Belgien' },
  luxemburgisch: { hu: 'luxemburgi', at: 'Luxemburg' },
};

/** Wohnsitzland (Auswahlliste). Kürzel steht im Begleitschreiben („HU - 8360 Keszthely“). */
export const LAENDER = {
  HU: { de: 'Ungarn', hu: 'Magyarország' },
  DE: { de: 'Deutschland', hu: 'Németország' },
  AT: { de: 'Österreich', hu: 'Ausztria' },
  CH: { de: 'Schweiz', hu: 'Svájc' },
};

export const AUSWEISARTEN = ['Reisepass', 'Personalausweis', 'Führerschein'];

const BLAU = rgb(0.05, 0.15, 0.55);
const ROT = rgb(0.6, 0.08, 0.08);

// --- Daten -------------------------------------------------------------------
/** Datum aus „TT.MM.JJJJ“, „JJJJ.MM.TT“, „JJJJ-MM-TT“ oder Date -> {t, m, j} oder null. Ungültige Kalendertage -> null. */
export function datumTeile(x) {
  if (x instanceof Date) return { t: pad(x.getDate()), m: pad(x.getMonth() + 1), j: String(x.getFullYear()) };
  const s = String(x || '').trim();
  let t, m, j, r;
  if ((r = s.match(/^(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})$/))) [t, m, j] = [r[1], r[2], r[3]];
  else if ((r = s.match(/^(\d{4})[.-](\d{1,2})[.-](\d{1,2})\.?$/))) [t, m, j] = [r[3], r[2], r[1]];
  else return null;
  const d = new Date(Number(j), Number(m) - 1, Number(t));
  if (d.getFullYear() !== Number(j) || d.getMonth() !== Number(m) - 1 || d.getDate() !== Number(t)) return null;
  return { t: pad(t), m: pad(m), j };
}
function pad(n) { return String(n).padStart(2, '0'); }
export const datumHU = (d) => (d ? `${d.j}.${d.m}.${d.t}` : '');
export const datumAT = (d) => (d ? `${d.t}.${d.m}.${d.j}` : '');

const sauber = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

/**
 * Person aus den Formulareingaben (alle Werte als Text).
 * @param {object} e  vorname, nachname, geburtsname, geschlecht ('m'|'w'), gebdat, gebort, staat (Schlüssel aus STAATSANGEHOERIGKEITEN),
 *                    mutterNach, mutterVor, strasse, hausnr, land (HU|DE|AT|CH), plz, ort, taj, ausweisart, ausweisnr, svAt
 */
export function personAusEingaben(e) {
  const w = (k) => sauber(e?.[k]);
  const strasseName = w('strasse'), hausnr = w('hausnr');
  const nach = w('nachname');
  const staat = w('staat');
  const tajZiffern = w('taj').replace(/\D/g, '');
  return {
    nach, vor: w('vorname'),
    geburtsnameNach: w('geburtsname') || nach,
    gebdatText: w('gebdat'),
    gebdat: datumTeile(w('gebdat')),
    gebort: w('gebort'),
    mutterNach: w('mutterNach'), mutterVor: w('mutterVor'),
    // TAJ: 9 Ziffern, Ausgabe in Dreiergruppen wie auf der Karte („123 456 789“)
    taj: tajZiffern.length === 9 ? tajZiffern.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3') : w('taj'),
    tajZiffern,
    strasseName, hausnr,
    strasse: [strasseName, hausnr].filter(Boolean).join(' '),
    land: w('land').toUpperCase(), plz: w('plz'), ort: w('ort'),
    staat,
    staatHu: STAATSANGEHOERIGKEITEN[staat]?.hu || '',
    geschlecht: ['m', 'w'].includes(w('geschlecht')) ? w('geschlecht') : '',
    ausweisart: w('ausweisart'),
    ausweisnr: w('ausweisnr'),
    svAt: w('svAt').replace(/\s/g, ''),
  };
}

/** Fehlende oder ungültige Pflichtangaben für 'HU' oder 'AT' (Text für die Anzeige). Leer = vollständig. */
export function fehlendeAngaben(P, land) {
  const f = [];
  const muss = (wert, name) => { if (!wert) f.push(name); };
  muss(P.vor, 'Vorname'); muss(P.nach, 'Nachname');
  if (!P.gebdat) f.push(P.gebdatText ? 'Geburtsdatum (bitte als TT.MM.JJJJ, z. B. 02.11.1959)' : 'Geburtsdatum');
  muss(P.strasseName, 'Straße'); muss(P.hausnr, 'Hausnummer');
  muss(P.land, 'Land'); muss(P.plz, 'PLZ'); muss(P.ort, 'Ort');
  muss(P.staat, 'Staatsangehörigkeit');
  if (land === 'HU') {
    muss(P.gebort, 'Geburtsort');
    muss(P.mutterNach, 'Geburtsname der Mutter (Nachname)');
    muss(P.mutterVor, 'Geburtsname der Mutter (Vorname)');
    if (!P.tajZiffern) f.push('TAJ-Nummer');
    else if (P.tajZiffern.length !== 9) f.push('TAJ-Nummer (9 Ziffern)');
    if (P.staat && !P.staatHu) f.push('Staatsangehörigkeit (bitte aus der Liste wählen)');
  } else {
    muss(P.geschlecht, 'Geschlecht');
    if (P.svAt) {
      if (!/^\d{10}$/.test(P.svAt)) f.push('Österreichische SV-Nummer (10 Ziffern)');
    } else {
      if (!AUSWEISARTEN.includes(P.ausweisart)) f.push('Ausweisart (Reisepass, Personalausweis oder Führerschein)');
      muss(P.ausweisnr, 'Ausweisnummer');
    }
  }
  return f;
}

// --- Vorlagen ----------------------------------------------------------------
async function sha256Hex(bytes) {
  const h = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes));
  return [...h].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Prüft, dass jede benötigte Vorlage dem amtlichen Original entspricht. */
export async function vorlagenPruefen(vorlagen, namen = Object.keys(VORLAGEN)) {
  for (const n of namen) {
    if (!vorlagen[n]) throw new Error(`Vorlage ${VORLAGEN[n].datei} fehlt.`);
    if ((await sha256Hex(vorlagen[n])) !== VORLAGEN[n].sha256) {
      throw new Error(`Vorlage ${VORLAGEN[n].datei} weicht vom amtlichen Original ab. Nicht befüllt.`);
    }
  }
}

/** Browser: lädt Vorlagen und Schrift von der eigenen Seite (einmal beim Seitenaufruf, vor jeder Eingabe). */
export async function ressourcenLaden(basis = '.') {
  const holen = async (pfad) => {
    const r = await fetch(`${basis}/${pfad}`, { cache: 'no-cache', credentials: 'omit' });
    if (!r.ok) throw new Error(`${pfad} nicht ladbar.`);
    return new Uint8Array(await r.arrayBuffer());
  };
  const eintraege = Object.entries(VORLAGEN);
  const [schrift, ...dateien] = await Promise.all([
    holen('vendor/schrift/DejaVuSans.ttf'),
    ...eintraege.map(([, v]) => holen(`vorlagen/${v.datei}`)),
  ]);
  const vorlagen = Object.fromEntries(eintraege.map(([n], i) => [n, dateien[i]]));
  await vorlagenPruefen(vorlagen);
  return { vorlagen, schrift };
}

// --- Gemeinsame Bausteine ----------------------------------------------------
async function neuesDokument(schrift, fontkit, titel) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(schrift, { subset: true });
  metadaten(doc, titel);
  return { doc, font };
}

function metadaten(doc, titel) {
  doc.setTitle(titel);            // keine Namen in den Metadaten
  doc.setAuthor('VerMaKom GmbH');
  doc.setCreator('VerMaKom Ausfüllhilfe');
  doc.setProducer('VerMaKom Ausfüllhilfe');
  doc.setSubject('');
  doc.setKeywords([]);
}

async function seitenKopieren(ziel, vorlage, indizes) {
  const src = await PDFDocument.load(vorlage);
  const seiten = await ziel.copyPages(src, indizes);
  return seiten.map((s) => ziel.addPage(s));
}

/**
 * Text wie in der Python-Probe: (x, y von oben) -> Grundlinie h - y + 2,5.
 * Zu lange Einträge werden verkleinert (bis 6,5 pt), damit nichts über den Seitenrand läuft.
 */
function schreiben(seite, font, eintraege, standard = 10, farbe = BLAU) {
  const h = seite.getHeight();
  const rand = seite.getWidth() - 40;
  for (const [x, yOben, text, groesse = standard] of eintraege) {
    if (!text) continue;
    const t = String(text);
    let g = groesse;
    while (g > 6.5 && x + font.widthOfTextAtSize(t, g) > rand) g -= 0.5;
    seite.drawText(t, { x, y: h - yOben + 2.5, size: g, font, color: farbe });
  }
}

function umbrechen(font, text, groesse, breite) {
  const zeilen = []; let z = '';
  for (const wort of text.split(' ')) {
    const t = z ? z + ' ' + wort : wort;
    if (font.widthOfTextAtSize(t, groesse) > breite && z) { zeilen.push(z); z = wort; } else z = t;
  }
  if (z) zeilen.push(z);
  return zeilen;
}

// --- Ungarn ------------------------------------------------------------------
function huWiderspruch(seite, font, P, ortDatum) {
  const name = `${P.nach} ${P.vor}`;
  schreiben(seite, font, [
    [90, 150, name], [110, 197, name],
    [282, 251, `${P.geburtsnameNach} ${P.vor}`], [330, 279, datumHU(P.gebdat)], [160, 308, P.gebort],
    [338, 336, `${P.mutterNach} ${P.mutterVor}`.trim()], [130, 364, P.taj],
    [150, 393, `${P.plz} ${P.ort}, ${P.strasse}`],
    [210, 421, [P.staatHu, P.staat].filter(Boolean).join(' / ')],
    [130, 497, ortDatum],
  ]);
  // Zeugenfelder (Tanú 1/2) bleiben leer: handschriftlich durch zwei volljährige Zeugen
}

function huEinwilligung(seite, font, P, datum) {
  const l = LAENDER[P.land];
  schreiben(seite, font, [
    [200, 325, P.nach], [170, 341, P.vor], [165, 356, P.taj], [230, 372, datumHU(P.gebdat)],
    [205, 387, P.gebort], [385, 403, P.mutterNach], [380, 418, P.mutterVor],
    [165, 434, l ? `${l.hu} / ${l.de}` : P.land],
    [205, 447, P.plz], [190, 462, P.ort], [250, 478, P.strasse],
    [290, 728, datum],
  ]);
}

/** Begleitschreiben (Originaltext unverändert): Absender, Ort/Datum, eine Unterschriftslinie mit Namen. */
function begleitschreiben(seite, font, P, ortDatum, sprache) {
  const dy = sprache === 'de' ? -8 : 0;
  const name = `${P.vor} ${P.nach}`;
  schreiben(seite, font, [
    [86, 70 + dy, name, 9],
    [86, 82 + dy, P.strasse, 9],
    [86, 94 + dy, `${P.land} - ${P.plz} ${P.ort}`, 9],
    [380, 260 + dy, ortDatum],
  ]);
  const y = (sprache === 'hu' ? 474 : 501) + 40;
  schreiben(seite, font, [[72, y, '_'.repeat(34), 9], [72, y + 13, name, 9]]);
  return y + 45;
}

/**
 * HU-Paket für eine Person: ein PDF.
 * @param {{person:object, erstellt:Date, vorlagen:object, schrift:Uint8Array, fontkit:object}} o
 * @returns {Promise<{pdf:Uint8Array, fehlend:string[]}>}
 */
export async function huPaket({ person: P, erstellt, vorlagen, schrift, fontkit }) {
  if (!P) throw new Error('HU-Paket braucht eine Person.');
  await vorlagenPruefen(vorlagen, VORLAGEN_HU);
  const datum = datumHU(datumTeile(erstellt));
  const ortDatum = `${P.ort}, ${datum}`;   // Ort = Wohnort, Datum = heute
  const { doc, font } = await neuesDokument(schrift, fontkit, 'Organspende-Widerspruch Ungarn');

  const [b1] = await seitenKopieren(doc, vorlagen.HU_Begleitschreiben_hu, [0]);   // leere Seite 2 entfällt
  begleitschreiben(b1, font, P, ortDatum, 'hu');

  const [w] = await seitenKopieren(doc, vorlagen.HU_Widerspruch, [0]);
  huWiderspruch(w, font, P, ortDatum);
  const [e1] = await seitenKopieren(doc, vorlagen.HU_Einwilligung, [0, 1]);
  huEinwilligung(e1, font, P, datum);

  const [b2] = await seitenKopieren(doc, vorlagen.HU_Begleitschreiben_de, [0]);
  const yEnde = begleitschreiben(b2, font, P, ortDatum, 'de');
  // Vermerk „Kopie – nicht einsenden“ rechts neben dem Empfänger (dort ist die Vorlage leer)
  schreiben(b2, font, [[340, 135, KOPIE_VERMERK[0], 12], [340, 152, KOPIE_VERMERK[1], 12]], 12, ROT);
  const zeilen = umbrechen(font, `Hinweis zur Protesterklärung (Tiltakozó nyilatkozat): ${ZEUGEN_HINWEIS}.`, 9, 450);
  schreiben(b2, font, zeilen.map((z, i) => [72, yEnde + 10 + i * 12, z, 9]), 9, ROT);

  return { pdf: await doc.save(), fehlend: fehlendeAngaben(P, 'HU') };
}

// --- Österreich --------------------------------------------------------------
/** Felder, die der Baustein im AT-Formular setzen darf: Abschnitt A, „Art“ und Seite 5. Alles andere bleibt unberührt. */
export const AT_ERLAUBTE_FELDER = new Set([
  'Art', 'Familienname', 'Vorname', 'Tag', 'Tag1', 'Monat', 'Monat1', 'Jahr', 'Jahr1', 'Jahr2', 'Jahr3',
  'Geschlecht.0', 'Straße', 'Hausnr', 'PLZ', 'Ort', 'Bundesland/Staat', 'Staatsbürgerschaft', 'SV-Nummer.0',
  'SV1', 'SV2', 'SV3', 'SV4', 'SV5', 'SV6', 'SV7', 'SV8', 'SV9', 'SV10', 'Ausweis.0', 'Nummer',
  'Bestätigung', 'Kopie', 'Ort Datum',
]);

/** Optionsfeld wählen, ohne das Erscheinungsbild des Originals zu verändern (Zustandsname exakt aus dem PDF). */
function waehlen(form, feldName, option) {
  if (!AT_ERLAUBTE_FELDER.has(feldName)) throw new Error(`Feld ${feldName} ist gesperrt.`);
  const feld = form.getRadioGroup(feldName);
  const widgets = feld.acroField.getWidgets();
  const ziel = widgets.find((w) => w.getOnValue()?.decodeText() === option);
  if (!ziel) throw new Error(`Option ${option} gibt es in ${feldName} nicht.`);
  const an = ziel.getOnValue();
  feld.acroField.dict.set(PDFName.of('V'), an);
  for (const w of widgets) w.setAppearanceState(w === ziel ? an : PDFName.of('Off'));
}

function text(form, font, feldName, wert) {
  if (!AT_ERLAUBTE_FELDER.has(feldName)) throw new Error(`Feld ${feldName} ist gesperrt.`);
  if (!wert) return;
  const f = form.getTextField(feldName);
  f.setText(String(wert));
  f.updateAppearances(font);   // nur dieses Feld neu zeichnen, mit Unicode-Schrift (ő, ű)
}

/**
 * AT-Paket für eine Person: Infoblatt + Formular (das vollständige GÖG-PDF).
 * @param {{person:object, erstellt:Date, vorlagen:object, schrift:Uint8Array, fontkit:object}} o
 * @returns {Promise<{pdf:Uint8Array, fehlend:string[]}>}
 */
export async function atFormular({ person: P, erstellt, vorlagen, schrift, fontkit }) {
  await vorlagenPruefen(vorlagen, VORLAGEN_AT);
  const doc = await PDFDocument.load(vorlagen.AT_Widerspruch);
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(schrift, { subset: true });
  const form = doc.getForm();
  const d = P.gebdat || { t: '', m: '', j: '' };

  waehlen(form, 'Art', 'Aufnahme');
  text(form, font, 'Familienname', P.nach);
  text(form, font, 'Vorname', P.vor);
  [['Tag', d.t[0]], ['Tag1', d.t[1]], ['Monat', d.m[0]], ['Monat1', d.m[1]],
    ['Jahr', d.j[0]], ['Jahr1', d.j[1]], ['Jahr2', d.j[2]], ['Jahr3', d.j[3]]].forEach(([n, v]) => text(form, font, n, v));
  if (P.geschlecht === 'w') waehlen(form, 'Geschlecht.0', 'Weiblich');
  if (P.geschlecht === 'm') waehlen(form, 'Geschlecht.0', 'Männlich');
  text(form, font, 'Straße', P.strasseName);
  text(form, font, 'Hausnr', P.hausnr);
  text(form, font, 'PLZ', P.plz);
  text(form, font, 'Ort', P.ort);
  text(form, font, 'Bundesland/Staat', LAENDER[P.land]?.de || P.land);
  text(form, font, 'Staatsbürgerschaft', STAATSANGEHOERIGKEITEN[P.staat]?.at || P.staat);
  if (/^\d{10}$/.test(P.svAt)) {
    waehlen(form, 'SV-Nummer.0', 'Österreich');
    [...P.svAt].forEach((z, i) => text(form, font, `SV${i + 1}`, z));
  } else {
    waehlen(form, 'SV-Nummer.0', 'andere Staaten');           // „keine österr. SV-Nummer“
    if (AUSWEISARTEN.includes(P.ausweisart)) waehlen(form, 'Ausweis.0', P.ausweisart);
    text(form, font, 'Nummer', P.ausweisnr);
  }
  waehlen(form, 'Bestätigung', 'Wohnadresse');
  waehlen(form, 'Kopie', 'Ja');
  text(form, font, 'Ort Datum', `${P.ort}, ${datumAT(datumTeile(erstellt))}`);

  doc.setTitle('Widerspruch Organentnahme Österreich');   // übrige Metadaten des GÖG-Originals bleiben
  return { pdf: await doc.save({ updateFieldAppearances: false }), fehlend: fehlendeAngaben(P, 'AT') };
}
