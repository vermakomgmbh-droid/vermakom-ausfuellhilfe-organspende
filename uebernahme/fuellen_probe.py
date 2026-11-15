"""Probe: amtliche Organspende-PDFs (HU + AT) mit Musterdaten befüllen.
Spätere App macht dasselbe im Browser (pdf-lib) mit denselben Koordinaten."""
import io, sys, re
from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

O = 'organspende/orig/'
pdfmetrics.registerFont(TTFont('DV', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
BLAU = (0.05, 0.15, 0.55)

PAAR = [
    dict(nach='Muster', vor='Erika', geburtsname='Muster, Erika', gebdat='1962.04.17', gebort='Mönchengladbach',
         mutter='Schmitz, Maria', taj='123 456 789', strasse='Fő utca 12', land='HU', plz='8360', ort='Keszthely',
         staat='deutsch', staat_hu='német', geschlecht='w', ausweis='Reisepass', ausweisnr='C01X00T47'),
    dict(nach='Muster', vor='Hans', geburtsname='Muster, Hans', gebdat='1959.11.02', gebort='Köln',
         mutter='Becker, Anna', taj='987 654 321', strasse='Fő utca 12', land='HU', plz='8360', ort='Keszthely',
         staat='deutsch', staat_hu='német', geschlecht='m', ausweis='Personalausweis', ausweisnr='L01X00T48'),
]
ERSTELLT = '2026.11.12'


def overlay(src, page_no, items, size=10):
    """items: (x, y_top, text) – y_top in pdfplumber-Koordinaten (von oben)."""
    r = PdfReader(src)
    p = r.pages[page_no]
    w, h = float(p.mediabox.width), float(p.mediabox.height)
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(w, h))
    c.setFillColorRGB(*BLAU)
    for it in items:
        x, yt, t = it[:3]
        s = it[3] if len(it) > 3 else size
        c.setFont('DV', s)
        c.drawString(x, h - yt + 2.5, t)
    c.save()
    buf.seek(0)
    p.merge_page(PdfReader(buf).pages[0])
    return p


def hu_widerspruch(P):
    name = f"{P['nach']} {P['vor']}"
    adr = f"{P['plz']} {P['ort']}, {P['strasse']}"
    b = 150  # Grundlinie = bottom - 2
    items = [
        (90, b, name), (110, 197, name),
        (282, 251, P['geburtsname'].replace(',', '')), (330, 279, P['gebdat']), (160, 308, P['gebort']),
        (338, 336, P['mutter'].replace(',', '')), (130, 364, P['taj']), (150, 393, adr),
        (210, 421, f"{P['staat_hu']} / {P['staat']}"), (130, 497, f"{P['ort']}, {ERSTELLT}"),
    ]
    return overlay(O + 'HU_Widerspruch.pdf', 0, items)


def hu_einwilligung(P):
    mn, mv = [x.strip() for x in P['mutter'].split(',')]
    it = [(200, 325, P['nach']), (170, 341, P['vor']), (165, 356, P['taj']), (230, 372, P['gebdat']),
          (205, 387, P['gebort']), (385, 403, mn), (380, 418, mv),
          (165, 434, 'Magyarország / Ungarn'), (205, 447, P['plz']), (190, 462, P['ort']), (250, 478, P['strasse']),
          (290, 728, ERSTELLT)]
    r = PdfReader(O + 'HU_Einwilligung.pdf')
    return [overlay(O + 'HU_Einwilligung.pdf', 0, it), r.pages[1]]


def begleitschreiben(datei, sprache):
    namen = ' / '.join(f"{P['vor']} {P['nach']}" for P in PAAR)
    P = PAAR[0]
    ortdat = f"{P['ort']}, {ERSTELLT}"
    dy = -8 if sprache == 'de' else 0
    it = [(86, 70 + dy, namen, 9), (86, 82 + dy, P['strasse'], 9), (86, 94 + dy, f"{P['land']} - {P['plz']} {P['ort']}", 9),
          (380, 260 + dy, ortdat)]
    y = (474 if sprache == 'hu' else 501) + 40
    for Q in PAAR:
        it.append((72, y, '_' * 34, 9)); it.append((72, y + 13, f"{Q['vor']} {Q['nach']}", 9)); y += 45
    return overlay(O + datei, 0, it)


SV_AT = {'Reisepass': 'Reisepass', 'Personalausweis': 'Personalausweis'}


def at_formular(P):
    r = PdfReader(O + 'AT_Widerspruch.pdf')
    w = PdfWriter()
    w.append(r)
    t, m, j = P['gebdat'][8:10], P['gebdat'][5:7], P['gebdat'][0:4]
    werte = {'Familienname': P['nach'], 'Vorname': P['vor'], 'Tag': t[0], 'Tag1': t[1], 'Monat': m[0], 'Monat1': m[1],
             'Jahr': j[0], 'Jahr1': j[1], 'Jahr2': j[2], 'Jahr3': j[3], 'Straße': re.sub(r'\s*\d.*$', '', P['strasse']),
             'Hausnr': re.sub(r'^\D*', '', P['strasse']), 'PLZ': P['plz'], 'Ort': P['ort'], 'Bundesland/Staat': 'Ungarn',
             'Staatsbürgerschaft': 'Deutschland', 'Nummer': P['ausweisnr'], 'Ort Datum': f"{P['ort']}, {ERSTELLT[8:]}.{ERSTELLT[5:7]}.{ERSTELLT[:4]}"}
    for pg in w.pages:
        w.update_page_form_field_values(pg, werte, auto_regenerate=False)
    # Kästchen nach Position (Seite, x, y unten) – Abschnitt A und Seite 5
    ziel = {(2, 252, 723), (2, 302, 426), (4, 42, 582), (4, 267, 294),
            (2, 530, 517) if P['geschlecht'] == 'w' else (2, 488, 517),
            (2, 316, 407) if P['ausweis'] == 'Reisepass' else (2, 316, 397)}
    for pi in (2, 4):
        for a in w.pages[pi].get('/Annots'):
            a = a.get_object()
            r = [round(float(x)) for x in a['/Rect']]
            if (pi, r[0], r[1]) not in ziel: continue
            ap = a['/AP']['/N']
            st = [k for k in ap.keys() if k != '/Off'][0]
            a[NameObject('/AS')] = NameObject(st)
            par = a.get('/Parent')
            (par.get_object() if par else a)[NameObject('/V')] = NameObject(st)
    w.set_need_appearances_writer(True)
    return w


def main():
    out = PdfWriter()
    out.add_page(begleitschreiben('HU_Begleitschreiben_hu.pdf', 'hu'))
    for P in PAAR:
        out.add_page(hu_widerspruch(P))
        for pg in hu_einwilligung(P):
            out.add_page(pg)
    out.add_page(begleitschreiben('HU_Begleitschreiben_de.pdf', 'de'))  # Kopie für den Kunden
    out.write('organspende/Probe_HU_Paar.pdf')
    for i, P in enumerate(PAAR):
        at_formular(P).write(f'organspende/Probe_AT_{P["vor"]}.pdf')
    print('ok')


main()
