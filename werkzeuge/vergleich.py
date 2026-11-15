"""Pixelvergleich Probe <-> Board-Referenz (uebernahme/referenz). Rendert mit pdftoppm (poppler), 100 dpi.
Schreibt probe/vergleich/VERGLEICH.md und Differenzbilder (rot = nur Probe, blau = nur Referenz)."""
import subprocess, sys, tempfile, os
from PIL import Image, ImageChops

WURZEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUS = os.path.join(WURZEL, 'probe', 'vergleich')
REF = os.path.join(WURZEL, 'uebernahme', 'referenz')
# (Probe-Datei, Probe-Seite, Referenz-Datei, Referenz-Seite, Beschreibung, erwartete Abweichung)
PAARE = [
    ('Vergleich_HU_Hans.pdf', 1, 'Probedruck_HU_Paar.pdf', 1, 'HU Begleitschreiben (ungarisch)', 'Referenz: Paar (2 Namen, 2 Unterschriftslinien); Probe: 1 Person'),
    ('Vergleich_HU_Hans.pdf', 2, 'Probedruck_HU_Paar.pdf', 2, 'HU Protesterklärung Hans', 'Referenz: Zeuge 1 = Ehepartnerin vorbefüllt; Probe: Zeugenfelder leer'),
    ('Vergleich_HU_Hans.pdf', 3, 'Probedruck_HU_Paar.pdf', 3, 'HU Einwilligung S. 1', 'keine'),
    ('Vergleich_HU_Hans.pdf', 4, 'Probedruck_HU_Paar.pdf', 4, 'HU Einwilligung S. 2', 'keine'),
    ('Vergleich_HU_Hans.pdf', 5, 'Probedruck_HU_Paar.pdf', 8, 'HU Begleitschreiben (deutsche Kopie)', 'Probe: 1 Person, Kopie-Vermerk, neuer Zeugen-Hinweis'),
] + [('Vergleich_AT_Hans.pdf', i, 'Probedruck_AT_Hans.pdf', i, f'AT Seite {i}', 'keine') for i in range(1, 6)]


def render(pdf, seite, ziel):
    subprocess.run(['pdftoppm', '-r', '100', '-f', str(seite), '-l', str(seite), '-png', '-singlefile', pdf, ziel], check=True, stderr=subprocess.DEVNULL)
    return Image.open(ziel + '.png').convert('L')


def main():
    zeilen = ['# Vergleich Probe ↔ Board-Referenz', '',
              'Gleiche Musterdaten (Hans Muster) und gleiches Datum (12.11.2026) wie `uebernahme/referenz/`. '
              'Gerendert mit poppler (pdftoppm, 100 dpi). Abweichung = Anteil der Pixel mit Helligkeitsunterschied > 64.', '',
              '| Seite | Abweichung | Bereich (x1,y1–x2,y2 in pt) | Erwartet |', '|---|---|---|---|']
    tmp = tempfile.mkdtemp()
    for i, (pd, ps, rd, rs, name, erwartet) in enumerate(PAARE):
        a = render(os.path.join(AUS, pd), ps, os.path.join(tmp, f'a{i}'))
        b = render(os.path.join(REF, rd), rs, os.path.join(tmp, f'b{i}'))
        if a.size != b.size:
            b = b.resize(a.size)
        diff = ImageChops.difference(a, b).point(lambda v: 255 if v > 64 else 0)
        n = diff.histogram()[255]
        anteil = n / (a.size[0] * a.size[1]) * 100
        box = diff.getbbox()
        bereich = '–' if not box else '%d,%d–%d,%d' % tuple(round(v * 72 / 100) for v in box)
        zeilen.append(f'| {name} | {anteil:.3f} % | {bereich} | {erwartet} |')
        if box:
            rgb = Image.merge('RGB', (a, b, b))   # rot = nur Probe dunkel? -> Kanäle: R aus Probe, G/B aus Referenz
            rgb.save(os.path.join(AUS, 'Diff_%02d_%s.png' % (i + 1, ''.join(c if c.isascii() and c.isalnum() else '_' for c in name.replace('ä', 'ae')))))
    zeilen += ['', 'Differenzbilder `Diff_*.png`: Rot-Kanal = Probe, Grün/Blau = Referenz. '
               'Cyan = nur in der Probe, Rot = nur in der Referenz, Grau = gleich.']
    open(os.path.join(AUS, 'VERGLEICH.md'), 'w', encoding='utf-8').write('\n'.join(zeilen) + '\n')
    print('\n'.join(zeilen))


main()
