// Tests Organspende-Baustein (Anleitung 5.4). Nur Musterdaten.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PDFDocument, PDFName } from '../app/vendor/pdf-lib.esm.min.js';
import {
  VORLAGEN, ZEUGEN_HINWEIS, ZWEITER_ZEUGE_HINWEIS, AT_ERLAUBTE_FELDER, personenFuerHU, huPaket, atFormular, personAusFall, partnerMitWiderspruch,
  fehlendeAngaben, datumTeile, datumHU, datumAT, vorlagenPruefen,
} from '../app/lib/organspende.js';
import { MUSTER_FALL, MUSTER_ERSTELLT } from '../organspende/muster_fall.js';
import { ressourcen, lesen } from '../organspende/node_ressourcen.mjs';

const { vorlagen, schrift, fontkit } = ressourcen();
// Personen ohne Zeugen (Grundfall); die Zeugen-Tests stehen unten
const personen = partnerMitWiderspruch(MUSTER_FALL).map((p) => personAusFall(MUSTER_FALL, p));
const [HANS, ERIKA] = personen;

// Textauszug über pypdf (optional: wird übersprungen, wenn Python/pypdf fehlt)
let pypdf = false;
try { execFileSync('python3', ['-I', '-c', 'import pypdf'], { stdio: 'ignore' }); pypdf = true; } catch { /* ohne */ }
function seitenText(pdf) {
  const d = mkdtempSync(join(tmpdir(), 'os-')); const f = join(d, 'x.pdf'); writeFileSync(f, pdf);
  const out = execFileSync('python3', ['-I', '-c',
    'import sys,json; from pypdf import PdfReader; print(json.dumps([p.extract_text() for p in PdfReader(sys.argv[1]).pages]))', f]);
  return JSON.parse(out.toString());
}

test('Vorlagen im App-Ordner sind byte-gleich mit den amtlichen Originalen; Prüfsummen stimmen', async () => {
  for (const v of Object.values(VORLAGEN)) {
    assert.deepEqual(lesen(`app/vorlagen/organspende/${v.datei}`), lesen(`organspende/orig/${v.datei}`), v.datei);
  }
  await vorlagenPruefen(vorlagen);
});

test('Veränderte Vorlage wird nicht befüllt', async () => {
  const kaputt = { ...vorlagen, HU_Widerspruch: vorlagen.HU_Widerspruch.slice() };
  kaputt.HU_Widerspruch[1000] ^= 1;
  await assert.rejects(() => huPaket({ personen, erstellt: MUSTER_ERSTELLT, vorlagen: kaputt, schrift, fontkit }), /weicht vom amtlichen Original ab/);
});

test('Eingebettete Bibliotheken sind unverändert aus npm (wenn node_modules vorhanden)', { skip: !existsSync('node_modules/pdf-lib') }, () => {
  assert.deepEqual(lesen('app/vendor/pdf-lib.esm.min.js'), lesen('node_modules/pdf-lib/dist/pdf-lib.esm.min.js'));
  assert.deepEqual(lesen('app/vendor/fontkit.umd.min.js'), lesen('node_modules/@pdf-lib/fontkit/dist/fontkit.umd.min.js'));
});

test('Datumsformate: HU jjjj.mm.tt, AT TT.MM.JJJJ', () => {
  assert.equal(datumHU(datumTeile('02.11.1959')), '1959.11.02');
  assert.equal(datumAT(datumTeile('1959.11.02')), '02.11.1959');
  assert.equal(datumAT(datumTeile('1959-11-02')), '02.11.1959');
  assert.equal(datumHU(datumTeile(new Date(2026, 0, 5))), '2026.01.05');
  assert.equal(datumTeile('irgendwas'), null);
});

test('Stammdaten -> Person; Verknüpfung mit V02 Abschnitt 5', () => {
  assert.deepEqual(partnerMitWiderspruch(MUSTER_FALL), ['A', 'B']);
  assert.equal(ERIKA.nach, 'Muster'); assert.equal(ERIKA.vor, 'Erika');
  assert.equal(ERIKA.land, 'HU'); assert.equal(ERIKA.plz, '8360'); assert.equal(ERIKA.ort, 'Keszthely');
  assert.equal(ERIKA.staatHu, 'német'); assert.equal(ERIKA.geschlecht, 'w'); assert.equal(ERIKA.ausweisart, 'Reisepass');
  assert.deepEqual(fehlendeAngaben(ERIKA, 'HU'), []);
  assert.deepEqual(fehlendeAngaben(ERIKA, 'AT'), []);
  // Bestehende Falldatei der Offline-App (ohne neue Felder): nur Partner B hat „Nein – widersprochen“
  const alt = JSON.parse(readFileSync('Vorsorge-Erfassung/Beispiel_Testpaar/Testfall_Muster.json', 'utf8'));
  assert.deepEqual(partnerMitWiderspruch(alt), ['B']);
  const p = personAusFall(alt, 'B');
  assert.equal(p.mutterNach, 'Meyer'); assert.equal(p.mutterVor, 'Gerda');   // Rückfall: „Nachname, Vorname“ getrennt
  assert.equal(p.geburtsnameNach, 'Beispiel');
  assert.ok(fehlendeAngaben(p, 'AT').includes('Geschlecht'));
  assert.ok(fehlendeAngaben(p, 'HU').includes('TAJ-Nummer'));
});

test('HU-Paket Paar: 8 Seiten in richtiger Reihenfolge, Begleitschreiben ohne leere Seite 2', async () => {
  const r = await huPaket({ personen, erstellt: MUSTER_ERSTELLT, vorlagen, schrift, fontkit });
  assert.deepEqual(r.fehlend, {});
  assert.ok(r.hinweise.includes(ZEUGEN_HINWEIS));   // ohne Zeuge 1: allgemeiner Hinweis
  const doc = await PDFDocument.load(r.pdf);
  assert.equal(doc.getPageCount(), 8);   // BS HU, (Protest + Einwilligung 2 S.) x 2, BS DE
  assert.equal(doc.getTitle(), 'Organspende-Widerspruch Ungarn');   // keine Namen in den Metadaten
  const einzel = await huPaket({ personen: [ERIKA], erstellt: MUSTER_ERSTELLT, vorlagen, schrift, fontkit });
  assert.equal((await PDFDocument.load(einzel.pdf)).getPageCount(), 5);
});

test('HU-Paket: Inhalte und Formate (Textauszug)', { skip: !pypdf && 'pypdf nicht installiert' }, async () => {
  const r = await huPaket({ personen, erstellt: MUSTER_ERSTELLT, vorlagen, schrift, fontkit });
  const t = seitenText(r.pdf).map((s) => s.replace(/\s+/g, ' '));
  assert.match(t[0], /Hans Muster \/ Erika Muster/);
  assert.match(t[0], /Fő utca 12/);
  assert.match(t[0], /HU - 8360 Keszthely/);
  assert.match(t[0], /Keszthely, 2026\.11\.12/);
  assert.match(t[0], /Tisztelt Uram/);
  assert.match(t[1], /TILTAKOZÓ NYILATKOZAT/);
  assert.match(t[1], /Muster Hans/); assert.match(t[1], /1959\.11\.02/); assert.match(t[1], /Becker Anna/);
  assert.match(t[1], /987 654 321/); assert.match(t[1], /8360 Keszthely, Fő utca 12/); assert.match(t[1], /német \/ deutsch/);
  assert.match(t[2], /Hozzájáruló nyilatkozat/); assert.match(t[2], /Magyarország \/ Ungarn/); assert.match(t[2], /2026\.11\.12/);
  assert.match(t[4], /Muster Erika/); assert.match(t[4], /1962\.04\.17/); assert.match(t[4], /Schmitz Maria/);
  assert.match(t[7], /Sehr geehrte Damen und Herrn/);
  assert.match(t[7], /Unterschrift mit zwei Zeugen \(Name, Adresse, Ausweisnummer, blaue Tinte\), sonst unwirksam/);
  // ohne Ehepartner-Zeugen: Zeugenfelder leer, nach „Név/Name:“ folgen nur Punkte
  assert.doesNotMatch(t[1], /Név\/Name:\s*[A-Za-zÁ-ű]/);
});

// --- Österreich ---
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
  return { m, need: doc.getForm().acroForm.dict.get(PDFName.of('NeedAppearances')) };
}
const ORIGINAL = await felderLesen(vorlagen.AT_Widerspruch);

test('AT-Formular: Abschnitt A + Seite 5 befüllt und angekreuzt, Datum TT.MM.JJJJ', async () => {
  const r = await atFormular({ person: ERIKA, erstellt: MUSTER_ERSTELLT, vorlagen, schrift, fontkit });
  assert.deepEqual(r.fehlend, []);
  const { m, need } = await felderLesen(r.pdf);
  const t = (n) => m.get(n).text;
  assert.equal(t('Familienname'), 'Muster'); assert.equal(t('Vorname'), 'Erika');
  assert.deepEqual(['Tag', 'Tag1', 'Monat', 'Monat1', 'Jahr', 'Jahr1', 'Jahr2', 'Jahr3'].map(t).join(''), '17041962');
  assert.equal(t('Straße'), 'Fő utca'); assert.equal(t('Hausnr'), '12');
  assert.equal(t('PLZ'), '8360'); assert.equal(t('Ort'), 'Keszthely');
  assert.equal(t('Bundesland/Staat'), 'Ungarn'); assert.equal(t('Staatsbürgerschaft'), 'Deutschland');
  assert.equal(t('Nummer'), 'C01X00T47');
  assert.equal(t('Ort Datum'), 'Keszthely, 12.11.2026');
  // Kästchen: Zustand (/AS) = exakter Zustandsname aus dem Original -> sichtbar in Edge/Acrobat
  const gewaehlt = (n) => { const f = m.get(n); return f.as.map((a, i) => (a !== '/Off' ? i : -1)).filter((i) => i >= 0).map((i) => f.an[i]); };
  for (const [feld, erwartet] of [['Art', '/Aufnahme'], ['Geschlecht.0', '/Weiblich'], ['SV-Nummer.0', '/andere#20Staaten'],
    ['Ausweis.0', '/Reisepass'], ['Bestätigung', '/Wohnadresse'], ['Kopie', '/Ja']]) {
    assert.deepEqual(gewaehlt(feld), [erwartet], feld);
    assert.equal(m.get(feld).wert, erwartet, feld + ' /V');
  }
  assert.equal(need, undefined);   // kein NeedAppearances: Viewer zeigen die eingebetteten Erscheinungsbilder
  for (const f of ['SV1', 'SV5', 'SV10']) assert.equal(t(f), '');

  const hans = await felderLesen((await atFormular({ person: HANS, erstellt: MUSTER_ERSTELLT, vorlagen, schrift, fontkit })).pdf);
  const gH = (n) => { const f = hans.m.get(n); return f.as.map((a, i) => (a !== '/Off' ? f.an[i] : null)).filter(Boolean); };
  assert.deepEqual(gH('Geschlecht.0'), ['/M#E4nnlich']);   // Original-Zustandsname (Latin-1), nicht neu erzeugt
  assert.deepEqual(gH('Ausweis.0'), ['/Personalausweis']);
});

test('AT-Formular: Abschnitt B, Seite 4 und alle übrigen Felder bleiben exakt wie im Original', async () => {
  for (const P of [ERIKA, HANS, { ...ERIKA, svAt: '1234170462' }]) {
    const { m } = await felderLesen((await atFormular({ person: P, erstellt: MUSTER_ERSTELLT, vorlagen, schrift, fontkit })).pdf);
    assert.equal(m.size, ORIGINAL.m.size);
    let geprueft = 0;
    for (const [name, orig] of ORIGINAL.m) {
      if (AT_ERLAUBTE_FELDER.has(name)) continue;
      assert.deepEqual(m.get(name), orig, `Feld „${name}“ wurde verändert`);
      geprueft++;
    }
    assert.ok(geprueft >= 60, `nur ${geprueft} Felder geprüft`);
    for (const b of ['Familienname_1', 'Vorname_1', 'Geschlecht.1', 'SV-Nummer.1', 'Ausweis.1', 'Nummer1', 'SV11', 'Straße1']) {
      assert.ok(!AT_ERLAUBTE_FELDER.has(b));
    }
  }
});

test('AT-Formular mit österreichischer SV-Nummer: Ziffern in SV1–SV10, Ausweis bleibt leer', async () => {
  const P = { ...HANS, svAt: '1234021159' };
  const { m } = await felderLesen((await atFormular({ person: P, erstellt: MUSTER_ERSTELLT, vorlagen, schrift, fontkit })).pdf);
  assert.equal(Array.from({ length: 10 }, (_, i) => m.get(`SV${i + 1}`).text).join(''), '1234021159');
  assert.deepEqual(m.get('SV-Nummer.0').as.filter((a) => a !== '/Off'), ['/#D6sterreich']);
  assert.deepEqual(m.get('Ausweis.0'), ORIGINAL.m.get('Ausweis.0'));
  assert.equal(m.get('Nummer').text, '');
});

test('Probedrucke im Repository entsprechen dem aktuellen Baustein (Seitenzahl)', async () => {
  for (const [datei, seiten] of [['Probedruck_HU_Paar.pdf', 8], ['Probedruck_AT_Hans.pdf', 5], ['Probedruck_AT_Erika.pdf', 5]]) {
    assert.ok(existsSync(`organspende/${datei}`), `${datei} fehlt – npm run probedruck`);
    assert.equal((await PDFDocument.load(lesen(`organspende/${datei}`))).getPageCount(), seiten);
  }
});

test('Zeuge 1 = Ehepartner (verheiratet): Name, Adresse, Ausweisnummer vorbefüllt, Zeuge 2 leer, Hinweis „zweiter Zeuge“', { skip: !pypdf && 'pypdf nicht installiert' }, async () => {
  const mitZeugen = personenFuerHU(MUSTER_FALL);
  assert.deepEqual(mitZeugen[0].zeuge1, { name: 'Muster Erika', adresse: '8360 Keszthely, Fő utca 12', ausweis: 'C01X00T47' });
  assert.deepEqual(mitZeugen[1].zeuge1, { name: 'Muster Hans', adresse: '8360 Keszthely, Fő utca 12', ausweis: 'L01X00T48' });
  const r = await huPaket({ personen: mitZeugen, erstellt: MUSTER_ERSTELLT, vorlagen, schrift, fontkit });
  assert.deepEqual(r.hinweise, [ZWEITER_ZEUGE_HINWEIS]);
  const t = seitenText(r.pdf);
  // Protesterklärung Hans (S. 2): Zeuge 1 = Erika; Protesterklärung Erika (S. 5): Zeuge 1 = Hans
  for (const [seite, zeuge, nr] of [[1, 'Muster Erika', 'C01X00T47'], [4, 'Muster Hans', 'L01X00T48']]) {
    const z = t[seite].replace(/\s+/g, ' ');
    const teil = z.slice(z.indexOf('Tanú 1/'));
    assert.ok(teil.includes(zeuge), `Zeuge ${zeuge} fehlt`);
    assert.ok(teil.includes(nr));
    assert.ok(teil.includes('8360 Keszthely, Fő utca 12'));
  }
  // Zeuge 2 bleibt leer: im ganzen Paket kommt jeder Name als Zeuge nur einmal vor (kein zweiter Eintrag)
  assert.equal((t[1].match(/C01X00T47/g) || []).length, 1);
  assert.match(t[7].replace(/\s+/g, ' '), /Zeuge 1 ist der Ehe-\/Lebenspartner \(vorbefüllt\)\. Zweiter Zeuge erforderlich/);
});

test('Zeuge 1 bei „verheiratet“ und „eingetragene Lebenspartnerschaft“, nicht bei unverheirateten Paaren', () => {
  const lp = personenFuerHU({ ...MUSTER_FALL, fam: { A: 'eingetragene Lebenspartnerschaft', B: 'eingetragene Lebenspartnerschaft' } });
  assert.deepEqual(lp.map((P) => P.zeuge1?.name), ['Muster Erika', 'Muster Hans']);
  for (const fs of ['ledig', 'geschieden', 'verwitwet', 'sonstiges', '']) {
    assert.ok(personenFuerHU({ ...MUSTER_FALL, fam: { A: fs, B: fs } }).every((P) => !P.zeuge1), fs);
  }
  const gemischt = personenFuerHU({ ...MUSTER_FALL, fam: { A: 'verheiratet', B: 'ledig' } });
  assert.deepEqual(gemischt.map((P) => !!P.zeuge1), [true, false]);
  const nurB = structuredClone(MUSTER_FALL);
  nurB.docs.V02.opt['V02|K065'] = { A: false, B: true };
  const p = personenFuerHU(nurB);
  assert.equal(p.length, 1);
  assert.equal(p[0].vor, 'Erika');
  assert.equal(p[0].zeuge1.name, 'Muster Hans');   // Hans widerspricht selbst nicht, ist aber Zeuge
});

test('Zeuge 1 mit fehlender Ausweisnummer: Hinweis; gemischt (einer ohne Zeuge): allgemeiner Hinweis', async () => {
  const f = structuredClone(MUSTER_FALL);
  f.stamm['Personalausweis-/Reisepassnummer'].A = '';
  const p = personenFuerHU(f);
  const r = await huPaket({ personen: p, erstellt: MUSTER_ERSTELLT, vorlagen, schrift, fontkit });
  assert.ok(r.hinweise.some((h) => /Zeuge 1 bei Erika Muster: Adresse oder Ausweisnummer/.test(h)));
  const gemischt = [p[0], { ...p[1], zeuge1: undefined }];
  const r2 = await huPaket({ personen: gemischt, erstellt: MUSTER_ERSTELLT, vorlagen, schrift, fontkit });
  assert.equal(r2.hinweise[0], ZEUGEN_HINWEIS);
});
