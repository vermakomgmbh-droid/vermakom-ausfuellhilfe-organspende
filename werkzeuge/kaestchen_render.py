"""Rendert die AT-Formularseiten (S. 3 und 5) der Browser-Probe mit zwei unabhängigen Engines:
PDFium (Chrome/Chromium-PDF-Engine, mit Formular-Erscheinungsbildern) und poppler (pdftoppm).
Ersetzt NICHT die Sichtprüfung in Acrobat Reader und im Edge-Druck. Ausgabe: probe/kaestchen/."""
import glob, os, subprocess
import pypdfium2 as pdfium

WURZEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUS = os.path.join(WURZEL, 'probe', 'kaestchen')
os.makedirs(AUS, exist_ok=True)
for f in sorted(glob.glob(os.path.join(WURZEL, 'probe', 'Probe_*Oesterreich*.pdf'))):
    name = os.path.basename(f).split('_')[1]
    pdf = pdfium.PdfDocument(f)
    pdf.init_forms()
    for s in (3, 5):
        pdf[s - 1].render(scale=110 / 72, may_draw_forms=True).to_pil().save(os.path.join(AUS, f'AT_{name}_S{s}_pdfium.png'))
        subprocess.run(['pdftoppm', '-r', '110', '-f', str(s), '-l', str(s), '-png', '-singlefile', f,
                        os.path.join(AUS, f'AT_{name}_S{s}_poppler')], check=True, stderr=subprocess.DEVNULL)
print('\n'.join(sorted(os.listdir(AUS))))
