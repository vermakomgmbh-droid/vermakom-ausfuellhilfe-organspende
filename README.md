# VerMaKom Ausfüllhilfe Organspende-Widerspruch HU/AT

Kostenlose, rein statische Ausfüllhilfe. Besucher wählt Ungarn, Österreich oder beide, trägt seine Daten einmal ein und lädt die
ausgefüllten amtlichen Original-PDFs herunter. Die PDFs entstehen nur im Browser. Nichts wird gespeichert oder übertragen.

- Auftrag: `AUFTRAG.md` · Übernahme aus dem Board: `uebernahme/LIESMICH_UEBERNAHME.md`
- Veröffentlicht wird **nur der Ordner `site/`**.

## Lokal starten

Voraussetzung: Node.js ab Version 20 (keine Pakete nötig, kein `npm install`).

```bash
node werkzeuge/server.mjs
```

Dann im Browser `http://localhost:8080` öffnen. Der Testserver setzt dieselben Sicherheits-Header wie Cloudflare Pages (aus `site/_headers`),
die Content-Security-Policy ist also auch lokal aktiv.

Tests der Befüll-Logik und der Sicherheitsregeln (braucht für die Textprüfungen `python3` mit `pypdf`, sonst werden diese übersprungen):

```bash
npm test
```

Browser-Probe mit Chromium (Netzwerk-Mitschnitt, Downloads HU/AT/beide, Mobil, Druck; schreibt nach `probe/`):

```bash
npm run browserprobe
```

Vergleich mit dem Board-Sollbild (`uebernahme/referenz/`) und Kästchen-Rendering:

```bash
node werkzeuge/probe.mjs
```

```bash
python3 -I werkzeuge/vergleich.py
```

```bash
python3 -I werkzeuge/kaestchen_render.py
```

## Aufbau

```
site/                      ← wird veröffentlicht (Cloudflare Pages: Ausgabeordner „site“, kein Build-Befehl)
  index.html               Seite mit allen Texten
  style.css                Gestaltung (große Schrift, mobil, Druckansicht = Versandanleitung)
  app.js                   Seitenlogik: Formular, Pflichtfelder, Erzeugen, Download, „Weitere Person“
  lib/organspende.js       Befüll-Logik HU + AT (aus dem Board übernommen, für eine Person angepasst)
  vendor/                  pdf-lib 1.17.1, @pdf-lib/fontkit 1.1.1, DejaVu Sans 2.37 (lokal, mit Lizenzen)
  vorlagen/                die 5 amtlichen Befüll-Vorlagen (byte-gleich mit vorlagen/, Prüfsumme wird geprüft)
  _headers                 Sicherheits-Header inkl. Content-Security-Policy
vorlagen/                  amtliche Originale (Ablage, inkl. HU_Widerruf.pdf, das nicht befüllt wird)
uebernahme/                Kopie aus dem Board (Referenz, nicht veröffentlicht)
tests/                     node:test – Befüll-Logik, Pflichtfelder, ő/ű, AT-Kästchen, Sicherheitsregeln
werkzeuge/                 lokaler Testserver, Browser-Probe, Vergleich, Kästchen-Rendering
probe/                     Ergebnisse der letzten Probe (PDFs, Netzwerk-Mitschnitt, Screenshots, Vergleich)
```

Ablauf im Browser: Beim Seitenaufruf lädt die Seite einmal Skripte, Schrift und Vorlagen von der eigenen Adresse und prüft die
SHA-256-Prüfsummen der Vorlagen. Danach gibt es keinen Netzwerk-Request mehr. „Formulare ausfüllen“ erzeugt die PDFs im Speicher,
die Download-Knöpfe zeigen auf lokale `blob:`-Adressen.

Sicherheitsregeln, die technisch abgesichert und getestet sind:

- CSP: nur eigene Quellen, `connect-src 'self'`, kein `unsafe-eval`/`unsafe-inline`, `frame-ancestors 'none'`, `form-action 'none'`
  (selbst wenn JavaScript ausfällt, kann das Formular nie abgeschickt werden).
- Keine Inline-Skripte, keine Inline-Styles, keine externen Adressen, keine Analytics.
- Kein localStorage, sessionStorage, Cookie. Formular mit `autocomplete="off"`, wird beim Laden zurückgesetzt. Eingabefelder haben
  keine `name`-Attribute, damit nie Daten in einer URL landen können.
- Ausgetauschte oder beschädigte Vorlage → Befüllung bricht ab (Prüfsumme in `VORLAGEN`, `site/lib/organspende.js`).

## Texte und Adressen ändern

| Was | Wo |
|---|---|
| Überschrift, Hinweise, Schritte, Zeugen-/Ausweis-Hinweis vor dem Download | `site/index.html` |
| Versandanleitung inkl. Adressen (OVSZ NSZTR, GÖG, wr@goeg.at) | `site/index.html`, Abschnitt `id="versand"` |
| Links Erstberatung, Ratgeber, Impressum, Datenschutz | `site/index.html`, Suche nach `PLATZHALTER` |
| Zeugen-Hinweis und „Kopie – nicht einsenden“ im HU-PDF | `site/lib/organspende.js`, `ZEUGEN_HINWEIS`, `KOPIE_VERMERK` |
| Auswahlliste Staatsangehörigkeit (mit ungarischer Bezeichnung) | `site/lib/organspende.js`, `STAATSANGEHOERIGKEITEN` |
| Auswahlliste Wohnsitzland | `site/lib/organspende.js`, `LAENDER` |
| Pflichtfelder je Land | `site/lib/organspende.js`, `fehlendeAngaben` |
| Neue Vorlage | Datei in `vorlagen/` **und** `site/vorlagen/` ersetzen, SHA-256 in `VORLAGEN` bewusst anpassen, Koordinaten prüfen, `npm test` |

Amtliche Texte und das Begleitschreiben werden nicht verändert, nur befüllt.

## Textvorschlag Datenschutzerklärung

> Die Ausfüllhilfe verarbeitet Ihre Eingaben ausschließlich lokal in Ihrem Browser. Es werden keine Eingaben an uns oder Dritte
> übertragen oder gespeichert.

## Veröffentlichen (nur mit Bernds OK)

Nicht erledigt, nicht Teil dieses Auftrags. Für später: Cloudflare Pages, Ausgabeordner `site`, kein Build-Befehl, keine
Umgebungsvariablen. `_headers` wird von Cloudflare Pages automatisch angewendet. Nach dem ersten Deployment im Browser prüfen, dass
die Header ankommen (Entwicklertools → Netzwerk → Antwort-Header von `/`).

## Offene Punkte

1. **Sichtprüfung AT-Kästchen in Acrobat Reader und im Edge-Druck steht aus.** Hier nicht verfügbar. Geprüft ist: Zustandsnamen
   exakt aus dem Original, kein `NeedAppearances`, Darstellung in PDFium (Chrome-Engine) und poppler korrekt (`probe/kaestchen/`).
   Bitte `probe/Probe_AT_1_….pdf` in Acrobat öffnen und in Edge drucken (Druckvorschau reicht).
2. Links (Erstberatung, Ratgeber, Impressum, Datenschutz) sind Platzhalter.
3. Begleitschreiben HU bleibt in der amtlich geprüften „ich/wir“-Form. Eine Ich-Fassung nur, wenn Bernd sie als geprüfte Datei liefert.
4. Ungarische Bezeichnungen der Staatsangehörigkeiten außer „német“ (osztrák, svájci, magyar, holland, belga, luxemburgi) bitte von
   der Übersetzerin bestätigen lassen.
5. Einwilligungserklärung, Feld Land: jetzt zweisprachig für alle Länder („Németország / Deutschland“). Im Board stand das nur für
   Ungarn, sonst nur Deutsch. Bitte bestätigen.
6. „Weitere Person ausfüllen“ leert alles außer der Länderauswahl (laut Auftrag). Optional: Adresse für den Partner stehen lassen.
7. Ladegröße beim Seitenaufruf ca. 6,5 MB (Vorlagen 5,5 MB, davon AT 3,4 MB). Auf langsamen Mobilverbindungen dauert das einige
   Sekunden; der Knopf ist bis dahin gesperrt und es steht „Formulare werden geladen …“.
8. TAJ-Nummer: geprüft wird nur „9 Ziffern“, nicht die Prüfziffer (Algorithmus nicht amtlich bestätigt).
9. Datum „heute“ kommt aus der Uhr des Besucher-Computers.
