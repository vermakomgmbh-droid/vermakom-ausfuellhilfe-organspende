// Ausfüllhilfe – Seitenlogik. Alles läuft lokal im Browser:
// Vorlagen und Schrift werden einmal beim Seitenaufruf von der eigenen Seite geladen, danach gibt es keine Netzwerkzugriffe mehr.
// Eingaben werden nirgends gespeichert (kein Browserspeicher, keine Cookies) und nie übertragen.
import {
  personAusEingaben, fehlendeAngaben, huPaket, atFormular, ressourcenLaden, STAATSANGEHOERIGKEITEN, LAENDER,
} from './lib/organspende.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const formular = $('#formular');
const knopf = $('#erzeugen');
const ladestatus = $('#ladestatus');
const arbeitsstatus = $('#arbeitsstatus');
const fehlerbox = $('#fehlerbox');
const ergebnis = $('#ergebnis');
const downloads = $('#downloads');

const FELDER = ['vorname', 'nachname', 'geburtsname', 'gebdat', 'gebort', 'staat', 'mutterNach', 'mutterVor',
  'strasse', 'hausnr', 'land', 'plz', 'ort', 'taj', 'ausweisart', 'ausweisnr', 'svAt'];

// Meldung aus fehlendeAngaben -> Feld, das markiert wird
const MELDUNG_FELD = [
  [/^Vorname/, 'vorname'], [/^Nachname/, 'nachname'], [/^Geburtsdatum/, 'gebdat'], [/^Geburtsort/, 'gebort'],
  [/^Staatsangehörigkeit/, 'staat'], [/^Geburtsname der Mutter \(Nachname/, 'mutterNach'],
  [/^Geburtsname der Mutter \(Vorname/, 'mutterVor'], [/^Straße/, 'strasse'], [/^Hausnummer/, 'hausnr'],
  [/^Land/, 'land'], [/^PLZ/, 'plz'], [/^Ort/, 'ort'], [/^TAJ/, 'taj'], [/^Ausweisart/, 'ausweisart'],
  [/^Ausweisnummer/, 'ausweisnr'], [/^Österreichische SV/, 'svAt'], [/^Geschlecht/, 'geschlecht'],
];

let ressourcen = null;
let urls = [];

// --- Start -------------------------------------------------------------------
function auswahlFuellen() {
  const staat = $('#staat');
  staat.append(new Option('Bitte wählen', ''));
  for (const k of Object.keys(STAATSANGEHOERIGKEITEN)) staat.append(new Option(k, k));
  const land = $('#land');
  land.append(new Option('Bitte wählen', ''));
  for (const [k, v] of Object.entries(LAENDER)) land.append(new Option(v.de, k));
}

function laender() {
  const v = formular.querySelector('input[name="laender"]:checked')?.value || 'beide';
  return v === 'beide' ? ['HU', 'AT'] : [v];
}

/** Zeigt nur Felder/Hinweise für die gewählten Länder. */
function sichtbarkeit(auswahl = laender(), bereich = document) {
  for (const el of bereich.querySelectorAll('[data-land]')) el.hidden = !auswahl.includes(el.dataset.land);
}

async function start() {
  formular.reset();          // Browser sollen keine alten Eingaben wiederherstellen
  auswahlFuellen();
  sichtbarkeit();
  try {
    ressourcen = await ressourcenLaden('.');
    if (!window.fontkit) throw new Error('Schrift-Baustein nicht geladen.');
    ladestatus.hidden = true;
    knopf.disabled = false;
  } catch (e) {
    ladestatus.textContent = `Die Formulare konnten nicht geladen werden. Bitte laden Sie die Seite neu. (${e.message})`;
    ladestatus.classList.add('fehler');
  }
}

// --- Eingaben ----------------------------------------------------------------
function eingaben() {
  const e = Object.fromEntries(FELDER.map((id) => [id, $(`#${id}`).value]));
  e.geschlecht = formular.querySelector('input[name="geschlecht"]:checked')?.value || '';
  return e;
}

function fehlerZeigen(liste) {
  for (const el of $$('[aria-invalid]')) el.removeAttribute('aria-invalid');
  if (!liste.length) { fehlerbox.hidden = true; fehlerbox.replaceChildren(); return; }
  const titel = document.createElement('strong');
  titel.textContent = 'Bitte ergänzen oder prüfen Sie:';
  const ul = document.createElement('ul');
  for (const m of liste) {
    const li = document.createElement('li'); li.textContent = m; ul.append(li);
    const id = MELDUNG_FELD.find(([re]) => re.test(m))?.[1];
    if (id === 'geschlecht') $$('input[name="geschlecht"]').forEach((r) => r.setAttribute('aria-invalid', 'true'));
    else if (id) $(`#${id}`).setAttribute('aria-invalid', 'true');
  }
  fehlerbox.replaceChildren(titel, ul);
  fehlerbox.hidden = false;
  fehlerbox.focus();
}

function dateiname(land, P) {
  // Dateiname nur mit ASCII-Zeichen (manche Browser verwerfen sonst den Namen): ä->ae, ő->o …
  const teil = (s) => s.replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'Person';
  return `Organspende-Widerspruch_${land}_${teil(P.nach)}_${teil(P.vor)}.pdf`;
}

function ergebnisLeeren() {
  for (const u of urls) URL.revokeObjectURL(u);
  urls = [];
  downloads.replaceChildren();
  ergebnis.hidden = true;
}

function downloadLink(bytes, name, beschriftung) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  urls.push(url);
  const a = document.createElement('a');
  a.className = 'knopf';
  a.href = url;
  a.download = name;
  a.textContent = beschriftung;
  return a;
}

async function erzeugen(ev) {
  ev.preventDefault();
  if (!ressourcen) return;
  ergebnisLeeren();
  const auswahl = laender();
  const P = personAusEingaben(eingaben());
  const fehlend = [...new Set(auswahl.flatMap((l) => fehlendeAngaben(P, l)))];
  fehlerZeigen(fehlend);
  if (fehlend.length) return;

  knopf.disabled = true;
  arbeitsstatus.classList.remove('fehler');
  arbeitsstatus.textContent = 'Formulare werden ausgefüllt …';
  try {
    const basis = { person: P, erstellt: new Date(), vorlagen: ressourcen.vorlagen, schrift: ressourcen.schrift, fontkit: window.fontkit };
    const links = [];
    if (auswahl.includes('HU')) {
      const { pdf } = await huPaket(basis);
      links.push(downloadLink(pdf, dateiname('Ungarn', P), 'Ungarn-Paket herunterladen (PDF)'));
    }
    if (auswahl.includes('AT')) {
      const { pdf } = await atFormular(basis);
      links.push(downloadLink(pdf, dateiname('Oesterreich', P), 'Österreich-Paket herunterladen (PDF)'));
    }
    downloads.replaceChildren(...links);
    sichtbarkeit(auswahl, ergebnis);
    ergebnis.hidden = false;
    arbeitsstatus.textContent = '';
    ergebnis.scrollIntoView({ behavior: 'smooth', block: 'start' });
    ergebnis.focus({ preventScroll: true });
  } catch (e) {
    arbeitsstatus.textContent = `Das hat nicht geklappt: ${e.message}`;
    arbeitsstatus.classList.add('fehler');
  } finally {
    knopf.disabled = false;
  }
}

function weiterePerson() {
  const auswahl = formular.querySelector('input[name="laender"]:checked')?.value;
  ergebnisLeeren();
  formular.reset();
  if (auswahl) formular.querySelector(`input[name="laender"][value="${auswahl}"]`).checked = true;
  fehlerZeigen([]);
  sichtbarkeit();
  window.scrollTo({ top: formular.querySelector('#s2').offsetTop, behavior: 'smooth' });
  $('#vorname').focus({ preventScroll: true });
}

formular.addEventListener('submit', erzeugen);
formular.addEventListener('change', (ev) => { if (ev.target.name === 'laender') sichtbarkeit(); });
// Nach einer Änderung passen fertige PDFs nicht mehr zu den Eingaben
formular.addEventListener('input', () => { if (!ergebnis.hidden) ergebnisLeeren(); });
$('#weitere').addEventListener('click', weiterePerson);
$('#drucken').addEventListener('click', () => window.print());

// fontkit (klassisches Skript mit defer) ist vor Modulen geladen; trotzdem auf DOMContentLoaded warten
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
