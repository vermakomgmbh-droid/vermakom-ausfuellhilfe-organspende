# Netzwerk-Mitschnitt (Browser-Probe)

Chromium 153.0.8010.12, echte Seite über `werkzeuge/server.mjs` mit den Headern aus `site/_headers` (CSP aktiv).
Erzeugt mit `npm run browserprobe` am 2026-11-15. Rohdaten: `netzwerk_protokoll.json`.

| Lauf | Requests beim Seitenaufruf | Requests nach dem Laden, beim Erzeugen und Herunterladen | CSP-Verstöße | Konsolenfehler | Browserspeicher/Cookies | Downloads |
|---|---|---|---|---|---|---|
| HU | 12 (nur eigene Seite) | **0** | 0 | 0 | 0/keine | Probe_HU_1_Organspende-Widerspruch_Ungarn_Muster_Hans.pdf |
| AT | 12 (nur eigene Seite) | **0** | 0 | 0 | 0/keine | Probe_AT_1_Organspende-Widerspruch_Oesterreich_Muster_Hans.pdf |
| beide | 12 (nur eigene Seite) | **0** | 0 | 0 | 0/keine | Probe_beide_1_Organspende-Widerspruch_Ungarn_Mueller-Kovari_Erzsebet.pdf<br>Probe_beide_2_Organspende-Widerspruch_Oesterreich_Mueller-Kovari_Erzsebet.pdf |

## Requests beim Seitenaufruf (Lauf HU, identisch in allen Läufen)

- GET /
- GET /style.css
- GET /vendor/fontkit.umd.min.js
- GET /app.js
- GET /lib/organspende.js
- GET /vendor/pdf-lib.esm.min.js
- GET /vendor/schrift/DejaVuSans.ttf
- GET /vorlagen/HU_Begleitschreiben_hu.pdf
- GET /vorlagen/HU_Begleitschreiben_de.pdf
- GET /vorlagen/HU_Widerspruch.pdf
- GET /vorlagen/HU_Einwilligung.pdf
- GET /vorlagen/AT_Widerspruch.pdf

Nach dem Seitenaufruf: Eingabe, „Formulare ausfüllen“, Download aller PDFs, „Weitere Person ausfüllen“ – **0 Requests**.
Die Downloads sind blob:-Adressen im Browser (kein Netzwerk). Die URL bleibt in allen Läufen `/` ohne Daten.
Neuladen lädt dieselben 12 Dateien erneut; danach sind alle Eingaben leer.
