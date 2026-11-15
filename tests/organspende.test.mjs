// Tests Befüll-Logik und Sicherheitsregeln. Nur Musterdaten. Start: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PDFDocument, PDFName } from '../site/vendor/pdf-lib.esm.min.js';
import {
  VORLAGEN, ZEUGEN_HINWEIS, AT_ERLAUBTE_FELDER, STAATSANGEHOERIGKEITEN, huPaket, atFormular, personAusEingaben,
  fehlendeAngaben, datumTeile, datumHU, datumAT, vorlagenPruefen,
} from '../site/lib/organspende.js';
import { HANS, ERZSI, ERSTELLT } from './musterdaten.mjs';
import { ressourcen, lesen } from '../werkzeuge/node_ressourcen.mjs';

const { vorlagen, schrift, fontkit } = ressourcen();
const P_HANS = personAusEingaben(HANS);
const P_ERZSI = personAusEingaben(ERZSI);
const basis = { erstellt: ERSTELLT, vorlagen, schrift, fontkit };

let pypdf = false;
try { execFileSync('python3', ['-I', '-c', 'import pypdf'], { stdio: 'ignore' }); pypdf = true; } catch { /* ohne */ }
function seitenText(pdf) {
  const d = mkdtempSync(join(tmpdir(), 'os-')); const f = join(d, 'x.pdf'); writeFileSync(f, pdf);
  const out = execFileSync('python3', ['-I', '-c',
    'import sys,json; from pypdf import PdfReader; print(json.dumps([p.extract_text() for p in PdfReader(sys.argv[1]).pages]))', f]);
  return JSON.parse(out.toString()).map((s) => s.replace(/\s+/g, ' '));
}

// --- Vorlagen und Bibliotheken ----------------------------------------------
test('Vorlagen in site/ sind byte-gleich mit vorlagen/; Prüfsummen stimmen', async () => {
  for (const v of Object.values(VORLAGEN)) assert.deepEqual(lesen(`site/vorlagen/${v.datei}`), lesen(`vorlagen/${v.datei}`), v.datei);
  await vorlagenPruefen(vorlagen);
});

test('Bibliotheken und Schrift in site/ sind byte-gleich mit der Übernahme aus dem Board', () => {
  for (const f of ['pdf-lib.esm.min.js', 'fontkit.umd.min.js', 'schrift/DejaVuSans.ttf']) {
    assert.deepEqual(lesen(`site/vendor/${f}`), lesen(`uebernahme/vendor/${f}`), f);
  }
});

test('Veränderte Vorlage wird nicht befüllt', async () => {
  const kaputt = { ...vorlagen, HU_Widerspruch: vorlagen.HU_Widerspruch.slice() };
  kaputt.HU_Widerspruch[1000] ^= 1;
  await assert.rejects(() => huPaket({ ...basis, person: P_HANS, vorlagen: kaputt }), /weicht vom amtlichen Original ab/);
  const kaputtAT = { ...vorlagen, AT_Widerspruch: vorlagen.AT_Widerspruch.slice(0, -10) };
  await assert.rejects(() => atFormular({ ...basis, person: P_HANS, vorlagen: kaputtAT }), /weicht vom amtlichen Original ab/);
});

// --- Daten -------------------------------------------------------------------
test('Datumsformate: HU jjjj.mm.tt, AT TT.MM.JJJJ; ungültige Daten werden abgelehnt', () => {
  assert.equal(datumHU(datumTeile('02.11.1959')), '1959.11.02');
  assert.equal(datumHU(datumTeile('2.1.1959')), '1959.01.02');
  assert.equal(datumAT(datumTeile('1959.11.02')), '02.11.1959');
  assert.equal(datumAT(datumTeile('1959-11-02')), '02.11.1959');
  assert.equal(datumHU(datumTeile(new Date(2026, 0, 5))), '2026.01.05');
  for (const x of ['irgendwas', '31.02.1960', '00.01.1960', '12.13.1960', '']) assert.equal(datumTeile(x), null, x);
});

test('Person aus Formulareingaben', () => {
  assert.equal(P_HANS.strasse, 'Fő utca 12');
  assert.equal(P_HANS.staatHu, 'német');
  assert.equal(P_HANS.geburtsnameNach, 'Muster');           // ohne Geburtsname: Nachname
  assert.equal(P_ERZSI.geburtsnameNach, 'Szűcs');
  assert.equal(P_ERZSI.taj, '123 456 789');                  // TAJ in Dreiergruppen
  assert.deepEqual(fehlendeAngaben(P_HANS, 'HU'), []);
  assert.deepEqual(fehlendeAngaben(P_HANS, 'AT'), []);
  assert.deepEqual(fehlendeAngaben(P_ERZSI, 'HU'), []);
  assert.deepEqual(fehlendeAngaben(P_ERZSI, 'AT'), []);
  for (const k of Object.keys(STAATSANGEHOERIGKEITEN)) assert.ok(STAATSANGEHOERIGKEITEN[k].hu && STAATSANGEHOERIGKEITEN[k].at, k);
});

test('Pflichtfelder je Land', () => {
  const leer = personAusEingaben({});
  const hu = fehlendeAngaben(leer, 'HU');
  const at = fehlendeAngaben(leer, 'AT');
  for (const f of ['Vorname', 'Nachname', 'Geburtsdatum', 'Straße', 'Hausnummer', 'Land', 'PLZ', 'Ort', 'Staatsangehörigkeit']) {
    assert.ok(hu.includes(f) && at.includes(f), f);
  }
  assert.ok(hu.includes('TAJ-Nummer') && hu.includes('Geburtsort') && hu.includes('Geburtsname der Mutter (Nachname)'));
  assert.ok(!hu.includes('Geschlecht') && !hu.some((m) => m.startsWith('Ausweis')));
  assert.ok(at.includes('Geschlecht') && at.includes('Ausweisnummer') && at.some((m) => m.startsWith('Ausweisart')));
  assert.ok(!at.includes('TAJ-Nummer') && !at.includes('Geburtsort'));
  // Formate
  assert.ok(fehlendeAngaben(personAusEingaben({ ...HANS, taj: '12345' }), 'HU').includes('TAJ-Nummer (9 Ziffern)'));
  assert.ok(fehlendeAngaben(personAusEingaben({ ...HANS, gebdat: '31.02.1960' }), 'HU')[0].startsWith('Geburtsdatum (bitte als'));
  assert.ok(fehlendeAngaben(personAusEingaben({ ...HANS, svAt: '123' }), 'AT').includes('Österreichische SV-Nummer (10 Ziffern)'));
  // Mit SV-Nummer ist kein Ausweis nötig
  assert.deepEqual(fehlendeAngaben(personAusEingaben({ ...HANS, ausweisart: '', ausweisnr: '', svAt: '1234 021159' }), 'AT'), []);
});

// --- Ungarn ------------------------------------------------------------------
test('HU-Paket: 5 Seiten (BS HU, Protest, Einwilligung 2 S., BS DE), keine Namen in den Metadaten', async () => {
  const r = await huPaket({ ...basis, person: P_HANS });
  assert.deepEqual(r.fehlend, []);
  const doc = await PDFDocument.load(r.pdf);
  assert.equal(doc.getPageCount(), 5);
  assert.equal(doc.getTitle(), 'Organspende-Widerspruch Ungarn');
  assert.equal(doc.getCreator(), 'VerMaKom Ausfüllhilfe');
  const meta = [doc.getTitle(), doc.getAuthor(), doc.getSubject(), doc.getCreator(), doc.getProducer(), doc.getKeywords()].join('|');
  assert.doesNotMatch(meta, /Muster|Hans/);
});

test('HU-Paket: Inhalte, Formate, Zeugen leer, Kopie-Vermerk (Textauszug)', { skip: !pypdf && 'pypdf nicht installiert' }, async () => {
  const t = seitenText((await huPaket({ ...basis, person: P_HANS })).pdf);
  assert.match(t[0], /Hans Muster Fő utca 12 HU - 8360 Keszthely/);
  assert.match(t[0], /Keszthely, 2026\.11\.12/);
  assert.match(t[0], /szeretném\(k\)/);                       // amtlicher ich/wir-Text unverändert
  assert.equal((t[0].match(/Hans Muster/g) || []).length, 2);   // Absender + eine Unterschriftslinie
  assert.match(t[1], /TILTAKOZÓ NYILATKOZAT/);
  assert.match(t[1], /Muster Hans/); assert.match(t[1], /1959\.11\.02/); assert.match(t[1], /Becker Anna/);
  assert.match(t[1], /987 654 321/); assert.match(t[1], /8360 Keszthely, Fő utca 12/); assert.match(t[1], /német \/ deutsch/);
  assert.doesNotMatch(t[1], /Név\/Name:\s*[A-Za-zÁ-ű]/);     // Zeugenfelder leer
  assert.doesNotMatch(t[1], /L01X00T48/);
  assert.match(t[2], /Hozzájáruló nyilatkozat/); assert.match(t[2], /Magyarország \/ Ungarn/); assert.match(t[2], /2026\.11\.12/);
  assert.match(t[4], /Sehr geehrte Damen und Herrn/);
  assert.match(t[4], /KOPIE FÜR IHRE UNTERLAGEN/); assert.match(t[4], /nicht einsenden/);
  assert.ok(t[4].includes(ZEUGEN_HINWEIS));
});

test('HU-Paket: ungarische Sonderzeichen ő/ű korrekt im PDF', { skip: !pypdf && 'pypdf nicht installiert' }, async () => {
  const t = seitenText((await huPaket({ ...basis, person: P_ERZSI })).pdf);
  assert.match(t[0], /Erzsébet Müller-Kővári/);
  assert.match(t[1], /Müller-Kővári Erzsébet/);
  assert.match(t[1], /Szűcs Erzsébet/);
  assert.match(t[1], /Győr/);
  assert.match(t[1], /Fűzfa Ilona/);
  assert.match(t[1], /8380 Hévíz, Rózsa utca 5\/A/);
  assert.match(t[2], /Fűzfa/);
});

// --- Österreich --------------------------------------------------------------
async function felderLesen(pdf) {
  const doc = await PDFDocument.load(pdf);
  const m = new Map();
  for (const f of doc.getForm().getFields()) {
    const ws = f.acroField.getWidgets();
    m.set(f.getName(), {
      wert: f.acroField.dict.get(PDFName.of('V'))?.toString() ?? null,
      as: ws.map((w) => w.dict.get(PDFName.of('AS'))?.toString() ?? null),
      ap: ws.map((w) => w.dict.get(PDFName.of('AP'))?.toString() ?? null),
      text: typeof f.getText === 'function' ? f.getText() ?? '' : null,
      an: ws.map((w) => w.getOnValue?.()?.toString() ?? null),
    });
  }
  return { m, need: doc.getForm().acroForm.dict.get(PDFName.of('NeedAppearances')), seiten: doc.getPageCount() };
}
const ORIGINAL = await felderLesen(vorlagen.AT_Widerspruch);
const gewaehlt = (m, n) => { const f = m.get(n); return f.as.map((a, i) => (a !== '/Off' ? f.an[i] : null)).filter(Boolean); };

test('AT-Paket: Infoblatt + Formular, Abschnitt A + Seite 5 befüllt und angekreuzt, Datum TT.MM.JJJJ', async () => {
  const r = await atFormular({ ...basis, person: P_HANS });
  assert.deepEqual(r.fehlend, []);
  const { m, need, seiten } = await felderLesen(r.pdf);
  assert.equal(seiten, 5);
  const t = (n) => m.get(n).text;
  assert.equal(t('Familienname'), 'Muster'); assert.equal(t('Vorname'), 'Hans');
  assert.equal(['Tag', 'Tag1', 'Monat', 'Monat1', 'Jahr', 'Jahr1', 'Jahr2', 'Jahr3'].map(t).join(''), '02111959');
  assert.equal(t('Straße'), 'Fő utca'); assert.equal(t('Hausnr'), '12');
  assert.equal(t('PLZ'), '8360'); assert.equal(t('Ort'), 'Keszthely');
  assert.equal(t('Bundesland/Staat'), 'Ungarn'); assert.equal(t('Staatsbürgerschaft'), 'Deutschland');
  assert.equal(t('Nummer'), 'L01X00T48');
  assert.equal(t('Ort Datum'), 'Keszthely, 12.11.2026');
  for (const [feld, erwartet] of [['Art', '/Aufnahme'], ['Geschlecht.0', '/M#E4nnlich'], ['SV-Nummer.0', '/andere#20Staaten'],
    ['Ausweis.0', '/Personalausweis'], ['Bestätigung', '/Wohnadresse'], ['Kopie', '/Ja']]) {
    assert.deepEqual(gewaehlt(m, feld), [erwartet], feld);   // exakter Zustandsname aus dem Original -> sichtbar in Edge/Acrobat
    assert.equal(m.get(feld).wert, erwartet, feld + ' /V');
  }
  assert.equal(need, undefined);   // kein NeedAppearances: Viewer zeigen die eingebetteten Erscheinungsbilder
  for (const f of ['SV1', 'SV5', 'SV10']) assert.equal(t(f), '');

  const erzsi = await felderLesen((await atFormular({ ...basis, person: P_ERZSI })).pdf);
  assert.deepEqual(gewaehlt(erzsi.m, 'Geschlecht.0'), ['/Weiblich']);
  assert.deepEqual(gewaehlt(erzsi.m, 'Ausweis.0'), ['/Reisepass']);
  assert.equal(erzsi.m.get('Familienname').text, 'Müller-Kővári');
  assert.equal(erzsi.m.get('Straße').text, 'Rózsa utca'); assert.equal(erzsi.m.get('Hausnr').text, '5/A');
  assert.equal(erzsi.m.get('Ort Datum').text, 'Hévíz, 12.11.2026');
});

test('AT-Formular: Abschnitt B, Seite 4 und alle übrigen Felder bleiben exakt wie im Original', async () => {
  for (const P of [P_HANS, P_ERZSI, personAusEingaben({ ...HANS, svAt: '1234021159' })]) {
    const { m } = await felderLesen((await atFormular({ ...basis, person: P })).pdf);
    assert.equal(m.size, ORIGINAL.m.size);
    let geprueft = 0;
    for (const [name, orig] of ORIGINAL.m) {
      if (AT_ERLAUBTE_FELDER.has(name)) continue;
      assert.deepEqual(m.get(name), orig, `Feld „${name}“ wurde verändert`);
      geprueft++;
    }
    assert.ok(geprueft >= 60, `nur ${geprueft} Felder geprüft`);
  }
});

test('AT-Formular mit österreichischer SV-Nummer: Ziffern in SV1–SV10, Ausweis bleibt leer', async () => {
  const P = personAusEingaben({ ...HANS, svAt: '1234 021159' });
  const { m } = await felderLesen((await atFormular({ ...basis, person: P })).pdf);
  assert.equal(Array.from({ length: 10 }, (_, i) => m.get(`SV${i + 1}`).text).join(''), '1234021159');
  assert.deepEqual(m.get('SV-Nummer.0').as.filter((a) => a !== '/Off'), ['/#D6sterreich']);
  assert.deepEqual(m.get('Ausweis.0'), ORIGINAL.m.get('Ausweis.0'));
  assert.equal(m.get('Nummer').text, '');
});

// --- Sicherheitsregeln (statisch) -------------------------------------------
const eigeneDateien = ['site/index.html', 'site/app.js', 'site/style.css', 'site/lib/organspende.js'];

test('Kein Speicher, keine Cookies, keine externen Adressen im eigenen Code', () => {
  for (const f of eigeneDateien) {
    const s = readFileSync(f, 'utf8');
    assert.doesNotMatch(s, /localStorage|sessionStorage|document\.cookie|indexedDB|navigator\.sendBeacon|XMLHttpRequest|WebSocket/, f);
    assert.doesNotMatch(s, /\ssrc\s*=\s*["']?(?:https?:)?\/\//i, f);   // keine externen Skripte/Bilder
    assert.doesNotMatch(s, /<link[^>]*href\s*=\s*["']?(?:https?:)?\/\//i, f);   // keine externen Styles/Preloads
    assert.doesNotMatch(s, /url\(\s*["']?(?:https?:)?\/\//i, f);
    assert.doesNotMatch(s, /fetch\(\s*["'`]https?:/i, f);
  }
  const html = readFileSync('site/index.html', 'utf8');
  assert.doesNotMatch(html, /<script(?![^>]*\ssrc=)[^>]*>/i, 'kein Inline-Skript');
  assert.doesNotMatch(html, /\sstyle\s*=/i, 'keine Inline-Styles');
  assert.doesNotMatch(html, /\son[a-z]+\s*=/i, 'keine Inline-Eventhandler');
});

test('Externe Links: nur die freigegebenen Adressen, neuer Tab, kein Referrer', () => {
  const html = readFileSync('site/index.html', 'utf8');
  const links = [...html.matchAll(/<a\s[^>]*href="(https?:[^"]+)"[^>]*>/g)];
  assert.deepEqual(links.map((l) => l[1]).sort(), [
    'https://go.vermakom.de/widget/booking/EIBV1Pv0vah21Qxnn6Yn', 'https://lp.vermakom.de/ratgeber',
    'https://vermakom.de/datenschutz', 'https://vermakom.de/impressum',
  ]);
  for (const [tag] of links) {
    assert.match(tag, /target="_blank"/, tag);
    assert.match(tag, /rel="noopener noreferrer"/, tag);
  }
  assert.doesNotMatch(html, /PLATZHALTER/);
  assert.doesNotMatch(html, /href="https?:[^"]*\?/, 'keine Parameter (Daten) in Link-URLs');
});

test('Formularfelder haben keine name-Attribute mit Personendaten (nichts landet je in einer URL)', () => {
  const html = readFileSync('site/index.html', 'utf8');
  const namen = [...html.matchAll(/\sname="([^"]+)"/g)].map((r) => r[1]).filter((n) => n !== 'viewport' && n !== 'referrer' && n !== 'robots');
  assert.deepEqual([...new Set(namen)].sort(), ['geschlecht', 'laender']);
});

test('_headers: strenge Content-Security-Policy', () => {
  const h = readFileSync('site/_headers', 'utf8');
  const csp = h.match(/Content-Security-Policy:\s*(.+)/)[1];
  for (const d of ["default-src 'self'", "script-src 'self'", "connect-src 'self'", "frame-ancestors 'none'", "form-action 'none'", "object-src 'none'"]) {
    assert.ok(csp.includes(d), d);
  }
  assert.doesNotMatch(csp, /unsafe-|\*|https?:/);
});

test('site/ enthält nur, was veröffentlicht werden soll', () => {
  const alle = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? alle(join(d, e.name)) : [join(d, e.name)]));
  const dateien = alle('site').sort();
  assert.deepEqual(dateien, [
    'site/_headers', 'site/app.js', 'site/index.html', 'site/lib/organspende.js', 'site/style.css',
    'site/vendor/LICENSE_fontkit.md', 'site/vendor/LICENSE_pdf-lib.md', 'site/vendor/fontkit.umd.min.js', 'site/vendor/pdf-lib.esm.min.js',
    'site/vendor/schrift/DejaVuSans.ttf', 'site/vendor/schrift/LICENSE_DejaVu.txt',
    ...Object.values(VORLAGEN).map((v) => `site/vorlagen/${v.datei}`).sort(),
  ].sort());
});
