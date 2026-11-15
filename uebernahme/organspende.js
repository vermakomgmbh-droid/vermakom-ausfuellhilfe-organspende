// Organspende-Widerspruch HU + AT (Anleitung 5.4) – befüllt die amtlichen PDFs im Browser mit pdf-lib.
// Vorlage für Koordinaten und Feldnamen: organspende/fuellen_probe.py (Python-Probe).
// Die Originale werden unverändert eingebettet (Prüfsumme wird vor dem Befüllen geprüft) und nur überschrieben/ausgefüllt.
// Läuft im Browser und in Node gleich (keine Netzwerkzugriffe; Vorlagen, Schrift und fontkit werden übergeben).
//
//  Ungarn, ein PDF pro Paar:
//    1. Begleitschreiben HU (nur Seite 1) mit Absender (beide Namen, Anschrift), Ort, Erstellungsdatum, je Partner Unterschriftslinie
//    2. je Partner Protesterklärung (Tiltakozó nyilatkozat) + Einwilligungserklärung (2 Seiten)
//    3. Begleitschreiben DE als Kunden-Kopie (mit Zeugen-Hinweis)
//    Zeuge 1 = Ehe-/Lebenspartner (verheiratet oder eingetragene Lebenspartnerschaft), Zeuge 2 bleibt leer. Datum jjjj.mm.tt.
//  Österreich, je Partner: GÖG-Formular, nur Abschnitt A + Seite 5. Abschnitt B (gesetzliche Vertretung) wird NICHT angefasst.
//    Datum TT.MM.JJJJ.
import { PDFDocument, PDFName, rgb } from '../vendor/pdf-lib.esm.min.js';

export const ZEUGEN_HINWEIS = 'Unterschrift mit zwei Zeugen (Name, Adresse, Ausweisnummer, blaue Tinte), sonst unwirksam';
/** Hinweis, wenn Zeuge 1 (Ehe-/Lebenspartner) vorbefüllt ist. Laut Gábor dürfen sich Ehepartner gegenseitig bezeugen;
 *  Bernd 13.11.2026: ebenso eingetragene Lebenspartner, unverheiratete Paare nicht. */
export const ZWEITER_ZEUGE_HINWEIS =
  'Zeuge 1 ist der Ehe-/Lebenspartner (vorbefüllt). Zweiter Zeuge erforderlich (Name, Adresse, Ausweisnummer, Unterschrift in blauer Tinte), sonst unwirksam';
/** Familienstände, bei denen der Partner Zeuge 1 sein darf. */
export const ZEUGE_FAMILIENSTAENDE = ['verheiratet', 'eingetragene Lebenspartnerschaft'];

/** Amtliche Originale mit SHA-256. Weicht eine Datei ab, wird nicht befüllt. */
export const VORLAGEN = {
  HU_Begleitschreiben_hu: { datei: 'HU_Begleitschreiben_hu.pdf', sha256: 'e215e3741ea0f25edad812f078684b3c99f577072dd36f7bb49a82985083848d' },
  HU_Begleitschreiben_de: { datei: 'HU_Begleitschreiben_de.pdf', sha256: '8fb47e02ddb0fe8790cae622769f1a0875a49b74bf84ee2f18921ce19835e52b' },
  HU_Widerspruch: { datei: 'HU_Widerspruch.pdf', sha256: '1fa9a793ed4dd476c8940d7a5803f253c613b98b96e8d5a225d7e8a6dd885650' },
  HU_Einwilligung: { datei: 'HU_Einwilligung.pdf', sha256: '2c279ad06c776de84e4e2a8791915c19b9d260ba8f513903a82be049bec1e196' },
  AT_Widerspruch: { datei: 'AT_Widerspruch.pdf', sha256: '6c3f88fdf13771d6c45c7637e4b14bd5b55cdffcd9b3de80a7f1511ac87fb66d' },
};

/** Neue Stammdatenfelder (Anleitung 5.4). Gleiche Struktur wie die übrigen Stammdaten: {A, B, beide}. */
export const NEUE_STAMMFELDER = {
  geschlecht: 'Geschlecht',                                   // 'm' | 'w'
  ausweisart: 'Ausweisart',                                   // 'Reisepass' | 'Personalausweis' | 'Führerschein'
  svAt: 'Österreichische SV-Nummer (optional)',               // 10 Ziffern
  staatHu: 'Staatsangehörigkeit (ungarisch)',                 // z. B. 'német'
  mutterNach: 'Geburtsname der Mutter – Nachname',
  mutterVor: 'Geburtsname der Mutter – Vorname',
};

const BLAU = rgb(0.05, 0.15, 0.55);
const ROT = rgb(0.6, 0.08, 0.08);
const LAENDER = { HU: 'Ungarn', DE: 'Deutschland', AT: 'Österreich', CH: 'Schweiz' };
const STAATEN = { deutsch: 'Deutschland', österreichisch: 'Österreich', ungarisch: 'Ungarn', schweizerisch: 'Schweiz' };
const AUSWEISARTEN = ['Reisepass', 'Personalausweis', 'Führerschein'];

// --- Daten -------------------------------------------------------------------
/** Datum aus „TT.MM.JJJJ“, „JJJJ.MM.TT“, „JJJJ-MM-TT“ oder Date -> {t, m, j} (zweistellig/vierstellig) oder null. */
export function datumTeile(x) {
  if (x instanceof Date) return { t: pad(x.getDate()), m: pad(x.getMonth() + 1), j: String(x.getFullYear()) };
  const s = String(x || '').trim();
  let r = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (r) return { t: pad(r[1]), m: pad(r[2]), j: r[3] };
  r = s.match(/^(\d{4})[.-](\d{1,2})[.-](\d{1,2})\.?$/);
  if (r) return { t: pad(r[3]), m: pad(r[2]), j: r[1] };
  return null;
}
function pad(n) { return String(n).padStart(2, '0'); }
export const datumHU = (d) => (d ? `${d.j}.${d.m}.${d.t}` : '');
export const datumAT = (d) => (d ? `${d.t}.${d.m}.${d.j}` : '');

function teilen(text) {
  const [a, ...b] = String(text || '').split(',');
  return [a.trim(), b.join(',').trim()];
}

/**
 * Organspende-Auswahl je Partner.
 *  HU: V02 Abschnitt 5 „Nein – widersprochen (nach ungarischem Recht)“ (V02|K065) ODER ausdrücklich gewählt (fall.organspende[P].hu).
 *  AT: nur ausdrücklich gewählt (fall.organspende[P].at) – in den Vorlagen gibt es dafür kein Kästchen.
 */
export function organspendeAuswahl(fall, P) {
  const ausV02 = fall?.docs?.V02?.opt?.['V02|K065']?.[P] === true;
  const o = fall?.organspende?.[P] || {};
  return { hu: ausV02 || o.hu === true, huAusV02: ausV02, at: o.at === true };
}

/** Partner (A/B) mit Organspende-Widerspruch für 'HU' oder 'AT'. */
export function partnerMitOrganspende(fall, land) {
  const k = land === 'AT' ? 'at' : 'hu';
  return ['A', 'B'].filter((p) => organspendeAuswahl(fall, p)[k]);
}

/** Partner mit Widerspruch Ungarn (HU-Paket). */
export function partnerMitWiderspruch(fall) { return partnerMitOrganspende(fall, 'HU'); }

/** Zusätzliche Pflicht-Stammdaten, wenn Organspende gewählt ist (Bernd 13.11.2026). */
export const ORGANSPENDE_PFLICHT = {
  HU: ['Nummer der TAJ-Karte', NEUE_STAMMFELDER.mutterNach, NEUE_STAMMFELDER.mutterVor, NEUE_STAMMFELDER.ausweisart, 'Personalausweis-/Reisepassnummer'],
  AT: [NEUE_STAMMFELDER.mutterNach, NEUE_STAMMFELDER.mutterVor, NEUE_STAMMFELDER.ausweisart, 'Personalausweis-/Reisepassnummer'],
};

/** Zeugenangaben aus den Stammdaten einer Person (für Zeuge 1 im HU-Widerspruch). */
export function zeugeAusPerson(Q) {
  return {
    name: `${Q.nach} ${Q.vor}`.trim(),
    adresse: [`${Q.plz} ${Q.ort}`.trim(), Q.strasse].filter(Boolean).join(', '),
    ausweis: Q.ausweisnr,
  };
}

/**
 * Personen für das HU-Paket aus einem Fall: alle Partner mit „Nein – widersprochen“ (V02|K065).
 * Zeuge 1 = Ehe-/Lebenspartner, nur wenn der Familienstand der Person „verheiratet“ oder „eingetragene Lebenspartnerschaft“ ist
 * und der andere Partner einen Namen hat (unverheiratete Paare: kein Zeuge). Gilt auch, wenn der Partner selbst nicht widerspricht.
 */
export function personenFuerHU(fall) {
  return partnerMitWiderspruch(fall).map((p) => {
    const P = personAusFall(fall, p);
    const anderer = p === 'A' ? 'B' : 'A';
    const Q = personAusFall(fall, anderer);
    if (ZEUGE_FAMILIENSTAENDE.includes(String(fall?.fam?.[p] || '')) && Q.nach) P.zeuge1 = zeugeAusPerson(Q);
    return P;
  });
}

/** Person aus den Stammdaten eines Falls (Format der Offline-App, Partner 'A' oder 'B'). */
export function personAusFall(fall, partner) {
  const s = fall?.stamm || {};
  const w = (feld) => String(s[feld]?.[partner] || '').trim() || String(s[feld]?.beide || '').trim();
  const [nach, vor] = teilen(w('Nachname, Vorname'));
  let mutterNach = w(NEUE_STAMMFELDER.mutterNach), mutterVor = w(NEUE_STAMMFELDER.mutterVor);
  if (!mutterNach && !mutterVor) [mutterNach, mutterVor] = teilen(w('Geburtsname der Mutter'));
  const lpo = w('Land - PLZ, Ort').match(/^\s*([A-Za-z]{2})\s*-\s*(\S+)\s+(.+)$/);
  const g = w(NEUE_STAMMFELDER.geschlecht).toLowerCase();
  return {
    partner, nach, vor,
    geburtsnameNach: w('Geburtsname (falls abweichend)') || nach,
    gebdat: datumTeile(w('Geburtsdatum')),
    gebort: w('Geburtsort'),
    mutterNach, mutterVor,
    taj: w('Nummer der TAJ-Karte'),
    strasse: w('Straße, Hausnummer'),
    land: lpo ? lpo[1].toUpperCase() : '', plz: lpo ? lpo[2] : '', ort: lpo ? lpo[3].trim() : '',
    staat: w('Staatsangehörigkeit'),
    staatHu: w(NEUE_STAMMFELDER.staatHu),
    geschlecht: g.startsWith('w') ? 'w' : g.startsWith('m') ? 'm' : '',
    ausweisart: w(NEUE_STAMMFELDER.ausweisart),
    ausweisnr: w('Personalausweis-/Reisepassnummer'),
    svAt: w(NEUE_STAMMFELDER.svAt).replace(/\s/g, ''),
  };
}

/** Fehlende Pflichtangaben (Text für die Anzeige). Leer = vollständig. */
export function fehlendeAngaben(P, land) {
  const f = [];
  const muss = (wert, name) => { if (!wert) f.push(name); };
  muss(P.nach, 'Nachname'); muss(P.vor, 'Vorname'); muss(P.gebdat, 'Geburtsdatum');
  muss(P.strasse, 'Straße, Hausnummer'); muss(P.plz, 'PLZ'); muss(P.ort, 'Ort');
  if (land === 'HU') {
    muss(P.gebort, 'Geburtsort'); muss(P.mutterNach, 'Geburtsname der Mutter (Nachname)');
    muss(P.mutterVor, 'Geburtsname der Mutter (Vorname)'); muss(P.taj, 'TAJ-Nummer');
    muss(P.staat, 'Staatsangehörigkeit'); muss(P.staatHu, 'Staatsangehörigkeit (ungarisch)');
  } else {
    muss(P.geschlecht, 'Geschlecht'); muss(P.land, 'Land'); muss(P.staat, 'Staatsangehörigkeit');
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

/** Browser: lädt Vorlagen und Schrift von der eigenen Seite. */
export async function ressourcenLaden(basis = '.') {
  const holen = async (pfad) => {
    const r = await fetch(`${basis}/${pfad}`, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`${pfad} nicht ladbar.`);
    return new Uint8Array(await r.arrayBuffer());
  };
  const vorlagen = {};
  for (const [n, v] of Object.entries(VORLAGEN)) vorlagen[n] = await holen(`vorlagen/organspende/${v.datei}`);
  return { vorlagen, schrift: await holen('vendor/schrift/DejaVuSans.ttf') };
}

// --- Gemeinsame Bausteine ----------------------------------------------------
async function neuesDokument(schrift, fontkit, titel) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(schrift, { subset: true });
  doc.setTitle(titel);            // keine Namen in den Metadaten
  doc.setAuthor('VerMaKom GmbH');
  doc.setCreator('VerMaKom Mandanten-Board');
  return { doc, font };
}

async function seitenKopieren(ziel, vorlage, indizes) {
  const src = await PDFDocument.load(vorlage);
  const seiten = await ziel.copyPages(src, indizes);
  return seiten.map((s) => ziel.addPage(s));
}

/** Text wie in der Python-Probe: (x, y von oben) -> Grundlinie h - y + 2,5 */
function schreiben(seite, font, eintraege, standard = 10, farbe = BLAU) {
  const h = seite.getHeight();
  for (const [x, yOben, text, groesse = standard] of eintraege) {
    if (!text) continue;
    seite.drawText(String(text), { x, y: h - yOben + 2.5, size: groesse, font, color: farbe });
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
  // Zeuge 1 (linke Spalte) – nur wenn vorbefüllt; Zeuge 2 bleibt immer leer
  if (P.zeuge1) {
    const z = P.zeuge1;
    for (const [x, y, t, breite] of [[104, 646, z.name, 186], [110, 674.4, z.adresse, 180], [132, 702.9, z.ausweis, 158]]) {
      if (!t) continue;
      let g = 10;
      while (g > 6.5 && font.widthOfTextAtSize(t, g) > breite) g -= 0.5;   // lange Adressen verkleinern statt überlaufen
      schreiben(seite, font, [[x, y, t, g]]);
    }
  }
}

function huEinwilligung(seite, font, P, datum) {
  schreiben(seite, font, [
    [200, 325, P.nach], [170, 341, P.vor], [165, 356, P.taj], [230, 372, datumHU(P.gebdat)],
    [205, 387, P.gebort], [385, 403, P.mutterNach], [380, 418, P.mutterVor],
    [165, 434, P.land === 'HU' ? 'Magyarország / Ungarn' : (LAENDER[P.land] || P.land)],
    [205, 447, P.plz], [190, 462, P.ort], [250, 478, P.strasse],
    [290, 728, datum],
  ]);
}

function begleitschreiben(seite, font, personen, ortDatum, sprache) {
  const P = personen[0];
  const dy = sprache === 'de' ? -8 : 0;
  schreiben(seite, font, [
    [86, 70 + dy, personen.map((Q) => `${Q.vor} ${Q.nach}`).join(' / '), 9],
    [86, 82 + dy, P.strasse, 9],
    [86, 94 + dy, `${P.land} - ${P.plz} ${P.ort}`, 9],
    [380, 260 + dy, ortDatum],
  ]);
  let y = (sprache === 'hu' ? 474 : 501) + 40;
  for (const Q of personen) {
    schreiben(seite, font, [[72, y, '_'.repeat(34), 9], [72, y + 13, `${Q.vor} ${Q.nach}`, 9]]);
    y += 45;
  }
  return y;
}

/**
 * HU-Paket für ein Paar (oder eine Person): ein PDF.
 * @param {{personen:object[], erstellt:Date, ort?:string, vorlagen:object, schrift:Uint8Array, fontkit:object}} o
 * @returns {Promise<{pdf:Uint8Array, fehlend:Object<string,string[]>, hinweise:string[]}>}
 */
export async function huPaket({ personen, erstellt, ort, vorlagen, schrift, fontkit }) {
  if (!personen?.length || personen.length > 2) throw new Error('HU-Paket braucht eine oder zwei Personen.');
  await vorlagenPruefen(vorlagen, ['HU_Begleitschreiben_hu', 'HU_Begleitschreiben_de', 'HU_Widerspruch', 'HU_Einwilligung']);
  const datum = datumHU(datumTeile(erstellt));
  const ortDatum = `${ort || personen[0].ort}, ${datum}`;
  const { doc, font } = await neuesDokument(schrift, fontkit, 'Organspende-Widerspruch Ungarn');
  const alleMitZeuge = personen.every((P) => P.zeuge1);
  const zeugenText = alleMitZeuge ? ZWEITER_ZEUGE_HINWEIS : ZEUGEN_HINWEIS;
  const hinweise = [zeugenText];
  for (const P of personen) {
    if (P.zeuge1 && (!P.zeuge1.adresse || !P.zeuge1.ausweis)) {
      hinweise.push(`Zeuge 1 bei ${P.vor} ${P.nach}: Adresse oder Ausweisnummer des Ehe-/Lebenspartners fehlt in den Stammdaten.`);
    }
  }
  if (personen.length === 2 && personen[0].strasse + personen[0].plz !== personen[1].strasse + personen[1].plz) {
    hinweise.push('Die Partner haben unterschiedliche Anschriften. Im Begleitschreiben steht die Anschrift des ersten Partners.');
  }

  const [b1] = await seitenKopieren(doc, vorlagen.HU_Begleitschreiben_hu, [0]);   // leere Seite 2 entfällt
  begleitschreiben(b1, font, personen, ortDatum, 'hu');

  for (const P of personen) {
    const [w] = await seitenKopieren(doc, vorlagen.HU_Widerspruch, [0]);
    huWiderspruch(w, font, P, ortDatum);
    const [e1] = await seitenKopieren(doc, vorlagen.HU_Einwilligung, [0, 1]);
    huEinwilligung(e1, font, P, datum);
  }

  const [b2] = await seitenKopieren(doc, vorlagen.HU_Begleitschreiben_de, [0]);
  const yEnde = begleitschreiben(b2, font, personen, ortDatum, 'de');
  const zeilen = umbrechen(font, `Hinweis zur Protesterklärung (Tiltakozó nyilatkozat): ${zeugenText}.`, 9, 450);
  schreiben(b2, font, zeilen.map((z, i) => [72, yEnde + 10 + i * 12, z, 9]), 9, ROT);

  const fehlend = {};
  for (const P of personen) { const f = fehlendeAngaben(P, 'HU'); if (f.length) fehlend[`${P.vor} ${P.nach}`] = f; }
  return { pdf: await doc.save(), fehlend, hinweise };
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
 * AT-Formular für eine Person.
 * @param {{person:object, erstellt:Date, ort?:string, vorlagen:object, schrift:Uint8Array, fontkit:object}} o
 * @returns {Promise<{pdf:Uint8Array, fehlend:string[]}>}
 */
export async function atFormular({ person: P, erstellt, ort, vorlagen, schrift, fontkit }) {
  await vorlagenPruefen(vorlagen, ['AT_Widerspruch']);
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
  text(form, font, 'Straße', P.strasse.replace(/\s*\d.*$/, ''));
  text(form, font, 'Hausnr', P.strasse.replace(/^\D*/, ''));
  text(form, font, 'PLZ', P.plz);
  text(form, font, 'Ort', P.ort);
  text(form, font, 'Bundesland/Staat', LAENDER[P.land] || P.land);
  text(form, font, 'Staatsbürgerschaft', STAATEN[P.staat.toLowerCase()] || P.staat);
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
  text(form, font, 'Ort Datum', `${ort || P.ort}, ${datumAT(datumTeile(erstellt))}`);

  doc.setTitle('Widerspruch Organentnahme Österreich');
  return { pdf: await doc.save({ updateFieldAppearances: false }), fehlend: fehlendeAngaben(P, 'AT') };
}
