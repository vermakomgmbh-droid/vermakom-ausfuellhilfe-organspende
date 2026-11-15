# Auftrag: Ausfüllhilfe „Organspende-Widerspruch Ungarn/Österreich“ (Stand 15.11.2026)

Für VerMaKom GmbH. Arbeite auf einem eigenen Branch und liefere per Pull Request. Merge und Veröffentlichung macht nur Bernd.

Lies zuerst `uebernahme/LIESMICH_UEBERNAHME.md`.

## Ziel
Eine öffentliche, statische Webseite. Besucher wählt Ungarn, Österreich oder beide (Standard: beide), trägt seine Daten einmal auf Deutsch ein und lädt die ausgefüllten amtlichen Original-PDFs plus Versandanleitung herunter. Danach: ausdrucken, unterschreiben, abschicken.

## Harte Regeln (nicht verhandelbar)
1. Rein statisch. Kein Server, keine Datenbank, kein Supabase, keine API, keine Formular-Übertragung.
2. PDFs entstehen ausschließlich im Browser. Vorlagen, Schrift und Bibliotheken werden beim Seitenaufruf von der eigenen Seite geladen; danach gibt es keinen Netzwerk-Request mehr, und Eingaben verlassen nie den Browser. Keine Analytics, keine Tracker, keine externen CDNs, keine Google Fonts – alles liegt lokal im Repo.
3. Keine personenbezogenen Daten in URLs, kein localStorage, kein sessionStorage, keine Cookies. Nach Neuladen sind alle Eingaben weg.
4. Strenge Content-Security-Policy über die Cloudflare-Pages-Datei `_headers`: nur eigene Quellen (`default-src 'self'`, `connect-src 'self'`, kein `unsafe-eval`, `frame-ancestors 'none'`). Kein Deployment, kein DNS, keine Cloudflare-Änderung ohne Bernds ausdrückliches OK.
5. Kein Zugriff auf das Mandanten-Board. Grundlage ist nur, was in `vorlagen/` und `uebernahme/` liegt.
6. Amtliche Texte und das Begleitschreiben werden nicht verändert. Wir befüllen nur.

## Vorlagen (`vorlagen/`)
- HU: `HU_Widerspruch.pdf` (Protesterklärung DE/HU, Version 1/2026), `HU_Einwilligung.pdf` (Pflicht, ohne Einwilligung keine Registrierung), `HU_Begleitschreiben_hu.pdf` (an NSZTR), `HU_Begleitschreiben_de.pdf` (Übersetzung, nur Kopie für den Besucher), `HU_Widerruf.pdf` (nur Ablage, nicht befüllen).
- AT: `AT_Widerspruch.pdf` – GÖG-Formular „Organspende – Widerspruch/Änderung/Löschung“, Stand 2025, inkl. Infoblatt.
- Befüll-Logik: `uebernahme/organspende.js` (im Board getestet). Übernehmen und nach `LIESMICH_UEBERNAHME.md` anpassen.

## Umfang
- Eine Person pro Durchgang. Button „Weitere Person ausfüllen“ leert das Formular (für Partner).
- Begleitschreiben HU: Originaltext („ich/wir“-Form) unverändert; Absender, „Ort, Datum“ (Ort = Wohnort, Datum = heute), eine Unterschriftslinie mit Namen. Leere Seite 2 entfällt.
- Zeugen HU: beide Felder leer (handschriftlich). Hinweis: zwei volljährige Zeugen, Ehepartner und Verwandte erlaubt; Name, Adresse, Ausweisnummer, blaue Tinte.
- AT ankreuzen wie in `organspende.js`: Aufnahme ins Register, Geschlecht, „keine österr. SV-Nummer“ + Ausweisart (bzw. SV-Nummer, falls angegeben), Bestätigung an Wohnadresse, Kopien beigefügt: Ja, „Ort, Datum“.

## Eingabefelder
Vorname, Nachname, Geburtsname (falls abweichend), Geschlecht, Geburtsdatum, Geburtsort, Staatsangehörigkeit (Auswahlliste; HU-Ausgabe auf Ungarisch, z. B. „német“), Geburtsname der Mutter getrennt nach Nachname/Vorname, Straße/Hausnr., Land, PLZ, Ort, TAJ-Nummer (nur HU), Ausweisart (Reisepass/Personalausweis/Führerschein), Ausweisnummer, österr. SV-Nummer (optional, nur AT). Pflichtfelder je nach Länderauswahl (siehe `fehlendeAngaben`). Datumsformat: HU jjjj.mm.tt, AT TT.MM.JJJJ.
Ungarische Sonderzeichen (ő, ű) müssen im PDF korrekt erscheinen – DejaVu-Schrift ist dafür eingebunden; mit Testdaten prüfen.

## Ausgabe
- HU-Paket (ein PDF): Begleitschreiben HU, Protesterklärung, Einwilligungserklärung, dazu das DE-Begleitschreiben als „Kopie für Ihre Unterlagen – nicht einsenden“.
- AT-Paket (ein PDF): Infoblatt + Formular.
- Versandanleitung je Land (auf der Seite und druckbar):
  - HU: per Einschreiben an OVSZ NSZTR, 1113 Budapest, Karolina út 19-21. Eigenhändig unterschreiben, zwei volljährige Zeugen (Ehepartner und Verwandte erlaubt), blaue Tinte. Kein Arzt nötig. Eine Kopie bis zur Eintragungsbestätigung bei den Ausweispapieren aufbewahren.
  - AT: Original unterschreiben, gut lesbare Kopie eines amtlichen Lichtbildausweises beilegen, per Post an Gesundheit Österreich GmbH, Widerspruchsregister, Stubenring 6, 1010 Wien, oder eingescannt an wr@goeg.at. Bestätigung kommt per Post.
  - Beide: Kopie für eigene Unterlagen und für die Familie.

## Texte der Seite
- H1: „In fünf Minuten ausgefüllt: Ihr Widerspruch für Ungarn und Österreich.“ (keine Namensbegrüßung)
- Hinweis oben: „Ihre Angaben verlassen Ihren Computer nicht. Wir speichern nichts.“
- Schritte: 1 Land wählen · 2 Daten eintragen · 3 PDFs herunterladen.
- Vor dem Download sichtbar: HU braucht zwei Zeugen, AT eine Ausweiskopie.
- Nach dem Download: Versandanleitung, dann: „Die Organspende ist geregelt. Was ist mit Patientenverfügung, Vollmacht und Testament? → Kostenlose Erstberatung (30 Min., online)“ + Link zum Ratgeber (Links als Platzhalter).
- DOI-Hinweis: „Bitte bestätigen Sie noch Ihre E-Mail-Adresse – dann erhalten Sie die Versand-Checkliste.“
- Haltung: nicht gegen Organspende, sondern für die eigene Entscheidung. Keine Aussagen gegen Ärzte, keine Aussage zum deutschen Organspendeausweis, kein Satz „Sie sind automatisch Organspender“.
- Fußzeile: Impressum, Datenschutzerklärung (URLs als Platzhalter). Textvorschlag für die Datenschutzerklärung in die README: „Die Ausfüllhilfe verarbeitet Ihre Eingaben ausschließlich lokal in Ihrem Browser. Es werden keine Eingaben an uns oder Dritte übertragen oder gespeichert.“
- Design: schlicht, gut lesbar für 55+, große Schrift, mobil nutzbar.

## Nicht in diesem Auftrag
Landingpage, GHL, Opt-in, Mails, Meta. Die Seite wird später Weiterleitungsziel nach dem GHL-Opt-in (ohne Daten in der URL).

## Fertig ist es erst, wenn
1. Probe mit Musterdaten (inkl. ő/ű) für HU, AT und „beide“ erfolgreich; Ergebnis-PDFs im PR angehängt und mit `uebernahme/referenz/` verglichen.
2. Nachweis: Netzwerk-Mitschnitt – nach dem Seitenaufruf 0 Requests, beim Erzeugen 0 Requests.
3. AT-Kästchen in Acrobat Reader und im Edge-Druck geprüft.
4. Mobil (schmaler Bildschirm) und Druck getestet.
5. README: lokal starten, Aufbau, wo Texte/Adressen geändert werden, offene Punkte.

Kommst du 30 Minuten nicht weiter: stopp, Blockade benennen, Alternative vorschlagen.
