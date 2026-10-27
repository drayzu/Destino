"""The README's button, as in Espacio and Tiempo: the address and a key to enter.

    python tools/readme_svg.py   ->  media/enter-{dark,light}.svg

Until the site is published the key says SOON (set ABIERTO = True when it is). Fonts are subset and
embedded, so the SVGs look the same on GitHub as here.
"""
import base64, io, os
from fontTools import subset
from fontTools.ttLib import TTFont

ABIERTO = False

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'media')
NM = os.path.join(ROOT, 'node_modules')
MONO = NM + '/@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2'
UNICODES = list(range(0x20, 0x7f))
THEMES = {
    'dark': dict(ink='#ece7db', page='#0d1117', acc='#6fe3c1', key='#0d0b0a'),
    'light': dict(ink='#1f1d1a', page='#ffffff', acc='#108062', key='#ffffff'),
}


def font_b64(path):
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['kern', 'liga']
    opts.name_IDs = []
    f = TTFont(path)
    s = subset.Subsetter(opts)
    s.populate(unicodes=UNICODES)
    s.subset(f)
    buf = io.BytesIO()
    f.flavor = 'woff2'
    f.save(buf)
    return base64.b64encode(buf.getvalue()).decode()


FONT_CSS = "@font-face{font-family:M;src:url(data:font/woff2;base64,%s) format('woff2');font-weight:100 900}" % font_b64(MONO)


def arrow(x, y, s, color, w=1.6):
    """A right arrow drawn as a path (the subset font has no arrow glyphs)."""
    return (f'<path d="M{x},{y} h{s} m{-s * .38:.1f},{-s * .34:.1f} l{s * .38:.1f},{s * .34:.1f} l{-s * .38:.1f},{s * .34:.1f}" '
            f'fill="none" stroke="{color}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"/>')


def enter(t):
    ink, acc = t['ink'], t['acc']
    label = 'Open drayzu.github.io/Destino' if ABIERTO else 'Destino, coming soon to drayzu.github.io/Destino'
    style = '.k{animation:k 2.4s ease-in-out infinite}@keyframes k{0%,80%,100%{transform:translateY(0)}88%{transform:translateY(2px)}}'
    b = [f'<rect x="10" y="15" width="480" height="60" rx="30" fill="{t["page"]}" stroke="{ink}" stroke-opacity=".3"/>',
         arrow(40, 45, 15, acc, 1.6),
         f'<text x="66" y="51" font-family="M,monospace" font-size="16" letter-spacing=".5" fill="{ink}">drayzu.github.io/Destino</text>']
    if ABIERTO:
        b.append(f'<g class="k"><rect x="372" y="27" width="100" height="36" rx="18" fill="{acc}"/>'
                 f'<text x="414" y="50" text-anchor="middle" font-family="M,monospace" font-weight="600" font-size="13" letter-spacing="1.5" fill="{t["key"]}">ENTER</text>'
                 f'<path d="M455,38 v7 h-8 m3,-3 l-3,3 l3,3" fill="none" stroke="{t["key"]}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></g>')
    else:
        # Not open yet: an outlined key, quiet, that does not press.
        b.append(f'<rect x="380" y="27" width="92" height="36" rx="18" fill="none" stroke="{acc}" stroke-opacity=".8"/>'
                 f'<text x="426" y="50" text-anchor="middle" font-family="M,monospace" font-weight="600" font-size="13" letter-spacing="1.5" fill="{acc}">SOON</text>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 90" width="500" height="90" role="img" aria-label="{label}">'
            f'<title>{label}</title><style>{FONT_CSS}{style}</style>{"".join(b)}</svg>')


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for name, th in THEMES.items():
        data = enter(th)
        with open(os.path.join(OUT, f'enter-{name}.svg'), 'w', encoding='utf-8', newline='\n') as f:
            f.write(data)
        print(f'  enter-{name}.svg {len(data.encode()) / 1024:6.1f} KB')
