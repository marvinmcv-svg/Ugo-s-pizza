#!/usr/bin/env python3
"""Build the printable table QR cards for the AR menu.

  qr-mesas.html        printable page (A4, 6 cards per page, cut lines), served at /qr-mesas.html
  print/qr-mesas.pdf   the same, ready to print (made with the pre-installed Chromium if available)

Each card: pizza photo + name + "Escaneá y mirala en tu mesa" + QR → <SITE>/?ver=<id>.
The QR codes are generated here (SVG), so printing needs no internet.

Usage:  python3 tools/build-table-qr.py
Needs:  pip install qrcode
"""
import html
import re
import subprocess
from pathlib import Path

import qrcode
import qrcode.image.svg

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://ugos-pizza.vercel.app"   # where the AR menu lives; change if the site moves to ugospizzas.com


def qr_svg(url):
    img = qrcode.make(url, image_factory=qrcode.image.svg.SvgPathImage, error_correction=qrcode.constants.ERROR_CORRECT_M, border=2)
    svg = img.to_string(encoding="unicode")
    svg = re.sub(r"<\?xml[^>]*>", "", svg)
    return re.sub(r'(width|height)="[^"]*mm"', "", svg, count=2)


def main():
    data = (ROOT / "js" / "data.js").read_text()
    menu = re.findall(r'\{ id: "([^"]+)", name: "([^"]+)", price: \d+, desc: "[^"]*", img: "(assets/img/pizza-[^"]+)"', data)
    cards = []
    for pid, name, img in menu:
        url = f"{SITE}/?ver={pid}"
        cards.append(f"""<article class="card">
  <img class="logo" src="assets/img/logo.png" alt="Ugo's Pizza">
  <img class="pizza" src="{img}" alt="">
  <h2>{html.escape(name)}</h2>
  <p class="lede">Escaneá y mirala <b>en tu mesa</b>, a tamaño real</p>
  <div class="qr">{qr_svg(url)}</div>
  <p class="how">Abrí la cámara del celular · apuntá al código · tocá <b>“Ver en tu mesa”</b></p>
  <p class="url">{html.escape(url.replace("https://", ""))}</p>
</article>""")
    page = f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>QR de mesa · Ugo's Pizza</title>
<link href="https://fonts.googleapis.com/css2?family=Bangers&family=DM+Sans:wght@400;700&display=swap" rel="stylesheet">
<style>
  :root {{ --red: #ff5c00; --wine: #1a0c08; --cream: #fbfbec; --mustard: #fed000; --ink: #1a120d; }}
  @page {{ size: A4; margin: 8mm; }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; background: #ddd; font-family: "DM Sans", system-ui, sans-serif; color: var(--ink); -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
  .bar {{ max-width: 194mm; margin: 16px auto; padding: 0 8px; display: flex; gap: 12px; align-items: center; justify-content: space-between; flex-wrap: wrap; }}
  .bar button {{ font: 700 1rem "DM Sans", sans-serif; padding: .7em 1.4em; border: 0; border-radius: 999px; background: var(--red); cursor: pointer; }}
  .sheet {{ width: 194mm; margin: 0 auto 16px; display: grid; grid-template-columns: repeat(2, 1fr); grid-auto-rows: 93mm; background: #fff; }}
  .card {{ position: relative; border: 0.3mm dashed #bbb; padding: 4mm 5mm 3mm; display: grid; grid-template-columns: 1fr 38mm; grid-template-rows: auto auto 1fr auto auto; column-gap: 4mm; background: var(--cream); overflow: hidden; break-inside: avoid; }}
  .logo {{ position: absolute; top: 3mm; left: 4mm; width: 11mm; height: 11mm; }}
  .pizza {{ grid-column: 1; grid-row: 1 / 4; width: 100%; height: 44mm; object-fit: contain; margin-top: 6mm; align-self: start; }}
  h2 {{ grid-column: 2; grid-row: 1; font: 400 7mm/1 "Bangers", Impact, sans-serif; letter-spacing: .04em; margin: 1mm 0 1mm; color: var(--wine); }}
  .lede {{ grid-column: 2; grid-row: 2; margin: 0 0 2mm; font-size: 3.1mm; line-height: 1.25; }}
  .lede b {{ color: #a82600; }}
  .qr {{ grid-column: 2; grid-row: 3; width: 38mm; height: 38mm; background: #fff; border-radius: 2mm; padding: 1mm; align-self: end; }}
  .qr svg {{ width: 100%; height: 100%; display: block; }}
  .how {{ grid-column: 1 / 3; grid-row: 4; margin: 3mm 0 0; padding: 2mm 3mm; border-radius: 2mm; background: var(--wine); color: var(--cream); font-size: 3mm; line-height: 1.3; text-align: center; }}
  .how b {{ color: var(--mustard); }}
  .url {{ grid-column: 1 / 3; grid-row: 5; margin: 1.2mm 0 0; font-size: 2.4mm; text-align: center; opacity: .6; }}
  @media print {{ body {{ background: #fff; }} .bar {{ display: none; }} .sheet {{ margin: 0; }} }}
</style>
</head>
<body>
<div class="bar"><span><b>QR de mesa</b> · {len(cards)} tarjetas · A4, 6 por hoja. Recortá por la línea punteada.</span><button onclick="print()">Imprimir</button></div>
<main class="sheet">
{chr(10).join(cards)}
</main>
</body>
</html>
"""
    out = ROOT / "qr-mesas.html"
    out.write_text(page)
    print("wrote", out.relative_to(ROOT), f"({len(cards)} cards)")

    pdf = ROOT / "print" / "qr-mesas.pdf"
    pdf.parent.mkdir(exist_ok=True)
    js = f"""
const {{ chromium }} = require('playwright');
(async () => {{
  const b = await chromium.launch(); const p = await b.newPage();
  await p.route(/fonts\\.(googleapis|gstatic)\\.com/, r => r.continue().catch(() => r.abort()));
  await p.goto('file://{out}', {{ waitUntil: 'networkidle' }}).catch(() => {{}});
  await p.waitForTimeout(800);
  await p.pdf({{ path: '{pdf}', format: 'A4', printBackground: true, preferCSSPageSize: true }});
  await b.close();
}})();
"""
    try:
        subprocess.run(["node", "-e", js], check=True, timeout=120)
        print("wrote", pdf.relative_to(ROOT))
    except Exception as e:  # noqa: BLE001 — PDF is optional; the HTML prints from any browser
        print("PDF skipped:", e)


if __name__ == "__main__":
    main()
