# Übernahme aus dem Mandanten-Board (Kopie, 15.11.2026)

Kopiert aus `vermakom-mandanten-board` (Stand Commit 766269b). Nur der Organspende-Baustein, keine Board-Oberfläche, keine Datenbank, keine Zugangsdaten. Geprüft: keine Supabase-Aufrufe, keine Schlüssel, keine echten Kundendaten (nur erfundene Musterdaten).

## Dateien

| Datei | Was | Für das Freebie |
|---|---|---|
| `organspende.js` | Befüll-Logik HU + AT mit pdf-lib, im Board getestet. Koordinaten, AT-Feldnamen, Prüfsummen der Vorlagen, Datumsformate, Pflichtfelder. | **Ausgangspunkt.** Übernehmen und anpassen (siehe unten), nicht neu erfinden. |
| `organspende.test.mjs` | Tests aus dem Board (node:test). | Als Vorlage für eigene Tests. Pfade zeigen noch auf das Board-Layout (`app/...`). |
| `muster_fall.js` | Erfundene Musterdaten im Board-Fallformat (Hans/Erika Muster). | Nur für Tests; Fallformat ist Board-spezifisch. |
| `node_ressourcen.mjs` | Lädt Vorlagen, Schrift, fontkit in Node. | Pfade anpassen. |
| `fuellen_probe.py` | Ursprüngliche Python-Probe (Koordinaten-Herkunft). | Nur Referenz. |
| `vendor/pdf-lib.esm.min.js` | pdf-lib 1.17.1, MIT (byte-gleich mit Board). | Lokal einbinden, kein CDN. |
| `vendor/fontkit.umd.min.js` | @pdf-lib/fontkit 1.1.1, MIT. | Lokal einbinden. |
| `vendor/schrift/DejaVuSans.ttf` | DejaVu Sans 2.37, Bitstream-Vera-Lizenz. Nötig für ő/ű. | Lokal einbinden. |
| `referenz/Probedruck_*.pdf` | Ergebnis-PDFs aus dem Board mit Musterdaten. | Sollbild für den Vergleich. |

Vorlagen liegen in `../vorlagen/`. SHA-256 der fünf Befüll-Vorlagen stimmen mit `VORLAGEN` in `organspende.js` überein (geprüft 15.11.). `HU_Widerruf.pdf` ist nicht in `VORLAGEN` – nur Ablage/FAQ, wird nicht befüllt.

## Was für das Freebie anders ist

1. **Eine Person pro Durchgang.** `huPaket` kann 1 Person bereits. Paar-Logik (`personenFuerHU`, `partnerMitWiderspruch`, `organspendeAuswahl`, `ZEUGE_FAMILIENSTAENDE`) entfällt.
2. **Kein Zeuge vorbefüllt.** `P.zeuge1` nie setzen → beide Zeugenfelder bleiben leer. Hinweistext neu: „Unterschrift mit zwei volljährigen Zeugen (Ehepartner und Verwandte erlaubt; Name, Adresse, Ausweisnummer, blaue Tinte), sonst unwirksam“.
3. **Eingaben aus dem eigenen Formular** statt `personAusFall` (Board-Fallformat). Das Personenobjekt `P` (Felder siehe `personAusFall`) direkt aus den Formularfeldern bauen.
4. **Begleitschreiben HU:** Der amtlich geprüfte Text steht in der Form „ich/wir“ („szeretném(k) … tiltakozásomat/tiltakozásunkat“) und deckt damit Einzelpersonen ab. **Text nicht verändern.** Eine reine Ich-Fassung nur, wenn Bernd sie als von der Übersetzerin geprüfte Datei liefert.
5. **Ressourcen laden:** `ressourcenLaden()` holt Vorlagen und Schrift per `fetch` von der eigenen Seite. Das passiert **beim Seitenaufruf, bevor Daten eingegeben werden**. CSP daher `connect-src 'self'` (nicht `'none'`). Nach dem Laden: keine Requests mehr, und zu keinem Zeitpunkt werden Eingaben übertragen.
6. **Metadaten:** `setCreator('VerMaKom Mandanten-Board')` → `'VerMaKom Ausfüllhilfe'`. Keine Namen in den Metadaten (bleibt so).
7. **Prüfsummen-Prüfung behalten** (`vorlagenPruefen`): wird eine Vorlage ausgetauscht, bricht die Befüllung ab, bis die Prüfsumme bewusst aktualisiert ist.
