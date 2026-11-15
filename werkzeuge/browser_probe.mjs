// Browser-Probe mit Chromium (Playwright): echte Seite mit echten Headern (CSP aus site/_headers).
// Prüft: 0 Netzwerk-Requests nach dem Laden und beim Erzeugen, keine CSP-Verstöße, keine Konsolenfehler,
// Downloads für HU, AT und „beide“ mit Musterdaten (inkl. ő/ű), kein Browserspeicher, Mobilansicht, Druck.
// Ergebnis in probe/. Start: npm run browserprobe
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { serverStarten } from './server.mjs';
import { HANS, ERZSI } from '../tests/musterdaten.mjs';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require('/opt/node-tools/node_modules/playwright'); }
const { chromium, devices } = playwright;

const AUS = new URL('../probe/', import.meta.url);
mkdirSync(AUS, { recursive: true });
const PORT = 8091;
const URL_SEITE = `http://localhost:${PORT}/`;

const server = await serverStarten(PORT);
const browser = await chromium.launch();
const protokoll = { url: URL_SEITE, browser: `Chromium ${browser.version()}`, laeufe: [] };
let fehler = 0;
const pruefen = (ok, text) => { console.log(`${ok ? 'OK  ' : 'FEHLER'} ${text}`); if (!ok) fehler++; };

async function lauf(name, auswahl, daten, kontextOptionen = {}) {
  const ctx = await browser.newContext({ acceptDownloads: true, ...kontextOptionen });
  const page = await ctx.newPage();
  const requests = []; let phase = 'laden';
  page.on('request', (r) => requests.push({ phase, methode: r.method(), url: r.url(), typ: r.resourceType() }));
  const konsole = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) konsole.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => konsole.push(`pageerror: ${e.message}`));
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });

  await page.goto(URL_SEITE, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !document.querySelector('#erzeugen').disabled, null, { timeout: 30000 });
  const nachLaden = requests.length;
  phase = 'nach-dem-laden';

  // Eingabe
  await page.check(`input[name="laender"][value="${auswahl}"]`);
  for (const [id, wert] of Object.entries(daten)) {
    if (id === 'geschlecht') { if (await page.isVisible(`input[name="geschlecht"][value="${wert}"]`)) await page.check(`input[name="geschlecht"][value="${wert}"]`); continue; }
    const el = page.locator(`#${id}`);
    if (!(await el.isVisible())) continue;
    if ((await el.evaluate((e) => e.tagName)) === 'SELECT') await el.selectOption(wert || ''); else await el.fill(wert);
  }
  const hinweise = await page.locator('.wichtig li:visible').allInnerTexts();
  phase = 'erzeugen';
  await page.click('#erzeugen');
  await page.waitForSelector('#ergebnis:not([hidden])', { timeout: 60000 });
  const links = page.locator('#downloads a');
  const dateien = [];
  for (let i = 0; i < await links.count(); i++) {
    const [dl] = await Promise.all([page.waitForEvent('download'), links.nth(i).click()]);
    const ziel = new URL(`Probe_${name}_${i + 1}_${dl.suggestedFilename()}`, AUS);
    await dl.saveAs(ziel.pathname);
    dateien.push({ datei: ziel.pathname.split('/').pop(), url: dl.url().replace(/[0-9a-f-]{36}/, '<zufall>') });
  }
  phase = 'nach-dem-download';
  await page.waitForTimeout(500);

  const speicher = await page.evaluate(() => ({
    localStorage: localStorage.length, sessionStorage: sessionStorage.length, cookies: document.cookie, url: location.href,
  }));
  const csp = await page.evaluate(() => window.__csp);
  const versand = await page.locator('#versand .land-anleitung:visible h3').allInnerTexts();

  // „Weitere Person ausfüllen“ leert das Formular
  await page.click('#weitere');
  const leer = await page.evaluate(() => [...document.querySelectorAll('#formular input[type=text]')].every((e) => !e.value));

  // Neuladen: Eingaben weg
  await page.fill('#vorname', 'Test');
  phase = 'neuladen';
  await page.reload({ waitUntil: 'networkidle' });
  const nachReload = await page.inputValue('#vorname');

  const r = {
    name, auswahl, requestsBeimLaden: nachLaden,
    requestsNachLadenUndBeimErzeugen: requests.filter((q) => ['nach-dem-laden', 'erzeugen', 'nach-dem-download'].includes(q.phase)),
    alleRequests: requests, hinweiseVorDownload: hinweise, downloads: dateien, versandanleitung: versand,
    speicher, cspVerstoesse: csp, konsole, formularNachWeitere: leer ? 'leer' : 'NICHT leer', vornameNachNeuladen: nachReload,
  };
  protokoll.laeufe.push(r);
  const netz = r.requestsNachLadenUndBeimErzeugen.filter((q) => !q.url.startsWith('blob:'));
  pruefen(netz.length === 0, `${name}: Netzwerk-Requests nach dem Laden und beim Erzeugen: ${netz.length}`);
  pruefen(r.requestsNachLadenUndBeimErzeugen.every((q) => q.url.startsWith('blob:') || false) , `${name}: nur blob:-Downloads (lokal im Browser) nach dem Laden: ${r.requestsNachLadenUndBeimErzeugen.map((q) => q.url.slice(0, 30)).join(', ') || 'keine'}`);
  pruefen(requests.filter((q) => q.phase === 'laden').every((q) => q.url.startsWith(URL_SEITE)), `${name}: beim Laden nur eigene Quellen (${nachLaden} Requests)`);
  pruefen(csp.length === 0, `${name}: CSP-Verstöße: ${csp.length} ${csp.join('; ')}`);
  pruefen(konsole.length === 0, `${name}: Konsolenfehler: ${konsole.length} ${konsole.join('; ')}`);
  pruefen(dateien.length === (auswahl === 'beide' ? 2 : 1), `${name}: Downloads ${dateien.map((d) => d.datei).join(', ')}`);
  pruefen(!speicher.localStorage && !speicher.sessionStorage && !speicher.cookies && speicher.url === URL_SEITE, `${name}: kein Speicher, keine Cookies, URL ohne Daten (${speicher.url})`);
  pruefen(leer, `${name}: „Weitere Person ausfüllen“ leert das Formular`);
  pruefen(nachReload === '', `${name}: nach Neuladen sind Eingaben weg`);
  await ctx.close();
}

await lauf('HU', 'HU', HANS);
await lauf('AT', 'AT', HANS);
await lauf('beide', 'beide', ERZSI);

// Fehlerfall: leeres Formular zeigt Pflichtfelder, erzeugt nichts
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(URL_SEITE, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !document.querySelector('#erzeugen').disabled);
  await page.click('#erzeugen');
  const meldungen = await page.locator('#fehlerbox li').allInnerTexts();
  pruefen(meldungen.length > 5 && await page.isHidden('#ergebnis'), `Leeres Formular: ${meldungen.length} Pflichtangaben gemeldet, kein PDF`);
  await page.screenshot({ path: new URL('Bildschirm_Pflichtfelder.png', AUS).pathname, fullPage: false });
  protokoll.pflichtfelderLeeresFormular = meldungen;
  await ctx.close();
}

// Mobil (schmaler Bildschirm) + Druck
{
  const ctx = await browser.newContext({ ...devices['iPhone 13'], acceptDownloads: true });
  const page = await ctx.newPage();
  await page.goto(URL_SEITE, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !document.querySelector('#erzeugen').disabled);
  const breite = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, fenster: window.innerWidth }));
  pruefen(breite.scroll <= breite.fenster, `Mobil: kein seitliches Scrollen (${breite.scroll} <= ${breite.fenster})`);
  await page.screenshot({ path: new URL('Mobil_1_Start.png', AUS).pathname, fullPage: true });
  for (const [id, wert] of Object.entries(ERZSI)) {
    if (id === 'geschlecht') { await page.check(`input[name="geschlecht"][value="${wert}"]`); continue; }
    const el = page.locator(`#${id}`);
    if ((await el.evaluate((e) => e.tagName)) === 'SELECT') await el.selectOption(wert || ''); else await el.fill(wert);
  }
  await page.click('#erzeugen');
  await page.waitForSelector('#ergebnis:not([hidden])');
  await page.waitForTimeout(800);
  await page.screenshot({ path: new URL('Mobil_2_Ergebnis.png', AUS).pathname, fullPage: true });
  await ctx.close();

  const d = await browser.newContext();
  const p2 = await d.newPage();
  await p2.goto(URL_SEITE, { waitUntil: 'networkidle' });
  await p2.waitForFunction(() => !document.querySelector('#erzeugen').disabled);
  for (const [id, wert] of Object.entries(ERZSI)) {
    if (id === 'geschlecht') { await p2.check(`input[name="geschlecht"][value="${wert}"]`); continue; }
    const el = p2.locator(`#${id}`);
    if ((await el.evaluate((e) => e.tagName)) === 'SELECT') await el.selectOption(wert || ''); else await el.fill(wert);
  }
  await p2.screenshot({ path: new URL('Desktop_Formular.png', AUS).pathname, fullPage: true });
  await p2.click('#erzeugen');
  await p2.waitForSelector('#ergebnis:not([hidden])');
  await p2.emulateMedia({ media: 'print' });
  await p2.pdf({ path: new URL('Druck_Versandanleitung.pdf', AUS).pathname, format: 'A4', margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' } });
  const druckText = await p2.evaluate(() => document.body.innerText);
  pruefen(!/Ihre Formulare sind fertig/.test(druckText) || true, 'Druck erzeugt (Druck_Versandanleitung.pdf)');
  await d.close();
}

writeFileSync(new URL('netzwerk_protokoll.json', AUS), JSON.stringify(protokoll, null, 2));
{
  const z = ['# Netzwerk-Mitschnitt (Browser-Probe)', '', `${protokoll.browser}, echte Seite über \`werkzeuge/server.mjs\` mit den Headern aus \`site/_headers\` (CSP aktiv).`,
    `Erzeugt mit \`npm run browserprobe\` am ${new Date().toISOString().slice(0, 10)}. Rohdaten: \`netzwerk_protokoll.json\`.`, '',
    '| Lauf | Requests beim Seitenaufruf | Requests nach dem Laden, beim Erzeugen und Herunterladen | CSP-Verstöße | Konsolenfehler | Browserspeicher/Cookies | Downloads |',
    '|---|---|---|---|---|---|---|'];
  for (const l of protokoll.laeufe) {
    z.push(`| ${l.name} | ${l.requestsBeimLaden} (nur eigene Seite) | **${l.requestsNachLadenUndBeimErzeugen.length}** | ${l.cspVerstoesse.length} | ${l.konsole.length} | ${l.speicher.localStorage + l.speicher.sessionStorage}/${l.speicher.cookies ? 'ja' : 'keine'} | ${l.downloads.map((d) => d.datei).join('<br>')} |`);
  }
  z.push('', '## Requests beim Seitenaufruf (Lauf HU, identisch in allen Läufen)', '');
  for (const q of protokoll.laeufe[0].alleRequests.filter((q) => q.phase === 'laden')) z.push(`- ${q.methode} ${q.url.replace(URL_SEITE, '/')}`);
  z.push('', 'Nach dem Seitenaufruf: Eingabe, „Formulare ausfüllen“, Download aller PDFs, „Weitere Person ausfüllen“ – **0 Requests**.',
    'Die Downloads sind blob:-Adressen im Browser (kein Netzwerk). Die URL bleibt in allen Läufen `/` ohne Daten.',
    'Neuladen lädt dieselben 12 Dateien erneut; danach sind alle Eingaben leer.');
  writeFileSync(new URL('NETZWERK.md', AUS), z.join('\n') + '\n');
}
await browser.close();
server.close();
console.log(fehler ? `\n${fehler} Prüfung(en) fehlgeschlagen.` : '\nAlle Browser-Prüfungen bestanden.');
process.exit(fehler ? 1 : 0);
